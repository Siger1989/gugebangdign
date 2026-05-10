import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#rigCanvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
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
const LOWER_BODY_CONTROL_JOINTS = [
  "R_UpperLeg", "R_LowerLeg", "R_Foot", "R_Toe",
  "L_UpperLeg", "L_LowerLeg", "L_Foot", "L_Toe",
];
const UPPER_BODY_CONTROL_JOINTS = [
  "Spine", "Chest", "Neck", "Head",
  "R_UpperArm", "R_Forearm", "R_Hand",
  "L_UpperArm", "L_Forearm", "L_Hand",
];
const PELVIS_TRANSLATE_JOINTS = [
  "Hips",
  "Spine", "Chest", "Neck", "Head",
  "R_UpperArm", "R_Forearm", "R_Hand",
  "L_UpperArm", "L_Forearm", "L_Hand",
  "R_UpperLeg", "L_UpperLeg",
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

const CONTROL_VISUAL_PRESETS = {
  compact: {
    label: "轻量多边形",
    description: "低遮挡：方框、三角、六边形，适合当前网页视图快速摆姿势。",
  },
  rigify: {
    label: "Rigify 风格",
    description: "参考 Blender Rigify：IK 主控、Pole、脚跟/脚尖提示和自定义轴心形状。",
  },
  motionbuilder: {
    label: "MotionBuilder 风格",
    description: "参考 Control Rig：全局 IK effectors 更明显，FK/Joint 调试点更轻。",
  },
};
const CONTROL_VISUAL_PRESET_IDS = Object.keys(CONTROL_VISUAL_PRESETS);

const CONTROL_SOLVE_MODES = {
  hybrid: {
    label: "IK/FK 混合",
    description: "默认模式：用同一批控制器编辑 IK 末端和 FK/躯干旋转；移动身体时保持脚底目标。",
  },
  pinned: {
    label: "脚底锁定 IK",
    description: "锁定预览模式：强调脚底目标固定，当前和 IK/FK 混合共用大部分解算。",
  },
  basic: {
    label: "简易 IK",
    description: "轻量模式：只做基础两段 IK 和关节同步，不做身体移动时的脚底反向约束。",
  },
};
const CONTROL_SOLVE_MODE_IDS = Object.keys(CONTROL_SOLVE_MODES);

const WALK_KEY_POSES = [
  { index: 1, timeline_frame: 1, label: "CONTACT", params: { rFootZ: 0.20, lFootZ: -0.20, rHandZ: -0.12, lHandZ: 0.12, hipY: 0.00, lock: { R: true, L: true } } },
  { index: 2, timeline_frame: 4, label: "DOWN", params: { rFootZ: 0.12, lFootZ: -0.12, rHandZ: -0.05, lHandZ: 0.05, hipY: -0.05, lock: { R: false, L: false } } },
  { index: 3, timeline_frame: 7, label: "PASSING", params: { rFootZ: 0.00, lFootZ: 0.00, lFootY: 0.08, rHandZ: 0.00, lHandZ: 0.00, hipY: 0.00, lock: { R: false, L: false } } },
  { index: 4, timeline_frame: 10, label: "UP", params: { rFootZ: -0.12, lFootZ: 0.12, lFootY: 0.11, rHandZ: 0.08, lHandZ: -0.08, hipY: 0.04, lock: { R: false, L: false } } },
  { index: 5, timeline_frame: 13, label: "OPPOSITE CONTACT", params: { rFootZ: -0.20, lFootZ: 0.20, rHandZ: 0.12, lHandZ: -0.12, hipY: 0.00, lock: { R: true, L: true } } },
  { index: 6, timeline_frame: 16, label: "DOWN", params: { rFootZ: -0.12, lFootZ: 0.12, rHandZ: 0.05, lHandZ: -0.05, hipY: -0.05, lock: { R: false, L: false } } },
  { index: 7, timeline_frame: 19, label: "PASSING", params: { rFootZ: 0.00, lFootZ: 0.00, rFootY: 0.08, rHandZ: 0.00, lHandZ: 0.00, hipY: 0.00, lock: { R: false, L: false } } },
  { index: 8, timeline_frame: 22, label: "UP", params: { rFootZ: 0.12, lFootZ: -0.12, rFootY: 0.11, rHandZ: -0.08, lHandZ: 0.08, hipY: 0.04, lock: { R: false, L: false } } },
];

const COMMAND_SCHEMAS = {
  load_test_dummy: { type: "object", properties: {} },
  import_glb: { type: "object", properties: { file: { type: "File" } } },
  create_humanoid_skeleton: { type: "object", properties: { skeleton_id: { const: "Humanoid_v1" } } },
  assign_humanoid_mapping: { type: "object", properties: { joint: { type: "string" }, source_bone_id: { type: "string" } }, required: ["joint", "source_bone_id"] },
  set_character_direction: { type: "object", properties: { forward_sign: { enum: [1, -1] }, yaw_degrees: { type: "number" }, confirmed: { type: "boolean" } } },
  create_source_skeleton_from_import: { type: "object", properties: { mode: { const: "visual_overlay_tpose" } } },
  create_ik_controls: {
    type: "object",
    properties: {
      rig: { const: "Humanoid_v1" },
      visual_preset: { enum: CONTROL_VISUAL_PRESET_IDS },
      solve_mode: { enum: CONTROL_SOLVE_MODE_IDS },
    },
  },
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
  set_control_transforms: {
    type: "object",
    properties: {
      transform_mode: { enum: ["translate", "rotate", "scale"] },
      space: { enum: ["local", "global"] },
      transforms: { type: "array" },
      insert_keyframe: { type: "boolean" },
      frame: { type: "number" },
    },
    required: ["transforms"],
  },
  set_joint_position: { type: "object", properties: { joint: { type: "string" }, position: { type: "array", minItems: 3, maxItems: 3 } } },
  rotate_joint_branch: { type: "object", properties: { joint: { type: "string" }, angle: { type: "number" }, axis: { type: "array", minItems: 3, maxItems: 3 } } },
  scale_joint_branch: { type: "object", properties: { joint: { type: "string" }, scale: { type: "number" } } },
  insert_keyframe: { type: "object", properties: { frame: { type: "number" } } },
  delete_current_keyframe: { type: "object", properties: { frame: { type: "number" } } },
  copy_current_frame: { type: "object", properties: {} },
  paste_copied_frame: { type: "object", properties: { frame: { type: "number" } } },
  mirror_current_frame: { type: "object", properties: { frame: { type: "number" } } },
  smooth_keyframes_between: { type: "object", properties: { from_frame: { type: "number" }, to_frame: { type: "number" } } },
  validate_motion: { type: "object", properties: {} },
  export_motion_json: { type: "object", properties: {} },
  import_motion_json: { type: "object", properties: { json: { type: "string" } } },
  export_binding_preset: { type: "object", properties: {} },
  import_binding_preset: { type: "object", properties: { json: { type: "string" } } },
  undo: { type: "object", properties: {} },
  redo: { type: "object", properties: {} },
  play: { type: "object", properties: {} },
  stop: { type: "object", properties: {} },
  select_bone: { type: "object", properties: { bone: { type: "string" } } },
  select_source_bone: { type: "object", properties: { source_bone_id: { type: "string" } } },
  select_control: { type: "object", properties: { control: { type: "string" }, additive: { type: "boolean" }, toggle: { type: "boolean" }, remove: { type: "boolean" } } },
  clear_selection: { type: "object", properties: {} },
  set_loop: { type: "object", properties: { loop: { type: "boolean" } } },
  set_playback_fps: { type: "object", properties: { fps: { type: "number" } } },
  set_model_opacity: { type: "object", properties: { opacity: { type: "number" } } },
  set_skeleton_opacity: { type: "object", properties: { opacity: { type: "number" } } },
  set_control_opacity: { type: "object", properties: { opacity: { type: "number" } } },
  set_stage: { type: "object", properties: { stage: { enum: ["model", "skeleton", "mapping", "control_rig", "ik", "motion", "export"] } } },
  set_current_frame: { type: "object", properties: { frame: { type: "number" } } },
  reset_timeline_view: { type: "object", properties: {} },
  zoom_timeline_view: { type: "object", properties: { direction: { enum: ["in", "out"] } } },
  pan_timeline_view: { type: "object", properties: { direction: { enum: ["left", "right"] } } },
  go_to_previous_keyframe: { type: "object", properties: {} },
  go_to_next_keyframe: { type: "object", properties: {} },
  set_view_option: { type: "object", properties: { key: { type: "string" }, value: { type: "boolean" } } },
  set_control_visual_size: { type: "object", properties: { size: { type: "number" } } },
  set_control_visual_thickness: { type: "object", properties: { thickness: { type: "number" } } },
  set_control_visual_preset: { type: "object", properties: { visual_preset: { enum: CONTROL_VISUAL_PRESET_IDS } } },
  set_control_solve_mode: { type: "object", properties: { solve_mode: { enum: CONTROL_SOLVE_MODE_IDS } } },
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
  selected_controls: [],
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
    control_size: 0.68,
    control_thickness: 0.2,
  },
  control_rig_options: {
    visual_preset: "compact",
    solve_mode: "hybrid",
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
  transformAccumulatedAngle: 0,
  transformLastPointer: null,
  transformValueBox: null,
  transformNumericValue: null,
  transformNumericLabel: "",
  hoveredTransformAxis: null,
  hoveredControlId: null,
  hoveredJointName: null,
  selectedTimelineFrames: [],
  timelineView: { start: 1, frames: 24 },
  timelineViewPinned: false,
  copiedKeyframe: null,
  dragging: false,
  navigationMode: null,
  navigationStartDistance: null,
  panning: false,
  lastPointer: { x: 0, y: 0 },
  needsRender: true,
};

const el = {
  flowSteps: [...document.querySelectorAll(".work-action")],
  sceneItems: [...document.querySelectorAll(".scene-item")],
  toolButtons: [...document.querySelectorAll(".tool-button")],
  axisButtons: [...document.querySelectorAll(".axis-button")],
  spaceToggleButton: document.querySelector("#spaceToggleButton"),
  snapToggleButton: document.querySelector("#snapToggleButton"),
  mirrorToggleButton: document.querySelector("#mirrorToggleButton"),
  panels: [...document.querySelectorAll(".inspector-section")],
  statusModel: document.querySelector("#statusModel"),
  statusDirection: document.querySelector("#statusDirection"),
  statusSkeleton: document.querySelector("#statusSkeleton"),
  statusIk: document.querySelector("#statusIk"),
  statusKeyframes: document.querySelector("#statusKeyframes"),
  statusFrame: document.querySelector("#statusFrame"),
  statusDirty: document.querySelector("#statusDirty"),
  statusValidation: document.querySelector("#statusValidation"),
  sceneModelState: document.querySelector("#sceneModelState"),
  sceneSkeletonState: document.querySelector("#sceneSkeletonState"),
  sceneRigState: document.querySelector("#sceneRigState"),
  sceneMotionState: document.querySelector("#sceneMotionState"),
  modelPanelStatus: document.querySelector("#modelPanelStatus"),
  modelPanelBoneCount: document.querySelector("#modelPanelBoneCount"),
  modelPanelType: document.querySelector("#modelPanelType"),
  timelineKeyframes: document.querySelector("#timelineKeyframes"),
  timelineKeyPoseCount: document.querySelector("#timelineKeyPoseCount"),
  timelineRangeValue: document.querySelector("#timelineRangeValue"),
  timelinePinnedBadge: document.querySelector("#timelinePinnedBadge"),
  timelineLoopState: document.querySelector("#timelineLoopState"),
  timelineFpsInput: document.querySelector("#timelineFpsInput"),
  selectedBoneSelect: document.querySelector("#selectedBoneSelect"),
  selectedControlSelect: document.querySelector("#selectedControlSelect"),
  controlVisualPresetSelect: document.querySelector("#controlVisualPresetSelect"),
  controlSolveModeSelect: document.querySelector("#controlSolveModeSelect"),
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
  timelinePrevKeyButton: document.querySelector("#timelinePrevKeyButton"),
  timelineNextKeyButton: document.querySelector("#timelineNextKeyButton"),
  timelineSaveFrameButton: document.querySelector("#timelineSaveFrameButton"),
  timelineDeleteFrameButton: document.querySelector("#timelineDeleteFrameButton"),
  timelineCopyFrameButton: document.querySelector("#timelineCopyFrameButton"),
  timelinePasteFrameButton: document.querySelector("#timelinePasteFrameButton"),
  timelineMirrorFrameButton: document.querySelector("#timelineMirrorFrameButton"),
  timelineSmoothButton: document.querySelector("#timelineSmoothButton"),
  timelinePanLeftButton: document.querySelector("#timelinePanLeftButton"),
  timelinePanRightButton: document.querySelector("#timelinePanRightButton"),
  timelineZoomInButton: document.querySelector("#timelineZoomInButton"),
  timelineZoomOutButton: document.querySelector("#timelineZoomOutButton"),
  timelineResetViewButton: document.querySelector("#timelineResetViewButton"),
  timelineFrameSlider: document.querySelector("#timelineFrameSlider"),
  timelineFrameNumberInput: document.querySelector("#timelineFrameNumberInput"),
  timelineCurrentFrameValue: document.querySelector("#timelineCurrentFrameValue"),
  timelineFrameTicks: document.querySelector("#timelineFrameTicks"),
  ikTargetX: document.querySelector("#ikTargetX"),
  ikTargetY: document.querySelector("#ikTargetY"),
  ikTargetZ: document.querySelector("#ikTargetZ"),
  keyframeList: document.querySelector("#keyframeList"),
  motionJsonText: document.querySelector("#motionJsonText"),
  exportBindingPresetButton: document.querySelector("#exportBindingPresetButton"),
  importBindingPresetButton: document.querySelector("#importBindingPresetButton"),
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
    button.addEventListener("click", (event) => {
      void handleWorkbenchAction(button, event);
    });
    button.addEventListener("keydown", (event) => {
      if (button.dataset.action !== "import_model") {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      void handleWorkbenchAction(button, event);
    });
  });
  el.sceneItems.forEach((button) => {
    button.addEventListener("click", () => executeCommand(createCommand("set_stage", { stage: button.dataset.stage })));
  });
  el.toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTransformTool(button.dataset.tool));
  });
  el.axisButtons.forEach((button) => {
    button.addEventListener("click", () => setTransformAxis(button.dataset.axis || null));
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
      void executeCommand(createCommand("import_glb", { file }));
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
      forward_sign: 1,
      yaw_degrees: MotionState.direction.yaw_degrees,
      confirmed: true,
    }));
  });
  document.querySelector("#flipForwardButton").addEventListener("click", () => {
    executeCommand(createCommand("set_character_direction", {
      forward_sign: 1,
      yaw_degrees: normalizeForwardYaw((MotionState.direction.yaw_degrees || 0) + 180),
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
      forward_sign: 1,
      yaw_degrees: Number(el.forwardAngleInput.value),
      confirmed: false,
    }));
  });
  document.querySelector("#createIkButton").addEventListener("click", () => {
    executeCommand(createCommand("create_ik_controls", {
      visual_preset: "compact",
      solve_mode: getActiveControlSolveMode(),
    }));
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
  el.exportBindingPresetButton?.addEventListener("click", () => {
    executeCommand(createCommand("export_binding_preset"));
  });
  el.importBindingPresetButton?.addEventListener("click", () => {
    executeCommand(createCommand("import_binding_preset", { json: el.motionJsonText.value }));
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
  el.timelinePrevKeyButton?.addEventListener("click", () => {
    executeCommand(createCommand("go_to_previous_keyframe"));
  });
  el.timelineNextKeyButton?.addEventListener("click", () => {
    executeCommand(createCommand("go_to_next_keyframe"));
  });
  el.timelineSaveFrameButton.addEventListener("click", () => {
    executeCommand(createCommand("insert_keyframe", { frame: MotionState.current_frame }));
  });
  el.timelineDeleteFrameButton?.addEventListener("click", () => {
    executeCommand(createCommand("delete_current_keyframe", { frame: MotionState.current_frame }));
  });
  el.timelineCopyFrameButton?.addEventListener("click", () => {
    executeCommand(createCommand("copy_current_frame"));
  });
  el.timelinePasteFrameButton?.addEventListener("click", () => {
    executeCommand(createCommand("paste_copied_frame", { frame: MotionState.current_frame }));
  });
  el.timelineMirrorFrameButton?.addEventListener("click", () => {
    executeCommand(createCommand("mirror_current_frame", { frame: MotionState.current_frame }));
  });
  el.timelineSmoothButton.addEventListener("click", () => {
    executeCommand(createCommand("smooth_keyframes_between", getCurrentSmoothFrameRange()));
  });
  el.timelinePanLeftButton?.addEventListener("click", () => {
    executeCommand(createCommand("pan_timeline_view", { direction: "left" }));
  });
  el.timelinePanRightButton?.addEventListener("click", () => {
    executeCommand(createCommand("pan_timeline_view", { direction: "right" }));
  });
  el.timelineZoomInButton?.addEventListener("click", () => {
    executeCommand(createCommand("zoom_timeline_view", { direction: "in" }));
  });
  el.timelineZoomOutButton?.addEventListener("click", () => {
    executeCommand(createCommand("zoom_timeline_view", { direction: "out" }));
  });
  el.timelineResetViewButton?.addEventListener("click", () => {
    executeCommand(createCommand("reset_timeline_view"));
  });
  el.timelineFrameSlider.addEventListener("input", () => {
    executeCommand(createCommand("set_current_frame", { frame: Number(el.timelineFrameSlider.value) }));
  });
  el.timelineFrameNumberInput?.addEventListener("change", (event) => {
    executeCommand(createCommand("set_current_frame", { frame: Number(el.timelineFrameNumberInput.value) }));
    event.currentTarget.blur();
  });
  el.timelineFrameNumberInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      executeCommand(createCommand("set_current_frame", { frame: Number(event.currentTarget.value) }));
    }
  });
  [el.timelineFrameTicks, el.timelineKeyframes].forEach((node) => {
    node?.addEventListener("wheel", handleTimelineWheel, { passive: false });
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
  el.controlVisualPresetSelect?.addEventListener("change", () => {
    executeCommand(createCommand("set_control_visual_preset", { visual_preset: el.controlVisualPresetSelect.value }));
  });
  el.controlSolveModeSelect?.addEventListener("change", () => {
    executeCommand(createCommand("set_control_solve_mode", { solve_mode: el.controlSolveModeSelect.value }));
  });
  el.loopToggle.addEventListener("change", () => {
    executeCommand(createCommand("set_loop", { loop: el.loopToggle.checked }));
  });
  el.timelineFpsInput?.addEventListener("change", (event) => {
    executeCommand(createCommand("set_playback_fps", { fps: Number(event.currentTarget.value) }));
    event.currentTarget.blur();
  });
  el.timelineFpsInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      executeCommand(createCommand("set_playback_fps", { fps: Number(event.currentTarget.value) }));
    }
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
  installPointerOnlyRangeInputs(
    el.modelOpacityInput,
    el.viewportModelOpacityInput,
    el.skeletonOpacityInput,
    el.controlOpacityInput,
    el.controlSizeInput,
    el.controlThicknessInput,
    el.timelineFrameSlider,
    el.forwardAngleInput,
  );

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

function installPointerOnlyRangeInputs(...inputs) {
  inputs.filter(Boolean).forEach((input) => {
    input.tabIndex = -1;
    input.dataset.pointerOnlyRange = "true";
    input.classList.add("pointer-only-range");
    const blurInput = () => window.setTimeout(() => input.blur(), 0);
    input.addEventListener("focus", blurInput);
    input.addEventListener("pointerdown", blurInput);
    input.addEventListener("pointerup", blurInput);
    input.addEventListener("pointercancel", blurInput);
    input.addEventListener("change", blurInput);
  });
}

async function handleWorkbenchAction(button, event = null) {
  const action = button.dataset.action;
  const stage = button.dataset.stage;
  if (action === "import_model") {
    void executeCommand(createCommand("set_stage", { stage: "model" }));
    event?.preventDefault();
    void openModelFilePicker();
    return;
  }
  if (action === "identify_skeleton") {
    executeCommand(createCommand("create_humanoid_skeleton"));
    return;
  }
  if (action === "create_ik") {
    executeCommand(createCommand("create_ik_controls", {
      visual_preset: "compact",
      solve_mode: getActiveControlSolveMode(),
    }));
    return;
  }
  if (action === "validate_motion") {
    executeCommand(createCommand("validate_motion"));
    return;
  }
  if (action === "export_motion") {
    executeCommand(createCommand("set_stage", { stage: "export" }));
    executeCommand(createCommand("export_motion_json"));
    return;
  }
  executeCommand(createCommand("set_stage", { stage }));
}

async function openModelFilePicker() {
  if (window.desktopBridge?.openGlbFile) {
    try {
      const desktopFile = await window.desktopBridge.openGlbFile();
      if (!desktopFile) {
        return;
      }
      await executeCommand(createCommand("import_glb", { file: createFileFromDesktopSelection(desktopFile) }));
      return;
    } catch (error) {
      console.warn("desktopBridge.openGlbFile failed, falling back to file input.", error);
    }
  }
  triggerFileInputPicker();
}

function triggerFileInputPicker() {
  const input = document.querySelector("#modelFileInput");
  if (!input) {
    return;
  }
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (error) {
      console.warn("showPicker failed, falling back to input.click().", error);
    }
  }
  input.click();
}

function createFileFromDesktopSelection(desktopFile) {
  const rawBuffer = desktopFile.buffer;
  const buffer = rawBuffer instanceof ArrayBuffer
    ? rawBuffer
    : new Uint8Array(rawBuffer || []).buffer;
  return new File([buffer], desktopFile.name || "imported-model.glb", {
    type: desktopFile.name?.toLowerCase().endsWith(".gltf") ? "model/gltf+json" : "model/gltf-binary",
  });
}

function adjustForwardYaw(deltaDegrees) {
  executeCommand(createCommand("set_character_direction", {
    forward_sign: 1,
    yaw_degrees: normalizeForwardYaw((MotionState.direction.yaw_degrees || 0) + deltaDegrees),
    confirmed: false,
  }));
}

function setTransformTool(tool) {
  const nextTool = ["select", "translate", "rotate", "scale"].includes(tool) ? tool : "select";
  MotionState.transform.tool = nextTool;
  MotionState.transform.axis = null;
  resetTransformRotationAccumulator(Runtime.lastPointer);
  renderAll();
}

function setTransformAxis(axis) {
  const nextAxis = ["x", "y", "z", "view"].includes(axis) ? axis : null;
  MotionState.transform.axis = nextAxis;
  Runtime.transformAxis = nextAxis;
  if (Runtime.transformMode) {
    restartTransformFromCurrentPreview(Runtime.transformCurrentPointer || Runtime.lastPointer);
  } else {
    resetTransformRotationAccumulator(Runtime.lastPointer);
  }
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

function getPoseIndexForFrame(frame) {
  const targetFrame = clampFrame(Number(frame) || MotionState.current_frame);
  return Math.max(1, Math.min(8, Math.round(((targetFrame - 1) / MotionState.total_frames) * 8) + 1));
}

function createKeyframeFromCurrentPose(frame, label = "MANUAL") {
  const targetFrame = clampFrame(Number(frame) || MotionState.current_frame);
  return {
    pose_index: getPoseIndexForFrame(targetFrame),
    timeline_frame: targetFrame,
    label,
    joints: deepClone(MotionState.joints),
    joint_rotations: deepClone(MotionState.joint_rotations),
    ik_controls: deepClone(MotionState.ik_controls),
    foot_locks: inferFootLocksFromControls(),
    interpolation: "linear",
  };
}

function upsertKeyframe(keyframe) {
  const targetFrame = clampFrame(Number(keyframe?.timeline_frame) || MotionState.current_frame);
  const normalized = {
    ...deepClone(keyframe),
    pose_index: getPoseIndexForFrame(targetFrame),
    timeline_frame: targetFrame,
    interpolation: keyframe?.interpolation || "linear",
  };
  MotionState.keyframes = MotionState.keyframes.filter((item) => item.timeline_frame !== targetFrame);
  MotionState.keyframes.push(normalized);
  MotionState.keyframes.sort((a, b) => a.timeline_frame - b.timeline_frame);
  markTimelineFrameSelected(targetFrame);
  return targetFrame;
}

function upsertManualKeyframe(frame) {
  const targetFrame = clampFrame(Number(frame) || MotionState.current_frame);
  return upsertKeyframe(createKeyframeFromCurrentPose(targetFrame));
}

function getMirrorName(name) {
  if (typeof name !== "string") {
    return name;
  }
  if (name.startsWith("R_")) return `L_${name.slice(2)}`;
  if (name.startsWith("L_")) return `R_${name.slice(2)}`;
  return name;
}

function getMirrorSide(side) {
  if (side === "R") return "L";
  if (side === "L") return "R";
  return side;
}

function getMirrorPlanePoint(joints = MotionState.joints) {
  const hips = joints.find((joint) => joint.name === "Hips")?.position;
  if (hips) {
    return new THREE.Vector3().fromArray(hips);
  }
  return new THREE.Vector3();
}

function reflectPositionAcrossRigSidePlane(position, planePoint, basis = getRigBasis()) {
  const point = new THREE.Vector3().fromArray(normalizeVec3(position, [0, 0, 0]));
  const normal = basis.right.clone().normalize();
  const signedDistance = point.clone().sub(planePoint).dot(normal);
  return point.addScaledVector(normal, -2 * signedDistance).toArray();
}

function mirrorQuaternionArray(value, basis = getRigBasis()) {
  const quaternion = getQuaternionFromArray(value);
  if (!quaternion) {
    return value;
  }
  const normal = basis.right.clone().normalize();
  const reflection = new THREE.Matrix4().set(
    1 - 2 * normal.x * normal.x, -2 * normal.x * normal.y, -2 * normal.x * normal.z, 0,
    -2 * normal.y * normal.x, 1 - 2 * normal.y * normal.y, -2 * normal.y * normal.z, 0,
    -2 * normal.z * normal.x, -2 * normal.z * normal.y, 1 - 2 * normal.z * normal.z, 0,
    0, 0, 0, 1,
  );
  const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
  rotationMatrix.premultiply(reflection).multiply(reflection);
  return new THREE.Quaternion().setFromRotationMatrix(rotationMatrix).normalize().toArray();
}

function mirrorEulerArray(value, basis = getRigBasis()) {
  const rotation = normalizeVec3(value || [0, 0, 0], [0, 0, 0]);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], "XYZ"));
  const mirrored = mirrorQuaternionArray(quaternion.toArray(), basis);
  const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(mirrored), "XYZ");
  return [euler.x, euler.y, euler.z];
}

function mirrorPoseItems(items, key, planePoint, basis) {
  const byKey = new Map((items || []).map((item) => [item[key], item]));
  return (items || []).map((item) => {
    const source = byKey.get(getMirrorName(item[key])) || item;
    const mirrored = {
      ...deepClone(item),
      position: reflectPositionAcrossRigSidePlane(source.position || item.position, planePoint, basis),
    };
    if (source.rotation) {
      mirrored.rotation = mirrorEulerArray(source.rotation, basis);
    }
    if (source.scale) {
      mirrored.scale = deepClone(source.scale);
    }
    if (Object.prototype.hasOwnProperty.call(source, "locked")) {
      mirrored.locked = Boolean(source.locked);
    }
    if (Object.prototype.hasOwnProperty.call(mirrored, "side")) {
      mirrored.side = getMirrorSide(source.side);
    }
    if (Object.prototype.hasOwnProperty.call(mirrored, "target_joint")) {
      mirrored.target_joint = item.target_joint;
    }
    return mirrored;
  });
}

function mirrorJointRotations(jointRotations = {}, basis = getRigBasis()) {
  const mirrored = {};
  Object.keys(jointRotations || {}).forEach((jointName) => {
    const targetName = getMirrorName(jointName);
    mirrored[targetName] = mirrorQuaternionArray(jointRotations[jointName], basis);
  });
  return mirrored;
}

function mirrorFootLocks(footLocks = {}) {
  return {
    R: Boolean(footLocks.L),
    L: Boolean(footLocks.R),
  };
}

function mirrorKeyframePose(keyframe, targetFrame = MotionState.current_frame) {
  const source = deepClone(keyframe);
  const basis = getRigBasis();
  const planePoint = getMirrorPlanePoint(source.joints || MotionState.joints);
  return {
    ...source,
    pose_index: getPoseIndexForFrame(targetFrame),
    timeline_frame: clampFrame(targetFrame),
    label: source.label === "MIRROR" ? "MANUAL" : "MIRROR",
    joints: mirrorPoseItems(source.joints || [], "name", planePoint, basis),
    joint_rotations: mirrorJointRotations(source.joint_rotations || {}, basis),
    ik_controls: mirrorPoseItems(source.ik_controls || [], "id", planePoint, basis),
    foot_locks: mirrorFootLocks(source.foot_locks || {}),
    interpolation: source.interpolation || "linear",
  };
}

function applyKeyframePoseToCurrentState(keyframe) {
  MotionState.joints = deepClone(keyframe.joints || MotionState.joints);
  MotionState.joint_rotations = deepClone(keyframe.joint_rotations || {});
  MotionState.ik_controls = deepClone(keyframe.ik_controls || MotionState.ik_controls);
  MotionState.current_frame = clampFrame(keyframe.timeline_frame || MotionState.current_frame);
  driveMappedSourceRigFromJoints(MotionState.joints);
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
  if (!shouldPreserveTransformValueBoxForCommand(command)) {
    hideTransformValueBox();
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

function shouldPreserveTransformValueBoxForCommand(command) {
  const mode = command?.args?.transform_mode;
  return ["set_control_transform", "set_control_transforms"].includes(command?.name)
    && ["translate", "rotate", "scale"].includes(mode)
    && Runtime.transformNumericValue?.mode === mode;
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
    setControlSelection([]);
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
    MotionState.direction = { forward_sign: 1, yaw_degrees: 0, confirmed: false };
    applyImportedModelAlignment();
    refreshAlignedSourceRestCache();
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
    setControlSelection([]);
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
      setControlSelection([]);
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
      Runtime.stage = "skeleton";
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
    setControlSelection([]);
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
    Runtime.stage = "skeleton";
    return {
      message: `已根据导入 T-Pose 骨骼生成适配骨架：${joints.length} 个关节点 / ${bones.length} 根骨骼`,
      source_bones: MotionState.source_bones.length,
      joints: joints.length,
      bones: bones.length,
      model_opacity: MotionState.model.opacity,
    };
  },

  create_humanoid_skeleton: async () => {
    if (MotionState.source_bones.length > 0 && !MotionState.direction?.confirmed) {
      throw new Error("请先把模型正面对齐地图黄色前方箭头，并点击“确认方向”，再绑定骨骼赋值。");
    }
    const result = applyHumanoidSkeletonBinding();
    setControlSelection([]);
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    syncSourceRigToMotionState();
    Runtime.stage = result.exposeAssignment ? "skeleton" : "control_rig";
    return {
      message: result.exposeAssignment
        ? "已生成可拖拽赋值的 Humanoid_v1 骨架；先拖动关键点贴合模型，再生成 IK 控制器"
        : "已创建 Humanoid_v1 人形骨架",
      joints: result.joints.length,
      bones: result.bones.length,
      mapped: result.mappedCount,
      missing_required_joints: result.missingRequired,
      editable_assignment_skeleton: result.exposeAssignment,
      optional_fallback_joints: getOptionalFallbackHumanoidMappings(),
    };
    applyImportedModelAlignment();
    refreshAlignedSourceRestCache();
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
    setControlSelection([]);
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    syncSourceRigToMotionState();
    Runtime.stage = MotionState.source_bones.length > 0 && !MotionState.direction?.confirmed ? "skeleton" : "control_rig";
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

  create_ik_controls: async ({ visual_preset, solve_mode } = {}) => {
    ensureHumanoidSkeletonForAnimation();
    requireCharacterDirectionConfirmed();
    const preset = setControlVisualPreset(visual_preset || "compact", { applyToExisting: false });
    const solveMode = setControlSolveMode(solve_mode || MotionState.control_rig_options?.solve_mode || "hybrid", { applyToExisting: false });
    MotionState.ik_controls = createIkControlsFromCurrentSkeleton(preset);
    setControlSelection(MotionState.ik_controls[0]?.id ? [MotionState.ik_controls[0].id] : [], MotionState.ik_controls[0]?.id || null);
    MotionState.dirty_state = true;
    Runtime.stage = "motion";
    return {
      message: `已创建 ${CORE_IK_CONTROL_COUNT} 个 Control Rig 控制器和 ${JOINT_CONTROL_DEFS.length} 个 Joint Debug 控制器`,
      count: MotionState.ik_controls.length,
      core_ik: CORE_IK_CONTROL_COUNT,
      joint_controls: JOINT_CONTROL_DEFS.length,
      visual_preset: preset,
      visual_preset_label: translateControlVisualPreset(preset),
      solve_mode: solveMode,
      solve_mode_label: translateControlSolveMode(solveMode),
    };
  },

  apply_motion_template: async ({ template_id }) => {
    ensureHumanoidSkeletonForAnimation();
    const autoConfirmedDirection = !MotionState.direction?.confirmed;
    if (autoConfirmedDirection) {
      MotionState.direction = {
        forward_sign: 1,
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
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
      preserveControlIds: getControlIdsToPreserveAfterTransform(control, mode),
    });
    activateControlSelection(control.id);
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
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
      preserveControlId: control.type === "pole" ? control.id : null,
    });
    const synced = MotionState.ik_controls.find((item) => item.id === control.id);
    if (synced) {
      synced.rotation = control.rotation || synced.rotation || [0, 0, 0];
      synced.scale = control.scale || synced.scale || [1, 1, 1];
    }
    activateControlSelection(control.id);
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

  set_control_transforms: async ({
    transform_mode,
    space = MotionState.transform.space || "global",
    transforms = [],
    frame,
    insert_keyframe = false,
  }) => {
    requireIkControls();
    const mode = ["translate", "rotate", "scale"].includes(transform_mode) ? transform_mode : "translate";
    const appliedIds = [];
    const preserveControlIds = new Set();
    const desiredPositions = new Map();
    transforms.forEach((item) => {
      const control = MotionState.ik_controls.find((candidate) => candidate.id === item?.control_id);
      if (!control) {
        return;
      }
      const previousControl = deepClone(control);
      if (mode === "translate" && item.position) {
        const nextPosition = normalizeVec3(item.position, control.position);
        control.position = nextPosition;
        preserveControlIds.add(control.id);
        desiredPositions.set(control.id, [...nextPosition]);
      } else if (mode === "rotate" && item.rotation && !control.is_joint_control) {
        control.rotation = normalizeVec3(item.rotation, control.rotation || [0, 0, 0]);
        getControlIdsToPreserveAfterTransform(control, mode).forEach((id) => preserveControlIds.add(id));
      } else if (mode === "scale" && item.scale && control.allow_scale && !control.is_joint_control) {
        control.scale = normalizeVec3(item.scale, control.scale || [1, 1, 1], 0.05, 20);
      } else {
        return;
      }
      applyControlToJoint(control, previousControl);
      appliedIds.push(control.id);
    });
    desiredPositions.forEach((position, controlId) => {
      const control = MotionState.ik_controls.find((candidate) => candidate.id === controlId);
      if (control) {
        control.position = [...position];
      }
    });
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
      preserveControlIds: [...preserveControlIds],
    });
    if (appliedIds.length === 0) {
      throw new Error("没有可变换的已选控制器");
    }
    MotionState.transform.space = space === "local" ? "local" : "global";
    MotionState.transform.tool = mode;
    setControlSelection(appliedIds, appliedIds.at(-1));
    const primary = MotionState.ik_controls.find((item) => item.id === MotionState.selected_control);
    if (primary?.target_joint) {
      MotionState.selected_bone = getBoneNameForJoint(primary.target_joint) || MotionState.selected_bone;
    }
    MotionState.validation_report = createEmptyValidationReport();
    if (insert_keyframe) {
      upsertManualKeyframe(frame || MotionState.current_frame);
    }
    MotionState.dirty_state = true;
    return {
      message: `已批量变换 ${appliedIds.length} 个控制器`,
      transform_mode: mode,
      count: appliedIds.length,
      selected_controls: getSelectedControlIds(),
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
    moveJointBranch(joint, position.map(Number), {
      preserveParentLength: !MotionState.skeleton?.editable_assignment_skeleton,
    });
    maybeAssignJointToNearestSourceBone(joint);
    persistEditableAssignmentRestJoints();
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
    persistEditableAssignmentRestJoints();
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    activateControlSelection(getControlForJoint(joint)?.id || MotionState.selected_control);
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
    persistEditableAssignmentRestJoints();
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    activateControlSelection(getControlForJoint(joint)?.id || MotionState.selected_control);
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

  delete_current_keyframe: async ({ frame } = {}) => {
    const targetFrame = clampFrame(frame || MotionState.current_frame);
    const beforeCount = MotionState.keyframes.length;
    MotionState.keyframes = MotionState.keyframes.filter((keyframe) => keyframe.timeline_frame !== targetFrame);
    Runtime.selectedTimelineFrames = Runtime.selectedTimelineFrames.filter((item) => item !== targetFrame);
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    return {
      message: beforeCount === MotionState.keyframes.length ? `第 ${targetFrame} 帧没有关键帧` : `已删除第 ${targetFrame} 帧关键帧`,
      frame: targetFrame,
      deleted: beforeCount !== MotionState.keyframes.length,
      keyframes: MotionState.keyframes.length,
    };
  },

  copy_current_frame: async () => {
    requireSkeleton();
    Runtime.copiedKeyframe = createKeyframeFromCurrentPose(MotionState.current_frame, "COPIED");
    return { message: `已复制第 ${MotionState.current_frame} 帧`, frame: MotionState.current_frame };
  },

  paste_copied_frame: async ({ frame }) => {
    requireSkeleton();
    if (!Runtime.copiedKeyframe) {
      throw new Error("没有已复制的当前帧");
    }
    const targetFrame = clampFrame(Number(frame) || MotionState.current_frame);
    const keyframe = {
      ...deepClone(Runtime.copiedKeyframe),
      label: "COPIED",
      timeline_frame: targetFrame,
      pose_index: getPoseIndexForFrame(targetFrame),
    };
    applyKeyframePoseToCurrentState(keyframe);
    upsertKeyframe(keyframe);
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    Runtime.stage = "motion";
    return { message: `已粘贴到第 ${targetFrame} 帧`, frame: targetFrame };
  },

  mirror_current_frame: async ({ frame } = {}) => {
    requireSkeleton();
    const targetFrame = clampFrame(Number(frame) || MotionState.current_frame);
    const current = createKeyframeFromCurrentPose(targetFrame);
    const mirrored = mirrorKeyframePose(current, targetFrame);
    applyKeyframePoseToCurrentState(mirrored);
    upsertKeyframe(mirrored);
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.dirty_state = true;
    Runtime.stage = "motion";
    return { message: `已镜像第 ${targetFrame} 帧`, frame: targetFrame };
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
    return { message: translateStatus(MotionState.validation_report.status), report: MotionState.validation_report };
  },

  export_motion_json: async () => {
    let auto_validated = false;
    if (MotionState.keyframes.length > 0 && MotionState.validation_report.status !== "Passed") {
      MotionState.validation_report = buildValidationReport();
      auto_validated = true;
    }
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
      export_meta: {
        auto_validated,
        validation_status: MotionState.validation_report.status,
      },
      visual_opacity: MotionState.visual_opacity,
      control_rig_options: MotionState.control_rig_options,
    };
    MotionState.exported_json = JSON.stringify(payload, null, 2);
    MotionState.dirty_state = false;
    return { message: "已导出动作 JSON", bytes: MotionState.exported_json.length };
  },

  export_binding_preset: async () => {
    requireHumanoidSkeleton();
    const sourceBoneNameByJoint = {};
    Object.entries(MotionState.humanoid_mapping || {}).forEach(([joint, sourceId]) => {
      sourceBoneNameByJoint[joint] = MotionState.source_bones.find((bone) => bone.id === sourceId)?.name || null;
    });
    const payload = {
      schema: "humanoid_binding_preset_v1",
      exported_at: new Date().toISOString(),
      model_source: MotionState.model.source,
      rest_pose: MotionState.rest_pose,
      direction: MotionState.direction,
      humanoid_mapping: MotionState.humanoid_mapping,
      source_bone_names: sourceBoneNameByJoint,
      skeleton: {
        ...MotionState.skeleton,
        rest_joints: deepClone(MotionState.skeleton?.rest_joints || MotionState.joints),
      },
      joints: MotionState.joints,
      bones: MotionState.bones,
    };
    MotionState.exported_json = JSON.stringify(payload, null, 2);
    Runtime.stage = "export";
    return {
      message: "已导出绑定预设",
      bytes: MotionState.exported_json.length,
      mapped: getMappingCount(),
      editable_assignment_skeleton: Boolean(MotionState.skeleton?.editable_assignment_skeleton),
    };
  },

  import_binding_preset: async ({ json }) => {
    if (!json?.trim()) {
      throw new Error("导入绑定预设需要 JSON 文本");
    }
    const data = JSON.parse(json);
    if (data.schema !== "humanoid_binding_preset_v1") {
      throw new Error("不支持的绑定预设 JSON 结构");
    }
    const availableSourceIds = new Set(MotionState.source_bones.map((bone) => bone.id));
    const sourceByName = new Map(MotionState.source_bones.map((bone) => [bone.name, bone]));
    const remapped = {};
    Object.entries(data.humanoid_mapping || {}).forEach(([joint, sourceId]) => {
      if (!HUMANOID_JOINT_NAMES.includes(joint)) {
        return;
      }
      if (availableSourceIds.has(sourceId)) {
        remapped[joint] = sourceId;
        return;
      }
      const sourceName = data.source_bone_names?.[joint];
      const byName = sourceName ? sourceByName.get(sourceName) : null;
      if (byName) {
        remapped[joint] = byName.id;
      }
    });
    MotionState.humanoid_mapping = remapped;
    MotionState.direction = normalizeDirectionState(data.direction);
    MotionState.skeleton = {
      ...(data.skeleton || {}),
      id: "Humanoid_v1",
      version: 1,
      joint_names: [...HUMANOID_JOINT_NAMES],
      rest_joints: deepClone(data.skeleton?.rest_joints || data.joints || []),
    };
    MotionState.joints = deepClone(data.joints || MotionState.skeleton.rest_joints || []);
    MotionState.bones = deepClone(data.bones || HUMANOID_BONE_CONNECTIONS.map(([parent, child]) => ({
      name: child,
      parent,
      start: parent,
      end: child,
      side: getSide(child),
      length: distance(getJointPositionFromList(MotionState.joints, parent), getJointPositionFromList(MotionState.joints, child)),
      color_rule: getColorRule(getSide(child)),
    })));
    MotionState.joint_rotations = {};
    MotionState.ik_controls = [];
    MotionState.keyframes = [];
    MotionState.selected_bone = MotionState.bones[0]?.name || null;
    setControlSelection([]);
    if (MotionState.skeleton.editable_assignment_skeleton) {
      MotionState.show.joint_debug_controls = true;
    }
    MotionState.validation_report = createEmptyValidationReport();
    MotionState.exported_json = json;
    MotionState.dirty_state = true;
    syncSourceRigToMotionState();
    Runtime.stage = "skeleton";
    return {
      message: "已导入绑定预设",
      mapped: getMappingCount(),
      joints: MotionState.joints.length,
      bones: MotionState.bones.length,
    };
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
    MotionState.direction = normalizeDirectionState(data.direction);
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
      control_size: 0.68,
      control_thickness: 0.2,
      ...(data.visual_opacity || {}),
    };
    MotionState.control_rig_options = {
      visual_preset: "compact",
      solve_mode: "hybrid",
      ...(data.control_rig_options || {}),
    };
    setControlVisualPreset(MotionState.control_rig_options.visual_preset, { applyToExisting: true });
    setControlSolveMode(MotionState.control_rig_options.solve_mode, { applyToExisting: true });
    MotionState.selected_bone = MotionState.bones[0]?.name || null;
    MotionState.selected_source_bone_id = MotionState.source_bones[0]?.id || null;
    setControlSelection(
      Array.isArray(data.selected_controls) ? data.selected_controls : data.selected_control ? [data.selected_control] : MotionState.ik_controls[0]?.id ? [MotionState.ik_controls[0].id] : [],
      data.selected_control || MotionState.ik_controls[0]?.id || null,
    );
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
    Runtime.stage = "motion";
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

  select_control: async ({ control, additive = false, toggle = false, remove = false }) => {
    const selected = selectControlWithMode(control, { additive: Boolean(additive), toggle: Boolean(toggle), remove: Boolean(remove) });
    if (selected?.target_joint) {
      MotionState.selected_bone = getBoneNameForJoint(selected.target_joint) || MotionState.selected_bone;
      setCameraTargetToPosition(getJoint(selected.target_joint)?.position || selected.position);
    } else if (!selected) {
      MotionState.selected_bone = null;
    }
    return {
      message: selected ? `已选中控制器 ${translateControlName(selected.id)}` : "已取消控制器选择",
      selected_controls: getSelectedControlIds(),
      count: getSelectedControlIds().length,
    };
  },

  clear_selection: async () => {
    cancelKeyboardTransform();
    MotionState.selected_bone = null;
    MotionState.selected_source_bone_id = null;
    setControlSelection([]);
    Runtime.selectedTimelineFrames = [];
    Runtime.pendingViewportDrag = null;
    Runtime.hoveredControlId = null;
    Runtime.hoveredJointName = null;
    Runtime.hoveredTransformAxis = null;
    return { message: "已取消所有选择" };
  },

  set_character_direction: async ({ yaw_degrees = MotionState.direction?.yaw_degrees || 0, confirmed = true }) => {
    const sign = 1;
    const yaw = normalizeForwardYaw(yaw_degrees);
    MotionState.direction = { forward_sign: sign, yaw_degrees: yaw, confirmed: Boolean(confirmed) };
    applyImportedModelAlignment();
    refreshAlignedSourceRestCache();
    if (MotionState.skeleton?.id === "Humanoid_v1") {
      rebuildHumanoidSkeletonFromMapping();
      syncSourceRigToMotionState();
    } else if (MotionState.skeleton) {
      MotionState.skeleton.direction = MotionState.direction;
    }
    if (MotionState.skeleton?.id === "Humanoid_v1" && MotionState.ik_controls.length > 0) {
      MotionState.ik_controls = createIkControlsFromCurrentSkeleton();
      setControlSelection(MotionState.ik_controls[0]?.id ? [MotionState.ik_controls[0].id] : [], MotionState.ik_controls[0]?.id || null);
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

  set_playback_fps: async ({ fps }) => {
    const nextFps = Math.max(1, Math.min(120, Math.round(Number(fps) || 24)));
    MotionState.playback_fps = nextFps;
    if (Runtime.isPlaying) {
      Runtime.playStartedAt = performance.now();
      Runtime.playStartFrame = MotionState.current_frame;
      Runtime.lastRenderedFrame = null;
    }
    MotionState.dirty_state = true;
    return { message: `FPS ${nextFps}`, fps: nextFps };
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

  reset_timeline_view: async () => {
    Runtime.timelineViewPinned = false;
    Runtime.timelineView = { start: 1, frames: 24 };
    ensureTimelineFrameVisible(MotionState.current_frame, { force: true });
    const view = getTimelineView();
    return { message: `时间轴窗口 ${view.start}-${view.end}`, start: view.start, end: view.end, frames: view.frames };
  },

  zoom_timeline_view: async ({ direction = "in" }) => {
    const view = zoomTimelineView(direction === "out" ? "out" : "in", getCurrentFrameTimelineRatio());
    return { message: `时间轴窗口 ${view.start}-${view.end}`, start: view.start, end: view.end, frames: view.frames };
  },

  pan_timeline_view: async ({ direction = "right" }) => {
    const view = panTimelineView(direction === "left" ? "left" : "right");
    return { message: `时间轴窗口 ${view.start}-${view.end}`, start: view.start, end: view.end, frames: view.frames };
  },

  go_to_previous_keyframe: async () => {
    const frames = getSortedKeyframes().map((keyframe) => keyframe.timeline_frame);
    if (frames.length === 0) {
      throw new Error("没有可跳转的关键帧");
    }
    const previous = [...frames].reverse().find((frame) => frame < MotionState.current_frame) ?? frames.at(-1);
    MotionState.current_frame = clampFrame(previous);
    applyPoseAtFrame(MotionState.current_frame);
    return { message: `上一关键帧 ${MotionState.current_frame}`, frame: MotionState.current_frame };
  },

  go_to_next_keyframe: async () => {
    const frames = getSortedKeyframes().map((keyframe) => keyframe.timeline_frame);
    if (frames.length === 0) {
      throw new Error("没有可跳转的关键帧");
    }
    const next = frames.find((frame) => frame > MotionState.current_frame) ?? frames[0];
    MotionState.current_frame = clampFrame(next);
    applyPoseAtFrame(MotionState.current_frame);
    return { message: `下一关键帧 ${MotionState.current_frame}`, frame: MotionState.current_frame };
  },

  set_view_option: async ({ key, value }) => {
    if (!(key in MotionState.show)) {
      throw new Error(`未知显示选项：${key}`);
    }
    MotionState.show[key] = Boolean(value);
    return { message: `${translateViewOption(key)} 已${MotionState.show[key] ? "开启" : "关闭"}` };
  },

  set_control_visual_size: async ({ size }) => {
    MotionState.visual_opacity.control_size = clampNumber(size, 0.35, 1.6, 0.68);
    return { message: `控制器大小 ${MotionState.visual_opacity.control_size.toFixed(2)}` };
  },

  set_control_visual_thickness: async ({ thickness }) => {
    MotionState.visual_opacity.control_thickness = clampNumber(thickness, 0.05, 1.2, 0.2);
    return { message: `控制器线粗 ${MotionState.visual_opacity.control_thickness.toFixed(2)}` };
  },

  set_control_visual_preset: async ({ visual_preset }) => {
    const preset = setControlVisualPreset(visual_preset, { applyToExisting: true });
    MotionState.dirty_state = true;
    return {
      message: `控制器方案 ${translateControlVisualPreset(preset)}`,
      visual_preset: preset,
      visual_preset_label: translateControlVisualPreset(preset),
    };
  },

  set_control_solve_mode: async ({ solve_mode }) => {
    const mode = setControlSolveMode(solve_mode, { applyToExisting: true });
    MotionState.dirty_state = true;
    return {
      message: `控制逻辑 ${translateControlSolveMode(mode)}`,
      solve_mode: mode,
      solve_mode_label: translateControlSolveMode(mode),
    };
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
    "set_control_transforms",
    "set_ik_target",
    "set_joint_position",
    "rotate_joint_branch",
    "scale_joint_branch",
    "set_control_solve_mode",
    "set_playback_fps",
    "insert_keyframe",
    "delete_current_keyframe",
    "paste_copied_frame",
    "mirror_current_frame",
    "smooth_keyframes_between",
    "validate_motion",
    "export_motion_json",
    "import_motion_json",
    "export_binding_preset",
    "import_binding_preset",
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
    selected_controls: MotionState.selected_controls,
    transform: MotionState.transform,
    validation_report: MotionState.validation_report,
    dirty_state: MotionState.dirty_state,
    exported_json: MotionState.exported_json,
    visual_opacity: MotionState.visual_opacity,
    control_rig_options: MotionState.control_rig_options,
  });
}

function restoreCoreState(snapshot) {
  Object.assign(MotionState, deepClone(snapshot));
  MotionState.control_rig_options = {
    visual_preset: "compact",
    solve_mode: "hybrid",
    ...(MotionState.control_rig_options || {}),
  };
  normalizeControlSelectionState();
  applyImportedModelAlignment();
  syncSourceRigToMotionState();
}

function getSelectedControlIds() {
  const knownIds = new Set(MotionState.ik_controls.map((control) => control.id));
  const rawIds = Array.isArray(MotionState.selected_controls) ? MotionState.selected_controls : [];
  const merged = [...rawIds];
  if (MotionState.selected_control && !merged.includes(MotionState.selected_control)) {
    merged.push(MotionState.selected_control);
  }
  return [...new Set(merged)].filter((id) => knownIds.has(id));
}

function normalizeControlSelectionState() {
  const ids = getSelectedControlIds();
  MotionState.selected_controls = ids;
  if (!ids.includes(MotionState.selected_control)) {
    MotionState.selected_control = ids.at(-1) || null;
  }
  return ids;
}

function setControlSelection(controlIds = [], primaryControlId = null) {
  const knownIds = new Set(MotionState.ik_controls.map((control) => control.id));
  const ids = [...new Set(controlIds)].filter((id) => knownIds.has(id));
  const primary = primaryControlId && ids.includes(primaryControlId) ? primaryControlId : ids.at(-1) || null;
  MotionState.selected_controls = ids;
  MotionState.selected_control = primary;
  const selected = MotionState.ik_controls.find((control) => control.id === primary) || null;
  if (selected?.target_joint) {
    MotionState.selected_bone = getBoneNameForJoint(selected.target_joint) || MotionState.selected_bone;
  }
  return selected;
}

function activateControlSelection(controlId) {
  if (!controlId) {
    return setControlSelection([]);
  }
  const ids = getSelectedControlIds();
  return setControlSelection(ids.includes(controlId) ? ids : [controlId], controlId);
}

function selectControlWithMode(controlId, { additive = false, toggle = false, remove = false } = {}) {
  if (!controlId) {
    return setControlSelection([]);
  }
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  if (!control) {
    throw new Error(`未找到控制器：${controlId || "无"}`);
  }
  const currentIds = getSelectedControlIds();
  if (remove) {
    const nextIds = currentIds.filter((id) => id !== controlId);
    const nextPrimary = MotionState.selected_control === controlId ? nextIds.at(-1) || null : MotionState.selected_control;
    return setControlSelection(nextIds, nextPrimary);
  }
  if (toggle) {
    if (currentIds.includes(controlId)) {
      const nextIds = currentIds.filter((id) => id !== controlId);
      const nextPrimary = MotionState.selected_control === controlId ? nextIds.at(-1) || null : MotionState.selected_control;
      return setControlSelection(nextIds, nextPrimary);
    }
    return setControlSelection([...currentIds, controlId], controlId);
  }
  if (additive) {
    return setControlSelection(currentIds.includes(controlId) ? currentIds : [...currentIds, controlId], controlId);
  }
  return setControlSelection([controlId], controlId);
}

function isControlSelected(controlId) {
  return getSelectedControlIds().includes(controlId);
}

function normalizeControlVisualPreset(preset) {
  return CONTROL_VISUAL_PRESET_IDS.includes(preset) ? preset : "compact";
}

function getActiveControlVisualPreset() {
  return normalizeControlVisualPreset(MotionState.control_rig_options?.visual_preset || "compact");
}

function setControlVisualPreset(preset, { applyToExisting = true } = {}) {
  const normalized = normalizeControlVisualPreset(preset);
  MotionState.control_rig_options = {
    ...(MotionState.control_rig_options || {}),
    visual_preset: normalized,
  };
  if (applyToExisting) {
    MotionState.ik_controls = MotionState.ik_controls.map((control) => ({
      ...control,
      visual_preset: normalized,
    }));
  }
  return normalized;
}

function translateControlVisualPreset(preset) {
  return CONTROL_VISUAL_PRESETS[normalizeControlVisualPreset(preset)]?.label || preset || "轻量多边形";
}

function getControlVisualPreset(control) {
  return normalizeControlVisualPreset(control?.visual_preset || MotionState.control_rig_options?.visual_preset || "compact");
}

function normalizeControlSolveMode(mode) {
  return CONTROL_SOLVE_MODE_IDS.includes(mode) ? mode : "hybrid";
}

function getActiveControlSolveMode() {
  return normalizeControlSolveMode(MotionState.control_rig_options?.solve_mode || "hybrid");
}

function setControlSolveMode(mode, { applyToExisting = true } = {}) {
  const normalized = normalizeControlSolveMode(mode);
  MotionState.control_rig_options = {
    ...(MotionState.control_rig_options || {}),
    solve_mode: normalized,
  };
  if (applyToExisting) {
    MotionState.ik_controls = MotionState.ik_controls.map((control) => ({
      ...control,
      solve_mode: normalized,
    }));
  }
  return normalized;
}

function translateControlSolveMode(mode) {
  return CONTROL_SOLVE_MODES[normalizeControlSolveMode(mode)]?.label || mode || "IK/FK 混合";
}

function shouldPinFeetForBodyMove() {
  return getActiveControlSolveMode() !== "basic";
}

function shouldUseIkWalkArms() {
  return getActiveControlSolveMode() !== "basic";
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

function hasConfirmedHumanoidBinding() {
  return MotionState.skeleton?.id === "Humanoid_v1"
    && MotionState.joints.length > 0;
}

function getBoneNameForJoint(joint) {
  if (joint === "Hips") return "Spine";
  if (joint === "Head") return "Head";
  return HUMANOID_BONE_CONNECTIONS.find(([, child]) => child === joint)?.[1] || null;
}

function createSourceSkeletonData() {
  applyImportedModelAlignment();
  const sourceNameById = new Map();
  MotionState.source_bones.forEach((bone, index) => {
    sourceNameById.set(bone.id, createSourceJointName(bone, index));
  });
  const joints = MotionState.source_bones.map((bone, index) => ({
    name: sourceNameById.get(bone.id),
    display_name: bone.name,
    side: bone.side_guess,
    position: [...(getSourceBoneWorldPosition(bone) || bone.position)],
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
  if (MotionState.direction?.confirmed) {
    const height = getRigHeight();
    return {
      right: fallbackRight.clone(),
      up: fallbackUp.clone(),
      forward: fallbackForward.clone(),
      height,
      scale: Math.max(height / 1.82, 0.05),
    };
  }

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

  const rawRight = right.clone();
  let forward = right.clone().cross(up);
  if (forward.length() < 0.001) {
    forward = fallbackForward.clone();
  }
  forward.normalize();
  right = rawRight;
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
  applyImportedModelAlignment();
  const sourceById = new Map(MotionState.source_bones.map((bone) => [bone.id, bone]));
  const estimatedByName = getEstimatedHumanoidPositionMap();
  const positionByName = new Map();
  HUMANOID_JOINT_NAMES.forEach((name) => {
    const sourceBone = sourceById.get(MotionState.humanoid_mapping[name]);
    const sourcePosition = sourceBone
      ? getSourceBoneWorldPosition(sourceBone) || applyModelAlignmentToPosition(sourceBone.position)
      : null;
    const estimatedPosition = estimatedByName.get(name);
    positionByName.set(name, sourcePosition ? [...sourcePosition] : [...(estimatedPosition || HUMANOID_REST_POSITIONS[name])]);
  });
  applyOptionalHumanoidFallbackPositions(positionByName);
  const joints = HUMANOID_JOINT_NAMES.map((name) => {
    const sourceBone = sourceById.get(MotionState.humanoid_mapping[name]);
    const isOptionalFallback = MotionState.source_bones.length > 0
      && !sourceBone
      && OPTIONAL_HUMANOID_MAPPING_JOINTS.has(name);
    const isEstimatedFromMesh = !sourceBone && estimatedByName.has(name) && !isOptionalFallback;
    return {
      name,
      side: getSide(name),
      position: [...positionByName.get(name)],
      source_bone_id: MotionState.humanoid_mapping[name] || null,
      source_bone_name: sourceBone?.name || null,
      rest_pose: sourceBone ? MotionState.rest_pose : isOptionalFallback ? "Foot Fallback" : isEstimatedFromMesh ? "Estimated Assignment" : "Default T-Pose",
      is_optional_fallback: isOptionalFallback,
      is_estimated_from_mesh: isEstimatedFromMesh,
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

function getEstimatedHumanoidPositionMap() {
  if (!Runtime.importedModelScene || MotionState.model.type !== "glb_reference") {
    return new Map();
  }
  try {
    const estimated = createEstimatedHumanoidSkeletonFromModel();
    return new Map(estimated.joints.map((joint) => [joint.name, [...joint.position]]));
  } catch (error) {
    console.warn("Unable to estimate assignment skeleton from imported model bounds.", error);
    return new Map();
  }
}

function shouldExposeAssignmentSkeleton(mappedCount, missingRequired) {
  return MotionState.model.type === "glb_reference"
    && Boolean(Runtime.importedModelScene)
    && (MotionState.source_bones.length === 0 || missingRequired.length > 0 || mappedCount === 0);
}

function applyHumanoidSkeletonBinding({ exposeJointControls = false } = {}) {
  applyImportedModelAlignment();
  refreshAlignedSourceRestCache();
  const { joints, bones } = createHumanoidSkeletonData();
  const mappedCount = getMappingCount();
  const missingRequired = getMissingHumanoidMappings({ includeOptional: false });
  const exposeAssignment = exposeJointControls || shouldExposeAssignmentSkeleton(mappedCount, missingRequired);
  MotionState.skeleton = {
    ...(MotionState.skeleton || {}),
    id: "Humanoid_v1",
    version: 1,
    joint_names: [...HUMANOID_JOINT_NAMES],
    rest_joints: deepClone(joints),
    rest_pose: MotionState.rest_pose,
    direction: MotionState.direction,
    mapping_source: MotionState.source_bones.length > 0
      ? missingRequired.length > 0 ? "partial_imported_tpose_assignment" : "imported_tpose"
      : MotionState.model.type === "glb_reference" ? "estimated_assignment_tpose" : "default_tpose",
    mapped_joints: mappedCount,
    missing_required_joints: missingRequired,
    optional_fallback_joints: getOptionalFallbackHumanoidMappings(),
    editable_assignment_skeleton: exposeAssignment,
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
  if (exposeAssignment) {
    MotionState.show.joint_debug_controls = true;
  }
  return { joints, bones, mappedCount, missingRequired, exposeAssignment };
}

function rebuildHumanoidSkeletonFromMapping() {
  applyHumanoidSkeletonBinding();
  return;
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
  setRigControlRotation("Pelvis_CTRL", [0, 0, 0]);
  setRigControlRotation("Chest_CTRL", [0, 0, 0]);
  setRigControlRotation("Head_CTRL", [0, 0, 0]);
  ["R_Knee_Pole", "L_Knee_Pole"].forEach((controlId) => {
    setWalkPoleControl(controlId, basis);
  });
  setWalkElbowPoleControl("R_Elbow_Pole", "R", basis);
  setWalkElbowPoleControl("L_Elbow_Pole", "L", basis);
  setLimbIkControl("R_Foot_IK", baseControls, basis, params.rFootZ || 0, params.rFootY || 0, Boolean(params.lock?.R));
  setLimbIkControl("L_Foot_IK", baseControls, basis, params.lFootZ || 0, params.lFootY || 0, Boolean(params.lock?.L));
  if (shouldUseIkWalkArms()) {
    setWalkHandIkControl("R_Hand_IK", "R", basis, params.rHandZ || 0);
    setWalkHandIkControl("L_Hand_IK", "L", basis, params.lHandZ || 0);
  } else {
    setWalkArmPose("R", basis, params.rHandZ || 0);
    setWalkArmPose("L", basis, params.lHandZ || 0);
  }
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
  MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
    preserveControlId: control.type === "pole" ? control.id : null,
  });
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

function setWalkElbowPoleControl(controlId, side, basis = getRigBasis()) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  const shoulder = getJoint(`${side}_UpperArm`);
  const chest = getJoint("Chest") || getJoint("Spine") || getJoint("Hips");
  if (!control || !shoulder || !chest) {
    return;
  }
  const sideSign = side === "R" ? 1 : -1;
  const shoulderVec = new THREE.Vector3().fromArray(shoulder.position);
  const centerVec = new THREE.Vector3().fromArray(chest.position);
  let sideDirection = projectOntoPlane(shoulderVec.clone().sub(centerVec), basis.up);
  if (sideDirection.length() < 0.001) {
    sideDirection = basis.right.clone().multiplyScalar(sideSign);
  }
  sideDirection.normalize();
  const desiredSide = basis.right.clone().multiplyScalar(sideSign);
  if (sideDirection.dot(desiredSide) < 0) {
    sideDirection.negate();
  }
  const position = shoulderVec.clone()
    .addScaledVector(sideDirection, 0.34 * basis.scale)
    .addScaledVector(basis.up, -0.08 * basis.scale)
    .addScaledVector(basis.forward, -0.44 * basis.scale);
  setRigControlPosition(controlId, position.toArray(), false);
}

function setWalkArmPose(side, basis = getRigBasis(), forwardOffset = 0) {
  const forearm = getJoint(`${side}_Forearm`);
  const hand = getJoint(`${side}_Hand`);
  const handControl = MotionState.ik_controls.find((item) => item.id === `${side}_Hand_IK`);
  const poleControl = MotionState.ik_controls.find((item) => item.id === `${side}_Elbow_Pole`);
  const guide = getWalkArmGuidePose(side, basis, forwardOffset);
  if (!guide || !forearm || !hand) {
    return;
  }
  forearm.position = guide.elbowPosition.toArray();
  hand.position = guide.handPosition.toArray();
  if (handControl) {
    handControl.position = [...hand.position];
    handControl.rotation = [0, 0, 0];
  }
  if (poleControl) {
    poleControl.position = guide.polePosition.toArray();
  }
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function getWalkArmGuidePose(side, basis = getRigBasis(), forwardOffset = 0) {
  const shoulder = getJoint(`${side}_UpperArm`);
  const forearm = getJoint(`${side}_Forearm`);
  const hand = getJoint(`${side}_Hand`);
  if (!shoulder || !forearm || !hand) {
    return;
  }
  const shoulderVec = new THREE.Vector3().fromArray(shoulder.position);
  const sideDirection = getCharacterSideDirection(side, basis);
  const down = basis.up.clone().normalize().negate();
  const forward = basis.forward.clone().normalize();
  const swing = forward.clone().multiplyScalar(forwardOffset * basis.scale);
  const backward = basis.forward.clone().normalize().negate();
  const upperLength = Math.max(
    getRestVector(`${side}_UpperArm`).distanceTo(getRestVector(`${side}_Forearm`)),
    shoulderVec.distanceTo(new THREE.Vector3().fromArray(forearm.position)),
    0.08 * basis.scale,
  );
  const lowerLength = Math.max(
    getRestVector(`${side}_Forearm`).distanceTo(getRestVector(`${side}_Hand`)),
    new THREE.Vector3().fromArray(forearm.position).distanceTo(new THREE.Vector3().fromArray(hand.position)),
    0.08 * basis.scale,
  );
  const armLength = upperLength + lowerLength;
  const handPosition = shoulderVec.clone()
    .addScaledVector(sideDirection, 0.1 * basis.scale)
    .addScaledVector(down, armLength * 0.9)
    .addScaledVector(swing, 0.88);
  keepHandTargetOutsideBody(handPosition, sideDirection, getBodySideCenter(), basis.scale);

  const targetDelta = handPosition.clone().sub(shoulderVec);
  const maxReach = Math.max(upperLength + lowerLength - 0.0001, 0.001);
  const minReach = Math.max(Math.abs(upperLength - lowerLength) + 0.0001, 0.001);
  const targetDistance = THREE.MathUtils.clamp(targetDelta.length(), minReach, maxReach);
  const targetDirection = targetDelta.length() > 0.0001 ? targetDelta.clone().normalize() : down.clone();
  const target = shoulderVec.clone().addScaledVector(targetDirection, targetDistance);
  handPosition.copy(target);

  const bendGuide = backward.clone()
    .addScaledVector(sideDirection, 0.35)
    .addScaledVector(down, 0.18)
    .addScaledVector(forward, THREE.MathUtils.clamp(forwardOffset, -0.16, 0.16) * 0.45);
  let bendDirection = bendGuide.sub(targetDirection.clone().multiplyScalar(bendGuide.dot(targetDirection)));
  if (bendDirection.length() < 0.001) {
    bendDirection = sideDirection.clone()
      .addScaledVector(backward, 0.7)
      .sub(targetDirection.clone().multiplyScalar(sideDirection.dot(targetDirection)));
  }
  if (bendDirection.length() < 0.001) {
    bendDirection = backward.clone();
  }
  bendDirection.normalize();
  const along = (upperLength * upperLength + targetDistance * targetDistance - lowerLength * lowerLength) / (2 * targetDistance);
  const height = Math.sqrt(Math.max(upperLength * upperLength - along * along, 0));
  const elbowPosition = shoulderVec.clone()
    .addScaledVector(targetDirection, along)
    .addScaledVector(bendDirection, height);
  const polePosition = elbowPosition.clone()
    .addScaledVector(bendDirection, 0.24 * basis.scale)
    .addScaledVector(backward, 0.1 * basis.scale);
  return { elbowPosition, handPosition, polePosition };
}

function getCharacterSideDirection(side, basis = getRigBasis()) {
  const own = getJoint(`${side}_UpperArm`) || getJoint(`${side}_UpperLeg`);
  const otherSide = side === "R" ? "L" : "R";
  const other = getJoint(`${otherSide}_UpperArm`) || getJoint(`${otherSide}_UpperLeg`);
  let direction = own && other
    ? new THREE.Vector3().fromArray(own.position).sub(new THREE.Vector3().fromArray(other.position))
    : basis.right.clone().multiplyScalar(side === "R" ? 1 : -1);
  direction = projectOntoPlane(direction, basis.up);
  if (direction.length() < 0.001) {
    direction = basis.right.clone().multiplyScalar(side === "R" ? 1 : -1);
  }
  return direction.normalize();
}

function getBodySideCenter() {
  const chest = getJoint("Chest") || getJoint("Spine") || getJoint("Hips");
  return new THREE.Vector3().fromArray(chest?.position || [0, 0, 0]);
}

function setWalkHandIkControl(controlId, side, basis = getRigBasis(), forwardOffset = 0) {
  const forearm = getJoint(`${side}_Forearm`);
  const hand = getJoint(`${side}_Hand`);
  const handControl = MotionState.ik_controls.find((item) => item.id === controlId);
  const poleControl = MotionState.ik_controls.find((item) => item.id === `${side}_Elbow_Pole`);
  const guide = getWalkArmGuidePose(side, basis, forwardOffset);
  if (!guide || !forearm || !hand || !handControl) {
    return;
  }
  forearm.position = guide.elbowPosition.toArray();
  hand.position = guide.handPosition.toArray();
  handControl.position = guide.handPosition.toArray();
  handControl.rotation = [0, 0, 0];
  handControl.locked = false;
  if (poleControl) {
    poleControl.position = guide.polePosition.toArray();
    poleControl.locked = false;
  }
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function keepHandTargetOutsideBody(target, sideDirection, center, scale) {
  const minSideDistance = Math.max(0.16 * scale, 0.08);
  const currentSideDistance = target.clone().sub(center).dot(sideDirection);
  if (currentSideDistance < minSideDistance) {
    target.addScaledVector(sideDirection, minSideDistance - currentSideDistance);
  }
  return target;
}

function setRigControlRotation(controlId, rotation) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  if (!control) {
    return;
  }
  const previous = deepClone(control);
  control.rotation = rotation;
  applyControlToJoint(control, previous);
  MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
    preserveControlId: control.type === "pole" ? control.id : null,
  });
  const synced = MotionState.ik_controls.find((item) => item.id === controlId);
  if (synced) {
    synced.rotation = rotation;
  }
}

function clearRigControlRotation(controlId) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  if (!control) {
    return;
  }
  control.rotation = [0, 0, 0];
  if (control.target_joint && MotionState.joint_rotations?.[control.target_joint]) {
    delete MotionState.joint_rotations[control.target_joint];
  }
  const synced = MotionState.ik_controls.find((item) => item.id === controlId);
  if (synced) {
    synced.rotation = [0, 0, 0];
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
      solve_mode: getActiveControlSolveMode(),
    };
  });
}

function createIkControlsFromCurrentSkeleton(visualPreset = getActiveControlVisualPreset()) {
  const basis = getRigBasis();
  const preset = normalizeControlVisualPreset(visualPreset);
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
      visual_preset: preset,
      solve_mode: getActiveControlSolveMode(),
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
    return jointVec.clone()
      .addScaledVector(basis.up, 0.18 * basis.scale)
      .addScaledVector(basis.forward, -0.035 * basis.scale)
      .toArray();
  }
  if (def.id === "Pelvis_CTRL") {
    return jointVec.clone()
      .addScaledVector(basis.up, 0.035 * basis.scale)
      .addScaledVector(basis.forward, 0.055 * basis.scale)
      .toArray();
  }
  if (def.id === "Chest_CTRL") {
    return jointVec.clone()
      .addScaledVector(basis.up, 0.06 * basis.scale)
      .addScaledVector(basis.forward, -0.045 * basis.scale)
      .toArray();
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

function inferInitialModelYawDegrees() {
  if (MotionState.source_bones.length === 0 || Object.keys(MotionState.humanoid_mapping || {}).length === 0) {
    return 0;
  }
  const getSourceVector = (jointName) => {
    const sourceId = MotionState.humanoid_mapping[jointName];
    const sourceBone = MotionState.source_bones.find((bone) => bone.id === sourceId);
    return sourceBone?.position ? new THREE.Vector3().fromArray(sourceBone.position) : null;
  };
  const hips = getSourceVector("Hips");
  let up = getSourceVector("Head")?.sub(hips || new THREE.Vector3()) || null;
  if (!up || up.length() < 0.001) {
    up = getSourceVector("Chest")?.sub(hips || new THREE.Vector3()) || null;
  }
  if (!up || up.length() < 0.001) {
    up = new THREE.Vector3(0, 1, 0);
  }
  up.normalize();

  let toeForward = new THREE.Vector3();
  [["R_Foot", "R_Toe"], ["L_Foot", "L_Toe"]].forEach(([footName, toeName]) => {
    const foot = getSourceVector(footName);
    const toe = getSourceVector(toeName);
    if (!foot || !toe) {
      return;
    }
    const forward = projectOntoPlane(toe.sub(foot), up);
    if (forward.length() > 0.001) {
      toeForward.add(forward.normalize());
    }
  });
  if (toeForward.length() > 0.001) {
    toeForward.normalize();
    return yawToAlignForwardToMap(toeForward);
  }

  let right = new THREE.Vector3();
  [["R_Hand", "L_Hand"], ["R_Foot", "L_Foot"], ["R_UpperArm", "L_UpperArm"], ["R_UpperLeg", "L_UpperLeg"]]
    .forEach(([rightName, leftName]) => {
      const rightPoint = getSourceVector(rightName);
      const leftPoint = getSourceVector(leftName);
      if (!rightPoint || !leftPoint) {
        return;
      }
      const side = projectOntoPlane(rightPoint.sub(leftPoint), up);
      if (side.length() > 0.001) {
        right.add(side.normalize());
      }
    });
  if (right.length() < 0.001) {
    return 0;
  }
  right.normalize();
  const inferredForward = up.clone().cross(right);
  if (inferredForward.length() < 0.001) {
    return 0;
  }
  inferredForward.normalize();
  return yawToAlignForwardToMap(inferredForward);
}

function yawToAlignForwardToMap(forward) {
  const planar = projectOntoPlane(forward, new THREE.Vector3(0, 1, 0));
  if (planar.length() < 0.001) {
    return 0;
  }
  planar.normalize();
  return normalizeForwardYaw(-THREE.MathUtils.radToDeg(Math.atan2(planar.x, planar.z)));
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

function normalizeDirectionState(direction = {}) {
  const legacyFlip = Number(direction.forward_sign) === -1 ? 180 : 0;
  return {
    forward_sign: 1,
    yaw_degrees: normalizeForwardYaw((direction.yaw_degrees || 0) + legacyFlip),
    confirmed: Boolean(direction.confirmed),
  };
}

function getDirectionYawRadians() {
  return THREE.MathUtils.degToRad(normalizeForwardYaw(MotionState.direction?.yaw_degrees || 0));
}

function getModelFacingYawDegrees() {
  return normalizeForwardYaw(MotionState.direction?.yaw_degrees || 0);
}

function getModelFacingYawRadians() {
  return THREE.MathUtils.degToRad(getModelFacingYawDegrees());
}

function getModelAlignmentQuaternion() {
  if (MotionState.model.type !== "glb_reference" || MotionState.source_bones.length === 0) {
    return new THREE.Quaternion();
  }
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), getModelFacingYawRadians());
}

function applyImportedModelAlignment() {
  if (!Runtime.importedModelScene || MotionState.model.type !== "glb_reference" || MotionState.source_bones.length === 0) {
    return false;
  }
  Runtime.importedModelScene.rotation.y = getModelFacingYawRadians();
  Runtime.importedModelScene.updateMatrixWorld(true);
  return true;
}

function applyModelAlignmentToPosition(position) {
  const vector = new THREE.Vector3().fromArray(position || [0, 0, 0]);
  return vector.applyQuaternion(getModelAlignmentQuaternion()).toArray();
}

function getRigBasis() {
  const fallbackRight = new THREE.Vector3(1, 0, 0);
  const fallbackUp = new THREE.Vector3(0, 1, 0);
  const fallbackForward = new THREE.Vector3(0, 0, 1);
  if (MotionState.direction?.confirmed) {
    const height = getRigHeight();
    return {
      right: fallbackRight.clone(),
      up: fallbackUp.clone(),
      forward: fallbackForward.clone(),
      height,
      scale: Math.max(height / 1.82, 0.05),
    };
  }
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
  const rawRight = right.clone();
  forward = right.clone().cross(up);
  if (forward.length() < 0.001) {
    forward = fallbackForward.clone();
  }
  forward.normalize();
  right = rawRight;
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
  applyImportedModelAlignment();
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

function refreshAlignedSourceRestCache() {
  if (!Runtime.importedModelScene || Runtime.sourceBoneRestById.size === 0) {
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
  });
  Runtime.importedModelScene.updateMatrixWorld(true);
  Runtime.sourceBoneRestById.forEach((rest, id) => {
    const bone = Runtime.sourceBoneById.get(id);
    if (!bone) {
      return;
    }
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    bone.getWorldPosition(worldPosition);
    bone.getWorldQuaternion(worldQuaternion);
    bone.getWorldScale(worldScale);
    rest.alignedWorldPosition = worldPosition;
    rest.alignedWorldQuaternion = worldQuaternion;
    rest.alignedWorldScale = worldScale;
  });
  return true;
}

function getSourceRestWorldPosition(rest) {
  return (rest?.alignedWorldPosition || rest?.worldPosition || new THREE.Vector3()).clone();
}

function getSourceRestWorldQuaternion(rest) {
  return (rest?.alignedWorldQuaternion || rest?.worldQuaternion || new THREE.Quaternion()).clone();
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
    const restDir = getSourceRestWorldPosition(childRest).sub(getSourceRestWorldPosition(parentRest));
    const targetDir = new THREE.Vector3().fromArray(targetChild.position).sub(new THREE.Vector3().fromArray(targetParent.position));
    if (restDir.length() < 0.001 || targetDir.length() < 0.001) {
      return;
    }
    restDir.normalize();
    targetDir.normalize();
    const deltaQuaternion = new THREE.Quaternion().setFromUnitVectors(restDir, targetDir);
    const desiredWorldQuaternion = withExplicitJointRotation(parentName, deltaQuaternion.multiply(getSourceRestWorldQuaternion(parentRest)));
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
    setSourceBoneWorldQuaternion(bone, explicit.clone().multiply(getSourceRestWorldQuaternion(rest)).normalize());
  });
  Runtime.importedModelScene?.updateMatrixWorld(true);
  return true;
}

function syncSourceRigToMotionState() {
  if (MotionState.skeleton?.id === "Humanoid_v1" && MotionState.joints.length > 0 && shouldDriveSourceRigFromMotionState()) {
    return driveMappedSourceRigFromJoints(MotionState.joints);
  }
  return resetRuntimeSourceBonesToRest();
}

function shouldDriveSourceRigFromMotionState() {
  if (Object.keys(MotionState.joint_rotations || {}).length > 0 || MotionState.keyframes.length > 0) {
    return true;
  }
  const restByName = new Map((MotionState.skeleton?.rest_joints || []).map((joint) => [joint.name, joint.position]));
  return MotionState.joints.some((joint) => {
    const rest = restByName.get(joint.name);
    return rest && distance(joint.position, rest) > 0.0001;
  });
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

function rotateJointSubsetByQuaternion(pivotJointName, jointNames, quaternion, rotationJointName = pivotJointName) {
  const pivotJoint = getJoint(pivotJointName);
  if (!pivotJoint || !quaternion) {
    return false;
  }
  const normalized = quaternion.clone().normalize();
  if (rotationJointName && EXPLICIT_ROTATION_JOINTS.has(rotationJointName)) {
    accumulateJointRotation(rotationJointName, normalized);
  }
  const pivot = new THREE.Vector3().fromArray(pivotJoint.position);
  jointNames.forEach((name) => {
    const item = getJoint(name);
    if (!item || name === pivotJointName) {
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
    if (control.type === "cog") {
      movePelvisWithAnchoredFeet(delta);
    } else {
      translateSkeletonBy(delta);
    }
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
  if (control.type === "pelvis") {
    const previousPosition = previousControl?.position || getControlPositionForDef(getControlDef(control.id), joint);
    const delta = subtractVec(control.position, previousPosition);
    if (Math.hypot(...delta) > 0.0001) {
      movePelvisWithAnchoredFeet(delta);
    }
    const previousRotation = getControlRotationQuaternion(previousControl || { rotation: [0, 0, 0] });
    const nextRotation = getControlRotationQuaternion(control);
    const deltaRotation = nextRotation.clone().multiply(previousRotation.clone().invert()).normalize();
    if (!isIdentityQuaternion(deltaRotation)) {
      rotateJointSubsetByQuaternion("Hips", LOWER_BODY_CONTROL_JOINTS, deltaRotation, null);
    }
    driveMappedSourceRigFromJoints(MotionState.joints);
    return;
  }
  if (control.type === "chest") {
    const previousPosition = previousControl?.position || getControlPositionForDef(getControlDef(control.id), joint);
    const delta = subtractVec(control.position, previousPosition);
    if (Math.hypot(...delta) > 0.0001) {
      moveJointBranch("Chest", addVec(joint.position, delta));
    }
    const previousRotation = getControlRotationQuaternion(previousControl || { rotation: [0, 0, 0] });
    const nextRotation = getControlRotationQuaternion(control);
    const deltaRotation = nextRotation.clone().multiply(previousRotation.clone().invert()).normalize();
    if (!isIdentityQuaternion(deltaRotation)) {
      rotateJointSubsetByQuaternion("Spine", UPPER_BODY_CONTROL_JOINTS, deltaRotation, "Spine");
    }
    driveMappedSourceRigFromJoints(MotionState.joints);
    return;
  }
  if (control.type === "head") {
    const previousPosition = previousControl?.position || getControlPositionForDef(getControlDef(control.id), joint);
    const delta = subtractVec(control.position, previousPosition);
    if (Math.hypot(...delta) > 0.0001) {
      moveJointBranch("Head", addVec(joint.position, delta));
    }
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
    const positionChanged = hasControlPositionChanged(control, previousControl);
    if (positionChanged) {
      solveTwoBoneIk(control.side, `${control.side}_UpperArm`, `${control.side}_Forearm`, `${control.side}_Hand`, control.position, `${control.side}_Elbow_Pole`);
    }
    const previousRotation = getControlRotationQuaternion(previousControl || { rotation: [0, 0, 0] });
    const nextRotation = getControlRotationQuaternion(control);
    const deltaRotation = nextRotation.clone().multiply(previousRotation.clone().invert()).normalize();
    if (!isIdentityQuaternion(deltaRotation)) {
      accumulateJointRotation(control.target_joint, deltaRotation);
    }
  } else if (control.type === "foot") {
    const positionChanged = hasControlPositionChanged(control, previousControl);
    if (positionChanged) {
      clampFootControlToGround(control);
      solveTwoBoneIk(control.side, `${control.side}_UpperLeg`, `${control.side}_LowerLeg`, `${control.side}_Foot`, control.position, `${control.side}_Knee_Pole`);
      updateToeFromFoot(control.side);
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

function hasControlPositionChanged(control, previousControl = null) {
  if (!previousControl?.position) {
    return true;
  }
  return distance(control.position, previousControl.position) > 0.0001;
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
  const upperLength = Math.max(getRestVector(rootName).distanceTo(getRestVector(midName)), 0.001);
  const lowerLength = Math.max(getRestVector(midName).distanceTo(getRestVector(endName)), 0.001);
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
    updateToeFromFoot(side);
  }
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function syncEndEffectorControlToJoint(control) {
  const joint = getJoint(control?.target_joint);
  if (!control || !joint || !["hand", "foot"].includes(control.type)) {
    return;
  }
  control.position = [...joint.position];
}

function getControlIdsToPreserveAfterTransform(control, mode) {
  if (!control) {
    return [];
  }
  if (control.type === "pole") {
    return [control.id];
  }
  if (["hand", "foot"].includes(control.type) && ["translate", "rotate"].includes(mode)) {
    return [control.id];
  }
  return [];
}

function movePelvisWithAnchoredFeet(delta) {
  if (!shouldPinFeetForBodyMove()) {
    translateJointSubset(PELVIS_TRANSLATE_JOINTS, delta);
    driveMappedSourceRigFromJoints(MotionState.joints);
    return;
  }
  const footAnchors = captureFootIkAnchors();
  const constrainedDelta = constrainPelvisDeltaForAnchoredFeet(delta, footAnchors);
  if (Math.hypot(...constrainedDelta) < 0.00001) {
    restoreFootIkAnchors(footAnchors);
    driveMappedSourceRigFromJoints(MotionState.joints);
    return;
  }
  translateJointSubset(PELVIS_TRANSLATE_JOINTS, constrainedDelta);
  restoreFootIkAnchors(footAnchors);
  driveMappedSourceRigFromJoints(MotionState.joints);
}

function constrainPelvisDeltaForAnchoredFeet(delta, anchors) {
  const requested = new THREE.Vector3().fromArray(normalizeVec3(delta, [0, 0, 0]));
  if (requested.length() < 0.00001) {
    return requested.toArray();
  }
  const usableAnchors = anchors.filter((anchor) => {
    const root = getJoint(`${anchor.side}_UpperLeg`);
    return root && Array.isArray(anchor.position);
  });
  if (usableAnchors.length === 0 || pelvisDeltaKeepsFeetReachable(requested, usableAnchors)) {
    return requested.toArray();
  }
  let low = 0;
  let high = 1;
  for (let index = 0; index < 18; index += 1) {
    const mid = (low + high) * 0.5;
    const candidate = requested.clone().multiplyScalar(mid);
    if (pelvisDeltaKeepsFeetReachable(candidate, usableAnchors)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return requested.multiplyScalar(low).toArray();
}

function pelvisDeltaKeepsFeetReachable(delta, anchors) {
  return anchors.every((anchor) => {
    const root = getJoint(`${anchor.side}_UpperLeg`);
    if (!root || !Array.isArray(anchor.position)) {
      return true;
    }
    const rootAfter = new THREE.Vector3().fromArray(root.position).add(delta);
    const target = new THREE.Vector3().fromArray(anchor.position);
    const upperLength = Math.max(getRestVector(`${anchor.side}_UpperLeg`).distanceTo(getRestVector(`${anchor.side}_LowerLeg`)), 0.001);
    const lowerLength = Math.max(getRestVector(`${anchor.side}_LowerLeg`).distanceTo(getRestVector(`${anchor.side}_Foot`)), 0.001);
    const maxReach = upperLength + lowerLength - 0.0001;
    const minReach = Math.max(Math.abs(upperLength - lowerLength) + 0.0001, 0);
    const distanceToTarget = rootAfter.distanceTo(target);
    return distanceToTarget <= maxReach + 0.0001 && distanceToTarget >= minReach - 0.0001;
  });
}

function translateJointSubset(jointNames, delta) {
  const names = new Set(jointNames);
  MotionState.joints.forEach((joint) => {
    if (names.has(joint.name)) {
      joint.position = addVec(joint.position, delta);
    }
  });
}

function captureFootIkAnchors() {
  return ["R", "L"].map((side) => {
    const control = MotionState.ik_controls.find((item) => item.id === `${side}_Foot_IK`);
    const foot = getJoint(`${side}_Foot`);
    return {
      side,
      control_id: `${side}_Foot_IK`,
      position: control?.position || foot?.position || [0, getFootGroundClampY(side), 0],
      locked: Boolean(control?.locked),
    };
  });
}

function restoreFootIkAnchors(anchors) {
  anchors.forEach((anchor) => {
    const control = MotionState.ik_controls.find((item) => item.id === anchor.control_id);
    const target = clampFootPositionToGround(anchor.side, anchor.position);
    if (control) {
      control.position = target;
      control.locked = anchor.locked;
    }
    solveTwoBoneIk(anchor.side, `${anchor.side}_UpperLeg`, `${anchor.side}_LowerLeg`, `${anchor.side}_Foot`, target, `${anchor.side}_Knee_Pole`);
    updateToeFromFoot(anchor.side);
    if (control) {
      syncEndEffectorControlToJoint(control);
    }
  });
}

function updateToeFromFoot(side) {
  const toe = getJoint(`${side}_Toe`);
  const foot = getJoint(`${side}_Foot`);
  if (!toe || !foot) {
    return;
  }
  const restToe = getRestVector(`${side}_Toe`);
  const restFoot = getRestVector(`${side}_Foot`);
  toe.position = addVec(foot.position, restToe.sub(restFoot).toArray());
}

function translateSkeletonBy(delta) {
  MotionState.joints.forEach((joint) => {
    joint.position = addVec(joint.position, delta);
  });
}

function clampFootControlToGround(control) {
  if (!control || control.type !== "foot") {
    return;
  }
  control.position = clampFootPositionToGround(control.side, control.position);
}

function clampFootPositionToGround(side, position) {
  const next = normalizeVec3(position, [0, getFootGroundClampY(side), 0]);
  next[1] = Math.max(next[1], getFootGroundClampY(side));
  return next;
}

function getFootGroundClampY(side) {
  const candidates = [`${side}_Foot`, `${side}_Toe`]
    .map((name) => getRestPosition(name)?.[1])
    .map(Number)
    .filter((value) => Number.isFinite(value));
  if (candidates.length === 0) {
    return 0;
  }
  return Math.max(0, Math.min(...candidates));
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

function moveJointBranch(jointName, targetPosition, { preserveParentLength = true } = {}) {
  const joint = getJoint(jointName);
  if (!joint) {
    return false;
  }
  const constrained = preserveParentLength
    ? constrainJointTargetToParent(jointName, new THREE.Vector3().fromArray(targetPosition))
    : new THREE.Vector3().fromArray(targetPosition);
  const delta = constrained.sub(new THREE.Vector3().fromArray(joint.position)).toArray();
  getJointBranchNames(jointName).forEach((name) => {
    const item = getJoint(name);
    if (item) {
      item.position = addVec(item.position, delta);
    }
  });
  return true;
}

function persistEditableAssignmentRestJoints() {
  if (MotionState.skeleton?.editable_assignment_skeleton) {
    MotionState.skeleton.rest_joints = deepClone(MotionState.joints);
  }
}

function maybeAssignJointToNearestSourceBone(jointName) {
  if (!MotionState.skeleton?.editable_assignment_skeleton || MotionState.source_bones.length === 0) {
    return null;
  }
  const joint = getJoint(jointName);
  if (!joint) {
    return null;
  }
  const target = new THREE.Vector3().fromArray(joint.position);
  const threshold = Math.max(0.045, getRigHeight() * 0.035);
  let best = null;
  MotionState.source_bones.forEach((sourceBone) => {
    const position = getSourceBoneWorldPosition(sourceBone);
    if (!position) {
      return;
    }
    const distanceToJoint = target.distanceTo(new THREE.Vector3().fromArray(position));
    if (!best || distanceToJoint < best.distance) {
      best = { sourceBone, distance: distanceToJoint };
    }
  });
  if (!best || best.distance > threshold) {
    return null;
  }
  Object.entries(MotionState.humanoid_mapping).forEach(([mappedJoint, mappedSourceId]) => {
    if (mappedJoint !== jointName && mappedSourceId === best.sourceBone.id) {
      delete MotionState.humanoid_mapping[mappedJoint];
    }
  });
  MotionState.humanoid_mapping[jointName] = best.sourceBone.id;
  joint.source_bone_id = best.sourceBone.id;
  joint.source_bone_name = best.sourceBone.name;
  joint.rest_pose = MotionState.rest_pose;
  joint.is_estimated_from_mesh = false;
  joint.is_optional_fallback = false;
  MotionState.skeleton.mapped_joints = getMappingCount();
  MotionState.skeleton.missing_required_joints = getMissingHumanoidMappings({ includeOptional: false });
  MotionState.skeleton.optional_fallback_joints = getOptionalFallbackHumanoidMappings();
  return {
    id: best.sourceBone.id,
    name: best.sourceBone.name,
    distance: best.distance,
  };
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

function syncIkControlsToJoints(controls, options = {}) {
  if (!controls.length) {
    return controls;
  }
  const preserveControlIds = new Set([
    options.preserveControlId || null,
    ...(Array.isArray(options.preserveControlIds) ? options.preserveControlIds : []),
  ].filter(Boolean));
  const basis = getRigBasis();
  return controls.map((control) => {
    const def = getControlDef(control.id);
    const joint = def ? getJoint(def.joint) : null;
    if (!def || !joint) {
      return control;
    }
    if (preserveControlIds.has(control.id)) {
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
  normalizeControlSelectionState();
  renderSceneObjects();
  renderUi();
  requestViewportRender();
}

function requestViewportRender() {
  Runtime.needsRender = true;
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

  applyViewportAlignmentPreview();
  grid.visible = MotionState.show.ground_plane;
  groundPlane.visible = MotionState.show.ground_plane;

  renderModel();
  renderSourceSkeletonOverlay();
  renderSkeleton();
  renderDirectionHint();
  renderWorldAxes();
  renderIkControls();
  renderZBrushTransformGizmo();
  renderMotionPaths();
  renderValidationIssues();
}

function applyViewportAlignmentPreview() {
  applyImportedModelAlignment();
  modelGroup.rotation.set(0, 0, 0);
  sourceSkeletonGroup.rotation.set(0, 0, 0);
}

function renderModel() {
  if (!MotionState.show.model || !MotionState.model.loaded) {
    return;
  }
  if (MotionState.model.type === "glb_reference" && Runtime.importedModelScene) {
    applyModelOpacityToScene(Runtime.importedModelScene, MotionState.model.opacity);
    modelGroup.add(Runtime.importedModelScene);
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

function applyModelOpacityToScene(sceneRoot, opacity) {
  sceneRoot.traverse((child) => {
    if (!child.material) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.transparent = opacity < 0.999;
      material.opacity = opacity;
      material.needsUpdate = true;
    });
  });
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
    || MotionState.ik_controls.some((control) => isControlSelected(control.id) && control.target_joint === jointName);
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
  return MotionState.show.joint_debug_controls || isControlSelected(control.id);
}

function shouldPickIkControl(control) {
  if (!canPickControlInViewport()) {
    return false;
  }
  if (control?.is_joint_control && !canPickJointControlInViewport()) {
    return false;
  }
  return shouldRenderIkControl(control);
}

function shouldRenderIkControlLabel(control) {
  return MotionState.show.labels && (
    isControlSelected(control.id)
    || Runtime.hoveredControlId === control.id
  );
}

function getIkControlLabel(control) {
  if (control.id === "Global_CTRL") return "全局";
  if (control.id === "Root_CTRL") return "Root";
  if (control.id === "COG_CTRL") return "重心";
  if (control.id === "Pelvis_CTRL") return "胯部";
  if (control.id === "Chest_CTRL") return "胸腰";
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
  const selected = isControlSelected(control.id);
  const primarySelected = MotionState.selected_control === control.id;
  const hovered = Runtime.hoveredControlId === control.id;
  const visualPreset = getControlVisualPreset(control);
  const visualBoost = selected ? 0.28 : hovered ? 0.18 : 0;
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(primarySelected ? "#ffffff" : selected ? "#ffd166" : color),
    transparent: true,
    opacity: Math.min(0.98, controlOpacity + 0.34 + visualBoost),
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const panelMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: Math.min(0.13, controlOpacity * 0.18 + (selected || hovered ? 0.035 : 0)),
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const tube = getControlLineRadius(selected, hovered);
  if (control.type === "joint") {
    addJointControlShape(group, control, visualPreset, selected, hovered, tube, lineMaterial);
    return group;
  }
  alignGroupToRigBasis(group);
  const controlScale = normalizeVec3(control.scale || [1, 1, 1], [1, 1, 1], 0.05, 20);
  const visualSize = getControlVisualSize();
  group.scale.set(controlScale[0] * visualSize, controlScale[1] * visualSize, controlScale[2] * visualSize);
  if (visualPreset === "rigify") {
    addRigifyControlShape(group, control, tube, lineMaterial, panelMaterial);
    return group;
  }
  if (visualPreset === "motionbuilder") {
    addMotionBuilderControlShape(group, control, tube, lineMaterial, panelMaterial);
    return group;
  }
  if (control.type === "global") {
    addControlPolygonPanel(group, 0.21, 8, "xz", panelMaterial, Math.PI / 8);
    addControlPolygon(group, 0.21, 8, "xz", tube, lineMaterial, Math.PI / 8);
    addControlSegment(group, new THREE.Vector3(-0.14, 0, 0), new THREE.Vector3(0.14, 0, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, 0, -0.14), new THREE.Vector3(0, 0, 0.14), tube, lineMaterial);
    addControlHitArea(group, 0.23);
    return group;
  }
  if (control.type === "root") {
    addControlPolygonPanel(group, 0.13, 4, "xz", panelMaterial, Math.PI / 4);
    addControlPolygon(group, 0.13, 4, "xz", tube, lineMaterial, Math.PI / 4);
    addControlRect(group, 0.13, 0.08, "xz", tube, lineMaterial);
    addControlHitArea(group, 0.16);
    return group;
  }
  if (control.type === "cog") {
    addControlPolygonPanel(group, 0.105, 6, "xy", panelMaterial, Math.PI / 6);
    addControlPolygon(group, 0.105, 6, "xy", tube, lineMaterial, Math.PI / 6);
    addControlSegment(group, new THREE.Vector3(-0.075, 0, 0), new THREE.Vector3(0.075, 0, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, -0.07, 0), new THREE.Vector3(0, 0.07, 0), tube, lineMaterial);
    addControlHitArea(group, 0.14);
    return group;
  }
  if (control.type === "pelvis") {
    addControlPolygonPanel(group, 0.095, 6, "xy", panelMaterial, 0);
    addControlPolygon(group, 0.095, 6, "xy", tube, lineMaterial, 0);
    addControlSegment(group, new THREE.Vector3(-0.075, 0, 0), new THREE.Vector3(0.075, 0, 0), tube, lineMaterial);
    addControlHitArea(group, 0.13);
    return group;
  }
  if (control.type === "chest") {
    addControlPolygonPanel(group, 0.1, 5, "xy", panelMaterial, Math.PI / 2);
    addControlPolygon(group, 0.1, 5, "xy", tube, lineMaterial, Math.PI / 2);
    addControlSegment(group, new THREE.Vector3(-0.075, -0.026, 0), new THREE.Vector3(0.075, -0.026, 0), tube, lineMaterial);
    addControlHitArea(group, 0.135);
    return group;
  }
  if (control.type === "head") {
    addControlPolygonPanel(group, 0.075, 4, "xy", panelMaterial, Math.PI / 4);
    addControlPolygon(group, 0.075, 4, "xy", tube, lineMaterial, Math.PI / 4);
    addControlSegment(group, new THREE.Vector3(0, -0.052, 0), new THREE.Vector3(0, 0.052, 0), tube, lineMaterial);
    addControlHitArea(group, 0.11);
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

function addJointControlShape(group, _control, visualPreset, selected, hovered, tube, lineMaterial) {
  const size = selected || hovered ? 0.045 : 0.026;
  if (visualPreset === "rigify") {
    addControlPolygon(group, size * 1.15, 4, "xy", tube, lineMaterial, Math.PI / 4);
    addControlSegment(group, new THREE.Vector3(-size * 0.72, 0, 0), new THREE.Vector3(size * 0.72, 0, 0), tube, lineMaterial);
    addControlHitArea(group, selected || hovered ? 0.078 : 0.054);
    return;
  }
  if (visualPreset === "motionbuilder") {
    addControlBox(group, size * 1.35, size * 1.35, size * 1.35, tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0), tube, lineMaterial);
    addControlHitArea(group, selected || hovered ? 0.08 : 0.055);
    return;
  }
  addControlSegment(group, new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0), tube, lineMaterial);
  addControlSegment(group, new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0), tube, lineMaterial);
  addControlSegment(group, new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size), tube, lineMaterial);
  addControlHitArea(group, selected || hovered ? 0.075 : 0.052);
}

function addRigifyControlShape(group, control, tube, lineMaterial, panelMaterial) {
  if (control.type === "global") {
    addControlPolygonPanel(group, 0.23, 12, "xz", panelMaterial, Math.PI / 12);
    addControlPolygon(group, 0.23, 12, "xz", tube, lineMaterial, Math.PI / 12);
    addControlPolygon(group, 0.16, 4, "xz", tube, lineMaterial, Math.PI / 4);
    addControlHitArea(group, 0.26);
    return;
  }
  if (control.type === "root") {
    addControlPolygonPanel(group, 0.16, 8, "xz", panelMaterial, Math.PI / 8);
    addControlPolygon(group, 0.16, 8, "xz", tube, lineMaterial, Math.PI / 8);
    addControlSegment(group, new THREE.Vector3(-0.12, 0, 0), new THREE.Vector3(0.12, 0, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, 0, -0.12), new THREE.Vector3(0, 0, 0.12), tube, lineMaterial);
    addControlHitArea(group, 0.19);
    return;
  }
  if (control.type === "cog") {
    addControlBox(group, 0.18, 0.14, 0.06, tube, lineMaterial);
    addControlPolygonPanel(group, 0.12, 6, "xy", panelMaterial, Math.PI / 6);
    addControlHitArea(group, 0.17);
    return;
  }
  if (control.type === "pelvis") {
    addControlPolygonPanel(group, 0.125, 6, "xy", panelMaterial, 0);
    addControlPolygon(group, 0.125, 6, "xy", tube, lineMaterial, 0);
    addControlRect(group, 0.16, 0.07, "xy", tube, lineMaterial);
    addControlHitArea(group, 0.16);
    return;
  }
  if (control.type === "chest") {
    addControlPolygonPanel(group, 0.12, 5, "xy", panelMaterial, Math.PI / 2);
    addControlPolygon(group, 0.12, 5, "xy", tube, lineMaterial, Math.PI / 2);
    addControlSegment(group, new THREE.Vector3(-0.09, -0.032, 0), new THREE.Vector3(0.09, -0.032, 0), tube, lineMaterial);
    addControlHitArea(group, 0.16);
    return;
  }
  if (control.type === "head") {
    addControlPolygonPanel(group, 0.085, 8, "xy", panelMaterial, Math.PI / 8);
    addControlPolygon(group, 0.085, 8, "xy", tube, lineMaterial, Math.PI / 8);
    addControlRect(group, 0.08, 0.05, "xy", tube, lineMaterial);
    addControlHitArea(group, 0.13);
    return;
  }
  if (control.type === "foot") {
    addControlPanel(group, 0.23, 0.12, "xz", panelMaterial);
    addControlRect(group, 0.24, 0.13, "xz", tube, lineMaterial);
    addControlRect(group, 0.08, 0.04, "xz", tube, lineMaterial, new THREE.Vector3(0, 0, -0.09));
    addControlTriangle(group, 0.07, "xz", tube, lineMaterial, new THREE.Vector3(0, 0, 0.12));
    addControlHitArea(group, 0.18);
    return;
  }
  if (control.type === "hand") {
    const wristSign = control.side === "R" ? -1 : 1;
    addControlPanel(group, 0.11, 0.08, "xy", panelMaterial);
    addControlRect(group, 0.12, 0.085, "xy", tube, lineMaterial);
    addControlPolygon(group, 0.042, 8, "xy", tube, lineMaterial, 0, new THREE.Vector3(wristSign * 0.085, 0, 0));
    addControlHitArea(group, 0.15);
    return;
  }
  addControlTriangle(group, 0.13, "xy", tube, lineMaterial);
  addControlSegment(group, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.12), tube, lineMaterial);
  addControlHitArea(group, 0.17);
}

function addMotionBuilderControlShape(group, control, tube, lineMaterial, panelMaterial) {
  if (control.type === "global") {
    addControlCircle(group, 0.25, "xz", tube, lineMaterial, 72);
    addControlCircle(group, 0.18, "xz", tube, lineMaterial, 72);
    addControlSegment(group, new THREE.Vector3(-0.18, 0, 0), new THREE.Vector3(0.18, 0, 0), tube, lineMaterial);
    addControlSegment(group, new THREE.Vector3(0, 0, -0.18), new THREE.Vector3(0, 0, 0.18), tube, lineMaterial);
    addControlHitArea(group, 0.28);
    return;
  }
  if (control.type === "root") {
    addControlCircle(group, 0.16, "xz", tube, lineMaterial, 56);
    addControlPolygonPanel(group, 0.11, 4, "xz", panelMaterial, Math.PI / 4);
    addControlPolygon(group, 0.11, 4, "xz", tube, lineMaterial, Math.PI / 4);
    addControlHitArea(group, 0.2);
    return;
  }
  if (["cog", "pelvis", "chest", "head"].includes(control.type)) {
    const height = control.type === "head" ? 0.09 : control.type === "chest" ? 0.15 : 0.12;
    const width = control.type === "head" ? 0.11 : 0.18;
    addControlBox(group, width, height, 0.06, tube, lineMaterial);
    addControlCircle(group, Math.max(width, height) * 0.55, "xy", tube * 0.75, lineMaterial, 40);
    addControlHitArea(group, Math.max(width, height) * 0.82);
    return;
  }
  if (control.type === "foot") {
    addControlPanel(group, 0.22, 0.14, "xz", panelMaterial);
    addControlBox(group, 0.22, 0.035, 0.14, tube, lineMaterial);
    addControlCircle(group, 0.11, "xz", tube, lineMaterial, 48);
    addControlHitArea(group, 0.18);
    return;
  }
  if (control.type === "hand") {
    addControlBox(group, 0.12, 0.09, 0.045, tube, lineMaterial);
    addControlCircle(group, 0.075, "xy", tube * 0.78, lineMaterial, 40);
    addControlHitArea(group, 0.15);
    return;
  }
  addControlTriangle(group, 0.14, "xy", tube, lineMaterial);
  addControlPolygonPanel(group, 0.07, 3, "xy", panelMaterial, Math.PI / 2);
  addControlSegment(group, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.12), tube, lineMaterial);
  addControlHitArea(group, 0.18);
}

function getControlVisualSize() {
  return clampNumber(MotionState.visual_opacity.control_size, 0.35, 1.6, 0.68);
}

function getControlLineRadius(selected = false, hovered = false) {
  const thickness = clampNumber(MotionState.visual_opacity.control_thickness, 0.05, 1.2, 0.2);
  return (selected ? 0.0028 : hovered ? 0.0022 : 0.00145) * thickness;
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

function addControlRect(group, width, height, plane, tube, material, offset = new THREE.Vector3()) {
  const points = getPlaneRectPoints(width, height, plane).map((point) => point.add(offset));
  for (let index = 0; index < points.length; index += 1) {
    addControlSegment(group, points[index], points[(index + 1) % points.length], tube, material);
  }
}

function addControlBox(group, width, height, depth, tube, material) {
  const x = width * 0.5;
  const y = height * 0.5;
  const z = depth * 0.5;
  const points = [
    new THREE.Vector3(-x, -y, -z),
    new THREE.Vector3(x, -y, -z),
    new THREE.Vector3(x, y, -z),
    new THREE.Vector3(-x, y, -z),
    new THREE.Vector3(-x, -y, z),
    new THREE.Vector3(x, -y, z),
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(-x, y, z),
  ];
  [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ].forEach(([start, end]) => {
    addControlSegment(group, points[start], points[end], tube, material);
  });
}

function addControlPolygon(group, radius, sides, plane, tube, material, rotation = 0, offset = new THREE.Vector3()) {
  const points = getPlanePolygonPoints(radius, sides, plane, rotation)
    .map((point) => point.add(offset));
  for (let index = 0; index < points.length; index += 1) {
    addControlSegment(group, points[index], points[(index + 1) % points.length], tube, material);
  }
}

function addControlPolygonPanel(group, radius, sides, plane, material, rotation = 0, offset = new THREE.Vector3()) {
  const geometry = new THREE.CircleGeometry(radius, sides);
  const panel = tagControlObject(group, new THREE.Mesh(geometry, material.clone()));
  panel.rotation.z = rotation;
  if (plane === "xz") {
    panel.rotation.x = -Math.PI / 2;
  } else if (plane === "yz") {
    panel.rotation.y = Math.PI / 2;
  }
  panel.position.copy(offset);
  group.add(panel);
  return panel;
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

function getPlanePolygonPoints(radius, sides, plane, rotation = 0) {
  return Array.from({ length: Math.max(3, sides) }, (_, index) => {
    const angle = rotation + (index / Math.max(3, sides)) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (plane === "xz") {
      return new THREE.Vector3(x, 0, y);
    }
    if (plane === "yz") {
      return new THREE.Vector3(0, x, y);
    }
    return new THREE.Vector3(x, y, 0);
  });
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

function renderZBrushTransformGizmo() {
  if (!MotionState.show.transform_gizmo || !MotionState.selected_control || !MotionState.show.control_rig || !canPickControlInViewport()) {
    return;
  }
  const controls = getSelectedTransformControls("translate");
  const primary = MotionState.ik_controls.find((item) => item.id === MotionState.selected_control) || controls[0];
  if (!primary || controls.length === 0) {
    return;
  }
  const basis = getRigBasis();
  const position = controls.reduce((sum, control) => sum.add(new THREE.Vector3().fromArray(control.position)), new THREE.Vector3())
    .multiplyScalar(1 / controls.length);
  const size = getTransformGizmoSize(basis);
  const axes = [
    { key: "x", color: 0xff4242, vector: MotionState.transform.space === "local" ? basis.right : new THREE.Vector3(1, 0, 0), label: "X" },
    { key: "y", color: 0x49e85f, vector: MotionState.transform.space === "local" ? basis.up : new THREE.Vector3(0, 1, 0), label: "Y" },
    { key: "z", color: 0x3d6dff, vector: MotionState.transform.space === "local" ? basis.forward : new THREE.Vector3(0, 0, 1), label: "Z" },
  ];
  gizmoGroup.add(createGizmoCenter(position, size * 0.18, 0xffc93a, { mode: "translate", axis_key: null, control_id: primary.id }));
  axes.forEach((axis) => {
    gizmoGroup.add(createGizmoTranslateAxis(position, axis.vector, size * 0.92, axis.color, { mode: "translate", axis_key: axis.key, control_id: primary.id }));
    gizmoGroup.add(createGizmoScaleCube(position, axis.vector, size * 0.58, axis.color, { mode: "scale", axis_key: axis.key, control_id: primary.id }));
    gizmoGroup.add(makeLabel(axis.label, position.clone().addScaledVector(axis.vector.clone().normalize(), size * 1.04).toArray(), `#${axis.color.toString(16).padStart(6, "0")}`, 0.024, 0.74));
  });
  const viewAxis = getCameraViewAxis();
  const viewActive = Runtime.transformMode === "rotate" && (!MotionState.transform.axis || MotionState.transform.axis === "view");
  const viewHovered = Runtime.hoveredTransformAxis === "view";
  gizmoGroup.add(createGizmoRing(position, viewAxis, size * 0.82, 0xffffff, viewActive ? 0.88 : viewHovered ? 0.74 : 0.5, viewActive || viewHovered ? 0.0017 : 0.001, {
    mode: "rotate",
    axis_key: "view",
    control_id: primary.id,
  }));
  gizmoGroup.add(createGizmoRotateHandle(position, viewAxis, size * 0.82, 0xffffff, { mode: "rotate", axis_key: "view", control_id: primary.id }));
  if (Runtime.transformMode === "rotate") {
    renderRotationDragGuide(position, viewAxis);
  }
}

function renderTransformGizmo() {
  if (!MotionState.show.transform_gizmo || !MotionState.selected_control || !MotionState.show.control_rig || !canPickControlInViewport()) {
    return;
  }
  const control = MotionState.ik_controls.find((item) => item.id === MotionState.selected_control && !item.is_joint_control);
  if (!control) {
    return;
  }
  const basis = getRigBasis();
  const position = new THREE.Vector3().fromArray(control.position);
  const size = getTransformGizmoSize(basis);
  const mode = Runtime.transformMode || MotionState.transform.tool || "translate";
  if (mode === "select") {
    return;
  }
  const axes = [
    { key: "x", color: 0xff4242, vector: MotionState.transform.space === "local" ? basis.right : new THREE.Vector3(1, 0, 0), label: "X" },
    { key: "y", color: 0x49e85f, vector: MotionState.transform.space === "local" ? basis.up : new THREE.Vector3(0, 1, 0), label: "Y" },
    { key: "z", color: 0x3d6dff, vector: MotionState.transform.space === "local" ? basis.forward : new THREE.Vector3(0, 0, 1), label: "Z" },
  ];
  axes.forEach((axis) => {
    if (mode === "rotate") {
      const activeAxis = MotionState.transform.axis === axis.key;
      const hoveredAxis = Runtime.hoveredTransformAxis === axis.key;
      gizmoGroup.add(createGizmoRing(position, axis.vector, size * 0.88, axis.color, activeAxis ? 0.96 : hoveredAxis ? 0.88 : 0.72, activeAxis || hoveredAxis ? 0.0016 : 0.0009, {
        mode: "rotate",
        axis_key: axis.key,
        control_id: control.id,
      }));
      gizmoGroup.add(makeLabel(axis.label, position.clone().addScaledVector(axis.vector.clone().normalize(), size * 0.98).toArray(), `#${axis.color.toString(16).padStart(6, "0")}`, 0.024, 0.74));
    } else if (mode === "scale") {
      gizmoGroup.add(createGizmoScaleAxis(position, axis.vector, size * 0.82, axis.color, {
        mode: "scale",
        axis_key: axis.key,
        control_id: control.id,
      }));
      gizmoGroup.add(makeLabel(axis.label, position.clone().addScaledVector(axis.vector.clone().normalize(), size * 0.92).toArray(), `#${axis.color.toString(16).padStart(6, "0")}`, 0.024, 0.74));
    } else {
      gizmoGroup.add(createGizmoTranslateAxis(position, axis.vector, size * 0.86, axis.color, {
        mode: "translate",
        axis_key: axis.key,
        control_id: control.id,
      }));
      gizmoGroup.add(makeLabel(axis.label, position.clone().addScaledVector(axis.vector.clone().normalize(), size * 0.96).toArray(), `#${axis.color.toString(16).padStart(6, "0")}`, 0.024, 0.74));
    }
  });
  if (mode === "rotate") {
    const viewAxis = getCameraViewAxis();
    const viewActive = !MotionState.transform.axis || MotionState.transform.axis === "view";
    const viewHovered = Runtime.hoveredTransformAxis === "view";
    gizmoGroup.add(createGizmoRing(position, viewAxis, size * 1.12, 0xffffff, viewActive ? 0.88 : viewHovered ? 0.8 : 0.58, viewActive || viewHovered ? 0.0017 : 0.001, {
      mode: "rotate",
      axis_key: "view",
      control_id: control.id,
    }));
    gizmoGroup.add(makeLabel("当前", position.clone().addScaledVector(basis.up.clone().normalize(), size * 1.15).toArray(), "#ffffff", 0.024, 0.68));
    gizmoGroup.add(createGizmoRing(position, viewAxis, size * 0.48, 0xffffff, viewActive ? 0.58 : viewHovered ? 0.52 : 0.42, 0.0007, {
      mode: "rotate",
      axis_key: "view",
      control_id: control.id,
    }));
    renderRotationDragGuide(position, viewAxis);
  }
}

function getTransformGizmoSize(basis) {
  const rigScale = Math.max(Number(basis?.scale) || 1, 0.001);
  return clampNumber(cameraDistance * 0.042, 0.01 * rigScale, 0.16 * rigScale, 0.12 * rigScale);
}

function createGizmoTranslateAxis(origin, axis, length, color, pickData = {}) {
  const group = new THREE.Group();
  const pickable = Boolean(pickData.mode && pickData.control_id);
  if (pickable) {
    group.userData = { type: "transform_gizmo", ...pickData };
  }
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.74, depthTest: false });
  const direction = axis.clone().normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const shaft = pickable
    ? tagTransformGizmoObject(group, new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, length, 6), material))
    : new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, length, 6), material);
  shaft.quaternion.copy(rotation);
  shaft.position.copy(origin).addScaledVector(direction, length * 0.5);
  const head = pickable
    ? tagTransformGizmoObject(group, new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.032, 10), material.clone()))
    : new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.032, 10), material.clone());
  head.quaternion.copy(rotation);
  head.position.copy(origin).addScaledVector(direction, length);
  group.add(shaft, head);
  if (pickable) {
    const hitMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const shaftHit = tagTransformGizmoObject(group, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, length, 8), hitMaterial));
    shaftHit.quaternion.copy(rotation);
    shaftHit.position.copy(origin).addScaledVector(direction, length * 0.5);
    const headHit = tagTransformGizmoObject(group, new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 6), hitMaterial.clone()));
    headHit.position.copy(origin).addScaledVector(direction, length);
    group.add(shaftHit, headHit);
  }
  return group;
}

function createGizmoScaleAxis(origin, axis, length, color, pickData = {}) {
  const group = createGizmoTranslateAxis(origin, axis, length * 0.82, color, pickData);
  const pickable = Boolean(pickData.mode && pickData.control_id);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.74, depthTest: false });
  const box = pickable
    ? tagTransformGizmoObject(group, new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.026), material))
    : new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.026), material);
  box.position.copy(origin).addScaledVector(axis.clone().normalize(), length * 0.92);
  group.add(box);
  return group;
}

function createGizmoCenter(origin, radius, color, pickData = {}) {
  const group = new THREE.Group();
  group.userData = { type: "transform_gizmo", ...pickData };
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, depthTest: false });
  const core = tagTransformGizmoObject(group, new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), material));
  core.position.copy(origin);
  const hit = tagTransformGizmoObject(group, new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.9, 12, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  ));
  hit.position.copy(origin);
  group.add(core, hit);
  return group;
}

function createGizmoScaleCube(origin, axis, length, color, pickData = {}) {
  const group = new THREE.Group();
  group.userData = { type: "transform_gizmo", ...pickData };
  const direction = axis.clone().normalize();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.76, depthTest: false });
  const cube = tagTransformGizmoObject(group, new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.028), material));
  cube.position.copy(origin).addScaledVector(direction, length);
  const hit = tagTransformGizmoObject(group, new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 10, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  ));
  hit.position.copy(cube.position);
  group.add(cube, hit);
  return group;
}

function createGizmoRotateHandle(origin, axis, radius, color, pickData = {}) {
  const group = new THREE.Group();
  group.userData = { type: "transform_gizmo", ...pickData };
  const viewRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  const handlePosition = origin.clone().addScaledVector(viewRight, radius);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, depthTest: false });
  const dot = tagTransformGizmoObject(group, new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), material));
  dot.position.copy(handlePosition);
  const hit = tagTransformGizmoObject(group, new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 10, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  ));
  hit.position.copy(handlePosition);
  group.add(dot, hit);
  return group;
}

function createGizmoRing(origin, axis, radius, color, opacity = 0.82, tube = 0.0016, pickData = {}) {
  const group = new THREE.Group();
  group.userData = { type: "transform_gizmo", ...pickData };
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, side: THREE.DoubleSide });
  const ring = tagTransformGizmoObject(group, new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 72), material));
  const hit = tagTransformGizmoObject(group, new THREE.Mesh(
    new THREE.TorusGeometry(radius, Math.max(tube * 6, 0.0075), 8, 72),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  ));
  group.position.copy(origin);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  group.add(ring, hit);
  return group;
}

function tagTransformGizmoObject(group, object) {
  object.userData = group.userData;
  object.renderOrder = 35;
  return object;
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
  const line = createWorldSegment(origin, pointerPoint, 0.0018, material);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 6), material.clone());
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
  const directionStages = new Set(["model", "skeleton", "mapping", "control_rig", "ik", "motion"]);
  if (!directionStages.has(Runtime.stage) || !MotionState.model.loaded) {
    return;
  }
  const anchor = getDirectionHintAnchor();
  const scale = getDirectionHintScale();
  const worldForward = new THREE.Vector3(0, 0, 1);
  const worldUp = new THREE.Vector3(0, 1, 0);
  const start = anchor.clone();
  start.y = Math.max(0.032, start.y - 0.52 * scale);
  start.addScaledVector(worldForward, -0.48 * scale);
  const length = Math.max(0.72 * scale, 0.28);
  const end = start.clone().addScaledVector(worldForward, length);
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
  const label = MotionState.direction?.confirmed ? "地图前方" : "地图前方 - 先对齐模型";
  labelGroup.add(makeLabel(label, end.clone().addScaledVector(worldUp, 0.11 * scale).toArray(), COLORS.warn, 0.04, 0.68));
}

function getDirectionHintAnchor() {
  const hips = getJoint("Hips");
  if (hips) {
    return new THREE.Vector3().fromArray(hips.position);
  }
  const points = MotionState.source_bones
    .map((bone) => getSourceBoneWorldPosition(bone) || bone.position)
    .filter((position) => Array.isArray(position) && position.length === 3)
    .map((position) => new THREE.Vector3().fromArray(position));
  if (points.length > 0) {
    const box = new THREE.Box3().setFromPoints(points);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }
  return new THREE.Vector3(0, 1, 0);
}

function getDirectionHintScale() {
  if (MotionState.joints.length > 0) {
    return getRigBasis().scale;
  }
  const points = MotionState.source_bones
    .map((bone) => getSourceBoneWorldPosition(bone) || bone.position)
    .filter((position) => Array.isArray(position) && position.length === 3)
    .map((position) => new THREE.Vector3().fromArray(position));
  if (points.length > 1) {
    const box = new THREE.Box3().setFromPoints(points);
    const size = new THREE.Vector3();
    box.getSize(size);
    return Math.max(size.y / 1.82, 0.05);
  }
  return getRigBasis().scale;
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
  el.sceneItems.forEach((button) => button.classList.toggle("is-active", button.dataset.stage === Runtime.stage));
  el.toolButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tool === MotionState.transform.tool));
  el.axisButtons.forEach((button) => {
    const buttonAxis = button.dataset.axis || "";
    const activeAxis = MotionState.transform.axis || "";
    button.classList.toggle("is-active", buttonAxis === activeAxis);
  });
  if (el.spaceToggleButton) {
    el.spaceToggleButton.textContent = MotionState.transform.space === "local" ? "局部" : "全局";
    el.spaceToggleButton.classList.toggle("is-active", MotionState.transform.space === "local");
  }
  el.snapToggleButton?.classList.toggle("is-active", MotionState.transform.snap);
  el.mirrorToggleButton?.classList.toggle("is-active", MotionState.transform.mirror);
  el.panels.forEach((panel) => {
    const activePanel = Runtime.stage === "mapping"
      ? "skeleton"
      : Runtime.stage === "control_rig"
        ? "ik"
        : Runtime.stage === "validate"
          ? "motion"
          : Runtime.stage;
    panel.classList.toggle("is-active", panel.dataset.panel === activePanel);
  });

  el.statusModel.textContent = MotionState.model.loaded ? "已加载" : "无";
  if (el.statusDirection) {
    el.statusDirection.textContent = MotionState.direction?.confirmed ? "已确认" : "未确认";
    el.statusDirection.className = MotionState.direction?.confirmed ? "ok" : "warn";
  }
  el.statusSkeleton.textContent = MotionState.skeleton?.id ? translateSkeletonId(MotionState.skeleton.id) : "未识别";
  el.statusIk.textContent = `${getCoreIkControls().length} 主控 + ${getJointControls().length} 调试`;
  el.statusKeyframes.textContent = `${MotionState.keyframes.length} / ${MotionState.total_frames}`;
  el.statusFrame.textContent = `${MotionState.current_frame} / ${MotionState.total_frames}`;
  el.statusDirty.textContent = MotionState.dirty_state ? "是" : "否";
  el.statusSkeleton.textContent = formatSkeletonStatusLabel();
  el.statusValidation.textContent = translateStatus(MotionState.validation_report.status);
  el.statusValidation.className = MotionState.validation_report.status === "Passed" ? "ok" : "warn";
  if (el.sceneModelState) {
    el.sceneModelState.textContent = MotionState.model.loaded ? MotionState.model.source : "未导入";
  }
  if (el.sceneSkeletonState) {
    el.sceneSkeletonState.textContent = MotionState.skeleton?.id
      ? `${translateSkeletonId(MotionState.skeleton.id)} · ${getMappingCount()} / ${HUMANOID_JOINT_NAMES.length}`
      : "未识别";
  }
  if (el.sceneRigState) {
    el.sceneRigState.textContent = MotionState.ik_controls.length > 0
      ? `${getCoreIkControls().length} 主控 / ${translateControlSolveMode(getActiveControlSolveMode())}`
      : "未生成";
  }
  if (el.sceneMotionState) {
    el.sceneMotionState.textContent = MotionState.keyframes.length > 0
      ? `${MotionState.keyframes.length} 个关键帧`
      : "无关键帧";
  }
  if (el.modelPanelStatus) {
    el.modelPanelStatus.textContent = MotionState.model.loaded ? MotionState.model.source : "未导入";
  }
  if (el.modelPanelBoneCount) {
    el.modelPanelBoneCount.textContent = String(MotionState.source_bones.length);
  }
  if (el.modelPanelType) {
    el.modelPanelType.textContent = MotionState.model.loaded ? MotionState.model.type : "无";
  }

  el.timelineKeyPoseCount.textContent = `${MotionState.keyframes.length} / ${MotionState.total_frames}`;
  el.timelineLoopState.textContent = Runtime.loop ? "开" : "关";
  el.loopToggle.checked = Runtime.loop;
  if (el.timelineFpsInput && document.activeElement !== el.timelineFpsInput) {
    el.timelineFpsInput.value = String(MotionState.playback_fps);
  }
  const hasKeyframes = MotionState.keyframes.length > 0;
  const hasCurrentKeyframe = MotionState.keyframes.some((keyframe) => keyframe.timeline_frame === MotionState.current_frame);
  if (el.timelinePrevKeyButton) {
    el.timelinePrevKeyButton.disabled = !hasKeyframes;
  }
  if (el.timelineNextKeyButton) {
    el.timelineNextKeyButton.disabled = !hasKeyframes;
  }
  if (el.timelineDeleteFrameButton) {
    el.timelineDeleteFrameButton.disabled = !hasCurrentKeyframe;
  }
  if (el.timelinePasteFrameButton) {
    el.timelinePasteFrameButton.disabled = !Runtime.copiedKeyframe;
  }
  el.modelOpacityInput.value = String(MotionState.model.opacity);
  el.modelOpacityValue.textContent = MotionState.model.opacity.toFixed(2);
  el.viewportModelOpacityInput.value = String(MotionState.model.opacity);
  el.viewportModelOpacityValue.textContent = MotionState.model.opacity.toFixed(2);
  el.skeletonOpacityInput.value = String(MotionState.visual_opacity.skeleton);
  el.skeletonOpacityValue.textContent = MotionState.visual_opacity.skeleton.toFixed(2);
  el.controlOpacityInput.value = String(MotionState.visual_opacity.controls);
  el.controlOpacityValue.textContent = MotionState.visual_opacity.controls.toFixed(2);
  if (el.controlSizeInput && el.controlSizeValue) {
    el.controlSizeInput.value = String(MotionState.visual_opacity.control_size ?? 0.68);
    el.controlSizeValue.textContent = (MotionState.visual_opacity.control_size ?? 0.68).toFixed(2);
  }
  if (el.controlThicknessInput && el.controlThicknessValue) {
    el.controlThicknessInput.value = String(MotionState.visual_opacity.control_thickness ?? 0.2);
    el.controlThicknessValue.textContent = (MotionState.visual_opacity.control_thickness ?? 0.2).toFixed(2);
  }
  if (el.controlVisualPresetSelect) {
    el.controlVisualPresetSelect.value = getActiveControlVisualPreset();
  }
  if (el.controlSolveModeSelect) {
    el.controlSolveModeSelect.value = getActiveControlSolveMode();
  }
  el.characterForwardValue.textContent = formatCharacterForwardState();
  if (el.forwardAngleInput && el.forwardAngleValue) {
    const yaw = normalizeForwardYaw(MotionState.direction?.yaw_degrees || 0);
    el.forwardAngleInput.value = String(yaw);
    el.forwardAngleValue.textContent = `${getModelFacingYawDegrees()}°`;
  }
  ensureTimelineFrameVisible(MotionState.current_frame);
  const timelineView = getTimelineView();
  el.timelineFrameSlider.min = String(timelineView.start);
  el.timelineFrameSlider.max = String(timelineView.end);
  el.timelineFrameSlider.value = String(MotionState.current_frame);
  if (el.timelineRangeValue) {
    el.timelineRangeValue.textContent = `${timelineView.start}-${timelineView.end}`;
  }
  if (el.timelinePinnedBadge) {
    el.timelinePinnedBadge.hidden = !Runtime.timelineViewPinned;
    el.timelinePinnedBadge.title = Runtime.timelineViewPinned
      ? "时间轴窗口已固定；重置窗口后恢复自动跟随当前帧"
      : "";
  }
  if (el.timelinePanLeftButton) {
    el.timelinePanLeftButton.disabled = timelineView.start <= 1;
  }
  if (el.timelineZoomInButton) {
    el.timelineZoomInButton.disabled = timelineView.frames <= 8;
  }
  if (el.timelineZoomOutButton) {
    el.timelineZoomOutButton.disabled = timelineView.frames >= 240;
  }
  if (el.timelineFrameNumberInput && document.activeElement !== el.timelineFrameNumberInput) {
    el.timelineFrameNumberInput.value = String(MotionState.current_frame);
  }
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
  ensureTimelineFrameVisible(MotionState.current_frame);
  const timelineView = getTimelineView();
  const gridStyle = `grid-template-columns:repeat(${timelineView.frames}, minmax(38px, 1fr))`;
  const keyframeByFrame = new Map(MotionState.keyframes.map((keyframe) => [keyframe.timeline_frame, keyframe]));
  el.timelineFrameTicks.style.cssText = gridStyle;
  el.timelineFrameTicks.innerHTML = Array.from({ length: timelineView.frames }, (_, index) => {
    const frame = timelineView.start + index;
    const keyframe = keyframeByFrame.get(frame);
    return `
      <button class="frame-tick ${keyframe ? "has-keyframe" : ""} ${frame === MotionState.current_frame ? "is-current" : ""} ${keyframe?.interpolation === "smooth" ? "is-smooth" : ""} ${Runtime.selectedTimelineFrames.includes(frame) ? "is-selected" : ""}" data-frame="${frame}" title="第 ${frame} 帧${keyframe ? " · 已保存" : ""}">
        ${String(frame).padStart(2, "0")}
      </button>
    `;
  }).join("");
  const keyPoseRow = WALK_KEY_POSES
    .filter((pose) => pose.timeline_frame >= timelineView.start && pose.timeline_frame <= timelineView.end)
    .map((pose) => {
    const keyframe = keyframeByFrame.get(pose.timeline_frame);
    const currentPose = Math.max(1, Math.min(8, Math.floor(((MotionState.current_frame - 1) / 3) + 1)));
    const column = pose.timeline_frame - timelineView.start + 1;
    return `
      <button class="key-pose ${keyframe ? "has-keyframe" : ""} ${currentPose === pose.index ? "is-current" : ""} ${keyframe?.interpolation === "smooth" ? "is-smooth" : ""} ${Runtime.selectedTimelineFrames.includes(pose.timeline_frame) ? "is-selected" : ""}" data-frame="${pose.timeline_frame}" style="grid-column:${column}" title="姿势 ${String(pose.index).padStart(2, "0")} · ${translatePoseLabel(pose.label)} · 第 ${pose.timeline_frame} 帧">
        <span>◆</span>
      </button>
    `;
  }).join("");
  const trackRows = [
    ["全局 / 重心", ["Global_CTRL", "Root_CTRL", "COG_CTRL"]],
    ["身体", ["Pelvis_CTRL", "Chest_CTRL", "Head_CTRL"]],
    ["手部 IK", ["R_Hand_IK", "L_Hand_IK"]],
    ["脚部 IK", ["R_Foot_IK", "L_Foot_IK"]],
  ];
  const markerRows = trackRows.map(([label, controls]) => {
    const markers = getSortedKeyframes()
      .filter((keyframe) => keyframe.timeline_frame >= timelineView.start && keyframe.timeline_frame <= timelineView.end)
      .map((keyframe) => {
      const hasTrackData = keyframe.ik_controls?.some((control) => controls.includes(control.id)) || controls.includes("COG_CTRL");
      if (!hasTrackData) return "";
      const column = keyframe.timeline_frame - timelineView.start + 1;
      return `
        <button class="track-marker ${keyframe.timeline_frame === MotionState.current_frame ? "is-current" : ""} ${keyframe.interpolation === "smooth" ? "is-smooth" : ""} ${Runtime.selectedTimelineFrames.includes(keyframe.timeline_frame) ? "is-selected" : ""}" data-frame="${keyframe.timeline_frame}" style="grid-column:${column}" title="${label} · 第 ${keyframe.timeline_frame} 帧">
          ◆
        </button>
      `;
    }).join("");
    return `<div class="dopesheet-row" data-track="${label}" style="${gridStyle}">${markers}</div>`;
  }).join("");
  el.timelineKeyframes.innerHTML = `
    <div class="dopesheet-row keypose-row" style="${gridStyle}">${keyPoseRow}</div>
    ${markerRows}
  `;
  el.timelineFrameTicks.querySelectorAll(".frame-tick").forEach((button) => {
    button.addEventListener("click", () => {
      markTimelineFrameSelected(Number(button.dataset.frame));
      executeCommand(createCommand("set_current_frame", { frame: Number(button.dataset.frame) }));
    });
  });
  el.timelineKeyframes.querySelectorAll(".key-pose, .track-marker").forEach((button) => {
    button.addEventListener("click", () => {
      markTimelineFrameSelected(Number(button.dataset.frame));
      executeCommand(createCommand("set_current_frame", { frame: Number(button.dataset.frame) }));
    });
  });
}

function getTimelineView() {
  const raw = Runtime.timelineView || { start: 1, frames: 24 };
  const frames = Math.max(8, Math.min(240, Math.round(raw.frames || 24)));
  const start = Math.max(1, Math.round(raw.start || 1));
  return { start, frames, end: start + frames - 1 };
}

function setTimelineView(start, frames, { pinned = true } = {}) {
  Runtime.timelineViewPinned = Boolean(pinned);
  Runtime.timelineView = {
    start: Math.max(1, Math.round(Number(start) || 1)),
    frames: Math.max(8, Math.min(240, Math.round(Number(frames) || 24))),
  };
  ensureTotalFramesForFrame(getTimelineView().end);
  return getTimelineView();
}

function getCurrentFrameTimelineRatio(view = getTimelineView()) {
  if (view.frames <= 1) {
    return 0.5;
  }
  if (MotionState.current_frame >= view.start && MotionState.current_frame <= view.end) {
    return Math.max(0, Math.min(1, (MotionState.current_frame - view.start) / Math.max(1, view.frames - 1)));
  }
  return 0.5;
}

function zoomTimelineView(direction = "in", anchorRatio = 0.5) {
  const view = getTimelineView();
  const ratio = Math.max(0, Math.min(1, Number(anchorRatio)));
  const currentWasVisible = MotionState.current_frame >= view.start && MotionState.current_frame <= view.end;
  const nextFrames = Math.max(8, Math.min(240, Math.round(view.frames * (direction === "out" ? 1.25 : 0.8))));
  const anchor = Math.round(view.start + ratio * (view.frames - 1));
  let start = Math.round(anchor - ratio * (nextFrames - 1));
  if (currentWasVisible && MotionState.current_frame < start) {
    start = MotionState.current_frame;
  } else if (currentWasVisible && MotionState.current_frame > start + nextFrames - 1) {
    start = MotionState.current_frame - nextFrames + 1;
  }
  return setTimelineView(start, nextFrames);
}

function panTimelineView(direction = "right") {
  const view = getTimelineView();
  const delta = Math.max(1, Math.round(view.frames * 0.2)) * (direction === "left" ? -1 : 1);
  return setTimelineView(view.start + delta, view.frames);
}

function getTimelineViewState() {
  const view = getTimelineView();
  const tickButtons = [...(el.timelineFrameTicks?.querySelectorAll(".frame-tick") || [])];
  const tickFrames = tickButtons
    .map((button) => Number(button.dataset.frame))
    .filter((frame) => Number.isFinite(frame));
  return {
    start: view.start,
    frames: view.frames,
    end: view.end,
    current_frame: MotionState.current_frame,
    current_visible: MotionState.current_frame >= view.start && MotionState.current_frame <= view.end,
    total_frames: MotionState.total_frames,
    slider_min: Number(el.timelineFrameSlider?.min || 0),
    slider_max: Number(el.timelineFrameSlider?.max || 0),
    slider_value: Number(el.timelineFrameSlider?.value || 0),
    rendered_ticks: tickFrames.length,
    first_tick: tickFrames.at(0) || null,
    last_tick: tickFrames.at(-1) || null,
    current_tick: Number(el.timelineFrameTicks?.querySelector(".frame-tick.is-current")?.dataset?.frame || 0) || null,
    displayed_range: el.timelineRangeValue?.textContent || null,
    reset_button_available: Boolean(el.timelineResetViewButton),
    pinned: Boolean(Runtime.timelineViewPinned),
    pinned_badge_visible: Boolean(el.timelinePinnedBadge && !el.timelinePinnedBadge.hidden),
    pinned_badge_text: el.timelinePinnedBadge?.textContent || null,
    pan_left_available: Boolean(el.timelinePanLeftButton) && !el.timelinePanLeftButton.disabled,
    pan_right_available: Boolean(el.timelinePanRightButton) && !el.timelinePanRightButton.disabled,
    zoom_in_available: Boolean(el.timelineZoomInButton) && !el.timelineZoomInButton.disabled,
    zoom_out_available: Boolean(el.timelineZoomOutButton) && !el.timelineZoomOutButton.disabled,
    selected_frames: [...Runtime.selectedTimelineFrames],
    keyframes_in_view: getSortedKeyframes()
      .filter((keyframe) => keyframe.timeline_frame >= view.start && keyframe.timeline_frame <= view.end)
      .map((keyframe) => keyframe.timeline_frame),
    can_zoom_in: view.frames > 8,
    can_zoom_out: view.frames < 240,
  };
}

function ensureTimelineFrameVisible(frame, { force = false } = {}) {
  const target = Math.max(1, Math.round(Number(frame) || 1));
  ensureTotalFramesForFrame(target);
  if (Runtime.timelineViewPinned && !force) {
    return getTimelineView();
  }
  const view = getTimelineView();
  let start = view.start;
  if (target < view.start) {
    start = target;
  } else if (target > view.end) {
    start = target - view.frames + 1;
  }
  Runtime.timelineView = { start: Math.max(1, start), frames: view.frames };
  ensureTotalFramesForFrame(getTimelineView().end);
  return getTimelineView();
}

function handleTimelineWheel(event) {
  event.preventDefault();
  const view = getTimelineView();
  if (event.shiftKey) {
    const direction = event.deltaY > 0 ? 1 : -1;
    panTimelineView(direction > 0 ? "right" : "left");
  } else {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    zoomTimelineView(event.deltaY > 0 ? "out" : "in", ratio);
  }
  renderAll();
}

function renderMappingPanel() {
  const sourceById = new Map(MotionState.source_bones.map((bone) => [bone.id, bone]));
  const assignedBySourceId = new Map(Object.entries(MotionState.humanoid_mapping).map(([joint, sourceId]) => [sourceId, joint]));
  const bindingConfirmed = hasConfirmedHumanoidBinding();
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
    const classes = ["mapping-chip"];
    if (bindingConfirmed && (sourceBone || isOptionalFallback)) {
      classes.push("is-confirmed");
    } else if (sourceBone) {
      classes.push("is-mapped");
    } else if (isOptionalFallback) {
      classes.push("is-fallback");
    }
    return `
      <div class="${classes.join(" ")}" draggable="true" data-humanoid-joint="${joint}">
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
    const classes = ["source-bone-row"];
    if (assignedJoint) {
      classes.push("is-assigned");
    }
    if (assignedJoint && bindingConfirmed) {
      classes.push("is-confirmed");
    }
    if (selected) {
      classes.push("is-selected");
    }
    return `
      <div class="${classes.join(" ")}" data-source-bone-id="${bone.id}">
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
    model: "导入模型",
    skeleton: "骨骼识别",
    mapping: "骨骼识别",
    control_rig: "生成 IK 控制器",
    ik: "IK 控制器",
    motion: "动作编辑",
    validate: "验证",
    export: "导出",
  }[stage] || stage;
}

function translateSkeletonId(id) {
  return {
    Humanoid_v1: "人形骨架 v1",
    SourceRig_v1: "适配源骨架 v1",
  }[id] || id;
}

function formatSkeletonStatusLabel() {
  if (!MotionState.skeleton?.id) {
    return "未识别";
  }
  if (MotionState.skeleton.editable_assignment_skeleton) {
    const missingCount = MotionState.skeleton.missing_required_joints?.length || 0;
    return missingCount > 0 ? `赋值骨架 v1 · 缺 ${missingCount}` : "赋值骨架 v1";
  }
  return translateSkeletonId(MotionState.skeleton.id);
}

function formatCharacterForwardState() {
  const yaw = getModelFacingYawDegrees();
  const angleText = yaw === 0 ? "模型旋转 0°" : `模型旋转 ${yaw > 0 ? "+" : ""}${yaw}°`;
  return MotionState.direction?.confirmed ? `${angleText} / 已确认` : `${angleText} / 待确认`;
}

function formatDirectionCommandMessage(_sign, yaw, confirmed) {
  const modelYaw = normalizeForwardYaw(yaw);
  const angle = modelYaw === 0 ? "0°" : `${modelYaw > 0 ? "+" : ""}${modelYaw}°`;
  return confirmed ? `已确认模型方向：地图前方固定，模型旋转 ${angle}` : `已调整模型方向：地图前方固定，模型旋转 ${angle}，请确认`;
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
    set_control_transforms: "批量设置控制器变换",
    set_ik_target: "设置 IK 目标",
    set_joint_position: "设置关节点",
    rotate_joint_branch: "旋转关节分支",
    scale_joint_branch: "缩放关节分支",
    insert_keyframe: "插入关键帧",
    delete_current_keyframe: "删除当前关键帧",
    copy_current_frame: "复制当前帧",
    paste_copied_frame: "粘贴当前帧",
    mirror_current_frame: "镜像当前帧",
    smooth_keyframes_between: "平滑关键帧段",
    validate_motion: "验证动作",
    export_motion_json: "导出动作 JSON",
    import_motion_json: "导入动作 JSON",
    export_binding_preset: "导出绑定预设",
    import_binding_preset: "导入绑定预设",
    undo: "撤销",
    redo: "重做",
    play: "播放",
    stop: "停止",
    select_bone: "选择骨骼",
    select_source_bone: "选择导入骨骼",
    select_control: "选择控制器",
    clear_selection: "取消选择",
    set_loop: "设置循环",
    set_model_opacity: "设置模型透明度",
    set_skeleton_opacity: "设置骨架透明度",
    set_control_opacity: "设置控制器透明度",
    set_stage: "切换阶段",
    set_current_frame: "设置当前帧",
    go_to_previous_keyframe: "上一关键帧",
    go_to_next_keyframe: "下一关键帧",
    set_view_option: "设置显示选项",
    set_control_visual_size: "设置控制器大小",
    set_control_visual_thickness: "设置控制器线粗",
    set_control_visual_preset: "设置控制器方案",
    set_control_solve_mode: "设置控制逻辑",
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
      visual_preset: "控制器方案",
      visual_preset_label: "控制器方案",
      solve_mode: "控制逻辑",
      solve_mode_label: "控制逻辑",
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
    Pelvis_CTRL: "胯部控制器",
    Chest_CTRL: "胸腰控制器",
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
    "控制器方案": translateControlVisualPreset(getActiveControlVisualPreset()),
    "控制逻辑": translateControlSolveMode(getActiveControlSolveMode()),
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
    "多选控制器": getSelectedControlIds().length > 0 ? getSelectedControlIds().map(translateControlName).join("、") : "无",
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
  Runtime.stage = stage === "validate" ? "motion" : stage;
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
  if (!MotionState.skeleton) {
    if (MotionState.model.loaded) {
      const result = applyHumanoidSkeletonBinding({ exposeJointControls: true });
      MotionState.selected_bone = MotionState.bones[0]?.name || null;
      return result;
    }
    requireSkeleton();
  }
  if (MotionState.skeleton.id === "Humanoid_v1") {
    return;
  }
  if (MotionState.source_bones.length > 0 || MotionState.model.loaded) {
    const result = applyHumanoidSkeletonBinding();
    MotionState.selected_bone = MotionState.bones[0]?.name || null;
    return result;
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
    status: "Not run",
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
  requestViewportRender();
}

function updateCamera() {
  const x = Math.sin(yaw) * Math.cos(pitch) * cameraDistance;
  const y = Math.sin(pitch) * cameraDistance;
  const z = Math.cos(yaw) * Math.cos(pitch) * cameraDistance;
  camera.position.set(x, y, z).add(cameraTarget);
  camera.lookAt(cameraTarget);
  requestViewportRender();
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
  let shouldRender = Runtime.needsRender;
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
      shouldRender = true;
    }
  }
  if (Runtime.dragging || Runtime.transformMode) {
    shouldRender = true;
  }
  if (shouldRender) {
    renderer.render(scene, camera);
    Runtime.needsRender = false;
  }
}

function onPointerDown(event) {
  if (Runtime.transformMode) {
    event.preventDefault();
    if (event.button === 2) {
      cancelKeyboardTransform();
    } else if (event.button === 0) {
      const gizmoPick = getTransformGizmoPick(event);
      if (gizmoPick?.pickData?.axis_key) {
        selectTransformGizmoAxis(gizmoPick.pickData.axis_key, event);
      } else {
        beginTransformPointerDrag(event);
      }
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

function canPickRigSkeletonInViewport() {
  return Runtime.stage === "skeleton" || Runtime.stage === "mapping";
}

function canPickControlInViewport() {
  return Runtime.stage === "motion" || Runtime.stage === "control_rig" || Runtime.stage === "ik";
}

function canPickJointControlInViewport() {
  return canPickControlInViewport();
}

function clearViewportSelection(event) {
  event.preventDefault();
  Runtime.dragging = false;
  Runtime.navigationMode = null;
  Runtime.pendingViewportDrag = null;
  executeCommand(createCommand("clear_selection"));
  return false;
}

function handleViewportPick(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  pointerNdc.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const transformPick = getBestTransformGizmoPick(raycaster.intersectObjects(gizmoGroup.children, true));
  if (transformPick?.pickData?.mode) {
    event.preventDefault();
    Runtime.lastPointer = { x: event.clientX, y: event.clientY };
    startKeyboardTransform(transformPick.pickData.mode);
    selectTransformGizmoAxis(transformPick.pickData.axis_key || null, event);
    return true;
  }
  const controlHits = raycaster.intersectObjects(ikGroup.children, true);
  const controlPick = getBestIkControlPick(controlHits, event) || getClosestIkControlScreenPick(event);
  if (controlPick) {
    const pickData = controlPick.pickData;
    const control = MotionState.ik_controls.find((item) => item.id === pickData?.control_id);
    if (control) {
      event.preventDefault();
      const additive = event.shiftKey;
      const toggle = event.ctrlKey || event.metaKey;
      const remove = event.altKey;
      const modifyingSelection = additive || toggle || remove;
      executeCommand(createCommand("select_control", { control: control.id, additive, toggle, remove }));
      if (modifyingSelection || MotionState.transform.tool !== "select") {
        Runtime.dragging = false;
        Runtime.navigationMode = null;
        Runtime.pendingViewportDrag = null;
        return true;
      }
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
  const canPickSkeleton = canPickRigSkeletonInViewport();
  const jointHits = canPickSkeleton && MotionState.show.joint_debug_controls ? raycaster.intersectObjects(skeletonGroup.children, true) : [];
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
  const hits = canPickSkeleton ? raycaster.intersectObjects(sourceSkeletonGroup.children, true) : [];
  const hit = hits.find((item) => findPickData(item.object, "source_bone"));
  if (!hit) {
    return clearViewportSelection(event);
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

function getTransformGizmoPick(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  pointerNdc.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  raycaster.setFromCamera(pointerNdc, camera);
  return getBestTransformGizmoPick(raycaster.intersectObjects(gizmoGroup.children, true));
}

function getBestTransformGizmoPick(hits) {
  const candidates = hits
    .map((hit) => {
      const pickData = findPickData(hit.object, "transform_gizmo");
      if (!pickData?.mode || !pickData?.control_id) {
        return null;
      }
      return { hit, pickData };
    })
    .filter(Boolean);
  candidates.sort((a, b) => a.hit.distance - b.hit.distance);
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
  const transformPick = getBestTransformGizmoPick(raycaster.intersectObjects(gizmoGroup.children, true));
  const nextTransformAxis = transformPick?.pickData?.axis_key || null;
  const controlPick = nextTransformAxis
    ? null
    : getBestIkControlPick(raycaster.intersectObjects(ikGroup.children, true), event) || getClosestIkControlScreenPick(event);
  const nextControlId = controlPick?.pickData?.control_id || null;
  const jointHit = !nextTransformAxis && !nextControlId && canPickRigSkeletonInViewport() && MotionState.show.joint_debug_controls
    ? raycaster.intersectObjects(skeletonGroup.children, true).find((item) => findPickData(item.object, "humanoid_joint"))
    : null;
  const nextJointName = jointHit ? findPickData(jointHit.object, "humanoid_joint")?.joint_name || null : null;
  if (
    Runtime.hoveredTransformAxis !== nextTransformAxis
    || Runtime.hoveredControlId !== nextControlId
    || Runtime.hoveredJointName !== nextJointName
  ) {
    Runtime.hoveredTransformAxis = nextTransformAxis;
    Runtime.hoveredControlId = nextControlId;
    Runtime.hoveredJointName = nextJointName;
    canvas.style.cursor = nextTransformAxis ? "crosshair" : nextControlId || nextJointName ? "pointer" : "default";
    renderAll();
  }
}

function beginIkControlDrag(event, control) {
  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);
  const controls = getSelectedControlIds().includes(control.id)
    ? getSelectedTransformControls("translate")
    : [control];
  const subject = createTransformSubjectForControls(controls, control);
  Runtime.dragging = true;
  Runtime.navigationMode = "ik_control";
  Runtime.draggingIkControlId = control.id;
  Runtime.draggingIkFinalPosition = [...control.position];
  Runtime.draggingIkControlIds = subject.control_ids;
  Runtime.draggingIkStartSubjects = subject.subjects;
  Runtime.draggingIkFinalTransforms = [];
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
  const primaryStart = Runtime.draggingIkStartSubjects?.find((item) => item.control_id === Runtime.draggingIkControlId)
    || Runtime.draggingIkStartSubjects?.[0];
  const delta = primaryStart
    ? point.clone().sub(new THREE.Vector3().fromArray(primaryStart.start_position))
    : new THREE.Vector3();
  const transforms = (Runtime.draggingIkStartSubjects || [])
    .map((item) => {
      const position = new THREE.Vector3().fromArray(item.start_position).add(delta).toArray();
      applyIkTargetPreview(item.control_id, position, { preserveSelection: true, preserveControlIds: Runtime.draggingIkControlIds || [] });
      return { control_id: item.control_id, position };
    });
  setControlSelection(Runtime.draggingIkControlIds || transforms.map((item) => item.control_id), Runtime.draggingIkControlId);
  Runtime.draggingIkFinalTransforms = transforms;
  const primary = transforms.find((item) => item.control_id === Runtime.draggingIkControlId);
  Runtime.draggingIkFinalPosition = primary?.position || point.toArray();
  renderAll();
}

function finishIkControlDrag() {
  if (!Runtime.draggingIkControlId || !Runtime.draggingIkFinalPosition) {
    return;
  }
  const controlId = Runtime.draggingIkControlId;
  const finalPosition = [...Runtime.draggingIkFinalPosition];
  const finalTransforms = deepClone(Runtime.draggingIkFinalTransforms || []);
  const startSnapshot = Runtime.ikDragStartSnapshot;
  Runtime.draggingIkControlId = null;
  Runtime.draggingIkControlIds = null;
  Runtime.draggingIkStartSubjects = null;
  Runtime.draggingIkFinalTransforms = null;
  Runtime.draggingIkPlane = null;
  Runtime.draggingIkFinalPosition = null;
  Runtime.ikDragStartSnapshot = null;
  if (startSnapshot) {
    restoreCoreState(startSnapshot);
  }
  if (finalTransforms.length > 1) {
    executeCommand(createCommand("set_control_transforms", { transform_mode: "translate", space: MotionState.transform.space, transforms: finalTransforms }));
  } else {
    const control = MotionState.ik_controls.find((item) => item.id === controlId);
    const commandName = control?.is_joint_control ? "set_ik_target" : "set_control_transform";
    const args = control?.is_joint_control
      ? { control_id: controlId, position: finalPosition }
      : { control_id: controlId, transform_mode: "translate", space: MotionState.transform.space, position: finalPosition };
    executeCommand(createCommand(commandName, args));
  }
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

function applyIkTargetPreview(controlId, position, { preserveSelection = false, preserveControlIds = [] } = {}) {
  const control = MotionState.ik_controls.find((item) => item.id === controlId);
  if (!control) {
    return;
  }
  const previousControl = deepClone(control);
  const targetPosition = position.map(Number);
  control.position = targetPosition;
  applyControlToJoint(control, previousControl);
  const updatedControl = MotionState.ik_controls.find((item) => item.id === controlId);
  if (updatedControl) {
    updatedControl.position = [...targetPosition];
  }
  if (!preserveSelection) {
    activateControlSelection(control.id);
  }
  const preserveIds = new Set(preserveControlIds);
  preserveIds.add(control.id);
  MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
    preserveControlIds: [...preserveIds],
  });
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
    const previousPointer = Runtime.transformCurrentPointer || Runtime.transformLastPointer || Runtime.lastPointer || currentPointer;
    Runtime.lastPointer = currentPointer;
    Runtime.transformCurrentPointer = currentPointer;
    updateTransformRotateAccumulator(previousPointer, currentPointer);
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
  if (!shouldHandleGlobalKeydown(event)) {
    return;
  }
  const key = event.key.toLowerCase();
  const hasCommandModifier = event.ctrlKey || event.metaKey;
  if (hasCommandModifier && key === "c") {
    event.preventDefault();
    executeCommand(createCommand("copy_current_frame"));
    return;
  }
  if (hasCommandModifier && key === "v") {
    event.preventDefault();
    executeCommand(createCommand("paste_copied_frame", { frame: MotionState.current_frame }));
    return;
  }
  if (hasCommandModifier && key === "z") {
    event.preventDefault();
    if (Runtime.transformMode) {
      cancelKeyboardTransform();
    }
    executeCommand(createCommand(event.shiftKey ? "redo" : "undo"));
    return;
  }
  if (hasCommandModifier && key === "y") {
    event.preventDefault();
    if (Runtime.transformMode) {
      cancelKeyboardTransform();
    }
    executeCommand(createCommand("redo"));
    return;
  }
  if (Runtime.transformMode) {
    if (key === "escape") {
      event.preventDefault();
      cancelKeyboardTransform();
    } else if (key === "enter") {
      event.preventDefault();
      finishKeyboardTransform();
    } else if (["x", "y", "z"].includes(key)) {
      event.preventDefault();
      setTransformAxis(MotionState.transform.axis === key ? null : key);
    } else if (key === "v") {
      event.preventDefault();
      setTransformAxis(MotionState.transform.axis === "view" ? null : "view");
    }
    return;
  }
  if (key === "[" || key === "pageup") {
    event.preventDefault();
    executeCommand(createCommand("go_to_previous_keyframe"));
    return;
  }
  if (key === "]" || key === "pagedown") {
    event.preventDefault();
    executeCommand(createCommand("go_to_next_keyframe"));
    return;
  }
  if (key === "delete" || key === "backspace") {
    event.preventDefault();
    executeCommand(createCommand("delete_current_keyframe", { frame: MotionState.current_frame }));
    return;
  }
  if (["g", "r", "s"].includes(key)) {
    event.preventDefault();
    startKeyboardTransform(getTransformModeFromKey(key));
  }
}

function shouldHandleGlobalKeydown(event) {
  const target = event.target;
  if (!target?.tagName) {
    return true;
  }
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
    return false;
  }
  if (target.tagName !== "INPUT") {
    return true;
  }
  if (target.type === "range") {
    target.blur();
    canvas.focus({ preventScroll: true });
    return true;
  }
  return false;
}

function resetTransformRotationAccumulator(pointer = null) {
  Runtime.transformAccumulatedAngle = 0;
  Runtime.transformLastPointer = pointer ? { x: pointer.x, y: pointer.y } : null;
}

function updateTransformRotateAccumulator(previousPointer, currentPointer) {
  if (Runtime.transformMode !== "rotate") {
    Runtime.transformLastPointer = currentPointer ? { x: currentPointer.x, y: currentPointer.y } : null;
    return;
  }
  const previous = previousPointer || Runtime.transformLastPointer || currentPointer;
  if (!previous || !currentPointer) {
    return;
  }
  const delta = new THREE.Vector2(currentPointer.x - previous.x, currentPointer.y - previous.y);
  if (delta.lengthSq() < 0.0001) {
    Runtime.transformLastPointer = { x: currentPointer.x, y: currentPointer.y };
    return;
  }
  const subject = Runtime.transformSubject;
  const axisName = MotionState.transform.axis;
  let angleDelta = 0;
  if (axisName && axisName !== "view") {
    const axis = getTransformAxisVector(axisName, subject?.control_id);
    const screenAxis = getProjectedAxisScreenVector(axis);
    if (screenAxis.length() > 0.001) {
      angleDelta = -delta.dot(screenAxis.normalize()) * 0.012;
    } else {
      angleDelta = (Math.abs(delta.x) >= Math.abs(delta.y) ? -delta.x : delta.y) * 0.012;
    }
  } else {
    const center = subject?.start_screen || (subject?.start_position ? getWorldScreenPosition(subject.start_position) : null);
    if (center) {
      const from = new THREE.Vector2(previous.x - center.x, previous.y - center.y);
      const to = new THREE.Vector2(currentPointer.x - center.x, currentPointer.y - center.y);
      if (from.length() > 8 && to.length() > 8) {
        from.normalize();
        to.normalize();
        const cross = from.x * to.y - from.y * to.x;
        const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1);
        angleDelta = Math.atan2(cross, dot);
      } else {
        angleDelta = (delta.y - delta.x) * 0.008;
      }
    } else {
      angleDelta = (delta.y - delta.x) * 0.008;
    }
  }
  Runtime.transformAccumulatedAngle += angleDelta;
  Runtime.transformLastPointer = { x: currentPointer.x, y: currentPointer.y };
}

function beginTransformPointerDrag(event) {
  Runtime.transformPointerDown = true;
  Runtime.transformPointerMoved = false;
  Runtime.transformPointerStart = { x: event.clientX, y: event.clientY };
  Runtime.transformCurrentPointer = { x: event.clientX, y: event.clientY };
  resetTransformRotationAccumulator(Runtime.transformCurrentPointer);
  Runtime.transformPointerId = event.pointerId;
  canvas.setPointerCapture?.(event.pointerId);
}

function selectTransformGizmoAxis(axisKey, event) {
  const nextAxis = axisKey === "view" ? "view" : ["x", "y", "z"].includes(axisKey) ? axisKey : null;
  MotionState.transform.axis = nextAxis;
  Runtime.transformAxis = nextAxis;
  resetTransformStartFromCurrentControl(event);
  beginTransformPointerDrag(event);
  renderAll();
}

function startKeyboardTransform(mode) {
  const controls = getSelectedTransformControls(mode);
  if (controls.length === 0) {
    return;
  }
  Runtime.transformMode = mode;
  MotionState.transform.axis = mode === "rotate" ? "view" : null;
  Runtime.transformSubject = createTransformSubjectForControls(controls);
  Runtime.transformStartSnapshot = snapshotCoreState();
  Runtime.transformStartPointer = { ...Runtime.lastPointer };
  Runtime.transformFinalValue = null;
  Runtime.transformAxis = MotionState.transform.axis;
  Runtime.transformCurrentPointer = { ...Runtime.lastPointer };
  resetTransformRotationAccumulator(Runtime.transformCurrentPointer);
  Runtime.transformPointerDown = false;
  Runtime.transformPointerMoved = false;
  Runtime.transformPointerStart = null;
  Runtime.transformPointerId = null;
  MotionState.transform.tool = mode;
  if (mode === "translate" && !MotionState.transform.axis) {
    hideTransformValueBox();
  }
  renderAll();
}

function resetTransformStartFromCurrentControl(event) {
  const mode = Runtime.transformMode;
  const selectedAxis = MotionState.transform.axis;
  const snapshot = Runtime.transformStartSnapshot;
  if (snapshot) {
    restoreCoreState(snapshot);
  }
  Runtime.transformMode = mode;
  MotionState.transform.tool = mode || MotionState.transform.tool;
  MotionState.transform.axis = selectedAxis;
  const controls = getSelectedTransformControls(mode);
  if (controls.length === 0) {
    return;
  }
  Runtime.transformSubject = createTransformSubjectForControls(controls);
  Runtime.transformStartSnapshot = snapshotCoreState();
  Runtime.transformStartPointer = { x: event.clientX, y: event.clientY };
  Runtime.transformCurrentPointer = { x: event.clientX, y: event.clientY };
  Runtime.transformFinalValue = null;
  Runtime.transformAxis = selectedAxis;
  resetTransformRotationAccumulator(Runtime.transformCurrentPointer);
}

function restartTransformFromCurrentPreview(pointer = Runtime.lastPointer) {
  const controls = getSelectedTransformControls(Runtime.transformMode);
  if (!Runtime.transformMode || controls.length === 0) {
    resetTransformRotationAccumulator(pointer);
    return;
  }
  const safePointer = pointer || { x: 0, y: 0 };
  Runtime.transformSubject = createTransformSubjectForControls(controls);
  Runtime.transformStartSnapshot = snapshotCoreState();
  Runtime.transformStartPointer = { x: safePointer.x, y: safePointer.y };
  Runtime.transformCurrentPointer = { x: safePointer.x, y: safePointer.y };
  Runtime.transformFinalValue = null;
  Runtime.transformAxis = MotionState.transform.axis;
  resetTransformRotationAccumulator(Runtime.transformCurrentPointer);
}

function updateKeyboardTransform(event) {
  if (!Runtime.transformMode || !Runtime.transformSubject || !Runtime.transformStartSnapshot) {
    return;
  }
  restoreCoreState(Runtime.transformStartSnapshot);
  const dx = event.clientX - Runtime.transformStartPointer.x;
  const dy = event.clientY - Runtime.transformStartPointer.y;
  const subject = Runtime.transformSubject;
  const subjects = Array.isArray(subject.subjects) && subject.subjects.length > 0 ? subject.subjects : [subject];
  if (Runtime.transformMode === "translate") {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    let deltaVector = right.clone().multiplyScalar(dx * cameraDistance * 0.0012)
      .addScaledVector(up, -dy * cameraDistance * 0.0012);
    if (MotionState.transform.axis) {
      const axis = getTransformAxisVector(MotionState.transform.axis, subject.control_id);
      const amount = getPointerAxisAmount(axis, dx, dy);
      deltaVector = axis.clone().multiplyScalar(amount);
    }
    const transforms = subjects.map((item) => {
      const next = new THREE.Vector3().fromArray(item.start_position).add(deltaVector).toArray();
      applyIkTargetPreview(item.control_id, next, { preserveSelection: true, preserveControlIds: subject.control_ids || [] });
      return { control_id: item.control_id, position: next };
    });
    setControlSelection(subject.control_ids || transforms.map((item) => item.control_id), subject.control_id);
    Runtime.transformFinalValue = { transforms };
    updateTransformValueBox(getTransformNumericPayload("translate", subject, { deltaVector }));
  } else if (Runtime.transformMode === "rotate") {
    const transforms = [];
    subjects.forEach((item) => {
      if (item.is_joint_control) {
        return;
      }
      const nextRotation = getKeyboardTransformRotation(item, event, dx, dy);
      const control = MotionState.ik_controls.find((candidate) => candidate.id === item.control_id);
      if (!control) {
        return;
      }
      const previousControl = deepClone(control);
      control.rotation = nextRotation;
      applyControlToJoint(control, previousControl);
      MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
        preserveControlIds: [...new Set([
          ...(subject.control_ids || []),
          ...getControlIdsToPreserveAfterTransform(control, "rotate"),
        ])],
      });
      transforms.push({ control_id: item.control_id, rotation: nextRotation });
    });
    setControlSelection(subject.control_ids || transforms.map((item) => item.control_id), subject.control_id);
    Runtime.transformFinalValue = { transforms };
    updateTransformValueBox(getTransformNumericPayload("rotate", subject, { angle: Runtime.transformAccumulatedAngle || 0 }));
  } else if (Runtime.transformMode === "scale") {
    const factor = Math.max(0.15, Math.min(6, Math.exp(dx * 0.01)));
    const transforms = [];
    subjects.forEach((item) => {
      if (!item.allow_scale || item.is_joint_control) {
        return;
      }
      const nextScale = item.start_scale.map((value) => value * factor);
      const control = MotionState.ik_controls.find((candidate) => candidate.id === item.control_id);
      if (!control?.allow_scale) {
        return;
      }
      const previousControl = deepClone(control);
      control.scale = nextScale;
      applyControlToJoint(control, previousControl);
      MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
        preserveControlId: control.type === "pole" ? control.id : null,
      });
      transforms.push({ control_id: item.control_id, scale: nextScale });
    });
    setControlSelection(subject.control_ids || transforms.map((item) => item.control_id), subject.control_id);
    Runtime.transformFinalValue = { transforms };
    updateTransformValueBox(getTransformNumericPayload("scale", subject, { factor }));
  }
  renderAll();
}

function getKeyboardTransformRotation(subject, event, dx, dy) {
  const startRotation = normalizeVec3(subject.start_rotation, [0, 0, 0]);
  const startQuaternion = getControlRotationQuaternion({ rotation: startRotation });
  const axisName = MotionState.transform.axis;
  const useViewAxis = !axisName || axisName === "view";
  const axis = useViewAxis ? getCameraViewAxis() : getTransformAxisVector(axisName, subject.control_id);
  const angle = Number.isFinite(Runtime.transformAccumulatedAngle)
    ? Runtime.transformAccumulatedAngle
    : useViewAxis
      ? getViewPlaneRotationAngle(subject, event, dx, dy)
      : getConstrainedRotationAngle(axis, dx, dy);
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
    return -pointer.dot(screenAxis.normalize()) * 0.012;
  }
  return (Math.abs(dx) >= Math.abs(dy) ? -dx : dy) * 0.012;
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
      return Math.atan2(cross, dot);
    }
  }
  return (dy - dx) * 0.008;
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

function ensureTransformValueBox() {
  if (Runtime.transformValueBox?.isConnected) {
    return Runtime.transformValueBox;
  }
  const wrap = document.querySelector(".viewport-wrap") || document.body;
  const box = document.createElement("div");
  box.className = "transform-value-box";
  box.innerHTML = `
    <span class="transform-value-label">G</span>
    <input class="transform-value-input" type="number" step="0.001" value="0">
    <button class="transform-value-close" type="button" aria-label="Close transform value">x</button>
  `;
  const input = box.querySelector("input");
  const close = box.querySelector(".transform-value-close");
  box.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  box.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commitTransformNumericValue(Number(input.value));
      canvas.focus({ preventScroll: true });
    }
    if (event.key === "Escape") {
      event.preventDefault();
      dismissTransformValueBox();
    }
  });
  close?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    dismissTransformValueBox();
  });
  close?.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dismissTransformValueBox();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      dismissTransformValueBox();
      canvas.focus({ preventScroll: true });
    }
  });
  input.addEventListener("change", () => {
    commitTransformNumericValue(Number(input.value));
  });
  wrap.appendChild(box);
  Runtime.transformValueBox = box;
  return box;
}

function updateTransformValueBox(payload) {
  if (!payload) {
    hideTransformValueBox();
    return;
  }
  const box = ensureTransformValueBox();
  const label = box.querySelector(".transform-value-label");
  const input = box.querySelector("input");
  Runtime.transformNumericValue = payload;
  box.classList.add("is-visible");
  label.textContent = payload.label;
  if (document.activeElement !== input) {
    input.value = formatTransformNumericValue(payload.value);
  }
  const screen = getWorldScreenPosition(payload.position || getSelectedTransformControl()?.position || [0, 0, 0]);
  if (screen) {
    const rect = (document.querySelector(".viewport-wrap") || canvas).getBoundingClientRect();
    box.style.left = `${Math.max(12, Math.min(rect.width - 150, screen.x - rect.left + 14))}px`;
    box.style.top = `${Math.max(48, Math.min(rect.height - 44, screen.y - rect.top + 14))}px`;
  }
}

function hideTransformValueBox() {
  Runtime.transformNumericValue = null;
  const box = Runtime.transformValueBox;
  if (!box?.isConnected) {
    return;
  }
  box.classList.remove("is-visible");
}

function dismissTransformValueBox() {
  if (Runtime.transformMode) {
    cancelKeyboardTransform();
  } else {
    hideTransformValueBox();
  }
  canvas.focus({ preventScroll: true });
}

function getTransformValueBoxState() {
  const box = Runtime.transformValueBox;
  const input = box?.querySelector(".transform-value-input") || null;
  const label = box?.querySelector(".transform-value-label") || null;
  const visible = Boolean(box?.isConnected && box.classList.contains("is-visible"));
  const rect = visible ? box.getBoundingClientRect() : null;
  const payload = Runtime.transformNumericValue || null;
  return {
    visible,
    mode: payload?.mode || null,
    label: label?.textContent || null,
    input_value: input?.value ?? null,
    numeric_value: Number.isFinite(Number(payload?.value)) ? Number(payload.value) : null,
    control_ids: Array.isArray(payload?.control_ids) ? [...payload.control_ids] : [],
    active_transform_mode: Runtime.transformMode || null,
    active_axis: MotionState.transform.axis || null,
    input_focused: document.activeElement === input,
    left: rect ? Math.round(rect.left) : null,
    top: rect ? Math.round(rect.top) : null,
  };
}

function formatTransformNumericValue(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(3).replace(/\.?0+$/, "") : "0";
}

function getTransformNumericPayload(mode, subject, data = {}) {
  const position = subject.start_position || getSelectedTransformControl()?.position || [0, 0, 0];
  if (mode === "translate") {
    const axis = MotionState.transform.axis;
    if (!axis) {
      return null;
    }
    const deltaVector = data.deltaVector || new THREE.Vector3();
    const axisVector = getTransformAxisVector(axis, subject.control_id).normalize();
    const value = deltaVector.length() > 0.0001 ? deltaVector.dot(axisVector) : 0;
    return {
      mode,
      label: `G ${axis.toUpperCase()}`,
      value,
      axisVector: axisVector.length() > 0.0001 ? axisVector.toArray() : getRigBasis().right.toArray(),
      control_ids: subject.control_ids || [subject.control_id],
      position,
    };
  }
  if (mode === "rotate") {
    const axisName = MotionState.transform.axis;
    const axisVector = (!axisName || axisName === "view")
      ? getCameraViewAxis()
      : getTransformAxisVector(axisName, subject.control_id);
    return {
      mode,
      label: axisName ? `R ${axisName.toUpperCase()}` : "R",
      value: THREE.MathUtils.radToDeg(data.angle || 0),
      axisVector: axisVector.length() > 0.0001 ? axisVector.clone().normalize().toArray() : getCameraViewAxis().toArray(),
      control_ids: subject.control_ids || [subject.control_id],
      position,
    };
  }
  return {
    mode,
    label: MotionState.transform.axis ? `S ${MotionState.transform.axis.toUpperCase()}` : "S",
    value: data.factor || 1,
    control_ids: subject.control_ids || [subject.control_id],
    position,
  };
}

function commitTransformNumericValue(value) {
  if (!Number.isFinite(value) || !Runtime.transformNumericValue) {
    return;
  }
  const payload = Runtime.transformNumericValue;
  const normalizedValue = normalizeTransformNumericInput(value, payload.mode);
  if (Runtime.transformMode && Runtime.transformSubject && Runtime.transformStartSnapshot) {
    applyNumericValueToActiveTransform(normalizedValue, payload);
    return;
  }
  if (payload.mode === "translate") {
    applyNumericValueToFinishedTranslate(normalizedValue, payload);
    return;
  }
  if (payload.mode === "rotate") {
    applyNumericValueToFinishedRotate(normalizedValue, payload);
    return;
  }
  if (payload.mode === "scale") {
    applyNumericValueToFinishedScale(normalizedValue, payload);
  }
}

function normalizeTransformNumericInput(value, mode) {
  if (mode === "scale") {
    return Math.max(0.05, Math.min(20, Number(value)));
  }
  if (mode === "rotate") {
    return Math.max(-3600, Math.min(3600, Number(value)));
  }
  return Number(value);
}

function applyNumericValueToFinishedTranslate(value, payload) {
  if (!Array.isArray(payload.axisVector)) {
    return;
  }
  const deltaAmount = value - Number(payload.value || 0);
  const axis = new THREE.Vector3().fromArray(payload.axisVector);
  if (axis.length() < 0.0001 || Math.abs(deltaAmount) < 0.000001) {
    return;
  }
  const transforms = (payload.control_ids || getSelectedControlIds())
    .map((id) => MotionState.ik_controls.find((control) => control.id === id))
    .filter(Boolean)
    .map((control) => ({
      control_id: control.id,
      position: new THREE.Vector3().fromArray(control.position).addScaledVector(axis.normalize(), deltaAmount).toArray(),
    }));
  if (transforms.length > 0) {
    payload.value = value;
    executeCommand(createCommand("set_control_transforms", { transform_mode: "translate", space: MotionState.transform.space, transforms }));
    updateTransformValueBox({ ...payload, value });
  }
}

function applyNumericValueToFinishedRotate(value, payload) {
  if (!Array.isArray(payload.axisVector)) {
    return;
  }
  const deltaAngle = THREE.MathUtils.degToRad(value - Number(payload.value || 0));
  if (Math.abs(deltaAngle) < 0.000001) {
    return;
  }
  const axis = new THREE.Vector3().fromArray(payload.axisVector);
  if (axis.length() < 0.0001) {
    return;
  }
  const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axis.normalize(), deltaAngle);
  const transforms = (payload.control_ids || getSelectedControlIds())
    .map((id) => MotionState.ik_controls.find((control) => control.id === id))
    .filter((control) => control && !control.is_joint_control)
    .map((control) => {
      const current = getControlRotationQuaternion(control);
      const next = deltaQuaternion.clone().multiply(current).normalize();
      return {
        control_id: control.id,
        rotation: new THREE.Euler().setFromQuaternion(next, "XYZ").toArray().slice(0, 3),
      };
    });
  if (transforms.length > 0) {
    payload.value = value;
    executeCommand(createCommand("set_control_transforms", { transform_mode: "rotate", space: MotionState.transform.space, transforms }));
    updateTransformValueBox({ ...payload, value });
  }
}

function applyNumericValueToFinishedScale(value, payload) {
  const previous = Number(payload.value || 1);
  if (Math.abs(previous) < 0.000001) {
    return;
  }
  const factor = value / previous;
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.000001) {
    return;
  }
  const transforms = (payload.control_ids || getSelectedControlIds())
    .map((id) => MotionState.ik_controls.find((control) => control.id === id))
    .filter((control) => control?.allow_scale && !control.is_joint_control)
    .map((control) => ({
      control_id: control.id,
      scale: normalizeVec3((control.scale || [1, 1, 1]).map((item) => item * factor), control.scale || [1, 1, 1], 0.05, 20),
    }));
  if (transforms.length > 0) {
    payload.value = value;
    executeCommand(createCommand("set_control_transforms", { transform_mode: "scale", space: MotionState.transform.space, transforms }));
    updateTransformValueBox({ ...payload, value });
  }
}

function applyNumericValueToActiveTransform(value, payload) {
  const subject = Runtime.transformSubject;
  const subjects = Array.isArray(subject.subjects) && subject.subjects.length > 0 ? subject.subjects : [subject];
  restoreCoreState(Runtime.transformStartSnapshot);
  if (payload.mode === "translate") {
    const axis = new THREE.Vector3().fromArray(payload.axisVector || getRigBasis().right.toArray());
    const delta = axis.length() > 0.0001 ? axis.normalize().multiplyScalar(value) : new THREE.Vector3();
    const transforms = subjects.map((item) => {
      const position = new THREE.Vector3().fromArray(item.start_position).add(delta).toArray();
      applyIkTargetPreview(item.control_id, position, { preserveSelection: true, preserveControlIds: subject.control_ids || [] });
      return { control_id: item.control_id, position };
    });
    Runtime.transformFinalValue = { transforms };
    setControlSelection(subject.control_ids || transforms.map((item) => item.control_id), subject.control_id);
    updateTransformValueBox({ ...payload, value });
    renderAll();
  } else if (payload.mode === "rotate") {
    const angle = THREE.MathUtils.degToRad(value);
    const transforms = [];
    const preserveControlIds = new Set(subject.control_ids || []);
    subjects.forEach((item) => {
      if (item.is_joint_control) {
        return;
      }
      const control = MotionState.ik_controls.find((candidate) => candidate.id === item.control_id);
      if (!control) {
        return;
      }
      const previousControl = deepClone(control);
      const nextRotation = getNumericTransformRotation(item, payload, angle);
      control.rotation = nextRotation;
      applyControlToJoint(control, previousControl);
      getControlIdsToPreserveAfterTransform(control, "rotate").forEach((id) => preserveControlIds.add(id));
      transforms.push({ control_id: item.control_id, rotation: nextRotation });
    });
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls, {
      preserveControlIds: [...preserveControlIds],
    });
    Runtime.transformAccumulatedAngle = angle;
    Runtime.transformFinalValue = { transforms };
    setControlSelection(subject.control_ids || transforms.map((item) => item.control_id), subject.control_id);
    updateTransformValueBox({ ...payload, value });
    renderAll();
  } else if (payload.mode === "scale") {
    const factor = Math.max(0.05, Math.min(20, value));
    const transforms = [];
    subjects.forEach((item) => {
      if (!item.allow_scale || item.is_joint_control) {
        return;
      }
      const control = MotionState.ik_controls.find((candidate) => candidate.id === item.control_id);
      if (!control?.allow_scale) {
        return;
      }
      const previousControl = deepClone(control);
      const nextScale = normalizeVec3(item.start_scale.map((itemValue) => itemValue * factor), item.start_scale, 0.05, 20);
      control.scale = nextScale;
      applyControlToJoint(control, previousControl);
      transforms.push({ control_id: item.control_id, scale: nextScale });
    });
    MotionState.ik_controls = syncIkControlsToJoints(MotionState.ik_controls);
    Runtime.transformFinalValue = { transforms };
    setControlSelection(subject.control_ids || transforms.map((item) => item.control_id), subject.control_id);
    updateTransformValueBox({ ...payload, value: factor });
    renderAll();
  }
}

function getNumericTransformRotation(subject, payload, angle) {
  const startRotation = normalizeVec3(subject.start_rotation, [0, 0, 0]);
  const startQuaternion = getControlRotationQuaternion({ rotation: startRotation });
  const payloadAxis = Array.isArray(payload.axisVector) ? new THREE.Vector3().fromArray(payload.axisVector) : new THREE.Vector3();
  const axis = payloadAxis.length() > 0.0001
    ? payloadAxis.normalize()
    : getCameraViewAxis();
  const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const nextQuaternion = deltaQuaternion.multiply(startQuaternion).normalize();
  return new THREE.Euler().setFromQuaternion(nextQuaternion, "XYZ").toArray().slice(0, 3);
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
  resetTransformRotationAccumulator();
  if (!(mode && Runtime.transformNumericValue?.mode === mode)) {
    hideTransformValueBox();
  }
  if (!mode || !subject || !value || !snapshot) {
    renderAll();
    return;
  }
  restoreCoreState(snapshot);
  if (Array.isArray(value.transforms)) {
    executeCommand(createCommand("set_control_transforms", {
      transform_mode: mode,
      space: MotionState.transform.space,
      transforms: value.transforms,
    }));
  } else if (mode === "translate") {
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
  resetTransformRotationAccumulator();
  hideTransformValueBox();
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

function getSelectedTransformControls(mode = MotionState.transform.tool || "translate") {
  const selectedIds = getSelectedControlIds();
  const controls = selectedIds
    .map((id) => MotionState.ik_controls.find((control) => control.id === id))
    .filter(Boolean);
  const fallback = getSelectedTransformControl();
  const candidates = controls.length > 0 ? controls : fallback ? [fallback] : [];
  if (mode === "rotate") {
    return candidates.filter((control) => !control.is_joint_control);
  }
  if (mode === "scale") {
    return candidates.filter((control) => control.allow_scale && !control.is_joint_control);
  }
  return candidates;
}

function createTransformSubjectForControls(controls, primaryControl = null) {
  const primary = primaryControl || controls.find((control) => control.id === MotionState.selected_control) || controls[0];
  const center = controls.reduce((sum, control) => sum.add(new THREE.Vector3().fromArray(control.position)), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(controls.length, 1));
  const screenCenter = getWorldScreenPosition(center.toArray());
  return {
    control_id: primary.id,
    control_ids: controls.map((control) => control.id),
    start_position: center.toArray(),
    start_rotation: [...(primary.rotation || [0, 0, 0])],
    start_scale: [...(primary.scale || [1, 1, 1])],
    start_screen: screenCenter ? { x: screenCenter.x, y: screenCenter.y } : null,
    subjects: controls.map((control) => ({
      control_id: control.id,
      joint: control.target_joint,
      is_joint_control: Boolean(control.is_joint_control),
      allow_scale: Boolean(control.allow_scale),
      start_position: [...control.position],
      start_rotation: [...(control.rotation || [0, 0, 0])],
      start_scale: [...(control.scale || [1, 1, 1])],
    })),
  };
}

function getTransformModeFromKey(key) {
  return key === "g" ? "translate" : key === "r" ? "rotate" : key === "s" ? "scale" : "select";
}

function getTransformAxisVector(axisName, controlId) {
  if (axisName === "view") {
    return getCameraViewAxis();
  }
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
    getTransformValueBoxState,
    getTimelineViewState,
    getSourceRigDebug,
    getSourceBoneWorldPositions: () => MotionState.source_bones.map((bone) => ({
      id: bone.id,
      name: bone.name,
      position: getSourceBoneWorldPosition(bone),
    })),
    getIkControlScreenPositions,
    getJointScreenPositions,
  };
}

function getMotionStateSummary() {
  return {
    model: MotionState.model.loaded ? "Loaded" : "None",
    current_stage: Runtime.stage,
    skeleton: MotionState.skeleton?.id || "Missing",
    skeleton_label: formatSkeletonStatusLabel(),
    source_bones: MotionState.source_bones.length,
    glb_skins: MotionState.import_diagnostics.skins,
    glb_joints: MotionState.import_diagnostics.joints,
    humanoid_mapping: getMappingCount(),
    missing_required_mapping: getMissingHumanoidMappings({ includeOptional: false }),
    optional_fallback_mapping: getOptionalFallbackHumanoidMappings(),
    editable_assignment_skeleton: Boolean(MotionState.skeleton?.editable_assignment_skeleton),
    skeleton_mapping_source: MotionState.skeleton?.mapping_source || null,
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
    playback_fps: MotionState.playback_fps,
    keyframes: MotionState.keyframes.length,
    selected_bone: MotionState.selected_bone,
    selected_source_bone: getSelectedSourceBoneName(),
    selected_control: MotionState.selected_control,
    selected_controls: getSelectedControlIds(),
    selected_control_count: getSelectedControlIds().length,
    control_visual_preset: getActiveControlVisualPreset(),
    control_visual_preset_label: translateControlVisualPreset(getActiveControlVisualPreset()),
    control_solve_mode: getActiveControlSolveMode(),
    control_solve_mode_label: translateControlSolveMode(getActiveControlSolveMode()),
    renderer: "WebGL GPU",
    renderer_pixel_ratio: renderer.getPixelRatio(),
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
    control_size: MotionState.visual_opacity.control_size ?? 0.68,
    control_thickness: MotionState.visual_opacity.control_thickness ?? 0.2,
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
      rest_world_position: rest ? getSourceRestWorldPosition(rest).toArray() : null,
      original_rest_world_position: rest?.worldPosition?.toArray?.() || null,
      current_world_position: currentPosition?.toArray?.() || null,
      rest_world_quaternion: rest ? getSourceRestWorldQuaternion(rest).toArray() : null,
      original_rest_world_quaternion: rest?.worldQuaternion?.toArray?.() || null,
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

function ensureTotalFramesForFrame(frame) {
  const target = Math.max(1, Math.round(Number(frame) || 1));
  if (target > MotionState.total_frames) {
    MotionState.total_frames = target;
  }
  return target;
}

function clampFrame(frame) {
  return ensureTotalFramesForFrame(frame);
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
