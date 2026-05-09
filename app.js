import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const canvas = document.querySelector("#rigCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101720);

const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 120);
const cameraTarget = new THREE.Vector3(0, 1.15, 0);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let yaw = -0.55;
let pitch = 0.18;
let cameraDistance = 5.1;

const root = new THREE.Group();
const modelGroup = new THREE.Group();
const sourceSkeletonGroup = new THREE.Group();
const skeletonGroup = new THREE.Group();
const ikGroup = new THREE.Group();
const gizmoGroup = new THREE.Group();
const pathGroup = new THREE.Group();
const directionGroup = new THREE.Group();
const worldAxesGroup = new THREE.Group();
const labelGroup = new THREE.Group();
const validationGroup = new THREE.Group();
scene.add(root);
root.add(modelGroup, sourceSkeletonGroup, skeletonGroup, ikGroup, gizmoGroup, pathGroup, directionGroup, worldAxesGroup, labelGroup, validationGroup);

const hemi = new THREE.HemisphereLight(0xffffff, 0x2a3442, 1.55);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

const grid = new THREE.GridHelper(8, 32, 0x38506a, 0x223142);
grid.material.transparent = true;
grid.material.opacity = 0.72;
root.add(grid);

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshBasicMaterial({ color: 0x141e2a, transparent: true, opacity: 0.24, side: THREE.DoubleSide }),
);
groundPlane.rotation.x = -Math.PI / 2;
root.add(groundPlane);

const COLORS = {
  center: "#55e38d",
  right: "#ff9b4a",
  left: "#4fc3ff",
  neutral: "#d8e5f5",
  issue: "#ff6b6b",
  path: "#b894ff",
  warn: "#ffc84a",
};

const HUMANOID_JOINT_NAMES = [
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "R_UpperArm",
  "R_Forearm",
  "R_Hand",
  "L_UpperArm",
  "L_Forearm",
  "L_Hand",
  "R_UpperLeg",
  "R_LowerLeg",
  "R_Foot",
  "R_Toe",
  "L_UpperLeg",
  "L_LowerLeg",
  "L_Foot",
  "L_Toe",
];

const OPTIONAL_HUMANOID_MAPPING_JOINTS = new Set(["R_Toe", "L_Toe"]);
const EXPLICIT_ROTATION_JOINTS = new Set(["Hips", "Spine", "Chest", "Neck", "Head"]);

const HUMANOID_BONE_CONNECTIONS = [
  ["Hips", "Spine"],
  ["Spine", "Chest"],
  ["Chest", "Neck"],
  ["Neck", "Head"],
  ["Chest", "R_UpperArm"],
  ["R_UpperArm", "R_Forearm"],
  ["R_Forearm", "R_Hand"],
  ["Chest", "L_UpperArm"],
  ["L_UpperArm", "L_Forearm"],
  ["L_Forearm", "L_Hand"],
  ["Hips", "R_UpperLeg"],
  ["R_UpperLeg", "R_LowerLeg"],
  ["R_LowerLeg", "R_Foot"],
  ["R_Foot", "R_Toe"],
  ["Hips", "L_UpperLeg"],
  ["L_UpperLeg", "L_LowerLeg"],
  ["L_LowerLeg", "L_Foot"],
  ["L_Foot", "L_Toe"],
];

const HUMANOID_REST_POSITIONS = {
  Hips: [0, 1.0, 0],
  Spine: [0, 1.22, 0],
  Chest: [0, 1.48, 0],
  Neck: [0, 1.67, 0],
  Head: [0, 1.88, 0],
  R_UpperArm: [0.28, 1.47, 0],
  R_Forearm: [0.57, 1.36, 0.02],
  R_Hand: [0.82, 1.25, 0.03],
  L_UpperArm: [-0.28, 1.47, 0],
  L_Forearm: [-0.57, 1.36, 0.02],
  L_Hand: [-0.82, 1.25, 0.03],
  R_UpperLeg: [0.16, 0.95, 0],
  R_LowerLeg: [0.16, 0.52, 0.03],
  R_Foot: [0.16, 0.08, 0.12],
  R_Toe: [0.16, 0.06, 0.36],
  L_UpperLeg: [-0.16, 0.95, 0],
  L_LowerLeg: [-0.16, 0.52, 0.03],
  L_Foot: [-0.16, 0.08, 0.12],
  L_Toe: [-0.16, 0.06, 0.36],
};

const HUMANOID_MAPPING_ALIASES = {
  Hips: ["hips", "pelvis", "hip"],
  Spine: ["spine", "spine1", "spine01"],
  Chest: ["chest", "spine2", "spine02", "upperchest"],
  Neck: ["neck"],
  Head: ["head"],
  R_UpperArm: ["rightarm", "rightupperarm", "upperarmr", "rupperarm", "rarm"],
  R_Forearm: ["rightforearm", "rightlowerarm", "forearmr", "lowerarmr", "rforearm"],
  R_Hand: ["righthand", "handr", "rhand"],
  L_UpperArm: ["leftarm", "leftupperarm", "upperarml", "lupperarm", "larm"],
  L_Forearm: ["leftforearm", "leftlowerarm", "forearml", "lowerarml", "lforearm"],
  L_Hand: ["lefthand", "handl", "lhand"],
  R_UpperLeg: ["rightupleg", "rightupperleg", "rightthigh", "upperlegr", "rthigh"],
  R_LowerLeg: ["rightleg", "rightlowerleg", "rightcalf", "lowerlegr", "rcalf"],
  R_Foot: ["rightfoot", "footr", "rfoot"],
  R_Toe: ["righttoe", "righttoebase", "toer", "rtoe"],
  L_UpperLeg: ["leftupleg", "leftupperleg", "leftthigh", "upperlegl", "lthigh"],
  L_LowerLeg: ["leftleg", "leftlowerleg", "leftcalf", "lowerlegl", "lcalf"],
  L_Foot: ["leftfoot", "footl", "lfoot"],
  L_Toe: ["lefttoe", "lefttoebase", "toel", "ltoe"],
};

const CORE_IK_CONTROL_DEFS = [
  { id: "Global_CTRL", type: "global", joint: "Hips", side: "Center", allow_scale: true },
  { id: "Root_CTRL", type: "root", joint: "Hips", side: "Center", allow_scale: true },
  { id: "COG_CTRL", type: "cog", joint: "Hips", side: "Center" },
  { id: "Pelvis_CTRL", type: "pelvis", joint: "Hips", side: "Center" },
  { id: "Chest_CTRL", type: "chest", joint: "Chest", side: "Center" },
  { id: "Head_CTRL", type: "head", joint: "Head", side: "Center" },
  { id: "R_Foot_IK", type: "foot", joint: "R_Foot", side: "R" },
  { id: "L_Foot_IK", type: "foot", joint: "L_Foot", side: "L" },
  { id: "R_Hand_IK", type: "hand", joint: "R_Hand", side: "R" },
  { id: "L_Hand_IK", type: "hand", joint: "L_Hand", side: "L" },
  { id: "R_Knee_Pole", type: "pole", joint: "R_LowerLeg", side: "R", offset: [0, 0.08, 0.42], pole_forward_sign: 1 },
  { id: "L_Knee_Pole", type: "pole", joint: "L_LowerLeg", side: "L", offset: [0, 0.08, 0.42], pole_forward_sign: 1 },
  { id: "R_Elbow_Pole", type: "pole", joint: "R_Forearm", side: "R", offset: [0.08, 0.05, -0.34], pole_forward_sign: -1 },
  { id: "L_Elbow_Pole", type: "pole", joint: "L_Forearm", side: "L", offset: [-0.08, 0.05, -0.34], pole_forward_sign: -1 },
];
const JOINT_CONTROL_DEFS = HUMANOID_JOINT_NAMES.map((joint) => ({
  id: `${joint}_CTRL`,
  type: "joint",
  joint,
  side: getSide(joint),
  is_joint_control: true,
}));
const IK_CONTROL_DEFS = [...CORE_IK_CONTROL_DEFS, ...JOINT_CONTROL_DEFS];
const CORE_IK_CONTROL_COUNT = CORE_IK_CONTROL_DEFS.length;

const WALK_KEY_POSES = [
  { index: 1, timeline_frame: 1, label: "CONTACT", params: { rFootZ: 0.20, lFootZ: -0.20, rHandZ: -0.12, lHandZ: 0.12, hipY: 0.00, lock: { R: true, L: true } } },
  { index: 2, timeline_frame: 4, label: "DOWN", params: { rFootZ: 0.12, lFootZ: -0.12, rHandZ: -0.05, lHandZ: 0.05, hipY: -0.05, lock: { R: false, L: false } } },
  { index: 3, timeline_frame: 7, label: "PASSING", params: { rFootZ: 0.00, lFootZ: 0.00, lFootY: 0.08, rHandZ: 0.03, lHandZ: -0.03, hipY: 0.00, lock: { R: false, L: false } } },
  { index: 4, timeline_frame: 10, label: "UP", params: { rFootZ: -0.12, lFootZ: 0.12, lFootY: 0.11, rHandZ: 0.08, lHandZ: -0.08, hipY: 0.04, lock: { R: false, L: false } } },
  { index: 5, timeline_frame: 13, label: "OPPOSITE CONTACT", params: { rFootZ: -0.20, lFootZ: 0.20, rHandZ: 0.12, lHandZ: -0.12, hipY: 0.00, lock: { R: true, L: true } } },
  { index: 6, timeline_frame: 16, label: "DOWN", params: { rFootZ: -0.12, lFootZ: 0.12, rHandZ: 0.05, lHandZ: -0.05, hipY: -0.05, lock: { R: false, L: false } } },
  { index: 7, timeline_frame: 19, label: "PASSING", params: { rFootZ: 0.00, lFootZ: 0.00, rFootY: 0.08, rHandZ: -0.03, lHandZ: 0.03, hipY: 0.00, lock: { R: false, L: false } } },
  { index: 8, timeline_frame: 22, label: "UP", params: { rFootZ: 0.12, lFootZ: -0.12, rFootY: 0.11, rHandZ: -0.08, lHandZ: 0.08, hipY: 0.04, lock: { R: false, L: false } } },
];

const COMMAND_SCHEMAS = {
  load_test_dummy: { type: "object", properties: {} },
  import_glb: { type: "object", properties: { file: { type: "File" } } },
  create_humanoid_skeleton: { type: "object", properties: { skeleton_id: { const: "Humanoid_v1" } } },
  assign_humanoid_mapping: { type: "object", properties: { joint: { type: "string" }, source_bone_id: { type: "string" } }, required: ["joint", "source_bone_id"] },
  set_character_direction: { type: "object", properties: { forward_sign: { enum: [1, -1] }, yaw_degrees: { type: "number" }, confirmed: { type: "boolean" } } },
  create_source_skeleton_from_import: { type: "object", properties: { mode: { const: "visual_overlay_tpose" } } },
  create_ik_controls: { type: "object", properties: { rig: { const: "Humanoid_v1" } } },
  apply_motion_template: { type: "object", properties: { template_id: { enum: ["walk_cycle_8f"] } }, required: ["template_id"] },
  set_control_transform: {
    type: "object",
    properties: {
      control_id: { type: "string" },
      transform_mode: { enum: ["translate", "rotate", "scale"] },
      space: { enum: ["local", "global"] },
      position: { type: "array", minItems: 3, maxItems: 3 },
      rotation: { type: "array", minItems: 3, maxItems: 3 },
      scale: { type: "array", minItems: 3, maxItems: 3 },
      frame: { type: "number" },
      insert_keyframe: { type: "boolean" },
    },
  },
  set_ik_target: { type: "object", properties: { control_id: { type: "string" }, position: { type: "array", minItems: 3, maxItems: 3 } } },
  set_joint_position: { type: "object", properties: { joint: { type: "string" }, position: { type: "array", minItems: 3, maxItems: 3 } } },
  rotate_joint_branch: { type: "object", properties: { joint: { type: "string" }, angle: { type: "number" }, axis: { type: "array", minItems: 3, maxItems: 3 } } },
  scale_joint_branch: { type: "object", properties: { joint: { type: "string" }, scale: { type: "number" } } },
  insert_keyframe: { type: "object", properties: { frame: { type: "number" } } },
  smooth_keyframes_between: { type: "object", properties: { from_frame: { type: "number" }, to_frame: { type: "number" } } },
  validate_motion: { type: "object", properties: {} },
  export_motion_json: { type: "object", properties: {} },
  import_motion_json: { type: "object", properties: { json: { type: "string" } } },
  undo: { type: "object", properties: {} },
  redo: { type: "object", properties: {} },
  play: { type: "object", properties: {} },
  stop: { type: "object", properties: {} },
  select_bone: { type: "object", properties: { bone: { type: "string" } } },
  select_source_bone: { type: "object", properties: { source_bone_id: { type: "string" } } },
  select_control: { type: "object", properties: { control: { type: "string" } } },
  set_loop: { type: "object", properties: { loop: { type: "boolean" } } },
  set_model_opacity: { type: "object", properties: { opacity: { type: "number" } } },
  set_skeleton_opacity: { type: "object", properties: { opacity: { type: "number" } } },
  set_control_opacity: { type: "object", properties: { opacity: { type: "number" } } },
  set_stage: { type: "object", properties: { stage: { enum: ["model", "skeleton", "mapping", "control_rig", "ik", "motion", "validate", "export"] } } },
  set_current_frame: { type: "object", properties: { frame: { type: "number" } } },
  set_view_option: { type: "object", properties: { key: { type: "string" }, value: { type: "boolean" } } },
  set_control_visual_size: { type: "object", properties: { size: { type: "number" } } },
  set_control_visual_thickness: { type: "object", properties: { thickness: { type: "number" } } },
  reset_view: { type: "object", properties: {} },
};

const MotionState = {
  model: { loaded: false, source: null, type: null, opacity: 0.72 },
  rest_pose: "T-Pose",
  source_bones: [],
  humanoid_mapping: {},
  direction: { forward_sign: 1, yaw_degrees: 0, confirmed: false },
  import_diagnostics: createEmptyImportDiagnostics(),
  visual_analysis: { status: "Not run", method: null, source_bones: 0, generated_joints: 0, generated_bones: 0, model_opacity: null },
  skeleton: null,
  bones: [],
  joints: [],
  joint_rotations: {},
  ik_controls: [],
  current_frame: 1,
  total_frames: 24,
  playback_fps: 24,
  keyframes: [],
  motion_templates: [{ id: "walk_cycle_8f", name: "Walk_8F Template", key_poses: 8 }],
  selected_bone: null,
  selected_source_bone_id: null,
  selected_control: null,
  transform: {
    tool: "select",
    space: "global",
    axis: null,
    snap: false,
    mirror: false,
  },
  command_log: [],
  undo_stack: [],
  redo_stack: [],
  validation_report: createEmptyValidationReport(),
  dirty_state: false,
  exported_json: "",
  visual_opacity: {
    skeleton: 0.28,
    controls: 0.32,
    control_size: 0.82,
    control_thickness: 0.72,
  },
  show: {
    model: true,
    deform_skeleton: true,
    control_rig: true,
    ik_controls: true,
    joint_debug_controls: false,
    labels: false,
    transform_gizmo: true,
    skeleton_labels: false,
    bone_colors: true,
    foot_locks: true,
    motion_paths: true,
    ground_plane: true,
    validation_issues: true,
  },
};

const Runtime = {
  stage: "model",
  isPlaying: false,
  loop: true,
  playStartedAt: 0,
  playStartFrame: 1,
  lastRenderedFrame: null,
  lastCommand: null,
  importedModelScene: null,
  sourceBoneById: new Map(),
  sourceBoneRestById: new Map(),
  draggingHumanoidJoint: null,
  draggingIkControlId: null,
  draggingIkPlane: null,
  draggingIkFinalPosition: null,
  ikDragStartSnapshot: null,
  draggingJointName: null,
  draggingJointPlane: null,
  draggingJointFinalPosition: null,
  jointDragStartSnapshot: null,
  pendingViewportDrag: null,
  transformMode: null,
  transformSubject: null,
  transformStartSnapshot: null,
  transformStartPointer: null,
  transformStartPoint: null,
  transformPlane: null,
  transformFinalValue: null,
  transformAxis: null,
  transformCurrentPointer: null,
  transformPointerDown: false,
  transformPointerMoved: false,
  transformPointerStart: null,
  transformPointerId: null,
  hoveredControlId: null,
  hoveredJointName: null,
  selectedTimelineFrames: [],
  dragging: false,
  navigationMode: null,
  navigationStartDistance: null,
  panning: false,
  lastPointer: { x: 0, y: 0 },
};

const el = {
  flowSteps: [...document.querySelectorAll(".flow-step")],
  toolButtons: [...document.querySelectorAll(".tool-button")],
  spaceToggleButton: document.querySelector("#spaceToggleButton"),
  snapToggleButton: document.querySelector("#snapToggleButton"),
  mirrorToggleButton: document.querySelector("#mirrorToggleButton"),
  panels: [...document.querySelectorAll(".inspector-section")],
  statusModel: document.querySelector("#statusModel"),
  statusSkeleton: document.querySelector("#statusSkeleton"),
  statusIk: document.querySelector("#statusIk"),
  statusKeyframes: document.querySelector("#statusKeyframes"),
  statusFrame: document.querySelector("#statusFrame"),
  statusDirty: document.querySelector("#statusDirty"),
  statusValidation: document.querySelector("#statusValidation"),
  timelineKeyframes: document.querySelector("#timelineKeyframes"),
  timelineKeyPoseCount: document.querySelector("#timelineKeyPoseCount"),
  timelineLoopState: document.querySelector("#timelineLoopState"),
  selectedBoneSelect: document.querySelector("#selectedBoneSelect"),
  selectedControlSelect: document.querySelector("#selectedControlSelect"),
  characterForwardValue: document.querySelector("#characterForwardValue"),
  forwardAngleInput: document.querySelector("#forwardAngleInput"),
  forwardAngleValue: document.querySelector("#forwardAngleValue"),
  sourceBoneCountValue: document.querySelector("#sourceBoneCountValue"),
  restPoseValue: document.querySelector("#restPoseValue"),
  mappingCountValue: document.querySelector("#mappingCountValue"),
  humanoidJointList: document.querySelector("#humanoidJointList"),
  sourceBoneList: document.querySelector("#sourceBoneList"),
  modelOpacityInput: document.querySelector("#modelOpacityInput"),
  modelOpacityValue: document.querySelector("#modelOpacityValue"),
  viewportModelOpacityInput: document.querySelector("#viewportModelOpacityInput"),
  viewportModelOpacityValue: document.querySelector("#viewportModelOpacityValue"),
  skeletonOpacityInput: document.querySelector("#skeletonOpacityInput"),
  skeletonOpacityValue: document.querySelector("#skeletonOpacityValue"),
  controlOpacityInput: document.querySelector("#controlOpacityInput"),
  controlOpacityValue: document.querySelector("#controlOpacityValue"),
  controlSizeInput: document.querySelector("#controlSizeInput"),
  controlSizeValue: document.querySelector("#controlSizeValue"),
  controlThicknessInput: document.querySelector("#controlThicknessInput"),
  controlThicknessValue: document.querySelector("#controlThicknessValue"),
  timelinePlayButton: document.querySelector("#timelinePlayButton"),
  timelineStopButton: document.querySelector("#timelineStopButton"),
  timelineSaveFrameButton: document.querySelector("#timelineSaveFrameButton"),
  timelineSmoothButton: document.querySelector("#timelineSmoothButton"),
  timelineFrameSlider: document.querySelector("#timelineFrameSlider"),
  timelineCurrentFrameValue: document.querySelector("#timelineCurrentFrameValue"),
  timelineFrameTicks: document.querySelector("#timelineFrameTicks"),
  ikTargetX: document.querySelector("#ikTargetX"),
  ikTargetY: document.querySelector("#ikTargetY"),
  ikTargetZ: document.querySelector("#ikTargetZ"),
  keyframeList: document.querySelector("#keyframeList"),
  motionJsonText: document.querySelector("#motionJsonText"),
  loopToggle: document.querySelector("#loopToggle"),
  validationSummary: document.querySelector("#validationSummary"),
  validationFootSliding: document.querySelector("#validationFootSliding"),
  validationKneeFlip: document.querySelector("#validationKneeFlip"),
  validationLoop: document.querySelector("#validationLoop"),
  validationIdentity: document.querySelector("#validationIdentity"),
  boneNameValue: document.querySelector("#boneNameValue"),
  boneParentValue: document.querySelector("#boneParentValue"),
  boneLengthValue: document.querySelector("#boneLengthValue"),
  boneSideValue: document.querySelector("#boneSideValue"),
  boneColorRuleValue: document.querySelector("#boneColorRuleValue"),
  debugLastCommand: document.querySelector("#debugLastCommand"),
  debugLastResult: document.querySelector("#debugLastResult"),
  debugLastError: document.querySelector("#debugLastError"),
  debugUndoCount: document.querySelector("#debugUndoCount"),
  debugRedoCount: document.querySelector("#debugRedoCount"),
  debugCommandLog: document.querySelector("#debugCommandLog"),
  debugStateSummary: document.querySelector("#debugStateSummary"),
  debugValidationReport: document.querySelector("#debugValidationReport"),
};

init();

function init() {
  bindUi();
  resize();
  updateCamera();
  renderAll();
  installDebugApi();
  requestAnimationFrame(animate);
}

function bindUi() {
  window.addEventListener("resize", resize);

  el.flowSteps.forEach((button) => {
    button.addEventListener("click", () => executeCommand(createCommand("set_stage", { stage: button.dataset.stage })));
  });
  el.toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTransformTool(button.dataset.tool));
  });
  el.spaceToggleButton?.addEventListener("click", () => {
    MotionState.transform.space = MotionState.transform.space === "local" ? "global" : "local";
    renderAll();
  });
  el.snapToggleButton?.addEventListener("click", () => {
    MotionState.transform.snap = !MotionState.transform.snap;
    renderAll();
  });
  el.mirrorToggleButton?.addEventListener("click", () => {
    MotionState.transform.mirror = !MotionState.transform.mirror;
    renderAll();
  });

  document.querySelector("#loadTestDummyButton").addEventListener("click", () => {
    executeCommand(createCommand("load_test_dummy"));
  });
  document.querySelector("#modelFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      executeCommand(createCommand("import_glb", { file }));
      event.target.value = "";
    }
  });
  document.querySelector("#createSkeletonButton").addEventListener("click", () => {
    executeCommand(createCommand("create_humanoid_skeleton"));
  });
  document.querySelector("#createSourceSkeletonButton").addEventListener("click", () => {
    executeCommand(createCommand("create_source_skeleton_from_import", { mode: "visual_overlay_tpose" }));
  });
  document.querySelector("#confirmForwardButton").addEventListener("click", () => {
    executeCommand(createCommand("set_character_direction", {
      forward_sign: MotionState.direction.forward_sign,
      yaw_degrees: MotionState.direction.yaw_degrees,
      confirmed: true,
    }));
  });
  document.querySelector("#flipForwardButton").addEventListener("click", () => {
    executeCommand(createCommand("set_character_direction", {
      forward_sign: MotionState.direction.forward_sign === 1 ? -1 : 1,
      yaw_degrees: MotionState.direction.yaw_degrees,
      confirmed: true,
    }));
  });
  document.querySelector("#rotateForwardLeftButton").addEventListener("click", () => {
    adjustForwardYaw(-15);
  });
  document.querySelector("#rotateForwardRightButton").addEventListener("click", () => {
    adjustForwardYaw(15);
  });
  el.forwardAngleInput.addEventListener("change", () => {
    executeCommand(createCommand("set_character_direction", {
      forward_sign: MotionState.direction.forward_sign,
      yaw_degrees: Number(el.forwardAngleInput.value),
      confirmed: false,
    }));
  });
  document.querySelector("#createIkButton").addEventListener("click", () => {
    executeCommand(createCommand("create_ik_controls"));
  });
  document.querySelector("#applyWalkButton").addEventListener("click", () => {
    executeCommand(createCommand("apply_motion_template", { template_id: "walk_cycle_8f" }));
  });
  document.querySelector("#setIkTargetButton").addEventListener("click", () => {
    const control = MotionState.ik_controls.find((item) => item.id === MotionState.selected_control);
    executeCommand(createCommand(control?.is_joint_control ? "set_ik_target" : "set_control_transform", {
      control_id: MotionState.selected_control,
      transform_mode: "translate",
      space: MotionState.transform.space,
      position: [Number(el.ikTargetX.value), Number(el.ikTargetY.value), Number(el.ikTargetZ.value)],
    }));
  });
  document.querySelector("#insertKeyframeButton").addEventListener("click", () => {
    executeCommand(createCommand("insert_keyframe", { frame: MotionState.current_frame }));
  });
  document.querySelector("#smoothKeyframesButton").addEventListener("click", () => {
    executeCommand(createCommand("smooth_keyframes_between", getCurrentSmoothFrameRange()));
  });
  document.querySelector("#validateMotionButton").addEventListener("click", () => {
    executeCommand(createCommand("validate_motion"));
  });
  document.querySelector("#exportJsonButton").addEventListener("click", () => {
    executeCommand(createCommand("export_motion_json"));
  });
  document.querySelector("#importJsonButton").addEventListener("click", () => {
    executeCommand(createCommand("import_motion_json", { json: el.motionJsonText.value }));
  });
  document.querySelector("#undoButton").addEventListener("click", () => {
    executeCommand(createCommand("undo"));
  });
  document.querySelector("#redoButton").addEventListener("click", () => {
    executeCommand(createCommand("redo"));
  });
  document.querySelector("#playButton").addEventListener("click", () => {
    executeCommand(createCommand("play"));
  });
  document.querySelector("#stopButton").addEventListener("click", () => {
    executeCommand(createCommand("stop"));
  });
  el.timelinePlayButton.addEventListener("click", () => {
    executeCommand(createCommand("play"));
  });
  el.timelineStopButton.addEventListener("click", () => {
    executeCommand(createCommand("stop"));
  });
  el.timelineSaveFrameButton.addEventListener("click", () => {
    executeCommand(createCommand("insert_keyframe", { frame: MotionState.current_frame }));
  });
  el.timelineSmoothButton.addEventListener("click", () => {
    executeCommand(createCommand("smooth_keyframes_between", getCurrentSmoothFrameRange()));
  });
  el.timelineFrameSlider.addEventListener("input", () => {
    executeCommand(createCommand("set_current_frame", { frame: Number(el.timelineFrameSlider.value) }));
  });
  document.querySelector("#resetViewButton").addEventListener("click", () => {
    executeCommand(createCommand("reset_view"));
  });

  el.selectedBoneSelect.addEventListener("change", () => {
    if (MotionState.bones.length > 0) {
      executeCommand(createCommand("select_bone", { bone: el.selectedBoneSelect.value }));
    } else if (MotionState.source_bones.length > 0) {
      executeCommand(createCommand("select_source_bone", { source_bone_id: el.selectedBoneSelect.value }));
    }
  });
  el.humanoidJointList.addEventListener("dragstart", (event) => {
    const chip = event.target.closest("[data-humanoid-joint]");
    if (!chip) return;
    Runtime.draggingHumanoidJoint = chip.dataset.humanoidJoint;
    event.dataTransfer.setData("text/plain", Runtime.draggingHumanoidJoint);
    event.dataTransfer.effectAllowed = "copy";
  });
  el.humanoidJointList.addEventListener("dragend", () => {
    Runtime.draggingHumanoidJoint = null;
    el.sourceBoneList.querySelectorAll(".is-drop-target").forEach((row) => row.classList.remove("is-drop-target"));
  });
  el.sourceBoneList.addEventListener("dragover", (event) => {
    const row = event.target.closest("[data-source-bone-id]");
    if (!row || !Runtime.draggingHumanoidJoint) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    row.classList.add("is-drop-target");
  });
  el.sourceBoneList.addEventListener("dragleave", (event) => {
    const row = event.target.closest("[data-source-bone-id]");
    if (row) row.classList.remove("is-drop-target");
  });
  el.sourceBoneList.addEventListener("drop", (event) => {
    const row = event.target.closest("[data-source-bone-id]");
    if (!row) return;
    event.preventDefault();
    row.classList.remove("is-drop-target");
    const joint = event.dataTransfer.getData("text/plain") || Runtime.draggingHumanoidJoint;
    executeCommand(createCommand("assign_humanoid_mapping", {
      joint,
      source_bone_id: row.dataset.sourceBoneId,
    }));
  });
  el.selectedControlSelect.addEventListener("change", () => {
    executeCommand(createCommand("select_control", { control: el.selectedControlSelect.value }));
  });
  el.loopToggle.addEventListener("change", () => {
    executeCommand(createCommand("set_loop", { loop: el.loopToggle.checked }));
  });
  el.modelOpacityInput.addEventListener("input", () => {
    executeCommand(createCommand("set_model_opacity", { opacity: Number(el.modelOpacityInput.value) }));
  });
  el.viewportModelOpacityInput.addEventListener("input", () => {
    executeCommand(createCommand("set_model_opacity", { opacity: Number(el.viewportModelOpacityInput.value) }));
  });
  el.skeletonOpacityInput.addEventListener("input", () => {
    executeCommand(createCommand("set_skeleton_opacity", { opacity: Number(el.skeletonOpacityInput.value) }));
  });
  el.controlOpacityInput.addEventListener("input", () => {
    executeCommand(createCommand("set_control_opacity", { opacity: Number(el.controlOpacityInput.value) }));
  });
  el.controlSizeInput?.addEventListener("input", () => {
    executeCommand(createCommand("set_control_visual_size", { size: Number(el.controlSizeInput.value) }));
  });
  el.controlThicknessInput?.addEventListener("input", () => {
    executeCommand(createCommand("set_control_visual_thickness", { thickness: Number(el.controlThicknessInput.value) }));
  });

  [
    ["#showModel", "model"],
    ["#showDeformSkeleton", "deform_skeleton"],
    ["#showControlRig", "control_rig"],
    ["#showIkControls", "ik_controls"],
    ["#showJointDebugControls", "joint_debug_controls"],
    ["#showLabels", "labels"],
    ["#showTransformGizmo", "transform_gizmo"],
    ["#showFootLocks", "foot_locks"],
    ["#showMotionPaths", "motion_paths"],
    ["#showGroundPlane", "ground_plane"],
    ["#showValidationIssues", "validation_issues"],
  ].forEach(([selector, key]) => {
    document.querySelector(selector).addEventListener("change", (event) => {
      executeCommand(createCommand("set_view_option", { key, value: event.target.checked }));
    });
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function adjustForwardYaw(deltaDegrees) {
  executeCommand(createCommand("set_character_direction", {
    forward_sign: MotionState.direction.forward_sign,
    yaw_degrees: normalizeForwardYaw((MotionState.direction.yaw_degrees || 0) + deltaDegrees),
    confirmed: false,
  }));
}

function setTransformTool(tool) {
  const nextTool = ["select", "translate", "rotate", "scale"].includes(tool) ? tool : "select";
  MotionState.transform.tool = nextTool;
  MotionState.transform.axis = null;
  renderAll();
}

function createCommand(name, args = {}, options = {}) {
  return {
    name,
    args,
    args_schema: COMMAND_SCHEMAS[name] || { type: "object", properties: {} },
    dry_run: Boolean(options.dry_run),
    execute: COMMAND_EXECUTORS[name] || null,
    undo: async () => {},
    result: null,
    error: null,
  };
}

function normalizeVec3(value, fallback = [0, 0, 0], min = -Infinity, max = Infinity) {
  const source = Array.isArray(value) && value.length === 3 ? value : fallback;
  return source.map((item, index) => {
    const number = Number(item);
    const safe = Number.isFinite(number) ? number : Number(fallback[index] || 0);
    return Math.max(min, Math.min(max, safe));
  });
}

function upsertManualKeyframe(frame) {
  const targetFrame = clampFrame(Number(frame) || MotionState.current_frame);
  const poseIndex = Math.max(1, Math.min(8, Math.round(((targetFrame - 1) / MotionState.total_frames) * 8) + 1));
  const keyframe = {
    pose_index: poseIndex,
    timeline_frame: targetFrame,
    label: "MANUAL",
    joints: deepClone(MotionState.joints),
    joint_rotations: deepClone(MotionState.joint_rotations),
    ik_controls: deepClone(MotionState.ik_controls),
    foot_locks: inferFootLocksFromControls(),
    interpolation: "linear",
  };
  MotionState.keyframes = MotionState.keyframes.filter((item) => item.timeline_frame !== targetFrame);
  MotionState.keyframes.push(keyframe);
  MotionState.keyframes.sort((a, b) => a.timeline_frame - b.timeline_frame);
  markTimelineFrameSelected(targetFrame);
  return targetFrame;
}

async function executeCommand(command) {
  if (!command?.name) {
    throw new Error("executeCommand 需要带 name 的命令对象");
  }
  if (!command.execute) {
    command.execute = COMMAND_EXECUTORS[command.name];
  }
  if (!command.execute) {
    command.error = `未知命令：${command.name}`;
    logCommand(command, "error");
    renderAll();
    return command;
  }

  const isStackCommand = command.name === "undo" || command.name === "redo";
  const before = !isStackCommand && isUndoableCommand(command.name) ? snapshotCoreState() : null;

  try {
    if (command.dry_run) {
      command.result = { status: "dry_run", result: `将执行 ${command.name}` };
    } else {
      command.result = await command.execute(command.args || {});
    }
    command.error = null;
    if (before && !command.dry_run) {
      const after = snapshotCoreState();
      command.undo = async () => restoreCoreState(before);
      MotionState.undo_stack.push({
        name: command.name,
        args: sanitizeArgs(command.args || {}),
        before,
        after,
        result: command.result,
      });
      MotionState.redo_stack = [];
    }
    logCommand(command, "success");
  } catch (error) {
    command.error = error?.message || String(error);
    command.result = null;
    logCommand(command, "error");
  }

  Runtime.lastCommand = {
    name: command.name,
    args: sanitizeArgs(command.args || {}),
    result: command.result,
    error: command.error,
  };
  renderAll();
  return command;
}

const COMMAND_EXECUTORS = {
  load_test_dummy: async () => {
    Runtime.importedModelScene = null;
    Runtime.sourceBoneById.clear();
    Runtime.sourceBoneRestById.clear();
    MotionState.model = { loaded: true, source: "Test Dummy", type: "test_dummy", opacity: MotionState.model.opacity };
    MotionState.source_bones = [];
    MotionState.humanoid_mapping = {};
    MotionState.joint_rotations = {};
    MotionState.direction = { forward_sign: 1, yaw_degrees: 0, confirmed: true };
    MotionState.selected_source_bone_id = null;
    MotionState.import_diagnostics = createEmptyImportDiagnostics();
    MotionState.visual_analysis = createEmptyVisualAnalysis();
    MotionState.dirty_state = true;
    Runtime.stage = "skeleton";
    return { message: "已加载测试假人" };
  },

  import_glb: async ({ file }) => {
    if (!file) {
      throw new Error("导入 GLB 需要选择文件");
    }
    const buffer = await file.arrayBuffer();
    const importDiagnostics = parseGlbDiagnostics(buffer);
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(buffer, "", resolve, reject);
    });
    Runtime.importedModelScene = gltf.scene;
    Runtime.importedModelScene.updateMatrixWorld(true);
    MotionState.model = { loaded: true, source: file.name, type: "glb_reference", opacity: MotionState.model.opacity };
    MotionState.source_bones = extractSourceBones(Runtime.importedModelScene);
    MotionState.humanoid_mapping = autoMapHumanoidBones(MotionState.source_bones);
    MotionState.joint_rotations = {};
    MotionState.direction = { forward_sign: inferInitialForwardSign(), yaw_degrees: 0, confirmed: false };
    MotionState.selected_source_bone_id = MotionState.source_bones[0]?.id || null;
    MotionState.import_diagnostics = {
      ...importDiagnostics,
      extracted_source_bones: MotionState.source_bones.length,
    };
    MotionState.visual_analysis = {
      status: MotionState.source_bones.length > 0 ? "Source bones read" : "No glTF skin",
      method: MotionState.source_bones.length > 0 ? "imported_tpose_bones" : "static_mesh",
      source_bones: MotionState.source_bones.length,
      generated_joints: 0,
      generated_bones: 0,
      model_opacity: MotionState.model.opacity,
    };
    MotionState.skeleton = null;
    MotionState.bones = [];
    MotionState.joints = [];
    MotionState.ik_controls = [];
    MotionState.keyframes = [];
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    Runtime.stage = "skeleton";
    return {
      message: `已导入 ${file.name}，读取到 ${MotionState.source_bones.length} 根源骨骼`,
      source_bones: MotionState.source_bones.length,
      mapped: getMappingCount(),
      glb_skins: MotionState.import_diagnostics.skins,
      glb_nodes: MotionState.import_diagnostics.nodes,
      rest_pose: MotionState.rest_pose,
    };
  },

  create_source_skeleton_from_import: async () => {
    if (!MotionState.model.loaded || MotionState.model.type !== "glb_reference") {
      throw new Error("视觉辅助适配需要先导入 GLB 模型");
    }
    const previousOpacity = MotionState.model.opacity;
    MotionState.model.opacity = 0.5;
    if (MotionState.source_bones.length === 0) {
      const { joints, bones, bounds } = createEstimatedHumanoidSkeletonFromModel();
      MotionState.skeleton = {
        id: "Humanoid_v1",
        version: 1,
        rest_pose: "Estimated T-Pose",
        generation_method: "visual_bounds_estimate",
        source_bone_count: 0,
        joint_names: [...HUMANOID_JOINT_NAMES],
        rest_joints: deepClone(joints),
        note: "GLB 未包含 glTF skin/joints；软件按模型包围盒和人形比例估算 Humanoid_v1 骨架。",
      };
      MotionState.joints = joints;
      MotionState.joint_rotations = {};
      MotionState.bones = bones;
      MotionState.ik_controls = [];
      MotionState.keyframes = [];
      MotionState.selected_bone = bones[0]?.name || null;
      MotionState.selected_control = null;
      MotionState.validation_report = createEmptyValidationReport();
      MotionState.visual_analysis = {
        status: "Estimated",
        method: "visual_bounds_estimate",
        source_bones: 0,
        generated_joints: joints.length,
        generated_bones: bones.length,
        model_opacity: MotionState.model.opacity,
        previous_opacity: previousOpacity,
        bounds,
      };
      MotionState.dirty_state = true;
      Runtime.stage = "ik";
      return {
        message: "未检测到 GLB 骨骼，已根据模型轮廓估算 Humanoid_v1 骨架",
        joints: joints.length,
        bones: bones.length,
        model_opacity: MotionState.model.opacity,
        glb_skins: MotionState.import_diagnostics.skins,
      };
    }
    const { joints, bones } = createSourceSkeletonData();
    MotionState.skeleton = {
      id: "SourceRig_v1",
      version: 1,
      rest_pose: MotionState.rest_pose,
      generation_method: "visual_overlay_tpose",
      source_bone_count: MotionState.source_bones.length,
      joint_names: joints.map((joint) => joint.name),
      rest_joints: deepClone(joints),
      note: "保留导入模型原始骨骼数量和父子层级；模型透明度设为 50%，用于叠加查看骨骼点与模型轮廓。",
    };
    MotionState.joints = joints;
    MotionState.joint_rotations = {};
    MotionState.bones = bones;
    MotionState.ik_controls = [];
    MotionState.keyframes = [];
    MotionState.selected_bone = bones[0]?.name || null;
    MotionState.selected_source_bone_id = null;
    MotionState.selected_control = null;
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.visual_analysis = {
      status: "Generated",
      method: "visual_overlay_tpose",
      source_bones: MotionState.source_bones.length,
      generated_joints: joints.length,
      generated_bones: bones.length,
      model_opacity: MotionState.model.opacity,
      previous_opacity: previousOpacity,
    };
    MotionState.dirty_state = true;
    Runtime.stage = hasRequiredHumanoidMapping() ? "ik" : "skeleton";
    return {
      message: `已根据导入 T-Pose 骨骼生成适配骨架：${joints.length} 个关节点 / ${bones.length} 根骨骼`,
      source_bones: MotionState.source_bones.length,
      joints: joints.length,
      bones: bones.length,
      model_opacity: MotionState.model.opacity,
    };
  },

  create_humanoid_skeleton: async () => {
    const { joints, bones } = createHumanoidSkeletonData();
    const mappedCount = getMappingCount();
    MotionState.skeleton = {
      id: "Humanoid_v1",
      version: 1,
      joint_names: [...HUMANOID_JOINT_NAMES],
      rest_joints: deepClone(joints),
      rest_pose: MotionState.rest_pose,
      direction: MotionState.direction,
      mapping_source: MotionState.source_bones.length > 0 ? "imported_tpose" : "default_tpose",
      mapped_joints: mappedCount,
      optional_fallback_joints: getOptionalFallbackHumanoidMappings(),
      color_rule: {
        R: "暖色",
        L: "冷色",
        Center: "绿色",
      },
    };
    MotionState.joints = joints;
    MotionState.joint_rotations = {};
    MotionState.bones = bones;
    MotionState.selected_bone = bones[0]?.name || null;
    MotionState.selected_control = null;
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    syncSourceRigToMotionState();
    Runtime.stage = "ik";
    return {
      message: "已创建 Humanoid_v1 人形骨架",
      joints: joints.length,
      bones: bones.length,
      mapped: mappedCount,
      optional_fallback_joints: getOptionalFallbackHumanoidMappings(),
    };
  },

  assign_humanoid_mapping: async ({ joint, source_bone_id }) => {
    if (!HUMANOID_JOINT_NAMES.includes(joint)) {
      throw new Error(`未知标准关节点：${joint || "无"}`);
    }
    const sourceBone = MotionState.source_bones.find((bone) => bone.id === source_bone_id);
    if (!sourceBone) {
      throw new Error(`未找到导入骨骼：${source_bone_id || "无"}`);
    }
    Object.entries(MotionState.humanoid_mapping).forEach(([mappedJoint, mappedSourceId]) => {
      if (mappedJoint !== joint && mappedSourceId === source_bone_id) {
        delete MotionState.humanoid_mapping[mappedJoint];
      }
    });
    MotionState.humanoid_mapping[joint] = source_bone_id;
    if (MotionState.skeleton) {
      rebuildHumanoidSkeletonFromMapping();
      if (MotionState.ik_controls.length > 0) {
        MotionState.ik_controls = createIkControlsFromCurrentSkeleton();
      }
      syncSourceRigToMotionState();
    }
    MotionState.selected_bone = getBoneNameForJoint(joint) || MotionState.selected_bone;
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    Runtime.stage = "skeleton";
    return {
      message: `${translateBoneName(joint)} 已吸附到 ${sourceBone.name}`,
      joint,
      source_bone: sourceBone.name,
      mapped: getMappingCount(),
    };
  },

  create_ik_controls: async () => {
    ensureHumanoidSkeletonForAnimation();
    MotionState.ik_controls = createIkControlsFromCurrentSkeleton();
    MotionState.selected_control = MotionState.ik_controls[0]?.id || null;
    MotionState.dirty_state = true;
    Runtime.stage = "motion";
    return {
      message: `已创建 ${CORE_IK_CONTROL_COUNT} 个 Control Rig 控制器和 ${JOINT_CONTROL_DEFS.length} 个 Joint Debug 控制器`,
      count: MotionState.ik_controls.length,
      core_ik: CORE_IK_CONTROL_COUNT,
      joint_controls: JOINT_CONTROL_DEFS.length,
    };
  },

  apply_motion_template: async ({ template_id }) => {
    ensureHumanoidSkeletonForAnimation();
    const autoConfirmedDirection = !MotionState.direction?.confirmed;
    if (autoConfirmedDirection) {
      MotionState.direction = {
        forward_sign: MotionState.direction?.forward_sign === -1 ? -1 : 1,
        yaw_degrees: normalizeForwardYaw(MotionState.direction?.yaw_degrees || 0),
        confirmed: true,
      };
    }
    if (template_id !== "walk_cycle_8f") {
      throw new Error("第一阶段的动作模板只支持 walk_cycle_8f");
    }
    if (MotionState.ik_controls.length === 0) {
      await COMMAND_EXECUTORS.create_ik_controls({});
    }
    MotionState.keyframes = createWalk8FKeyframes();
    MotionState.current_frame = 1;
    applyPoseAtFrame(1);
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    Runtime.stage = "motion";
    return {
      message: autoConfirmedDirection ? "已使用当前前方并创建 8 个走路关键姿势" : "已创建 8 个走路关键姿势",
      template_id: "walk_cycle_8f",
      keyframes: MotionState.keyframes.length,
      auto_confirmed_direction: autoConfirmedDirection,
    };
  },

  set_ik_target: async ({ control_id, position }) => {
    requireIkControls();
    if (!Array.isArray(position) || position.length !== 3 || position.some((value) => !Number.isFinite(Number(value)))) {
      throw new Error("设置 IK 目标需要数字格式的 [x, y, z] 坐标");
    }
    const control = MotionState.ik_controls.find((item) => item.id === control_id);
    if (!control) {
      throw new Error(`未找到 IK 控制器：${control_id || "无"}`);
    }
    const previousControl = deepClone(control);
    control.position = position.map(Number);
    applyControlToJoint(control, previousControl);
    MotionState.selected_control = control.id;
    if (control.target_joint) {
      MotionState.selected_bone = getBoneNameForJoint(control.target_joint) || MotionState.selected_bone;
    }
    MotionState.dirty_state = true;
    return { message: `已设置 ${control.id} 目标`, position: control.position };
  },

  set_control_transform: async ({
    control_id,
    transform_mode,
    space = MotionState.transform.space || "global",
    position,
    rotation,
    scale,
    frame,
    insert_keyframe = false,
  }) => {
    requireIkControls();
    const control = MotionState.ik_controls.find((item) => item.id === control_id);
    if (!control) {
      throw new Error(`未找到 Control Rig 控制器：${control_id || "无"}`);
    }
    if (control.is_joint_control) {
      throw new Error("set_control_transform 只允许修改 Control Rig 控制器；普通关节 Debug 控制器不能走这个命令");
    }
    const mode = ["translate", "rotate", "scale"].includes(transform_mode) ? transform_mode : "translate";
    const previousControl = deepClone(control);
    if (mode === "translate" && position) {
      control.position = normalizeVec3(position, control.position);
    }
    if (mode === "rotate" && rotation) {
      control.rotation = normalizeVec3(rotation, control.rotation || [0, 0, 0]);
    }
    if (mode === "scale" && scale) {
      if (!control.allow_scale) {
        throw new Error(`${translateControlName(control.id)} 不允许缩放`);
      }
      control.scale = normalizeVec3(scale, control.scale || [1, 1, 1], 0.05, 20);
    }
    MotionState.transform.space = space === "local" ? "local" : "global";
    MotionState.transform.tool = mode;
    applyControlToJoint(control, previousControl);
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    const synced = MotionState.ik_controls.find((item) => item.id === control.id);
    if (synced) {
      synced.rotation = control.rotation || synced.rotation || [0, 0, 0];
      synced.scale = control.scale || synced.scale || [1, 1, 1];
    }
    MotionState.selected_control = control.id;
    MotionState.selected_bone = getBoneNameForJoint(control.target_joint) || MotionState.selected_bone;
    MotionState.validation_report = createEmptyValidationReport();
    if (insert_keyframe) {
      upsertManualKeyframe(frame || MotionState.current_frame);
    }
    MotionState.dirty_state = true;
    return {
      message: `已变换 ${translateControlName(control.id)}`,
      control_id: control.id,
      transform_mode: mode,
      space: MotionState.transform.space,
      position: synced?.position || control.position,
      rotation: synced?.rotation || control.rotation || [0, 0, 0],
      scale: synced?.scale || control.scale || [1, 1, 1],
    };
  },

  set_joint_position: async ({ joint, position }) => {
    requireSkeleton();
    if (!HUMANOID_JOINT_NAMES.includes(joint)) {
      throw new Error(`未知关节点：${joint || "无"}`);
    }
    if (!Array.isArray(position) || position.length !== 3 || position.some((value) => !Number.isFinite(Number(value)))) {
      throw new Error("设置关节点需要数字格式的 [x, y, z] 坐标");
    }
    moveJointBranch(joint, position.map(Number));
    MotionState.selected_bone = getBoneNameForJoint(joint) || MotionState.selected_bone;
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    driveMappedSourceRigFromJoints(MotionState.joints);
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    return { message: `已调整 ${translateBoneName(joint)} 关节点`, joint, position: getJoint(joint)?.position || position };
  },

  rotate_joint_branch: async ({ joint, angle, axis }) => {
    requireSkeleton();
    if (!HUMANOID_JOINT_NAMES.includes(joint)) {
      throw new Error(`未知关节点：${joint || "无"}`);
    }
    const rotateAxis = Array.isArray(axis) && axis.length === 3
      ? new THREE.Vector3().fromArray(axis.map(Number))
      : getRigBasis().up.clone();
    if (rotateAxis.length() < 0.001 || !Number.isFinite(Number(angle))) {
      throw new Error("旋转需要有效的轴向和角度");
    }
    rotateJointBranch(joint, Number(angle), rotateAxis.normalize());
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    MotionState.selected_control = getControlForJoint(joint)?.id || MotionState.selected_control;
    MotionState.selected_bone = getBoneNameForJoint(joint) || MotionState.selected_bone;
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    return { message: `已旋转 ${translateBoneName(joint)} 分支`, joint, angle: Number(angle) };
  },

  scale_joint_branch: async ({ joint, scale }) => {
    requireSkeleton();
    if (!HUMANOID_JOINT_NAMES.includes(joint)) {
      throw new Error(`未知关节点：${joint || "无"}`);
    }
    const factor = Math.max(0.15, Math.min(6, Number(scale)));
    if (!Number.isFinite(factor)) {
      throw new Error("缩放需要有效数值");
    }
    scaleJointBranch(joint, factor);
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    MotionState.selected_control = getControlForJoint(joint)?.id || MotionState.selected_control;
    MotionState.selected_bone = getBoneNameForJoint(joint) || MotionState.selected_bone;
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    return { message: `已缩放 ${translateBoneName(joint)} 分支`, joint, scale: factor };
  },

  insert_keyframe: async ({ frame }) => {
    requireSkeleton();
    const targetFrame = upsertManualKeyframe(frame || MotionState.current_frame);
    MotionState.dirty_state = true;
    return { message: `已在第 ${targetFrame} 帧插入关键帧`, frame: targetFrame };
  },

  smooth_keyframes_between: async ({ from_frame, to_frame }) => {
    requireSkeleton();
    if (MotionState.keyframes.length < 2) {
      throw new Error("平滑需要至少两个已保存关键帧");
    }
    const range = normalizeSmoothFrameRange(from_frame, to_frame);
    const sorted = getSortedKeyframes();
    const from = sorted.find((keyframe) => keyframe.timeline_frame === range.from_frame);
    const to = sorted.find((keyframe) => keyframe.timeline_frame === range.to_frame);
    if (!from || !to || from.timeline_frame === to.timeline_frame) {
      throw new Error("没有找到可平滑的相邻关键帧");
    }
    from.interpolation = "smooth";
    to.interpolation = "smooth";
    MotionState.dirty_state = true;
    return { message: `已平滑第 ${from.timeline_frame} 到 ${to.timeline_frame} 帧`, from_frame: from.timeline_frame, to_frame: to.timeline_frame };
  },

  validate_motion: async () => {
    MotionState.validation_report = buildValidationReport();
    Runtime.stage = "export";
    return { message: translateStatus(MotionState.validation_report.status), report: MotionState.validation_report };
  },

  export_motion_json: async () => {
    const payload = {
      schema: "motion_pipeline_v1",
      exported_at: new Date().toISOString(),
      rest_pose: MotionState.rest_pose,
      source_bones: MotionState.source_bones,
      humanoid_mapping: MotionState.humanoid_mapping,
      import_diagnostics: MotionState.import_diagnostics,
      visual_analysis: MotionState.visual_analysis,
      direction: MotionState.direction,
      skeleton: MotionState.skeleton,
      bones: MotionState.bones,
      joints: MotionState.joints,
      joint_rotations: MotionState.joint_rotations,
      ik_controls: MotionState.ik_controls,
      current_frame: MotionState.current_frame,
      total_frames: MotionState.total_frames,
      playback_fps: MotionState.playback_fps,
      keyframes: MotionState.keyframes,
      motion_templates: MotionState.motion_templates,
      validation_report: MotionState.validation_report,
      visual_opacity: MotionState.visual_opacity,
    };
    MotionState.exported_json = JSON.stringify(payload, null, 2);
    MotionState.dirty_state = false;
    return { message: "已导出动作 JSON", bytes: MotionState.exported_json.length };
  },

  import_motion_json: async ({ json }) => {
    if (!json?.trim()) {
      throw new Error("导入动作 JSON 需要 JSON 文本");
    }
    const data = JSON.parse(json);
    if (data.schema !== "motion_pipeline_v1") {
      throw new Error("不支持的动作 JSON 结构");
    }
    MotionState.skeleton = data.skeleton || null;
    MotionState.rest_pose = data.rest_pose || "T-Pose";
    MotionState.source_bones = data.source_bones || [];
    MotionState.humanoid_mapping = data.humanoid_mapping || {};
    MotionState.import_diagnostics = data.import_diagnostics || createEmptyImportDiagnostics();
    MotionState.visual_analysis = data.visual_analysis || createEmptyVisualAnalysis();
    MotionState.direction = data.direction || { forward_sign: 1, confirmed: false };
    MotionState.bones = data.bones || [];
    MotionState.joints = data.joints || [];
    MotionState.joint_rotations = data.joint_rotations || {};
    MotionState.ik_controls = data.ik_controls || [];
    MotionState.current_frame = clampFrame(data.current_frame || 1);
    MotionState.total_frames = data.total_frames || 24;
    MotionState.playback_fps = data.playback_fps || 24;
    MotionState.keyframes = data.keyframes || [];
    MotionState.motion_templates = data.motion_templates || MotionState.motion_templates;
    MotionState.validation_report = data.validation_report || createEmptyValidationReport();
    MotionState.visual_opacity = {
      skeleton: 0.28,
      controls: 0.32,
      control_size: 0.82,
      control_thickness: 0.72,
      ...(data.visual_opacity || {}),
    };
    MotionState.selected_bone = MotionState.bones[0]?.name || null;
    MotionState.selected_source_bone_id = MotionState.source_bones[0]?.id || null;
    MotionState.selected_control = MotionState.ik_controls[0]?.id || null;
    MotionState.exported_json = json;
    MotionState.dirty_state = false;
    return { message: "已导入动作 JSON", keyframes: MotionState.keyframes.length };
  },

  undo: async () => {
    const item = MotionState.undo_stack.pop();
    if (!item) {
      return { message: "没有可撤销的操作" };
    }
    restoreCoreState(item.before);
    MotionState.redo_stack.push(item);
    Runtime.isPlaying = false;
    return { message: `已撤销 ${translateCommandName(item.name)}` };
  },

  redo: async () => {
    const item = MotionState.redo_stack.pop();
    if (!item) {
      return { message: "没有可重做的操作" };
    }
    restoreCoreState(item.after);
    MotionState.undo_stack.push(item);
    Runtime.isPlaying = false;
    return { message: `已重做 ${translateCommandName(item.name)}` };
  },

  play: async () => {
    if (MotionState.keyframes.length === 0) {
      throw new Error("播放需要关键帧，请先应用 Walk_8F 模板");
    }
    Runtime.isPlaying = true;
    Runtime.playStartedAt = performance.now();
    Runtime.playStartFrame = MotionState.current_frame;
    Runtime.lastRenderedFrame = null;
    Runtime.stage = "validate";
    return { message: "正在播放走路循环" };
  },

  stop: async () => {
    Runtime.isPlaying = false;
    return { message: "已停止播放" };
  },

  select_bone: async ({ bone }) => {
    MotionState.selected_bone = bone || null;
    return { message: `已选中骨骼 ${MotionState.selected_bone || "无"}` };
  },

  select_source_bone: async ({ source_bone_id }) => {
    const sourceBone = MotionState.source_bones.find((bone) => bone.id === source_bone_id);
    if (!sourceBone) {
      throw new Error(`未找到导入骨骼：${source_bone_id || "无"}`);
    }
    MotionState.selected_source_bone_id = sourceBone.id;
    const mappedJoint = Object.entries(MotionState.humanoid_mapping).find(([, mappedId]) => mappedId === sourceBone.id)?.[0];
    if (mappedJoint) {
      MotionState.selected_bone = getBoneNameForJoint(mappedJoint) || MotionState.selected_bone;
    }
    return {
      message: `已选中导入骨骼 ${sourceBone.name}`,
      source_bone: sourceBone.name,
      mapped_joint: mappedJoint ? translateBoneName(mappedJoint) : "无",
    };
  },

  select_control: async ({ control }) => {
    MotionState.selected_control = control || null;
    const selected = MotionState.ik_controls.find((item) => item.id === MotionState.selected_control);
    if (selected?.target_joint) {
      MotionState.selected_bone = getBoneNameForJoint(selected.target_joint) || MotionState.selected_bone;
      setCameraTargetToPosition(getJoint(selected.target_joint)?.position || selected.position);
    }
    return { message: `已选中控制器 ${selected ? translateControlName(selected.id) : "无"}` };
  },

  set_character_direction: async ({ forward_sign, yaw_degrees = MotionState.direction?.yaw_degrees || 0, confirmed = true }) => {
    const sign = Number(forward_sign) === -1 ? -1 : 1;
    const yaw = normalizeForwardYaw(yaw_degrees);
    MotionState.direction = { forward_sign: sign, yaw_degrees: yaw, confirmed: Boolean(confirmed) };
    if (MotionState.skeleton?.id === "Humanoid_v1") {
      rebuildHumanoidSkeletonFromMapping();
    } else if (MotionState.skeleton) {
      MotionState.skeleton.direction = MotionState.direction;
    }
    if (MotionState.skeleton?.id === "Humanoid_v1" && MotionState.ik_controls.length > 0) {
      MotionState.ik_controls = createIkControlsFromCurrentSkeleton();
      MotionState.selected_control = MotionState.ik_controls[0]?.id || null;
    }
    MotionState.keyframes = [];
    MotionState.current_frame = 1;
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    return {
      message: formatDirectionCommandMessage(sign, yaw, MotionState.direction.confirmed),
      forward_sign: sign,
      yaw_degrees: yaw,
      confirmed: MotionState.direction.confirmed,
    };
  },

  set_loop: async ({ loop }) => {
    Runtime.loop = Boolean(loop);
    return { message: `循环已${Runtime.loop ? "开启" : "关闭"}` };
  },

  set_model_opacity: async ({ opacity }) => {
    MotionState.model.opacity = Math.max(0.15, Math.min(1, Number(opacity) || 0.72));
    return { message: `模型透明度 ${MotionState.model.opacity.toFixed(2)}` };
  },

  set_skeleton_opacity: async ({ opacity }) => {
    MotionState.visual_opacity.skeleton = clampOpacity(opacity, 0.05, 0.9, 0.28);
    return { message: `骨架透明度 ${MotionState.visual_opacity.skeleton.toFixed(2)}` };
  },

  set_control_opacity: async ({ opacity }) => {
    MotionState.visual_opacity.controls = clampOpacity(opacity, 0.05, 0.9, 0.32);
    return { message: `控制器透明度 ${MotionState.visual_opacity.controls.toFixed(2)}` };
  },

  set_stage: async ({ stage }) => {
    setStage(stage);
    return { message: `阶段切换到 ${translateStage(stage)}` };
  },

  set_current_frame: async ({ frame }) => {
    MotionState.current_frame = clampFrame(Number(frame) || 1);
    applyPoseAtFrame(MotionState.current_frame);
    return { message: `当前帧 ${MotionState.current_frame}` };
  },

  set_view_option: async ({ key, value }) => {
    if (!(key in MotionState.show)) {
      throw new Error(`未知显示选项：${key}`);
    }
    MotionState.show[key] = Boolean(value);
    return { message: `${translateViewOption(key)} 已${MotionState.show[key] ? "开启" : "关闭"}` };
  },

  set_control_visual_size: async ({ size }) => {
    MotionState.visual_opacity.control_size = clampNumber(size, 0.35, 1.6, 0.82);
    return { message: `控制器大小 ${MotionState.visual_opacity.control_size.toFixed(2)}` };
  },

  set_control_visual_thickness: async ({ thickness }) => {
    MotionState.visual_opacity.control_thickness = clampNumber(thickness, 0.35, 1.8, 0.72);
    return { message: `控制器线粗 ${MotionState.visual_opacity.control_thickness.toFixed(2)}` };
  },

  reset_view: async () => {
    yaw = -0.55;
    pitch = 0.18;
    cameraDistance = 5.1;
    cameraTarget.set(0, 1.15, 0);
    updateCamera();
    return { message: "已重置视角" };
  },
};

function isUndoableCommand(name) {
  return [
    "load_test_dummy",
    "import_glb",
    "create_humanoid_skeleton",
    "assign_humanoid_mapping",
    "set_character_direction",
    "create_source_skeleton_from_import",
    "create_ik_controls",
    "apply_motion_template",
    "set_control_transform",
    "set_ik_target",
    "set_joint_position",
    "rotate_joint_branch",
    "scale_joint_branch",
    "insert_keyframe",
    "smooth_keyframes_between",
    "validate_motion",
    "export_motion_json",
    "import_motion_json",
  ].includes(name);
}

function snapshotCoreState() {
  return deepClone({
    model: MotionState.model,
    rest_pose: MotionState.rest_pose,
    source_bones: MotionState.source_bones,
    humanoid_mapping: MotionState.humanoid_mapping,
    direction: MotionState.direction,
    import_diagnostics: MotionState.import_diagnostics,
    visual_analysis: MotionState.visual_analysis,
    skeleton: MotionState.skeleton,
    bones: MotionState.bones,
    joints: MotionState.joints,
    joint_rotations: MotionState.joint_rotations,
    ik_controls: MotionState.ik_controls,
    current_frame: MotionState.current_frame,
    total_frames: MotionState.total_frames,
    playback_fps: MotionState.playback_fps,
    keyframes: MotionState.keyframes,
    motion_templates: MotionState.motion_templates,
    selected_bone: MotionState.selected_bone,
    selected_source_bone_id: MotionState.selected_source_bone_id,
    selected_control: MotionState.selected_control,
    transform: MotionState.transform,
    validation_report: MotionState.validation_report,
    dirty_state: MotionState.dirty_state,
    exported_json: MotionState.exported_json,
    visual_opacity: MotionState.visual_opacity,
  });
}

function restoreCoreState(snapshot) {
  Object.assign(MotionState, deepClone(snapshot));
  syncSourceRigToMotionState();
}

function logCommand(command, status) {
  const entry = {
    at: new Date().toISOString(),
    name: command.name,
    args: sanitizeArgs(command.args || {}),
    status,
    result: command.result,
    error: command.error,
  };
  MotionState.command_log.push(entry);
  if (MotionState.command_log.length > 200) {
    MotionState.command_log.shift();
  }
}

function sanitizeArgs(args) {
  return JSON.parse(JSON.stringify(args, (key, value) => {
    if (typeof File !== "undefined" && value instanceof File) {
      return { name: value.name, size: value.size, type: value.type };
    }
    return value;
  }));
}

function parseGlbDiagnostics(arrayBuffer) {
  const diagnostics = createEmptyImportDiagnostics();
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 20) {
    diagnostics.format = "Unknown";
    diagnostics.error = "文件太小，无法解析 GLB 头";
    return diagnostics;
  }
  const magic = readAscii(view, 0, 4);
  if (magic !== "glTF") {
    diagnostics.format = "Non-GLB";
    diagnostics.error = "不是标准 GLB 文件头";
    return diagnostics;
  }
  diagnostics.format = "GLB";
  diagnostics.version = view.getUint32(4, true);
  diagnostics.byte_length = view.getUint32(8, true);
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = readAscii(view, offset + 4, 4);
    const chunkStart = offset + 8;
    if (chunkType === "JSON") {
      const jsonText = new TextDecoder("utf-8").decode(arrayBuffer.slice(chunkStart, chunkStart + chunkLength));
      const json = JSON.parse(jsonText);
      diagnostics.generator = json.asset?.generator || "Unknown";
      diagnostics.nodes = json.nodes?.length || 0;
      diagnostics.meshes = json.meshes?.length || 0;
      diagnostics.skins = json.skins?.length || 0;
      diagnostics.animations = json.animations?.length || 0;
      diagnostics.skin_joint_counts = (json.skins || []).map((skin) => skin.joints?.length || 0);
      diagnostics.mesh_nodes_with_skin = (json.nodes || []).filter((node) => node.skin !== undefined).length;
      diagnostics.joints = diagnostics.skin_joint_counts.reduce((sum, count) => sum + count, 0);
      diagnostics.node_names = (json.nodes || []).map((node) => node.name || "").filter(Boolean).slice(0, 40);
      return diagnostics;
    }
    offset = chunkStart + chunkLength;
  }
  diagnostics.error = "未找到 GLB JSON chunk";
  return diagnostics;
}

function readAscii(view, offset, length) {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}

function extractSourceBones(sceneRoot) {
  Runtime.sourceBoneById.clear();
  Runtime.sourceBoneRestById.clear();
  const uniqueBones = [];
  const seen = new Set();
  sceneRoot.updateMatrixWorld(true);
  sceneRoot.traverse((node) => {
    if (node.isSkinnedMesh && node.skeleton?.bones) {
      node.skeleton.bones.forEach((bone) => {
        if (!seen.has(bone.uuid)) {
          seen.add(bone.uuid);
          uniqueBones.push(bone);
        }
      });
    }
    if (node.isBone && !seen.has(node.uuid)) {
      seen.add(node.uuid);
      uniqueBones.push(node);
    }
  });
  const idByUuid = new Map(uniqueBones.map((bone, index) => [bone.uuid, `${index}:${bone.uuid}`]));

  return uniqueBones.map((bone, index) => {
    const id = idByUuid.get(bone.uuid);
    const position = new THREE.Vector3();
    bone.getWorldPosition(position);
    const worldQuaternion = new THREE.Quaternion();
    bone.getWorldQuaternion(worldQuaternion);
    const worldScale = new THREE.Vector3();
    bone.getWorldScale(worldScale);
    Runtime.sourceBoneById.set(id, bone);
    Runtime.sourceBoneRestById.set(id, {
      localPosition: bone.position.clone(),
      localQuaternion: bone.quaternion.clone(),
      localScale: bone.scale.clone(),
      worldPosition: position.clone(),
      worldQuaternion: worldQuaternion.clone(),
      worldScale: worldScale.clone(),
    });
    const children = bone.children.filter((child) => child.isBone);
    const childPositions = children.map((child) => {
      const childPosition = new THREE.Vector3();
      child.getWorldPosition(childPosition);
      return childPosition;
    });
    const length = childPositions.length
      ? childPositions.reduce((total, childPosition) => total + childPosition.distanceTo(position), 0) / childPositions.length
      : 0;
    const parentBone = findParentBone(bone);
    return {
      id,
      name: bone.name || `Bone_${index + 1}`,
      parent: parentBone?.name || null,
      parent_id: parentBone ? idByUuid.get(parentBone.uuid) || null : null,
      path: getBonePath(bone),
      depth: getBoneDepth(bone),
      side_guess: guessSourceBoneSide(bone.name || "", position.x),
      position: [position.x, position.y, position.z],
      length,
      child_count: children.length,
    };
  });
}

function findParentBone(bone) {
  let current = bone.parent;
  while (current) {
    if (current.isBone) return current;
    current = current.parent;
  }
  return null;
}

function getBonePath(bone) {
  const names = [];
  let current = bone;
  while (current && current.type !== "Scene") {
    if (current.name) names.unshift(current.name);
    current = current.parent;
  }
  return names.join(" / ");
}

function getBoneDepth(bone) {
  let depth = 0;
  let current = bone.parent;
  while (current) {
    if (current.isBone) depth += 1;
    current = current.parent;
  }
  return depth;
}

function guessSourceBoneSide(name, xPosition) {
  const normalized = normalizeBoneName(name);
  if (normalized.includes("right") || normalized.startsWith("r") || normalized.endsWith("r")) return "R";
  if (normalized.includes("left") || normalized.startsWith("l") || normalized.endsWith("l")) return "L";
  if (Math.abs(xPosition) > 0.0001) return xPosition > 0 ? "R" : "L";
  return "Center";
}

function autoMapHumanoidBones(sourceBones) {
  const mapping = {};
  const used = new Set();
  HUMANOID_JOINT_NAMES.forEach((joint) => {
    const match = findBestSourceBoneForJoint(sourceBones, joint, used);
    if (match) {
      mapping[joint] = match.id;
      used.add(match.id);
    }
  });
  return mapping;
}

function findBestSourceBoneForJoint(sourceBones, joint, used) {
  const side = getSide(joint);
  const aliases = HUMANOID_MAPPING_ALIASES[joint].map(normalizeBoneName);
  let best = null;
  let bestNonTwist = null;
  sourceBones.forEach((sourceBone) => {
    if (used.has(sourceBone.id)) return;
    const normalized = normalizeBoneName(sourceBone.name);
    let score = 0;
    aliases.forEach((alias) => {
      if (normalized === alias) score = Math.max(score, 120);
      else if (normalized.endsWith(alias)) score = Math.max(score, 95);
      else if (normalized.includes(alias)) score = Math.max(score, 78);
    });
    if (!score) return;
    if (side !== "Center" && sourceBone.side_guess === side) score += 12;
    if (side === "Center" && sourceBone.side_guess === "Center") score += 8;
    if (/(thumb|index|middle|ring|pinky|finger)/i.test(sourceBone.name) && !joint.endsWith("Hand")) score -= 60;
    if (/twist/i.test(sourceBone.name)) score -= 42;
    score -= Math.min(normalized.length, 60) * 0.08;
    if (!best || score > best.score) {
      best = { ...sourceBone, score };
    }
    if (!/twist/i.test(sourceBone.name) && (!bestNonTwist || score > bestNonTwist.score)) {
      bestNonTwist = { ...sourceBone, score };
    }
  });
  if (bestNonTwist && bestNonTwist.score >= 58) {
    return bestNonTwist;
  }
  return best && best.score >= 30 ? best : null;
}

function normalizeBoneName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/mixamorig|mixamo|armature|bip001|def|jnt|joint|bone/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getMappingCount() {
  return HUMANOID_JOINT_NAMES.filter((name) => MotionState.humanoid_mapping[name]).length;
}

function getMissingHumanoidMappings({ includeOptional = true } = {}) {
  return HUMANOID_JOINT_NAMES.filter((name) => (
    !MotionState.humanoid_mapping[name]
    && (includeOptional || !OPTIONAL_HUMANOID_MAPPING_JOINTS.has(name))
  ));
}

function getOptionalFallbackHumanoidMappings() {
  return getMissingHumanoidMappings()
    .filter((name) => OPTIONAL_HUMANOID_MAPPING_JOINTS.has(name));
}

function hasRequiredHumanoidMapping() {
  return getMissingHumanoidMappings({ includeOptional: false }).length === 0;
}

function getBoneNameForJoint(joint) {
  if (joint === "Hips") return "Spine";
  if (joint === "Head") return "Head";
  return HUMANOID_BONE_CONNECTIONS.find(([, child]) => child === joint)?.[1] || null;
}

function createSourceSkeletonData() {
  const sourceNameById = new Map();
  MotionState.source_bones.forEach((bone, index) => {
    sourceNameById.set(bone.id, createSourceJointName(bone, index));
  });
  const joints = MotionState.source_bones.map((bone, index) => ({
    name: sourceNameById.get(bone.id),
    display_name: bone.name,
    side: bone.side_guess,
    position: [...bone.position],
    source_bone_id: bone.id,
    source_bone_name: bone.name,
    parent_source_bone_id: bone.parent_id,
    rest_pose: MotionState.rest_pose,
    is_source_joint: true,
  }));
  const bones = MotionState.source_bones
    .filter((bone) => bone.parent_id && sourceNameById.has(bone.parent_id))
    .map((bone, index) => {
      const parentName = sourceNameById.get(bone.parent_id);
      const childName = sourceNameById.get(bone.id);
      const parentPosition = getJointPositionFromList(joints, parentName);
      const childPosition = getJointPositionFromList(joints, childName);
      return {
        name: childName,
        display_name: bone.name,
        parent: parentName,
        parent_display_name: MotionState.source_bones.find((source) => source.id === bone.parent_id)?.name || null,
        start: parentName,
        end: childName,
        side: bone.side_guess,
        length: distance(parentPosition, childPosition),
        color_rule: getColorRule(bone.side_guess),
        source_bone_id: bone.id,
        order: index,
      };
    });
  return { joints, bones };
}

function createSourceJointName(bone, index) {
  const readable = String(bone.name || `Bone_${index + 1}`)
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42) || `Bone_${index + 1}`;
  return `SRC_${String(index + 1).padStart(3, "0")}_${readable}`;
}

function createEstimatedHumanoidSkeletonFromModel() {
  if (!Runtime.importedModelScene) {
    throw new Error("没有可估算的导入模型");
  }
  Runtime.importedModelScene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(Runtime.importedModelScene);
  if (!Number.isFinite(box.min.x) || box.isEmpty()) {
    throw new Error("导入模型包围盒无效，无法估算骨架");
  }
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const baseMinY = 0.06;
  const baseHeight = 1.82;
  const yScale = Math.max(size.y / baseHeight, 0.001);
  const horizontalScale = yScale;
  const zScale = Math.max(size.z, size.y * 0.16) / 0.44;
  const joints = HUMANOID_JOINT_NAMES.map((name) => {
    const rest = HUMANOID_REST_POSITIONS[name];
    return {
      name,
      side: getSide(name),
      position: [
        center.x + rest[0] * horizontalScale,
        box.min.y + (rest[1] - baseMinY) * yScale,
        center.z + (rest[2] - 0.18) * zScale,
      ],
      source_bone_id: null,
      source_bone_name: null,
      rest_pose: "Estimated T-Pose",
      is_estimated_from_mesh: true,
    };
  });
  const bones = HUMANOID_BONE_CONNECTIONS.map(([parent, child]) => ({
    name: child,
    parent,
    start: parent,
    end: child,
    side: getSide(child),
    length: distance(getJointPositionFromList(joints, parent), getJointPositionFromList(joints, child)),
    color_rule: getColorRule(getSide(child)),
    is_estimated_from_mesh: true,
  }));
  return {
    joints,
    bones,
    bounds: {
      min: box.min.toArray(),
      max: box.max.toArray(),
      size: size.toArray(),
      center: center.toArray(),
    },
  };
}

function getPositionMapVector(positionByName, name) {
  return new THREE.Vector3().fromArray(positionByName.get(name) || HUMANOID_REST_POSITIONS[name]);
}

function estimateHumanoidBasisFromPositions(positionByName) {
  const fallbackRight = new THREE.Vector3(1, 0, 0);
  const fallbackUp = new THREE.Vector3(0, 1, 0);
  const fallbackForward = new THREE.Vector3(0, 0, 1);
  const hips = getPositionMapVector(positionByName, "Hips");
  let up = getPositionMapVector(positionByName, "Head").sub(hips);
  if (up.length() < 0.001) {
    up = getPositionMapVector(positionByName, "Chest").sub(hips);
  }
  if (up.length() < 0.001) {
    up = fallbackUp.clone();
  }
  up.normalize();

  let right = new THREE.Vector3();
  [
    ["R_Hand", "L_Hand"],
    ["R_Forearm", "L_Forearm"],
    ["R_UpperArm", "L_UpperArm"],
    ["R_Foot", "L_Foot"],
    ["R_UpperLeg", "L_UpperLeg"],
  ].forEach(([rightName, leftName]) => {
    const sideDelta = getPositionMapVector(positionByName, rightName).sub(getPositionMapVector(positionByName, leftName));
    const planar = projectOntoPlane(sideDelta, up);
    if (planar.length() > 0.001) {
      right.add(planar.normalize());
    }
  });
  right = projectOntoPlane(right.length() > 0.001 ? right : fallbackRight.clone(), up);
  if (right.length() < 0.001) {
    right = fallbackRight.clone();
  }
  right.normalize();

  let forward = right.clone().cross(up);
  if (forward.length() < 0.001) {
    forward = fallbackForward.clone();
  }
  forward.normalize();
  if (MotionState.direction?.forward_sign === -1) {
    forward.negate();
  }
  const yawOffset = getDirectionYawRadians();
  if (Math.abs(yawOffset) > 0.000001) {
    forward.applyAxisAngle(up, yawOffset).normalize();
  }
  right = up.clone().cross(forward);
  if (right.length() < 0.001) {
    right = fallbackRight.clone();
  }
  right.normalize();
  return { right, up, forward };
}

function applyOptionalHumanoidFallbackPositions(positionByName) {
  if (MotionState.source_bones.length === 0) {
    return;
  }
  const basis = estimateHumanoidBasisFromPositions(positionByName);
  ["R", "L"].forEach((side) => {
    const toeName = `${side}_Toe`;
    if (MotionState.humanoid_mapping[toeName]) {
      return;
    }
    const foot = getPositionMapVector(positionByName, `${side}_Foot`);
    const lowerLeg = getPositionMapVector(positionByName, `${side}_LowerLeg`);
    const toeLength = Math.max(foot.distanceTo(lowerLeg) * 0.28, 0.04);
    const toe = foot.clone()
      .addScaledVector(basis.forward, toeLength)
      .addScaledVector(basis.up, -toeLength * 0.08);
    positionByName.set(toeName, toe.toArray());
  });
}

function createHumanoidSkeletonData() {
  const sourceById = new Map(MotionState.source_bones.map((bone) => [bone.id, bone]));
  const positionByName = new Map();
  HUMANOID_JOINT_NAMES.forEach((name) => {
    const sourceBone = sourceById.get(MotionState.humanoid_mapping[name]);
    positionByName.set(name, [...(sourceBone?.position || HUMANOID_REST_POSITIONS[name])]);
  });
  applyOptionalHumanoidFallbackPositions(positionByName);
  const joints = HUMANOID_JOINT_NAMES.map((name) => {
    const sourceBone = sourceById.get(MotionState.humanoid_mapping[name]);
    const isOptionalFallback = MotionState.source_bones.length > 0
      && !sourceBone
      && OPTIONAL_HUMANOID_MAPPING_JOINTS.has(name);
    return {
      name,
      side: getSide(name),
      position: [...positionByName.get(name)],
      source_bone_id: MotionState.humanoid_mapping[name] || null,
      source_bone_name: sourceBone?.name || null,
      rest_pose: sourceBone ? MotionState.rest_pose : isOptionalFallback ? "Foot Fallback" : "Default T-Pose",
      is_optional_fallback: isOptionalFallback,
    };
  });
  const bones = HUMANOID_BONE_CONNECTIONS.map(([parent, child]) => ({
    name: child,
    parent,
    start: parent,
    end: child,
    side: getSide(child),
    length: distance(getJointPositionFromList(joints, parent), getJointPositionFromList(joints, child)),
    color_rule: getColorRule(getSide(child)),
  }));
  return { joints, bones };
}

function rebuildHumanoidSkeletonFromMapping() {
  const { joints, bones } = createHumanoidSkeletonData();
    MotionState.joints = joints;
    MotionState.joint_rotations = {};
    MotionState.bones = bones;
  MotionState.skeleton = {
    ...(MotionState.skeleton || {}),
    id: "Humanoid_v1",
    version: 1,
    joint_names: [...HUMANOID_JOINT_NAMES],
    rest_joints: deepClone(joints),
    rest_pose: MotionState.rest_pose,
    direction: MotionState.direction,
    mapping_source: MotionState.source_bones.length > 0 ? "imported_tpose" : "default_tpose",
    mapped_joints: getMappingCount(),
    optional_fallback_joints: getOptionalFallbackHumanoidMappings(),
    color_rule: {
      R: "暖色",
      L: "冷色",
      Center: "绿色",
    },
  };
}

function getJointPositionFromList(joints, name) {
  return joints.find((joint) => joint.name === name)?.position || HUMANOID_REST_POSITIONS[name];
}

function createWalk8FKeyframes() {
  const basis = getRigBasis();
  const snapshot = snapshotCoreState();
  const frames = [];
  WALK_KEY_POSES.forEach((pose) => {
    restoreCoreState(snapshot);
    MotionState.joints = deepClone(MotionState.skeleton?.rest_joints || MotionState.joints);
    MotionState.joint_rotations = {};
    MotionState.ik_controls = createIkControlsFromCurrentSkeleton();
    applyWalkControlsToRig(pose.params, pose.index, basis);
    frames.push({
      pose_index: pose.index,
      timeline_frame: pose.timeline_frame,
      label: pose.label,
      joints: deepClone(MotionState.joints),
      joint_rotations: deepClone(MotionState.joint_rotations),
      ik_controls: deepClone(MotionState.ik_controls),
      foot_locks: pose.params.lock,
      template_id: "walk_cycle_8f",
    });
  });
  restoreCoreState(snapshot);
  return frames;
}

function applyWalkControlsToRig(params, poseIndex, basis = getRigBasis()) {
  const baseControls = new Map(MotionState.ik_controls.map((control) => [control.id, deepClone(control)]));
  const phase = Math.sign((params.rFootZ || 0) - (params.lFootZ || 0)) || (poseIndex <= 4 ? 1 : -1);
  const hipY = (params.hipY || 0) * basis.scale;
  const sideShift = -phase * 0.035 * basis.scale;
  setRigControlPosition("COG_CTRL", new THREE.Vector3().fromArray(baseControls.get("COG_CTRL").position)
    .addScaledVector(basis.up, hipY)
    .addScaledVector(basis.right, sideShift)
    .toArray());
  setRigControlPosition("Pelvis_CTRL", new THREE.Vector3().fromArray(baseControls.get("Pelvis_CTRL").position)
    .addScaledVector(basis.up, hipY * 0.35)
    .addScaledVector(basis.right, sideShift * 0.35)
    .toArray());
  setRigControlRotation("Pelvis_CTRL", [phase * 0.035, phase * 0.085, -phase * 0.045]);
  setRigControlRotation("Chest_CTRL", [-phase * 0.018, -phase * 0.06, phase * 0.024]);
  setRigControlRotation("Head_CTRL", [0, -phase * 0.018, 0]);
  ["R_Knee_Pole", "L_Knee_Pole", "R_Elbow_Pole", "L_Elbow_Pole"].forEach((controlId) => {
    setWalkPoleControl(controlId, basis);
  });
  setLimbIkControl("R_Foot_IK", baseControls, basis, params.rFootZ || 0, params.rFootY || 0, Boolean(params.lock?.R));
  setLimbIkControl("L_Foot_IK", baseControls, basis, params.lFootZ || 0, params.lFootY || 0, Boolean(params.lock?.L));
  setWalkHandIkControl("R_Hand_IK", "R", basis, params.rHandZ || 0, phase);
  setWalkHandIkControl("L_Hand_IK", "L", basis, params.lHandZ || 0, phase);
}

function setLimbIkControl(controlId, baseControls, basis, forwardOffset, upOffset, locked) {
  const base = baseControls.get(controlId);
  if (!base) {
    return;
  }
  const position = new THREE.Vector3().fromArray(base.position)
    .addScaledVector(basis.forward, forwardOffset * basis.scale)
    .addScaledVector(basis.up, upOffset * basis.scale)
    .toArray();
  setRigControlPosition(controlId, position, locked);
}

function setRigControlPosition(controlId, position, locked = false) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  if (!control) {
    return;
  }
  const previous = deepClone(control);
  control.position = position;
  control.locked = locked;
  applyControlToJoint(control, previous);
  MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
  const synced = MotionState.ik_controls.find((item) => item.id === controlId);
  if (synced) {
    synced.locked = locked;
  }
}

function setWalkPoleControl(controlId, basis = getRigBasis()) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  const def = getControlDef(controlId);
  const joint = def ? getJoint(def.joint) : null;
  if (!control || !def || !joint) {
    return;
  }
  const position = addVec(joint.position, getIkControlWorldOffset(def, basis));
  setRigControlPosition(controlId, position, false);
}

function setWalkHandIkControl(controlId, side, basis = getRigBasis(), forwardOffset = 0, phase = 1) {
  const hips = getJoint("Hips");
  if (!hips) {
    return;
  }
  const sideSign = side === "R" ? 1 : -1;
  const relaxedTarget = new THREE.Vector3().fromArray(hips.position)
    .addScaledVector(basis.right, sideSign * 0.36 * basis.scale)
    .addScaledVector(basis.up, -0.10 * basis.scale)
    .addScaledVector(basis.forward, forwardOffset * basis.scale);
  setRigControlPosition(controlId, relaxedTarget.toArray(), false);
  const rotation = [
    phase * 0.035,
    sideSign * 0.06,
    -sideSign * phase * 0.045,
  ];
  setRigControlRotation(controlId, rotation);
}

function setRigControlRotation(controlId, rotation) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  if (!control) {
    return;
  }
  const previous = deepClone(control);
  control.rotation = rotation;
  applyControlToJoint(control, previous);
  MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
  const synced = MotionState.ik_controls.find((item) => item.id === controlId);
  if (synced) {
    synced.rotation = rotation;
  }
}

function makeWalkPoseOffsets(params, basis = getRigBasis()) {
  const offsets = {};
  const centerOffset = [0, (params.hipY || 0) * basis.scale, 0];
  ["Hips", "Spine", "Chest", "Neck", "Head"].forEach((name) => {
    offsets[name] = centerOffset;
  });
  applyLimbOffsets(offsets, "R", params.rFootZ || 0, params.rFootY || 0, params.rHandZ || 0, basis);
  applyLimbOffsets(offsets, "L", params.lFootZ || 0, params.lFootY || 0, params.lHandZ || 0, basis);
  return offsets;
}

function applyLimbOffsets(offsets, side, footZ, footY, handZ, basis = getRigBasis()) {
  const stride = footZ * basis.scale;
  const lift = footY * basis.scale;
  const swing = handZ * basis.scale;
  offsets[`${side}_UpperLeg`] = [0, lift * 0.15, stride * 0.18];
  offsets[`${side}_LowerLeg`] = [0, lift * 0.45, stride * 0.55];
  offsets[`${side}_Foot`] = [0, lift, stride];
  offsets[`${side}_Toe`] = [0, lift, stride];

  const upperArm = getRestLocalPosition(`${side}_UpperArm`, basis);
  const forearm = getRestLocalPosition(`${side}_Forearm`, basis);
  const hand = getRestLocalPosition(`${side}_Hand`, basis);
  offsets[`${side}_UpperArm`] = [-upperArm.right * 0.08, -basis.height * 0.015, swing * 0.16];
  offsets[`${side}_Forearm`] = [-forearm.right * 0.42, -basis.height * 0.15, swing * 0.55];
  offsets[`${side}_Hand`] = [-hand.right * 0.68, -basis.height * 0.28, swing];
}

function applyOffsetsToRest(offsets, basis = getRigBasis()) {
  return HUMANOID_JOINT_NAMES.map((name) => ({
    name,
    side: getSide(name),
    position: addVec(getRestPosition(name), rigOffsetToWorld(offsets[name] || [0, 0, 0], basis).toArray()),
    source_bone_id: MotionState.humanoid_mapping[name] || null,
    source_bone_name: getMappedSourceBone(name)?.name || null,
    rest_pose: MotionState.humanoid_mapping[name] ? MotionState.rest_pose : "Default T-Pose",
  }));
}

function createControlsForPose(joints, locks = {}) {
  const jointMap = new Map(joints.map((joint) => [joint.name, joint]));
  const basis = getRigBasis();
  return IK_CONTROL_DEFS.map((def) => {
    const joint = jointMap.get(def.joint);
    return {
      id: def.id,
      type: def.type,
      side: def.side,
      target_joint: def.joint,
      is_joint_control: Boolean(def.is_joint_control),
      control_role: def.is_joint_control ? "joint_debug" : "control_rig",
      allow_scale: Boolean(def.allow_scale),
      position: getControlPositionForDef(def, joint, basis),
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      locked: def.id === "R_Foot_IK" ? Boolean(locks.R) : def.id === "L_Foot_IK" ? Boolean(locks.L) : false,
    };
  });
}

function createIkControlsFromCurrentSkeleton() {
  const basis = getRigBasis();
  return IK_CONTROL_DEFS.map((def) => {
    const joint = getJoint(def.joint);
    return {
      id: def.id,
      type: def.type,
      side: def.side,
      target_joint: def.joint,
      is_joint_control: Boolean(def.is_joint_control),
      control_role: def.is_joint_control ? "joint_debug" : "control_rig",
      allow_scale: Boolean(def.allow_scale),
      position: getControlPositionForDef(def, joint, basis),
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      locked: false,
    };
  });
}

function getControlPositionForDef(def, joint, basis = getRigBasis()) {
  if (!joint) {
    return [0, 0, 0];
  }
  const jointVec = new THREE.Vector3().fromArray(joint.position);
  const hips = getJoint("Hips") ? new THREE.Vector3().fromArray(getJoint("Hips").position) : getRestVector("Hips");
  const rightFoot = getJoint("R_Foot") ? new THREE.Vector3().fromArray(getJoint("R_Foot").position) : getRestVector("R_Foot");
  const leftFoot = getJoint("L_Foot") ? new THREE.Vector3().fromArray(getJoint("L_Foot").position) : getRestVector("L_Foot");
  const footY = Math.min(rightFoot.y, leftFoot.y, jointVec.y);
  if (def.id === "Global_CTRL") {
    return new THREE.Vector3(hips.x, footY - basis.scale * 0.045, hips.z).toArray();
  }
  if (def.id === "Root_CTRL") {
    return new THREE.Vector3(hips.x, footY + basis.scale * 0.025, hips.z).addScaledVector(basis.forward, -0.08 * basis.scale).toArray();
  }
  if (def.id === "COG_CTRL") {
    return jointVec.clone().addScaledVector(basis.up, 0.11 * basis.scale).toArray();
  }
  if (def.id === "Pelvis_CTRL") {
    return jointVec.clone().addScaledVector(basis.up, 0.035 * basis.scale).toArray();
  }
  if (def.id === "Chest_CTRL") {
    return jointVec.clone().addScaledVector(basis.up, 0.015 * basis.scale).toArray();
  }
  if (def.id === "Head_CTRL") {
    return jointVec.clone().addScaledVector(basis.up, 0.035 * basis.scale).toArray();
  }
  return addVec(joint.position, getIkControlWorldOffset(def, basis));
}

function getRestPosition(name) {
  const restJoint = MotionState.skeleton?.rest_joints?.find((joint) => joint.name === name);
  return restJoint?.position || HUMANOID_REST_POSITIONS[name];
}

function getMappedSourceBone(jointName) {
  const sourceId = MotionState.humanoid_mapping[jointName];
  return MotionState.source_bones.find((bone) => bone.id === sourceId) || null;
}

function getMappedSourceBoneObject(jointName) {
  const sourceId = MotionState.humanoid_mapping[jointName];
  return sourceId ? Runtime.sourceBoneById.get(sourceId) || null : null;
}

function getMappedSourceRest(jointName) {
  const sourceId = MotionState.humanoid_mapping[jointName];
  return sourceId ? Runtime.sourceBoneRestById.get(sourceId) || null : null;
}

function getRestVector(name) {
  return new THREE.Vector3().fromArray(getRestPosition(name));
}

function inferInitialForwardSign() {
  return 1;
}

function normalizeForwardYaw(value) {
  let degrees = Number(value);
  if (!Number.isFinite(degrees)) {
    degrees = 0;
  }
  while (degrees > 180) degrees -= 360;
  while (degrees < -180) degrees += 360;
  return Math.round(degrees);
}

function getDirectionYawRadians() {
  return THREE.MathUtils.degToRad(normalizeForwardYaw(MotionState.direction?.yaw_degrees || 0));
}

function getRigBasis() {
  const fallbackRight = new THREE.Vector3(1, 0, 0);
  const fallbackUp = new THREE.Vector3(0, 1, 0);
  const fallbackForward = new THREE.Vector3(0, 0, 1);
  const hips = getRestVector("Hips");
  let up = getRestVector("Head").sub(hips);
  if (up.length() < 0.001) {
    up = getRestVector("Chest").sub(hips);
  }
  if (up.length() < 0.001) {
    up = fallbackUp.clone();
  }
  up.normalize();

  let right = new THREE.Vector3();
  [
    ["R_Hand", "L_Hand"],
    ["R_Forearm", "L_Forearm"],
    ["R_UpperArm", "L_UpperArm"],
    ["R_Foot", "L_Foot"],
    ["R_UpperLeg", "L_UpperLeg"],
  ].forEach(([rightName, leftName]) => {
    const sideDelta = getRestVector(rightName).sub(getRestVector(leftName));
    const planar = projectOntoPlane(sideDelta, up);
    if (planar.length() > 0.001) {
      right.add(planar.normalize());
    }
  });
  right = projectOntoPlane(right.length() > 0.001 ? right : fallbackRight.clone(), up);
  if (right.length() < 0.001) {
    right = fallbackRight.clone();
  }
  right.normalize();

  let forward = new THREE.Vector3();
  [
    ["R_Foot", "R_Toe"],
    ["L_Foot", "L_Toe"],
  ].forEach(([footName, toeName]) => {
    const toeDelta = getRestVector(toeName).sub(getRestVector(footName));
    const planar = projectOntoPlane(toeDelta, up);
    if (planar.length() > 0.001) {
      forward.add(planar.normalize());
    }
  });
  if (forward.length() < 0.001) {
    forward = right.clone().cross(up);
  } else {
    forward = projectOntoPlane(forward, up);
  }
  if (forward.length() < 0.001) {
    forward = fallbackForward.clone();
  }
  forward.normalize();

  const rightFromForward = up.clone().cross(forward);
  if (rightFromForward.length() > 0.001 && rightFromForward.normalize().dot(right) < 0) {
    forward.negate();
  }
  right = up.clone().cross(forward);
  if (right.length() < 0.001) {
    right = fallbackRight.clone();
  }
  right.normalize();
  forward = right.clone().cross(up);
  if (forward.length() < 0.001) {
    forward = fallbackForward.clone();
  }
  forward.normalize();
  if (MotionState.direction?.forward_sign === -1) {
    forward.negate();
  }
  const yawOffset = getDirectionYawRadians();
  if (Math.abs(yawOffset) > 0.000001) {
    forward.applyAxisAngle(up, yawOffset).normalize();
  }
  right = up.clone().cross(forward);
  if (right.length() < 0.001) {
    right = fallbackRight.clone();
  }
  right.normalize();

  const height = getRigHeight();
  return {
    right,
    up,
    forward,
    height,
    scale: Math.max(height / 1.82, 0.05),
  };
}

function projectOntoPlane(vector, normal) {
  const normalVector = normal.clone().normalize();
  return vector.clone().sub(normalVector.multiplyScalar(vector.dot(normalVector)));
}

function getRigHeight() {
  const points = HUMANOID_JOINT_NAMES.map((name) => getRestVector(name));
  const box = new THREE.Box3().setFromPoints(points);
  const size = new THREE.Vector3();
  box.getSize(size);
  const headToFeet = getRestVector("Head").distanceTo(
    getRestVector("R_Foot").add(getRestVector("L_Foot")).multiplyScalar(0.5),
  );
  return Math.max(size.y, headToFeet, 1);
}

function getRestLocalPosition(name, basis) {
  const delta = getRestVector(name).sub(getRestVector("Hips"));
  return {
    right: delta.dot(basis.right),
    up: delta.dot(basis.up),
    forward: delta.dot(basis.forward),
  };
}

function rigOffsetToWorld(offset, basis) {
  return basis.right.clone().multiplyScalar(offset[0])
    .add(basis.up.clone().multiplyScalar(offset[1]))
    .add(basis.forward.clone().multiplyScalar(offset[2]));
}

function getControlDef(controlId) {
  return IK_CONTROL_DEFS.find((item) => item.id === controlId);
}

function getIkControlWorldOffset(def, basis = getRigBasis()) {
  const offset = def.offset || [0, 0, 0];
  return rigOffsetToWorld(offset.map((value) => value * basis.scale), basis).toArray();
}

function resetRuntimeSourceBonesToRest() {
  if (Runtime.sourceBoneRestById.size === 0) {
    return false;
  }
  Runtime.sourceBoneRestById.forEach((rest, id) => {
    const bone = Runtime.sourceBoneById.get(id);
    if (!bone) {
      return;
    }
    bone.position.copy(rest.localPosition);
    bone.quaternion.copy(rest.localQuaternion);
    bone.scale.copy(rest.localScale);
    bone.updateMatrix();
  });
  Runtime.importedModelScene?.updateMatrixWorld(true);
  return true;
}

function getSourceBoneWorldPosition(sourceBoneOrId) {
  const sourceId = typeof sourceBoneOrId === "string" ? sourceBoneOrId : sourceBoneOrId?.id;
  const bone = sourceId ? Runtime.sourceBoneById.get(sourceId) : null;
  if (bone) {
    const position = new THREE.Vector3();
    bone.getWorldPosition(position);
    return position.toArray();
  }
  return typeof sourceBoneOrId === "object" ? sourceBoneOrId.position : null;
}

function setSourceBoneWorldPosition(bone, worldPosition) {
  if (!bone) {
    return;
  }
  const target = worldPosition.clone();
  if (bone.parent) {
    bone.parent.updateMatrixWorld(true);
    bone.parent.worldToLocal(target);
  }
  bone.position.copy(target);
  bone.updateMatrixWorld(true);
}

function setSourceBoneWorldQuaternion(bone, desiredWorldQuaternion) {
  if (!bone) {
    return;
  }
  const localQuaternion = desiredWorldQuaternion.clone();
  if (bone.parent) {
    const parentWorldQuaternion = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentWorldQuaternion);
    localQuaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion));
  }
  bone.quaternion.copy(localQuaternion);
  bone.updateMatrixWorld(true);
}

function shouldDriveHumanoidConnection(parent, child) {
  return !["R_UpperArm", "L_UpperArm", "R_UpperLeg", "L_UpperLeg"].includes(child);
}

function withExplicitJointRotation(jointName, baseWorldQuaternion) {
  const explicit = getJointRotationQuaternion(jointName);
  return explicit ? explicit.clone().multiply(baseWorldQuaternion).normalize() : baseWorldQuaternion;
}

function driveMappedSourceRigFromJoints(joints) {
  if (Runtime.sourceBoneById.size === 0 || getMappingCount() === 0 || !Array.isArray(joints) || joints.length === 0) {
    return false;
  }
  resetRuntimeSourceBonesToRest();
  const jointByName = new Map(joints.map((joint) => [joint.name, joint]));
  const hipsBone = getMappedSourceBoneObject("Hips");
  const hipsTarget = jointByName.get("Hips");
  if (hipsBone && hipsTarget) {
    setSourceBoneWorldPosition(hipsBone, new THREE.Vector3().fromArray(hipsTarget.position));
  }

  const explicitlyApplied = new Set();
  HUMANOID_BONE_CONNECTIONS.forEach(([parentName, childName]) => {
    if (!shouldDriveHumanoidConnection(parentName, childName)) {
      return;
    }
    const parentBone = getMappedSourceBoneObject(parentName);
    const parentRest = getMappedSourceRest(parentName);
    const childRest = getMappedSourceRest(childName);
    const targetParent = jointByName.get(parentName);
    const targetChild = jointByName.get(childName);
    if (!parentBone || !parentRest || !childRest || !targetParent || !targetChild) {
      return;
    }
    const restDir = childRest.worldPosition.clone().sub(parentRest.worldPosition);
    const targetDir = new THREE.Vector3().fromArray(targetChild.position).sub(new THREE.Vector3().fromArray(targetParent.position));
    if (restDir.length() < 0.001 || targetDir.length() < 0.001) {
      return;
    }
    restDir.normalize();
    targetDir.normalize();
    const deltaQuaternion = new THREE.Quaternion().setFromUnitVectors(restDir, targetDir);
    const desiredWorldQuaternion = withExplicitJointRotation(parentName, deltaQuaternion.multiply(parentRest.worldQuaternion));
    if (MotionState.joint_rotations?.[parentName]) {
      explicitlyApplied.add(parentName);
    }
    setSourceBoneWorldQuaternion(parentBone, desiredWorldQuaternion);
  });
  Object.keys(MotionState.joint_rotations || {}).forEach((jointName) => {
    if (explicitlyApplied.has(jointName)) {
      return;
    }
    const bone = getMappedSourceBoneObject(jointName);
    const rest = getMappedSourceRest(jointName);
    const explicit = getJointRotationQuaternion(jointName);
    if (!bone || !rest || !explicit) {
      return;
    }
    setSourceBoneWorldQuaternion(bone, explicit.clone().multiply(rest.worldQuaternion).normalize());
  });
  Runtime.importedModelScene?.updateMatrixWorld(true);
  return true;
}

function syncSourceRigToMotionState() {
  if (MotionState.skeleton?.id === "Humanoid_v1" && MotionState.joints.length > 0) {
    return driveMappedSourceRigFromJoints(MotionState.joints);
  }
  return resetRuntimeSourceBonesToRest();
}

function applyPoseAtFrame(frame) {
  if (MotionState.keyframes.length === 0 || !MotionState.skeleton) {
    MotionState.current_frame = clampFrame(frame);
    syncSourceRigToMotionState();
    return;
  }
  const pose = interpolatePose(clampFrame(frame));
  MotionState.joints = pose.joints;
  MotionState.joint_rotations = pose.joint_rotations || {};
  MotionState.ik_controls = pose.ik_controls;
  MotionState.current_frame = clampFrame(frame);
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function interpolatePose(frame) {
  const frames = getSortedKeyframes();
  if (frames.length === 1) {
    return deepClone(frames[0]);
  }
  let prev = frames[0];
  let next = frames[0];
  for (let index = 0; index < frames.length; index += 1) {
    const current = frames[index];
    const candidate = frames[index + 1] || { ...frames[0], timeline_frame: MotionState.total_frames + 1 };
    if (frame >= current.timeline_frame && frame < candidate.timeline_frame) {
      prev = current;
      next = candidate;
      break;
    }
  }
  if (frame >= frames[frames.length - 1].timeline_frame) {
    prev = frames[frames.length - 1];
    next = { ...frames[0], timeline_frame: MotionState.total_frames + 1 };
  }
  const span = Math.max(1, next.timeline_frame - prev.timeline_frame);
  const rawT = Math.max(0, Math.min(1, (frame - prev.timeline_frame) / span));
  const t = prev.interpolation === "smooth" || next.interpolation === "smooth" ? smoothStep(rawT) : rawT;
  return {
    pose_index: prev.pose_index,
    timeline_frame: frame,
    label: prev.label,
    joints: interpolateNamedArrays(prev.joints, next.joints, t),
    joint_rotations: interpolateJointRotations(prev.joint_rotations, next.joint_rotations, t),
    ik_controls: interpolateNamedArrays(prev.ik_controls, next.ik_controls, t, "id"),
    foot_locks: prev.foot_locks || {},
    template_id: prev.template_id,
  };
}

function getSortedKeyframes() {
  return [...MotionState.keyframes].sort((a, b) => a.timeline_frame - b.timeline_frame);
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function getQuaternionFromArray(value) {
  if (!Array.isArray(value) || value.length !== 4 || value.some((item) => !Number.isFinite(Number(item)))) {
    return null;
  }
  return new THREE.Quaternion(...value.map(Number)).normalize();
}

function isIdentityQuaternion(quaternion, epsilon = 0.000001) {
  return Math.abs(quaternion.x) < epsilon
    && Math.abs(quaternion.y) < epsilon
    && Math.abs(quaternion.z) < epsilon
    && Math.abs(quaternion.w - 1) < epsilon;
}

function interpolateJointRotations(a = {}, b = {}, t = 0) {
  const result = {};
  const names = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  names.forEach((name) => {
    const qa = getQuaternionFromArray(a?.[name]) || new THREE.Quaternion();
    const qb = getQuaternionFromArray(b?.[name]) || new THREE.Quaternion();
    const q = qa.clone().slerp(qb, t).normalize();
    if (!isIdentityQuaternion(q)) {
      result[name] = q.toArray();
    }
  });
  return result;
}

function interpolateNamedArrays(a, b, t, key = "name") {
  const bMap = new Map(b.map((item) => [item[key], item]));
  return a.map((item) => {
    const other = bMap.get(item[key]) || item;
    return {
      ...deepClone(item),
      position: lerpVec(item.position, other.position, t),
      rotation: item.rotation || other.rotation ? lerpVec(item.rotation || [0, 0, 0], other.rotation || [0, 0, 0], t) : item.rotation,
      scale: item.scale || other.scale ? lerpVec(item.scale || [1, 1, 1], other.scale || [1, 1, 1], t) : item.scale,
      locked: item.locked || other.locked || false,
    };
  });
}

function getControlRotationQuaternion(control) {
  const rotation = normalizeVec3(control?.rotation || [0, 0, 0], [0, 0, 0]);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], "XYZ"));
}

function getControlScaleFactor(control, previousControl) {
  const current = normalizeVec3(control?.scale || [1, 1, 1], [1, 1, 1], 0.05, 20);
  const previous = normalizeVec3(previousControl?.scale || [1, 1, 1], [1, 1, 1], 0.05, 20);
  const currentAverage = (current[0] + current[1] + current[2]) / 3;
  const previousAverage = Math.max((previous[0] + previous[1] + previous[2]) / 3, 0.0001);
  return currentAverage / previousAverage;
}

function rotateJointBranchByQuaternion(jointName, quaternion) {
  const joint = getJoint(jointName);
  if (!joint || !quaternion) {
    return false;
  }
  const normalized = quaternion.clone().normalize();
  if (EXPLICIT_ROTATION_JOINTS.has(jointName)) {
    accumulateJointRotation(jointName, normalized);
  }
  const pivot = new THREE.Vector3().fromArray(joint.position);
  getJointBranchNames(jointName)
    .filter((name) => name !== jointName)
    .forEach((name) => {
      const item = getJoint(name);
      if (!item) {
        return;
      }
      const point = new THREE.Vector3().fromArray(item.position).sub(pivot).applyQuaternion(normalized).add(pivot);
      item.position = point.toArray();
    });
  driveMappedSourceRigFromJoints(MotionState.joints);
  return true;
}

function applyControlToJoint(control, previousControl = null) {
  const joint = getJoint(control.target_joint);
  if (!joint) {
    return;
  }
  if (control.type === "pole") {
    applyPoleControl(control);
    return;
  }
  if (control.type === "joint") {
    moveJointBranch(control.target_joint, control.position);
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    MotionState.selected_bone = getBoneNameForJoint(control.target_joint) || MotionState.selected_bone;
    driveMappedSourceRigFromJoints(MotionState.joints);
    return;
  }
  if (["global", "root", "cog"].includes(control.type)) {
    const previousPosition = previousControl?.position || getControlPositionForDef(getControlDef(control.id), joint);
    const delta = subtractVec(control.position, previousPosition);
    translateSkeletonBy(delta);
    const previousRotation = getControlRotationQuaternion(previousControl || { rotation: [0, 0, 0] });
    const nextRotation = getControlRotationQuaternion(control);
    const deltaRotation = nextRotation.clone().multiply(previousRotation.clone().invert()).normalize();
    if (!isIdentityQuaternion(deltaRotation)) {
      rotateJointBranchByQuaternion("Hips", deltaRotation);
    }
    if (control.allow_scale && previousControl && control.scale) {
      const scaleFactor = getControlScaleFactor(control, previousControl);
      if (Math.abs(scaleFactor - 1) > 0.0001) {
        scaleJointBranch("Hips", scaleFactor);
      }
    }
    driveMappedSourceRigFromJoints(MotionState.joints);
    return;
  }
  if (["pelvis", "chest", "head"].includes(control.type)) {
    const previousRotation = getControlRotationQuaternion(previousControl || { rotation: [0, 0, 0] });
    const nextRotation = getControlRotationQuaternion(control);
    const deltaRotation = nextRotation.clone().multiply(previousRotation.clone().invert()).normalize();
    if (!isIdentityQuaternion(deltaRotation)) {
      rotateJointBranchByQuaternion(control.target_joint, deltaRotation);
    }
    driveMappedSourceRigFromJoints(MotionState.joints);
    return;
  }
  if (control.type === "hand") {
    solveTwoBoneIk(control.side, `${control.side}_UpperArm`, `${control.side}_Forearm`, `${control.side}_Hand`, control.position, `${control.side}_Elbow_Pole`);
    const previousRotation = getControlRotationQuaternion(previousControl || { rotation: [0, 0, 0] });
    const nextRotation = getControlRotationQuaternion(control);
    const deltaRotation = nextRotation.clone().multiply(previousRotation.clone().invert()).normalize();
    if (!isIdentityQuaternion(deltaRotation)) {
      accumulateJointRotation(control.target_joint, deltaRotation);
    }
  } else if (control.type === "foot") {
    solveTwoBoneIk(control.side, `${control.side}_UpperLeg`, `${control.side}_LowerLeg`, `${control.side}_Foot`, control.position, `${control.side}_Knee_Pole`);
    const toe = getJoint(`${control.side}_Toe`);
    const foot = getJoint(`${control.side}_Foot`);
    if (toe && foot) {
      const restToe = getRestVector(`${control.side}_Toe`);
      const restFoot = getRestVector(`${control.side}_Foot`);
      toe.position = addVec(foot.position, restToe.sub(restFoot).toArray());
    }
    const previousRotation = getControlRotationQuaternion(previousControl || { rotation: [0, 0, 0] });
    const nextRotation = getControlRotationQuaternion(control);
    const deltaRotation = nextRotation.clone().multiply(previousRotation.clone().invert()).normalize();
    if (!isIdentityQuaternion(deltaRotation)) {
      accumulateJointRotation(control.target_joint, deltaRotation);
    }
  }
  control.position = [...control.position];
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function solveTwoBoneIk(side, rootName, midName, endName, targetPosition, poleControlId) {
  const root = getJoint(rootName);
  const mid = getJoint(midName);
  const end = getJoint(endName);
  if (!root || !mid || !end) {
    return false;
  }
  const rootVec = new THREE.Vector3().fromArray(root.position);
  const oldMid = new THREE.Vector3().fromArray(mid.position);
  const oldEnd = new THREE.Vector3().fromArray(end.position);
  const targetRaw = new THREE.Vector3().fromArray(targetPosition);
  const upperLength = Math.max(rootVec.distanceTo(oldMid), getRestVector(rootName).distanceTo(getRestVector(midName)), 0.001);
  const lowerLength = Math.max(oldMid.distanceTo(oldEnd), getRestVector(midName).distanceTo(getRestVector(endName)), 0.001);
  const maxReach = Math.max(upperLength + lowerLength - 0.0001, 0.001);
  const minReach = Math.max(Math.abs(upperLength - lowerLength) + 0.0001, 0.001);
  let targetDelta = targetRaw.clone().sub(rootVec);
  if (targetDelta.length() < 0.001) {
    targetDelta = getRigBasis().forward.clone().multiplyScalar(0.001);
  }
  const distanceToTarget = THREE.MathUtils.clamp(targetDelta.length(), minReach, maxReach);
  const direction = targetDelta.clone().normalize();
  const target = rootVec.clone().addScaledVector(direction, distanceToTarget);
  const pole = MotionState.ik_controls.find((item) => item.id === poleControlId);
  const polePosition = pole ? new THREE.Vector3().fromArray(pole.position) : oldMid;
  let bendDirection = polePosition.clone().sub(rootVec);
  bendDirection.sub(direction.clone().multiplyScalar(bendDirection.dot(direction)));
  if (bendDirection.length() < 0.001) {
    bendDirection = oldMid.clone().sub(rootVec);
    bendDirection.sub(direction.clone().multiplyScalar(bendDirection.dot(direction)));
  }
  if (bendDirection.length() < 0.001) {
    bendDirection = getRigBasis().up.clone();
    bendDirection.sub(direction.clone().multiplyScalar(bendDirection.dot(direction)));
  }
  bendDirection.normalize();
  const along = (upperLength * upperLength + distanceToTarget * distanceToTarget - lowerLength * lowerLength) / (2 * distanceToTarget);
  const height = Math.sqrt(Math.max(upperLength * upperLength - along * along, 0));
  const newMid = rootVec.clone().addScaledVector(direction, along).addScaledVector(bendDirection, height);
  mid.position = newMid.toArray();
  end.position = target.toArray();
  return true;
}

function applyPoleControl(control) {
  const isElbow = control.id.includes("Elbow");
  const side = control.side;
  if (isElbow) {
    solveTwoBoneIk(side, `${side}_UpperArm`, `${side}_Forearm`, `${side}_Hand`, getJoint(`${side}_Hand`)?.position, control.id);
  } else {
    solveTwoBoneIk(side, `${side}_UpperLeg`, `${side}_LowerLeg`, `${side}_Foot`, getJoint(`${side}_Foot`)?.position, control.id);
  }
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function translateSkeletonBy(delta) {
  MotionState.joints.forEach((joint) => {
    joint.position = addVec(joint.position, delta);
  });
}

function getJointRotationQuaternion(jointName) {
  return getQuaternionFromArray(MotionState.joint_rotations?.[jointName]);
}

function accumulateJointRotation(jointName, quaternion) {
  if (!jointName || !quaternion || quaternion.length() < 0.000001) {
    return;
  }
  if (!MotionState.joint_rotations) {
    MotionState.joint_rotations = {};
  }
  const current = getJointRotationQuaternion(jointName) || new THREE.Quaternion();
  const next = quaternion.clone().multiply(current).normalize();
  if (isIdentityQuaternion(next)) {
    delete MotionState.joint_rotations[jointName];
  } else {
    MotionState.joint_rotations[jointName] = next.toArray();
  }
}

function moveJointBranch(jointName, targetPosition) {
  const joint = getJoint(jointName);
  if (!joint) {
    return false;
  }
  const constrained = constrainJointTargetToParent(jointName, new THREE.Vector3().fromArray(targetPosition));
  const delta = constrained.sub(new THREE.Vector3().fromArray(joint.position)).toArray();
  getJointBranchNames(jointName).forEach((name) => {
    const item = getJoint(name);
    if (item) {
      item.position = addVec(item.position, delta);
    }
  });
  return true;
}

function rotateJointBranch(jointName, angle, axis) {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle);
  return rotateJointBranchByQuaternion(jointName, quaternion);
}

function scaleJointBranch(jointName, scale) {
  const joint = getJoint(jointName);
  if (!joint) {
    return false;
  }
  const pivot = new THREE.Vector3().fromArray(joint.position);
  getJointBranchNames(jointName)
    .filter((name) => name !== jointName)
    .forEach((name) => {
      const item = getJoint(name);
      if (!item) {
        return;
      }
      const point = new THREE.Vector3().fromArray(item.position).sub(pivot).multiplyScalar(scale).add(pivot);
      item.position = point.toArray();
    });
  driveMappedSourceRigFromJoints(MotionState.joints);
  return true;
}

function constrainJointTargetToParent(jointName, target) {
  const parentName = HUMANOID_BONE_CONNECTIONS.find(([, child]) => child === jointName)?.[0];
  if (!parentName) {
    return target;
  }
  const parent = getJoint(parentName);
  const joint = getJoint(jointName);
  if (!parent || !joint) {
    return target;
  }
  const parentVec = new THREE.Vector3().fromArray(parent.position);
  const currentVec = new THREE.Vector3().fromArray(joint.position);
  const length = Math.max(parentVec.distanceTo(currentVec), getRestVector(parentName).distanceTo(getRestVector(jointName)), 0.001);
  const delta = target.clone().sub(parentVec);
  if (delta.length() < 0.001) {
    return currentVec;
  }
  return parentVec.add(delta.normalize().multiplyScalar(length));
}

function getJointBranchNames(rootName) {
  const result = new Set([rootName]);
  let changed = true;
  while (changed) {
    changed = false;
    HUMANOID_BONE_CONNECTIONS.forEach(([parent, child]) => {
      if (result.has(parent) && !result.has(child)) {
        result.add(child);
        changed = true;
      }
    });
  }
  return [...result];
}

function syncIkControlsToJoints(controls) {
  if (!controls.length) {
    return controls;
  }
  const basis = getRigBasis();
  return controls.map((control) => {
    const def = getControlDef(control.id);
    const joint = def ? getJoint(def.joint) : null;
    if (!def || !joint) {
      return control;
    }
    if (["hand", "foot", "pole"].includes(control.type)) {
      return {
        ...control,
        rotation: control.rotation || [0, 0, 0],
        scale: control.scale || [1, 1, 1],
      };
    }
    return {
      ...control,
      position: getControlPositionForDef(def, joint, basis),
      rotation: control.rotation || [0, 0, 0],
      scale: control.scale || [1, 1, 1],
    };
  });
}

function buildValidationReport() {
  const checks = {
    foot_sliding: "Passed",
    knee_flip: "Passed",
    loop_discontinuity: "Passed",
    bone_identity_error: "Passed",
  };
  const issues = [];

  if (!MotionState.skeleton || MotionState.skeleton.id !== "Humanoid_v1") {
    checks.bone_identity_error = "Missing Humanoid_v1 skeleton";
    issues.push({ code: "bone_identity_error", message: "缺少 Humanoid_v1 骨架" });
  }

  const jointNames = new Set(MotionState.joints.map((joint) => joint.name));
  HUMANOID_JOINT_NAMES.forEach((name) => {
    if (!jointNames.has(name)) {
      checks.bone_identity_error = "Missing fixed joint names";
      issues.push({ code: "bone_identity_error", message: `缺少关节 ${name}` });
    }
  });

  const basis = getRigBasis();
  const hips = getRestVector("Hips");
  const sideTolerance = basis.scale * 0.035;
  const rightIdentityError = MotionState.joints.some((joint) => (
    joint.name.startsWith("R_")
    && new THREE.Vector3().fromArray(joint.position).sub(hips).dot(basis.right) < -sideTolerance
  ));
  const leftIdentityError = MotionState.joints.some((joint) => (
    joint.name.startsWith("L_")
    && new THREE.Vector3().fromArray(joint.position).sub(hips).dot(basis.right) > sideTolerance
  ));
  if (rightIdentityError || leftIdentityError) {
    checks.bone_identity_error = "Left/right identity mismatch";
    issues.push({ code: "bone_identity_error", message: "左右关节身份与固定侧向位置不匹配" });
  }

  if (MotionState.source_bones.length > 0 && !MotionState.direction?.confirmed) {
    checks.bone_identity_error = "Character forward not confirmed";
    issues.push({ code: "bone_identity_error", message: "角色前方尚未确认，Walk_8F 可能前后反向" });
  }

  if (MotionState.keyframes.length < 8) {
    checks.foot_sliding = "Needs 8 key poses";
    checks.loop_discontinuity = "Needs 8 key poses";
    issues.push({ code: "foot_sliding", message: "Walk_8F 至少需要 8 个关键姿势" });
  } else {
    const maxLockedSlide = getMaxLockedFootSlide();
    if (maxLockedSlide > 0.18) {
      checks.foot_sliding = `Issue ${maxLockedSlide.toFixed(2)}m`;
      issues.push({ code: "foot_sliding", message: `锁定脚滑动 ${maxLockedSlide.toFixed(2)}m` });
    }
    const loopDelta = getLoopDiscontinuity();
    if (loopDelta > 0.34) {
      checks.loop_discontinuity = `Issue ${loopDelta.toFixed(2)}m`;
      issues.push({ code: "loop_discontinuity", message: `循环断点偏移 ${loopDelta.toFixed(2)}m` });
    }
  }

  const coreIkCount = MotionState.ik_controls.filter((control) => !control.is_joint_control).length;
  if (coreIkCount < CORE_IK_CONTROL_COUNT || MotionState.ik_controls.length < IK_CONTROL_DEFS.length) {
    checks.knee_flip = "IK controls missing";
    issues.push({ code: "knee_flip", message: `需要 ${CORE_IK_CONTROL_COUNT} 个 IK 控制器和 ${JOINT_CONTROL_DEFS.length} 个关节控制器` });
  } else {
    const poleForwardTolerance = basis.scale * 0.05;
    const badPole = MotionState.ik_controls.some((control) => {
      if (control.type !== "pole") {
        return false;
      }
      const targetJoint = getJoint(control.target_joint);
      if (!targetJoint) {
        return true;
      }
      const poleVector = new THREE.Vector3().fromArray(control.position).sub(new THREE.Vector3().fromArray(targetJoint.position));
      const expectedSign = getControlDef(control.id)?.pole_forward_sign || 1;
      return poleVector.dot(basis.forward) * expectedSign < poleForwardTolerance;
    });
    if (badPole) {
      checks.knee_flip = "Pole target behind limb";
      issues.push({ code: "knee_flip", message: "有一个极向目标位于肢体平面后方" });
    }
  }

  return {
    status: issues.length === 0 ? "Passed" : "Issues",
    checks,
    issues,
    checked_at: new Date().toISOString(),
  };
}

function getMaxLockedFootSlide() {
  let maxSlide = 0;
  ["R", "L"].forEach((side) => {
    let lockedPosition = null;
    MotionState.keyframes.forEach((keyframe) => {
      if (!keyframe.foot_locks?.[side]) {
        lockedPosition = null;
        return;
      }
      const foot = keyframe.ik_controls.find((control) => control.id === `${side}_Foot_IK`);
      if (!foot) {
        return;
      }
      if (!lockedPosition) {
        lockedPosition = foot.position;
      } else {
        maxSlide = Math.max(maxSlide, horizontalDistance(lockedPosition, foot.position));
      }
    });
  });
  return maxSlide;
}

function getLoopDiscontinuity() {
  const frame24 = interpolatePose(24);
  const frame1 = interpolatePose(1);
  const names = ["Hips", "R_Foot", "L_Foot", "R_Hand", "L_Hand"];
  let maxDelta = 0;
  names.forEach((name) => {
    const a = frame24.joints.find((joint) => joint.name === name);
    const b = frame1.joints.find((joint) => joint.name === name);
    if (a && b) {
      maxDelta = Math.max(maxDelta, distance(a.position, b.position));
    }
  });
  return maxDelta;
}

function inferFootLocksFromControls() {
  return {
    R: Boolean(MotionState.ik_controls.find((control) => control.id === "R_Foot_IK")?.locked),
    L: Boolean(MotionState.ik_controls.find((control) => control.id === "L_Foot_IK")?.locked),
  };
}

function getCoreIkControls() {
  return MotionState.ik_controls.filter((control) => !control.is_joint_control);
}

function getJointControls() {
  return MotionState.ik_controls.filter((control) => control.is_joint_control);
}

function getControlForJoint(jointName) {
  return MotionState.ik_controls.find((control) => control.target_joint === jointName && control.is_joint_control)
    || MotionState.ik_controls.find((control) => control.target_joint === jointName);
}

function getCurrentSmoothFrameRange() {
  const selected = Runtime.selectedTimelineFrames
    .filter((frame) => MotionState.keyframes.some((keyframe) => keyframe.timeline_frame === frame))
    .slice(-2);
  if (selected.length === 2) {
    return normalizeSmoothFrameRange(selected[0], selected[1]);
  }
  const sorted = getSortedKeyframes();
  if (sorted.length < 2) {
    return { from_frame: MotionState.current_frame, to_frame: MotionState.current_frame };
  }
  const exactIndex = sorted.findIndex((keyframe) => keyframe.timeline_frame === MotionState.current_frame);
  if (exactIndex >= 0) {
    const next = sorted[exactIndex + 1] || sorted[exactIndex - 1];
    const current = sorted[exactIndex];
    return normalizeSmoothFrameRange(current.timeline_frame, next.timeline_frame);
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (MotionState.current_frame > current.timeline_frame && MotionState.current_frame < next.timeline_frame) {
      return { from_frame: current.timeline_frame, to_frame: next.timeline_frame };
    }
  }
  return normalizeSmoothFrameRange(sorted[0].timeline_frame, sorted[1].timeline_frame);
}

function normalizeSmoothFrameRange(fromFrame, toFrame) {
  const from = clampFrame(Number(fromFrame) || MotionState.current_frame);
  const to = clampFrame(Number(toFrame) || MotionState.current_frame);
  return {
    from_frame: Math.min(from, to),
    to_frame: Math.max(from, to),
  };
}

function markTimelineFrameSelected(frame) {
  const targetFrame = clampFrame(frame);
  if (!MotionState.keyframes.some((keyframe) => keyframe.timeline_frame === targetFrame)) {
    return;
  }
  Runtime.selectedTimelineFrames = Runtime.selectedTimelineFrames.filter((item) => item !== targetFrame);
  Runtime.selectedTimelineFrames.push(targetFrame);
  if (Runtime.selectedTimelineFrames.length > 2) {
    Runtime.selectedTimelineFrames = Runtime.selectedTimelineFrames.slice(-2);
  }
}

function renderAll() {
  renderSceneObjects();
  renderUi();
}

function renderSceneObjects() {
  clearGroup(modelGroup, false);
  clearGroup(sourceSkeletonGroup);
  clearGroup(skeletonGroup);
  clearGroup(ikGroup);
  clearGroup(gizmoGroup);
  clearGroup(pathGroup);
  clearGroup(directionGroup);
  clearGroup(worldAxesGroup);
  clearGroup(labelGroup);
  clearGroup(validationGroup);

  grid.visible = MotionState.show.ground_plane;
  groundPlane.visible = MotionState.show.ground_plane;

  renderModel();
  renderSourceSkeletonOverlay();
  renderSkeleton();
  renderDirectionHint();
  renderWorldAxes();
  renderIkControls();
  renderTransformGizmo();
  renderMotionPaths();
  renderValidationIssues();
}

function renderModel() {
  if (!MotionState.show.model || !MotionState.model.loaded) {
    return;
  }
  if (MotionState.model.type === "glb_reference" && Runtime.importedModelScene) {
    const clone = SkeletonUtils.clone(Runtime.importedModelScene);
    clone.traverse((child) => {
      if (child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = MotionState.model.opacity;
      }
    });
    modelGroup.add(clone);
    return;
  }
  const material = new THREE.MeshStandardMaterial({
    color: 0x8b98aa,
    roughness: 0.72,
    metalness: 0.02,
    transparent: true,
    opacity: MotionState.model.opacity,
  });
  const dummy = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.62, 8, 18), material);
  body.position.set(0, 1.28, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), material);
  head.position.set(0, 1.86, 0);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.20), material);
  pelvis.position.set(0, 0.97, 0);
  dummy.add(body, head, pelvis);
  modelGroup.add(dummy);
}

function renderSourceSkeletonOverlay() {
  if (!MotionState.show.deform_skeleton || MotionState.source_bones.length === 0) {
    return;
  }
  const sourceById = new Map(MotionState.source_bones.map((bone) => [bone.id, bone]));
  const mappedJointBySourceId = new Map(Object.entries(MotionState.humanoid_mapping).map(([joint, sourceId]) => [sourceId, joint]));
  const visualScale = getSourceSkeletonVisualScale();
  MotionState.source_bones.forEach((bone) => {
    const color = getSideColor(bone.side_guess);
    const mappedJoint = mappedJointBySourceId.get(bone.id);
    const bonePosition = getSourceBoneWorldPosition(bone) || bone.position;
    const displayBone = { ...bone, position: bonePosition };
    const joint = createSourceJointHandle(displayBone, color, visualScale, mappedJoint);
    sourceSkeletonGroup.add(joint);
    if (bone.parent_id && sourceById.has(bone.parent_id)) {
      const parent = sourceById.get(bone.parent_id);
      const parentPosition = getSourceBoneWorldPosition(parent) || parent.position;
      sourceSkeletonGroup.add(createSourceBoneMesh(parentPosition, bonePosition, color, visualScale));
    }
    if (mappedJoint && MotionState.show.labels && isSourceBoneSelected(bone.id)) {
      labelGroup.add(makeLabel(translateBoneName(mappedJoint), addVec(bonePosition, [visualScale * 1.55, visualScale * 0.8, 0]), color, 0.028, 0.58));
    } else if (MotionState.show.labels && isSourceBoneSelected(bone.id) && bone.length > visualScale * 3) {
      labelGroup.add(makeLabel(bone.name, bonePosition, color, 0.034, 0.52));
    }
  });
}

function renderSkeleton() {
  if (!MotionState.show.deform_skeleton || !MotionState.skeleton) {
    return;
  }
  MotionState.bones.forEach((bone) => {
    const start = getJoint(bone.start);
    const end = getJoint(bone.end);
    if (!start || !end) {
      return;
    }
    const color = MotionState.show.bone_colors ? getSideColor(bone.side) : COLORS.neutral;
    skeletonGroup.add(createBoneMesh(start.position, end.position, color));
  });
  if (MotionState.show.joint_debug_controls) {
    MotionState.joints.forEach((joint) => {
      const color = MotionState.show.bone_colors ? getSideColor(joint.side) : COLORS.neutral;
      skeletonGroup.add(createHumanoidJointControl(joint, color));
      if (MotionState.show.labels && isJointSelected(joint.name)) {
        labelGroup.add(makeLabel(formatJointName(joint), joint.position, color, 0.046, 0.58));
      }
    });
  } else {
    MotionState.joints.forEach((joint) => {
      if (isJointSelected(joint.name)) {
        const color = MotionState.show.bone_colors ? getSideColor(joint.side) : COLORS.neutral;
        skeletonGroup.add(createHumanoidJointControl(joint, color));
      }
    });
  }
}

function isSourceBoneSelected(sourceBoneId) {
  return MotionState.selected_source_bone_id === sourceBoneId;
}

function createHumanoidJointControl(joint, color) {
  const group = new THREE.Group();
  group.position.fromArray(joint.position);
  group.quaternion.copy(getJointControlQuaternion(joint.name));
  group.userData = { type: "humanoid_joint", joint_name: joint.name, name: joint.name };
  const selected = isJointSelected(joint.name);
  const opacity = Math.min(0.76, MotionState.visual_opacity.skeleton + (selected ? 0.28 : 0.08));
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthTest: true,
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(selected ? "#ffffff" : color),
    transparent: true,
    opacity: Math.min(0.9, opacity + 0.12),
    depthTest: true,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.038), material);
  box.name = "jointBox";
  const socket = new THREE.Mesh(
    new THREE.BoxGeometry(0.034, 0.01, 0.034),
    new THREE.MeshBasicMaterial({ color: 0x06131d, transparent: true, opacity: 0.55, depthTest: true }),
  );
  socket.name = "jointSocket";
  socket.position.y = -0.035;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.082, 6), material.clone());
  shaft.name = "jointAngleArrowShaft";
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.set(0.05, 0.005, 0);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.032, 10), material.clone());
  head.name = "jointAngleArrowHead";
  head.rotation.z = -Math.PI / 2;
  head.position.set(0.1, 0.005, 0);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.058, 0.058, 0.058)), lineMaterial);
  outline.name = "jointOutline";
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  );
  hit.name = "jointHitArea";
  [box, socket, shaft, head, outline, hit].forEach((child) => {
    child.userData = group.userData;
  });
  group.add(box, socket, shaft, head, outline, hit);
  group.scale.setScalar(selected ? 1.16 : 1);
  return group;
}

function getJointControlQuaternion(jointName) {
  const joint = getJoint(jointName);
  if (!joint) {
    return new THREE.Quaternion();
  }
  const childName = HUMANOID_BONE_CONNECTIONS.find(([parent]) => parent === jointName)?.[1];
  const parentName = HUMANOID_BONE_CONNECTIONS.find(([, child]) => child === jointName)?.[0];
  const other = getJoint(childName) || getJoint(parentName);
  if (!other) {
    return new THREE.Quaternion();
  }
  const direction = new THREE.Vector3().fromArray(other.position).sub(new THREE.Vector3().fromArray(joint.position));
  if (direction.length() < 0.001) {
    return new THREE.Quaternion();
  }
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
}

function isJointSelected(jointName) {
  return MotionState.selected_bone === getBoneNameForJoint(jointName)
    || MotionState.ik_controls.find((control) => control.id === MotionState.selected_control)?.target_joint === jointName;
}

function renderIkControls() {
  if (!MotionState.show.control_rig) {
    return;
  }
  MotionState.ik_controls.filter(shouldRenderIkControl).forEach((control) => {
    const color = getSideColor(control.side);
    const mesh = createControlMesh(control, color);
    mesh.position.fromArray(control.position);
    ikGroup.add(mesh);
    if (shouldRenderIkControlLabel(control)) {
      const labelOffset = control.is_joint_control ? [0, 0.05, 0] : [0, 0.075, 0];
      labelGroup.add(makeLabel(getIkControlLabel(control), addVec(control.position, labelOffset), color, control.is_joint_control ? 0.034 : 0.043, 0.68));
    }
    if (MotionState.show.foot_locks && control.locked) {
      const lock = new THREE.Mesh(
        new THREE.RingGeometry(0.085, 0.102, 32),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: Math.min(0.55, MotionState.visual_opacity.controls + 0.08),
          side: THREE.DoubleSide,
          depthTest: true,
        }),
      );
      lock.rotation.x = -Math.PI / 2;
      lock.position.fromArray([control.position[0], 0.018, control.position[2]]);
      ikGroup.add(lock);
    }
  });
}

function shouldRenderIkControl(control) {
  if (!control?.is_joint_control) {
    if (["hand", "foot", "pole"].includes(control.type) && !MotionState.show.ik_controls) {
      return false;
    }
    return true;
  }
  return MotionState.show.joint_debug_controls || MotionState.selected_control === control.id;
}

function shouldPickIkControl(control) {
  return shouldRenderIkControl(control);
}

function shouldRenderIkControlLabel(control) {
  return MotionState.show.labels && (
    MotionState.selected_control === control.id
    || Runtime.hoveredControlId === control.id
  );
}

function getIkControlLabel(control) {
  if (control.id === "Global_CTRL") return "全局";
  if (control.id === "Root_CTRL") return "Root";
  if (control.id === "COG_CTRL") return "重心";
  if (control.id === "Pelvis_CTRL") return "腰";
  if (control.id === "Chest_CTRL") return "胸";
  if (control.id === "Head_CTRL") return "头";
  if (control.id === "R_Hand_IK") return "右手";
  if (control.id === "L_Hand_IK") return "左手";
  if (control.id === "R_Foot_IK") return "右脚";
  if (control.id === "L_Foot_IK") return "左脚";
  if (control.id === "R_Knee_Pole") return "右膝";
  if (control.id === "L_Knee_Pole") return "左膝";
  if (control.id === "R_Elbow_Pole") return "右肘";
  if (control.id === "L_Elbow_Pole") return "左肘";
  return control.is_joint_control ? translateBoneName(control.target_joint) : translateControlName(control.id);
}

function alignGroupToRigBasis(group) {
  const basis = getRigBasis();
  const matrix = new THREE.Matrix4().makeBasis(basis.right, basis.up, basis.forward);
  group.quaternion.setFromRotationMatrix(matrix);
}

function createControlMesh(control, color) {
  const group = new THREE.Group();
  group.userData = { type: "ik_control", control_id: control.id, name: control.id };
  const controlOpacity = MotionState.visual_opacity.controls;
  const selected = MotionState.selected_control === control.id;
  const hovered = Runtime.hoveredControlId === control.id;
  const visualBoost = selected ? 0.28 : hovered ? 0.18 : 0;
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(selected ? "#ffffff" : color),
    transparent: true,
    opacity: Math.min(0.98, controlOpacity + 0.34 + visualBoost),
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const panelMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: Math.min(0.2, controlOpacity * 0.28 + (selected || hovered ? 0.05 : 0)),
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const tube = getControlLineRadius(selected, hovered);
  if (control.type === "joint") {
    const size = selected || hovered ? 0.045 : 0.026;
    addControlSegment(group, new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size), tube, lineMaterial);
    addControlHitArea(group, selected || hovered ? 0.075 : 0.052);
    return group;
  }
  alignGroupToRigBasis(group);
  const controlScale = normalizeVec3(control.scale || [1, 1, 1], [1, 1, 1], 0.05, 20);
  const visualSize = getControlVisualSize();
  group.scale.set(controlScale[0] * visualSize, controlScale[1] * visualSize, controlScale[2] * visualSize);
  if (control.type === "global") {
    addControlCircle(group, 0.42, "xz", tube, lineMaterial, 96);
    addControlSegment(group, new THREE.Vector3(-0.36, 0, 0), new THREE.Vector3(0.36, 0, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, 0, -0.36), new THREE.Vector3(0, 0, 0.36), tube, lineMaterial);
    addControlHitArea(group, 0.46);
    return group;
  }
  if (control.type === "root") {
    addControlCircle(group, 0.17, "xz", tube, lineMaterial, 64);
    addControlRect(group, 0.24, 0.18, "xz", tube, lineMaterial);
    addControlHitArea(group, 0.23);
    return group;
  }
  if (control.type === "cog") {
    addControlCircle(group, 0.17, "xz", tube, lineMaterial, 72);
    addControlCircle(group, 0.14, "yz", tube, lineMaterial, 56);
    addControlSegment(group, new THREE.Vector3(0, -0.11, 0), new THREE.Vector3(0, 0.11, 0), tube, lineMaterial);
    addControlHitArea(group, 0.22);
    return group;
  }
  if (control.type === "pelvis") {
    addControlCircle(group, 0.15, "xz", tube, lineMaterial, 56);
    addControlSegment(group, new THREE.Vector3(-0.13, 0, 0), new THREE.Vector3(0.13, 0, 0), tube, lineMaterial);
    addControlHitArea(group, 0.19);
    return group;
  }
  if (control.type === "chest") {
    addControlCircle(group, 0.16, "yz", tube, lineMaterial, 64);
    addControlSegment(group, new THREE.Vector3(-0.12, 0, 0), new THREE.Vector3(0.12, 0, 0), tube, lineMaterial);
    addControlHitArea(group, 0.2);
    return group;
  }
  if (control.type === "head") {
    addControlCircle(group, 0.105, "yz", tube, lineMaterial, 48);
    addControlSegment(group, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.14), tube, lineMaterial);
    addControlHitArea(group, 0.15);
    return group;
  }
  if (control.type === "foot") {
    addControlPanel(group, 0.18, 0.12, "xz", panelMaterial);
    addControlRect(group, 0.2, 0.13, "xz", tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, 0, 0.06), new THREE.Vector3(0, 0, 0.15), tube, lineMaterial);
    addControlTriangle(group, 0.07, "xz", tube, lineMaterial, new THREE.Vector3(0, 0, 0.16));
    addControlHitArea(group, 0.16);
    return group;
  }
  if (control.type === "hand") {
    addControlPanel(group, 0.09, 0.07, "xy", panelMaterial);
    addControlRect(group, 0.105, 0.08, "xy", tube, lineMaterial);
    const wristSign = control.side === "R" ? -1 : 1;
    addControlSegment(group, new THREE.Vector3(wristSign * 0.045, 0, 0), new THREE.Vector3(wristSign * 0.105, 0, 0), tube, lineMaterial);
    addControlHitArea(group, 0.15);
    return group;
  }
  addControlTriangle(group, 0.11, "xy", tube, lineMaterial);
  addControlPanel(group, 0.08, 0.07, "xy", panelMaterial);
  addControlSegment(group, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.1), tube, lineMaterial);
  addControlHitArea(group, 0.16);
  return group;
}

function getControlVisualSize() {
  return clampNumber(MotionState.visual_opacity.control_size, 0.35, 1.6, 0.82);
}

function getControlLineRadius(selected = false, hovered = false) {
  const thickness = clampNumber(MotionState.visual_opacity.control_thickness, 0.35, 1.8, 0.72);
  return (selected ? 0.007 : hovered ? 0.006 : 0.0046) * thickness;
}

function tagControlObject(group, object) {
  object.userData = group.userData;
  object.renderOrder = 26;
  return object;
}

function addControlCircle(group, radius, plane, tube, material, segments = 56) {
  const ring = tagControlObject(group, new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 6, segments),
    material.clone(),
  ));
  if (plane === "xz") {
    ring.rotation.x = Math.PI / 2;
  } else if (plane === "yz") {
    ring.rotation.y = Math.PI / 2;
  }
  group.add(ring);
  return ring;
}

function addControlRect(group, width, height, plane, tube, material) {
  const points = getPlaneRectPoints(width, height, plane);
  for (let index = 0; index < points.length; index += 1) {
    addControlSegment(group, points[index], points[(index + 1) % points.length], tube, material);
  }
}

function addControlTriangle(group, size, plane, tube, material, offset = new THREE.Vector3()) {
  const half = size * 0.5;
  const points = plane === "xz"
    ? [
        new THREE.Vector3(0, 0, half),
        new THREE.Vector3(-half, 0, -half),
        new THREE.Vector3(half, 0, -half),
      ]
    : [
        new THREE.Vector3(0, half, 0),
        new THREE.Vector3(-half, -half, 0),
        new THREE.Vector3(half, -half, 0),
      ];
  const translated = points.map((point) => point.clone().add(offset));
  for (let index = 0; index < translated.length; index += 1) {
    addControlSegment(group, translated[index], translated[(index + 1) % translated.length], tube, material);
  }
}

function addControlPanel(group, width, height, plane, material) {
  const panel = tagControlObject(group, new THREE.Mesh(new THREE.PlaneGeometry(width, height), material.clone()));
  if (plane === "xz") {
    panel.rotation.x = -Math.PI / 2;
  } else if (plane === "yz") {
    panel.rotation.y = Math.PI / 2;
  }
  group.add(panel);
  return panel;
}

function addControlSegment(group, start, end, radius, material) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length < 0.0001) {
    return null;
  }
  const segment = tagControlObject(group, new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 6),
    material.clone(),
  ));
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  group.add(segment);
  return segment;
}

function getPlaneRectPoints(width, height, plane) {
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  if (plane === "xz") {
    return [
      new THREE.Vector3(-halfW, 0, -halfH),
      new THREE.Vector3(halfW, 0, -halfH),
      new THREE.Vector3(halfW, 0, halfH),
      new THREE.Vector3(-halfW, 0, halfH),
    ];
  }
  if (plane === "yz") {
    return [
      new THREE.Vector3(0, -halfW, -halfH),
      new THREE.Vector3(0, halfW, -halfH),
      new THREE.Vector3(0, halfW, halfH),
      new THREE.Vector3(0, -halfW, halfH),
    ];
  }
  return [
    new THREE.Vector3(-halfW, -halfH, 0),
    new THREE.Vector3(halfW, -halfH, 0),
    new THREE.Vector3(halfW, halfH, 0),
    new THREE.Vector3(-halfW, halfH, 0),
  ];
}

function addControlHitArea(group, radius) {
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  hit.userData = group.userData;
  group.add(hit);
}

function renderTransformGizmo() {
  if (!MotionState.show.transform_gizmo || !MotionState.selected_control || !MotionState.show.control_rig) {
    return;
  }
  const control = MotionState.ik_controls.find((item) => item.id === MotionState.selected_control && !item.is_joint_control);
  if (!control) {
    return;
  }
  const basis = getRigBasis();
  const position = new THREE.Vector3().fromArray(control.position);
  const size = Math.max(0.18 * basis.scale, 0.12);
  const mode = Runtime.transformMode || MotionState.transform.tool || "translate";
  const axes = [
    { key: "x", color: 0xff4242, vector: MotionState.transform.space === "local" ? basis.right : new THREE.Vector3(1, 0, 0), label: "X" },
    { key: "y", color: 0x49e85f, vector: MotionState.transform.space === "local" ? basis.up : new THREE.Vector3(0, 1, 0), label: "Y" },
    { key: "z", color: 0x3d6dff, vector: MotionState.transform.space === "local" ? basis.forward : new THREE.Vector3(0, 0, 1), label: "Z" },
  ];
  axes.forEach((axis) => {
    if (mode === "rotate") {
      gizmoGroup.add(createGizmoRing(position, axis.vector, size * 0.88, axis.color));
      gizmoGroup.add(makeLabel(axis.label, position.clone().addScaledVector(axis.vector.clone().normalize(), size * 1.05).toArray(), `#${axis.color.toString(16).padStart(6, "0")}`, 0.032, 0.82));
    } else if (mode === "scale") {
      gizmoGroup.add(createGizmoScaleAxis(position, axis.vector, size, axis.color));
      gizmoGroup.add(makeLabel(axis.label, position.clone().addScaledVector(axis.vector.clone().normalize(), size * 1.1).toArray(), `#${axis.color.toString(16).padStart(6, "0")}`, 0.032, 0.82));
    } else {
      gizmoGroup.add(createGizmoTranslateAxis(position, axis.vector, size, axis.color));
      gizmoGroup.add(makeLabel(axis.label, position.clone().addScaledVector(axis.vector.clone().normalize(), size * 1.12).toArray(), `#${axis.color.toString(16).padStart(6, "0")}`, 0.032, 0.82));
    }
  });
  if (mode === "rotate") {
    const viewAxis = getCameraViewAxis();
    gizmoGroup.add(createGizmoRing(position, viewAxis, size * 1.18, 0xffffff, 0.92, 0.006));
    gizmoGroup.add(createGizmoRing(position, viewAxis, size * 0.55, 0xffffff, 0.72, 0.004));
    renderRotationDragGuide(position, viewAxis);
  }
}

function createGizmoTranslateAxis(origin, axis, length, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false });
  const direction = axis.clone().normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, length, 8), material);
  shaft.quaternion.copy(rotation);
  shaft.position.copy(origin).addScaledVector(direction, length * 0.5);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.075, 14), material.clone());
  head.quaternion.copy(rotation);
  head.position.copy(origin).addScaledVector(direction, length);
  group.add(shaft, head);
  return group;
}

function createGizmoScaleAxis(origin, axis, length, color) {
  const group = createGizmoTranslateAxis(origin, axis, length * 0.82, color);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), material);
  box.position.copy(origin).addScaledVector(axis.clone().normalize(), length * 0.92);
  group.add(box);
  return group;
}

function createGizmoRing(origin, axis, radius, color, opacity = 0.82, tube = 0.004) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 72), material);
  ring.position.copy(origin);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  return ring;
}

function renderRotationDragGuide(origin, viewAxis) {
  const pointer = Runtime.transformCurrentPointer || Runtime.lastPointer;
  if (!Runtime.transformMode || Runtime.transformMode !== "rotate" || !pointer) {
    return;
  }
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewAxis.clone().normalize(), origin);
  const pointerPoint = getPointerPlanePointFromScreen(pointer.x, pointer.y, plane);
  if (!pointerPoint || pointerPoint.distanceTo(origin) < 0.015) {
    return;
  }
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86, depthTest: false });
  const line = createWorldSegment(origin, pointerPoint, 0.006, material);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), material.clone());
  dot.position.copy(pointerPoint);
  gizmoGroup.add(line, dot);
}

function createWorldSegment(start, end, radius, material) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material);
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return segment;
}

function renderMotionPaths() {
  if (!MotionState.show.motion_paths || MotionState.keyframes.length === 0) {
    return;
  }
  ["R_Foot_IK", "L_Foot_IK", "R_Hand_IK", "L_Hand_IK"].forEach((controlId) => {
    const points = MotionState.keyframes
      .map((keyframe) => keyframe.ik_controls.find((control) => control.id === controlId)?.position)
      .filter(Boolean)
      .map((position) => new THREE.Vector3().fromArray(position));
    if (points.length < 2) {
      return;
    }
    const color = controlId.startsWith("R_") ? COLORS.right : COLORS.left;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: Math.min(0.62, MotionState.visual_opacity.controls + 0.08),
      }),
    );
    pathGroup.add(line);
  });
}

function renderValidationIssues() {
  if (!MotionState.show.validation_issues || MotionState.validation_report.status !== "Issues") {
    return;
  }
  MotionState.validation_report.issues.forEach((issue, index) => {
    const pos = [-0.45 + index * 0.16, 2.12, 0];
    validationGroup.add(makeLabel(translateIssueCode(issue.code), pos, COLORS.issue, 0.075));
  });
}

function renderDirectionHint() {
  if (!["skeleton", "mapping"].includes(Runtime.stage) || !MotionState.skeleton || MotionState.joints.length === 0) {
    return;
  }
  const hips = getJoint("Hips") || MotionState.joints[0];
  const basis = getRigBasis();
  const start = new THREE.Vector3().fromArray(hips.position).addScaledVector(basis.up, -0.1 * basis.scale);
  const length = Math.max(0.42 * basis.scale, 0.22);
  const end = start.clone().addScaledVector(basis.forward, length);
  const direction = end.clone().sub(start);
  if (direction.length() < 0.001) {
    return;
  }
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(COLORS.warn),
    transparent: true,
    opacity: MotionState.direction?.confirmed ? 0.72 : 0.92,
    depthTest: false,
  });
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, direction.length(), 8), material);
  shaft.position.copy(start).add(end).multiplyScalar(0.5);
  shaft.quaternion.copy(rotation);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 16), material.clone());
  head.position.copy(end);
  head.quaternion.copy(rotation);
  shaft.renderOrder = 32;
  head.renderOrder = 33;
  directionGroup.add(shaft, head);
  const label = MotionState.direction?.confirmed ? "角色前方" : "待确认前方";
  labelGroup.add(makeLabel(label, end.clone().addScaledVector(basis.up, 0.11 * basis.scale).toArray(), COLORS.warn, 0.04, 0.68));
}

function renderWorldAxes() {
  if (!MotionState.show.ground_plane) {
    return;
  }
  const origin = new THREE.Vector3(0, 0.025, 0);
  const length = Math.max(0.48 * getRigBasis().scale, 0.34);
  [
    { label: "X", color: 0xff4242, axis: new THREE.Vector3(1, 0, 0) },
    { label: "Y", color: 0x49e85f, axis: new THREE.Vector3(0, 1, 0) },
    { label: "Z", color: 0x3d6dff, axis: new THREE.Vector3(0, 0, 1) },
  ].forEach((item) => {
    worldAxesGroup.add(createGizmoTranslateAxis(origin, item.axis, length, item.color));
    const labelPosition = origin.clone().addScaledVector(item.axis, length * 1.12);
    worldAxesGroup.add(makeLabel(item.label, labelPosition.toArray(), `#${item.color.toString(16).padStart(6, "0")}`, 0.034, 0.78));
  });
}

function renderUi() {
  el.flowSteps.forEach((button) => button.classList.toggle("is-active", button.dataset.stage === Runtime.stage));
  el.toolButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tool === MotionState.transform.tool));
  if (el.spaceToggleButton) {
    el.spaceToggleButton.textContent = MotionState.transform.space === "local" ? "Local" : "Global";
    el.spaceToggleButton.classList.toggle("is-active", MotionState.transform.space === "local");
  }
  el.snapToggleButton?.classList.toggle("is-active", MotionState.transform.snap);
  el.mirrorToggleButton?.classList.toggle("is-active", MotionState.transform.mirror);
  el.panels.forEach((panel) => {
    const activePanel = Runtime.stage === "mapping" ? "skeleton" : Runtime.stage === "control_rig" ? "ik" : Runtime.stage;
    panel.classList.toggle("is-active", panel.dataset.panel === activePanel);
  });

  el.statusModel.textContent = MotionState.model.loaded ? "已加载" : "无";
  el.statusSkeleton.textContent = MotionState.skeleton?.id ? translateSkeletonId(MotionState.skeleton.id) : "缺失";
  el.statusIk.textContent = `${getCoreIkControls().length} Rig + ${getJointControls().length} Debug`;
  el.statusKeyframes.textContent = `${MotionState.keyframes.length} / ${MotionState.total_frames}`;
  el.statusFrame.textContent = `${MotionState.current_frame} / ${MotionState.total_frames}`;
  el.statusDirty.textContent = MotionState.dirty_state ? "是" : "否";
  el.statusValidation.textContent = translateStatus(MotionState.validation_report.status);
  el.statusValidation.className = MotionState.validation_report.status === "Passed" ? "ok" : "warn";

  el.timelineKeyPoseCount.textContent = `${MotionState.keyframes.length} / ${MotionState.total_frames}`;
  el.timelineLoopState.textContent = Runtime.loop ? "开" : "关";
  el.loopToggle.checked = Runtime.loop;
  el.modelOpacityInput.value = String(MotionState.model.opacity);
  el.modelOpacityValue.textContent = MotionState.model.opacity.toFixed(2);
  el.viewportModelOpacityInput.value = String(MotionState.model.opacity);
  el.viewportModelOpacityValue.textContent = MotionState.model.opacity.toFixed(2);
  el.skeletonOpacityInput.value = String(MotionState.visual_opacity.skeleton);
  el.skeletonOpacityValue.textContent = MotionState.visual_opacity.skeleton.toFixed(2);
  el.controlOpacityInput.value = String(MotionState.visual_opacity.controls);
  el.controlOpacityValue.textContent = MotionState.visual_opacity.controls.toFixed(2);
  if (el.controlSizeInput && el.controlSizeValue) {
    el.controlSizeInput.value = String(MotionState.visual_opacity.control_size ?? 0.82);
    el.controlSizeValue.textContent = (MotionState.visual_opacity.control_size ?? 0.82).toFixed(2);
  }
  if (el.controlThicknessInput && el.controlThicknessValue) {
    el.controlThicknessInput.value = String(MotionState.visual_opacity.control_thickness ?? 0.72);
    el.controlThicknessValue.textContent = (MotionState.visual_opacity.control_thickness ?? 0.72).toFixed(2);
  }
  el.characterForwardValue.textContent = formatCharacterForwardState();
  if (el.forwardAngleInput && el.forwardAngleValue) {
    const yaw = normalizeForwardYaw(MotionState.direction?.yaw_degrees || 0);
    el.forwardAngleInput.value = String(yaw);
    el.forwardAngleValue.textContent = `${yaw}°`;
  }
  el.timelineFrameSlider.value = String(MotionState.current_frame);
  el.timelineCurrentFrameValue.textContent = `${MotionState.current_frame} / ${MotionState.total_frames}`;
  setCheckboxValue("#showModel", MotionState.show.model);
  setCheckboxValue("#showDeformSkeleton", MotionState.show.deform_skeleton);
  setCheckboxValue("#showControlRig", MotionState.show.control_rig);
  setCheckboxValue("#showIkControls", MotionState.show.ik_controls);
  setCheckboxValue("#showJointDebugControls", MotionState.show.joint_debug_controls);
  setCheckboxValue("#showLabels", MotionState.show.labels);
  setCheckboxValue("#showTransformGizmo", MotionState.show.transform_gizmo);
  setCheckboxValue("#showFootLocks", MotionState.show.foot_locks);
  setCheckboxValue("#showMotionPaths", MotionState.show.motion_paths);
  setCheckboxValue("#showGroundPlane", MotionState.show.ground_plane);
  setCheckboxValue("#showValidationIssues", MotionState.show.validation_issues);

  renderTimeline();
  renderMappingPanel();
  renderBoneInspector();
  renderControlInspector();
  renderKeyframeList();
  renderValidationPanel();
  renderDebugPanel();
  if (MotionState.exported_json && document.activeElement !== el.motionJsonText) {
    el.motionJsonText.value = MotionState.exported_json;
  }
}

function setCheckboxValue(selector, value) {
  const input = document.querySelector(selector);
  if (input) {
    input.checked = Boolean(value);
  }
}

function renderTimeline() {
  const keyframeByFrame = new Map(MotionState.keyframes.map((keyframe) => [keyframe.timeline_frame, keyframe]));
  el.timelineKeyframes.innerHTML = WALK_KEY_POSES.map((pose) => {
    const keyframe = keyframeByFrame.get(pose.timeline_frame);
    const currentPose = Math.max(1, Math.min(8, Math.floor(((MotionState.current_frame - 1) / 3) + 1)));
    return `
      <button class="key-pose ${keyframe ? "has-keyframe" : ""} ${currentPose === pose.index ? "is-current" : ""} ${keyframe?.interpolation === "smooth" ? "is-smooth" : ""} ${Runtime.selectedTimelineFrames.includes(pose.timeline_frame) ? "is-selected" : ""}" data-frame="${pose.timeline_frame}">
        <strong>姿势 ${String(pose.index).padStart(2, "0")}</strong>
        <span>${translatePoseLabel(pose.label)}</span>
        <span>${keyframe?.interpolation === "smooth" ? "平滑" : `时间轴 ${pose.timeline_frame}`}</span>
      </button>
    `;
  }).join("");
  el.timelineKeyframes.querySelectorAll(".key-pose").forEach((button) => {
    button.addEventListener("click", () => {
      markTimelineFrameSelected(Number(button.dataset.frame));
      executeCommand(createCommand("set_current_frame", { frame: Number(button.dataset.frame) }));
    });
  });
  el.timelineFrameTicks.innerHTML = Array.from({ length: MotionState.total_frames }, (_, index) => {
    const frame = index + 1;
    const keyframe = keyframeByFrame.get(frame);
    return `
      <button class="frame-tick ${keyframe ? "has-keyframe" : ""} ${frame === MotionState.current_frame ? "is-current" : ""} ${keyframe?.interpolation === "smooth" ? "is-smooth" : ""} ${Runtime.selectedTimelineFrames.includes(frame) ? "is-selected" : ""}" data-frame="${frame}" title="第 ${frame} 帧${keyframe ? " · 已保存" : ""}">
        ${String(frame).padStart(2, "0")}
      </button>
    `;
  }).join("");
  el.timelineFrameTicks.querySelectorAll(".frame-tick").forEach((button) => {
    button.addEventListener("click", () => {
      markTimelineFrameSelected(Number(button.dataset.frame));
      executeCommand(createCommand("set_current_frame", { frame: Number(button.dataset.frame) }));
    });
  });
}

function renderMappingPanel() {
  const sourceById = new Map(MotionState.source_bones.map((bone) => [bone.id, bone]));
  const assignedBySourceId = new Map(Object.entries(MotionState.humanoid_mapping).map(([joint, sourceId]) => [sourceId, joint]));
  el.sourceBoneCountValue.textContent = String(MotionState.source_bones.length);
  el.restPoseValue.textContent = MotionState.source_bones.length > 0
    ? MotionState.rest_pose
    : MotionState.import_diagnostics.skins === 0 && MotionState.model.loaded
      ? "无 glTF skin"
      : "未读取";
  const optionalFallbackCount = getOptionalFallbackHumanoidMappings().length;
  el.mappingCountValue.textContent = optionalFallbackCount > 0 && hasRequiredHumanoidMapping()
    ? `${getMappingCount()} / ${HUMANOID_JOINT_NAMES.length}（脚尖自动补）`
    : `${getMappingCount()} / ${HUMANOID_JOINT_NAMES.length}`;
  el.humanoidJointList.innerHTML = HUMANOID_JOINT_NAMES.map((joint) => {
    const sourceBone = sourceById.get(MotionState.humanoid_mapping[joint]);
    const isOptionalFallback = !sourceBone
      && OPTIONAL_HUMANOID_MAPPING_JOINTS.has(joint)
      && hasRequiredHumanoidMapping();
    return `
      <div class="mapping-chip ${sourceBone ? "is-mapped" : isOptionalFallback ? "is-fallback" : ""}" draggable="true" data-humanoid-joint="${joint}">
        <strong>${translateBoneName(joint)}</strong>
        <span>${sourceBone ? sourceBone.name : isOptionalFallback ? "脚尖自动补位" : "拖到右侧导入骨骼"}</span>
      </div>
    `;
  }).join("");
  if (MotionState.source_bones.length === 0) {
    const diagnosticText = MotionState.model.loaded
      ? `GLB skins ${MotionState.import_diagnostics.skins} · joints ${MotionState.import_diagnostics.joints} · nodes ${MotionState.import_diagnostics.nodes}`
      : "请先导入 GLB";
    el.sourceBoneList.innerHTML = `
      <div class="source-bone-row">
        <strong>未读取到 glTF 骨骼</strong>
        <span>${diagnosticText}</span>
        <em>可点“视觉辅助适配骨架”按模型轮廓估算</em>
      </div>
    `;
    return;
  }
  el.sourceBoneList.innerHTML = MotionState.source_bones.map((bone) => {
    const assignedJoint = assignedBySourceId.get(bone.id);
    const selected = MotionState.selected_source_bone_id === bone.id;
    return `
      <div class="source-bone-row ${assignedJoint ? "is-assigned" : ""} ${selected ? "is-selected" : ""}" data-source-bone-id="${bone.id}">
        <strong>${bone.name}</strong>
        <span>${translateSide(bone.side_guess)} · 深度 ${bone.depth} · 长度 ${bone.length.toFixed(2)}m</span>
        <em>${assignedJoint ? `已绑定：${translateBoneName(assignedJoint)}` : "拖入标准关节点名来吸附赋值"}</em>
      </div>
    `;
  }).join("");
}

function renderBoneInspector() {
  if (MotionState.bones.length === 0 && MotionState.source_bones.length > 0) {
    renderSourceBoneInspector();
    return;
  }
  const options = MotionState.bones.map((bone) => `<option value="${bone.name}">${formatBoneName(bone)}</option>`).join("");
  if (el.selectedBoneSelect.innerHTML !== options) {
    el.selectedBoneSelect.innerHTML = options;
  }
  el.selectedBoneSelect.value = MotionState.selected_bone || "";
  const bone = MotionState.bones.find((item) => item.name === MotionState.selected_bone);
  el.boneNameValue.textContent = bone ? formatBoneName(bone) : "无";
  el.boneParentValue.textContent = bone?.parent ? formatParentBoneName(bone) : "无";
  el.boneLengthValue.textContent = bone ? `${bone.length.toFixed(2)}m` : "0.00m";
  el.boneSideValue.textContent = translateSide(bone?.side || "Center");
  el.boneColorRuleValue.textContent = translateColorRule(bone?.color_rule || "Center = 绿色");
}

function renderSourceBoneInspector() {
  const options = MotionState.source_bones.map((bone) => `<option value="${bone.id}">${bone.name}</option>`).join("");
  if (el.selectedBoneSelect.innerHTML !== options) {
    el.selectedBoneSelect.innerHTML = options;
  }
  el.selectedBoneSelect.value = MotionState.selected_source_bone_id || "";
  const bone = MotionState.source_bones.find((item) => item.id === MotionState.selected_source_bone_id);
  el.boneNameValue.textContent = bone?.name || "无";
  el.boneParentValue.textContent = bone?.parent || "无";
  el.boneLengthValue.textContent = bone ? `${bone.length.toFixed(2)}m` : "0.00m";
  el.boneSideValue.textContent = translateSide(bone?.side_guess || "Center");
  el.boneColorRuleValue.textContent = translateColorRule(getColorRule(bone?.side_guess || "Center"));
}

function renderControlInspector() {
  const options = MotionState.ik_controls.map((control) => `<option value="${control.id}">${translateControlName(control.id)}</option>`).join("");
  if (el.selectedControlSelect.innerHTML !== options) {
    el.selectedControlSelect.innerHTML = options;
  }
  el.selectedControlSelect.value = MotionState.selected_control || "";
  const control = MotionState.ik_controls.find((item) => item.id === MotionState.selected_control);
  if (control && document.activeElement !== el.ikTargetX && document.activeElement !== el.ikTargetY && document.activeElement !== el.ikTargetZ) {
    el.ikTargetX.value = control.position[0].toFixed(2);
    el.ikTargetY.value = control.position[1].toFixed(2);
    el.ikTargetZ.value = control.position[2].toFixed(2);
  }
}

function renderKeyframeList() {
  if (MotionState.keyframes.length === 0) {
    el.keyframeList.innerHTML = "<div class=\"keyframe-item\"><span>-</span><strong>暂无关键帧</strong><span></span></div>";
    return;
  }
  el.keyframeList.innerHTML = MotionState.keyframes.map((keyframe) => `
    <div class="keyframe-item">
      <span>F${String(keyframe.timeline_frame).padStart(2, "0")}</span>
      <strong>${translatePoseLabel(keyframe.label)}</strong>
      <span>${keyframe.interpolation === "smooth" ? "平滑" : "线性"}</span>
    </div>
  `).join("");
}

function renderValidationPanel() {
  const report = MotionState.validation_report;
  el.validationSummary.textContent = translateStatus(report.status);
  el.validationFootSliding.textContent = translateCheckStatus(report.checks.foot_sliding);
  el.validationKneeFlip.textContent = translateCheckStatus(report.checks.knee_flip);
  el.validationLoop.textContent = translateCheckStatus(report.checks.loop_discontinuity);
  el.validationIdentity.textContent = translateCheckStatus(report.checks.bone_identity_error);
}

function renderDebugPanel() {
  const last = Runtime.lastCommand;
  el.debugLastCommand.textContent = last?.name ? translateCommandName(last.name) : "无";
  el.debugLastResult.textContent = last?.result ? JSON.stringify(localizeDebugResult(last.result), null, 2) : "无";
  el.debugLastError.textContent = last?.error || "无";
  el.debugUndoCount.textContent = String(MotionState.undo_stack.length);
  el.debugRedoCount.textContent = String(MotionState.redo_stack.length);
  el.debugCommandLog.innerHTML = MotionState.command_log.slice(-20).reverse().map((entry) => `
    <li><strong>${translateCommandName(entry.name)}</strong> 状态：${translateCommandStatus(entry.status)}${entry.args?.template_id ? ` 模板：${entry.args.template_id}` : ""}</li>
  `).join("");
  el.debugStateSummary.textContent = JSON.stringify(getLocalizedMotionStateSummary(), null, 2);
  el.debugValidationReport.textContent = JSON.stringify(getLocalizedValidationReport(), null, 2);
}

function translateStage(stage) {
  return {
    model: "模型",
    skeleton: "骨架",
    mapping: "映射",
    control_rig: "Control Rig",
    ik: "IK 控制器",
    motion: "动作模板",
    validate: "验证 / 修正",
    export: "导出",
  }[stage] || stage;
}

function translateSkeletonId(id) {
  return {
    Humanoid_v1: "人形骨架 v1",
    SourceRig_v1: "适配源骨架 v1",
  }[id] || id;
}

function formatCharacterForwardState() {
  const directionText = MotionState.direction?.forward_sign === -1 ? "已前后反转" : "使用当前前方";
  const yaw = normalizeForwardYaw(MotionState.direction?.yaw_degrees || 0);
  const angleText = yaw === 0 ? "角度 0°" : `角度 ${yaw > 0 ? "+" : ""}${yaw}°`;
  return MotionState.direction?.confirmed ? `${directionText} / ${angleText} / 已确认` : `${directionText} / ${angleText} / 待确认`;
}

function formatDirectionCommandMessage(sign, yaw, confirmed) {
  const base = sign === 1 ? "当前前方" : "前后反转";
  const angle = yaw === 0 ? "0°" : `${yaw > 0 ? "+" : ""}${yaw}°`;
  return confirmed ? `已确认角色前方：${base}，角度 ${angle}` : `已调整角色前方角度：${base}，角度 ${angle}，请确认`;
}

function translateViewOption(key) {
  return {
    model: "模型",
    deform_skeleton: "变形骨骼",
    control_rig: "Control Rig",
    joint_debug_controls: "关节 Debug 控制",
    labels: "标签",
    transform_gizmo: "Transform Gizmo",
    skeleton_labels: "骨架标签",
    ik_controls: "IK 控制器",
    bone_colors: "骨骼颜色",
    foot_locks: "脚底锁定",
    motion_paths: "运动路径",
    ground_plane: "地面",
    validation_issues: "验证问题",
  }[key] || key;
}

function translateStatus(status) {
  return {
    Passed: "已通过",
    Issues: "有问题",
    "Not run": "未运行",
  }[status] || status;
}

function translateCheckStatus(status) {
  if (!status) {
    return "未运行";
  }
  if (status.startsWith("Issue ")) {
    return status.replace("Issue ", "问题 ");
  }
  return {
    Passed: "已通过",
    "Not run": "未运行",
    "Needs 8 key poses": "需要 8 个关键姿势",
    "Missing Humanoid_v1 skeleton": "缺少 Humanoid_v1 骨架",
    "Missing fixed joint names": "缺少固定关节命名",
    "Left/right identity mismatch": "左右身份不匹配",
    "Character forward not confirmed": "角色前方未确认",
    "IK controls missing": "缺少 IK 控制器",
    "Pole target behind limb": "极向目标在肢体后方",
  }[status] || status;
}

function translateCommandStatus(status) {
  return {
    success: "成功",
    error: "失败",
  }[status] || status;
}

function translateCommandName(name) {
  return {
    load_test_dummy: "加载测试假人",
    import_glb: "导入 GLB",
    create_humanoid_skeleton: "创建人形骨架",
    assign_humanoid_mapping: "指定人形骨骼映射",
    set_character_direction: "确认角色前方",
    create_source_skeleton_from_import: "视觉辅助适配骨架",
    create_ik_controls: "创建 Control Rig",
    apply_motion_template: "应用动作模板",
    set_control_transform: "设置控制器变换",
    set_ik_target: "设置 IK 目标",
    set_joint_position: "设置关节点",
    rotate_joint_branch: "旋转关节分支",
    scale_joint_branch: "缩放关节分支",
    insert_keyframe: "插入关键帧",
    smooth_keyframes_between: "平滑关键帧段",
    validate_motion: "验证动作",
    export_motion_json: "导出动作 JSON",
    import_motion_json: "导入动作 JSON",
    undo: "撤销",
    redo: "重做",
    play: "播放",
    stop: "停止",
    select_bone: "选择骨骼",
    select_source_bone: "选择导入骨骼",
    select_control: "选择控制器",
    set_loop: "设置循环",
    set_model_opacity: "设置模型透明度",
    set_skeleton_opacity: "设置骨架透明度",
    set_control_opacity: "设置控制器透明度",
    set_stage: "切换阶段",
    set_current_frame: "设置当前帧",
    set_view_option: "设置显示选项",
    reset_view: "重置视角",
  }[name] || name;
}

function localizeDebugResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }
  const localized = {};
  Object.entries(result).forEach(([key, value]) => {
    const label = {
      message: "消息",
      status: "状态",
      result: "结果",
      joints: "关节数",
      bones: "骨骼数",
      count: "数量",
      keyframes: "关键帧数",
      source_bones: "源骨骼数",
      source_bone: "源骨骼",
      mapped_joint: "映射关节点",
      mapped: "已映射",
      direction: "角色前方",
      forward_sign: "前方方向",
      confirmed: "已确认",
      glb_skins: "GLB skin 数",
      glb_nodes: "GLB node 数",
      template_id: "模板",
      frame: "帧",
      from_frame: "起始帧",
      to_frame: "结束帧",
      joint: "关节点",
      position: "位置",
      interpolation: "插值",
      model_opacity: "模型透明度",
      report: "报告",
      bytes: "字节数",
    }[key] || key;
    localized[label] = key === "status" ? translateCommandStatus(value) : value;
  });
  return localized;
}

function translatePoseLabel(label) {
  return {
    CONTACT: "接触",
    DOWN: "下沉",
    PASSING: "经过",
    UP: "上升",
    "OPPOSITE CONTACT": "对侧接触",
    MANUAL: "手动",
  }[label] || label;
}

function translateBoneName(name) {
  return {
    Hips: "髋部",
    Spine: "脊柱",
    Chest: "胸腔",
    Neck: "颈部",
    Head: "头部",
    R_UpperArm: "右上臂",
    R_Forearm: "右前臂",
    R_Hand: "右手",
    L_UpperArm: "左上臂",
    L_Forearm: "左前臂",
    L_Hand: "左手",
    R_UpperLeg: "右大腿",
    R_LowerLeg: "右小腿",
    R_Foot: "右脚",
    R_Toe: "右脚尖",
    L_UpperLeg: "左大腿",
    L_LowerLeg: "左小腿",
    L_Foot: "左脚",
    L_Toe: "左脚尖",
  }[name] || name;
}

function formatJointName(joint) {
  if (!joint) return "无";
  return joint.display_name || joint.source_bone_name || translateBoneName(joint.name);
}

function formatBoneName(bone) {
  if (!bone) return "无";
  return bone.display_name || bone.source_bone_name || translateBoneName(bone.name);
}

function formatParentBoneName(bone) {
  if (!bone?.parent) return "无";
  return bone.parent_display_name || translateBoneName(bone.parent);
}

function translateControlName(name) {
  const knownName = {
    Global_CTRL: "全局控制器",
    Root_CTRL: "Root 控制器",
    COG_CTRL: "重心控制器",
    Pelvis_CTRL: "骨盆控制器",
    Chest_CTRL: "胸腔控制器",
    Head_CTRL: "头部控制器",
    R_Foot_IK: "右脚 IK",
    L_Foot_IK: "左脚 IK",
    R_Hand_IK: "右手 IK",
    L_Hand_IK: "左手 IK",
    R_Knee_Pole: "右膝极向",
    L_Knee_Pole: "左膝极向",
    R_Elbow_Pole: "右肘极向",
    L_Elbow_Pole: "左肘极向",
  }[name];
  if (knownName) {
    return knownName;
  }
  if (name?.endsWith("_CTRL")) {
    return `${translateBoneName(name.replace(/_CTRL$/, ""))} 控制器`;
  }
  return name;
}

function translateIssueCode(code) {
  return {
    foot_sliding: "脚底滑动",
    knee_flip: "膝盖翻转",
    loop_discontinuity: "循环断点",
    bone_identity_error: "骨骼身份错误",
  }[code] || code;
}

function translateSide(side) {
  return {
    R: "右侧",
    L: "左侧",
    Center: "中轴",
  }[side] || side;
}

function translateColorRule(rule) {
  return {
    "右侧 = 暖色": "右侧 = 暖色",
    "左侧 = 冷色": "左侧 = 冷色",
    "中轴 = 绿色": "中轴 = 绿色",
    "R side = 暖色": "右侧 = 暖色",
    "L side = 冷色": "左侧 = 冷色",
    "Center = 绿色": "中轴 = 绿色",
  }[rule] || rule;
}

function getLocalizedMotionStateSummary() {
  return {
    "模型": MotionState.model.loaded ? "已加载" : "无",
    "骨架": MotionState.skeleton?.id ? translateSkeletonId(MotionState.skeleton.id) : "缺失",
    "源骨骼": MotionState.source_bones.length,
    "GLB skins": MotionState.import_diagnostics.skins,
    "GLB joints": MotionState.import_diagnostics.joints,
    "人形映射": getOptionalFallbackHumanoidMappings().length > 0 && hasRequiredHumanoidMapping()
      ? `${getMappingCount()} / ${HUMANOID_JOINT_NAMES.length}（脚尖自动补）`
      : `${getMappingCount()} / ${HUMANOID_JOINT_NAMES.length}`,
    "视觉辅助": translateVisualAnalysisStatus(MotionState.visual_analysis.status),
    "骨骼数": MotionState.bones.length,
    "关节数": MotionState.joints.length,
    "显式旋转": Object.keys(MotionState.joint_rotations || {}).length,
    "核心 IK 控制器": getCoreIkControls().length,
    "关节控制器": getJointControls().length,
    "全部控制器": MotionState.ik_controls.length,
    "角色前方": formatCharacterForwardState(),
    "当前帧": MotionState.current_frame,
    "总帧数": MotionState.total_frames,
    "关键帧": MotionState.keyframes.length,
    "选中骨骼": MotionState.selected_bone || "无",
    "选中导入骨骼": getSelectedSourceBoneName(),
    "选中控制器": MotionState.selected_control || "无",
    "命令日志": MotionState.command_log.length,
    "撤销栈": MotionState.undo_stack.length,
    "重做栈": MotionState.redo_stack.length,
    "验证": translateStatus(MotionState.validation_report.status),
    "未保存": MotionState.dirty_state ? "是" : "否",
    "模型透明度": MotionState.model.opacity.toFixed(2),
    "骨架透明度": MotionState.visual_opacity.skeleton.toFixed(2),
    "控制器透明度": MotionState.visual_opacity.controls.toFixed(2),
  };
}

function getLocalizedValidationReport() {
  const report = MotionState.validation_report;
  return {
    "状态": translateStatus(report.status),
    "检查项": {
      "脚底滑动": translateCheckStatus(report.checks.foot_sliding),
      "膝盖翻转": translateCheckStatus(report.checks.knee_flip),
      "循环断点": translateCheckStatus(report.checks.loop_discontinuity),
      "骨骼身份错误": translateCheckStatus(report.checks.bone_identity_error),
    },
    "问题": report.issues.map((issue) => ({
      "代码": issue.code,
      "说明": issue.message,
    })),
    "检查时间": report.checked_at || "未运行",
  };
}

function setStage(stage) {
  Runtime.stage = stage;
  renderUi();
}

function requireSkeleton() {
  if (!MotionState.skeleton) {
    throw new Error("需要先创建骨架");
  }
}

function getSelectedSourceBoneName() {
  return MotionState.source_bones.find((bone) => bone.id === MotionState.selected_source_bone_id)?.name || "无";
}

function requireHumanoidSkeleton() {
  requireSkeleton();
  if (MotionState.skeleton.id !== "Humanoid_v1") {
    throw new Error("IK 和 Walk_8F 模板需要 Humanoid_v1 映射骨架；适配源骨架请先拖拽确认到标准关节点。");
  }
}

function ensureHumanoidSkeletonForAnimation() {
  requireSkeleton();
  if (MotionState.skeleton.id === "Humanoid_v1") {
    return;
  }
  if (MotionState.source_bones.length > 0 && hasRequiredHumanoidMapping()) {
    rebuildHumanoidSkeletonFromMapping();
    MotionState.selected_bone = MotionState.bones[0]?.name || null;
    return;
  }
  const missingRequired = getMissingHumanoidMappings({ includeOptional: false })
    .map(translateBoneName)
    .join("、");
  throw new Error(`IK 和 Walk_8F 需要完整核心 Humanoid_v1 映射；请先绑定：${missingRequired || "核心关节点"}。脚尖缺失会自动补位，不会阻止创建 IK。`);
}

function requireCharacterDirectionConfirmed() {
  if (MotionState.source_bones.length > 0 && !MotionState.direction?.confirmed) {
    throw new Error("请先在骨架阶段确认角色前方；如果走路方向反了，点“前后反转”后再应用 Walk_8F。");
  }
}

function requireIkControls() {
  if (MotionState.ik_controls.length === 0) {
    throw new Error("需要先创建 Control Rig");
  }
}

function getJoint(name) {
  return MotionState.joints.find((joint) => joint.name === name) || null;
}

function getSide(name) {
  if (name.startsWith("R_")) {
    return "R";
  }
  if (name.startsWith("L_")) {
    return "L";
  }
  return "Center";
}

function getSideColor(side) {
  if (side === "R") {
    return COLORS.right;
  }
  if (side === "L") {
    return COLORS.left;
  }
  return COLORS.center;
}

function getColorRule(side) {
  if (side === "R") {
    return "右侧 = 暖色";
  }
  if (side === "L") {
    return "左侧 = 冷色";
  }
  return "中轴 = 绿色";
}

function createEmptyValidationReport() {
  return {
    status: "Issues",
    checks: {
      foot_sliding: "Not run",
      knee_flip: "Not run",
      loop_discontinuity: "Not run",
      bone_identity_error: "Not run",
    },
    issues: [],
    checked_at: null,
  };
}

function createEmptyVisualAnalysis() {
  return { status: "Not run", method: null, source_bones: 0, generated_joints: 0, generated_bones: 0, model_opacity: null };
}

function createEmptyImportDiagnostics() {
  return {
    format: null,
    version: null,
    generator: null,
    byte_length: 0,
    nodes: 0,
    meshes: 0,
    skins: null,
    joints: 0,
    animations: 0,
    mesh_nodes_with_skin: 0,
    skin_joint_counts: [],
    extracted_source_bones: 0,
    node_names: [],
    error: null,
  };
}

function translateVisualAnalysisStatus(status) {
  return {
    "Not run": "未运行",
    "Source bones read": "已读取源骨骼",
    "No glTF skin": "无 glTF 骨骼",
    Generated: "已生成",
    Estimated: "已估算",
  }[status] || status || "未运行";
}

function createBoneMesh(start, end, color) {
  const startVec = new THREE.Vector3().fromArray(start);
  const endVec = new THREE.Vector3().fromArray(end);
  const delta = endVec.clone().sub(startVec);
  const length = delta.length();
  const geometry = new THREE.CylinderGeometry(0.009, 0.009, Math.max(length, 0.001), 8);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: MotionState.visual_opacity.skeleton,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(startVec).add(endVec).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function createSourceBoneMesh(start, end, color, visualScale) {
  const startVec = new THREE.Vector3().fromArray(start);
  const endVec = new THREE.Vector3().fromArray(end);
  const delta = endVec.clone().sub(startVec);
  const length = delta.length();
  if (length < 0.0001) {
    return new THREE.Group();
  }
  const geometry = new THREE.CylinderGeometry(visualScale * 0.08, visualScale * 0.08, length, 8);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: Math.min(0.72, MotionState.visual_opacity.skeleton + 0.1),
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(startVec).add(endVec).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.renderOrder = 18;
  return mesh;
}

function createSourceJointHandle(bone, color, visualScale, mappedJoint = null) {
  const group = new THREE.Group();
  group.position.fromArray(bone.position);
  group.userData = { type: "source_bone", source_bone_id: bone.id, name: bone.name, mapped_joint: mappedJoint };
  const selected = MotionState.selected_source_bone_id === bone.id;
  const coreSize = visualScale * (selected ? 0.82 : mappedJoint ? 0.32 : 0.46);
  const outlineSize = visualScale * (selected ? 1.16 : mappedJoint ? 0.52 : 0.68);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(coreSize, coreSize, coreSize),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(selected ? COLORS.warn : color),
      transparent: true,
      opacity: Math.min(0.72, MotionState.visual_opacity.skeleton + (selected ? 0.22 : 0.04)),
      depthTest: false,
    }),
  );
  const outline = new THREE.Mesh(
    new THREE.BoxGeometry(outlineSize, outlineSize, outlineSize),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(selected ? "#ffffff" : color),
      transparent: true,
      opacity: Math.min(0.86, MotionState.visual_opacity.skeleton + (selected ? 0.3 : 0.1)),
      wireframe: true,
      depthTest: false,
    }),
  );
  core.userData = group.userData;
  outline.userData = group.userData;
  core.renderOrder = 20;
  outline.renderOrder = 21;
  group.add(core, outline);
  return group;
}

function getSourceSkeletonVisualScale() {
  if (MotionState.source_bones.length === 0) {
    return 0.025;
  }
  const points = MotionState.source_bones.map((bone) => new THREE.Vector3().fromArray(bone.position));
  const box = new THREE.Box3().setFromPoints(points);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = Math.max(size.y, 0.5);
  return Math.max(0.018, Math.min(0.055, height * 0.026));
}

function makeLabel(text, position, color, scale = 0.12, opacity = 0.78) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 192;
  labelCanvas.height = 44;
  const context = labelCanvas.getContext("2d");
  context.clearRect(0, 0, 192, 44);
  context.fillStyle = "rgba(7, 12, 20, 0.46)";
  roundRect(context, 1, 1, 190, 42, 10);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 2;
  roundRect(context, 2, 2, 188, 40, 9);
  context.stroke();
  context.fillStyle = "#edf4ff";
  context.font = "700 16px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 96, 23, 168);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthTest: true }));
  sprite.position.fromArray(position);
  sprite.scale.set(scale * 2.4, scale * 0.55, scale);
  sprite.renderOrder = 8;
  return sprite;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function clearGroup(group, dispose = true) {
  while (group.children.length) {
    const child = group.children.pop();
    if (!dispose) {
      continue;
    }
    child.traverse?.((node) => {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) {
        node.material.forEach((material) => material.dispose?.());
      } else {
        node.material?.dispose?.();
      }
    });
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = Math.max(rect.width / Math.max(rect.height, 1), 0.1);
  camera.updateProjectionMatrix();
}

function updateCamera() {
  const x = Math.sin(yaw) * Math.cos(pitch) * cameraDistance;
  const y = Math.sin(pitch) * cameraDistance;
  const z = Math.cos(yaw) * Math.cos(pitch) * cameraDistance;
  camera.position.set(x, y, z).add(cameraTarget);
  camera.lookAt(cameraTarget);
}

function setCameraTargetToPosition(position) {
  if (!Array.isArray(position) || position.length !== 3) {
    return;
  }
  cameraTarget.fromArray(position.map(Number));
  updateCamera();
}

function animate(now = 0) {
  requestAnimationFrame(animate);
  if (Runtime.isPlaying) {
    const elapsed = Math.floor(((now - Runtime.playStartedAt) / 1000) * MotionState.playback_fps);
    const rawFrame = Runtime.playStartFrame + elapsed;
    let nextFrame = rawFrame;
    if (Runtime.loop) {
      nextFrame = ((rawFrame - 1) % MotionState.total_frames) + 1;
    } else if (rawFrame > MotionState.total_frames) {
      nextFrame = MotionState.total_frames;
      Runtime.isPlaying = false;
    }
    if (nextFrame !== Runtime.lastRenderedFrame) {
      Runtime.lastRenderedFrame = nextFrame;
      applyPoseAtFrame(nextFrame);
      renderAll();
    }
  }
  renderer.render(scene, camera);
}

function onPointerDown(event) {
  if (Runtime.transformMode) {
    event.preventDefault();
    if (event.button === 2) {
      cancelKeyboardTransform();
    } else if (event.button === 0) {
      Runtime.transformPointerDown = true;
      Runtime.transformPointerMoved = false;
      Runtime.transformPointerStart = { x: event.clientX, y: event.clientY };
      Runtime.transformCurrentPointer = { x: event.clientX, y: event.clientY };
      Runtime.transformPointerId = event.pointerId;
      canvas.setPointerCapture?.(event.pointerId);
    }
    return;
  }
  const mode = getNavigationMode(event);
  if (!mode) {
    if (event.button === 0) {
      if (handleViewportPick(event)) {
        canvas.setPointerCapture?.(event.pointerId);
      }
    }
    return;
  }
  event.preventDefault();
  Runtime.dragging = true;
  Runtime.navigationMode = mode;
  Runtime.navigationStartDistance = cameraDistance;
  Runtime.panning = mode === "pan";
  Runtime.lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
}

function handleViewportPick(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  pointerNdc.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const controlHits = raycaster.intersectObjects(ikGroup.children, true);
  const controlPick = getBestIkControlPick(controlHits, event) || getClosestIkControlScreenPick(event);
  if (controlPick) {
    const pickData = controlPick.pickData;
    const control = MotionState.ik_controls.find((item) => item.id === pickData?.control_id);
    if (control) {
      event.preventDefault();
      executeCommand(createCommand("select_control", { control: control.id }));
      Runtime.dragging = true;
      Runtime.navigationMode = "pending_select";
      Runtime.pendingViewportDrag = {
        kind: "control",
        id: control.id,
        startX: event.clientX,
        startY: event.clientY,
      };
      return true;
    }
  }
  const jointHits = MotionState.show.joint_debug_controls ? raycaster.intersectObjects(skeletonGroup.children, true) : [];
  const jointHit = jointHits.find((item) => findPickData(item.object, "humanoid_joint"));
  if (jointHit) {
    const pickData = findPickData(jointHit.object, "humanoid_joint");
    const joint = MotionState.joints.find((item) => item.name === pickData?.joint_name);
    if (joint) {
      event.preventDefault();
      const boneName = getBoneNameForJoint(joint.name);
      const jointControl = getControlForJoint(joint.name);
      if (jointControl) {
        executeCommand(createCommand("select_control", { control: jointControl.id }));
      }
      if (boneName) {
        executeCommand(createCommand("select_bone", { bone: boneName }));
      }
      Runtime.dragging = true;
      Runtime.navigationMode = "pending_select";
      Runtime.pendingViewportDrag = {
        kind: "joint",
        joint: joint.name,
        startX: event.clientX,
        startY: event.clientY,
      };
      return true;
    }
  }
  const hits = raycaster.intersectObjects(sourceSkeletonGroup.children, true);
  const hit = hits.find((item) => findPickData(item.object, "source_bone"));
  if (!hit) {
    return false;
  }
  const pickData = findPickData(hit.object, "source_bone");
  if (pickData?.source_bone_id) {
    event.preventDefault();
    executeCommand(createCommand("select_source_bone", { source_bone_id: pickData.source_bone_id }));
    return true;
  }
  return false;
}

function getBestIkControlPick(hits, event) {
  if (!hits.length) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(event.clientX, event.clientY);
  const candidates = hits
    .map((hit) => {
      const pickData = findPickData(hit.object, "ik_control");
      const control = MotionState.ik_controls.find((item) => item.id === pickData?.control_id);
      if (!pickData || !control || !shouldPickIkControl(control)) {
        return null;
      }
      const projected = new THREE.Vector3().fromArray(control.position).project(camera);
      const screen = new THREE.Vector2(
        rect.left + ((projected.x + 1) * 0.5 * rect.width),
        rect.top + ((1 - projected.y) * 0.5 * rect.height),
      );
      return {
        hit,
        pickData,
        screenDistance: screen.distanceTo(mouse),
      };
    })
    .filter(Boolean);
  candidates.sort((a, b) => a.screenDistance - b.screenDistance || a.hit.distance - b.hit.distance);
  return candidates[0] || null;
}

function getClosestIkControlScreenPick(event, maxDistance = 18) {
  if (!MotionState.show.ik_controls || MotionState.ik_controls.length === 0) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(event.clientX, event.clientY);
  const candidates = MotionState.ik_controls
    .filter(shouldPickIkControl)
    .map((control) => {
      const projected = new THREE.Vector3().fromArray(control.position).project(camera);
      if (projected.z < -1 || projected.z > 1) {
        return null;
      }
      const screen = new THREE.Vector2(
        rect.left + ((projected.x + 1) * 0.5 * rect.width),
        rect.top + ((1 - projected.y) * 0.5 * rect.height),
      );
      return {
        pickData: { type: "ik_control", control_id: control.id, name: control.id },
        screenDistance: screen.distanceTo(mouse),
      };
    })
    .filter(Boolean)
    .filter((item) => item.screenDistance <= maxDistance)
    .sort((a, b) => a.screenDistance - b.screenDistance);
  return candidates[0] || null;
}

function maybeStartPendingViewportDrag(event) {
  const pending = Runtime.pendingViewportDrag;
  if (!pending) {
    return;
  }
  const movement = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
  if (movement < 5) {
    return;
  }
  Runtime.pendingViewportDrag = null;
  if (pending.kind === "control") {
    const control = MotionState.ik_controls.find((item) => item.id === pending.id);
    if (control) {
      beginIkControlDrag(event, control);
      updateIkControlDrag(event);
    }
    return;
  }
  if (pending.kind === "joint") {
    beginJointDrag(event, pending.joint);
    updateJointDrag(event);
  }
}

function updateHoverPick(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  pointerNdc.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const controlPick = getBestIkControlPick(raycaster.intersectObjects(ikGroup.children, true), event)
    || getClosestIkControlScreenPick(event);
  const nextControlId = controlPick?.pickData?.control_id || null;
  const jointHit = !nextControlId && MotionState.show.joint_debug_controls
    ? raycaster.intersectObjects(skeletonGroup.children, true).find((item) => findPickData(item.object, "humanoid_joint"))
    : null;
  const nextJointName = jointHit ? findPickData(jointHit.object, "humanoid_joint")?.joint_name || null : null;
  if (Runtime.hoveredControlId !== nextControlId || Runtime.hoveredJointName !== nextJointName) {
    Runtime.hoveredControlId = nextControlId;
    Runtime.hoveredJointName = nextJointName;
    canvas.style.cursor = nextControlId || nextJointName ? "pointer" : "default";
    renderAll();
  }
}

function beginIkControlDrag(event, control) {
  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);
  Runtime.dragging = true;
  Runtime.navigationMode = "ik_control";
  Runtime.draggingIkControlId = control.id;
  Runtime.draggingIkFinalPosition = [...control.position];
  Runtime.ikDragStartSnapshot = snapshotCoreState();
  Runtime.draggingIkPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal,
    new THREE.Vector3().fromArray(control.position),
  );
  Runtime.lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
}

function updateIkControlDrag(event) {
  if (!Runtime.draggingIkControlId || !Runtime.draggingIkPlane) {
    return;
  }
  const point = getPointerPlanePoint(event, Runtime.draggingIkPlane);
  if (!point) {
    return;
  }
  const position = point.toArray();
  applyIkTargetPreview(Runtime.draggingIkControlId, position);
  Runtime.draggingIkFinalPosition = position;
  renderAll();
}

function finishIkControlDrag() {
  if (!Runtime.draggingIkControlId || !Runtime.draggingIkFinalPosition) {
    return;
  }
  const controlId = Runtime.draggingIkControlId;
  const finalPosition = [...Runtime.draggingIkFinalPosition];
  const startSnapshot = Runtime.ikDragStartSnapshot;
  Runtime.draggingIkControlId = null;
  Runtime.draggingIkPlane = null;
  Runtime.draggingIkFinalPosition = null;
  Runtime.ikDragStartSnapshot = null;
  if (startSnapshot) {
    restoreCoreState(startSnapshot);
  }
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  const commandName = control?.is_joint_control ? "set_ik_target" : "set_control_transform";
  const args = control?.is_joint_control
    ? { control_id: controlId, position: finalPosition }
    : { control_id: controlId, transform_mode: "translate", space: MotionState.transform.space, position: finalPosition };
  executeCommand(createCommand(commandName, args));
}

function beginJointDrag(event, jointName) {
  const joint = getJoint(jointName);
  if (!joint) {
    return;
  }
  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);
  Runtime.dragging = true;
  Runtime.navigationMode = "humanoid_joint";
  Runtime.draggingJointName = joint.name;
  Runtime.draggingJointFinalPosition = [...joint.position];
  Runtime.jointDragStartSnapshot = snapshotCoreState();
  Runtime.draggingJointPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal,
    new THREE.Vector3().fromArray(joint.position),
  );
  Runtime.lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
}

function updateJointDrag(event) {
  if (!Runtime.draggingJointName || !Runtime.draggingJointPlane) {
    return;
  }
  const point = getPointerPlanePoint(event, Runtime.draggingJointPlane);
  if (!point) {
    return;
  }
  const position = point.toArray();
  applyJointPositionPreview(Runtime.draggingJointName, position);
  Runtime.draggingJointFinalPosition = getJoint(Runtime.draggingJointName)?.position || position;
  renderAll();
}

function finishJointDrag() {
  if (!Runtime.draggingJointName || !Runtime.draggingJointFinalPosition) {
    return;
  }
  const jointName = Runtime.draggingJointName;
  const finalPosition = [...Runtime.draggingJointFinalPosition];
  const startSnapshot = Runtime.jointDragStartSnapshot;
  Runtime.draggingJointName = null;
  Runtime.draggingJointPlane = null;
  Runtime.draggingJointFinalPosition = null;
  Runtime.jointDragStartSnapshot = null;
  if (startSnapshot) {
    restoreCoreState(startSnapshot);
  }
  executeCommand(createCommand("set_joint_position", { joint: jointName, position: finalPosition }));
}

function getPointerPlanePoint(event, plane) {
  return getPointerPlanePointFromScreen(event.clientX, event.clientY, plane);
}

function getPointerPlanePointFromScreen(clientX, clientY, plane) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  pointerNdc.y = -(((clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function applyIkTargetPreview(controlId, position) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  if (!control) {
    return;
  }
  const previousControl = deepClone(control);
  control.position = position.map(Number);
  applyControlToJoint(control, previousControl);
  MotionState.selected_control = control.id;
  MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
}

function applyJointPositionPreview(jointName, position) {
  if (!HUMANOID_JOINT_NAMES.includes(jointName)) {
    return;
  }
  moveJointBranch(jointName, position.map(Number));
  const boneName = getBoneNameForJoint(jointName);
  if (boneName) {
    MotionState.selected_bone = boneName;
  }
  MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function findPickData(object, type) {
  let current = object;
  while (current) {
    if (current.userData?.type === type) {
      return current.userData;
    }
    current = current.parent;
  }
  return null;
}

function onPointerMove(event) {
  const currentPointer = { x: event.clientX, y: event.clientY };
  if (Runtime.transformMode) {
    Runtime.lastPointer = currentPointer;
    Runtime.transformCurrentPointer = currentPointer;
    if (Runtime.transformPointerDown && Runtime.transformPointerStart) {
      Runtime.transformPointerMoved = Runtime.transformPointerMoved
        || Math.hypot(event.clientX - Runtime.transformPointerStart.x, event.clientY - Runtime.transformPointerStart.y) > 2;
    }
    event.preventDefault();
    updateKeyboardTransform(event);
    return;
  }
  if (!Runtime.dragging) {
    Runtime.lastPointer = currentPointer;
    updateHoverPick(event);
    return;
  }
  event.preventDefault();
  if (event.buttons === 0) {
    onPointerUp(event);
    return;
  }
  if (Runtime.navigationMode === "pending_select") {
    maybeStartPendingViewportDrag(event);
    Runtime.lastPointer = currentPointer;
    return;
  }
  if (Runtime.navigationMode === "ik_control") {
    updateIkControlDrag(event);
    Runtime.lastPointer = currentPointer;
    return;
  }
  if (Runtime.navigationMode === "humanoid_joint") {
    updateJointDrag(event);
    Runtime.lastPointer = currentPointer;
    return;
  }
  const previousPointer = Runtime.lastPointer || currentPointer;
  const dx = event.clientX - previousPointer.x;
  const dy = event.clientY - previousPointer.y;
  Runtime.lastPointer = currentPointer;
  const lockedDistance = Runtime.navigationStartDistance || cameraDistance;
  if (Runtime.navigationMode === "pan") {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    cameraTarget.addScaledVector(right, -dx * lockedDistance * 0.0010);
    cameraTarget.addScaledVector(up, dy * lockedDistance * 0.0010);
    cameraDistance = lockedDistance;
  } else if (Runtime.navigationMode === "zoom") {
    zoomCameraByDelta(dy);
  } else if (Runtime.navigationMode === "orbit") {
    yaw += dx * 0.0055;
    pitch = Math.max(-1.35, Math.min(1.35, pitch + dy * 0.0045));
    cameraDistance = lockedDistance;
  }
  updateCamera();
}

function onPointerUp(event) {
  if (Runtime.transformMode) {
    if (Runtime.transformPointerDown && event.button === 0) {
      event.preventDefault();
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      finishKeyboardTransform();
    }
    return;
  }
  if (Runtime.navigationMode === "ik_control") {
    finishIkControlDrag();
  }
  if (Runtime.navigationMode === "humanoid_joint") {
    finishJointDrag();
  }
  if (Runtime.dragging && canvas.hasPointerCapture?.(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  Runtime.pendingViewportDrag = null;
  Runtime.dragging = false;
  Runtime.navigationMode = null;
  Runtime.navigationStartDistance = null;
  Runtime.panning = false;
}

function onWheel(event) {
  event.preventDefault();
  if (Runtime.dragging && Runtime.navigationMode !== "zoom") {
    return;
  }
  zoomCameraByDelta(event.deltaY);
  updateCamera();
}

function onKeyDown(event) {
  if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
    return;
  }
  const key = event.key.toLowerCase();
  if (Runtime.transformMode) {
    if (key === "escape") {
      event.preventDefault();
      cancelKeyboardTransform();
    } else if (key === "enter") {
      event.preventDefault();
      finishKeyboardTransform();
    } else if (["x", "y", "z"].includes(key)) {
      event.preventDefault();
      MotionState.transform.axis = MotionState.transform.axis === key ? null : key;
      Runtime.transformAxis = MotionState.transform.axis;
      renderAll();
    }
    return;
  }
  if (["g", "r", "s"].includes(key)) {
    event.preventDefault();
    startKeyboardTransform(getTransformModeFromKey(key));
  }
}

function startKeyboardTransform(mode) {
  const control = getSelectedTransformControl();
  if (!control || control.is_joint_control) {
    return;
  }
  Runtime.transformMode = mode;
  const screenCenter = getWorldScreenPosition(control.position);
  MotionState.transform.axis = null;
  Runtime.transformSubject = {
    control_id: control.id,
    joint: control.target_joint,
    start_position: [...control.position],
    start_rotation: [...(control.rotation || [0, 0, 0])],
    start_scale: [...(control.scale || [1, 1, 1])],
    start_screen: screenCenter ? { x: screenCenter.x, y: screenCenter.y } : null,
  };
  Runtime.transformStartSnapshot = snapshotCoreState();
  Runtime.transformStartPointer = { ...Runtime.lastPointer };
  Runtime.transformFinalValue = null;
  Runtime.transformAxis = MotionState.transform.axis;
  Runtime.transformCurrentPointer = { ...Runtime.lastPointer };
  Runtime.transformPointerDown = false;
  Runtime.transformPointerMoved = false;
  Runtime.transformPointerStart = null;
  Runtime.transformPointerId = null;
  MotionState.transform.tool = mode;
  renderAll();
}

function updateKeyboardTransform(event) {
  if (!Runtime.transformMode || !Runtime.transformSubject || !Runtime.transformStartSnapshot) {
    return;
  }
  restoreCoreState(Runtime.transformStartSnapshot);
  const dx = event.clientX - Runtime.transformStartPointer.x;
  const dy = event.clientY - Runtime.transformStartPointer.y;
  const subject = Runtime.transformSubject;
  if (Runtime.transformMode === "translate") {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const start = new THREE.Vector3().fromArray(subject.start_position);
    let nextVector = start.clone()
      .addScaledVector(right, dx * cameraDistance * 0.0012)
      .addScaledVector(up, -dy * cameraDistance * 0.0012);
    if (MotionState.transform.axis) {
      const axis = getTransformAxisVector(MotionState.transform.axis, subject.control_id);
      const amount = getPointerAxisAmount(axis, dx, dy);
      nextVector = start.clone().addScaledVector(axis, amount);
    }
    const next = nextVector.toArray();
    applyIkTargetPreview(subject.control_id, next);
    Runtime.transformFinalValue = { position: next };
  } else if (Runtime.transformMode === "rotate") {
    const nextRotation = getKeyboardTransformRotation(subject, event, dx, dy);
    const control = MotionState.ik_controls.find((item) => item.id === subject.control_id);
    if (control) {
      const previousControl = deepClone(control);
      control.rotation = nextRotation;
      applyControlToJoint(control, previousControl);
      MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    }
    Runtime.transformFinalValue = { rotation: nextRotation };
  } else if (Runtime.transformMode === "scale") {
    const factor = Math.max(0.15, Math.min(6, Math.exp(dx * 0.01)));
    const nextScale = subject.start_scale.map((value) => value * factor);
    const control = MotionState.ik_controls.find((item) => item.id === subject.control_id);
    if (control?.allow_scale) {
      const previousControl = deepClone(control);
      control.scale = nextScale;
      applyControlToJoint(control, previousControl);
      MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    }
    Runtime.transformFinalValue = { scale: nextScale };
  }
  renderAll();
}

function getKeyboardTransformRotation(subject, event, dx, dy) {
  const startRotation = normalizeVec3(subject.start_rotation, [0, 0, 0]);
  const startQuaternion = getControlRotationQuaternion({ rotation: startRotation });
  const axisName = MotionState.transform.axis;
  const axis = axisName
    ? getTransformAxisVector(axisName, subject.control_id)
    : getCameraViewAxis();
  const angle = axisName
    ? getConstrainedRotationAngle(axis, dx, dy)
    : getViewPlaneRotationAngle(subject, event, dx, dy);
  const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle);
  const nextQuaternion = deltaQuaternion.multiply(startQuaternion).normalize();
  const nextEuler = new THREE.Euler().setFromQuaternion(nextQuaternion, "XYZ");
  return [nextEuler.x, nextEuler.y, nextEuler.z];
}

function getCameraViewAxis() {
  const axis = new THREE.Vector3();
  camera.getWorldDirection(axis);
  return axis.length() > 0.001 ? axis.normalize() : getRigBasis().forward.clone().normalize();
}

function getConstrainedRotationAngle(axis, dx, dy) {
  const screenAxis = getProjectedAxisScreenVector(axis);
  if (screenAxis.length() > 0.001) {
    const pointer = new THREE.Vector2(dx, dy);
    return pointer.dot(screenAxis.normalize()) * 0.012;
  }
  return (Math.abs(dx) >= Math.abs(dy) ? dx : -dy) * 0.012;
}

function getViewPlaneRotationAngle(subject, event, dx, dy) {
  const center = subject.start_screen || getWorldScreenPosition(subject.start_position);
  if (center) {
    const startPointer = Runtime.transformStartPointer || { x: event.clientX - dx, y: event.clientY - dy };
    const startVector = new THREE.Vector2(startPointer.x - center.x, startPointer.y - center.y);
    const currentVector = new THREE.Vector2(event.clientX - center.x, event.clientY - center.y);
    if (startVector.length() > 8 && currentVector.length() > 8) {
      startVector.normalize();
      currentVector.normalize();
      const cross = startVector.x * currentVector.y - startVector.y * currentVector.x;
      const dot = THREE.MathUtils.clamp(startVector.dot(currentVector), -1, 1);
      return -Math.atan2(cross, dot);
    }
  }
  return (dx - dy) * 0.008;
}

function getProjectedAxisScreenVector(axis) {
  const origin = getSelectedTransformControl()?.position || [0, 0, 0];
  const originWorld = new THREE.Vector3().fromArray(origin);
  const axisWorld = originWorld.clone().add(axis.clone().normalize().multiplyScalar(Math.max(0.35, cameraDistance * 0.12)));
  const originScreen = getWorldScreenPosition(originWorld.toArray());
  const axisScreen = getWorldScreenPosition(axisWorld.toArray());
  if (!originScreen || !axisScreen) {
    return new THREE.Vector2();
  }
  return new THREE.Vector2(axisScreen.x - originScreen.x, axisScreen.y - originScreen.y);
}

function getWorldScreenPosition(position) {
  if (!Array.isArray(position) || position.length !== 3) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const projected = new THREE.Vector3().fromArray(position).project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
    return null;
  }
  return new THREE.Vector2(
    rect.left + ((projected.x + 1) * 0.5 * rect.width),
    rect.top + ((1 - projected.y) * 0.5 * rect.height),
  );
}

function finishKeyboardTransform() {
  const mode = Runtime.transformMode;
  const subject = Runtime.transformSubject;
  const value = Runtime.transformFinalValue;
  const snapshot = Runtime.transformStartSnapshot;
  Runtime.transformMode = null;
  Runtime.transformSubject = null;
  Runtime.transformStartSnapshot = null;
  Runtime.transformStartPointer = null;
  Runtime.transformFinalValue = null;
  Runtime.transformCurrentPointer = null;
  Runtime.transformPointerDown = false;
  Runtime.transformPointerMoved = false;
  Runtime.transformPointerStart = null;
  Runtime.transformPointerId = null;
  if (!mode || !subject || !value || !snapshot) {
    renderAll();
    return;
  }
  restoreCoreState(snapshot);
  if (mode === "translate") {
    executeCommand(createCommand("set_control_transform", { control_id: subject.control_id, transform_mode: "translate", space: MotionState.transform.space, position: value.position }));
  } else if (mode === "rotate") {
    executeCommand(createCommand("set_control_transform", { control_id: subject.control_id, transform_mode: "rotate", space: MotionState.transform.space, rotation: value.rotation }));
  } else if (mode === "scale") {
    executeCommand(createCommand("set_control_transform", { control_id: subject.control_id, transform_mode: "scale", space: MotionState.transform.space, scale: value.scale }));
  }
}

function cancelKeyboardTransform() {
  const snapshot = Runtime.transformStartSnapshot;
  Runtime.transformMode = null;
  Runtime.transformSubject = null;
  Runtime.transformStartSnapshot = null;
  Runtime.transformStartPointer = null;
  Runtime.transformFinalValue = null;
  Runtime.transformCurrentPointer = null;
  Runtime.transformPointerDown = false;
  Runtime.transformPointerMoved = false;
  Runtime.transformPointerStart = null;
  Runtime.transformPointerId = null;
  if (snapshot) {
    restoreCoreState(snapshot);
  }
  renderAll();
}

function getSelectedTransformControl() {
  return MotionState.ik_controls.find((control) => control.id === MotionState.selected_control)
    || getControlForJoint(MotionState.selected_bone)
    || MotionState.ik_controls[0]
    || null;
}

function getTransformModeFromKey(key) {
  return key === "g" ? "translate" : key === "r" ? "rotate" : key === "s" ? "scale" : "select";
}

function getTransformAxisVector(axisName, controlId) {
  const basis = getRigBasis();
  if (MotionState.transform.space === "local") {
    if (axisName === "x") return basis.right.clone().normalize();
    if (axisName === "y") return basis.up.clone().normalize();
    return basis.forward.clone().normalize();
  }
  if (axisName === "x") return new THREE.Vector3(1, 0, 0);
  if (axisName === "y") return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}

function getPointerAxisAmount(axis, dx, dy) {
  const axisScreen = getProjectedAxisScreenVector(axis);
  if (axisScreen.length() < 0.0001) {
    return dx * cameraDistance * 0.0012;
  }
  axisScreen.normalize();
  const pointer = new THREE.Vector2(dx, dy);
  return pointer.dot(axisScreen) * cameraDistance * 0.0012;
}

function getNavigationMode(event) {
  const middleButton = event.button === 1;
  const trackpadFallback = event.button === 0 && event.altKey;
  if (!middleButton && !trackpadFallback) {
    return null;
  }
  if (event.shiftKey) {
    return "pan";
  }
  if (event.ctrlKey) {
    return "zoom";
  }
  return "orbit";
}

function zoomCameraByDelta(deltaY) {
  cameraDistance = Math.max(0.18, Math.min(60, cameraDistance * Math.exp(deltaY * 0.0018)));
}

function installDebugApi() {
  window.executeCommand = executeCommand;
  window.createCommand = createCommand;
  window.__motionDebug = {
    MotionState,
    createCommand,
    executeCommand,
    executeCommandByName: (name, args = {}) => executeCommand(createCommand(name, args)),
    getMotionState: () => deepClone({
      ...snapshotCoreState(),
      command_log: MotionState.command_log,
      undo_stack_count: MotionState.undo_stack.length,
      redo_stack_count: MotionState.redo_stack.length,
    }),
    getMotionStateSummary,
    getCameraState: () => ({
      yaw,
      pitch,
      distance: cameraDistance,
      target: cameraTarget.toArray(),
      position: camera.position.toArray(),
    }),
    getCommandLog: () => deepClone(MotionState.command_log),
    getValidationReport: () => deepClone(MotionState.validation_report),
    getExportedJson: () => MotionState.exported_json,
    getSourceRigDebug,
    getIkControlScreenPositions,
    getJointScreenPositions,
  };
}

function getMotionStateSummary() {
  return {
    model: MotionState.model.loaded ? "Loaded" : "None",
    skeleton: MotionState.skeleton?.id || "Missing",
    source_bones: MotionState.source_bones.length,
    glb_skins: MotionState.import_diagnostics.skins,
    glb_joints: MotionState.import_diagnostics.joints,
    humanoid_mapping: getMappingCount(),
    missing_required_mapping: getMissingHumanoidMappings({ includeOptional: false }),
    optional_fallback_mapping: getOptionalFallbackHumanoidMappings(),
    visual_analysis: MotionState.visual_analysis.status,
    bones: MotionState.bones.length,
    joints: MotionState.joints.length,
    joint_rotation_overrides: Object.keys(MotionState.joint_rotations || {}).length,
    ik_controls: getCoreIkControls().length,
    joint_controls: getJointControls().length,
    all_controls: MotionState.ik_controls.length,
    direction: deepClone(MotionState.direction),
    current_frame: MotionState.current_frame,
    total_frames: MotionState.total_frames,
    keyframes: MotionState.keyframes.length,
    selected_bone: MotionState.selected_bone,
    selected_source_bone: getSelectedSourceBoneName(),
    selected_control: MotionState.selected_control,
    transform: deepClone(MotionState.transform),
    control_ids: MotionState.ik_controls.filter((control) => !control.is_joint_control).map((control) => control.id),
    visible_joint_debug_controls: Boolean(MotionState.show.joint_debug_controls),
    command_log: MotionState.command_log.length,
    undo_stack: MotionState.undo_stack.length,
    redo_stack: MotionState.redo_stack.length,
    validation: MotionState.validation_report.status,
    dirty_state: MotionState.dirty_state,
    model_opacity: MotionState.model.opacity,
    skeleton_opacity: MotionState.visual_opacity.skeleton,
    control_opacity: MotionState.visual_opacity.controls,
    control_size: MotionState.visual_opacity.control_size ?? 0.82,
    control_thickness: MotionState.visual_opacity.control_thickness ?? 0.72,
  };
}

function getSourceRigDebug() {
  const basis = getRigBasis();
  const mapped = {};
  Object.entries(MotionState.humanoid_mapping).forEach(([jointName, sourceId]) => {
    const sourceBone = MotionState.source_bones.find((bone) => bone.id === sourceId);
    const liveBone = Runtime.sourceBoneById.get(sourceId);
    const rest = Runtime.sourceBoneRestById.get(sourceId);
    const currentPosition = liveBone ? new THREE.Vector3() : null;
    const currentQuaternion = liveBone ? new THREE.Quaternion() : null;
    if (liveBone) {
      liveBone.getWorldPosition(currentPosition);
      liveBone.getWorldQuaternion(currentQuaternion);
    }
    mapped[jointName] = {
      source_bone_id: sourceId,
      source_bone_name: sourceBone?.name || null,
      rest_world_position: rest?.worldPosition?.toArray?.() || null,
      current_world_position: currentPosition?.toArray?.() || null,
      rest_world_quaternion: rest?.worldQuaternion?.toArray?.() || null,
      current_world_quaternion: currentQuaternion?.toArray?.() || null,
      local_position: liveBone?.position?.toArray?.() || null,
      local_quaternion: liveBone?.quaternion?.toArray?.() || null,
    };
  });
  return {
    mapped_count: getMappingCount(),
    missing_required_mapping: getMissingHumanoidMappings({ includeOptional: false }),
    optional_fallback_mapping: getOptionalFallbackHumanoidMappings(),
    source_bone_runtime_count: Runtime.sourceBoneById.size,
    rest_cache_count: Runtime.sourceBoneRestById.size,
    basis: {
      right: basis.right.toArray(),
      up: basis.up.toArray(),
      forward: basis.forward.toArray(),
      height: basis.height,
      scale: basis.scale,
    },
    mapped,
  };
}

function getIkControlScreenPositions() {
  const rect = canvas.getBoundingClientRect();
  return MotionState.ik_controls.map((control) => {
    const projected = new THREE.Vector3().fromArray(control.position).project(camera);
    return {
      id: control.id,
      type: control.type,
      x: rect.left + ((projected.x + 1) * 0.5 * rect.width),
      y: rect.top + ((1 - projected.y) * 0.5 * rect.height),
      visible: projected.z >= -1 && projected.z <= 1,
    };
  });
}

function getJointScreenPositions() {
  const rect = canvas.getBoundingClientRect();
  return MotionState.joints.map((joint) => {
    const projected = new THREE.Vector3().fromArray(joint.position).project(camera);
    return {
      name: joint.name,
      side: joint.side,
      x: rect.left + ((projected.x + 1) * 0.5 * rect.width),
      y: rect.top + ((1 - projected.y) * 0.5 * rect.height),
      visible: projected.z >= -1 && projected.z <= 1,
    };
  });
}

function clampFrame(frame) {
  return Math.max(1, Math.min(MotionState.total_frames, Math.round(frame)));
}

function clampOpacity(value, min, max, fallback) {
  return clampNumber(value, min, max, fallback);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function addVec(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtractVec(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function lerpVec(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function horizontalDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
