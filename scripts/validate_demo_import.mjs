import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const url = "http://localhost:8780/index.html";
const screenshotDir = resolve("artifacts/screenshots");
const sampleGlbPath = resolve("sample_models/stylized_3d_character_model.glb");
await mkdir(screenshotDir, { recursive: true });
const screenshotPath = resolve(screenshotDir, `pipeline_acceptance_${timestamp()}.png`);

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
  args: ["--use-gl=swiftshader", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const browserMessages = [];
const failures = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    const text = message.text();
    if (!text.includes("WebGL") && !text.includes("GPU stall") && !text.includes("CONTEXT_LOST_WEBGL")) {
      browserMessages.push(`${message.type()}: ${text}`);
    }
  }
});
page.on("pageerror", (error) => {
  browserMessages.push(`pageerror: ${error.message}`);
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#rigCanvas", { timeout: 10000 });
  await page.waitForFunction(() => Boolean(window.__motionDebug), { timeout: 10000 });

  await clickAndExpect("#loadTestDummyButton", "load_test_dummy", (state) => state.model === "Loaded");
  await clickAndExpect("#createSkeletonButton", "create_humanoid_skeleton", (state) => (
    state.skeleton === "Humanoid_v1" && state.joints === 19 && state.bones === 18
  ));
  await clickAndExpect("#createIkButton", "create_ik_controls", (state) => (
    state.ik_controls === 14
    && state.visible_joint_debug_controls === false
    && state.control_ids.includes("COG_CTRL")
    && state.control_ids.includes("Pelvis_CTRL")
    && state.control_ids.includes("Chest_CTRL")
  ));
  await executeCommandAndExpect("select_control", { control: "COG_CTRL" }, (state) => state.selected_control === "COG_CTRL");
  await keyboardRotateSelectedControlAndExpect("COG_CTRL");
  await executeCommandAndExpect("set_control_transform", {
    control_id: "COG_CTRL",
    transform_mode: "translate",
    space: "global",
    position: [0.03, 1.18, 0],
  }, (state) => state.selected_control === "COG_CTRL");
  await executeCommandAndExpect("set_control_transform", {
    control_id: "COG_CTRL",
    transform_mode: "rotate",
    space: "global",
    rotation: [0.18, 0.12, 0.08],
  }, (state) => state.selected_control === "COG_CTRL" && state.joint_rotation_overrides >= 1);
  await executeCommandAndExpect("set_control_visual_size", { size: 1.12 }, (state) => Math.abs(state.control_size - 1.12) < 0.001);
  await executeCommandAndExpect("set_control_visual_thickness", { thickness: 0.52 }, (state) => Math.abs(state.control_thickness - 0.52) < 0.001);
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8);

  await ensureDom("timeline keyframes", async () => {
    const count = await page.locator(".key-pose.has-keyframe").count();
    return { pass: count === 8, count };
  });

  const beforePlay = await getSummary();
  await clickAndExpect("#playButton", "play", () => true);
  await page.waitForTimeout(1200);
  const afterPlay = await getSummary();
  record("playback advances frame", afterPlay.current_frame !== beforePlay.current_frame, { beforePlay, afterPlay });

  await clickAndExpect("#validateMotionButton", "validate_motion", (state) => state.validation === "Passed");
  const validation = await page.evaluate(() => window.__motionDebug.getValidationReport());
  record("validation report has required checks", Boolean(
    validation?.checks?.foot_sliding
    && validation?.checks?.knee_flip
    && validation?.checks?.loop_discontinuity
    && validation?.checks?.bone_identity_error
  ), validation);

  await clickAndExpect("#exportJsonButton", "export_motion_json", () => true);
  const exported = await page.evaluate(() => window.__motionDebug.getExportedJson());
  const exportedJson = JSON.parse(exported);
  record("export contains skeleton", exportedJson.skeleton?.id === "Humanoid_v1", exportedJson.skeleton);
  const coreIkControls = (exportedJson.ik_controls || []).filter((control) => !control.is_joint_control);
  const jointControls = (exportedJson.ik_controls || []).filter((control) => control.is_joint_control);
  record("export contains ik_controls", coreIkControls.length === 14 && jointControls.length === 19, {
    core: coreIkControls.length,
    joint: jointControls.length,
    count: exportedJson.ik_controls?.length,
  });
  record("export contains direction", typeof exportedJson.direction?.forward_sign === "number", exportedJson.direction);
  record("export contains keyframes", exportedJson.keyframes?.length === 8, { count: exportedJson.keyframes?.length });
  const firstWalkFrame = exportedJson.keyframes?.[0] || {};
  const keyedControls = new Map((firstWalkFrame.ik_controls || []).map((control) => [control.id, control]));
  record("walk template keyframes COG and pelvis controls", Boolean(
    keyedControls.get("COG_CTRL")
    && keyedControls.get("Pelvis_CTRL")
    && (keyedControls.get("Pelvis_CTRL")?.rotation || []).some((value) => Math.abs(Number(value)) > 0.001)
  ), {
    cog: keyedControls.get("COG_CTRL"),
    pelvis: keyedControls.get("Pelvis_CTRL"),
  });
  record("walk template keeps hands on their own sides", walkHandsStayOnOwnSides(exportedJson), {
    firstFrameHands: {
      right: keyedControls.get("R_Hand_IK")?.position,
      left: keyedControls.get("L_Hand_IK")?.position,
    },
  });
  record("export contains validation_report", exportedJson.validation_report?.status === "Passed", exportedJson.validation_report);

  const beforeUndo = await getSummary();
  await clickAndExpect("#undoButton", "undo", (state) => state.redo_stack === 1);
  const afterUndo = await getSummary();
  record("undo changes state", afterUndo.dirty_state !== beforeUndo.dirty_state || afterUndo.redo_stack > beforeUndo.redo_stack, { beforeUndo, afterUndo });

  await clickAndExpect("#redoButton", "redo", (state) => state.redo_stack === 0 && state.undo_stack >= 1);
  const afterRedo = await getSummary();
  record("redo restores export clean state", afterRedo.dirty_state === false && afterRedo.keyframes === 8, afterRedo);

  const commandLog = await page.evaluate(() => window.__motionDebug.getCommandLog());
  [
    "load_test_dummy",
    "create_humanoid_skeleton",
    "create_ik_controls",
    "select_control",
    "set_control_transform",
    "set_control_visual_size",
    "set_control_visual_thickness",
    "apply_motion_template",
    "play",
    "validate_motion",
    "export_motion_json",
    "undo",
    "redo",
  ].forEach((name) => {
    const entry = commandLog.find((item) => item.name === name && item.status === "success");
    record(`command_log records ${name}`, Boolean(entry), entry || null);
  });

  await importSampleGlbAndValidateToeFallback();

  await page.screenshot({ path: screenshotPath, fullPage: false });
} finally {
  await browser.close();
}

const result = {
  failed: failures.length > 0 || browserMessages.length > 0,
  screenshotPath,
  failures,
  browserMessages,
};

console.log(JSON.stringify(result, null, 2));
if (result.failed) {
  process.exitCode = 1;
}

async function clickAndExpect(selector, commandName, predicate) {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.click(selector);
  await page.waitForFunction(({ name, count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === name);
  }, { name: commandName, count: beforeCount }, { timeout: 10000 });
  const state = await getSummary();
  const logEntry = await getLastCommand(commandName);
  record(`${commandName} status success`, logEntry?.status === "success", logEntry);
  record(`${commandName} state expectation`, Boolean(predicate(state)), state);
}

async function executeCommandAndExpect(commandName, args, predicate) {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.evaluate(({ name, commandArgs }) => window.__motionDebug.executeCommandByName(name, commandArgs), {
    name: commandName,
    commandArgs: args,
  });
  await page.waitForFunction(({ name, count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === name);
  }, { name: commandName, count: beforeCount }, { timeout: 10000 });
  const state = await getSummary();
  const logEntry = await getLastCommand(commandName);
  record(`${commandName} status success`, logEntry?.status === "success", logEntry);
  record(`${commandName} state expectation`, Boolean(predicate(state)), state);
}

async function keyboardRotateSelectedControlAndExpect(controlId) {
  const control = await page.evaluate((id) => (
    window.__motionDebug.getIkControlScreenPositions().find((item) => item.id === id && item.visible)
  ), controlId);
  record("keyboard rotate control visible", Boolean(control), control);
  if (!control) {
    return;
  }
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.mouse.move(control.x + 70, control.y);
  await page.locator("#rigCanvas").focus();
  await page.keyboard.press("r");
  await page.mouse.move(control.x + 114, control.y + 82, { steps: 10 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => (
      entry.name === "set_control_transform"
      && entry.status === "success"
      && entry.args?.transform_mode === "rotate"
    ));
  }, { count: beforeCount }, { timeout: 10000 });
  const state = await getSummary();
  record("R key view-axis rotation commits", state.selected_control === controlId && state.joint_rotation_overrides >= 1, state);
}

async function importSampleGlbAndValidateToeFallback() {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#modelFileInput").setInputFiles(sampleGlbPath);
  await page.waitForFunction((count) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "import_glb");
  }, beforeCount, { timeout: 20000 });

  const importLog = await getLastCommand("import_glb");
  const imported = await getSummary();
  record("sample GLB import succeeds", importLog?.status === "success" && imported.model === "Loaded", {
    importLog,
    imported,
  });
  record("sample GLB has no missing required humanoid mapping", (imported.missing_required_mapping || []).length === 0, imported);

  await clickAndExpect("#createSourceSkeletonButton", "create_source_skeleton_from_import", (state) => (
    state.skeleton === "SourceRig_v1"
    && state.current_stage === "skeleton"
    && (state.missing_required_mapping || []).length === 0
  ));

  await executeCommandAndExpect("set_character_direction", { forward_sign: 1, yaw_degrees: 0, confirmed: true }, (state) => (
    state.direction?.confirmed === true
    && state.current_stage === "skeleton"
  ));

  await clickAndExpect("#createSkeletonButton", "create_humanoid_skeleton", (state) => (
    state.skeleton === "Humanoid_v1"
    && state.joints === 19
    && (state.missing_required_mapping || []).length === 0
    && state.current_stage === "control_rig"
  ));

  const humanoidState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const fallbackJoints = humanoidState.joints
    .filter((joint) => joint.is_optional_fallback)
    .map((joint) => joint.name);
  record("optional unmapped joints become fallback joints", (
    (imported.optional_fallback_mapping || []).length === 0
    || fallbackJoints.length === (imported.optional_fallback_mapping || []).length
  ), {
    imported_optional_fallback_mapping: imported.optional_fallback_mapping,
    fallbackJoints,
  });

  await clickAndExpect("#createIkButton", "create_ik_controls", (state) => (
    state.ik_controls === 14
    && state.joint_controls === 19
    && state.visible_joint_debug_controls === false
    && state.control_ids.includes("COG_CTRL")
    && state.control_ids.includes("Chest_CTRL")
  ));
  const beforeRotateDebug = await page.evaluate(() => window.__motionDebug.getSourceRigDebug());
  await executeCommandAndExpect("rotate_joint_branch", { joint: "Hips", angle: 0.45, axis: [0, 1, 0] }, (state) => (
    state.joint_rotation_overrides >= 1
  ));
  const afterRotateDebug = await page.evaluate(() => window.__motionDebug.getSourceRigDebug());
  const beforeHipsQuat = beforeRotateDebug.mapped?.Hips?.current_world_quaternion || [];
  const afterHipsQuat = afterRotateDebug.mapped?.Hips?.current_world_quaternion || [];
  const hipsQuatDelta = quaternionDelta(beforeHipsQuat, afterHipsQuat);
  record("hip rotation drives imported source rig", hipsQuatDelta > 0.01, {
    beforeHipsQuat,
    afterHipsQuat,
    hipsQuatDelta,
  });
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8 && state.direction?.confirmed === true);
  const importedWalkState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("sample GLB walk keeps hands on their own sides", walkHandsStayOnOwnSides(importedWalkState), {
    keyframes: importedWalkState.keyframes?.length,
  });
}

async function ensureDom(label, fn) {
  const result = await fn();
  record(label, result.pass, result);
}

async function getSummary() {
  return page.evaluate(() => window.__motionDebug.getMotionStateSummary());
}

async function getLastCommand(name) {
  return page.evaluate((commandName) => {
    const log = window.__motionDebug.getCommandLog();
    return [...log].reverse().find((entry) => entry.name === commandName) || null;
  }, name);
}

function record(label, pass, details = null) {
  if (!pass) {
    failures.push({ label, details });
  }
}

function walkHandsStayOnOwnSides(payload) {
  const frames = payload.keyframes || [];
  if (frames.length === 0) {
    return false;
  }
  return frames.every((frame) => {
    const joints = new Map((frame.joints || []).map((joint) => [joint.name, joint.position]));
    const controls = new Map((frame.ik_controls || []).map((control) => [control.id, control.position]));
    const rightShoulder = joints.get("R_UpperArm");
    const leftShoulder = joints.get("L_UpperArm");
    const rightHandTarget = controls.get("R_Hand_IK") || joints.get("R_Hand");
    const leftHandTarget = controls.get("L_Hand_IK") || joints.get("L_Hand");
    if (!rightShoulder || !leftShoulder || !rightHandTarget || !leftHandTarget) {
      return false;
    }
    const center = scaleVec(addPlainVec(rightShoulder, leftShoulder), 0.5);
    const sideAxis = normalizePlainVec(subPlainVec(rightShoulder, leftShoulder));
    return dotPlainVec(subPlainVec(rightHandTarget, center), sideAxis) > 0.02
      && dotPlainVec(subPlainVec(leftHandTarget, center), sideAxis) < -0.02;
  });
}

function addPlainVec(a, b) {
  return [Number(a[0]) + Number(b[0]), Number(a[1]) + Number(b[1]), Number(a[2]) + Number(b[2])];
}

function subPlainVec(a, b) {
  return [Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]), Number(a[2]) - Number(b[2])];
}

function scaleVec(vector, scale) {
  return vector.map((value) => value * scale);
}

function dotPlainVec(a, b) {
  return Number(a[0]) * Number(b[0]) + Number(a[1]) * Number(b[1]) + Number(a[2]) * Number(b[2]);
}

function normalizePlainVec(vector) {
  const length = Math.hypot(Number(vector[0]), Number(vector[1]), Number(vector[2]));
  return length > 0.0001 ? vector.map((value) => Number(value) / length) : [1, 0, 0];
}

function quaternionDelta(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 4 || b.length !== 4) {
    return 0;
  }
  const dot = Math.abs(a.reduce((sum, value, index) => sum + Number(value) * Number(b[index]), 0));
  return 1 - Math.min(1, dot);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "_");
}
