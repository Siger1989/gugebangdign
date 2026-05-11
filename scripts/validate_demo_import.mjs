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

  await executeCommandAndExpect("load_test_dummy", {}, (state) => state.model === "Loaded");
  await ensureTimelineToolDisabledState({
    prev: true,
    next: true,
    deleteCurrent: true,
    paste: true,
  });
  await clickAndExpect("#createSkeletonButton", "create_humanoid_skeleton", (state) => (
    state.skeleton === "Humanoid_v1"
    && state.joints === 19
    && state.bones === 18
    && state.current_stage === "skeleton"
    && state.editable_assignment_skeleton === true
    && state.joint_controls === 19
    && state.ik_controls === 0
  ));
  const preIkSkeleton = await page.evaluate(() => window.__motionDebug.getMotionState());
  const headBeforeInitialSave = getJointPosition(preIkSkeleton, "Head");
  const headInitialTarget = [headBeforeInitialSave[0], headBeforeInitialSave[1] + 0.018, headBeforeInitialSave[2]];
  await executeCommandAndExpect("set_joint_position", {
    joint: "Head",
    position: headInitialTarget,
  }, (state) => state.current_stage === "skeleton");
  await executeCommandAndExpect("save_initial_skeleton", {}, (state) => (
    state.initial_skeleton_saved === true
    && state.current_stage === "skeleton"
  ));
  const savedInitialState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const savedInitialRightHand = savedInitialState.skeleton?.initial_rest_joints?.find((joint) => joint.name === "R_Hand")?.position
    || getJointPosition(savedInitialState, "R_Hand");
  record("pre-IK skeleton edits save into initial rest pose", (
    vecDistance(
      savedInitialState.skeleton?.rest_joints?.find((joint) => joint.name === "Head")?.position || [0, 0, 0],
      headInitialTarget,
    ) < 0.001
  ), {
    headInitialTarget,
    savedHead: savedInitialState.skeleton?.rest_joints?.find((joint) => joint.name === "Head")?.position,
  });
  await validatePreIkSkeletonViewportSelection();
  await validateMapAxisViewSwitching();
  await clickAndExpect("#toolbarCreateIkButton", "set_stage", (state) => state.current_stage === "control_rig");
  await clickAndExpect("#createIkButton", "create_ik_controls", (state) => (
    state.ik_controls === 14
    && state.visible_joint_debug_controls === true
    && state.control_ids.includes("COG_CTRL")
    && state.control_ids.includes("Pelvis_CTRL")
    && state.control_ids.includes("Chest_CTRL")
  ));
  const afterInitialIkState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("creating IK/FK preserves the saved custom initial skeleton", (
    vecDistance(
      afterInitialIkState.skeleton?.rest_joints?.find((joint) => joint.name === "Head")?.position || [0, 0, 0],
      headInitialTarget,
    ) < 0.001
    && vecDistance(getJointPosition(afterInitialIkState, "Head"), headInitialTarget) < 0.001
  ), {
    headInitialTarget,
    restHead: afterInitialIkState.skeleton?.rest_joints?.find((joint) => joint.name === "Head")?.position,
    currentHead: getJointPosition(afterInitialIkState, "Head"),
    currentRightHand: getJointPosition(afterInitialIkState, "R_Hand"),
    savedInitialRightHand,
  });
  record("creating IK/FK ignores unsaved post-save skeleton draft edits", (
    vecDistance(getJointPosition(afterInitialIkState, "R_Hand"), savedInitialRightHand) < 0.001
  ), {
    savedInitialRightHand,
    currentRightHand: getJointPosition(afterInitialIkState, "R_Hand"),
  });
  await clickAndExpect("#toolbarCreateIkButton", "set_stage", (state) => state.current_stage === "control_rig");
  const ikPanelCreateButtonVisible = await page.locator("#createIkButton").isVisible();
  record("motion stage toolbar opens IK/FK page without regenerating controls", ikPanelCreateButtonVisible, { ikPanelCreateButtonVisible });
  await clickAndExpect("#toolbarMotionButton", "set_stage", (state) => state.current_stage === "motion");
  await validateFkJointControlRotation();
  await validateZBrushTransformGizmoModes();
  await validateControlMultiSelectAndTimelineExpansion();
  const beforePelvisDrop = await page.evaluate(() => window.__motionDebug.getMotionState());
  const pelvisDropControl = beforePelvisDrop.ik_controls.find((control) => control.id === "Pelvis_CTRL");
  await executeCommandAndExpect("set_control_transform", {
    control_id: "Pelvis_CTRL",
    transform_mode: "translate",
    space: "global",
    position: [pelvisDropControl.position[0], pelvisDropControl.position[1] - 0.08, pelvisDropControl.position[2]],
  }, (state) => state.selected_control === "Pelvis_CTRL");
  const afterPelvisDrop = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("pelvis translate lowers hips while feet stay planted", (
    getJointY(beforePelvisDrop, "Hips") - getJointY(afterPelvisDrop, "Hips") > 0.04
    && jointPositionDelta(beforePelvisDrop, afterPelvisDrop, "R_Foot") < 0.01
    && jointPositionDelta(beforePelvisDrop, afterPelvisDrop, "L_Foot") < 0.01
  ), {
    hipsDeltaY: getJointY(afterPelvisDrop, "Hips") - getJointY(beforePelvisDrop, "Hips"),
    rightFootDelta: jointPositionDelta(beforePelvisDrop, afterPelvisDrop, "R_Foot"),
    leftFootDelta: jointPositionDelta(beforePelvisDrop, afterPelvisDrop, "L_Foot"),
  });
  const pelvisEndpointDeltas = getEndpointControlDeltas(afterPelvisDrop);
  record("IK end controls stay attached after pelvis move", (
    Math.max(...Object.values(pelvisEndpointDeltas)) < 0.001
  ), pelvisEndpointDeltas);
  await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);
  const beforeFootGroundClamp = await page.evaluate(() => window.__motionDebug.getMotionState());
  const rightFootIk = beforeFootGroundClamp.ik_controls.find((control) => control.id === "R_Foot_IK");
  await executeCommandAndExpect("set_control_transform", {
    control_id: "R_Foot_IK",
    transform_mode: "translate",
    space: "global",
    position: [rightFootIk.position[0], -1, rightFootIk.position[2]],
  }, (state) => state.selected_control === "R_Foot_IK");
  const afterFootGroundClamp = await page.evaluate(() => window.__motionDebug.getMotionState());
  const clampedRightFootControl = afterFootGroundClamp.ik_controls.find((control) => control.id === "R_Foot_IK");
  record("foot IK target clamps above ground", (
    clampedRightFootControl.position[1] >= -0.001
    && getJointY(afterFootGroundClamp, "R_Foot") >= -0.001
    && controlJointDistance(afterFootGroundClamp, "R_Foot_IK") < 0.001
  ), {
    controlY: clampedRightFootControl.position[1],
    footY: getJointY(afterFootGroundClamp, "R_Foot"),
    controlFootDelta: controlJointDistance(afterFootGroundClamp, "R_Foot_IK"),
  });
  await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);
  const beforeFootReachClamp = await page.evaluate(() => window.__motionDebug.getMotionState());
  const rightFootReachIk = beforeFootReachClamp.ik_controls.find((control) => control.id === "R_Foot_IK");
  const unreachableFootTarget = [rightFootReachIk.position[0] + 5, rightFootReachIk.position[1], rightFootReachIk.position[2]];
  await executeCommandAndExpect("set_control_transform", {
    control_id: "R_Foot_IK",
    transform_mode: "translate",
    space: "global",
    position: unreachableFootTarget,
  }, (state) => state.selected_control === "R_Foot_IK");
  const afterFootReachClamp = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("unreachable foot IK target clamps back to solved foot instead of leaving a long control line", (
    controlJointDistance(afterFootReachClamp, "R_Foot_IK") < 0.001
    && vecDistance(unreachableFootTarget, getControlPosition(afterFootReachClamp, "R_Foot_IK")) > 1
  ), {
    requested: unreachableFootTarget,
    control: getControlPosition(afterFootReachClamp, "R_Foot_IK"),
    foot: getJointPosition(afterFootReachClamp, "R_Foot"),
    controlFootDelta: controlJointDistance(afterFootReachClamp, "R_Foot_IK"),
  });
  await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);
  await executeCommandAndExpect("select_control", { control: "COG_CTRL" }, (state) => state.selected_control === "COG_CTRL");
  await keyboardRotateSelectedControlAndExpect("COG_CTRL");
  await executeCommandAndExpect("select_control", { control: "Head_CTRL" }, (state) => state.selected_control === "Head_CTRL");
  await keyboardRotateSelectedControlAndExpect("Head_CTRL", "#viewportModelOpacityInput");
  await keyboardRotateSelectedControlAndExpect("Head_CTRL", "#timelineFrameSlider");
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
  const beforePelvisControl = await page.evaluate(() => window.__motionDebug.getMotionState());
  await executeCommandAndExpect("set_control_transform", {
    control_id: "Pelvis_CTRL",
    transform_mode: "rotate",
    space: "global",
    rotation: [0, 0.32, 0],
  }, (state) => state.selected_control === "Pelvis_CTRL");
  const afterPelvisControl = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("pelvis control affects lower body without dragging upper body", (
    jointPositionDelta(beforePelvisControl, afterPelvisControl, "R_Foot") > 0.015
    && jointPositionDelta(beforePelvisControl, afterPelvisControl, "Head") < 0.005
  ), {
    footDelta: jointPositionDelta(beforePelvisControl, afterPelvisControl, "R_Foot"),
    headDelta: jointPositionDelta(beforePelvisControl, afterPelvisControl, "Head"),
  });
  const beforeChestControl = await page.evaluate(() => window.__motionDebug.getMotionState());
  await executeCommandAndExpect("set_control_transform", {
    control_id: "Chest_CTRL",
    transform_mode: "rotate",
    space: "global",
    rotation: [0, 0.28, 0],
  }, (state) => state.selected_control === "Chest_CTRL");
  const afterChestControl = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("chest waist control affects upper body without dragging feet", (
    jointPositionDelta(beforeChestControl, afterChestControl, "Head") > 0.015
    && jointPositionDelta(beforeChestControl, afterChestControl, "R_Foot") < 0.005
  ), {
    headDelta: jointPositionDelta(beforeChestControl, afterChestControl, "Head"),
    footDelta: jointPositionDelta(beforeChestControl, afterChestControl, "R_Foot"),
  });
  await validateWalkArmSolveModesMatchBasic();
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8);
  const afterFirstTemplateState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("loading an action template keeps the saved initial skeleton as rest pose", (
    vecDistance(
      afterFirstTemplateState.skeleton?.rest_joints?.find((joint) => joint.name === "Head")?.position || [0, 0, 0],
      headInitialTarget,
    ) < 0.001
  ), {
    headInitialTarget,
    restHead: afterFirstTemplateState.skeleton?.rest_joints?.find((joint) => joint.name === "Head")?.position,
  });
  await validateTimelineLoopSpeedAndRangeDrag();
  await validateMotionTemplateLibrary();
  await validateMotionBrainPipeline();
  await page.locator("#motionTemplateSelect").selectOption("walk_cycle_8f");
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8);
  await validateCurrentFrameCopyPasteAndMirror();
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8);
  await ensureTimelineToolDisabledState({
    prev: false,
    next: false,
    deleteCurrent: false,
  });

  await ensureDom("timeline keyframes", async () => {
    const count = await page.locator(".key-pose.has-keyframe").count();
    return { pass: count === 8, count };
  });
  await ensureDom("timeline transport does not overflow horizontally", async () => page.locator(".timeline-transport").evaluate((node) => ({
    pass: node.scrollWidth <= node.clientWidth + 1,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    height: node.clientHeight,
  })));
  await setTimelineFrameInputAndExpect(37);
  await setTimelineFpsInputAndExpect(12);
  await executeCommandAndExpect("set_current_frame", { frame: 11 }, (state) => state.current_frame === 11);
  await clickAndExpect("#timelinePrevKeyButton", "go_to_previous_keyframe", (state) => state.current_frame === 10);
  await clickAndExpect("#timelineNextKeyButton", "go_to_next_keyframe", (state) => state.current_frame === 13);
  await clickAndExpect("#timelineDeleteFrameButton", "delete_current_keyframe", (state) => state.keyframes === 7);
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8);
  await executeCommandAndExpect("set_current_frame", { frame: 14 }, (state) => state.current_frame === 14);
  await pressKeyAndExpect("PageUp", "go_to_previous_keyframe", (state) => state.current_frame === 13);
  await pressKeyAndExpect("PageDown", "go_to_next_keyframe", (state) => state.current_frame === 16);
  await pressKeyAndExpect("Delete", "delete_current_keyframe", (state) => state.keyframes === 7);
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8);
  await executeCommandAndExpect("export_motion_json", {}, (state) => state.validation === "Passed");
  const autoValidatedExport = JSON.parse(await page.evaluate(() => window.__motionDebug.getExportedJson()));
  record("export auto-validates motion when report is stale", (
    autoValidatedExport.export_meta?.auto_validated === true
    && autoValidatedExport.validation_report?.status === "Passed"
  ), {
    export_meta: autoValidatedExport.export_meta,
    validation_report: autoValidatedExport.validation_report,
  });

  const beforePlay = await getSummary();
  await clickAndExpect("#playButton", "play", () => true);
  await page.waitForTimeout(1200);
  const afterPlay = await getSummary();
  record("playback advances frame", afterPlay.current_frame !== beforePlay.current_frame, { beforePlay, afterPlay });
  record("playback stays in motion stage", afterPlay.current_stage === "motion", { beforePlay, afterPlay });

  await clickAndExpect("#validateMotionButton", "validate_motion", (state) => state.validation === "Passed");
  const afterValidateSummary = await getSummary();
  record("validate updates report without leaving motion stage", afterValidateSummary.current_stage === "motion", afterValidateSummary);
  const validation = await page.evaluate(() => window.__motionDebug.getValidationReport());
  record("validation report has required checks", Boolean(
    validation?.checks?.foot_sliding
    && validation?.checks?.knee_flip
    && validation?.checks?.loop_discontinuity
    && validation?.checks?.bone_identity_error
  ), validation);

  await clickAndExpect("#toolbarExportButton", "export_motion_json", () => true);
  const exported = await page.evaluate(() => window.__motionDebug.getExportedJson());
  const exportedJson = JSON.parse(exported);
  record("export contains skeleton", exportedJson.skeleton?.id === "Humanoid_v1", exportedJson.skeleton);
  record("export contains editable playback fps", exportedJson.playback_fps === 12, {
    playback_fps: exportedJson.playback_fps,
  });
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
  record("walk template keyframes COG and neutral torso controls", Boolean(
    keyedControls.get("COG_CTRL")
    && keyedControls.get("Pelvis_CTRL")
    && controlRotationIsNeutral(keyedControls.get("Pelvis_CTRL"))
    && controlRotationIsNeutral(keyedControls.get("Chest_CTRL"))
  ), {
    cog: keyedControls.get("COG_CTRL"),
    pelvis: keyedControls.get("Pelvis_CTRL"),
    chest: keyedControls.get("Chest_CTRL"),
  });
  record("walk template keeps hands on their own sides", walkHandsStayOnOwnSides(exportedJson), {
    firstFrameHands: {
      right: keyedControls.get("R_Hand_IK")?.position,
      left: keyedControls.get("L_Hand_IK")?.position,
    },
  });
  record("walk template keeps arm chains outside torso", walkArmChainsStayOnOwnSides(exportedJson), {
    firstFrameJoints: {
      rightForearm: firstWalkFrame.joints?.find((joint) => joint.name === "R_Forearm")?.position,
      rightHand: firstWalkFrame.joints?.find((joint) => joint.name === "R_Hand")?.position,
      leftForearm: firstWalkFrame.joints?.find((joint) => joint.name === "L_Forearm")?.position,
      leftHand: firstWalkFrame.joints?.find((joint) => joint.name === "L_Hand")?.position,
    },
  });
  record("walk template does not auto-twist wrist bones", walkTemplateDoesNotWriteWristRotations(exportedJson), {
    wristRotationFrames: getWristRotationFrames(exportedJson),
  });
  record("walk template keeps elbow poles outside the body", walkElbowPolesStayOutside(exportedJson), {
    badElbowPoleFrames: getBadElbowPoleFrames(exportedJson),
  });
  record("walk template avoids forward elbow fold", walkElbowsAvoidForwardFold(exportedJson), {
    badForwardElbowFrames: getForwardBentElbowFrames(exportedJson),
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
    "set_control_transforms",
    "set_control_visual_size",
    "set_control_visual_thickness",
    "apply_motion_template",
    "delete_current_keyframe",
    "play",
    "validate_motion",
    "export_motion_json",
    "go_to_previous_keyframe",
    "go_to_next_keyframe",
    "undo",
    "redo",
  ].forEach((name) => {
    const entry = commandLog.find((item) => item.name === name && item.status === "success");
    record(`command_log records ${name}`, Boolean(entry), entry || null);
  });

  await importSampleGlbAndValidateToeFallback();
  await validateIncompleteMappingAssignmentSkeleton();

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

async function pressKeyAndExpect(key, commandName, predicate) {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#rigCanvas").focus();
  await page.keyboard.press(key);
  await page.waitForFunction(({ name, count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === name);
  }, { name: commandName, count: beforeCount }, { timeout: 10000 });
  const state = await getSummary();
  const logEntry = await getLastCommand(commandName);
  record(`${key} triggers ${commandName}`, logEntry?.status === "success", logEntry);
  record(`${key} ${commandName} state expectation`, Boolean(predicate(state)), state);
}

async function validatePreIkSkeletonViewportSelection() {
  await executeCommandAndExpect("select_control", { control: "L_Hand_CTRL" }, (state) => (
    state.current_stage === "skeleton"
    && state.selected_control === "L_Hand_CTRL"
  ));
  const canvasBox = await page.locator("#rigCanvas").boundingBox();
  const beforeBlankCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.mouse.click(canvasBox.x + 28, canvasBox.y + 72);
  await page.waitForFunction((count) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "clear_selection");
  }, beforeBlankCount, { timeout: 10000 });
  const cleared = await getSummary();
  record("pre-IK skeleton blank viewport click clears selection", (
    cleared.current_stage === "skeleton"
    && cleared.selected_control === null
    && cleared.selected_bone === null
  ), cleared);

  const target = await page.evaluate(() => (
    window.__motionDebug.getIkControlScreenPositions().find((item) => item.id === "R_Hand_CTRL" && item.visible)
  ));
  record("pre-IK skeleton hand edit control is visible for picking", Boolean(target), target);
  if (!target) {
    return;
  }
  const beforeDrag = await page.evaluate(() => window.__motionDebug.getMotionState());
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 34, target.y + 8, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction((count) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "set_control_transform");
  }, beforeCount, { timeout: 10000 });
  const afterDrag = await page.evaluate(() => window.__motionDebug.getMotionState());
  const beforeControl = beforeDrag.ik_controls.find((control) => control.id === "R_Hand_CTRL");
  const afterControl = afterDrag.ik_controls.find((control) => control.id === "R_Hand_CTRL");
  const beforeInitialRightHand = beforeDrag.skeleton?.initial_rest_joints?.find((joint) => joint.name === "R_Hand")?.position;
  const afterInitialRightHand = afterDrag.skeleton?.initial_rest_joints?.find((joint) => joint.name === "R_Hand")?.position;
  record("pre-IK skeleton control drag keeps the picked controller selected", (
    afterDrag.selected_control === "R_Hand_CTRL"
    && afterDrag.selected_bone === "R_Hand"
    && vecDistance(beforeControl?.position || [0, 0, 0], afterControl?.position || [0, 0, 0]) > 0.001
  ), {
    selected_control: afterDrag.selected_control,
    selected_bone: afterDrag.selected_bone,
    before: beforeControl?.position,
    after: afterControl?.position,
  });
  record("pre-IK post-save draft edit does not overwrite saved initial skeleton", (
    beforeInitialRightHand
    && afterInitialRightHand
    && vecDistance(beforeInitialRightHand, afterInitialRightHand) < 0.001
    && afterDrag.skeleton?.initial_skeleton_dirty === true
  ), {
    beforeInitialRightHand,
    afterInitialRightHand,
    draftRightHand: afterDrag.skeleton?.rest_joints?.find((joint) => joint.name === "R_Hand")?.position,
    dirty: afterDrag.skeleton?.initial_skeleton_dirty,
  });
}

async function validateMapAxisViewSwitching() {
  await page.locator('[data-tool="select"]').click();
  const beforeButtonCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator('.axis-button[data-axis="z"]').click();
  await page.waitForFunction((count) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "set_view_axis");
  }, beforeButtonCount, { timeout: 10000 });
  const zCamera = await page.evaluate(() => window.__motionDebug.getCameraState());
  record("toolbar Z switches the viewport to map Z view", (
    Math.abs(zCamera.yaw) < 0.001
    && Math.abs(zCamera.pitch) < 0.001
  ), zCamera);

  const beforeKeyCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#rigCanvas").focus();
  await page.keyboard.press("x");
  await page.waitForFunction((count) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "set_view_axis");
  }, beforeKeyCount, { timeout: 10000 });
  const xCamera = await page.evaluate(() => window.__motionDebug.getCameraState());
  record("keyboard X switches the viewport to map X view", (
    Math.abs(xCamera.yaw - Math.PI / 2) < 0.001
    && Math.abs(xCamera.pitch) < 0.001
  ), xCamera);
}

async function setTimelineFrameInputAndExpect(frame) {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#timelineFrameNumberInput").fill(String(frame));
  await page.locator("#timelineFrameNumberInput").evaluate((input) => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  });
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "set_current_frame");
  }, { count: beforeCount }, { timeout: 10000 });
  const state = await getSummary();
  const uiValue = await page.locator("#timelineFrameNumberInput").inputValue();
  record("timeline numeric frame input jumps to exact frame", (
    state.current_frame === frame
    && state.total_frames >= frame
    && uiValue === String(frame)
  ), { frame, state, uiValue });
}

async function setTimelineFpsInputAndExpect(fps) {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#timelineFpsInput").fill(String(fps));
  await page.locator("#timelineFpsInput").evaluate((input) => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  });
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "set_playback_fps");
  }, { count: beforeCount }, { timeout: 10000 });
  const state = await getSummary();
  const uiValue = await page.locator("#timelineFpsInput").inputValue();
  record("timeline fps input updates playback fps", (
    state.playback_fps === fps
    && uiValue === String(fps)
  ), { fps, state, uiValue });
}

async function keyboardRotateSelectedControlAndExpect(controlId, focusSelector = "#rigCanvas") {
  const control = await page.evaluate((id) => (
    window.__motionDebug.getIkControlScreenPositions().find((item) => item.id === id && item.visible)
  ), controlId);
  record("keyboard rotate control visible", Boolean(control), control);
  if (!control) {
    return;
  }
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.mouse.move(control.x + 70, control.y);
  await page.locator(focusSelector).focus();
  const beforeRotateState = await page.evaluate(() => window.__motionDebug.getMotionState());
  await page.keyboard.press("r");
  await page.mouse.move(control.x + 114, control.y + 82, { steps: 1 });
  const afterFirstMoveState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("R view first pointer move does not snap to cursor direction", (
    distancePlainVec(getControlRotation(beforeRotateState, controlId), getControlRotation(afterFirstMoveState, controlId)) < 0.001
  ), {
    before: getControlRotation(beforeRotateState, controlId),
    after: getControlRotation(afterFirstMoveState, controlId),
  });
  await page.mouse.move(control.x + 148, control.y + 96, { steps: 10 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => (
      (entry.name === "set_control_transform" || entry.name === "set_control_transforms")
      && entry.status === "success"
      && entry.args?.transform_mode === "rotate"
    ));
  }, { count: beforeCount }, { timeout: 10000 });
  const state = await getSummary();
  record("R key view-axis rotation commits", state.selected_control === controlId && state.joint_rotation_overrides >= 1, state);
  const rotateValueBox = await page.locator(".transform-value-box.is-visible .transform-value-input").count();
  record("R view numeric input persists after rotation commit", rotateValueBox === 1, { valueBox: rotateValueBox });
}

async function validateControlMultiSelectAndTimelineExpansion() {
  const before = await page.evaluate(() => window.__motionDebug.getMotionState());
  const rightHand = before.ik_controls.find((control) => control.id === "R_Hand_IK");
  const leftHand = before.ik_controls.find((control) => control.id === "L_Hand_IK");
  record("multi-select test controls exist", Boolean(rightHand && leftHand), {
    rightHand: rightHand?.position,
    leftHand: leftHand?.position,
  });
  if (!rightHand || !leftHand) {
    return;
  }

  await executeCommandAndExpect("select_control", { control: "R_Hand_IK" }, (state) => (
    state.selected_control === "R_Hand_IK"
    && state.selected_control_count === 1
  ));
  await executeCommandAndExpect("select_control", { control: "L_Hand_IK", additive: true }, (state) => (
    state.selected_control === "L_Hand_IK"
    && state.selected_control_count === 2
    && state.selected_controls.includes("R_Hand_IK")
    && state.selected_controls.includes("L_Hand_IK")
  ));
  await executeCommandAndExpect("select_control", { control: "R_Hand_IK", remove: true }, (state) => (
    state.selected_control === "L_Hand_IK"
    && state.selected_control_count === 1
    && !state.selected_controls.includes("R_Hand_IK")
  ));
  await executeCommandAndExpect("select_control", { control: "R_Hand_IK", additive: true }, (state) => (
    state.selected_control_count === 2
    && state.selected_controls.includes("R_Hand_IK")
    && state.selected_controls.includes("L_Hand_IK")
  ));
  await executeCommandAndExpect("set_control_transforms", {
    transform_mode: "translate",
    space: "global",
    transforms: [
      { control_id: "R_Hand_IK", position: [rightHand.position[0], rightHand.position[1] + 0.02, rightHand.position[2]] },
      { control_id: "L_Hand_IK", position: [leftHand.position[0], leftHand.position[1] + 0.02, leftHand.position[2]] },
    ],
  }, (state) => (
    state.selected_control_count === 2
    && state.selected_controls.includes("R_Hand_IK")
    && state.selected_controls.includes("L_Hand_IK")
  ));
  const moved = await page.evaluate(() => window.__motionDebug.getMotionState());
  const rightDelta = getControlPosition(moved, "R_Hand_IK").map((value, index) => value - rightHand.position[index]);
  const leftDelta = getControlPosition(moved, "L_Hand_IK").map((value, index) => value - leftHand.position[index]);
  record("multi-selected controls move as a group", (
    rightDelta[1] > 0.015
    && leftDelta[1] > 0.015
    && distancePlainVec(rightDelta, leftDelta) < 0.01
    && controlJointDistance(moved, "R_Hand_IK") < 0.001
    && controlJointDistance(moved, "L_Hand_IK") < 0.001
  ), {
    right: getControlPosition(moved, "R_Hand_IK"),
    left: getControlPosition(moved, "L_Hand_IK"),
    rightDelta,
    leftDelta,
    rightAttachDelta: controlJointDistance(moved, "R_Hand_IK"),
    leftAttachDelta: controlJointDistance(moved, "L_Hand_IK"),
  });
  const beforeHandRotate = await page.evaluate(() => window.__motionDebug.getMotionState());
  await executeCommandAndExpect("set_control_transforms", {
    transform_mode: "rotate",
    space: "global",
    transforms: [
      { control_id: "R_Hand_IK", rotation: [0, 0, 0.35] },
    ],
  }, (state) => state.selected_control === "R_Hand_IK" && state.joint_rotation_overrides >= 1);
  const afterHandRotate = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("hand view rotation keeps wrist and target position stable", (
    distancePlainVec(getControlPosition(beforeHandRotate, "R_Hand_IK"), getControlPosition(afterHandRotate, "R_Hand_IK")) < 0.001
    && jointPositionDelta(beforeHandRotate, afterHandRotate, "R_Hand") < 0.001
  ), {
    controlDelta: distancePlainVec(getControlPosition(beforeHandRotate, "R_Hand_IK"), getControlPosition(afterHandRotate, "R_Hand_IK")),
    wristDelta: jointPositionDelta(beforeHandRotate, afterHandRotate, "R_Hand"),
  });

  await executeCommandAndExpect("select_control", { control: "COG_CTRL" }, (state) => state.selected_control === "COG_CTRL");
  const cogScreen = await page.evaluate(() => (
    window.__motionDebug.getIkControlScreenPositions().find((item) => item.id === "COG_CTRL" && item.visible)
  ));
  record("numeric transform control visible", Boolean(cogScreen), cogScreen);
  if (cogScreen) {
    const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
    await page.mouse.move(cogScreen.x + 64, cogScreen.y + 18);
    await page.locator("#rigCanvas").focus();
    await page.keyboard.press("g");
    await page.mouse.move(cogScreen.x + 100, cogScreen.y + 42, { steps: 4 });
    const freeMoveValueBox = await page.locator(".transform-value-box.is-visible .transform-value-input").count();
    record("free G transform does not show scalar numeric input", freeMoveValueBox === 0, {
      valueBox: freeMoveValueBox,
    });
    await page.keyboard.press("x");
    await page.mouse.move(cogScreen.x + 142, cogScreen.y + 18, { steps: 8 });
    const input = page.locator(".transform-value-box.is-visible .transform-value-input");
    await input.waitFor({ timeout: 5000 });
    await input.fill("0.025");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForFunction(({ count }) => {
      const log = window.__motionDebug?.getCommandLog?.() || [];
      return log.slice(count).some((entry) => (
        entry.name === "set_control_transforms"
        && entry.status === "success"
        && entry.args?.transform_mode === "translate"
      ));
    }, { count: beforeCount }, { timeout: 10000 });
    const valueBox = await page.locator(".transform-value-box.is-visible .transform-value-input").count();
    record("G axis numeric input persists and commits", valueBox === 1, {
      valueBox,
      state: await getSummary(),
    });
    const openValueBoxState = await page.evaluate(() => window.__motionDebug.getTransformValueBoxState());
    record("transform numeric debug state reports visible G value", (
      openValueBoxState.visible === true
      && openValueBoxState.mode === "translate"
      && openValueBoxState.label === "G X"
      && Math.abs(Number(openValueBoxState.input_value) - 0.025) < 0.001
      && openValueBoxState.control_ids.includes("COG_CTRL")
    ), openValueBoxState);
    record("transform numeric box defaults farther from control", (
      openValueBoxState.offset?.x >= 70
      && openValueBoxState.offset?.y >= 28
    ), openValueBoxState);
    const valueBoxLabel = await page.locator(".transform-value-box.is-visible .transform-value-label").boundingBox();
    if (valueBoxLabel) {
      await page.mouse.move(valueBoxLabel.x + valueBoxLabel.width / 2, valueBoxLabel.y + valueBoxLabel.height / 2);
      await page.mouse.down();
      await page.mouse.move(valueBoxLabel.x + valueBoxLabel.width / 2 + 38, valueBoxLabel.y + valueBoxLabel.height / 2 + 22, { steps: 5 });
      await page.mouse.up();
      const draggedValueBoxState = await page.evaluate(() => window.__motionDebug.getTransformValueBoxState());
      record("transform numeric box drag stores future offset", (
        draggedValueBoxState.visible === true
        && draggedValueBoxState.offset?.x > openValueBoxState.offset.x + 20
        && draggedValueBoxState.offset?.y > openValueBoxState.offset.y + 10
      ), {
        before: openValueBoxState,
        after: draggedValueBoxState,
      });
    }
    const selectionBeforeClose = await getSummary();
    await page.locator(".transform-value-box.is-visible .transform-value-close").click();
    const closedValueBox = await page.locator(".transform-value-box.is-visible .transform-value-input").count();
    const selectionAfterClose = await getSummary();
    const closedValueBoxState = await page.evaluate(() => window.__motionDebug.getTransformValueBoxState());
    record("transform numeric close hides box without changing selection", (
      closedValueBox === 0
      && closedValueBoxState.visible === false
      && selectionBeforeClose.selected_control === selectionAfterClose.selected_control
      && selectionBeforeClose.selected_control_count === selectionAfterClose.selected_control_count
    ), {
      closedValueBox,
      closedValueBoxState,
      before: selectionBeforeClose.selected_control,
      after: selectionAfterClose.selected_control,
      beforeCount: selectionBeforeClose.selected_control_count,
      afterCount: selectionAfterClose.selected_control_count,
    });

    const beforeRotateState = await page.evaluate(() => window.__motionDebug.getMotionState());
    const beforeRotateCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
    await page.locator("#rigCanvas").focus();
    await page.keyboard.press("r");
    await page.mouse.move(cogScreen.x + 116, cogScreen.y + 74, { steps: 8 });
    const rotateInput = page.locator(".transform-value-box.is-visible .transform-value-input");
    await rotateInput.waitFor({ timeout: 5000 });
    await rotateInput.fill("15");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForFunction(({ count }) => {
      const log = window.__motionDebug?.getCommandLog?.() || [];
      return log.slice(count).some((entry) => (
        entry.name === "set_control_transforms"
        && entry.status === "success"
        && entry.args?.transform_mode === "rotate"
      ));
    }, { count: beforeRotateCount }, { timeout: 10000 });
    const afterRotateState = await page.evaluate(() => window.__motionDebug.getMotionState());
    const rotateBox = await page.locator(".transform-value-box.is-visible .transform-value-input").inputValue();
    record("R numeric input commits exact rotate value and persists", (
      Math.abs(Number(rotateBox) - 15) < 0.001
      && distancePlainVec(getControlRotation(beforeRotateState, "COG_CTRL"), getControlRotation(afterRotateState, "COG_CTRL")) > 0.01
    ), {
      rotateBox,
      before: getControlRotation(beforeRotateState, "COG_CTRL"),
      after: getControlRotation(afterRotateState, "COG_CTRL"),
    });
    await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);

    await executeCommandAndExpect("select_control", { control: "Global_CTRL" }, (state) => state.selected_control === "Global_CTRL");
    const globalScreen = await page.evaluate(() => (
      window.__motionDebug.getIkControlScreenPositions().find((item) => item.id === "Global_CTRL" && item.visible)
    ));
    record("scale numeric control visible", Boolean(globalScreen), globalScreen);
    if (globalScreen) {
      const beforeScaleState = await page.evaluate(() => window.__motionDebug.getMotionState());
      const beforeScaleCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
      await page.mouse.move(globalScreen.x + 56, globalScreen.y + 18);
      await page.locator("#rigCanvas").focus();
      await page.keyboard.press("s");
      await page.mouse.move(globalScreen.x + 104, globalScreen.y + 18, { steps: 8 });
      const scaleInput = page.locator(".transform-value-box.is-visible .transform-value-input");
      await scaleInput.waitFor({ timeout: 5000 });
      await scaleInput.fill("1.25");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.waitForFunction(({ count }) => {
        const log = window.__motionDebug?.getCommandLog?.() || [];
        return log.slice(count).some((entry) => (
          entry.name === "set_control_transforms"
          && entry.status === "success"
          && entry.args?.transform_mode === "scale"
        ));
      }, { count: beforeScaleCount }, { timeout: 10000 });
      const afterScaleState = await page.evaluate(() => window.__motionDebug.getMotionState());
      const expectedScale = getControlScale(beforeScaleState, "Global_CTRL").map((item) => item * 1.25);
      const actualScale = getControlScale(afterScaleState, "Global_CTRL");
      const scaleBox = await page.locator(".transform-value-box.is-visible .transform-value-input").inputValue();
      record("S numeric input commits exact scale factor and persists", (
        Math.abs(Number(scaleBox) - 1.25) < 0.001
        && vecDistance(expectedScale, actualScale) < 0.002
      ), {
        scaleBox,
        expectedScale,
        actualScale,
      });
      await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);
    }
  }

  await executeCommandAndExpect("set_current_frame", { frame: 80 }, (state) => (
    state.current_frame === 80 && state.total_frames >= 80
  ));
  const timelineUi = await page.evaluate(() => ({
    sliderMin: Number(document.querySelector("#timelineFrameSlider")?.min || 0),
    sliderMax: Number(document.querySelector("#timelineFrameSlider")?.max || 0),
    ticks: document.querySelectorAll("#timelineFrameTicks .frame-tick").length,
    currentTick: document.querySelector("#timelineFrameTicks .frame-tick.is-current")?.dataset?.frame || null,
  }));
  record("timeline expands beyond 24 frames", (
    timelineUi.sliderMax >= 80
    && timelineUi.ticks >= 8
    && timelineUi.currentTick === "80"
  ), timelineUi);
  const timelineViewBeforeWheel = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  await dispatchTimelineWheel(-120, false);
  const timelineViewAfterZoom = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  await dispatchTimelineWheel(120, true);
  const timelineViewAfterPan = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  record("timeline debug state tracks wheel zoom and pan", (
    timelineViewBeforeWheel.current_visible
    && timelineViewAfterZoom.current_visible
    && timelineViewAfterPan.current_visible
    && timelineViewAfterZoom.frames < timelineViewBeforeWheel.frames
    && timelineViewAfterZoom.rendered_ticks === timelineViewAfterZoom.frames
    && timelineViewAfterPan.start > timelineViewAfterZoom.start
    && timelineViewAfterPan.slider_min === timelineViewAfterPan.start
    && timelineViewAfterPan.slider_max === timelineViewAfterPan.end
  ), {
    before: timelineViewBeforeWheel,
    afterZoom: timelineViewAfterZoom,
    afterPan: timelineViewAfterPan,
  });
  const beforeResetCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#timelineResetViewButton").click();
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "reset_timeline_view" && entry.status === "success");
  }, { count: beforeResetCount }, { timeout: 10000 });
  const timelineViewAfterReset = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  record("timeline reset view button restores a 24-frame visible window", (
    timelineViewAfterReset.reset_button_available
    && timelineViewAfterReset.frames === 24
    && timelineViewAfterReset.current_visible
    && timelineViewAfterReset.pinned === false
    && timelineViewAfterReset.pinned_badge_visible === false
    && timelineViewAfterReset.displayed_range === `${timelineViewAfterReset.start}-${timelineViewAfterReset.end}`
    && timelineViewAfterReset.slider_min === timelineViewAfterReset.start
    && timelineViewAfterReset.slider_max === timelineViewAfterReset.end
  ), timelineViewAfterReset);
  await activateTimelineViewButtonAndWait("#timelineZoomInButton", "zoom_timeline_view", "Enter");
  const timelineViewAfterButtonZoom = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  await activateTimelineViewButtonAndWait("#timelinePanRightButton", "pan_timeline_view", "Enter");
  const timelineViewAfterButtonPan = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  await activateTimelineViewButtonAndWait("#timelineZoomOutButton", "zoom_timeline_view", "Space");
  const timelineViewAfterButtonZoomOut = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  record("timeline buttons support keyboard-accessible zoom and pan", (
    timelineViewAfterButtonZoom.frames < timelineViewAfterReset.frames
    && timelineViewAfterButtonZoom.pinned
    && timelineViewAfterButtonZoom.pinned_badge_visible
    && timelineViewAfterButtonZoom.pinned_badge_text === "视图已固定"
    && timelineViewAfterButtonZoom.zoom_out_available
    && timelineViewAfterButtonPan.start > timelineViewAfterButtonZoom.start
    && timelineViewAfterButtonPan.pinned
    && timelineViewAfterButtonPan.pinned_badge_visible
    && timelineViewAfterButtonPan.current_visible
    && timelineViewAfterButtonZoomOut.frames > timelineViewAfterButtonPan.frames
    && timelineViewAfterButtonZoomOut.pinned
    && timelineViewAfterButtonZoomOut.pinned_badge_visible
    && timelineViewAfterButtonZoomOut.displayed_range === `${timelineViewAfterButtonZoomOut.start}-${timelineViewAfterButtonZoomOut.end}`
  ), {
    afterReset: timelineViewAfterReset,
    afterButtonZoom: timelineViewAfterButtonZoom,
    afterButtonPan: timelineViewAfterButtonPan,
    afterButtonZoomOut: timelineViewAfterButtonZoomOut,
  });
  await executeCommandAndExpect("set_current_frame", { frame: 1 }, (state) => state.current_frame === 1);
  const timelineViewAfterPinnedJump = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  record("pinned timeline window survives current-frame jumps", (
    timelineViewAfterPinnedJump.pinned
    && timelineViewAfterPinnedJump.current_frame === 1
    && timelineViewAfterPinnedJump.current_visible === false
    && timelineViewAfterPinnedJump.start === timelineViewAfterButtonZoomOut.start
    && timelineViewAfterPinnedJump.end === timelineViewAfterButtonZoomOut.end
    && timelineViewAfterPinnedJump.frames === timelineViewAfterButtonZoomOut.frames
  ), {
    beforeJump: timelineViewAfterButtonZoomOut,
    afterJump: timelineViewAfterPinnedJump,
  });
  await page.locator("#timelineResetViewButton").click();
  await page.waitForFunction(() => {
    const state = window.__motionDebug?.getTimelineViewState?.();
    return state?.frames === 24 && state.current_visible && state.pinned === false;
  }, null, { timeout: 10000 });
  const timelineViewAfterUnpinReset = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  record("timeline pinned badge clears after reset", (
    timelineViewAfterUnpinReset.pinned === false
    && timelineViewAfterUnpinReset.pinned_badge_visible === false
  ), timelineViewAfterUnpinReset);
}

async function dispatchTimelineWheel(deltaY, shiftKey = false) {
  await page.locator("#timelineFrameTicks").evaluate((node, args) => {
    const rect = node.getBoundingClientRect();
    node.dispatchEvent(new WheelEvent("wheel", {
      deltaY: args.deltaY,
      shiftKey: args.shiftKey,
      clientX: rect.left + rect.width * 0.5,
      clientY: rect.top + rect.height * 0.5,
      bubbles: true,
      cancelable: true,
    }));
  }, { deltaY, shiftKey });
  await page.waitForTimeout(50);
}

async function activateTimelineViewButtonAndWait(selector, commandName, key = "Enter") {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator(selector).focus();
  await page.keyboard.press(key);
  await page.waitForFunction(({ count, name }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === name && entry.status === "success");
  }, { count: beforeCount, name: commandName }, { timeout: 10000 });
}

async function validateFkJointControlRotation() {
  const before = await page.evaluate(() => window.__motionDebug.getMotionState());
  const beforeSummary = await getSummary();
  const fkControl = before.ik_controls.find((control) => control.id === "R_UpperArm_CTRL");
  record("hybrid mode exposes FK joint controls", (
    Boolean(fkControl?.is_joint_control)
    && beforeSummary.visible_joint_debug_controls === true
  ), {
    fkControl: fkControl ? { id: fkControl.id, role: fkControl.control_role, position: fkControl.position } : null,
    visible: beforeSummary.visible_joint_debug_controls,
  });

  await executeCommandAndExpect("set_control_transform", {
    control_id: "R_UpperArm_CTRL",
    transform_mode: "rotate",
    space: "global",
    rotation: [0, 0, 0.35],
  }, (state) => state.selected_control === "R_UpperArm_CTRL");
  const after = await page.evaluate(() => window.__motionDebug.getMotionState());
  const beforeUpperLen = vecDistance(getJointPosition(before, "R_UpperArm"), getJointPosition(before, "R_Forearm"));
  const afterUpperLen = vecDistance(getJointPosition(after, "R_UpperArm"), getJointPosition(after, "R_Forearm"));
  const beforeForearmLen = vecDistance(getJointPosition(before, "R_Forearm"), getJointPosition(before, "R_Hand"));
  const afterForearmLen = vecDistance(getJointPosition(after, "R_Forearm"), getJointPosition(after, "R_Hand"));
  record("FK upper arm rotation moves child branch without stretching bones", (
    jointPositionDelta(before, after, "R_UpperArm") < 0.001
    && jointPositionDelta(before, after, "R_Forearm") > 0.005
    && jointPositionDelta(before, after, "R_Hand") > 0.01
    && Math.abs(afterUpperLen - beforeUpperLen) < 0.001
    && Math.abs(afterForearmLen - beforeForearmLen) < 0.001
    && Math.abs(getControlRotation(after, "R_UpperArm_CTRL")[2] - 0.35) < 0.001
    && controlJointDistance(after, "R_UpperArm_CTRL") < 0.001
    && controlJointDistance(after, "R_Hand_IK") < 0.001
  ), {
    forearmDelta: jointPositionDelta(before, after, "R_Forearm"),
    handDelta: jointPositionDelta(before, after, "R_Hand"),
    upperLenDelta: afterUpperLen - beforeUpperLen,
    forearmLenDelta: afterForearmLen - beforeForearmLen,
    fkRotation: getControlRotation(after, "R_UpperArm_CTRL"),
    upperCtrlDelta: controlJointDistance(after, "R_UpperArm_CTRL"),
    handIkDelta: controlJointDistance(after, "R_Hand_IK"),
  });
  await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);

  await executeCommandAndExpect("set_control_transform", {
    control_id: "R_Hand_CTRL",
    transform_mode: "rotate",
    space: "global",
    rotation: [0.25, 0, 0],
  }, (state) => (
    state.selected_control === "R_Hand_CTRL"
    && state.joint_rotation_overrides >= 1
  ));
  const afterWrist = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("FK terminal joint rotation stores wrist orientation", (
    Math.abs(getControlRotation(afterWrist, "R_Hand_CTRL")[0] - 0.25) < 0.001
    && Boolean(afterWrist.joint_rotations?.R_Hand)
  ), {
    fkRotation: getControlRotation(afterWrist, "R_Hand_CTRL"),
    wristRotation: afterWrist.joint_rotations?.R_Hand,
  });
  await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);

  await executeCommandAndExpect("select_control", { control: "R_Forearm_CTRL" }, (state) => state.selected_control === "R_Forearm_CTRL");
  await executeCommandAndExpect("select_control", { control: "R_Hand_IK", additive: true }, (state) => (
    state.selected_controls.includes("R_Forearm_CTRL") && state.selected_controls.includes("R_Hand_IK")
  ));
  const beforeNestedRotate = await page.evaluate(() => window.__motionDebug.getMotionState());
  const handIkScreen = await page.evaluate(() => (
    window.__motionDebug.getIkControlScreenPositions().find((item) => item.id === "R_Hand_IK" && item.visible)
  ));
  record("nested rotate regression control visible", Boolean(handIkScreen), handIkScreen);
  if (handIkScreen) {
    const beforeRotateCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
    await page.mouse.move(handIkScreen.x + 80, handIkScreen.y);
    await page.locator("#rigCanvas").focus();
    await page.keyboard.press("r");
    await page.mouse.move(handIkScreen.x + 130, handIkScreen.y + 80, { steps: 1 });
    const afterFirstNestedMove = await page.evaluate(() => window.__motionDebug.getMotionState());
    await page.mouse.move(handIkScreen.x + 160, handIkScreen.y + 90, { steps: 8 });
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(({ count }) => {
      const log = window.__motionDebug?.getCommandLog?.() || [];
      return log.slice(count).some((entry) => (
        (entry.name === "set_control_transform" || entry.name === "set_control_transforms")
        && entry.status === "success"
        && entry.args?.transform_mode === "rotate"
      ));
    }, { count: beforeRotateCount }, { timeout: 10000 });
    const afterNestedRotate = await page.evaluate(() => window.__motionDebug.getMotionState());
    const beforeForearmLength = vecDistance(getJointPosition(beforeNestedRotate, "R_Forearm"), getJointPosition(beforeNestedRotate, "R_Hand"));
    const afterForearmLength = vecDistance(getJointPosition(afterNestedRotate, "R_Forearm"), getJointPosition(afterNestedRotate, "R_Hand"));
    record("R rotate filters nested IK child and keeps wrist control attached", (
      distancePlainVec(getControlRotation(beforeNestedRotate, "R_Forearm_CTRL"), getControlRotation(afterFirstNestedMove, "R_Forearm_CTRL")) < 0.001
      && afterNestedRotate.selected_controls.length === 1
      && afterNestedRotate.selected_controls.includes("R_Forearm_CTRL")
      && controlJointDistance(afterNestedRotate, "R_Hand_IK") < 0.001
      && Math.abs(afterForearmLength - beforeForearmLength) < 0.001
    ), {
      beforeSelection: beforeNestedRotate.selected_controls,
      afterSelection: afterNestedRotate.selected_controls,
      firstMoveRotation: getControlRotation(afterFirstNestedMove, "R_Forearm_CTRL"),
      handIkDelta: controlJointDistance(afterNestedRotate, "R_Hand_IK"),
      forearmLengthDelta: afterForearmLength - beforeForearmLength,
    });
    await executeCommandAndExpect("undo", {}, (state) => state.redo_stack >= 1);
  }
}

async function validateZBrushTransformGizmoModes() {
  await executeCommandAndExpect("select_control", { control: "COG_CTRL" }, (state) => state.selected_control === "COG_CTRL");
  await page.locator('[data-tool="select"]').click();
  const selectDebug = await page.evaluate(() => window.__motionDebug.getTransformGizmoDebug());
  record("select mode shows only a light pivot, not a piled GRS gizmo", (
    selectDebug.visible === true
    && selectDebug.modes.length === 0
  ), selectDebug);

  await page.locator('[data-tool="translate"]').click();
  const moveDebug = await page.evaluate(() => window.__motionDebug.getTransformGizmoDebug());
  record("G move gizmo exposes only translate handles", (
    moveDebug.modes.length === 1
    && moveDebug.modes.includes("translate")
    && moveDebug.axis_keys.includes("x")
    && moveDebug.axis_keys.includes("y")
    && moveDebug.axis_keys.includes("z")
    && moveDebug.axis_keys.includes(null)
  ), moveDebug);

  await page.locator('[data-tool="rotate"]').click();
  const rotateDebug = await page.evaluate(() => window.__motionDebug.getTransformGizmoDebug());
  record("R rotate gizmo exposes only rotate rings", (
    rotateDebug.modes.length === 1
    && rotateDebug.modes.includes("rotate")
    && rotateDebug.axis_keys.includes("x")
    && rotateDebug.axis_keys.includes("y")
    && rotateDebug.axis_keys.includes("z")
    && rotateDebug.axis_keys.includes("view")
  ), rotateDebug);

  await page.locator('[data-tool="scale"]').click();
  const scaleDebug = await page.evaluate(() => window.__motionDebug.getTransformGizmoDebug());
  record("S scale gizmo exposes only scale handles", (
    scaleDebug.modes.length === 1
    && scaleDebug.modes.includes("scale")
    && scaleDebug.axis_keys.includes("x")
    && scaleDebug.axis_keys.includes("y")
    && scaleDebug.axis_keys.includes("z")
    && scaleDebug.axis_keys.includes(null)
  ), scaleDebug);

  await page.locator('[data-tool="select"]').click();
}

async function validateTimelineLoopSpeedAndRangeDrag() {
  const beforeSpeedCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#timelineSpeedInput").evaluate((input) => {
    input.value = "1.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => entry.name === "set_playback_speed" && entry.status === "success");
  }, { count: beforeSpeedCount }, { timeout: 10000 });
  const speedState = await page.evaluate(() => ({
    summary: window.__motionDebug.getMotionStateSummary(),
    slider: document.querySelector("#timelineSpeedInput")?.value,
    label: document.querySelector("#timelineSpeedValue")?.textContent,
  }));
  record("timeline speed slider updates playback speed", (
    Math.abs(speedState.summary.playback_speed - 1.5) < 0.001
    && speedState.slider === "1.5"
    && speedState.label === "1.50x"
  ), speedState);

  await executeCommandAndExpect("reset_timeline_view", {}, (state) => state.current_frame >= 1);
  const beforeLoopDragCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  const endHandle = await page.locator(".loop-range-handle.is-end").boundingBox();
  const tickRect = await page.locator("#timelineFrameTicks").boundingBox();
  record("timeline loop range handles are visible", Boolean(endHandle && tickRect), { endHandle, tickRect });
  if (endHandle && tickRect) {
    const targetX = tickRect.x + tickRect.width * ((16 - 1 + 0.5) / 24);
    await page.mouse.move(endHandle.x + endHandle.width / 2, endHandle.y + endHandle.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetX, endHandle.y + endHandle.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction(({ count }) => {
      const log = window.__motionDebug?.getCommandLog?.() || [];
      return log.slice(count).some((entry) => entry.name === "set_loop_range" && entry.status === "success");
    }, { count: beforeLoopDragCount }, { timeout: 10000 });
  }
  const loopState = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  record("timeline loop bar end handle adjusts loop range", (
    loopState.loop_range.start === 1
    && loopState.loop_range.end === 16
    && loopState.loop_enabled === true
  ), loopState);

  await page.locator("#timelineLoopToggle").uncheck();
  await page.waitForFunction(() => window.__motionDebug?.getTimelineViewState?.().loop_enabled === false, null, { timeout: 10000 });
  await page.locator("#timelineLoopToggle").check();
  await page.waitForFunction(() => window.__motionDebug?.getTimelineViewState?.().loop_enabled === true, null, { timeout: 10000 });
  const loopToggleState = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
  record("timeline loop toggle controls playback loop", loopToggleState.loop_enabled === true, loopToggleState);

  await page.locator('.frame-tick[data-frame="13"]').click();
  await page.keyboard.down("Shift");
  await page.locator('.frame-tick[data-frame="22"]').click();
  await page.keyboard.up("Shift");
  const selectedBeforeDrag = await page.evaluate(() => window.__motionDebug.getTimelineViewState().selected_frames);
  const beforeMoveCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  const dragMarker = await page.locator('.key-pose.has-keyframe[data-frame="13"]').boundingBox();
  const targetTickRect = await page.locator("#timelineFrameTicks").boundingBox();
  record("timeline selected range and drag marker are available", (
    selectedBeforeDrag.includes(13)
    && selectedBeforeDrag.includes(22)
    && Boolean(dragMarker && targetTickRect)
  ), { selectedBeforeDrag, dragMarker, targetTickRect });
  if (dragMarker && targetTickRect) {
    const insertX = targetTickRect.x + targetTickRect.width * ((4 - 1) / 24);
    await page.mouse.move(dragMarker.x + dragMarker.width / 2, dragMarker.y + dragMarker.height / 2);
    await page.mouse.down();
    await page.mouse.move(insertX, dragMarker.y + dragMarker.height / 2, { steps: 8 });
    const dragPreview = await page.evaluate(() => window.__motionDebug.getTimelineViewState());
    record("timeline range drag shows insertion cursor", (
      dragPreview.insert_cursor_visible === true
      && dragPreview.insert_frame === 4
    ), dragPreview);
    await page.mouse.up();
    await page.waitForFunction(({ count }) => {
      const log = window.__motionDebug?.getCommandLog?.() || [];
      return log.slice(count).some((entry) => entry.name === "move_timeline_range" && entry.status === "success");
    }, { count: beforeMoveCount }, { timeout: 10000 });
  }
  const movedState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const movedFrames = movedState.keyframes.map((keyframe) => keyframe.timeline_frame);
  record("timeline selected keyframe segment moves as a clip", (
    movedFrames.includes(4)
    && movedFrames.includes(7)
    && movedFrames.includes(10)
    && movedState.command_log.some((entry) => entry.name === "move_timeline_range" && entry.status === "success")
  ), { movedFrames });
}

async function validateMotionTemplateLibrary() {
  const expectations = [
    ["idle_breathe_24f", 4, 24],
    ["run_cycle_8f", 8, 16],
    ["jump_in_place_16f", 5, 18],
    ["crouch_16f", 4, 16],
    ["punch_right_12f", 5, 12],
  ];
  const selectOptions = await page.locator("#motionTemplateSelect option").allTextContents();
  record("motion template select exposes common templates", (
    selectOptions.some((text) => text.includes("Idle_Breathe"))
    && selectOptions.some((text) => text.includes("Run_8F"))
    && selectOptions.some((text) => text.includes("Jump_16F"))
    && selectOptions.some((text) => text.includes("Crouch_16F"))
    && selectOptions.some((text) => text.includes("Punch_R_12F"))
  ), { selectOptions });

  for (const [templateId, expectedKeyframes, expectedLoopEnd] of expectations) {
    await executeCommandAndExpect("apply_motion_template", { template_id: templateId }, (state) => (
      state.keyframes === expectedKeyframes
      && state.loop_range?.start === 1
      && state.loop_range?.end === expectedLoopEnd
    ));
    const state = await page.evaluate(() => window.__motionDebug.getMotionState());
    record(`motion template ${templateId} creates expected keyed pose count`, (
      state.keyframes.length === expectedKeyframes
      && state.keyframes.every((keyframe) => keyframe.template_id === templateId)
      && state.loop_range.start === 1
      && state.loop_range.end === expectedLoopEnd
    ), {
      templateId,
      frames: state.keyframes.map((keyframe) => keyframe.timeline_frame),
      loopRange: state.loop_range,
    });
    if (templateId === "idle_breathe_24f") {
      record("idle breathe template keeps arms relaxed instead of T/A pose", idleTemplateArmsAreRelaxed(state), {
        armDiagnostics: getIdleTemplateArmDiagnostics(state),
      });
    }
    if (templateId === "punch_right_12f") {
      await executeCommandAndExpect("validate_motion", {}, (summary) => summary.validation === "Passed");
      const punchReport = await page.evaluate(() => window.__motionDebug.getValidationReport());
      record("punch template validation uses rest skeleton identity, not crossed attack pose", Boolean(
        punchReport
        && punchReport.status === "Passed"
        && punchReport.checks?.bone_identity_error === "Passed"
        && !(punchReport.issues || []).some((issue) => issue.code === "bone_identity_error")
      ), {
        status: punchReport?.status,
        boneIdentity: punchReport?.checks?.bone_identity_error,
        issues: punchReport?.issues,
      });
    }
  }

  await page.locator("#motionTemplateSelect").selectOption("run_cycle_8f");
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#applyWalkButton").click();
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => (
      entry.name === "apply_motion_template"
      && entry.status === "success"
      && entry.args?.template_id === "run_cycle_8f"
    ));
  }, { count: beforeCount }, { timeout: 10000 });
  const uiApplied = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("motion template UI applies selected template", (
    uiApplied.keyframes.length === 8
    && uiApplied.keyframes.every((keyframe) => keyframe.template_id === "run_cycle_8f")
  ), {
    frames: uiApplied.keyframes.map((keyframe) => keyframe.timeline_frame),
  });
  await page.locator("#motionTemplateSelect").selectOption("walk_cycle_8f");
}

async function validateMotionBrainPipeline() {
  const samples = [
    ["\u5411\u524d\u6325\u51fa\u53f3\u62f3", "attack", "forward_strike", "strike", "right_hand"],
    ["\u8eba\u4e0b", "posture_transition", "standing_to_ground", "lie_down", "full_body"],
    ["\u751f\u6210\u4e00\u4e2a\u666e\u901a\u8d70\u8def", "locomotion", "walk"],
    ["\u751f\u6210\u4e00\u4e2a\u614c\u5f20\u5954\u8dd1", "locomotion", "run"],
    ["\u751f\u6210\u4e00\u4e2a\u81ea\u7136\u7ad9\u7acb\u547c\u5438", "idle", "breath"],
    ["\u751f\u6210\u4e00\u4e2a\u5411\u524d\u8df3\u8dc3", "locomotion", "jump_forward"],
    ["\u751f\u6210\u4e00\u4e2a\u53cc\u624b\u6b66\u5668\u6a2a\u6325\u653b\u51fb", "attack", "two_handed_swing"],
    ["\u751f\u6210\u4e00\u4e2a\u75b2\u60eb\u5730\u63a8\u5f00\u95e8", "interaction", "push_door"],
    ["\u751f\u6210\u4e00\u4e2a\u60ca\u614c\u540e\u9000\u5e76\u649e\u5230\u5899", "reaction", "wall_collision"],
    ["\u751f\u6210\u4e00\u4e2a\u89d2\u8272\u6361\u8d77\u5730\u4e0a\u7684\u6b66\u5668", "object_manipulation", "pick_up_weapon"],
    ["\u751f\u6210\u4e00\u4e2a\u4e3e\u624b\u6325\u624b", "gesture", "wave_hand"],
  ];
  const uiVisible = await page.locator("#motionBrainTextInput").count();
  const loadButtonVisible = await page.locator("#loadMotionBrainButton").count();
  record("motion brain UI entry is present", uiVisible === 1 && loadButtonVisible === 1, {
    uiVisible,
    loadButtonVisible,
  });

  for (const [text, actionType, subtype, verbFamily = null, effector = null] of samples) {
    await executeCommandAndExpect("generate_motion_from_text", { text }, (state) => (
      state.keyframes >= 4
      && state.motion_brain_last_action === subtype
      && state.motion_brain_final_passed === true
      && state.validation === "Passed"
    ));
    const result = await page.evaluate(() => window.__motionDebug.getMotionBrainLastResult());
    record(`motion brain compiles ${subtype}`, Boolean(
      result
      && result.action_intent?.raw_text === text
      && result.action_ir?.action_type === actionType
      && result.action_ir?.subtype === subtype
      && (!verbFamily || result.action_ir?.verb_family === verbFamily)
      && (!effector || result.action_ir?.effector === effector)
      && Number(result.action_ir?.parser_confidence || 0) >= 0.6
      && Array.isArray(result.motion_plan?.phases)
      && result.motion_plan.phases.length >= 3
      && Array.isArray(result.action_primitives)
      && result.action_primitives.length >= 2
      && Array.isArray(result.primitive_sequence)
      && result.primitive_sequence.length >= result.motion_plan.phases.length
      && Array.isArray(result.controller_keyframes)
      && result.controller_keyframes.length >= 4
      && result.controller_summary?.controller_ids?.includes("COG_CTRL")
      && result.validator?.status === "Passed"
      && result.intent_fulfillment_report?.status === "Passed"
      && result.critic_report?.passed === true
      && result.quality_gate?.passed === true
      && result.final_passed === true
    ), {
      text,
      intent: result?.action_intent,
      actionIR: result?.action_ir,
      phases: result?.motion_plan?.phases?.map((phase) => phase.phase_name),
      primitives: result?.action_primitives?.map((primitive) => primitive.id),
      keyframes: result?.controller_keyframes?.length,
      validator: result?.validator?.status,
      fulfillment: result?.intent_fulfillment_report,
      critic: result?.critic_report?.issues?.map((issue) => issue.code),
      gate: result?.quality_gate?.severity,
      rigValidator: result?.rig_validation?.status,
      autofix: result?.autofix,
      armSummary: result?.pose_features?.summary?.arm,
    });

    if (subtype === "forward_strike") {
      record("intent fulfillment validates right punch semantic slots", Boolean(
        result.action_ir?.verb_family === "strike"
        && result.action_ir?.effector === "right_hand"
        && result.action_ir?.direction === "forward"
        && result.motion_plan?.phases?.some((phase) => phase.phase_name === "impact")
        && result.intent_fulfillment_report?.checks?.strike_forward_motion === "Passed"
      ), {
        actionIR: result.action_ir,
        phases: result.motion_plan?.phases?.map((phase) => phase.phase_name),
        fulfillment: result.intent_fulfillment_report,
      });
    }

    if (subtype === "standing_to_ground") {
      record("intent fulfillment validates lie down semantic slots", Boolean(
        result.action_ir?.verb_family === "lie_down"
        && result.action_ir?.target === "floor"
        && result.action_ir?.direction === "down"
        && result.motion_plan?.phases?.some((phase) => phase.phase_name === "settle_on_floor")
        && result.intent_fulfillment_report?.checks?.lie_down_cog_drop === "Passed"
      ), {
        actionIR: result.action_ir,
        phases: result.motion_plan?.phases?.map((phase) => phase.phase_name),
        fulfillment: result.intent_fulfillment_report,
      });
    }

    if (subtype === "walk") {
      record("motion critic fixes ordinary walk arms to relaxed FK swing", Boolean(
        result.final_passed === true
        && (result.pose_features?.summary?.arm?.average_hand_ik_weight || 0) <= 0.2
        && !result.controller_summary?.controller_ids?.includes("R_Hand_IK")
        && !result.controller_summary?.controller_ids?.includes("L_Hand_IK")
        && result.controller_summary?.controller_ids?.includes("R_UpperArm_CTRL")
        && result.autofix?.fixes?.includes("converted_locomotion_arms_to_fk_relaxed_swing")
      ), {
        controllerIds: result.controller_summary?.controller_ids,
        handIkWeight: result.pose_features?.summary?.arm?.average_hand_ik_weight,
        fixes: result.autofix?.fixes,
      });
    }

    if (subtype === "breath") {
      const selectedSource = await page.locator("#motionTemplateSelect option:checked").textContent();
      const applyTemplateDisabled = await page.locator("#applyWalkButton").isDisabled();
      record("motion brain generated clip is shown as current motion source", Boolean(
        selectedSource?.includes("Motion Brain")
        && selectedSource?.includes("自然站立呼吸")
        && applyTemplateDisabled
      ), { selectedSource, applyTemplateDisabled });
    }

    if (subtype === "wave_hand") {
      record("motion critic allows raised hand when intent is wave", Boolean(
        result.final_passed === true
        && (result.pose_features?.summary?.arm?.max_wrist_height_relative_to_chest || 0) > 0.05
        && result.action_intent?.hand_usage === "raise_hand_wave"
      ), {
        maxWristVsChest: result.pose_features?.summary?.arm?.max_wrist_height_relative_to_chest,
        handUsage: result.action_intent?.hand_usage,
        critic: result.critic_report?.issues?.map((issue) => issue.code),
      });
    }

    if (subtype === "push_door") {
      record("motion critic allows HandIK for contact interaction", Boolean(
        result.final_passed === true
        && (result.pose_features?.summary?.arm?.average_hand_ik_weight || 0) > 0.2
        && result.action_intent?.validation_profile === "interaction"
      ), {
        handIkWeight: result.pose_features?.summary?.arm?.average_hand_ik_weight,
        validationProfile: result.action_intent?.validation_profile,
      });
    }
  }

  const beforeGenericRejectState = await page.evaluate(() => window.__motionDebug.getMotionState());
  await executeCommandAndExpect("generate_motion_from_text", { text: "\u968f\u4fbf\u52a8\u4e00\u4e0b" }, (state) => (
    state.keyframes >= 4
    && state.motion_brain_last_action === "generic"
    && state.motion_brain_final_passed === false
  ));
  const genericResult = await page.evaluate(() => window.__motionDebug.getMotionBrainLastResult());
  const afterGenericRejectState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("generic fallback is visible but not marked fully accepted", Boolean(
    genericResult
    && genericResult.action_ir?.action_type === "generic"
    && genericResult.action_ir?.uncertainty_flags?.includes("generic_fallback")
    && genericResult.controller_keyframes?.length >= 4
    && !genericResult.validator?.issues?.some((issue) => issue.code === "NO_VISIBLE_ACTION")
    && genericResult.quality_gate?.passed === false
    && genericResult.final_passed === false
  ), {
    actionIR: genericResult?.action_ir,
    validatorIssues: genericResult?.validator?.issues?.map((issue) => issue.code),
    gate: genericResult?.quality_gate?.severity,
    finalPassed: genericResult?.final_passed,
  });
  record("quality gate blocker does not overwrite current accepted timeline", Boolean(
    genericResult?.rejected_by_quality_gate === true
    && afterGenericRejectState.keyframes?.length === beforeGenericRejectState.keyframes?.length
    && afterGenericRejectState.keyframes?.[0]?.label === beforeGenericRejectState.keyframes?.[0]?.label
  ), {
    rejected: genericResult?.rejected_by_quality_gate,
    beforeFirstLabel: beforeGenericRejectState.keyframes?.[0]?.label,
    afterFirstLabel: afterGenericRejectState.keyframes?.[0]?.label,
    beforeKeyframes: beforeGenericRejectState.keyframes?.length,
    afterKeyframes: afterGenericRejectState.keyframes?.length,
  });

  await executeCommandAndExpect("self_check_motion_templates", {}, (state) => state.motion_template_self_check_passed !== null);
  const templateSelfCheck = await page.evaluate(() => window.__motionDebug.getMotionTemplateSelfCheck());
  record("motion template self-check reviews every generated template", Boolean(
    templateSelfCheck
    && templateSelfCheck.reports?.length >= 6
    && templateSelfCheck.reports.every((item) => item.critic_report && item.quality_gate)
  ), {
    passed: templateSelfCheck?.passed,
    reports: templateSelfCheck?.reports?.map((item) => ({
      template: item.template_id,
      gate: item.quality_gate?.severity,
      issues: item.critic_report?.issues?.map((issue) => issue.code),
    })),
  });

  const beforeUiPreviewState = await page.evaluate(() => window.__motionDebug.getMotionState());
  await page.locator("#motionBrainTextInput").fill("\u751f\u6210\u4e00\u4e2a\u7ffb\u6eda\u95ea\u907f");
  const beforePreviewCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#generateMotionBrainButton").click();
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => (
      entry.name === "preview_motion_from_text"
      && entry.status === "success"
    ));
  }, { count: beforePreviewCount }, { timeout: 10000 });
  const uiResult = await page.evaluate(() => window.__motionDebug.getMotionBrainLastResult());
  const afterUiPreviewState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const loadButtonEnabled = await page.locator("#loadMotionBrainButton").isEnabled();
  record("motion brain UI previews unknown primitive combination before loading", Boolean(
    uiResult
    && uiResult.action_intent?.subtype === "dodge_roll"
    && uiResult.motion_plan?.prototype_id === null
    && uiResult.motion_plan?.phases?.some((phase) => phase.phase_name === "roll")
    && uiResult.final_passed === true
    && uiResult.ready_to_load === true
    && uiResult.loaded_to_timeline === false
    && afterUiPreviewState.keyframes?.[0]?.label === beforeUiPreviewState.keyframes?.[0]?.label
    && loadButtonEnabled
  ), {
    subtype: uiResult?.action_intent?.subtype,
    prototype: uiResult?.motion_plan?.prototype_id,
    phases: uiResult?.motion_plan?.phases?.map((phase) => phase.phase_name),
    finalPassed: uiResult?.final_passed,
    readyToLoad: uiResult?.ready_to_load,
    loadedToTimeline: uiResult?.loaded_to_timeline,
    beforeFirstLabel: beforeUiPreviewState.keyframes?.[0]?.label,
    afterFirstLabel: afterUiPreviewState.keyframes?.[0]?.label,
    loadButtonEnabled,
  });

  const beforeLoadCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  await page.locator("#loadMotionBrainButton").click();
  await page.waitForFunction(({ count }) => {
    const log = window.__motionDebug?.getCommandLog?.() || [];
    return log.slice(count).some((entry) => (
      entry.name === "load_motion_brain_result"
      && entry.status === "success"
    ));
  }, { count: beforeLoadCount }, { timeout: 10000 });
  const loadedUiResult = await page.evaluate(() => window.__motionDebug.getMotionBrainLastResult());
  const loadedUiState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const selectedMotionOption = await page.locator("#motionTemplateSelect option:checked").textContent();
  const loadButtonEnabledAfterLoad = await page.locator("#loadMotionBrainButton").isEnabled();
  record("motion brain UI loads previewed text motion into timeline", Boolean(
    loadedUiResult
    && loadedUiResult.loaded_to_timeline === true
    && loadedUiState.keyframes?.some((keyframe) => keyframe.motion_brain)
    && selectedMotionOption?.includes("Motion Brain")
    && !loadButtonEnabledAfterLoad
  ), {
    loadedToTimeline: loadedUiResult?.loaded_to_timeline,
    readyToLoad: loadedUiResult?.ready_to_load,
    frames: loadedUiState.keyframes?.map((keyframe) => keyframe.timeline_frame),
    selectedMotionOption,
    loadButtonEnabledAfterLoad,
  });
}

async function validateCurrentFrameCopyPasteAndMirror() {
  await executeCommandAndExpect("set_current_frame", { frame: 1 }, (state) => state.current_frame === 1);
  await executeCommandAndExpect("copy_current_frame", {}, () => true);
  await executeCommandAndExpect("set_current_frame", { frame: 2 }, (state) => state.current_frame === 2);
  await executeCommandAndExpect("paste_copied_frame", { frame: 2 }, (state) => state.current_frame === 2);
  const pastedState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("paste copied frame creates current keyframe", Boolean(
    pastedState.keyframes?.some((keyframe) => keyframe.timeline_frame === 2 && keyframe.label === "COPIED")
  ), {
    frames: pastedState.keyframes?.map((keyframe) => ({ frame: keyframe.timeline_frame, label: keyframe.label })),
  });

  const beforeMirror = await page.evaluate(() => window.__motionDebug.getMotionState());
  await executeCommandAndExpect("mirror_current_frame", { frame: 2 }, (state) => state.current_frame === 2);
  const afterMirror = await page.evaluate(() => window.__motionDebug.getMotionState());
  const expectedRightHand = reflectAcrossHipsSidePlane(
    getControlPosition(beforeMirror, "L_Hand_IK"),
    getJointPosition(beforeMirror, "Hips"),
  );
  const actualRightHand = getControlPosition(afterMirror, "R_Hand_IK");
  record("mirror current frame swaps hand IK across center", (
    distancePlainVec(expectedRightHand, actualRightHand) < 0.015
    && afterMirror.keyframes?.some((keyframe) => keyframe.timeline_frame === 2 && keyframe.label === "MIRROR")
  ), {
    expectedRightHand,
    actualRightHand,
    delta: distancePlainVec(expectedRightHand, actualRightHand),
  });
}

async function validateWalkArmSolveModesMatchBasic() {
  await executeCommandAndExpect("export_motion_json", {}, (state) => state.skeleton === "Humanoid_v1");
  const restoreJson = await page.evaluate(() => window.__motionDebug.getExportedJson());
  const basic = await buildWalkStateForSolveMode("basic");
  const hybrid = await buildWalkStateForSolveMode("hybrid");
  const pinned = await buildWalkStateForSolveMode("pinned");
  const hybridComparison = compareWalkArmOffsets(basic, hybrid);
  const pinnedComparison = compareWalkArmOffsets(basic, pinned);
  record("hybrid walk arm guide matches simple IK", hybridComparison.pass, hybridComparison);
  record("pinned walk arm guide matches simple IK", pinnedComparison.pass, pinnedComparison);
  await executeCommandAndExpect("import_motion_json", { json: restoreJson }, (state) => (
    state.skeleton === "Humanoid_v1" && state.ik_controls === 14
  ));
}

async function buildWalkStateForSolveMode(mode) {
  await executeCommandAndExpect("create_humanoid_skeleton", {}, (state) => state.skeleton === "Humanoid_v1");
  await executeCommandAndExpect("create_ik_controls", { solve_mode: mode }, (state) => (
    state.ik_controls === 14 && state.control_solve_mode === mode
  ));
  await executeCommandAndExpect("apply_motion_template", { template_id: "walk_cycle_8f" }, (state) => state.keyframes === 8);
  return page.evaluate(() => window.__motionDebug.getMotionState());
}

async function getMappingChipVisualState(joint) {
  return page.locator(`[data-humanoid-joint="${joint}"]`).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      className: element.className,
      borderColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
    };
  });
}

async function importSampleGlbAndValidateToeFallback() {
  const beforeCount = await page.evaluate(() => window.__motionDebug.getCommandLog().length);
  const fileInputDisplay = await page.locator("#modelFileInput").evaluate((input) => getComputedStyle(input).display);
  record("model file input remains triggerable while visually hidden", fileInputDisplay !== "none", { display: fileInputDisplay });
  const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
  await page.locator("#toolbarImportButton").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(sampleGlbPath);
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

  record("sample GLB source bones are visible for binding", imported.source_bones > 0 && imported.current_stage === "skeleton", imported);

  const importedState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const startYaw = Number(importedState.direction?.yaw_degrees || 0);
  record("sample GLB direction starts neutral before manual alignment", angleAlmostEqual(startYaw, 0) && importedState.direction?.confirmed === false, {
    startYaw,
    direction: importedState.direction,
  });
  for (let index = 1; index <= 6; index += 1) {
    const expectedYaw = normalizeDegrees(startYaw + index * 15);
    await clickAndExpect("#rotateForwardRightButton", "set_character_direction", (state) => (
      angleAlmostEqual(state.direction?.yaw_degrees, expectedYaw)
      && state.direction?.confirmed === false
      && state.current_stage === "skeleton"
    ));
  }
  await clickAndExpect("#confirmForwardButton", "set_character_direction", (state) => (
    angleAlmostEqual(state.direction?.yaw_degrees, normalizeDegrees(startYaw + 90))
    && state.direction?.confirmed === true
    && state.current_stage === "skeleton"
  ));
  const sourceRigBeforeBind = await page.evaluate(() => window.__motionDebug.getSourceRigDebug());
  const directionArgs = await page.evaluate(() => window.__motionDebug.getMotionState().direction);
  record("confirmed direction refreshes source rest cache", sourceRigRestMatchesCurrent(sourceRigBeforeBind), {
    hips: sourceRigBeforeBind.mapped?.Hips,
    rightHand: sourceRigBeforeBind.mapped?.R_Hand,
  });
  const hipChipBeforeBind = await getMappingChipVisualState("Hips");
  record("mapped joint chip is green before binding confirmation", (
    hipChipBeforeBind.className.includes("is-mapped")
    && !hipChipBeforeBind.className.includes("is-confirmed")
    && rgbLooksGreen(hipChipBeforeBind.borderColor)
  ), hipChipBeforeBind);

  await clickAndExpect("#createSkeletonButton", "create_humanoid_skeleton", (state) => (
    state.skeleton === "Humanoid_v1"
    && state.joints === 19
    && (state.missing_required_mapping || []).length === 0
    && state.current_stage === "skeleton"
    && state.editable_assignment_skeleton === true
  ));
  const hipChipAfterBind = await getMappingChipVisualState("Hips");
  record("confirmed joint chip turns yellow after binding", (
    hipChipAfterBind.className.includes("is-confirmed")
    && rgbLooksYellow(hipChipAfterBind.borderColor)
  ), hipChipAfterBind);

  const sourceRigAfterBind = await page.evaluate(() => window.__motionDebug.getSourceRigDebug());
  const bindStability = sourceRigTransformsStable(sourceRigBeforeBind, sourceRigAfterBind);
  record("binding keeps imported source rig pose stable", bindStability.pass, bindStability);
  record("confirmed direction uses fixed map-forward rig basis", vectorAlmostEqual(sourceRigAfterBind.basis?.forward, [0, 0, 1], 0.001), {
    basis: sourceRigAfterBind.basis,
    directionArgs,
  });
  const humanoidState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const bakedHips = humanoidState.joints.find((joint) => joint.name === "Hips")?.position || null;
  const expectedHips = sourceRigBeforeBind.mapped?.Hips?.current_world_position || null;
  record("confirmed model direction is baked into bound skeleton", (
    Boolean(bakedHips && expectedHips) && vecDistance(bakedHips, expectedHips) < 0.001
  ), { bakedHips, expectedHips, directionArgs });
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

  await executeCommandAndExpect("save_initial_skeleton", {}, (state) => state.initial_skeleton_saved === true);
  await clickAndExpect("#toolbarCreateIkButton", "set_stage", (state) => state.current_stage === "control_rig");
  await clickAndExpect("#createIkButton", "create_ik_controls", (state) => (
    state.ik_controls === 14
    && state.joint_controls === 19
    && state.visible_joint_debug_controls === true
    && state.control_ids.includes("COG_CTRL")
    && state.control_ids.includes("Chest_CTRL")
  ));
  await executeCommandAndExpect("generate_motion_from_text", { text: "\u751f\u6210\u4e00\u4e2a\u81ea\u7136\u7ad9\u7acb\u547c\u5438" }, (state) => (
    state.motion_brain_last_action === "breath"
    && state.motion_brain_final_passed === true
    && state.motion_brain_quality_gate === "passed"
    && state.validation === "Passed"
    && state.keyframes >= 4
  ));
  const importedIdleBrain = await page.evaluate(() => window.__motionDebug.getMotionBrainLastResult());
  record("imported GLB idle breath self-critic keeps arms relaxed", Boolean(
    importedIdleBrain?.final_passed === true
    && importedIdleBrain?.quality_gate?.passed === true
    && (importedIdleBrain?.pose_features?.summary?.arm?.max_wrist_height_relative_to_chest || 0) < 0
    && (importedIdleBrain?.pose_features?.summary?.arm?.average_hand_ik_weight || 0) <= 0.2
    && !(importedIdleBrain?.critic_report?.issues || []).some((issue) => ["ARM_TOO_HIGH", "TPOSE_RESIDUE"].includes(issue.code))
    && importedIdleBrain?.autofix?.fixes?.includes("converted_locomotion_arms_to_fk_relaxed_swing")
  ), {
    finalPassed: importedIdleBrain?.final_passed,
    gate: importedIdleBrain?.quality_gate?.severity,
    maxWristVsChest: importedIdleBrain?.pose_features?.summary?.arm?.max_wrist_height_relative_to_chest,
    handIkWeight: importedIdleBrain?.pose_features?.summary?.arm?.average_hand_ik_weight,
    criticIssues: importedIdleBrain?.critic_report?.issues?.map((issue) => issue.code),
    fixes: importedIdleBrain?.autofix?.fixes,
  });
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
  await page.locator("#motionTemplateSelect").selectOption("walk_cycle_8f");
  await clickAndExpect("#applyWalkButton", "apply_motion_template", (state) => state.keyframes === 8 && state.direction?.confirmed === true);
  const importedWalkState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("sample GLB walk keeps hands on their own sides", walkHandsStayOnOwnSides(importedWalkState), {
    keyframes: importedWalkState.keyframes?.length,
  });
  record("sample GLB walk does not auto-twist wrist bones", walkTemplateDoesNotWriteWristRotations(importedWalkState), {
    wristRotationFrames: getWristRotationFrames(importedWalkState),
  });
  record("sample GLB walk keeps elbow poles outside the body", walkElbowPolesStayOutside(importedWalkState), {
    badElbowPoleFrames: getBadElbowPoleFrames(importedWalkState),
  });
  record("sample GLB walk avoids forward elbow fold", walkElbowsAvoidForwardFold(importedWalkState), {
    badForwardElbowFrames: getForwardBentElbowFrames(importedWalkState),
  });
  const sourceRigAfterWalk = await page.evaluate(() => window.__motionDebug.getSourceRigDebug());
  record("sample GLB source rig keeps hands on their own sides after walk", sourceRigHandsStayOnOwnSides(sourceRigAfterWalk), {
    rightHand: sourceRigAfterWalk.mapped?.R_Hand?.current_world_position,
    leftHand: sourceRigAfterWalk.mapped?.L_Hand?.current_world_position,
  });
}

async function validateIncompleteMappingAssignmentSkeleton() {
  const sourceSnapTarget = await page.evaluate(() => {
    const mapped = window.__motionDebug.getSourceRigDebug().mapped?.L_Hand;
    return mapped ? {
      sourceBoneId: mapped.source_bone_id,
      position: mapped.current_world_position,
    } : null;
  });
  await page.evaluate(() => {
    const state = window.__motionDebug.MotionState;
    const keep = new Set(["Hips", "Head"]);
    state.humanoid_mapping = Object.fromEntries(
      Object.entries(state.humanoid_mapping || {}).filter(([joint]) => keep.has(joint)),
    );
    state.skeleton = null;
    state.joints = [];
    state.bones = [];
    state.ik_controls = [];
    state.keyframes = [];
    state.selected_bone = null;
    state.selected_control = null;
    state.selected_controls = [];
    state.direction = { ...(state.direction || {}), confirmed: true };
    state.show.joint_debug_controls = false;
  });

  await executeCommandAndExpect("create_humanoid_skeleton", {}, (state) => (
    state.skeleton === "Humanoid_v1"
    && state.joints === 19
    && state.editable_assignment_skeleton === true
    && state.visible_joint_debug_controls === true
    && state.current_stage === "skeleton"
    && String(state.skeleton_label || "").includes("赋值骨架")
    && (state.missing_required_mapping || []).length > 0
  ));
  const assignmentStatusText = await page.locator("#statusSkeleton").textContent();
  record("assignment skeleton status is visible in header", (
    String(assignmentStatusText || "").includes("赋值骨架")
  ), { assignmentStatusText });
  const assignmentState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const estimatedJoints = assignmentState.joints
    .filter((joint) => joint.is_estimated_from_mesh)
    .map((joint) => joint.name);
  record("missing mapped joints use estimated assignment positions", (
    estimatedJoints.includes("R_Hand")
    && estimatedJoints.includes("L_Foot")
  ), { estimatedJoints });

  const rightHandBefore = assignmentState.joints.find((joint) => joint.name === "R_Hand")?.position || [0, 0, 0];
  const rightHandTarget = [rightHandBefore[0] + 0.04, rightHandBefore[1], rightHandBefore[2]];
  await executeCommandAndExpect("set_joint_position", {
    joint: "R_Hand",
    position: rightHandTarget,
  }, (state) => state.skeleton === "Humanoid_v1");
  const movedState = await page.evaluate(() => window.__motionDebug.getMotionState());
  record("assignment skeleton keypoint can be manually positioned", (
    vecDistance(getJointPosition(movedState, "R_Hand"), rightHandTarget) < 0.001
  ), {
    rightHandBefore,
    rightHandTarget,
    rightHandAfter: getJointPosition(movedState, "R_Hand"),
  });

  const liveSourceSnapTarget = sourceSnapTarget?.sourceBoneId
    ? await page.evaluate((sourceBoneId) => (
      window.__motionDebug.getSourceBoneWorldPositions().find((bone) => bone.id === sourceBoneId) || null
    ), sourceSnapTarget.sourceBoneId)
    : null;
  const snapTarget = liveSourceSnapTarget?.position ? {
    sourceBoneId: sourceSnapTarget.sourceBoneId,
    position: liveSourceSnapTarget.position,
  } : sourceSnapTarget;
  if (snapTarget?.sourceBoneId && snapTarget?.position) {
    await executeCommandAndExpect("set_joint_position", {
      joint: "L_Hand",
      position: snapTarget.position,
    }, (state) => state.skeleton === "Humanoid_v1");
    const snappedState = await page.evaluate(() => window.__motionDebug.getMotionState());
    const snappedJoint = snappedState.joints.find((joint) => joint.name === "L_Hand");
    const restJoint = snappedState.skeleton?.rest_joints?.find((joint) => joint.name === "L_Hand");
    record("assignment keypoint dropped on source bone records mapping", (
      snappedState.humanoid_mapping?.L_Hand === snapTarget.sourceBoneId
      && snappedJoint?.source_bone_id === snapTarget.sourceBoneId
      && vecDistance(restJoint?.position || [0, 0, 0], snapTarget.position) < 0.001
    ), {
      sourceSnapTarget: snapTarget,
      mapped: snappedState.humanoid_mapping?.L_Hand,
      snappedJoint,
      restJoint,
    });
  } else {
    record("assignment keypoint dropped on source bone records mapping", false, { sourceSnapTarget: snapTarget });
  }

  await executeCommandAndExpect("export_binding_preset", {}, (state) => state.current_stage === "export");
  const bindingPresetText = await page.evaluate(() => window.__motionDebug.getExportedJson());
  const bindingPreset = JSON.parse(bindingPresetText);
  record("binding preset export contains fitted rest skeleton", (
    bindingPreset.schema === "humanoid_binding_preset_v1"
    && bindingPreset.skeleton?.rest_joints?.length === 19
    && bindingPreset.humanoid_mapping?.L_Hand === snapTarget?.sourceBoneId
  ), {
    schema: bindingPreset.schema,
    mappedLHand: bindingPreset.humanoid_mapping?.L_Hand,
    restJointCount: bindingPreset.skeleton?.rest_joints?.length,
  });
  await page.evaluate(() => {
    const state = window.__motionDebug.MotionState;
    state.humanoid_mapping = {};
    state.skeleton = null;
    state.joints = [];
    state.bones = [];
    state.ik_controls = [];
    state.keyframes = [];
  });
  await executeCommandAndExpect("import_binding_preset", { json: bindingPresetText }, (state) => (
    state.skeleton === "Humanoid_v1"
    && state.joints === 19
    && state.current_stage === "skeleton"
  ));
  const importedPresetState = await page.evaluate(() => window.__motionDebug.getMotionState());
  const importedPresetRest = importedPresetState.skeleton?.rest_joints?.find((joint) => joint.name === "L_Hand");
  record("binding preset import restores mapping and rest pose", (
    importedPresetState.humanoid_mapping?.L_Hand === snapTarget?.sourceBoneId
    && vecDistance(importedPresetRest?.position || [0, 0, 0], snapTarget?.position || [0, 0, 0]) < 0.001
  ), {
    mappedLHand: importedPresetState.humanoid_mapping?.L_Hand,
    expectedLHand: snapTarget?.sourceBoneId,
    importedPresetRest,
  });

  await executeCommandAndExpect("create_ik_controls", { solve_mode: "hybrid" }, (state) => (
    state.skeleton === "Humanoid_v1"
    && state.ik_controls === 14
    && state.joint_controls === 19
    && state.visible_joint_debug_controls === true
  ));
}

async function ensureDom(label, fn) {
  const result = await fn();
  record(label, result.pass, result);
}

async function ensureTimelineToolDisabledState(expected) {
  const state = await page.evaluate(() => ({
    prev: Boolean(document.querySelector("#timelinePrevKeyButton")?.disabled),
    next: Boolean(document.querySelector("#timelineNextKeyButton")?.disabled),
    deleteCurrent: Boolean(document.querySelector("#timelineDeleteFrameButton")?.disabled),
    paste: Boolean(document.querySelector("#timelinePasteFrameButton")?.disabled),
  }));
  const pass = Object.entries(expected).every(([key, value]) => state[key] === value);
  record("timeline tools disabled state matches context", pass, { expected, state });
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

function walkArmChainsStayOnOwnSides(payload) {
  const frames = payload.keyframes || [];
  if (frames.length === 0) {
    return false;
  }
  return frames.every((frame) => {
    const joints = new Map((frame.joints || []).map((joint) => [joint.name, joint.position]));
    const rightShoulder = joints.get("R_UpperArm");
    const leftShoulder = joints.get("L_UpperArm");
    const rightForearm = joints.get("R_Forearm");
    const leftForearm = joints.get("L_Forearm");
    const rightHand = joints.get("R_Hand");
    const leftHand = joints.get("L_Hand");
    if (!rightShoulder || !leftShoulder || !rightForearm || !leftForearm || !rightHand || !leftHand) {
      return false;
    }
    const center = scaleVec(addPlainVec(rightShoulder, leftShoulder), 0.5);
    const sideAxis = normalizePlainVec(subPlainVec(rightShoulder, leftShoulder));
    return dotPlainVec(subPlainVec(rightForearm, center), sideAxis) > 0.01
      && dotPlainVec(subPlainVec(rightHand, center), sideAxis) > 0.01
      && dotPlainVec(subPlainVec(leftForearm, center), sideAxis) < -0.01
      && dotPlainVec(subPlainVec(leftHand, center), sideAxis) < -0.01;
  });
}

function idleTemplateArmsAreRelaxed(payload) {
  const diagnostics = getIdleTemplateArmDiagnostics(payload);
  return diagnostics.length > 0 && diagnostics.every((item) => (
    item.wristVsChest < 0.06
    && item.upperArmDownAngle < 68
  ));
}

function getIdleTemplateArmDiagnostics(payload) {
  return (payload.keyframes || []).flatMap((frame) => {
    const joints = new Map((frame.joints || []).map((joint) => [joint.name, joint.position]));
    const chest = joints.get("Chest") || joints.get("Spine") || joints.get("Hips");
    if (!chest) {
      return [{ frame: frame.timeline_frame, side: "-", reason: "missing chest" }];
    }
    return ["R", "L"].map((side) => {
      const shoulder = joints.get(`${side}_UpperArm`);
      const elbow = joints.get(`${side}_Forearm`);
      const wrist = joints.get(`${side}_Hand`);
      if (!shoulder || !elbow || !wrist) {
        return { frame: frame.timeline_frame, side, reason: "missing arm joints" };
      }
      return {
        frame: frame.timeline_frame,
        side,
        wristVsChest: Number(wrist[1]) - Number(chest[1]),
        upperArmDownAngle: angleBetweenPlainVec(subPlainVec(elbow, shoulder), [0, -1, 0]),
      };
    });
  });
}

function controlRotationIsNeutral(control) {
  return Boolean(control) && (control.rotation || []).every((value) => Math.abs(Number(value)) < 0.0001);
}

function sourceRigHandsStayOnOwnSides(debugPayload) {
  const mapped = debugPayload?.mapped || {};
  const rightShoulder = mapped.R_UpperArm?.current_world_position;
  const leftShoulder = mapped.L_UpperArm?.current_world_position;
  const rightHand = mapped.R_Hand?.current_world_position;
  const leftHand = mapped.L_Hand?.current_world_position;
  if (!rightShoulder || !leftShoulder || !rightHand || !leftHand) {
    return false;
  }
  const center = scaleVec(addPlainVec(rightShoulder, leftShoulder), 0.5);
  const sideAxis = normalizePlainVec(subPlainVec(rightShoulder, leftShoulder));
  return dotPlainVec(subPlainVec(rightHand, center), sideAxis) > 0.02
    && dotPlainVec(subPlainVec(leftHand, center), sideAxis) < -0.02;
}

function compareWalkArmOffsets(referenceState, candidateState) {
  const referenceFrames = new Map((referenceState.keyframes || []).map((frame) => [frame.timeline_frame, frame]));
  const candidateFrames = candidateState.keyframes || [];
  const deltas = [];
  for (const candidateFrame of candidateFrames) {
    const referenceFrame = referenceFrames.get(candidateFrame.timeline_frame);
    if (!referenceFrame) {
      deltas.push({ frame: candidateFrame.timeline_frame, missingReference: true, delta: Infinity });
      continue;
    }
    for (const side of ["R", "L"]) {
      for (const targetName of [`${side}_Forearm`, `${side}_Hand`, `${side}_Hand_IK`, `${side}_Elbow_Pole`]) {
        const referenceOffset = getArmOffset(referenceFrame, side, targetName);
        const candidateOffset = getArmOffset(candidateFrame, side, targetName);
        const delta = referenceOffset && candidateOffset ? vecDistance(referenceOffset, candidateOffset) : Infinity;
        deltas.push({ frame: candidateFrame.timeline_frame, side, targetName, delta });
      }
    }
  }
  const maxDelta = Math.max(0, ...deltas.map((item) => item.delta));
  return {
    pass: candidateFrames.length === 8 && maxDelta < 0.015,
    maxDelta,
    worst: [...deltas].sort((a, b) => b.delta - a.delta).slice(0, 6),
  };
}

function getArmOffset(frame, side, targetName) {
  const joints = new Map((frame.joints || []).map((joint) => [joint.name, joint.position]));
  const controls = new Map((frame.ik_controls || []).map((control) => [control.id, control.position]));
  const shoulder = joints.get(`${side}_UpperArm`);
  const target = joints.get(targetName) || controls.get(targetName);
  return shoulder && target ? subPlainVec(target, shoulder) : null;
}

function walkTemplateDoesNotWriteWristRotations(payload) {
  const frames = payload.keyframes || [];
  return frames.length > 0 && getWristRotationFrames(payload).length === 0;
}

function getWristRotationFrames(payload) {
  return (payload.keyframes || [])
    .filter((frame) => {
      const rotations = frame.joint_rotations || {};
      return Object.prototype.hasOwnProperty.call(rotations, "R_Hand")
        || Object.prototype.hasOwnProperty.call(rotations, "L_Hand");
    })
    .map((frame) => frame.timeline_frame);
}

function walkElbowPolesStayOutside(payload) {
  const frames = payload.keyframes || [];
  return frames.length > 0 && getBadElbowPoleFrames(payload).length === 0;
}

function getBadElbowPoleFrames(payload) {
  return (payload.keyframes || [])
    .filter((frame) => {
      const joints = new Map((frame.joints || []).map((joint) => [joint.name, joint.position]));
      const controls = new Map((frame.ik_controls || []).map((control) => [control.id, control.position]));
      const rightShoulder = joints.get("R_UpperArm");
      const leftShoulder = joints.get("L_UpperArm");
      const chest = joints.get("Chest");
      const rightPole = controls.get("R_Elbow_Pole");
      const leftPole = controls.get("L_Elbow_Pole");
      if (!rightShoulder || !leftShoulder || !chest || !rightPole || !leftPole) {
        return true;
      }
      const sideAxis = normalizePlainVec(subPlainVec(rightShoulder, leftShoulder));
      const rightShoulderSide = dotPlainVec(subPlainVec(rightShoulder, chest), sideAxis);
      const leftShoulderSide = dotPlainVec(subPlainVec(leftShoulder, chest), sideAxis);
      const rightPoleSide = dotPlainVec(subPlainVec(rightPole, chest), sideAxis);
      const leftPoleSide = dotPlainVec(subPlainVec(leftPole, chest), sideAxis);
      return rightPoleSide <= rightShoulderSide + 0.02 || leftPoleSide >= leftShoulderSide - 0.02;
    })
    .map((frame) => frame.timeline_frame);
}

function walkElbowsAvoidForwardFold(payload) {
  const frames = payload.keyframes || [];
  return frames.length > 0 && getForwardBentElbowFrames(payload).length === 0;
}

function getForwardBentElbowFrames(payload) {
  return (payload.keyframes || [])
    .flatMap((frame) => {
      const joints = new Map((frame.joints || []).map((joint) => [joint.name, joint.position]));
      const forward = getFrameForwardAxis(joints);
      return ["R", "L"].map((side) => {
        const shoulder = joints.get(`${side}_UpperArm`);
        const elbow = joints.get(`${side}_Forearm`);
        const hand = joints.get(`${side}_Hand`);
        if (!shoulder || !elbow || !hand) {
          return { frame: frame.timeline_frame, side, reason: "missing arm joints" };
        }
        const armLength = Math.max(0.001, vecDistance(shoulder, hand));
        const forwardLimit = Math.max(0.018, armLength * 0.08);
        const elbowForward = dotPlainVec(subPlainVec(elbow, shoulder), forward);
        return elbowForward <= forwardLimit
          ? null
          : { frame: frame.timeline_frame, side, elbowForward, forwardLimit };
      }).filter(Boolean);
    });
}

function getFrameForwardAxis(joints) {
  const forward = [0, 0, 0];
  for (const side of ["R", "L"]) {
    const foot = joints.get(`${side}_Foot`);
    const toe = joints.get(`${side}_Toe`);
    if (!foot || !toe) {
      continue;
    }
    const toeDelta = subPlainVec(toe, foot);
    toeDelta[1] = 0;
    const normalized = normalizePlainVec(toeDelta);
    forward[0] += normalized[0];
    forward[1] += normalized[1];
    forward[2] += normalized[2];
  }
  forward[1] = 0;
  return normalizePlainVec(forward);
}

function sourceRigRestMatchesCurrent(debugPayload) {
  const mapped = debugPayload?.mapped || {};
  const joints = ["Hips", "Spine", "Chest", "Head", "R_Hand", "L_Hand", "R_Foot", "L_Foot"]
    .filter((name) => mapped[name]?.rest_world_position && mapped[name]?.current_world_position);
  if (joints.length < 6) {
    return false;
  }
  return joints.every((name) => vecDistance(mapped[name].rest_world_position, mapped[name].current_world_position) < 0.001);
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

function rotateY(vector, degrees) {
  const radians = (normalizeDegrees(degrees) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = Number(vector[0]);
  const y = Number(vector[1]);
  const z = Number(vector[2]);
  return [
    x * cos + z * sin,
    y,
    -x * sin + z * cos,
  ];
}

function normalizeDegrees(value) {
  let degrees = Number(value) || 0;
  while (degrees > 180) degrees -= 360;
  while (degrees < -180) degrees += 360;
  return degrees;
}

function angleAlmostEqual(a, b, epsilon = 0.001) {
  return Math.abs(normalizeDegrees(Number(a) - Number(b))) < epsilon;
}

function vecDistance(a, b) {
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1]), Number(a[2]) - Number(b[2]));
}

function vectorAlmostEqual(a, b, epsilon = 0.001) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length
    && a.every((value, index) => Math.abs(Number(value) - Number(b[index])) <= epsilon);
}

function parseRgb(color) {
  const match = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return match ? match.slice(1, 4).map(Number) : [0, 0, 0];
}

function rgbLooksGreen(color) {
  const [red, green, blue] = parseRgb(color);
  return green > red + 50 && green > blue + 20;
}

function rgbLooksYellow(color) {
  const [red, green, blue] = parseRgb(color);
  return red > 200 && green > 160 && blue < 120;
}

function jointPositionDelta(beforeState, afterState, jointName) {
  const before = (beforeState.joints || []).find((joint) => joint.name === jointName)?.position;
  const after = (afterState.joints || []).find((joint) => joint.name === jointName)?.position;
  return before && after ? vecDistance(before, after) : 0;
}

function getJointY(state, jointName) {
  return Number((state.joints || []).find((joint) => joint.name === jointName)?.position?.[1] || 0);
}

function getJointPosition(state, jointName) {
  return (state.joints || []).find((joint) => joint.name === jointName)?.position || [0, 0, 0];
}

function getControlPosition(state, controlId) {
  return (state.ik_controls || []).find((control) => control.id === controlId)?.position || [0, 0, 0];
}

function getControlRotation(state, controlId) {
  return (state.ik_controls || []).find((control) => control.id === controlId)?.rotation || [0, 0, 0];
}

function getControlScale(state, controlId) {
  return (state.ik_controls || []).find((control) => control.id === controlId)?.scale || [1, 1, 1];
}

function reflectAcrossHipsSidePlane(position, hipsPosition) {
  return [
    Number(hipsPosition[0]) * 2 - Number(position[0]),
    Number(position[1]),
    Number(position[2]),
  ];
}

function distancePlainVec(a, b) {
  return vecDistance(a, b);
}

function controlJointDistance(state, controlId) {
  const control = (state.ik_controls || []).find((item) => item.id === controlId);
  const joint = control ? (state.joints || []).find((item) => item.name === control.target_joint) : null;
  return control?.position && joint?.position ? vecDistance(control.position, joint.position) : Infinity;
}

function getEndpointControlDeltas(state) {
  return Object.fromEntries(
    ["R_Foot_IK", "L_Foot_IK", "R_Hand_IK", "L_Hand_IK"].map((controlId) => [
      controlId,
      controlJointDistance(state, controlId),
    ]),
  );
}

function dotPlainVec(a, b) {
  return Number(a[0]) * Number(b[0]) + Number(a[1]) * Number(b[1]) + Number(a[2]) * Number(b[2]);
}

function normalizePlainVec(vector) {
  const length = Math.hypot(Number(vector[0]), Number(vector[1]), Number(vector[2]));
  return length > 0.0001 ? vector.map((value) => Number(value) / length) : [1, 0, 0];
}

function angleBetweenPlainVec(a, b) {
  const av = normalizePlainVec(a);
  const bv = normalizePlainVec(b);
  const dot = Math.max(-1, Math.min(1, dotPlainVec(av, bv)));
  return (Math.acos(dot) * 180) / Math.PI;
}

function quaternionDelta(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 4 || b.length !== 4) {
    return 0;
  }
  const dot = Math.abs(a.reduce((sum, value, index) => sum + Number(value) * Number(b[index]), 0));
  return 1 - Math.min(1, dot);
}

function sourceRigTransformsStable(before, after) {
  const beforeMapped = before?.mapped || {};
  const afterMapped = after?.mapped || {};
  const entries = Object.keys(beforeMapped)
    .filter((jointName) => beforeMapped[jointName]?.current_world_position && afterMapped[jointName]?.current_world_position);
  const deltas = entries.map((jointName) => {
    const positionDelta = vecDistance(
      beforeMapped[jointName].current_world_position,
      afterMapped[jointName].current_world_position,
    );
    const rotationDelta = quaternionDelta(
      beforeMapped[jointName].current_world_quaternion,
      afterMapped[jointName].current_world_quaternion,
    );
    return { jointName, positionDelta, rotationDelta };
  });
  const maxPositionDelta = Math.max(0, ...deltas.map((item) => item.positionDelta));
  const maxRotationDelta = Math.max(0, ...deltas.map((item) => item.rotationDelta));
  return {
    pass: entries.length >= 10 && maxPositionDelta < 0.001 && maxRotationDelta < 0.001,
    checked: entries.length,
    maxPositionDelta,
    maxRotationDelta,
    worst: [...deltas].sort((a, b) => (
      Math.max(b.positionDelta, b.rotationDelta) - Math.max(a.positionDelta, a.rotationDelta)
    )).slice(0, 6),
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "_");
}
