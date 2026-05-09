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
  await clickAndExpect("#createIkButton", "create_ik_controls", (state) => state.ik_controls === 9);
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
  record("export contains ik_controls", coreIkControls.length === 9 && jointControls.length === 19, {
    core: coreIkControls.length,
    joint: jointControls.length,
    count: exportedJson.ik_controls?.length,
  });
  record("export contains direction", typeof exportedJson.direction?.forward_sign === "number", exportedJson.direction);
  record("export contains keyframes", exportedJson.keyframes?.length === 8, { count: exportedJson.keyframes?.length });
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

  await clickAndExpect("#createSkeletonButton", "create_humanoid_skeleton", (state) => (
    state.skeleton === "Humanoid_v1"
    && state.joints === 19
    && (state.missing_required_mapping || []).length === 0
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

  await executeCommandAndExpect("set_character_direction", { forward_sign: 1, yaw_degrees: 0, confirmed: true }, (state) => state.direction?.confirmed === true);
  await clickAndExpect("#createIkButton", "create_ik_controls", (state) => (
    state.ik_controls === 9 && state.joint_controls === 19
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
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8);
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
