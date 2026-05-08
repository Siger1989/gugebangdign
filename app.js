import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const canvas = document.querySelector("#rigCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111722);

const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 120);
const cameraTarget = new THREE.Vector3(0, 1.15, 0);
let yaw = -0.45;
let pitch = 0.18;
let cameraDistance = 5.6;

const root = new THREE.Group();
scene.add(root);

const modelRoot = new THREE.Group();
root.add(modelRoot);

const ghostRoot = new THREE.Group();
modelRoot.add(ghostRoot);

const loadedModelRoot = new THREE.Group();
modelRoot.add(loadedModelRoot);

const boneRoot = new THREE.Group();
root.add(boneRoot);

const helperRoot = new THREE.Group();
root.add(helperRoot);

const transformTarget = new THREE.Object3D();
transformTarget.name = "BlenderStyleTransformTarget";
scene.add(transformTarget);

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode("translate");
transformControls.setSpace("local");
transformControls.setSize(0.78);
transformControls.visible = false;
scene.add(transformControls);

const hemi = new THREE.HemisphereLight(0xffffff, 0x2c3342, 1.45);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8bb7ff, 0.75);
rimLight.position.set(-4, 3, -2);
scene.add(rimLight);

const grid = new THREE.GridHelper(8, 32, 0x39546b, 0x233142);
grid.material.transparent = true;
grid.material.opacity = 0.72;
helperRoot.add(grid);

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshBasicMaterial({ color: 0x151f2c, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
);
groundPlane.rotation.x = -Math.PI / 2;
helperRoot.add(groundPlane);

const centerLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 2.45, 0)]),
  new THREE.LineBasicMaterial({ color: 0xffc84a, transparent: true, opacity: 0.9 }),
);
helperRoot.add(centerLine);

const leftContact = makeContactDisk(0x4fc3ff);
leftContact.position.set(-0.32, 0.012, 0.18);
helperRoot.add(leftContact);

const rightContact = makeContactDisk(0xffc84a);
rightContact.position.set(0.32, 0.012, -0.18);
helperRoot.add(rightContact);

const worldAxes = createWorldAxisHelper();
helperRoot.add(worldAxes);
const walkDirectionHelper = createWalkDirectionHelper();
helperRoot.add(walkDirectionHelper);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dragPoint = new THREE.Vector3();

const jointMeshes = new Map();
const boneMeshes = new Map();
const contactMarkers = [leftContact, rightContact, walkDirectionHelper];
const WALK_FRAME_COUNT = 24;
const WALK_LOOP_FRAME = WALK_FRAME_COUNT + 1;
const WEIGHT_COLORS = {
  neutral: new THREE.Color(0x818892),
  unbound: new THREE.Color(0x565d66),
  otherBound: new THREE.Color(0x2b6f96),
  selectedLow: new THREE.Color(0x35d8ff),
  selectedMid: new THREE.Color(0xffd84f),
  selectedHigh: new THREE.Color(0xff4b78),
};

const state = {
  mode: "build",
  paintMode: "add",
  weightToolMode: "select",
  bones: [],
  joints: [],
  selectedJointId: null,
  selectedBoneId: null,
  selectionKind: "joint",
  currentFrame: 1,
  keyframes: [],
  undoStack: [],
  isPlaying: false,
  playStartMs: 0,
  brushRadius: 0.28,
  brushStrength: 0.45,
  modelOpacity: 0.58,
  boneOpacity: 0.78,
  boneThickness: 1,
  jointSize: 1,
  allowPoseStretch: false,
  showWeightPoints: false,
  mirrorAxis: "characterRight",
  walkDirection: "auto",
  stride: 0.62,
  hipBounce: 0.08,
  armSwing: 0.42,
  smoothness: 0.66,
  transformMode: "translate",
  transformSpace: "local",
  isTransformDragging: false,
  transformStart: null,
  transformChanged: false,
  modalTransform: null,
  syncingTransformTarget: false,
  nextJoint: 1,
  nextBone: 1,
  isExtending: false,
  pendingExtendJointId: null,
  isPosingBone: false,
  poseBoneId: null,
  poseInitialQuaternion: null,
  poseInitialPositions: null,
  poseAxisLock: null,
  orbiting: false,
  panning: false,
  painting: false,
  dragStart: new THREE.Vector2(),
  lastPointer: new THREE.Vector2(),
  hasPointerPosition: false,
  selectedSourceJointId: null,
};

let previewLine = null;
let loadedModel = null;
let ghostModelVisible = true;
let weightCloud = null;
let brushCursor = null;
const weightPoints = [];

const el = {
  statusLine: document.querySelector("#statusLine"),
  hudBoneName: document.querySelector("#hudBoneName"),
  hudKeyframes: document.querySelector("#hudKeyframes"),
  hudFrameState: document.querySelector("#hudFrameState"),
  timelineTrack: document.querySelector("#timelineTrack"),
  keyframeRecordList: document.querySelector("#keyframeRecordList"),
  currentFrameSaveState: document.querySelector("#currentFrameSaveState"),
  frameNumberInput: document.querySelector("#frameNumberInput"),
  frameRangeInput: document.querySelector("#frameRangeInput"),
  playbackState: document.querySelector("#playbackState"),
  playButton: document.querySelector("#playButton"),
  prevFrameButton: document.querySelector("#prevFrameButton"),
  nextFrameButton: document.querySelector("#nextFrameButton"),
  weightPointsToggle: document.querySelector("#weightPointsToggle"),
  weightBoneSelect: document.querySelector("#weightBoneSelect"),
  mirrorAxisSelect: document.querySelector("#mirrorAxisSelect"),
  walkDirectionSelect: document.querySelector("#walkDirectionSelect"),
  boneNameInput: document.querySelector("#boneNameInput"),
  boneColorInput: document.querySelector("#boneColorInput"),
  boneLengthValue: document.querySelector("#boneLengthValue"),
  parentBoneValue: document.querySelector("#parentBoneValue"),
  exportPreview: document.querySelector("#exportPreview"),
  importStatusText: document.querySelector("#importStatusText"),
  importSizeText: document.querySelector("#importSizeText"),
  importProgress: document.querySelector("#importProgress"),
  transformTranslateButton: document.querySelector("#transformTranslateButton"),
  transformRotateButton: document.querySelector("#transformRotateButton"),
  transformScaleButton: document.querySelector("#transformScaleButton"),
  transformSpaceButton: document.querySelector("#transformSpaceButton"),
  poseStretchToggle: document.querySelector("#poseStretchToggle"),
};

initSkeleton();
initGhostModel();
initWeightCloud();
initBrushCursor();
bindUi();
resize();
updateCamera();
renderTimeline();
installDebugApi();
animate();

function bindUi() {
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);

  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  document.querySelectorAll(".transform-button[data-transform]").forEach((button) => {
    button.addEventListener("click", () => setTransformMode(button.dataset.transform));
  });

  el.transformSpaceButton.addEventListener("click", toggleTransformSpace);

  transformControls.addEventListener("mouseDown", beginGizmoTransform);
  transformControls.addEventListener("objectChange", applyGizmoTransform);
  transformControls.addEventListener("dragging-changed", (event) => {
    state.isTransformDragging = event.value;
    if (!event.value) {
      commitTransformUndo("变换骨骼/关节");
      state.transformStart = null;
      state.transformChanged = false;
      syncTransformTargetToSelection();
    }
  });

  document.querySelectorAll(".paint-mode").forEach((button) => {
    button.addEventListener("click", () => {
      state.paintMode = button.dataset.paint;
      document.querySelectorAll(".paint-mode").forEach((item) => item.classList.toggle("is-active", item === button));
      setStatus(`权重笔刷：${button.textContent}`);
    });
  });
  el.weightPointsToggle.addEventListener("change", () => {
    state.showWeightPoints = el.weightPointsToggle.checked;
    updateWeightPointVisibility();
    setStatus(state.showWeightPoints ? "已显示权重点" : "已隐藏权重点");
  });
  document.querySelectorAll(".weight-tool").forEach((button) => {
    button.addEventListener("click", () => {
      setWeightToolMode(button.dataset.weightTool);
    });
  });
  el.weightBoneSelect.addEventListener("change", () => {
    if (el.weightBoneSelect.value) {
      if (el.weightBoneSelect.value.startsWith("joint:")) {
        selectJoint(el.weightBoneSelect.value.slice("joint:".length));
      } else {
        selectBone(el.weightBoneSelect.value);
      }
      const influence = getSelectedWeightInfluence();
      setStatus(`权重目标骨骼：${influence?.label || getSelectedBone()?.name || "无"}`);
    }
  });
  el.poseStretchToggle?.addEventListener("change", () => {
    state.allowPoseStretch = el.poseStretchToggle.checked;
    setStatus(state.allowPoseStretch
      ? "姿势 G：允许拉长骨骼，模型下级分支会跟随"
      : "姿势 G：保持骨长，使用 IK 移动关节");
  });
  el.mirrorAxisSelect.addEventListener("change", () => {
    state.mirrorAxis = el.mirrorAxisSelect.value;
    const plane = getMirrorPlane();
    setStatus(`镜像方向：${plane.label}`);
  });
  el.walkDirectionSelect.addEventListener("change", () => {
    state.walkDirection = el.walkDirectionSelect.value;
    updateWalkContactMarkers(frameToPhase(state.currentFrame));
    if (state.mode === "motion" && state.keyframes.length === 0) {
      applyAnimationAtFrame(state.currentFrame);
    }
    setStatus(`动作前向：${getWalkDirectionLabel(state.walkDirection)}`);
  });

  document.querySelector("#templateHumanButton").addEventListener("click", () => {
    pushUndo("生成人形模板");
    createHumanTemplate();
    setStatus("已生成常见人形骨架模板，可从任意端点继续拖出子骨骼");
  });

  document.querySelector("#newRootButton").addEventListener("click", () => {
    pushUndo("新建根骨骼");
    clearSkeleton();
    const hips = addJoint("hips", new THREE.Vector3(0, 1.05, 0), "#4fc3ff");
    selectJoint(hips.id);
    setStatus("已创建根关节 hips，从它拖动即可生成子骨骼");
  });

  document.querySelector("#mirrorBranchButton").addEventListener("click", mirrorSelectedBranch);
  document.querySelector("#deleteBoneButton").addEventListener("click", deleteSelectedBone);
  document.querySelector("#resetCameraButton").addEventListener("click", () => {
    yaw = -0.45;
    pitch = 0.18;
    cameraDistance = 5.6;
    cameraTarget.set(0, 1.15, 0);
    updateCamera();
  });

  document.querySelector("#ghostButton").addEventListener("click", () => {
    toggleModelTransparency();
  });

  document.querySelector("#loadProjectModelButton").addEventListener("click", () => {
    loadModelUrlWithProgress("./sample_models/stylized_3d_character_model.glb", "stylized_3d_character_model.glb");
  });

  document.querySelector("#modelFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    loadModelFile(file);
    event.target.value = "";
  });

  document.querySelector("#saveKeyframeButton").addEventListener("click", saveCurrentKeyframe);
  document.querySelector("#walkTemplateButton").addEventListener("click", generateWalkTemplate);
  document.querySelector("#smoothButton").addEventListener("click", smoothKeyframes);
  document.querySelector("#playButton").addEventListener("click", togglePlayback);
  el.prevFrameButton.addEventListener("click", () => {
    selectFrame(state.currentFrame - 1, { announce: true, stopPlayback: true });
  });
  el.nextFrameButton.addEventListener("click", () => {
    selectFrame(state.currentFrame + 1, { announce: true, stopPlayback: true });
  });
  el.frameNumberInput.addEventListener("change", () => {
    selectFrame(el.frameNumberInput.value, { announce: true, stopPlayback: true });
  });
  el.frameRangeInput.addEventListener("input", () => {
    selectFrame(el.frameRangeInput.value, { announce: false, stopPlayback: true });
  });
  el.frameRangeInput.addEventListener("change", () => {
    setStatus(`已选择第 ${state.currentFrame} 帧`);
  });
  el.timelineTrack.addEventListener("click", onTimelineTrackClick);
  document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
  document.querySelector("#clearButton").addEventListener("click", () => {
    pushUndo("清空项目");
    clearSkeleton();
    state.keyframes = [];
    initSkeleton();
    resetWeights();
    renderTimeline();
    setStatus("已清空并恢复基础骨架");
  });

  el.boneNameInput.addEventListener("change", () => {
    const joint = getSelectedJoint();
    const bone = getSelectedBone();
    pushUndo("重命名骨骼/关节");
    if (joint) {
      joint.name = el.boneNameInput.value.trim() || joint.name;
    }
    if (bone) {
      bone.name = el.boneNameInput.value.trim() || bone.name;
    }
    syncSkeletonMeshes();
    updateSelectionPanel();
  });

  el.boneColorInput.addEventListener("input", () => {
    const joint = getSelectedJoint();
    const bone = getSelectedBone();
    if (joint) {
      joint.color = el.boneColorInput.value;
    }
    if (bone) {
      bone.color = el.boneColorInput.value;
    }
    syncSkeletonMeshes();
  });

  bindRange("#brushRadiusInput", "#brushRadiusValue", "brushRadius");
  bindRange("#brushStrengthInput", "#brushStrengthValue", "brushStrength");
  bindRange("#modelOpacityInput", "#modelOpacityValue", "modelOpacity");
  bindRange("#boneOpacityInput", "#boneOpacityValue", "boneOpacity");
  bindRange("#boneThicknessInput", "#boneThicknessValue", "boneThickness");
  bindRange("#jointSizeInput", "#jointSizeValue", "jointSize");
  bindRange("#strideInput", "#strideValue", "stride");
  bindRange("#hipBounceInput", "#hipBounceValue", "hipBounce");
  bindRange("#armSwingInput", "#armSwingValue", "armSwing");
  bindRange("#smoothnessInput", "#smoothnessValue", "smoothness");

  document.querySelector("#groundToggle").addEventListener("change", (event) => {
    grid.visible = event.target.checked;
    groundPlane.visible = event.target.checked;
  });
  document.querySelector("#contactToggle").addEventListener("change", (event) => {
    contactMarkers.forEach((marker) => {
      marker.visible = event.target.checked;
    });
  });
  document.querySelector("#centerToggle").addEventListener("change", (event) => {
    centerLine.visible = event.target.checked;
  });

  canvas.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function bindRange(inputSelector, valueSelector, key) {
  const input = document.querySelector(inputSelector);
  const value = document.querySelector(valueSelector);
  const update = () => {
    state[key] = Number(input.value);
    value.textContent = Number(input.value).toFixed(2);
    if (key === "brushRadius") {
      updateBrushPreview();
      updateBrushCursorScale();
    }
    if (key === "modelOpacity") {
      ghostModelVisible = state.modelOpacity > 0.08;
      applyModelOpacity();
    }
    if (key === "boneOpacity") {
      syncSkeletonMeshes();
      applyTransformControlOpacity();
    }
    if (key === "boneThickness" || key === "jointSize") {
      syncSkeletonMeshes();
      setStatus(`骨骼显示：粗细 ${state.boneThickness.toFixed(2)}，节点 ${state.jointSize.toFixed(2)}`);
    }
    if (key === "stride" || key === "hipBounce" || key === "armSwing") {
      if (state.keyframes.length > 0) {
        generateWalkTemplate(false);
      }
    }
  };
  input.addEventListener("input", update);
  update();
}

function initSkeleton() {
  if (state.joints.length === 0) {
    createHumanTemplate();
  }
}

function clearSkeleton() {
  state.bones = [];
  state.joints = [];
  state.selectedJointId = null;
  state.selectedBoneId = null;
  state.nextJoint = 1;
  state.nextBone = 1;
  jointMeshes.forEach((mesh) => boneRoot.remove(mesh));
  boneMeshes.forEach((group) => boneRoot.remove(group));
  jointMeshes.clear();
  boneMeshes.clear();
  removePreviewLine();
  updateSelectionPanel();
}

function createHumanTemplate() {
  clearSkeleton();
  const hips = addJoint("hips", new THREE.Vector3(0, 1.05, 0), "#4fc3ff");
  const spine = addBoneFrom(hips.id, "spine", new THREE.Vector3(0, 1.45, 0), "#49d4ff").end;
  const chest = addBoneFrom(spine.id, "chest", new THREE.Vector3(0, 1.75, 0), "#3ee5e8").end;
  addBoneFrom(chest.id, "head", new THREE.Vector3(0, 2.12, 0), "#3ee5e8");

  const shoulderL = addBoneFrom(chest.id, "upper_arm.L", new THREE.Vector3(-0.42, 1.66, 0), "#4fc3ff").end;
  const elbowL = addBoneFrom(shoulderL.id, "lower_arm.L", new THREE.Vector3(-0.74, 1.36, 0), "#4fc3ff").end;
  addBoneFrom(elbowL.id, "hand.L", new THREE.Vector3(-0.82, 1.08, 0), "#4fc3ff");

  const shoulderR = addBoneFrom(chest.id, "upper_arm.R", new THREE.Vector3(0.42, 1.66, 0), "#ffb04f").end;
  const elbowR = addBoneFrom(shoulderR.id, "lower_arm.R", new THREE.Vector3(0.74, 1.36, 0), "#ffb04f").end;
  addBoneFrom(elbowR.id, "hand.R", new THREE.Vector3(0.82, 1.08, 0), "#ffb04f");

  const hipL = addBoneFrom(hips.id, "upper_leg.L", new THREE.Vector3(-0.26, 0.66, 0), "#55e38d").end;
  const kneeL = addBoneFrom(hipL.id, "lower_leg.L", new THREE.Vector3(-0.28, 0.28, 0), "#55e38d").end;
  addBoneFrom(kneeL.id, "foot.L", new THREE.Vector3(-0.28, 0.04, 0.22), "#55e38d");

  const hipR = addBoneFrom(hips.id, "upper_leg.R", new THREE.Vector3(0.26, 0.66, 0), "#ffc84a").end;
  const kneeR = addBoneFrom(hipR.id, "lower_leg.R", new THREE.Vector3(0.28, 0.28, 0), "#ffc84a").end;
  addBoneFrom(kneeR.id, "foot.R", new THREE.Vector3(0.28, 0.04, -0.22), "#ffc84a");

  selectJoint(hips.id);
  syncSkeletonMeshes();
}

function addJoint(name, position, color = "#4fc3ff") {
  const joint = {
    id: `j${state.nextJoint++}`,
    name,
    position: position.clone(),
    basePosition: position.clone(),
    orientation: new THREE.Quaternion(),
    color,
  };
  state.joints.push(joint);
  return joint;
}

function addBoneFrom(parentJointId, name, endPosition, color = "#4fc3ff") {
  const parent = getJoint(parentJointId);
  const end = addJoint(name, endPosition, color);
  const bone = {
    id: `b${state.nextBone++}`,
    name,
    start: parent.id,
    end: end.id,
    color,
  };
  state.bones.push(bone);
  end.orientation.copy(boneDirectionQuaternion(bone));
  syncSkeletonMeshes();
  return { bone, end };
}

function syncSkeletonMeshes() {
  const activeJointIds = new Set(state.joints.map((joint) => joint.id));
  const activeBoneIds = new Set(state.bones.map((bone) => bone.id));

  for (const [id, mesh] of jointMeshes) {
    if (!activeJointIds.has(id)) {
      boneRoot.remove(mesh);
      jointMeshes.delete(id);
    }
  }

  for (const [id, group] of boneMeshes) {
    if (!activeBoneIds.has(id)) {
      boneRoot.remove(group);
      boneMeshes.delete(id);
    }
  }

  state.bones.forEach((bone) => {
    const start = getJoint(bone.start);
    const end = getJoint(bone.end);
    if (!start || !end) {
      return;
    }
    let group = boneMeshes.get(bone.id);
    if (!group) {
      group = new THREE.Group();
      group.userData.boneId = bone.id;
      const body = new THREE.Mesh(
        createEmbeddedBoneGeometry(0.043),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(bone.color), roughness: 0.48, metalness: 0.1, transparent: true, opacity: state.boneOpacity * 0.9, depthWrite: false }),
      );
      body.name = "boneEmbeddedBody";
      const startCollar = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.024, 0.052),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(bone.color), roughness: 0.42, metalness: 0.12, transparent: true, opacity: state.boneOpacity, depthWrite: false }),
      );
      startCollar.name = "boneStartCollar";
      startCollar.position.y = -0.47;
      const endPlug = new THREE.Mesh(
        new THREE.BoxGeometry(0.066, 0.04, 0.066),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(bone.color), roughness: 0.38, metalness: 0.12, transparent: true, opacity: state.boneOpacity, depthWrite: false }),
      );
      endPlug.name = "boneEndPlug";
      endPlug.position.y = 0.49;
      const glow = new THREE.LineSegments(
        new THREE.EdgesGeometry(createEmbeddedBoneGeometry(0.055)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: state.boneOpacity * 0.16, depthWrite: false }),
      );
      glow.name = "boneGlow";
      const hit = new THREE.Mesh(
        createEmbeddedBoneGeometry(0.09),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false }),
      );
      hit.name = "boneHitArea";
      group.add(body, startCollar, endPlug, glow, hit);
      boneRoot.add(group);
      boneMeshes.set(bone.id, group);
    }
    const selected = state.selectionKind === "bone" && bone.id === state.selectedBoneId;
    group.children.forEach((child) => {
      if (child.material?.color) {
        child.material.color.set(bone.color);
      }
      if (child.material?.emissive) {
        child.material.emissive = new THREE.Color(selected ? bone.color : 0x000000);
        child.material.emissiveIntensity = selected ? 0.22 : 0;
      }
      if (child.name === "boneEmbeddedBody") {
        child.material.opacity = state.boneOpacity * (selected ? 1 : 0.86);
        child.material.transparent = child.material.opacity < 1;
        child.material.depthWrite = false;
      }
      if (child.name === "boneStartCollar" || child.name === "boneEndPlug") {
        child.material.opacity = state.boneOpacity * (selected ? 1 : 0.92);
        child.material.transparent = child.material.opacity < 1;
        child.material.depthWrite = false;
      }
      if (child.name === "boneGlow") {
        child.material.opacity = state.boneOpacity * (selected ? 0.62 : 0.16);
      }
    });
    alignBoneGroup(group, start.position, end.position);
    applyBoneDisplayScale(group);
  });

  state.joints.forEach((joint) => {
    let group = jointMeshes.get(joint.id);
    if (!group) {
      group = createJointControl(joint);
      boneRoot.add(group);
      jointMeshes.set(joint.id, group);
    }
    updateJointControl(group, joint);
  });

  updateCenterLine();
  updateSelectionPanel();
  renderWeightBoneSelect();
  syncTransformTargetToSelection();
}

function createJointControl(joint) {
  const group = new THREE.Group();
  group.userData.jointId = joint.id;

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.074, 0.074, 0.074),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(joint.color), roughness: 0.38, metalness: 0.08, transparent: true, opacity: state.boneOpacity, depthWrite: false }),
  );
  box.name = "jointBox";
  box.userData.jointId = joint.id;

  const socket = new THREE.Mesh(
    new THREE.BoxGeometry(0.058, 0.018, 0.058),
    new THREE.MeshStandardMaterial({ color: 0x06131d, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.82 }),
  );
  socket.name = "jointEmbeddedSocket";
  socket.position.y = -0.066;
  socket.userData.jointId = joint.id;

  const arrowShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.125, 8),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(joint.color), roughness: 0.42, metalness: 0.08, transparent: true, opacity: state.boneOpacity, depthWrite: false }),
  );
  arrowShaft.name = "jointRotateArrowShaft";
  arrowShaft.rotation.z = -Math.PI / 2;
  arrowShaft.position.set(0.072, 0.009, 0);
  arrowShaft.userData.jointId = joint.id;

  const arrowHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.026, 0.052, 12),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(joint.color), roughness: 0.42, metalness: 0.08, transparent: true, opacity: state.boneOpacity, depthWrite: false }),
  );
  arrowHead.name = "jointRotateArrowHead";
  arrowHead.rotation.z = -Math.PI / 2;
  arrowHead.position.set(0.152, 0.009, 0);
  arrowHead.userData.jointId = joint.id;

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.095, 0.095, 0.095)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: state.boneOpacity * 0.25, depthWrite: false }),
  );
  outline.name = "jointOutline";
  outline.userData.jointId = joint.id;

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.15),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false }),
  );
  hit.name = "jointHitArea";
  hit.userData.jointId = joint.id;

  group.add(box, socket, arrowShaft, arrowHead, outline, hit);
  return group;
}

function updateJointControl(group, joint) {
  const selected = joint.id === state.selectedJointId;
  group.position.copy(joint.position);
  group.quaternion.copy(getJointOrientation(joint));
  group.scale.setScalar(state.jointSize * (selected ? 1.14 : 1));

  group.traverse((child) => {
    if (!child.material) {
      return;
    }
    if (child.name === "jointOutline") {
      child.material.opacity = state.boneOpacity * (selected ? 0.95 : 0.25);
      child.material.color.set(selected ? 0xffffff : 0xb9c7d8);
      return;
    }
    if (child.name === "jointEmbeddedSocket") {
      child.material.opacity = state.boneOpacity * (selected ? 0.82 : 0.58);
      return;
    }
    if (child.name === "jointHitArea") {
      child.material.opacity = 0;
      return;
    }
    if (child.material.color) {
      child.material.color.set(joint.color);
    }
    if (child.material.opacity !== undefined) {
      child.material.opacity = state.boneOpacity * (selected ? 1 : 0.9);
      child.material.transparent = child.material.opacity < 1;
      child.material.depthWrite = false;
    }
    if (child.material.emissive) {
      child.material.emissive = new THREE.Color(selected ? joint.color : 0x000000);
      child.material.emissiveIntensity = selected ? 0.25 : 0;
    }
  });
}

function createEmbeddedBoneGeometry(radius = 0.082) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    0, -0.52, 0,
    radius, -0.04, 0,
    0, -0.04, radius,
    -radius, -0.04, 0,
    0, -0.04, -radius,
    0, 0.52, 0,
  ]);
  const indices = [
    0, 1, 2,
    0, 2, 3,
    0, 3, 4,
    0, 4, 1,
    5, 2, 1,
    5, 3, 2,
    5, 4, 3,
    5, 1, 4,
  ];
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function getJointOrientation(joint) {
  if (!joint.orientation) {
    joint.orientation = new THREE.Quaternion();
  }
  return joint.orientation;
}

function getJointDirection(joint) {
  const childBone = state.bones.find((bone) => bone.start === joint.id);
  if (childBone) {
    const child = getJoint(childBone.end);
    if (child) {
      const direction = child.position.clone().sub(joint.position);
      if (direction.lengthSq() > 0.000001) {
        return direction.normalize();
      }
    }
  }

  const parentBone = state.bones.find((bone) => bone.end === joint.id);
  if (parentBone) {
    const parent = getJoint(parentBone.start);
    if (parent) {
      const direction = joint.position.clone().sub(parent.position);
      if (direction.lengthSq() > 0.000001) {
        return direction.normalize();
      }
    }
  }

  return new THREE.Vector3(0, 1, 0);
}

function alignBoneGroup(group, start, end) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(delta.length(), 0.0001);
  group.position.copy(start).addScaledVector(delta, 0.5);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  group.scale.set(1, length, 1);
}

function applyBoneDisplayScale(group) {
  const thickness = THREE.MathUtils.clamp(state.boneThickness, 0.25, 3);
  group.scale.x = thickness;
  group.scale.z = thickness;
}

function selectJoint(jointId) {
  state.selectedJointId = jointId;
  const incoming = state.bones.find((bone) => bone.end === jointId);
  state.selectedBoneId = incoming?.id || null;
  state.selectionKind = "joint";
  syncSkeletonMeshes();
  renderWeightBoneSelect();
  updateWeightModeDisplay();
}

function selectBone(boneId) {
  const bone = getBone(boneId);
  if (!bone) {
    return;
  }
  state.selectedBoneId = bone.id;
  state.selectedJointId = bone.end;
  state.selectionKind = "bone";
  syncSkeletonMeshes();
  renderWeightBoneSelect();
  updateWeightModeDisplay();
}

function getJoint(id) {
  return state.joints.find((joint) => joint.id === id);
}

function getBone(id) {
  return state.bones.find((bone) => bone.id === id);
}

function getSelectedJoint() {
  return getJoint(state.selectedJointId);
}

function getSelectedBone() {
  return getBone(state.selectedBoneId);
}

function updateSelectionPanel() {
  const joint = getSelectedJoint();
  const bone = getSelectedBone();
  const activeIsJoint = state.selectionKind === "joint";
  const label = activeIsJoint ? joint?.name || "无" : bone?.name || joint?.name || "无";
  el.hudBoneName.textContent = label;
  el.boneNameInput.value = label;
  el.boneColorInput.value = activeIsJoint ? joint?.color || "#4fc3ff" : bone?.color || joint?.color || "#4fc3ff";

  if (bone) {
    const start = getJoint(bone.start);
    const end = getJoint(bone.end);
    const parentBone = state.bones.find((item) => item.end === bone.start);
    el.boneLengthValue.textContent = `${start.position.distanceTo(end.position).toFixed(2)}m`;
    el.parentBoneValue.textContent = parentBone?.name || getJoint(bone.start)?.name || "无";
  } else {
    el.boneLengthValue.textContent = "0.00m";
    el.parentBoneValue.textContent = "无";
  }
}

function renderWeightBoneSelect() {
  if (!el.weightBoneSelect) {
    return;
  }
  const previousValue = el.weightBoneSelect.value;
  el.weightBoneSelect.innerHTML = "";
  if (state.bones.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "暂无骨骼";
    el.weightBoneSelect.appendChild(option);
    return;
  }

  state.bones.forEach((bone) => {
    const option = document.createElement("option");
    option.value = bone.id;
    option.textContent = bone.name;
    el.weightBoneSelect.appendChild(option);
  });

  const representedSourceBones = new Set(state.bones.map((bone) => bone.sourceBone?.uuid).filter(Boolean));
  state.joints.forEach((joint) => {
    if (!joint.sourceBone || representedSourceBones.has(joint.sourceBone.uuid)) {
      return;
    }
    const option = document.createElement("option");
    option.value = `joint:${joint.id}`;
    option.textContent = `${joint.name}（末端权重）`;
    el.weightBoneSelect.appendChild(option);
  });

  const currentSelectionValue = getWeightPanelSelectionValue();
  const hasPrevious = [...el.weightBoneSelect.options].some((option) => option.value === previousValue);
  const nextValue = currentSelectionValue || (hasPrevious ? previousValue : el.weightBoneSelect.options[0]?.value || "");
  el.weightBoneSelect.value = nextValue;
}

function getWeightPanelSelectionValue() {
  const selectedJoint = getSelectedJoint();
  const selectedBone = getSelectedBone();
  if (state.selectionKind === "bone" && selectedBone) {
    return selectedBone.id;
  }
  if (!selectedJoint) {
    return selectedBone?.id || "";
  }
  const outgoing = getWeightOutgoingBoneForJoint(selectedJoint.id);
  if (outgoing) {
    return outgoing.id;
  }
  if (selectedJoint.sourceBone) {
    return `joint:${selectedJoint.id}`;
  }
  return selectedBone?.id || "";
}

function getWeightOutgoingBoneForJoint(jointId) {
  return state.bones.find((bone) => bone.start === jointId && bone.sourceBone)
    || state.bones.find((bone) => bone.start === jointId)
    || null;
}

function setMode(mode) {
  state.mode = mode;
  if (mode === "paint") {
    state.weightToolMode = "select";
  }
  cancelTransientTools();
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  updateWeightToolButtons();
  const text = {
    build: "骨架编辑模式：拖动关节生成/调整骨架结构",
    pose: "姿势调整模式：拖动骨骼旋转，模型会跟随真实蒙皮骨骼",
    paint: "权重笔刷模式：在半透明模型上涂抹权重颜色",
    motion: "动作模板模式：生成走路关键帧并预览过渡",
  }[mode];
  setStatus(text);
  updateWeightPointVisibility();
  updateWeightModeDisplay();
  syncTransformTargetToSelection();
}

function setStatus(text) {
  el.statusLine.textContent = text;
}

function setWeightToolMode(mode) {
  state.weightToolMode = mode === "brush" ? "brush" : "select";
  updateWeightToolButtons();
  updateWeightModeDisplay();
  setStatus(state.weightToolMode === "brush"
    ? `权重涂刷：正在调整 ${getSelectedBone()?.name || "当前骨骼"}`
    : "权重选择：点击骨骼或在右侧下拉选择目标骨骼");
}

function updateWeightToolButtons() {
  document.querySelectorAll(".weight-tool").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.weightTool === state.weightToolMode);
  });
}

function setTransformMode(mode) {
  state.transformMode = mode;
  transformControls.setMode(mode);
  applyTransformControlOpacity();
  updateTransformButtons();
  syncTransformTargetToSelection();
  const names = { translate: "移动 G", rotate: "旋转 R", scale: "缩放 S" };
  setStatus(`Blender 风格工具：${names[mode]}，${state.transformSpace === "local" ? "局部坐标" : "世界坐标"}`);
}

function toggleTransformSpace() {
  state.transformSpace = state.transformSpace === "local" ? "world" : "local";
  transformControls.setSpace(state.transformSpace);
  applyTransformControlOpacity();
  updateTransformButtons();
  syncTransformTargetToSelection();
  setStatus(`坐标空间：${state.transformSpace === "local" ? "局部" : "世界"}`);
}

function updateTransformButtons() {
  const buttons = [
    el.transformTranslateButton,
    el.transformRotateButton,
    el.transformScaleButton,
  ];
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.transform === state.transformMode);
  });
  el.transformSpaceButton.textContent = state.transformSpace === "local" ? "局部" : "世界";
  el.transformSpaceButton.classList.toggle("is-active", state.transformSpace === "local");
}

function onKeyDown(event) {
  const target = event.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    return;
  }

  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    undoLastAction();
    return;
  }

  if (state.modalTransform) {
    handleModalKeyDown(event);
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    setMode(state.mode === "build" ? "pose" : "build");
    return;
  }

  if (key === "g") {
    startModalTransform("translate", event);
  } else if (key === "r") {
    startModalTransform("rotate", event);
  } else if (key === "s") {
    startModalTransform("scale", event);
  } else if (["x", "y", "z"].includes(key)) {
    state.poseAxisLock = state.poseAxisLock === key ? null : key;
    setTransformAxisVisibility(state.poseAxisLock);
    setStatus(state.poseAxisLock ? `姿势旋转轴锁定：${state.poseAxisLock.toUpperCase()}` : "已取消姿势旋转轴锁定");
  } else if (event.key === "Escape") {
    state.poseAxisLock = null;
    setTransformAxisVisibility(null);
    cancelTransientTools();
    setStatus("已取消当前临时操作");
  }
}

function setTransformAxisVisibility(axis) {
  transformControls.showX = !axis || axis === "x";
  transformControls.showY = !axis || axis === "y";
  transformControls.showZ = !axis || axis === "z";
}

function handleModalKeyDown(event) {
  const key = event.key.toLowerCase();
  if (event.key === "Enter") {
    event.preventDefault();
    confirmModalTransform();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    cancelModalTransform();
    return;
  }
  if (["x", "y", "z"].includes(key)) {
    event.preventDefault();
    state.poseAxisLock = state.poseAxisLock === key ? null : key;
    setTransformAxisVisibility(state.poseAxisLock);
    updateModalTransformFromPointer(state.lastPointer.x, state.lastPointer.y);
    setStatus(state.poseAxisLock ? `Modal ${state.transformMode}：锁定 ${state.poseAxisLock.toUpperCase()} 轴，左键/Enter 确认，右键/Esc 取消` : "Modal transform：已取消轴锁定");
    return;
  }
  if (key === "g" || key === "r" || key === "s") {
    event.preventDefault();
    const mode = key === "g" ? "translate" : key === "r" ? "rotate" : "scale";
    startModalTransform(mode, event);
  }
}

function cancelTransientTools() {
  state.isExtending = false;
  state.pendingExtendJointId = null;
  state.isPosingBone = false;
  state.poseBoneId = null;
  state.poseInitialQuaternion = null;
  state.poseInitialPositions = null;
  state.selectedSourceJointId = null;
  state.orbiting = false;
  state.panning = false;
  if (state.modalTransform) {
    cancelModalTransform();
  }
  removePreviewLine();
}

function onPointerDown(event) {
  if (state.modalTransform) {
    event.preventDefault();
    if (event.button === 2) {
      cancelModalTransform();
    } else if (event.button === 0) {
      confirmModalTransform();
    } else if (state.mode === "paint") {
      setStatus(`权重目标骨骼：${getSelectedBone()?.name || "当前关节"}。切到“涂刷权重”后开始刷。`);
    }
    return;
  }

  updatePointer(event);
  rememberPointer(event);
  state.dragStart.set(event.clientX, event.clientY);

  if (isViewPanButton(event)) {
    event.preventDefault();
    captureCanvasPointer(event);
    state.panning = true;
    setStatus("视图平移：Shift+中键 / Shift+右键拖动，滚轮缩放");
    return;
  }

  if (isViewOrbitButton(event)) {
    event.preventDefault();
    captureCanvasPointer(event);
    state.orbiting = true;
    setStatus("视图旋转：中键 / 右键 / Alt+左键拖动，Shift+中键平移");
    return;
  }

  if (event.button !== 0) {
    return;
  }

  if (state.mode !== "paint" && isTransformInteractionHit(event)) {
    return;
  }

  const hitJoint = pickJoint(event);
  const hitBone = hitJoint ? null : pickBone(event);

  if (state.mode === "paint" && state.weightToolMode === "brush") {
    event.preventDefault();
    event.stopImmediatePropagation();
    captureCanvasPointer(event);
    state.painting = true;
    paintAtPointer(event);
    return;
  }

  if (hitJoint) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectJoint(hitJoint.userData.jointId);
    if (state.mode === "build") {
      captureCanvasPointer(event);
      state.pendingExtendJointId = hitJoint.userData.jointId;
      state.selectedSourceJointId = hitJoint.userData.jointId;
      setStatus("已选中关节。按住左键拖出一段距离后生成子骨骼，G/R/S 可直接变换。");
    } else if (state.mode === "pose") {
      setStatus("已选中骨骼控制点。使用 G/R/S 或视图中的变换手柄操作。");
    } else if (state.mode === "paint") {
      setStatus(`权重目标骨骼：${getSelectedBone()?.name || "当前骨骼"}。切到“涂刷权重”后开始刷。`);
    }
    return;
  }

  if (hitBone) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectBone(hitBone.userData.boneId);
    if (state.mode === "paint") {
      setStatus(`权重目标骨骼：${getSelectedBone()?.name || "当前骨骼"}。切到“涂刷权重”后开始刷。`);
      return;
    }
    if (state.mode === "pose") {
      setStatus("已选中骨骼。使用 G/R/S 或视图中的移动箭头、旋转环、缩放手柄操作。");
    }
    return;
  }
}

function onPointerMove(event) {
  if (state.modalTransform) {
    rememberPointer(event);
    updateModalTransformFromPointer(event.clientX, event.clientY);
    return;
  }

  if (!canvas.hasPointerCapture?.(event.pointerId) && event.buttons === 0) {
    rememberPointer(event);
    if (state.mode === "paint" && state.weightToolMode === "brush") {
      updateBrushCursorFromPointer(event);
    }
    return;
  }

  if (state.painting) {
    rememberPointer(event);
    paintAtPointer(event);
    return;
  }

  if (state.pendingExtendJointId) {
    const dragDistance = Math.hypot(event.clientX - state.dragStart.x, event.clientY - state.dragStart.y);
    if (dragDistance > 7) {
      state.isExtending = true;
      state.selectedSourceJointId = state.pendingExtendJointId;
      state.pendingExtendJointId = null;
      const source = getJoint(state.selectedSourceJointId);
      if (source) {
        createPreviewLine(source.position, source.position);
      }
    } else {
      return;
    }
  }

  if (state.isExtending) {
    const source = getJoint(state.selectedSourceJointId);
    if (source && pointerToRigPlane(event, dragPoint)) {
      dragPoint.y = Math.max(0.03, dragPoint.y);
      createPreviewLine(source.position, dragPoint);
    }
    return;
  }

  if (state.isPosingBone) {
    updatePoseDrag(event);
    return;
  }

  if (state.orbiting) {
    const dx = event.clientX - state.lastPointer.x;
    const dy = event.clientY - state.lastPointer.y;
    yaw -= dx * 0.006;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -1.35, 1.35);
    updateCamera();
  } else if (state.panning) {
    const dx = event.clientX - state.lastPointer.x;
    const dy = event.clientY - state.lastPointer.y;
    panCameraByScreenDelta(dx, dy);
    updateCamera();
  }
  state.lastPointer.set(event.clientX, event.clientY);
}

function onPointerUp(event) {
  releaseCanvasPointer(event);

  if (state.pendingExtendJointId) {
    state.pendingExtendJointId = null;
    state.selectedSourceJointId = null;
    return;
  }

  if (state.painting) {
    state.painting = false;
    updateBrushCursorFromPointer(event);
    return;
  }

  if (state.isExtending) {
    const source = getJoint(state.selectedSourceJointId);
    if (source && pointerToRigPlane(event, dragPoint)) {
      const distance = source.position.distanceTo(dragPoint);
      if (distance > 0.12) {
        pushUndo("生成子骨骼");
        const name = autoChildName(source.name);
        const color = getSelectedJoint()?.color || "#4fc3ff";
        const result = addBoneFrom(source.id, name, dragPoint.clone(), color);
        selectJoint(result.end.id);
        setStatus(`已生成子骨骼：${name}`);
      }
    }
    state.isExtending = false;
    state.pendingExtendJointId = null;
    state.selectedSourceJointId = null;
    removePreviewLine();
  }

  state.isPosingBone = false;
  state.poseBoneId = null;
  state.poseInitialQuaternion = null;
  state.poseInitialPositions = null;
  state.orbiting = false;
  state.panning = false;
}

function onWheel(event) {
  event.preventDefault();
  const step = event.shiftKey ? 0.16 : 0.32;
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + Math.sign(event.deltaY) * step, 0.85, 14);
  updateCamera();
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function rememberPointer(event) {
  if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) {
    return;
  }
  state.lastPointer.set(event.clientX, event.clientY);
  state.hasPointerPosition = true;
}

function isViewOrbitButton(event) {
  return !event.shiftKey && (event.button === 1 || event.button === 2 || (event.altKey && event.button === 0));
}

function isViewPanButton(event) {
  return event.shiftKey && (event.button === 1 || event.button === 2 || (event.altKey && event.button === 0));
}

function captureCanvasPointer(event) {
  if (typeof canvas.setPointerCapture === "function") {
    canvas.setPointerCapture(event.pointerId);
  }
}

function releaseCanvasPointer(event) {
  if (typeof canvas.hasPointerCapture === "function" && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function isTransformHandleHit(event) {
  if (!transformControls.visible || !transformControls.object) {
    return false;
  }
  updatePointer(event);
  const controlRaycaster = transformControls.getRaycaster();
  controlRaycaster.setFromCamera(pointer, camera);
  const picker = transformControls._gizmo?.picker?.[transformControls.mode];
  if (!picker) {
    return Boolean(transformControls.axis || transformControls.dragging);
  }
  return controlRaycaster.intersectObjects(picker.children, true).length > 0;
}

function isTransformInteractionHit(event) {
  return Boolean(transformControls.axis || transformControls.dragging || isTransformHandleHit(event));
}

function getPointerPriorityAt(clientX, clientY) {
  const event = { clientX, clientY, button: 0 };
  const rawJointHit = Boolean(pickJoint(event));
  const rawBoneHit = !rawJointHit && Boolean(pickBone(event));
  const transformHit = state.mode !== "paint" && isTransformInteractionHit(event);
  if (transformHit) {
    return {
      priority: "transform",
      transformHit: true,
      jointHit: rawJointHit,
      boneHit: rawBoneHit,
    };
  }
  return {
    priority: rawJointHit ? "joint" : rawBoneHit ? "bone" : "empty",
    transformHit: false,
    jointHit: rawJointHit,
    boneHit: rawBoneHit,
  };
}

function findTransformHandlePrioritySample() {
  setTransformMode("rotate");
  syncTransformTargetToSelection();
  if (!transformControls.visible || !transformControls.object) {
    return null;
  }
  const pivot = projectWorldToScreen(transformTarget.position);
  const radii = [18, 24, 32, 42, 54, 68, 84, 104, 128, 156, 190, 230];
  let firstTransform = null;
  let firstOverlap = null;
  for (const radius of radii) {
    for (let step = 0; step < 64; step += 1) {
      const angle = (Math.PI * 2 * step) / 64;
      const x = pivot.x + Math.cos(angle) * radius;
      const y = pivot.y + Math.sin(angle) * radius;
      const sample = getPointerPriorityAt(x, y);
      if (sample.transformHit && !firstTransform) {
        firstTransform = { ...sample, x, y, radius, angle };
      }
      if (sample.transformHit && (sample.jointHit || sample.boneHit) && !firstOverlap) {
        firstOverlap = { ...sample, x, y, radius, angle };
      }
    }
  }
  return firstOverlap || firstTransform;
}

function pickJoint(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const jointObjects = [];
  jointMeshes.forEach((group) => {
    group.traverse((child) => {
      if (child.isMesh) {
        jointObjects.push(child);
      }
    });
  });
  const hits = raycaster.intersectObjects(jointObjects, false);
  return hits[0]?.object || null;
}

function pickBone(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const meshes = [];
  boneMeshes.forEach((group, boneId) => {
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.boneId = boneId;
        meshes.push(child);
      }
    });
  });
  const hits = raycaster.intersectObjects(meshes, false);
  return hits[0]?.object || null;
}

function pointerToRigPlane(event, target) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(dragPlane, target);
}

function createPreviewLine(start, end) {
  if (!previewLine) {
    previewLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    );
    boneRoot.add(previewLine);
  }
  previewLine.geometry.dispose();
  previewLine.geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
}

function removePreviewLine() {
  if (!previewLine) {
    return;
  }
  boneRoot.remove(previewLine);
  previewLine.geometry.dispose();
  previewLine.material.dispose();
  previewLine = null;
}

function createUndoSnapshot(label) {
  const sourceBoneTransforms = [];
  const seenSourceBones = new Set();
  const rememberSourceBone = (sourceBone) => {
    if (!sourceBone || seenSourceBones.has(sourceBone.uuid)) {
      return;
    }
    seenSourceBones.add(sourceBone.uuid);
    sourceBoneTransforms.push({
      sourceBone,
      position: sourceBone.position.clone(),
      quaternion: sourceBone.quaternion.clone(),
      scale: sourceBone.scale.clone(),
    });
  };

  state.joints.forEach((joint) => rememberSourceBone(joint.sourceBone));
  state.bones.forEach((bone) => {
    rememberSourceBone(bone.sourceBone);
    rememberSourceBone(bone.sourceChildBone);
  });

  return {
    label,
    mode: state.mode,
    paintMode: state.paintMode,
    mirrorAxis: state.mirrorAxis,
    walkDirection: state.walkDirection,
    joints: state.joints.map((joint) => ({
      id: joint.id,
      name: joint.name,
      position: joint.position.clone(),
      basePosition: joint.basePosition.clone(),
      orientation: getJointOrientation(joint).clone(),
      color: joint.color,
      sourceBone: joint.sourceBone || null,
    })),
    bones: state.bones.map((bone) => ({
      id: bone.id,
      name: bone.name,
      start: bone.start,
      end: bone.end,
      color: bone.color,
      sourceBone: bone.sourceBone || null,
      sourceChildBone: bone.sourceChildBone || null,
    })),
    keyframes: structuredClone(state.keyframes),
    currentFrame: state.currentFrame,
    selectedJointId: state.selectedJointId,
    selectedBoneId: state.selectedBoneId,
    selectionKind: state.selectionKind,
    nextJoint: state.nextJoint,
    nextBone: state.nextBone,
    sourceBoneTransforms,
  };
}

function pushUndo(label) {
  state.undoStack.push(createUndoSnapshot(label));
  if (state.undoStack.length > 60) {
    state.undoStack.shift();
  }
}

function commitTransformUndo(label) {
  if (!state.transformChanged || !state.transformStart?.undoSnapshot) {
    return;
  }
  state.undoStack.push({ ...state.transformStart.undoSnapshot, label });
  if (state.undoStack.length > 60) {
    state.undoStack.shift();
  }
}

function undoLastAction() {
  if (state.modalTransform) {
    cancelModalTransform();
    return;
  }
  const snapshot = state.undoStack.pop();
  if (!snapshot) {
    setStatus("没有可撤销的操作");
    return;
  }

  snapshot.sourceBoneTransforms.forEach((item) => {
    item.sourceBone.position.copy(item.position);
    item.sourceBone.quaternion.copy(item.quaternion);
    item.sourceBone.scale.copy(item.scale);
  });
  loadedModel?.updateWorldMatrix(true, true);

  state.mode = snapshot.mode;
  state.paintMode = snapshot.paintMode;
  state.mirrorAxis = snapshot.mirrorAxis || "characterRight";
  state.walkDirection = snapshot.walkDirection || "auto";
  state.joints = snapshot.joints.map((joint) => ({
    id: joint.id,
    name: joint.name,
    position: joint.position.clone(),
    basePosition: joint.basePosition.clone(),
    orientation: joint.orientation.clone(),
    color: joint.color,
    sourceBone: joint.sourceBone || undefined,
  }));
  state.bones = snapshot.bones.map((bone) => ({
    id: bone.id,
    name: bone.name,
    start: bone.start,
    end: bone.end,
    color: bone.color,
    sourceBone: bone.sourceBone || undefined,
    sourceChildBone: bone.sourceChildBone || undefined,
  }));
  state.keyframes = structuredClone(snapshot.keyframes);
  state.currentFrame = snapshot.currentFrame;
  state.selectedJointId = snapshot.selectedJointId;
  state.selectedBoneId = snapshot.selectedBoneId;
  state.selectionKind = snapshot.selectionKind;
  state.nextJoint = snapshot.nextJoint;
  state.nextBone = snapshot.nextBone;
  state.isExtending = false;
  state.pendingExtendJointId = null;
  state.isPosingBone = false;
  state.poseBoneId = null;
  state.transformStart = null;
  state.transformChanged = false;
  if (el.mirrorAxisSelect) {
    el.mirrorAxisSelect.value = state.mirrorAxis;
  }
  if (el.walkDirectionSelect) {
    el.walkDirectionSelect.value = state.walkDirection;
  }
  removePreviewLine();
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });
  syncSkeletonMeshes();
  renderTimeline();
  setStatus(`已撤销：${snapshot.label}`);
}

function toggleModelTransparency() {
  state.modelOpacity = state.modelOpacity > 0.45 ? 0.28 : 0.58;
  const input = document.querySelector("#modelOpacityInput");
  const value = document.querySelector("#modelOpacityValue");
  if (input && value) {
    input.value = String(state.modelOpacity);
    value.textContent = state.modelOpacity.toFixed(2);
  }
  applyModelOpacity();
}

function applyModelOpacity() {
  const opacity = THREE.MathUtils.clamp(state.modelOpacity, 0.02, 1);
  ghostModelVisible = opacity > 0.08;
  if (loadedModel) {
    if (state.mode === "paint") {
      updateWeightModeDisplay();
      setStatus(`权重预览模式，模型透明度由权重视图接管`);
      return;
    }
    restoreImportedModelMaterials();
    loadedModel.traverse((node) => {
      if (!node.isMesh) {
        return;
      }
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.depthWrite = opacity >= 0.95;
      });
    });
    setStatus(`人物透明度：${opacity.toFixed(2)}`);
    return;
  }
  ghostRoot.visible = ghostModelVisible;
  ghostRoot.traverse((node) => {
    if (!node.material) {
      return;
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      material.transparent = opacity < 1;
      material.opacity = opacity * 0.7;
      material.depthWrite = false;
    });
  });
  setStatus(`人物透明度：${opacity.toFixed(2)}`);
}

function applyTransformControlOpacity() {
  const opacityScale = THREE.MathUtils.clamp(state.boneOpacity, 0.05, 1);
  const gizmo = transformControls._gizmo;
  if (!gizmo) {
    return;
  }

  const applyMaterial = (material) => {
    if (!material) {
      return;
    }
    if (Array.isArray(material)) {
      material.forEach(applyMaterial);
      return;
    }
    if (material.userData.controlBaseOpacity === undefined) {
      material.userData.controlBaseOpacity = material._opacity ?? material.opacity ?? 1;
    }
    const nextOpacity = material.userData.controlBaseOpacity * opacityScale;
    material.transparent = true;
    material.depthWrite = false;
    material._opacity = nextOpacity;
    material.opacity = nextOpacity;
  };

  ["translate", "rotate", "scale"].forEach((mode) => {
    gizmo.gizmo?.[mode]?.traverse((node) => applyMaterial(node.material));
    gizmo.helper?.[mode]?.traverse((node) => applyMaterial(node.material));
  });
}

function syncTransformTargetToSelection() {
  if (state.syncingTransformTarget || state.isTransformDragging) {
    return;
  }

  const pivot = getTransformPivot();
  if (!pivot) {
    transformControls.detach();
    transformControls.visible = false;
    return;
  }

  state.syncingTransformTarget = true;
  transformTarget.position.copy(pivot.position);
  transformTarget.quaternion.copy(pivot.quaternion);
  transformTarget.scale.set(1, 1, 1);
  transformTarget.updateMatrixWorld(true);
  transformControls.setMode(state.transformMode);
  transformControls.setSpace(state.transformSpace);
  transformControls.attach(transformTarget);
  transformControls.visible = true;
  applyTransformControlOpacity();
  state.syncingTransformTarget = false;
}

function getTransformPivot() {
  const bone = getSelectedBone();
  const joint = getSelectedJoint();
  const result = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };

  if (state.selectionKind === "bone" && bone) {
    const start = getJoint(bone.start);
    if (!start) {
      return null;
    }
    result.position.copy(start.position);
    const sourceBone = getPoseSourceBone(bone);
    if (sourceBone) {
      sourceBone.getWorldQuaternion(result.quaternion);
    } else {
      result.quaternion.copy(boneDirectionQuaternion(bone));
    }
    return result;
  }

  if (joint) {
    result.position.copy(joint.position);
    if (joint.sourceBone) {
      joint.sourceBone.getWorldQuaternion(result.quaternion);
    }
    return result;
  }

  return null;
}

function boneDirectionQuaternion(bone) {
  const start = getJoint(bone.start);
  const end = getJoint(bone.end);
  const direction = start && end
    ? end.position.clone().sub(start.position).normalize()
    : new THREE.Vector3(0, 1, 0);
  if (direction.lengthSq() < 0.000001) {
    direction.set(0, 1, 0);
  }
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
}

function beginGizmoTransform() {
  const bone = getSelectedBone();
  const joint = getSelectedJoint();
  const sourceBone = state.selectionKind === "bone" ? getPoseSourceBone(bone) : joint?.sourceBone || null;
  state.transformStart = {
    editorMode: state.mode,
    mode: state.transformMode,
    targetPosition: transformTarget.position.clone(),
    targetQuaternion: transformTarget.quaternion.clone(),
    targetScale: transformTarget.scale.clone(),
    jointPositions: snapshotJointPositions(),
    jointOrientations: snapshotJointOrientations(),
    sourceBoneTransforms: snapshotSourceBoneTransforms(),
    sourceWorldQuaternions: snapshotSourceBoneWorldQuaternions(),
    selectedJointId: state.selectedJointId,
    selectedBoneId: state.selectedBoneId,
    selectionKind: state.selectionKind,
    sourceBone,
    sourcePosition: sourceBone ? sourceBone.position.clone() : null,
    sourceQuaternion: sourceBone ? sourceBone.quaternion.clone() : null,
    sourceScale: sourceBone ? sourceBone.scale.clone() : null,
    undoSnapshot: createUndoSnapshot("变换骨骼/关节"),
    pivotScreen: projectWorldToScreen(transformTarget.position),
    startAngle: null,
  };
  state.transformChanged = false;
}

function applyGizmoTransform() {
  if (state.syncingTransformTarget) {
    return;
  }
  if (!state.transformStart) {
    beginGizmoTransform();
  }
  state.transformChanged = true;

  if (state.mode === "pose") {
    applyPoseGizmoTransform();
  } else {
    applyEditGizmoTransform();
  }
}

function applyPoseGizmoTransform() {
  const start = state.transformStart;
  if (!start) {
    return;
  }
  if (state.transformMode === "translate" && start.selectionKind === "joint") {
    if (shouldUseStretchPoseTranslate(start.selectedJointId)) {
      applyPoseJointDownstreamTransform(start);
      return;
    }
    applyPoseJointIkTransform(start);
    return;
  }

  const bone = getSelectedBone();
  const joint = getSelectedJoint();
  const sourceBone = state.selectionKind === "bone" ? getPoseSourceBone(bone) : joint?.sourceBone || start?.sourceBone;
  if (!sourceBone) {
    if (start.selectionKind === "joint") {
      applyEditJointBranchTransform(start);
      return;
    }
    applyEditGizmoTransform();
    return;
  }

  if (state.transformMode === "translate") {
    const worldDelta = transformTarget.position.clone().sub(start.targetPosition);
    const localDelta = worldVectorToParentLocal(sourceBone, worldDelta);
    sourceBone.position.copy(start.sourcePosition).add(localDelta);
  } else if (state.transformMode === "rotate") {
    const desiredWorldQuaternion = transformTarget.quaternion.clone();
    setBoneWorldQuaternion(sourceBone, desiredWorldQuaternion);
  } else if (state.transformMode === "scale") {
    const ratio = new THREE.Vector3(
      safeRatio(transformTarget.scale.x, start.targetScale.x),
      safeRatio(transformTarget.scale.y, start.targetScale.y),
      safeRatio(transformTarget.scale.z, start.targetScale.z),
    );
    sourceBone.scale.copy(start.sourceScale).multiply(ratio);
  }

  loadedModel?.updateWorldMatrix(true, true);
  syncEditorJointsFromSourceBones();
}

function applyEditGizmoTransform() {
  const start = state.transformStart;
  if (!start) {
    return;
  }

  if (state.transformMode === "translate") {
    const joint = getSelectedJoint();
    if (!joint) {
      return;
    }
    const original = start.jointPositions.get(joint.id) || joint.position;
    const worldDelta = transformTarget.position.clone().sub(start.targetPosition);
    joint.position.copy(original).add(worldDelta);
    syncSkeletonMeshes();
    return;
  }

  if (start.selectionKind === "joint") {
    applyEditJointBranchTransform(start);
    return;
  }

  const bone = getSelectedBone();
  if (!bone) {
    return;
  }
  const pivot = start.jointPositions.get(bone.start);
  if (!pivot) {
    return;
  }
  const rotationDelta = transformTarget.quaternion.clone().multiply(start.targetQuaternion.clone().invert());
  const scaleRatio = new THREE.Vector3(
    safeRatio(transformTarget.scale.x, start.targetScale.x),
    safeRatio(transformTarget.scale.y, start.targetScale.y),
    safeRatio(transformTarget.scale.z, start.targetScale.z),
  );
  collectBranchJoints(bone.end).forEach((joint) => {
    const original = start.jointPositions.get(joint.id);
    if (!original) {
      return;
    }
    const offset = original.clone().sub(pivot);
    if (state.transformMode === "scale") {
      offset.multiply(scaleRatio);
    } else {
      offset.applyQuaternion(rotationDelta);
      if (joint.orientation) {
        joint.orientation.premultiply(rotationDelta).normalize();
      }
    }
    joint.position.copy(pivot).add(offset);
  });
  syncSkeletonMeshes();
}

function applyEditJointBranchTransform(start) {
  const jointId = start.selectedJointId;
  const root = getJoint(jointId);
  const pivot = start.jointPositions.get(jointId);
  if (!root || !pivot) {
    return;
  }

  const branchIds = new Set(collectBranchJoints(jointId).map((joint) => joint.id));
  const rotationDelta = transformTarget.quaternion.clone().multiply(start.targetQuaternion.clone().invert());
  const scaleRatio = new THREE.Vector3(
    safeRatio(transformTarget.scale.x, start.targetScale.x),
    safeRatio(transformTarget.scale.y, start.targetScale.y),
    safeRatio(transformTarget.scale.z, start.targetScale.z),
  );

  state.joints.forEach((joint) => {
    if (!branchIds.has(joint.id)) {
      return;
    }
    const original = start.jointPositions.get(joint.id);
    if (!original) {
      return;
    }
    if (joint.id === jointId) {
      joint.position.copy(original);
    } else {
      const offset = original.clone().sub(pivot);
      if (state.transformMode === "rotate") {
        offset.applyQuaternion(rotationDelta);
      } else if (state.transformMode === "scale") {
        offset.multiply(scaleRatio);
      }
      joint.position.copy(pivot).add(offset);
    }

    const originalOrientation = start.jointOrientations.get(joint.id);
    if (originalOrientation && state.transformMode === "rotate") {
      getJointOrientation(joint).copy(rotationDelta.clone().multiply(originalOrientation));
    }
  });

  syncSkeletonMeshes();
}

function shouldUseDownstreamPoseTranslate(jointId) {
  if (!jointId) {
    return false;
  }
  return state.bones.some((bone) => bone.start === jointId);
}

function shouldUseStretchPoseTranslate(jointId) {
  return Boolean(state.allowPoseStretch && shouldUseDownstreamPoseTranslate(jointId));
}

function applyPoseJointDownstreamTransform(start) {
  const jointId = start.selectedJointId;
  const joint = getJoint(jointId);
  const original = start.jointPositions.get(jointId);
  if (!joint || !original) {
    applyPoseJointIkTransform(start);
    return;
  }

  const worldDelta = transformTarget.position.clone().sub(start.targetPosition);
  const sourceBone = joint.sourceBone || start.sourceBone;
  if (applyPoseJointStretchToIncomingBone(start, jointId)) {
    return;
  }

  if (sourceBone && start.sourcePosition) {
    const localDelta = worldVectorToParentLocal(sourceBone, worldDelta);
    sourceBone.position.copy(start.sourcePosition).add(localDelta);
    loadedModel?.updateWorldMatrix(true, true);
    syncEditorJointsFromSourceBones();
    return;
  }

  const branchIds = new Set(collectBranchJoints(jointId).map((item) => item.id));
  state.joints.forEach((item) => {
    if (!branchIds.has(item.id)) {
      return;
    }
    const startPosition = start.jointPositions.get(item.id);
    if (startPosition) {
      item.position.copy(startPosition).add(worldDelta);
    }
  });
  syncSkeletonMeshes();
}

function applyPoseJointStretchToIncomingBone(start, jointId) {
  const incoming = state.bones.find((bone) => bone.end === jointId);
  const sourceBone = incoming ? getPoseSourceBone(incoming) : null;
  if (!incoming || !sourceBone || !loadedModel) {
    return false;
  }

  const beforeStart = start.jointPositions.get(incoming.start);
  const beforeEnd = start.jointPositions.get(incoming.end);
  if (!beforeStart || !beforeEnd) {
    return false;
  }

  const beforeVector = beforeEnd.clone().sub(beforeStart);
  const afterVector = transformTarget.position.clone().sub(beforeStart);
  const beforeLength = beforeVector.length();
  const afterLength = afterVector.length();
  if (beforeLength < 0.0001 || afterLength < 0.0001) {
    return false;
  }

  const initialWorldQuaternion = start.sourceWorldQuaternions.get(sourceBone.uuid);
  if (!initialWorldQuaternion) {
    return false;
  }

  const rotationDelta = new THREE.Quaternion().setFromUnitVectors(
    beforeVector.clone().normalize(),
    afterVector.clone().normalize(),
  );
  setBoneWorldQuaternion(sourceBone, initialWorldQuaternion.clone().premultiply(rotationDelta));

  const initialTransform = getStartSourceTransform(start, sourceBone);
  const ratio = THREE.MathUtils.clamp(afterLength / beforeLength, 0.05, 8);
  sourceBone.scale.copy(initialTransform?.scale || sourceBone.scale).multiplyScalar(ratio);

  loadedModel.updateWorldMatrix(true, true);
  syncEditorJointsFromSourceBones();
  return true;
}

function applyPoseJointIkTransform(start) {
  const maxSegments = shouldUseDownstreamPoseTranslate(start.selectedJointId) ? 1 : 2;
  const chain = buildIkChainToJoint(start.selectedJointId, maxSegments);
  if (!chain) {
    applyEditGizmoTransform();
    return;
  }

  const solved = solveIkChain(chain, start, transformTarget.position);
  chain.joints.forEach((joint, index) => {
    joint.position.copy(solved[index]);
  });

  const hasSourceBones = chain.bones.some((bone) => Boolean(getPoseSourceBone(bone)));
  if (hasSourceBones) {
    applyIkSolutionToSourceBones(chain, solved, start);
    loadedModel?.updateWorldMatrix(true, true);
    syncEditorJointsFromSourceBones();
    return;
  }

  syncSkeletonMeshes();
}

function buildIkChainToJoint(jointId, maxSegments = 2) {
  const bones = [];
  let currentJointId = jointId;
  const selectedSide = rigNameSide(getJoint(jointId)?.name || "");
  for (let index = 0; index < maxSegments; index += 1) {
    const incoming = state.bones.find((bone) => bone.end === currentJointId);
    if (!incoming) {
      break;
    }
    if (!canUseIncomingIkBone(incoming, selectedSide, bones.length)) {
      break;
    }
    bones.unshift(incoming);
    currentJointId = incoming.start;
  }
  if (bones.length === 0) {
    return null;
  }
  const joints = [getJoint(bones[0].start), ...bones.map((bone) => getJoint(bone.end))];
  if (joints.some((joint) => !joint)) {
    return null;
  }
  return { bones, joints };
}

function canUseIncomingIkBone(bone, selectedSide, existingCount) {
  if (!selectedSide) {
    return true;
  }
  const side = rigNameSide([
    bone.name,
    getJoint(bone.start)?.name || "",
    getJoint(bone.end)?.name || "",
  ].join(" "));
  if (side && side !== selectedSide) {
    return false;
  }
  return Boolean(side || existingCount === 0);
}

function solveIkChain(chain, start, rawTarget) {
  const positions = chain.joints.map((joint) => (start.jointPositions.get(joint.id) || joint.position).clone());
  const root = positions[0].clone();
  const lengths = [];
  for (let index = 0; index < positions.length - 1; index += 1) {
    lengths.push(Math.max(positions[index].distanceTo(positions[index + 1]), 0.0001));
  }
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const target = rawTarget.clone();

  if (root.distanceTo(target) >= totalLength) {
    const direction = target.sub(root).normalize();
    positions[0].copy(root);
    for (let index = 0; index < lengths.length; index += 1) {
      positions[index + 1].copy(positions[index]).addScaledVector(direction, lengths[index]);
    }
    return positions;
  }

  for (let iteration = 0; iteration < 10; iteration += 1) {
    positions[positions.length - 1].copy(target);
    for (let index = positions.length - 2; index >= 0; index -= 1) {
      const direction = positions[index].clone().sub(positions[index + 1]).normalize();
      positions[index].copy(positions[index + 1]).addScaledVector(direction, lengths[index]);
    }

    positions[0].copy(root);
    for (let index = 0; index < lengths.length; index += 1) {
      const direction = positions[index + 1].clone().sub(positions[index]).normalize();
      positions[index + 1].copy(positions[index]).addScaledVector(direction, lengths[index]);
    }
  }

  return positions;
}

function applyIkSolutionToSourceBones(chain, solved, start) {
  chain.bones.forEach((bone, index) => {
    const sourceBone = getPoseSourceBone(bone);
    if (!sourceBone) {
      return;
    }
    const beforeStart = start.jointPositions.get(bone.start);
    const beforeEnd = start.jointPositions.get(bone.end);
    if (!beforeStart || !beforeEnd) {
      return;
    }
    const beforeDirection = beforeEnd.clone().sub(beforeStart).normalize();
    const afterDirection = solved[index + 1].clone().sub(solved[index]).normalize();
    if (beforeDirection.lengthSq() < 0.000001 || afterDirection.lengthSq() < 0.000001) {
      return;
    }
    const initialWorldQuaternion = start.sourceWorldQuaternions.get(sourceBone.uuid);
    if (!initialWorldQuaternion) {
      return;
    }
    const rotationDelta = new THREE.Quaternion().setFromUnitVectors(beforeDirection, afterDirection);
    const desiredWorldQuaternion = initialWorldQuaternion.clone().premultiply(rotationDelta);
    setBoneWorldQuaternion(sourceBone, desiredWorldQuaternion);
    sourceBone.updateWorldMatrix(true, true);
  });
}

function worldVectorToParentLocal(sourceBone, worldDelta) {
  const parent = sourceBone.parent;
  if (!parent) {
    return worldDelta;
  }
  const parentQuaternion = new THREE.Quaternion();
  const parentScale = new THREE.Vector3();
  parent.getWorldQuaternion(parentQuaternion);
  parent.getWorldScale(parentScale);
  return worldDelta
    .applyQuaternion(parentQuaternion.invert())
    .divide(new THREE.Vector3(
      parentScale.x || 1,
      parentScale.y || 1,
      parentScale.z || 1,
    ));
}

function setBoneWorldQuaternion(sourceBone, worldQuaternion) {
  const parent = sourceBone.parent;
  if (!parent) {
    sourceBone.quaternion.copy(worldQuaternion);
    return;
  }
  const parentQuaternion = new THREE.Quaternion();
  parent.getWorldQuaternion(parentQuaternion);
  sourceBone.quaternion.copy(parentQuaternion.invert().multiply(worldQuaternion));
}

function safeRatio(value, base) {
  return Math.abs(base) < 0.00001 ? 1 : value / base;
}

function startModalTransform(mode, event = null) {
  const hasSelection = Boolean(getSelectedBone() || getSelectedJoint());
  if (!hasSelection) {
    setStatus("请先选中骨骼或关节，再按 G/R/S 进行 Blender 风格变换");
    return;
  }

  if (state.modalTransform) {
    confirmModalTransform(false);
  }

  setTransformMode(mode);
  syncTransformTargetToSelection();
  beginGizmoTransform();

  const pivotScreen = projectWorldToScreen(transformTarget.position);
  const startPointer = getModalStartPointer(mode, event, pivotScreen);
  const startX = startPointer.x;
  const startY = startPointer.y;
  const startAngle = screenAngleFromPivot(pivotScreen, startX, startY);
  const startRadius = screenRadiusFromPivot(pivotScreen, startX, startY);
  state.modalTransform = {
    mode,
    startX,
    startY,
    latestX: startX,
    latestY: startY,
    start: cloneTransformStart(state.transformStart),
    pivotScreen,
    startAngle,
    startRadius,
  };
  state.modalTransform.start.pivotScreen = pivotScreen;
  state.modalTransform.start.startAngle = startAngle;
  state.modalTransform.start.startRadius = startRadius;
  state.lastPointer.set(startX, startY);
  state.hasPointerPosition = true;
  const label = mode === "translate" && isPoseJointTransform(state.modalTransform.start)
    ? "G 拉绳移动"
    : mode === "translate"
      ? "G 移动"
      : mode === "rotate"
        ? "R 旋转"
        : "S 缩放";
  const hint = mode === "translate" && isPoseJointTransform(state.modalTransform.start)
    ? "移动鼠标拉动当前关节，父级链保持骨长像绳子一样跟随"
    : "移动鼠标直接变换";
  setStatus(`${label}：${hint}，左键/Enter 确认，右键/Esc 取消，X/Y/Z 约束轴`);
}

function getModalStartPointer(mode, event, pivotScreen) {
  const rect = canvas.getBoundingClientRect();
  const fallback = {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
  };
  const eventHasPointer = Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY);
  const pointer = eventHasPointer
    ? { x: event.clientX, y: event.clientY }
    : state.hasPointerPosition
      ? { x: state.lastPointer.x, y: state.lastPointer.y }
      : fallback;

  if (mode !== "rotate" || !pivotScreen) {
    return pointer;
  }

  const radius = screenRadiusFromPivot(pivotScreen, pointer.x, pointer.y);
  if (radius >= 18) {
    return pointer;
  }

  return {
    x: pointer.x,
    y: pointer.y,
    nearPivot: true,
  };
}

function updateModalTransformFromPointer(clientX, clientY) {
  const modal = state.modalTransform;
  if (!modal || !modal.start) {
    return;
  }

  modal.latestX = clientX;
  modal.latestY = clientY;
  state.transformStart = cloneTransformStart(modal.start);
  restoreTransformStart(modal.start);
  transformTarget.position.copy(modal.start.targetPosition);
  transformTarget.quaternion.copy(modal.start.targetQuaternion);
  transformTarget.scale.copy(modal.start.targetScale);

  const dx = clientX - modal.startX;
  const dy = clientY - modal.startY;
  if (modal.mode === "translate") {
    const delta = screenDeltaToWorldDelta(dx, dy, modal.start.targetQuaternion);
    transformTarget.position.copy(modal.start.targetPosition).add(delta);
  } else if (modal.mode === "rotate") {
    const rotation = modalRotationQuaternion(modal, clientX, clientY, dx, dy, modal.start.targetQuaternion);
    transformTarget.quaternion.copy(modal.start.targetQuaternion).premultiply(rotation);
  } else if (modal.mode === "scale") {
    const factor = THREE.MathUtils.clamp(1 + (dx - dy) * 0.006, 0.05, 5);
    transformTarget.scale.copy(modal.start.targetScale);
    if (state.poseAxisLock === "x") {
      transformTarget.scale.x *= factor;
    } else if (state.poseAxisLock === "y") {
      transformTarget.scale.y *= factor;
    } else if (state.poseAxisLock === "z") {
      transformTarget.scale.z *= factor;
    } else {
      transformTarget.scale.multiplyScalar(factor);
    }
  }

  applyGizmoTransform();
}

function confirmModalTransform(showMessage = true) {
  if (!state.modalTransform) {
    return;
  }
  const mode = state.modalTransform.mode;
  commitTransformUndo("变换骨骼/关节");
  state.modalTransform = null;
  state.transformStart = null;
  state.transformChanged = false;
  syncTransformTargetToSelection();
  if (showMessage) {
    const label = mode === "translate" && state.mode === "pose" && state.selectionKind === "joint" ? "拉绳移动" : mode === "translate" ? "移动" : mode === "rotate" ? "旋转" : "缩放";
    setStatus(`${label} 已确认`);
  }
}

function cancelModalTransform() {
  if (!state.modalTransform) {
    return;
  }
  const start = state.modalTransform.start;
  restoreTransformStart(start);
  state.modalTransform = null;
  state.transformStart = null;
  state.transformChanged = false;
  state.poseAxisLock = null;
  setTransformAxisVisibility(null);
  syncTransformTargetToSelection();
  setStatus("已取消 Blender 风格变换");
}

function isPoseJointTransform(start = state.transformStart) {
  return state.mode === "pose"
    && start?.selectionKind === "joint"
    && !shouldUseStretchPoseTranslate(start.selectedJointId);
}

function viewAxisRotationFromPointer(modal, clientX, clientY, dx, dy) {
  const amount = modalScreenAngleDelta(modal, clientX, clientY, dx, dy);
  const viewAxis = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  return new THREE.Quaternion().setFromAxisAngle(viewAxis, amount);
}

function cloneTransformStart(start) {
  if (!start) {
    return null;
  }
  return {
    ...start,
    targetPosition: start.targetPosition.clone(),
    targetQuaternion: start.targetQuaternion.clone(),
    targetScale: start.targetScale.clone(),
    jointPositions: new Map([...start.jointPositions.entries()].map(([id, position]) => [id, position.clone()])),
    jointOrientations: new Map([...start.jointOrientations.entries()].map(([id, quaternion]) => [id, quaternion.clone()])),
    sourceBoneTransforms: start.sourceBoneTransforms?.map((item) => ({
      sourceBone: item.sourceBone,
      position: item.position.clone(),
      quaternion: item.quaternion.clone(),
      scale: item.scale.clone(),
    })) || [],
    sourceWorldQuaternions: new Map([...(start.sourceWorldQuaternions || new Map()).entries()].map(([id, quaternion]) => [id, quaternion.clone()])),
    sourcePosition: start.sourcePosition?.clone() || null,
    sourceQuaternion: start.sourceQuaternion?.clone() || null,
    sourceScale: start.sourceScale?.clone() || null,
    pivotScreen: start.pivotScreen ? { ...start.pivotScreen } : null,
    startRadius: start.startRadius ?? null,
  };
}

function restoreTransformStart(start) {
  if (!start) {
    return;
  }

  if (start.editorMode === "pose" && start.sourceBoneTransforms?.length) {
    start.sourceBoneTransforms.forEach((item) => {
      item.sourceBone.position.copy(item.position);
      item.sourceBone.quaternion.copy(item.quaternion);
      item.sourceBone.scale.copy(item.scale);
    });
    loadedModel?.updateWorldMatrix(true, true);
    syncEditorJointsFromSourceBones();
    return;
  }

  start.jointPositions.forEach((position, id) => {
    const joint = getJoint(id);
    if (joint) {
      joint.position.copy(position);
    }
  });
  start.jointOrientations?.forEach((quaternion, id) => {
    const joint = getJoint(id);
    if (joint) {
      joint.orientation.copy(quaternion);
    }
  });
  syncSkeletonMeshes();
}

function getStartSourceTransform(start, sourceBone) {
  return start?.sourceBoneTransforms?.find((item) => item.sourceBone.uuid === sourceBone?.uuid) || null;
}

function screenDeltaToWorldDelta(dx, dy, basisQuaternion) {
  const distanceScale = cameraDistance * 0.00045;
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const delta = cameraRight.multiplyScalar(dx * distanceScale).add(cameraUp.multiplyScalar(-dy * distanceScale));
  const axis = getConstraintAxis(basisQuaternion);
  if (axis) {
    return axis.multiplyScalar(delta.dot(axis));
  }
  return delta;
}

function modalRotationQuaternion(modal, clientX, clientY, dx, dy, basisQuaternion) {
  const axis = getConstraintAxis(basisQuaternion);
  const amount = axis ? modalLinearRotationAmount(dx, dy) : modalScreenAngleDelta(modal, clientX, clientY, dx, dy);
  if (axis) {
    return new THREE.Quaternion().setFromAxisAngle(axis, amount);
  }
  const viewAxis = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  return new THREE.Quaternion().setFromAxisAngle(viewAxis, amount);
}

function modalScreenAngleDelta(modal, clientX, clientY, dx, dy) {
  const pivot = modal.pivotScreen || modal.start?.pivotScreen;
  if (!pivot) {
    return modalLinearRotationAmount(dx, dy);
  }
  const currentRadius = screenRadiusFromPivot(pivot, clientX, clientY);
  const startRadius = modal.startRadius ?? modal.start?.startRadius ?? screenRadiusFromPivot(pivot, modal.startX, modal.startY);
  if (startRadius < 18 || currentRadius < 8) {
    return modalLinearRotationAmount(dx, dy);
  }
  const currentAngle = screenAngleFromPivot(pivot, clientX, clientY);
  if (!Number.isFinite(currentAngle) || !Number.isFinite(modal.startAngle)) {
    return modalLinearRotationAmount(dx, dy);
  }
  return normalizeAngle(currentAngle - modal.startAngle);
}

function modalLinearRotationAmount(dx, dy) {
  return -(Math.abs(dx) > Math.abs(dy) ? dx : -dy) * 0.01;
}

function screenAngleFromPivot(pivot, clientX, clientY) {
  const vx = clientX - pivot.x;
  const vy = clientY - pivot.y;
  if (screenRadiusFromPivot(pivot, clientX, clientY) < 8) {
    return 0;
  }
  return Math.atan2(vy, vx);
}

function screenRadiusFromPivot(pivot, clientX, clientY) {
  return Math.hypot(clientX - pivot.x, clientY - pivot.y);
}

function normalizeAngle(angle) {
  let result = angle;
  while (result > Math.PI) {
    result -= Math.PI * 2;
  }
  while (result < -Math.PI) {
    result += Math.PI * 2;
  }
  return result;
}

function getConstraintAxis(basisQuaternion) {
  const axis = state.poseAxisLock;
  if (!axis) {
    return null;
  }
  const base = axis === "x"
    ? new THREE.Vector3(1, 0, 0)
    : axis === "y"
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  if (state.transformSpace === "local") {
    base.applyQuaternion(basisQuaternion);
  }
  return base.normalize();
}

function beginPoseDrag(event) {
  const bone = getSelectedBone();
  if (!bone) {
    setStatus("请先选中一根骨骼。Pose 模式不会拉长骨架，只旋转骨骼。");
    return;
  }

  state.isPosingBone = true;
  state.poseBoneId = bone.id;
  state.poseInitialPositions = snapshotJointPositions();
  const sourceBone = getPoseSourceBone(bone);
  state.poseInitialQuaternion = sourceBone ? sourceBone.quaternion.clone() : null;
  state.dragStart.set(event.clientX, event.clientY);
  state.lastPointer.set(event.clientX, event.clientY);
  setStatus(`Pose：正在旋转 ${bone.name}${state.poseAxisLock ? `，轴 ${state.poseAxisLock.toUpperCase()}` : ""}`);
}

function updatePoseDrag(event) {
  const bone = getBone(state.poseBoneId);
  if (!bone) {
    return;
  }
  const dx = event.clientX - state.dragStart.x;
  const dy = event.clientY - state.dragStart.y;
  applyPoseRotation(bone, dx, dy, state.poseInitialQuaternion, state.poseInitialPositions);
}

function applyPoseRotation(bone, dx, dy, initialQuaternion, initialPositions) {
  const sourceBone = getPoseSourceBone(bone);
  if (sourceBone && initialQuaternion) {
    const delta = makePoseRotation(dx, dy);
    sourceBone.quaternion.copy(initialQuaternion).multiply(delta);
    loadedModel?.updateWorldMatrix(true, true);
    syncEditorJointsFromSourceBones();
    return;
  }

  rotateEditorBranch(bone, dx, dy, initialPositions);
}

function makePoseRotation(dx, dy) {
  const scale = 0.0085;
  const axis = state.poseAxisLock;
  const euler = new THREE.Euler(0, 0, 0, "XYZ");
  if (axis === "x") {
    euler.x = dy * scale;
  } else if (axis === "y") {
    euler.y = dx * scale;
  } else if (axis === "z") {
    euler.z = dx * scale;
  } else {
    euler.x = dy * scale;
    euler.y = dx * scale;
  }
  return new THREE.Quaternion().setFromEuler(euler);
}

function getPoseSourceBone(editorBone) {
  return editorBone?.sourceBone || getJoint(editorBone?.start)?.sourceBone || null;
}

function snapshotJointPositions() {
  return new Map(state.joints.map((joint) => [joint.id, joint.position.clone()]));
}

function snapshotJointOrientations() {
  return new Map(state.joints.map((joint) => [joint.id, getJointOrientation(joint).clone()]));
}

function snapshotSourceBoneTransforms() {
  const result = [];
  const seen = new Set();
  collectSourceBonesForSnapshots().forEach((sourceBone) => {
    if (!sourceBone || seen.has(sourceBone.uuid)) {
      return;
    }
    seen.add(sourceBone.uuid);
    result.push({
      sourceBone,
      position: sourceBone.position.clone(),
      quaternion: sourceBone.quaternion.clone(),
      scale: sourceBone.scale.clone(),
    });
  });
  return result;
}

function snapshotSourceBoneWorldQuaternions() {
  const result = new Map();
  loadedModel?.updateWorldMatrix(true, true);
  collectSourceBonesForSnapshots().forEach((sourceBone) => {
    if (!sourceBone || result.has(sourceBone.uuid)) {
      return;
    }
    const quaternion = new THREE.Quaternion();
    sourceBone.getWorldQuaternion(quaternion);
    result.set(sourceBone.uuid, quaternion);
  });
  return result;
}

function collectSourceBonesForSnapshots() {
  const sourceBones = [];
  state.joints.forEach((joint) => {
    if (joint.sourceBone) {
      sourceBones.push(joint.sourceBone);
    }
  });
  state.bones.forEach((bone) => {
    if (bone.sourceBone) {
      sourceBones.push(bone.sourceBone);
    }
    if (bone.sourceChildBone) {
      sourceBones.push(bone.sourceChildBone);
    }
  });
  return sourceBones;
}

function rotateEditorBranch(bone, dx, dy, initialPositions) {
  if (!initialPositions) {
    return;
  }
  const startInitial = initialPositions.get(bone.start);
  const startCurrent = getJoint(bone.start)?.position;
  if (!startInitial || !startCurrent) {
    return;
  }

  const rotation = makePoseRotation(dx, dy);
  const branch = collectBranchJoints(bone.end);
  branch.forEach((joint) => {
    const original = initialPositions.get(joint.id);
    if (!original) {
      return;
    }
    const offset = original.clone().sub(startInitial).applyQuaternion(rotation);
    joint.position.copy(startCurrent).add(offset);
  });
  syncSkeletonMeshes();
}

function syncEditorJointsFromSourceBones() {
  let updated = false;
  loadedModel?.updateWorldMatrix(true, true);
  state.joints.forEach((joint) => {
    if (!joint.sourceBone) {
      return;
    }
    joint.sourceBone.getWorldPosition(joint.position);
    joint.sourceBone.getWorldQuaternion(joint.orientation);
    updated = true;
  });
  if (updated) {
    syncSkeletonMeshes();
  }
}

function installDebugApi() {
  window.__actionRigDebug = {
    loadTestModel: () => loadModelUrlWithProgress("./sample_models/stylized_3d_character_model.glb", "stylized_3d_character_model.glb"),
    setMode,
    setTransformMode,
    toggleTransformSpace,
    setBoneOpacity(value) {
      state.boneOpacity = THREE.MathUtils.clamp(Number(value), 0.05, 1);
      const input = document.querySelector("#boneOpacityInput");
      const output = document.querySelector("#boneOpacityValue");
      if (input) {
        input.value = String(state.boneOpacity);
      }
      if (output) {
        output.textContent = state.boneOpacity.toFixed(2);
      }
      syncSkeletonMeshes();
      applyTransformControlOpacity();
      return state.boneOpacity;
    },
    setWeightPointsVisible(value) {
      state.showWeightPoints = Boolean(value);
      updateWeightPointVisibility();
      return weightCloud?.visible ?? false;
    },
    getWeightPointInfo() {
      return {
        mode: state.mode,
        enabled: state.showWeightPoints,
        visible: weightCloud?.visible ?? false,
        count: weightPoints.length,
      };
    },
    getWeightPreviewInfo() {
      updateWeightModeDisplay();
      const selectedInfluence = getSelectedWeightInfluence();
      const meshes = getWeightPaintMeshes();
      const mesh = meshes[0] || null;
      let selectedVertices = 0;
      let otherBoundVertices = 0;
      let unboundVertices = 0;
      let colorAttributeCount = 0;
      if (mesh?.geometry?.attributes?.position) {
        const count = mesh.geometry.attributes.position.count;
        colorAttributeCount = mesh.geometry.attributes.color?.count || 0;
        for (let index = 0; index < count; index += 1) {
          const totalWeight = getVertexTotalSkinWeight(mesh, index);
          const selectedWeight = selectedInfluence ? getEditableWeightForInfluence(mesh, selectedInfluence, index) : 0;
          if (selectedWeight > 0.015) {
            selectedVertices += 1;
          } else if (totalWeight > 0.015) {
            otherBoundVertices += 1;
          } else {
            unboundVertices += 1;
          }
        }
      }
      return {
        mode: state.mode,
        weightToolMode: state.weightToolMode,
        selectedSourceBone: selectedInfluence?.label || null,
        selectedInfluenceBones: selectedInfluence?.bones.map((bone) => bone.name) || [],
        skinnedMeshes: meshes.length,
        materialIsWeightPreview: Boolean(mesh?.material?.userData?.isWeightPreview || mesh?.material === mesh?.userData?.actionRigWeightMaterial),
        colorAttributeCount,
        selectedVertices,
        otherBoundVertices,
        unboundVertices,
        brushVisible: brushCursor?.visible ?? false,
        brushRadius: state.brushRadius,
        debugPointVisible: weightCloud?.visible ?? false,
      };
    },
    setWeightToolMode,
    setAllowPoseStretch(value) {
      state.allowPoseStretch = Boolean(value);
      if (el.poseStretchToggle) {
        el.poseStretchToggle.checked = state.allowPoseStretch;
      }
      return state.allowPoseStretch;
    },
    getPoseMoveModeInfo() {
      return {
        allowPoseStretch: state.allowPoseStretch,
        selectedJointHasChildren: shouldUseDownstreamPoseTranslate(state.selectedJointId),
      };
    },
    previewBrushAtSelection() {
      showBrushAtSelection();
      return {
        visible: brushCursor?.visible ?? false,
        radius: state.brushRadius,
        position: brushCursor?.position.toArray() || null,
      };
    },
    getWalkDirectionInfo() {
      const basis = getMotionBasis();
      return {
        walkDirection: state.walkDirection,
        right: basis.right.toArray(),
        forward: basis.forward.toArray(),
        dot: basis.right.dot(basis.forward),
        leftContact: leftContact.position.toArray(),
        rightContact: rightContact.position.toArray(),
        visible: walkDirectionHelper.visible,
      };
    },
    setWalkDirection(value) {
      state.walkDirection = ["auto", "reverse", "right", "left"].includes(value) ? value : "auto";
      if (el.walkDirectionSelect) {
        el.walkDirectionSelect.value = state.walkDirection;
      }
      updateWalkContactMarkers(frameToPhase(state.currentFrame));
      return this.getWalkDirectionInfo();
    },
    setMirrorAxis(value) {
      state.mirrorAxis = ["characterRight", "characterForward", "worldX", "worldZ"].includes(value) ? value : "characterRight";
      if (el.mirrorAxisSelect) {
        el.mirrorAxisSelect.value = state.mirrorAxis;
      }
      return this.getMirrorPlaneInfo();
    },
    getMirrorPlaneInfo() {
      const plane = getMirrorPlane();
      return {
        axis: state.mirrorAxis,
        label: plane.label,
        center: plane.center.toArray(),
        normal: plane.normal.toArray(),
      };
    },
    mirrorSelectedBranch,
    selectFrame(frame) {
      return selectFrame(frame, { announce: false, stopPlayback: true });
    },
    saveCurrentKeyframe,
    applyAnimationAtFrame,
    applyAnimationAtPhase,
    generateWalkTemplate,
    clearKeyframes() {
      state.keyframes = [];
      renderTimeline();
    },
    getTimelineInfo() {
      return {
        currentFrame: state.currentFrame,
        numberValue: Number(el.frameNumberInput.value),
        rangeValue: Number(el.frameRangeInput.value),
        tickCount: el.timelineTrack.querySelectorAll(".frame-tick").length,
        selectedTick: Number(el.timelineTrack.querySelector(".frame-tick.is-current")?.dataset.frame || 0),
        keyframeTicks: [...el.timelineTrack.querySelectorAll(".frame-tick.has-keyframe")].map((tick) => Number(tick.dataset.frame)),
        recordButtons: [...el.keyframeRecordList.querySelectorAll(".record-frame-button")].map((button) => Number(button.textContent)),
        currentFrameSaveState: el.currentFrameSaveState.textContent,
        hudFrameState: el.hudFrameState?.textContent || "",
        hudFrameSaved: Boolean(el.hudFrameState?.closest(".hud-frame-card")?.classList.contains("is-saved")),
        keyframes: state.keyframes.map((keyframe) => keyframe.frame),
      };
    },
    getTransformPivotInfo() {
      syncTransformTargetToSelection();
      const joint = getSelectedJoint();
      const bone = getSelectedBone();
      const start = bone ? getJoint(bone.start) : null;
      const distance = (a, b) => a && b ? a.distanceTo(b) : null;
      return {
        mode: state.mode,
        transformMode: state.transformMode,
        selectionKind: state.selectionKind,
        selectedJoint: joint?.name || null,
        selectedBone: bone?.name || null,
        pivotPosition: transformTarget.position.toArray(),
        jointPosition: joint?.position.toArray() || null,
        boneStartPosition: start?.position.toArray() || null,
        pivotToJoint: distance(transformTarget.position, joint?.position),
        pivotToBoneStart: distance(transformTarget.position, start?.position),
      };
    },
    getPointerPriorityAt,
    findTransformHandlePrioritySample,
    selectBoneByName(name) {
      const lower = name.toLowerCase();
      const bone = state.bones.find((item) => item.name.toLowerCase() === lower || item.name.toLowerCase().includes(lower));
      if (!bone) {
        return false;
      }
      selectBone(bone.id);
      return true;
    },
    selectJointByName(name) {
      const lower = name.toLowerCase();
      const joint = state.joints.find((item) => item.name.toLowerCase() === lower || item.name.toLowerCase().includes(lower));
      if (!joint) {
        return false;
      }
      selectJoint(joint.id);
      return true;
    },
    poseSelected(dx = 60, dy = -24) {
      const bone = getSelectedBone();
      if (!bone) {
        return false;
      }
      const sourceBone = getPoseSourceBone(bone);
      applyPoseRotation(bone, dx, dy, sourceBone?.quaternion.clone() || null, snapshotJointPositions());
      return true;
    },
    gizmoRotateSelected(x = 0.18, y = 0.24, z = 0) {
      const bone = getSelectedBone();
      if (!bone) {
        return false;
      }
      setMode("pose");
      setTransformMode("rotate");
      syncTransformTargetToSelection();
      beginGizmoTransform();
      const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
      transformTarget.quaternion.copy(state.transformStart.targetQuaternion).multiply(delta);
      applyGizmoTransform();
      state.transformStart = null;
      syncTransformTargetToSelection();
      return true;
    },
    modalTransformSelected(mode = "translate", dx = 80, dy = -30) {
      if (!getSelectedBone() && !getSelectedJoint()) {
        return false;
      }
      startModalTransform(mode);
      if (!state.modalTransform) {
        return false;
      }
      updateModalTransformFromPointer(state.modalTransform.startX + dx, state.modalTransform.startY + dy);
      confirmModalTransform(false);
      return true;
    },
    modalCancelSelected(mode = "translate", dx = 80, dy = -30) {
      const before = this.getSelectedBoneInfo();
      startModalTransform(mode);
      if (!state.modalTransform) {
        return { started: false, before, after: this.getSelectedBoneInfo() };
      }
      updateModalTransformFromPointer(state.modalTransform.startX + dx, state.modalTransform.startY + dy);
      cancelModalTransform();
      return { started: true, before, after: this.getSelectedBoneInfo() };
    },
    modalRotateSelectedAroundPivot(startOffset = [120, 0], endOffset = [0, 120]) {
      if (!getSelectedBone() && !getSelectedJoint()) {
        return { started: false };
      }
      setTransformMode("rotate");
      syncTransformTargetToSelection();
      const pivot = projectWorldToScreen(transformTarget.position);
      const startX = pivot.x + startOffset[0];
      const startY = pivot.y + startOffset[1];
      state.lastPointer.set(startX, startY);
      startModalTransform("rotate");
      if (!state.modalTransform) {
        return { started: false };
      }
      const endX = pivot.x + endOffset[0];
      const endY = pivot.y + endOffset[1];
      const amount = modalScreenAngleDelta(state.modalTransform, endX, endY, endX - startX, endY - startY);
      updateModalTransformFromPointer(endX, endY);
      confirmModalTransform(false);
      return { started: true, amount };
    },
    getTransformInfo() {
      const opacities = [];
      transformControls._gizmo?.gizmo?.[state.transformMode]?.traverse((node) => {
        if (node.material && node.visible) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => opacities.push(material._opacity ?? material.opacity));
        }
      });
      return {
        mode: state.transformMode,
        space: state.transformSpace,
        visible: transformControls.visible,
        attached: Boolean(transformControls.object),
        showX: transformControls.showX,
        showY: transformControls.showY,
        showZ: transformControls.showZ,
        controlOpacityMin: opacities.length ? Math.min(...opacities) : null,
        controlOpacityMax: opacities.length ? Math.max(...opacities) : null,
      };
    },
    getCameraInfo() {
      return {
        yaw,
        pitch,
        distance: cameraDistance,
        target: cameraTarget.toArray(),
      };
    },
    getInteractionState() {
      return {
        mode: state.mode,
        selectedJointId: state.selectedJointId,
        selectedBoneId: state.selectedBoneId,
        isExtending: state.isExtending,
        pendingExtendJointId: state.pendingExtendJointId,
        orbiting: state.orbiting,
        painting: state.painting,
        bones: state.bones.length,
        selectionKind: state.selectionKind,
        undoDepth: state.undoStack.length,
      };
    },
    projectJoint(namePart = "") {
      const lower = namePart.toLowerCase();
      const joint = state.joints.find((item) => !lower || item.name.toLowerCase().includes(lower));
      if (!joint) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const projected = joint.position.clone().project(camera);
      return {
        id: joint.id,
        name: joint.name,
        x: rect.left + ((projected.x + 1) * 0.5 * rect.width),
        y: rect.top + ((1 - projected.y) * 0.5 * rect.height),
      };
    },
    getSelectedBoneInfo() {
      const bone = getSelectedBone();
      if (!bone) {
        return null;
      }
      const start = getJoint(bone.start);
      const end = getJoint(bone.end);
      return {
        name: bone.name,
        start: start?.name || "",
        end: end?.name || "",
        length: start && end ? start.position.distanceTo(end.position) : 0,
        endPosition: end ? end.position.toArray() : [],
        hasSourceBone: Boolean(getPoseSourceBone(bone)),
      };
    },
    getSelectedJointInfo() {
      const joint = getSelectedJoint();
      if (!joint) {
        return null;
      }
      return {
        id: joint.id,
        name: joint.name,
        position: joint.position.toArray(),
        orientation: getJointOrientation(joint).toArray(),
        hasSourceBone: Boolean(joint.sourceBone),
      };
    },
    getBoneInfoByName(name) {
      const lower = name.toLowerCase();
      const bone = state.bones.find((item) => item.name.toLowerCase() === lower || item.name.toLowerCase().includes(lower));
      if (!bone) {
        return null;
      }
      const start = getJoint(bone.start);
      const end = getJoint(bone.end);
      return {
        name: bone.name,
        start: start?.name || "",
        end: end?.name || "",
        startPosition: start ? start.position.toArray() : [],
        endPosition: end ? end.position.toArray() : [],
        length: start && end ? start.position.distanceTo(end.position) : 0,
        hasSourceBone: Boolean(getPoseSourceBone(bone)),
      };
    },
    getJointInfoByName(name) {
      const lower = name.toLowerCase();
      const joint = state.joints.find((item) => item.name.toLowerCase() === lower || item.name.toLowerCase().includes(lower));
      if (!joint) {
        return null;
      }
      return {
        id: joint.id,
        name: joint.name,
        position: joint.position.toArray(),
        orientation: getJointOrientation(joint).toArray(),
        hasSourceBone: Boolean(joint.sourceBone),
      };
    },
    setLastPointer(x, y) {
      state.lastPointer.set(Number(x), Number(y));
      state.hasPointerPosition = true;
      return state.lastPointer.toArray();
    },
    inspectModalStart(mode = "rotate") {
      startModalTransform(mode);
      const modal = state.modalTransform;
      const info = modal
        ? {
          mode: modal.mode,
          startX: modal.startX,
          startY: modal.startY,
          pivotScreen: modal.pivotScreen,
          startAngle: modal.startAngle,
          startRadius: modal.startRadius,
        }
        : null;
      cancelModalTransform();
      return info;
    },
    modalRotationAmountFromLastPointer(dx = 20, dy = 60) {
      startModalTransform("rotate");
      const modal = state.modalTransform;
      if (!modal) {
        return null;
      }
      const amount = modalScreenAngleDelta(modal, modal.startX + dx, modal.startY + dy, dx, dy);
      const info = {
        amount,
        startRadius: modal.startRadius,
        startX: modal.startX,
        startY: modal.startY,
        pivotScreen: modal.pivotScreen,
      };
      cancelModalTransform();
      return info;
    },
    undo: undoLastAction,
    setBoneDisplaySize({ thickness = state.boneThickness, jointSize = state.jointSize } = {}) {
      state.boneThickness = THREE.MathUtils.clamp(Number(thickness), 0.45, 1.85);
      state.jointSize = THREE.MathUtils.clamp(Number(jointSize), 0.55, 1.85);
      const thicknessInput = document.querySelector("#boneThicknessInput");
      const thicknessValue = document.querySelector("#boneThicknessValue");
      const jointInput = document.querySelector("#jointSizeInput");
      const jointValue = document.querySelector("#jointSizeValue");
      if (thicknessInput && thicknessValue) {
        thicknessInput.value = String(state.boneThickness);
        thicknessValue.textContent = state.boneThickness.toFixed(2);
      }
      if (jointInput && jointValue) {
        jointInput.value = String(state.jointSize);
        jointValue.textContent = state.jointSize.toFixed(2);
      }
      syncSkeletonMeshes();
      return this.getDisplaySizeInfo();
    },
    getDisplaySizeInfo() {
      const boneGroup = [...boneMeshes.values()][0] || null;
      const jointGroup = [...jointMeshes.values()][0] || null;
      return {
        boneThickness: state.boneThickness,
        jointSize: state.jointSize,
        boneScale: boneGroup ? boneGroup.scale.toArray() : null,
        jointScale: jointGroup ? jointGroup.scale.toArray() : null,
      };
    },
    getStats() {
      return {
        mode: state.mode,
        joints: state.joints.length,
        bones: state.bones.length,
        selected: this.getSelectedBoneInfo(),
        jointControlKinds: [...jointMeshes.values()].map((group) => group.children.map((child) => child.name)),
        boneControlKinds: [...boneMeshes.values()].map((group) => group.children.map((child) => child.name)),
        worldAxisKinds: worldAxes.children.map((child) => child.name),
        status: el.statusLine.textContent,
      };
    },
  };
}

function autoChildName(sourceName) {
  const side = sourceName.endsWith(".L") ? ".L" : sourceName.endsWith(".R") ? ".R" : "";
  const base = sourceName.replace(/\.[LR]$/, "");
  const count = state.bones.filter((bone) => bone.start === state.selectedSourceJointId).length + 1;
  const map = {
    hips: "spine",
    spine: "chest",
    chest: "neck",
    neck: "head",
    upper_arm: "lower_arm",
    lower_arm: "hand",
    upper_leg: "lower_leg",
    lower_leg: "foot",
    hand: "finger",
    foot: "toe",
  };
  return `${map[base] || `${base}_child_${count}`}${side}`;
}

function mirrorSelectedBranch() {
  const source = getSelectedJoint();
  if (!source) {
    setStatus("请先选中要镜像的骨骼端点");
    return null;
  }

  const branchJoints = collectBranchJoints(source.id);
  if (branchJoints.length === 0) {
    setStatus("当前端点没有可镜像的分支");
    return null;
  }

  pushUndo("镜像分支");
  const mirrorPlane = getMirrorPlane();
  const idMap = new Map();
  branchJoints.forEach((joint) => {
    const mirroredName = mirrorName(joint.name);
    const mirrored = addJoint(mirroredName, mirrorPointAcrossPlane(joint.position, mirrorPlane.center, mirrorPlane.normal), mirrorColor(joint.color));
    idMap.set(joint.id, mirrored.id);
  });

  state.bones
    .filter((bone) => idMap.has(bone.start) && idMap.has(bone.end))
    .forEach((bone) => {
      state.bones.push({
        id: `b${state.nextBone++}`,
        name: mirrorName(bone.name),
        start: idMap.get(bone.start),
        end: idMap.get(bone.end),
        color: mirrorColor(bone.color),
      });
    });

  selectJoint(idMap.get(source.id));
  syncSkeletonMeshes();
  setStatus(`已按${mirrorPlane.label}镜像当前分支`);
  return {
    axis: state.mirrorAxis,
    label: mirrorPlane.label,
    normal: mirrorPlane.normal.toArray(),
    center: mirrorPlane.center.toArray(),
    mirroredJointId: idMap.get(source.id),
  };
}

function getMirrorPlane() {
  const basis = getCharacterBasis();
  const hip = findJointByRole("hip") || state.joints[0] || getSelectedJoint();
  const center = hip?.position?.clone() || new THREE.Vector3();
  const axis = state.mirrorAxis || "characterRight";
  const options = {
    characterRight: { normal: basis.right, label: "角色左右轴" },
    characterForward: { normal: basis.forward, label: "角色前后轴" },
    worldX: { normal: new THREE.Vector3(1, 0, 0), label: "世界 X 轴" },
    worldZ: { normal: new THREE.Vector3(0, 0, 1), label: "世界 Z 轴" },
  };
  const selected = options[axis] || options.characterRight;
  const normal = selected.normal.clone();
  normal.y = 0;
  if (normal.lengthSq() < 0.0001) {
    normal.set(1, 0, 0);
  }
  normal.normalize();
  return { center, normal, label: selected.label };
}

function mirrorPointAcrossPlane(point, center, normal) {
  const mirrored = point.clone();
  const distance = mirrored.clone().sub(center).dot(normal);
  return mirrored.addScaledVector(normal, -distance * 2);
}

function collectBranchJoints(rootJointId) {
  const result = [];
  const visit = (jointId) => {
    const joint = getJoint(jointId);
    if (joint) {
      result.push(joint);
    }
    state.bones.filter((bone) => bone.start === jointId).forEach((bone) => visit(bone.end));
  };
  visit(rootJointId);
  return result;
}

function mirrorName(name) {
  if (name.endsWith(".L")) {
    return name.replace(/\.L$/, ".R");
  }
  if (name.endsWith(".R")) {
    return name.replace(/\.R$/, ".L");
  }
  if (/^L_/i.test(name)) {
    return name.replace(/^L_/i, "R_");
  }
  if (/^R_/i.test(name)) {
    return name.replace(/^R_/i, "L_");
  }
  if (/_L$/i.test(name)) {
    return name.replace(/_L$/i, "_R");
  }
  if (/_R$/i.test(name)) {
    return name.replace(/_R$/i, "_L");
  }
  if (/^Left/i.test(name)) {
    return name.replace(/^Left/i, "Right");
  }
  if (/^Right/i.test(name)) {
    return name.replace(/^Right/i, "Left");
  }
  return `${name}_mirror`;
}

function mirrorColor(color) {
  const threeColor = new THREE.Color(color);
  threeColor.offsetHSL(0.08, 0, 0.03);
  return `#${threeColor.getHexString()}`;
}

function deleteSelectedBone() {
  const bone = getSelectedBone();
  if (!bone) {
    setStatus("请先选中一根骨骼");
    return;
  }
  pushUndo("删除骨骼");
  const branch = new Set(collectBranchJoints(bone.end).map((joint) => joint.id));
  state.bones = state.bones.filter((item) => item.id !== bone.id && !branch.has(item.start) && !branch.has(item.end));
  state.joints = state.joints.filter((joint) => !branch.has(joint.id));
  state.selectedBoneId = null;
  state.selectedJointId = bone.start;
  syncSkeletonMeshes();
  setStatus("已删除选中骨骼及其子分支");
}

function initGhostModel() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x7e93ad,
    roughness: 0.76,
    metalness: 0.02,
    transparent: true,
    opacity: state.modelOpacity * 0.7,
    depthWrite: false,
  });

  const parts = [
    capsulePart("torso", 0.42, 0.72, new THREE.Vector3(0, 1.45, 0), material),
    capsulePart("head", 0.18, 0.18, new THREE.Vector3(0, 2.02, 0), material),
    capsulePart("armL", 0.08, 0.78, new THREE.Vector3(-0.56, 1.34, 0), material, 0.38),
    capsulePart("armR", 0.08, 0.78, new THREE.Vector3(0.56, 1.34, 0), material, -0.38),
    capsulePart("legL", 0.1, 0.96, new THREE.Vector3(-0.22, 0.56, 0), material, 0.04),
    capsulePart("legR", 0.1, 0.96, new THREE.Vector3(0.22, 0.56, 0), material, -0.04),
  ];
  parts.forEach((part) => {
    part.userData.ghostPart = true;
    ghostRoot.add(part);
  });
}

function capsulePart(name, radius, height, position, material, zRot = 0) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, height, 10, 18), material.clone());
  mesh.name = name;
  mesh.position.copy(position);
  mesh.rotation.z = zRot;
  return mesh;
}

function loadModelFile(file) {
  setImportStatus(`读取文件：${file.name}`, 0, formatBytes(file.size));
  setStatus(`正在读取 GLB：${file.name}`);

  const reader = new FileReader();
  reader.onprogress = (event) => {
    if (event.lengthComputable) {
      setImportStatus(`读取文件：${file.name}`, (event.loaded / event.total) * 50, formatBytes(file.size));
    }
  };
  reader.onerror = () => {
    const message = reader.error?.message || "浏览器读取文件失败";
    setImportStatus(`读取失败：${message}`, 0, formatBytes(file.size));
    setStatus("GLB 读取失败");
  };
  reader.onload = () => {
    parseModelArrayBuffer(reader.result, file.name, formatBytes(file.size));
  };
  reader.readAsArrayBuffer(file);
}

async function loadModelUrlWithProgress(url, label) {
  try {
    setImportStatus(`请求测试模型：${label}`, 0, "...");
    setStatus(`正在加载测试模型：${label}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body) {
      const arrayBuffer = await response.arrayBuffer();
      parseModelArrayBuffer(arrayBuffer, label, formatBytes(arrayBuffer.byteLength));
      return;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      received += value.byteLength;
      const progress = total > 0 ? (received / total) * 50 : 20;
      setImportStatus(`下载测试模型：${label}`, progress, formatBytes(total || received));
    }

    const data = new Uint8Array(received);
    let offset = 0;
    chunks.forEach((chunk) => {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    });
    parseModelArrayBuffer(data.buffer, label, formatBytes(received));
  } catch (error) {
    showLoadError(label, error);
  }
}

function parseModelArrayBuffer(arrayBuffer, label, sizeText) {
  setImportStatus(`解析模型：${label}`, 65, sizeText);
  const loader = new GLTFLoader();
  loader.parse(
    arrayBuffer,
    "",
    (gltf) => {
      applyLoadedGltf(gltf, label, sizeText);
    },
    (error) => {
      showLoadError(label, error);
    },
  );
}

function applyLoadedGltf(gltf, label, sizeText) {
  if (loadedModel) {
    disposeObject(loadedModel);
    loadedModelRoot.remove(loadedModel);
  }

  loadedModel = gltf.scene;
  loadedModel.traverse((node) => {
    if (node.isMesh) {
      node.frustumCulled = false;
      node.material = cloneTransparentMaterial(node.material, state.modelOpacity);
      node.userData.actionRigBaseMaterial = node.material;
    }
  });

  normalizeLoadedModel(loadedModel);
  loadedModelRoot.add(loadedModel);
  ghostRoot.visible = false;

  const stats = inspectLoadedModel(loadedModel, gltf);
  const importedBones = rebuildSkeletonFromLoadedModel(loadedModel);
  applyModelOpacity();
  updateWeightModeDisplay();
  setImportStatus(`已加载：${label}`, 100, sizeText);
  setStatus(`模型已加载：${stats.meshes} 个网格，${stats.skins} 套蒙皮，${importedBones} 根骨骼`);
  el.exportPreview.value = JSON.stringify({ file: label, ...stats, importedBones }, null, 2);
}

function showLoadError(label, error) {
  const message = error?.message || String(error);
  console.error(error);
  setImportStatus(`加载失败：${label}`, 0, "失败");
  setStatus(`GLB 加载失败：${message}`);
  el.exportPreview.value = `GLB 加载失败\n文件：${label}\n原因：${message}`;
}

function setImportStatus(text, progress, sizeText) {
  el.importStatusText.textContent = text;
  if (sizeText !== undefined) {
    el.importSizeText.textContent = sizeText;
  }
  if (progress !== undefined && progress !== null) {
    el.importProgress.value = THREE.MathUtils.clamp(progress, 0, 100);
  }
}

function cloneTransparentMaterial(material, opacity) {
  if (Array.isArray(material)) {
    return material.map((item) => cloneTransparentMaterial(item, opacity));
  }
  const cloned = material ? material.clone() : new THREE.MeshStandardMaterial({ color: 0x9fb1c8 });
  cloned.transparent = opacity < 1;
  cloned.opacity = opacity;
  cloned.depthWrite = opacity >= 0.95;
  return cloned;
}

function inspectLoadedModel(model, gltf) {
  const stats = {
    meshes: 0,
    skinnedMeshes: 0,
    bones: 0,
    skins: gltf.parser?.json?.skins?.length || 0,
    animations: gltf.animations?.length || 0,
    materials: gltf.parser?.json?.materials?.length || 0,
    images: gltf.parser?.json?.images?.length || 0,
  };
  model.traverse((node) => {
    if (node.isMesh) {
      stats.meshes += 1;
    }
    if (node.isSkinnedMesh) {
      stats.skinnedMeshes += 1;
    }
    if (node.isBone) {
      stats.bones += 1;
    }
  });
  return stats;
}

function rebuildSkeletonFromLoadedModel(model) {
  const uniqueBones = [];
  const seen = new Set();
  model.traverse((node) => {
    if (node.isSkinnedMesh && node.skeleton) {
      node.skeleton.bones.forEach((bone) => {
        if (!seen.has(bone.uuid)) {
          seen.add(bone.uuid);
          uniqueBones.push(bone);
        }
      });
    }
  });

  if (uniqueBones.length === 0) {
    return 0;
  }

  const exposedBones = uniqueBones.filter(shouldExposeEditorBone);
  const exposedSet = new Set(exposedBones.map((bone) => bone.uuid));
  const editableBones = exposedBones.length > 0 ? exposedBones : uniqueBones;
  const editableSet = exposedSet.size > 0 ? exposedSet : new Set(uniqueBones.map((bone) => bone.uuid));

  model.updateWorldMatrix(true, true);
  clearSkeleton();

  const idByBone = new Map();
  editableBones.forEach((bone) => {
    const worldPosition = new THREE.Vector3();
    bone.getWorldPosition(worldPosition);
    const color = colorForBoneName(bone.name);
    const joint = addJoint(bone.name || `bone_${idByBone.size + 1}`, worldPosition, color);
    joint.sourceBone = bone;
    bone.getWorldQuaternion(joint.orientation);
    joint.basePosition.copy(joint.position);
    idByBone.set(bone.uuid, joint.id);
  });

  editableBones.forEach((bone) => {
    const startId = idByBone.get(bone.uuid);
    const visibleChildren = findNextEditorChildren(bone, editableSet);
    visibleChildren.forEach((child) => {
      const endId = idByBone.get(child.uuid);
      state.bones.push({
        id: `b${state.nextBone++}`,
        name: bone.name || child.name || `bone_${state.nextBone}`,
        start: startId,
        end: endId,
        color: colorForBoneName(bone.name || child.name),
        sourceBone: bone,
        sourceChildBone: child,
      });
    });
  });

  const preferredRoot = editableBones.find((bone) => /^hip$/i.test(bone.name))
    || editableBones.find((bone) => /pelvis|waist|root/i.test(bone.name))
    || editableBones[0];
  storeSourceRestPose(true);
  selectJoint(idByBone.get(preferredRoot.uuid));
  syncSkeletonMeshes();
  return state.bones.length;
}

function shouldExposeEditorBone(bone) {
  const name = (bone.name || "").toLowerCase();
  if (!name) {
    return false;
  }
  if (name.includes("twist") || name.includes("roll") || name.includes("ik") || name.includes("pole") || name.includes("end")) {
    return false;
  }
  if (name.includes("tripo") || name === "armature") {
    return false;
  }
  return /root|hip|pelvis|waist|spine|neck|head|clavicle|shoulder|upperarm|upper_arm|forearm|lowerarm|lower_arm|hand|thigh|calf|shin|foot|toe/.test(name);
}

function findNextEditorChildren(sourceBone, editableSet) {
  const result = [];
  const visit = (node) => {
    node.children.forEach((child) => {
      if (!child.isBone) {
        return;
      }
      if (editableSet.has(child.uuid)) {
        result.push(child);
      } else {
        visit(child);
      }
    });
  };
  visit(sourceBone);
  return result;
}

function colorForBoneName(name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("left") || lower.endsWith(".l") || lower.includes("_l") || lower.startsWith("l_")) {
    return "#4fc3ff";
  }
  if (lower.includes("right") || lower.endsWith(".r") || lower.includes("_r") || lower.startsWith("r_")) {
    return "#ffc84a";
  }
  if (lower.includes("leg") || lower.includes("foot") || lower.includes("toe")) {
    return "#55e38d";
  }
  if (lower.includes("arm") || lower.includes("hand") || lower.includes("finger")) {
    return "#ff5ec4";
  }
  return "#3ee5e8";
}

function disposeObject(object) {
  object.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => material.dispose?.());
    }
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function normalizeLoadedModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? 2.1 / size.y : 1;
  object.position.sub(center);
  object.scale.setScalar(scale);
  const newBox = new THREE.Box3().setFromObject(object);
  object.position.y -= newBox.min.y;
}

function initWeightCloud() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  weightPoints.length = 0;

  for (let i = 0; i < 210; i += 1) {
    const t = i / 209;
    const y = 0.12 + t * 1.94;
    const width = y > 1.12 ? 0.36 - Math.abs(y - 1.55) * 0.18 : 0.24;
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * Math.random() * Math.max(0.08, width);
    const z = (Math.random() - 0.5) * 0.22;
    const weight = THREE.MathUtils.clamp(1 - Math.abs(y - 1.05), 0.08, 0.78);
    positions.push(x, y, z);
    colors.push(...weightToColor(weight));
    weightPoints.push({ position: new THREE.Vector3(x, y, z), weight });
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.95 });
  weightCloud = new THREE.Points(geometry, material);
  helperRoot.add(weightCloud);
  updateWeightPointVisibility();
}

function initBrushCursor() {
  const group = new THREE.Group();
  group.name = "weightBrushCursor";
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1, 72),
    new THREE.MeshBasicMaterial({
      color: 0xff5ec4,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.name = "weightBrushRing";
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.055, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  inner.name = "weightBrushCenter";
  group.add(ring, inner);
  group.visible = false;
  group.renderOrder = 60;
  helperRoot.add(group);
  brushCursor = group;
  updateBrushCursorScale();
}

function updateWeightPointVisibility() {
  if (!weightCloud) {
    return;
  }
  weightCloud.visible = state.mode === "paint" && state.showWeightPoints;
  if (el.weightPointsToggle) {
    el.weightPointsToggle.checked = state.showWeightPoints;
  }
}

function updateWeightModeDisplay() {
  updateWeightPointVisibility();
  if (state.mode !== "paint") {
    restoreImportedModelMaterials();
    if (brushCursor) {
      brushCursor.visible = false;
    }
    return;
  }

  applyWeightPreviewMaterials();
  updateWeightPreviewColors();
  renderWeightBoneSelect();
  if (state.weightToolMode === "brush") {
    showBrushAtSelection();
  } else if (brushCursor) {
    brushCursor.visible = false;
  }
}

function restoreImportedModelMaterials() {
  if (!loadedModel) {
    return;
  }
  const opacity = THREE.MathUtils.clamp(state.modelOpacity, 0.02, 1);
  loadedModel.traverse((node) => {
    if (!node.isMesh || !node.userData.actionRigBaseMaterial) {
      return;
    }
    node.material = node.userData.actionRigBaseMaterial;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      material.transparent = opacity < 1;
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.95;
    });
  });
}

function getWeightPaintMeshes() {
  const meshes = [];
  loadedModel?.traverse((node) => {
    if (node.isSkinnedMesh && node.geometry?.attributes?.position) {
      meshes.push(node);
    }
  });
  return meshes;
}

function applyWeightPreviewMaterials() {
  const meshes = getWeightPaintMeshes();
  meshes.forEach((mesh) => {
    if (!mesh.userData.actionRigWeightMaterial) {
      mesh.userData.actionRigWeightMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      mesh.userData.actionRigWeightMaterial.userData.isWeightPreview = true;
    }
    mesh.material = mesh.userData.actionRigWeightMaterial;
  });
}

function updateWeightPreviewColors() {
  if (!loadedModel) {
    return;
  }
  const selectedInfluence = getSelectedWeightInfluence();
  getWeightPaintMeshes().forEach((mesh) => updateWeightPreviewColorsForMesh(mesh, selectedInfluence));
}

function updateWeightPreviewColorsForMesh(mesh, selectedInfluence, vertexIndices = null) {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  let colorAttribute = geometry.attributes.color;
  if (!colorAttribute || colorAttribute.count !== position.count) {
    colorAttribute = new THREE.BufferAttribute(new Float32Array(position.count * 3), 3);
    geometry.setAttribute("color", colorAttribute);
  }
  const indices = vertexIndices || null;
  const count = indices ? indices.length : position.count;
  for (let item = 0; item < count; item += 1) {
    const index = indices ? indices[item] : item;
    const totalWeight = getVertexTotalSkinWeight(mesh, index);
    const selectedWeight = selectedInfluence ? getEditableWeightForInfluence(mesh, selectedInfluence, index) : 0;
    const color = getWeightPreviewColor(selectedWeight, totalWeight);
    colorAttribute.setXYZ(index, color.r, color.g, color.b);
  }
  colorAttribute.needsUpdate = true;
}

function getWeightPreviewColor(selectedWeight, totalWeight) {
  const selected = THREE.MathUtils.clamp(selectedWeight, 0, 1);
  if (selected > 0.015) {
    const color = new THREE.Color();
    if (selected < 0.5) {
      color.lerpColors(WEIGHT_COLORS.selectedLow, WEIGHT_COLORS.selectedMid, selected * 2);
    } else {
      color.lerpColors(WEIGHT_COLORS.selectedMid, WEIGHT_COLORS.selectedHigh, (selected - 0.5) * 2);
    }
    return color;
  }
  if (totalWeight > 0.015) {
    return WEIGHT_COLORS.otherBound;
  }
  return WEIGHT_COLORS.unbound;
}

function getSelectedWeightSourceBone() {
  const selectedBone = getSelectedBone();
  const selectedJoint = getSelectedJoint();
  if (state.selectionKind === "bone") {
    return getPoseSourceBone(selectedBone) || selectedJoint?.sourceBone || null;
  }
  return selectedJoint?.sourceBone || getPoseSourceBone(selectedBone) || null;
}

function getSelectedWeightInfluence() {
  const selectedBone = getSelectedBone();
  const selectedJoint = getSelectedJoint();
  let label = selectedBone?.name || selectedJoint?.name || "";
  let bones = [];
  if (state.selectionKind === "bone" && selectedBone?.sourceBone) {
    bones = collectSourceInfluenceBones(selectedBone.sourceBone, selectedBone.sourceChildBone);
    label = selectedBone.name;
  } else if (selectedJoint?.sourceBone) {
    const outgoing = getWeightOutgoingBoneForJoint(selectedJoint.id);
    bones = outgoing?.sourceBone
      ? collectSourceInfluenceBones(outgoing.sourceBone, outgoing.sourceChildBone)
      : collectSourceInfluenceBones(selectedJoint.sourceBone, null);
    label = outgoing?.name || selectedJoint.sourceBone.name || selectedJoint.name;
  } else if (selectedBone?.sourceBone) {
    bones = collectSourceInfluenceBones(selectedBone.sourceBone, selectedBone.sourceChildBone);
    label = selectedBone.name;
  }
  const unique = [];
  const seen = new Set();
  bones.forEach((bone) => {
    if (bone?.isBone && !seen.has(bone.uuid)) {
      seen.add(bone.uuid);
      unique.push(bone);
    }
  });
  if (unique.length === 0) {
    const fallback = getSelectedWeightSourceBone();
    if (fallback) {
      unique.push(fallback);
      label = label || fallback.name;
    }
  }
  return unique.length ? { label, bones: unique, key: unique.map((bone) => bone.uuid).join("|") } : null;
}

function collectSourceInfluenceBones(rootBone, stopBeforeBone) {
  if (!rootBone) {
    return [];
  }
  const result = [];
  const stopUuid = stopBeforeBone?.uuid || null;
  const visit = (bone, depth = 0) => {
    if (!bone?.isBone || depth > 18 || bone.uuid === stopUuid) {
      return;
    }
    result.push(bone);
    bone.children.forEach((child) => {
      if (child.isBone) {
        visit(child, depth + 1);
      }
    });
  };
  visit(rootBone);
  return result;
}

function getSourceBoneIndex(mesh, sourceBone) {
  if (!mesh?.skeleton || !sourceBone) {
    return -1;
  }
  return mesh.skeleton.bones.findIndex((bone) => bone.uuid === sourceBone.uuid);
}

function getVertexTotalSkinWeight(mesh, vertexIndex) {
  const skinWeight = mesh.geometry.attributes.skinWeight;
  if (!skinWeight) {
    return 0;
  }
  return (skinWeight.getX(vertexIndex) || 0)
    + (skinWeight.getY(vertexIndex) || 0)
    + (skinWeight.getZ(vertexIndex) || 0)
    + (skinWeight.getW(vertexIndex) || 0);
}

function getEditableWeightForBone(mesh, sourceBone, vertexIndex) {
  const weights = getEditableWeightBuffer(mesh, sourceBone);
  return weights ? weights[vertexIndex] || 0 : 0;
}

function getEditableWeightForInfluence(mesh, influence, vertexIndex) {
  const weights = getEditableWeightBufferForInfluence(mesh, influence);
  return weights ? weights[vertexIndex] || 0 : 0;
}

function getEditableWeightBufferForInfluence(mesh, influence) {
  const geometry = mesh.geometry;
  if (!geometry?.attributes?.position || !influence?.bones?.length) {
    return null;
  }
  if (!geometry.userData.actionRigEditableInfluenceWeights) {
    geometry.userData.actionRigEditableInfluenceWeights = new Map();
  }
  const cache = geometry.userData.actionRigEditableInfluenceWeights;
  if (cache.has(influence.key)) {
    return cache.get(influence.key);
  }
  const position = geometry.attributes.position;
  const weights = new Float32Array(position.count);
  const skinIndex = geometry.attributes.skinIndex;
  const skinWeight = geometry.attributes.skinWeight;
  const boneIndices = influence.bones
    .map((bone) => getSourceBoneIndex(mesh, bone))
    .filter((index) => index >= 0);
  if (skinIndex && skinWeight && boneIndices.length > 0) {
    for (let index = 0; index < position.count; index += 1) {
      let value = 0;
      boneIndices.forEach((boneIndex) => {
        value += readSkinWeightForBone(skinIndex, skinWeight, index, boneIndex);
      });
      weights[index] = THREE.MathUtils.clamp(value, 0, 1);
    }
  }
  cache.set(influence.key, weights);
  return weights;
}

function getEditableWeightBuffer(mesh, sourceBone) {
  const geometry = mesh.geometry;
  if (!geometry?.attributes?.position || !sourceBone) {
    return null;
  }
  if (!geometry.userData.actionRigEditableWeights) {
    geometry.userData.actionRigEditableWeights = new Map();
  }
  const cache = geometry.userData.actionRigEditableWeights;
  if (cache.has(sourceBone.uuid)) {
    return cache.get(sourceBone.uuid);
  }
  const initial = buildInitialWeightBuffer(mesh, sourceBone);
  cache.set(sourceBone.uuid, initial);
  return initial;
}

function buildInitialWeightBuffer(mesh, sourceBone) {
  const position = mesh.geometry.attributes.position;
  const weights = new Float32Array(position.count);
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const skinWeight = mesh.geometry.attributes.skinWeight;
  const boneIndex = getSourceBoneIndex(mesh, sourceBone);
  if (!skinIndex || !skinWeight || boneIndex < 0) {
    return weights;
  }

  for (let index = 0; index < position.count; index += 1) {
    weights[index] = readSkinWeightForBone(skinIndex, skinWeight, index, boneIndex);
  }
  return weights;
}

function readSkinWeightForBone(skinIndex, skinWeight, vertexIndex, boneIndex) {
  const indices = [
    skinIndex.getX(vertexIndex),
    skinIndex.getY(vertexIndex),
    skinIndex.getZ(vertexIndex),
    skinIndex.getW(vertexIndex),
  ];
  const weights = [
    skinWeight.getX(vertexIndex),
    skinWeight.getY(vertexIndex),
    skinWeight.getZ(vertexIndex),
    skinWeight.getW(vertexIndex),
  ];
  for (let item = 0; item < 4; item += 1) {
    if (Math.round(indices[item]) === boneIndex) {
      return weights[item] || 0;
    }
  }
  return 0;
}

function updateBrushCursorScale() {
  if (!brushCursor) {
    return;
  }
  brushCursor.scale.setScalar(state.brushRadius);
}

function showBrushAtSelection() {
  if (!brushCursor || state.mode !== "paint" || state.weightToolMode !== "brush") {
    return;
  }
  const joint = getSelectedJoint();
  if (!joint) {
    brushCursor.visible = false;
    return;
  }
  brushCursor.visible = true;
  brushCursor.position.copy(joint.position);
  brushCursor.quaternion.copy(camera.quaternion);
  updateBrushCursorScale();
}

function updateBrushCursorFromPointer(event) {
  const hit = pickWeightSurface(event);
  if (!brushCursor) {
    return hit;
  }
  if (!hit) {
    brushCursor.visible = false;
    return null;
  }
  brushCursor.visible = state.mode === "paint" && state.weightToolMode === "brush";
  brushCursor.position.copy(hit.point);
  const normal = getHitWorldNormal(hit);
  brushCursor.position.addScaledVector(normal, 0.008);
  brushCursor.quaternion.copy(camera.quaternion);
  updateBrushCursorScale();
  return hit;
}

function pickWeightSurface(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const meshes = getWeightPaintMeshes();
  if (meshes.length > 0) {
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.find((hit) => hit.object?.isSkinnedMesh) || null;
  }
  if (pointerToRigPlane(event, dragPoint)) {
    return {
      object: null,
      point: dragPoint.clone(),
      face: null,
    };
  }
  return null;
}

function getHitWorldNormal(hit) {
  if (!hit?.face?.normal || !hit.object) {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).normalize();
  }
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
}

function resetWeights() {
  weightPoints.forEach((point) => {
    point.weight = 0.18;
  });
  updateWeightColors();
}

function paintAtPointer(event) {
  const hit = updateBrushCursorFromPointer(event);
  if (!hit) {
    return;
  }
  if (hit.object?.isSkinnedMesh) {
    paintMeshWeights(hit);
  } else {
    paintDebugWeightPoints(hit.point);
  }
  if (state.showWeightPoints) {
    paintDebugWeightPoints(hit.point);
  }
}

function paintMeshWeights(hit) {
  const selectedInfluence = getSelectedWeightInfluence();
  if (!selectedInfluence) {
    setStatus("请先选中要调整权重的骨骼");
    return;
  }
  const mesh = hit.object;
  const weights = getEditableWeightBufferForInfluence(mesh, selectedInfluence);
  if (!weights) {
    return;
  }

  const affected = getWeightVerticesInRadius(mesh, hit.point, state.brushRadius);
  let sum = 0;
  affected.forEach(({ index }) => {
    sum += weights[index];
  });

  if (affected.length === 0) {
    return;
  }
  const smoothTarget = sum / affected.length;
  affected.forEach(({ index, falloff }) => {
    if (state.paintMode === "add") {
      weights[index] = THREE.MathUtils.clamp(weights[index] + falloff * state.brushStrength * 0.075, 0, 1);
    } else if (state.paintMode === "subtract") {
      weights[index] = THREE.MathUtils.clamp(weights[index] - falloff * state.brushStrength * 0.075, 0, 1);
    } else {
      weights[index] += (smoothTarget - weights[index]) * falloff * state.brushStrength * 0.32;
    }
  });
  updateWeightPreviewColorsForMesh(mesh, selectedInfluence, affected.map((item) => item.index));
  setStatus(`权重笔刷：${selectedInfluence.label}，软边影响 ${affected.length} 点`);
}

function getSkinnedVertexWorldPosition(mesh, vertexIndex, target) {
  target.fromBufferAttribute(mesh.geometry.attributes.position, vertexIndex);
  if (mesh.isSkinnedMesh && typeof mesh.applyBoneTransform === "function") {
    mesh.applyBoneTransform(vertexIndex, target);
  }
  return mesh.localToWorld(target);
}

function getWeightVerticesInRadius(mesh, center, radius) {
  const cache = ensureWeightSpatialCache(mesh);
  if (!cache) {
    return [];
  }
  const radiusSq = radius * radius;
  const cellRadius = Math.ceil(radius / cache.cellSize);
  const baseX = Math.floor(center.x / cache.cellSize);
  const baseY = Math.floor(center.y / cache.cellSize);
  const baseZ = Math.floor(center.z / cache.cellSize);
  const affected = [];
  const seen = new Set();
  for (let x = baseX - cellRadius; x <= baseX + cellRadius; x += 1) {
    for (let y = baseY - cellRadius; y <= baseY + cellRadius; y += 1) {
      for (let z = baseZ - cellRadius; z <= baseZ + cellRadius; z += 1) {
        const bucket = cache.buckets.get(`${x},${y},${z}`);
        if (!bucket) {
          continue;
        }
        bucket.forEach((index) => {
          if (seen.has(index)) {
            return;
          }
          seen.add(index);
          const offset = index * 3;
          const dx = cache.worldPositions[offset] - center.x;
          const dy = cache.worldPositions[offset + 1] - center.y;
          const dz = cache.worldPositions[offset + 2] - center.z;
          const distanceSq = dx * dx + dy * dy + dz * dz;
          if (distanceSq > radiusSq) {
            return;
          }
          affected.push({
            index,
            falloff: softBrushFalloff(Math.sqrt(distanceSq), radius),
          });
        });
      }
    }
  }
  return affected;
}

function ensureWeightSpatialCache(mesh) {
  const position = mesh.geometry.attributes.position;
  if (!position) {
    return null;
  }
  const cache = mesh.userData.actionRigWeightSpatialCache;
  if (cache?.count === position.count) {
    return cache;
  }
  const cellSize = 0.075;
  const worldPositions = new Float32Array(position.count * 3);
  const buckets = new Map();
  const worldVertex = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    getSkinnedVertexWorldPosition(mesh, index, worldVertex);
    const offset = index * 3;
    worldPositions[offset] = worldVertex.x;
    worldPositions[offset + 1] = worldVertex.y;
    worldPositions[offset + 2] = worldVertex.z;
    const key = `${Math.floor(worldVertex.x / cellSize)},${Math.floor(worldVertex.y / cellSize)},${Math.floor(worldVertex.z / cellSize)}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(index);
  }
  const next = { count: position.count, cellSize, worldPositions, buckets };
  mesh.userData.actionRigWeightSpatialCache = next;
  return next;
}

function softBrushFalloff(distance, radius) {
  const t = THREE.MathUtils.clamp(distance / Math.max(radius, 0.0001), 0, 1);
  const inv = 1 - t;
  return inv * inv * (3 - 2 * inv);
}

function paintDebugWeightPoints(center) {
  const radius = state.brushRadius;
  weightPoints.forEach((point) => {
    const distance = point.position.distanceTo(center);
    if (distance > radius) {
      return;
    }
    const falloff = softBrushFalloff(distance, radius);
    if (state.paintMode === "add") {
      point.weight = THREE.MathUtils.clamp(point.weight + falloff * state.brushStrength * 0.045, 0, 1);
    } else if (state.paintMode === "subtract") {
      point.weight = THREE.MathUtils.clamp(point.weight - falloff * state.brushStrength * 0.045, 0, 1);
    } else {
      point.weight += (0.5 - point.weight) * falloff * state.brushStrength * 0.08;
    }
  });
  updateWeightColors();
}

function updateWeightColors() {
  const colors = weightCloud.geometry.attributes.color;
  weightPoints.forEach((point, index) => {
    const color = weightToColor(point.weight);
    colors.setXYZ(index, color[0], color[1], color[2]);
  });
  colors.needsUpdate = true;
}

function updateBrushPreview() {
  updateBrushCursorScale();
  setStatus(`笔刷半径 ${state.brushRadius.toFixed(2)}，强度 ${state.brushStrength.toFixed(2)}`);
}

function weightToColor(weight) {
  const blue = new THREE.Color(0x286dff);
  const red = new THREE.Color(0xff3f66);
  const yellow = new THREE.Color(0xffd84f);
  const color = new THREE.Color();
  if (weight < 0.5) {
    color.lerpColors(blue, yellow, weight * 2);
  } else {
    color.lerpColors(yellow, red, (weight - 0.5) * 2);
  }
  return [color.r, color.g, color.b];
}

function clampFrame(frame) {
  const value = Number.parseInt(frame, 10);
  if (!Number.isFinite(value)) {
    return state.currentFrame;
  }
  return THREE.MathUtils.clamp(value, 1, WALK_LOOP_FRAME);
}

function frameToPhase(frame) {
  return (clampFrame(frame) - 1) / WALK_FRAME_COUNT;
}

function frameToPercent(frame) {
  return `${frameToPhase(frame) * 100}%`;
}

function frameContactLabel(frame) {
  return frame <= 12 || frame === WALK_LOOP_FRAME ? "左脚接地" : "右脚接地";
}

function stopPlayback() {
  state.isPlaying = false;
  el.playButton.textContent = "播放";
  el.playbackState.textContent = "停止";
}

function selectFrame(frame, options = {}) {
  const { applyPose = true, announce = true, stopPlayback: shouldStopPlayback = true } = options;
  const nextFrame = clampFrame(frame);
  if (shouldStopPlayback) {
    stopPlayback();
  }
  state.currentFrame = nextFrame;
  if (applyPose) {
    applyAnimationAtFrame(nextFrame);
  }
  renderTimeline();
  if (announce) {
    setStatus(`已选择第 ${nextFrame} 帧`);
  }
  return nextFrame;
}

function onTimelineTrackClick(event) {
  if (event.target.closest(".frame-tick")) {
    return;
  }
  const rect = el.timelineTrack.getBoundingClientRect();
  const normalized = THREE.MathUtils.clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const frame = 1 + Math.round(normalized * WALK_FRAME_COUNT);
  selectFrame(frame, { announce: true, stopPlayback: true });
}

function roundArray(values, digits = 6) {
  return values.map((value) => Number(value.toFixed(digits)));
}

function captureSourcePoseTransforms() {
  return collectSourceBonesForSnapshots().map((sourceBone) => ({
    uuid: sourceBone.uuid,
    name: sourceBone.name || "",
    position: roundArray(sourceBone.position.toArray()),
    quaternion: roundArray(sourceBone.quaternion.toArray()),
    scale: roundArray(sourceBone.scale.toArray()),
  }));
}

function storeSourceRestPose(force = false) {
  if (!loadedModel) {
    return;
  }
  loadedModel.updateWorldMatrix(true, true);
  collectSourceBonesForSnapshots().forEach((sourceBone) => {
    if (!force && sourceBone.userData.actionRigRestPose) {
      return;
    }
    const worldQuaternion = new THREE.Quaternion();
    sourceBone.getWorldQuaternion(worldQuaternion);
    sourceBone.userData.actionRigRestPose = {
      position: sourceBone.position.clone(),
      quaternion: sourceBone.quaternion.clone(),
      scale: sourceBone.scale.clone(),
      worldQuaternion,
    };
  });
}

function restoreSourceRestPose() {
  let restored = false;
  collectSourceBonesForSnapshots().forEach((sourceBone) => {
    const rest = sourceBone.userData.actionRigRestPose;
    if (!rest) {
      return;
    }
    sourceBone.position.copy(rest.position);
    sourceBone.quaternion.copy(rest.quaternion);
    sourceBone.scale.copy(rest.scale);
    restored = true;
  });
  if (restored) {
    loadedModel?.updateWorldMatrix(true, true);
  }
  return restored;
}

function hasSavedPose(keyframe) {
  return Boolean(keyframe?.sourceTransforms?.length || keyframe?.joints?.length);
}

function applyAnimationAtFrame(frame) {
  return applyAnimationAtPhase(frameToPhase(frame));
}

function applyAnimationAtPhase(phase) {
  const savedPoseKeyframes = state.keyframes.filter(hasSavedPose).sort((a, b) => a.frame - b.frame);
  if (savedPoseKeyframes.length === 0) {
    applyWalkPose(phase);
    return false;
  }

  const frame = 1 + (THREE.MathUtils.euclideanModulo(phase, 1) * WALK_FRAME_COUNT);
  const span = findKeyframeSpan(savedPoseKeyframes, frame);
  if (span.prev.sourceTransforms?.length || span.next.sourceTransforms?.length) {
    applyBlendedSourcePose(span.prev, span.next, span.alpha);
  } else {
    applyBlendedJointPose(span.prev, span.next, span.alpha);
  }
  updateWalkContactMarkers(phase);
  return true;
}

function findKeyframeSpan(keyframes, frame) {
  if (keyframes.length === 1) {
    return { prev: keyframes[0], next: keyframes[0], alpha: 0 };
  }

  for (let index = 0; index < keyframes.length; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    if (!next) {
      break;
    }
    if (frame >= current.frame && frame <= next.frame) {
      const distance = Math.max(next.frame - current.frame, 0.0001);
      return { prev: current, next, alpha: THREE.MathUtils.clamp((frame - current.frame) / distance, 0, 1) };
    }
  }

  const prev = frame < keyframes[0].frame ? keyframes[keyframes.length - 1] : keyframes[keyframes.length - 1];
  const next = keyframes[0];
  const prevFrame = frame < keyframes[0].frame ? prev.frame - WALK_FRAME_COUNT : prev.frame;
  const nextFrame = next.frame + WALK_FRAME_COUNT;
  const distance = Math.max(nextFrame - prevFrame, 0.0001);
  return { prev, next, alpha: THREE.MathUtils.clamp((frame - prevFrame) / distance, 0, 1) };
}

function sourceTransformFor(sourceBone, keyframe) {
  return keyframe.sourceTransforms?.find((item) => item.uuid === sourceBone.uuid || item.name === sourceBone.name) || null;
}

function applyBlendedSourcePose(prev, next, alpha) {
  collectSourceBonesForSnapshots().forEach((sourceBone) => {
    const prevTransform = sourceTransformFor(sourceBone, prev);
    const nextTransform = sourceTransformFor(sourceBone, next);
    const from = prevTransform || nextTransform;
    const to = nextTransform || prevTransform;
    if (!from || !to) {
      return;
    }

    sourceBone.position.lerpVectors(
      new THREE.Vector3().fromArray(from.position),
      new THREE.Vector3().fromArray(to.position),
      alpha,
    );
    sourceBone.quaternion.slerpQuaternions(
      new THREE.Quaternion().fromArray(from.quaternion),
      new THREE.Quaternion().fromArray(to.quaternion),
      alpha,
    );
    sourceBone.scale.lerpVectors(
      new THREE.Vector3().fromArray(from.scale),
      new THREE.Vector3().fromArray(to.scale),
      alpha,
    );
  });
  loadedModel?.updateWorldMatrix(true, true);
  syncEditorJointsFromSourceBones();
}

function jointPoseMap(keyframe) {
  return new Map((keyframe.joints || []).map((joint) => [joint.name, joint]));
}

function applyBlendedJointPose(prev, next, alpha) {
  const prevMap = jointPoseMap(prev);
  const nextMap = jointPoseMap(next);
  state.joints.forEach((joint) => {
    const from = prevMap.get(joint.name) || nextMap.get(joint.name);
    const to = nextMap.get(joint.name) || prevMap.get(joint.name);
    if (!from || !to) {
      return;
    }
    joint.position.lerpVectors(
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
      alpha,
    );
  });
  syncSkeletonMeshes();
}

function captureEditorJointPose() {
  return state.joints.map((joint) => ({
    name: joint.name,
    x: Number(joint.position.x.toFixed(3)),
    y: Number(joint.position.y.toFixed(3)),
    z: Number(joint.position.z.toFixed(3)),
  }));
}

function saveCurrentKeyframe() {
  pushUndo("保存关键帧");
  const existing = state.keyframes.find((keyframe) => keyframe.frame === state.currentFrame);
  const snapshot = {
    frame: state.currentFrame,
    contact: frameContactLabel(state.currentFrame),
    joints: captureEditorJointPose(),
    sourceTransforms: captureSourcePoseTransforms(),
  };
  if (existing) {
    Object.assign(existing, snapshot);
  } else {
    state.keyframes.push(snapshot);
  }
  state.keyframes.sort((a, b) => a.frame - b.frame);
  renderTimeline();
  setStatus(`已保存第 ${state.currentFrame} 帧关键姿势`);
}

function generateWalkTemplate(showStatus = true) {
  if (showStatus) {
    pushUndo("生成走路模板");
  }
  const frames = [1, 4, 7, 10, 13, 16, 19, 22, WALK_LOOP_FRAME];
  state.keyframes = frames.map((frame) => {
    applyWalkPose(frameToPhase(frame));
    return {
      frame,
      contact: frame <= 10 || frame === WALK_LOOP_FRAME ? "左脚接地" : "右脚接地",
      stride: Number(state.stride.toFixed(2)),
      hipBounce: Number(state.hipBounce.toFixed(2)),
      armSwing: Number(state.armSwing.toFixed(2)),
      generated: true,
      joints: captureEditorJointPose(),
      sourceTransforms: captureSourcePoseTransforms(),
    };
  });
  selectFrame(1, { announce: false, stopPlayback: true });
  if (showStatus) {
    setStatus("已生成 24 帧走路循环：接触、下沉、经过、上升关键帧已标记");
  }
}

function smoothKeyframes() {
  pushUndo("平滑关键帧");
  state.keyframes.forEach((keyframe) => {
    keyframe.transition = `平滑 ${Math.round(state.smoothness * 100)}%`;
  });
  renderTimeline();
  setStatus("已模拟优化两帧之间的动作过渡：曲线平滑、脚底接触点保留");
}

function togglePlayback() {
  if (state.isPlaying) {
    stopPlayback();
    return;
  }

  if (state.keyframes.length === 0) {
    generateWalkTemplate(false);
  }
  state.isPlaying = true;
  state.playStartMs = performance.now() - frameToPhase(state.currentFrame) * 1600;
  el.playButton.textContent = "暂停";
  el.playbackState.textContent = "播放中";
  setMode("motion");
}

function applyWalkPose(phase) {
  const twoPi = Math.PI * 2;
  const stride = state.stride;
  const hipOffset = Math.sin(phase * twoPi * 2) * state.hipBounce;
  const legSwing = Math.sin(phase * twoPi) * stride * 0.38;
  const armSwing = Math.sin(phase * twoPi + Math.PI) * state.armSwing * 0.36;

  const droveSource = applyProceduralSourceWalkPose({ phase, hipOffset, legSwing, armSwing });
  if (!droveSource) {
    const basis = getMotionBasis();
    const forwardOffset = (amount) => basis.forward.clone().multiplyScalar(amount);
    state.joints.forEach((joint) => {
      joint.position.copy(joint.basePosition);
    });

    const hips = findJointByRole("hip");
    if (hips) {
      hips.position.y = hips.basePosition.y + hipOffset;
    }

    moveJointByRoleVector("foot", "L", forwardOffset(legSwing));
    moveJointByRoleVector("calf", "L", forwardOffset(legSwing * 0.42).add(new THREE.Vector3(0, Math.max(0, -legSwing) * 0.08, 0)));
    moveJointByRoleVector("thigh", "L", forwardOffset(legSwing * 0.12));
    moveJointByRoleVector("foot", "R", forwardOffset(-legSwing));
    moveJointByRoleVector("calf", "R", forwardOffset(-legSwing * 0.42).add(new THREE.Vector3(0, Math.max(0, legSwing) * 0.08, 0)));
    moveJointByRoleVector("thigh", "R", forwardOffset(-legSwing * 0.12));
    moveJointByRoleVector("hand", "L", forwardOffset(-armSwing).add(new THREE.Vector3(0, armSwing, 0)));
    moveJointByRoleVector("forearm", "L", forwardOffset(-armSwing * 0.45).add(new THREE.Vector3(0, armSwing * 0.55, 0)));
    moveJointByRoleVector("hand", "R", forwardOffset(armSwing).add(new THREE.Vector3(0, -armSwing, 0)));
    moveJointByRoleVector("forearm", "R", forwardOffset(armSwing * 0.45).add(new THREE.Vector3(0, -armSwing * 0.55, 0)));
    syncSkeletonMeshes();
  }

  updateWalkContactMarkers(phase);
}

function updateWalkContactMarkers(phase) {
  const legSwing = Math.sin(phase * Math.PI * 2) * state.stride * 0.38;
  const basis = getMotionBasis();
  const center = findJointByRole("hip")?.position || getSelectedJoint()?.position || new THREE.Vector3();
  const base = new THREE.Vector3(center.x, 0.012, center.z);
  leftContact.position.copy(base)
    .addScaledVector(basis.right, -0.28)
    .addScaledVector(basis.forward, 0.18 + legSwing);
  rightContact.position.copy(base)
    .addScaledVector(basis.right, 0.28)
    .addScaledVector(basis.forward, -0.18 - legSwing);
  updateWalkDirectionHelper(basis, base);
}

function moveJointByRole(part, side, x, y, z) {
  const joint = findJointByRole(part, side);
  if (joint) {
    joint.position.add(new THREE.Vector3(x, y, z));
    joint.position.y = Math.max(0.035, joint.position.y);
  }
}

function moveJointByRoleVector(part, side, offset) {
  const joint = findJointByRole(part, side);
  if (joint) {
    joint.position.add(offset);
    joint.position.y = Math.max(0.035, joint.position.y);
  }
}

function normalizedRigName(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rigNameSide(name) {
  const normalized = normalizedRigName(name);
  if (normalized.startsWith("l") || normalized.endsWith("l") || normalized.includes("left")) {
    return "L";
  }
  if (normalized.startsWith("r") || normalized.endsWith("r") || normalized.includes("right")) {
    return "R";
  }
  return "";
}

function rigNameMatchesPart(name, part) {
  const normalized = normalizedRigName(name);
  const checks = {
    hip: () => normalized.includes("hip") || normalized.includes("pelvis") || normalized.includes("waist"),
    thigh: () => normalized.includes("thigh") || normalized.includes("upperleg"),
    calf: () => normalized.includes("calf") || normalized.includes("shin") || normalized.includes("lowerleg"),
    foot: () => normalized.includes("foot") || normalized.includes("toe"),
    upperArm: () => normalized.includes("upperarm") || normalized.includes("shoulder"),
    forearm: () => normalized.includes("forearm") || normalized.includes("lowerarm"),
    hand: () => normalized.includes("hand"),
  };
  return Boolean(checks[part]?.());
}

function findJointByRole(part, side = "") {
  return state.joints.find((joint) => (
    rigNameMatchesPart(joint.name, part)
    && (!side || rigNameSide(joint.name) === side)
  ));
}

function averageJointPositions(partNames, side) {
  const points = [];
  partNames.forEach((part) => {
    const joint = findJointByRole(part, side);
    if (joint) {
      points.push(joint.position);
    }
  });
  if (points.length === 0) {
    return null;
  }
  return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
}

function getCharacterBasis() {
  const up = new THREE.Vector3(0, 1, 0);
  const left = averageJointPositions(["thigh", "calf", "foot", "upperArm", "forearm", "hand"], "L");
  const right = averageJointPositions(["thigh", "calf", "foot", "upperArm", "forearm", "hand"], "R");
  const rightAxis = right && left ? right.clone().sub(left) : new THREE.Vector3(1, 0, 0);
  rightAxis.y = 0;
  if (rightAxis.lengthSq() < 0.0001) {
    rightAxis.set(1, 0, 0);
  }
  rightAxis.normalize();

  const forward = new THREE.Vector3().crossVectors(up, rightAxis);
  if (forward.lengthSq() < 0.0001) {
    forward.set(0, 0, 1);
  }
  forward.normalize();
  return { right: rightAxis, up, forward };
}

function getMotionBasis() {
  const basis = getCharacterBasis();
  const up = basis.up.clone();
  let forward = basis.forward.clone();
  if (state.walkDirection === "reverse") {
    forward.negate();
  } else if (state.walkDirection === "right") {
    forward.copy(basis.right);
  } else if (state.walkDirection === "left") {
    forward.copy(basis.right).negate();
  }
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) {
    forward.copy(basis.forward);
  }
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, up);
  if (right.lengthSq() < 0.0001) {
    right.copy(basis.right);
  }
  right.y = 0;
  right.normalize();
  return { right, up, forward };
}

function getWalkDirectionLabel(value) {
  return {
    auto: "角色前方",
    reverse: "角色后方",
    right: "角色右侧",
    left: "角色左侧",
  }[value] || "角色前方";
}

function findJointByName(name) {
  const lower = name.toLowerCase();
  return state.joints.find((joint) => joint.name.toLowerCase() === lower);
}

function findSourceBoneByRole(part, side = "") {
  const editorBone = state.bones.find((bone) => (
    rigNameMatchesPart(bone.name, part)
    && (!side || rigNameSide(bone.name) === side)
    && bone.sourceBone
  ));
  if (editorBone?.sourceBone) {
    return editorBone.sourceBone;
  }
  const joint = state.joints.find((item) => (
    rigNameMatchesPart(item.name, part)
    && (!side || rigNameSide(item.name) === side)
    && item.sourceBone
  ));
  return joint?.sourceBone || null;
}

function applyProceduralSourceWalkPose({ hipOffset, legSwing, armSwing }) {
  if (!loadedModel) {
    return false;
  }
  storeSourceRestPose(false);
  if (!restoreSourceRestPose()) {
    return false;
  }

  const basis = getMotionBasis();
  let changed = false;
  const makeRotation = (axis, amount) => new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount);
  const applyDelta = (part, side, delta) => {
    const sourceBone = findSourceBoneByRole(part, side);
    const rest = sourceBone?.userData.actionRigRestPose;
    if (!sourceBone || !rest) {
      return;
    }
    const desiredWorld = delta.clone().multiply(rest.worldQuaternion);
    setBoneWorldQuaternion(sourceBone, desiredWorld);
    sourceBone.updateWorldMatrix(true, true);
    changed = true;
  };
  const rotate = (part, side, axis, amount) => {
    if (Math.abs(amount) < 0.000001) {
      return;
    }
    applyDelta(part, side, makeRotation(axis, amount));
  };
  const roughArmDelta = (side, swingAmount, lower = false) => {
    const sideSign = side === "R" ? 1 : -1;
    const drop = makeRotation(basis.forward, sideSign * (lower ? 0.95 : 1.2));
    const swing = makeRotation(basis.right, sideSign * swingAmount);
    return swing.multiply(drop);
  };

  const offsetHip = () => {
    const sourceBone = findSourceBoneByRole("hip");
    const rest = sourceBone?.userData.actionRigRestPose;
    if (!sourceBone || !rest) {
      return;
    }
    sourceBone.position.copy(rest.position);
    sourceBone.position.y += hipOffset;
    sourceBone.updateWorldMatrix(true, true);
    changed = true;
  };

  offsetHip();
  rotate("thigh", "L", basis.right, legSwing * 1.25);
  rotate("thigh", "R", basis.right, -legSwing * 1.25);
  rotate("calf", "L", basis.right, 0.22 + Math.max(0, -legSwing) * 1.4);
  rotate("calf", "R", basis.right, 0.22 + Math.max(0, legSwing) * 1.4);
  applyDelta("upperArm", "L", roughArmDelta("L", -armSwing * 1.15));
  applyDelta("upperArm", "R", roughArmDelta("R", armSwing * 1.15));
  applyDelta("forearm", "L", roughArmDelta("L", -armSwing * 0.48, true));
  applyDelta("forearm", "R", roughArmDelta("R", armSwing * 0.48, true));

  if (changed) {
    loadedModel.updateWorldMatrix(true, true);
    syncEditorJointsFromSourceBones();
  }
  return changed;
}

function renderTimeline() {
  el.hudKeyframes.textContent = String(state.keyframes.length);
  el.frameNumberInput.value = String(state.currentFrame);
  el.frameRangeInput.value = String(state.currentFrame);
  renderKeyframeRecords();
  el.timelineTrack.innerHTML = "";
  const keyframeByFrame = new Map(state.keyframes.map((keyframe) => [keyframe.frame, keyframe]));

  for (let frame = 1; frame <= WALK_LOOP_FRAME; frame += 1) {
    const keyframe = keyframeByFrame.get(frame);
    const tick = document.createElement("button");
    tick.type = "button";
    tick.className = "frame-tick";
    tick.dataset.frame = String(frame);
    tick.textContent = String(frame);
    tick.style.left = frameToPercent(frame);
    tick.title = keyframe
      ? `第 ${frame} 帧 ${keyframe.contact || ""} ${keyframe.transition || ""}`
      : `第 ${frame} 帧`;
    if (frame === WALK_LOOP_FRAME) {
      tick.classList.add("frame-last");
    }
    if (frame === state.currentFrame) {
      tick.classList.add("is-current");
    }
    if (keyframe) {
      tick.classList.add("has-keyframe");
    }
    if (keyframe?.contact?.includes("左")) {
      tick.classList.add("contact-left");
    }
    if (keyframe?.contact?.includes("右")) {
      tick.classList.add("contact-right");
    }
    tick.addEventListener("click", (event) => {
      event.stopPropagation();
      selectFrame(frame, { announce: true, stopPlayback: true });
    });
    el.timelineTrack.appendChild(tick);
  }

  const playhead = document.createElement("div");
  playhead.className = "playhead";
  playhead.style.left = frameToPercent(state.currentFrame);
  el.timelineTrack.appendChild(playhead);
}

function renderKeyframeRecords() {
  const sortedKeyframes = [...state.keyframes].sort((a, b) => a.frame - b.frame);
  const currentKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame === state.currentFrame);
  el.keyframeRecordList.innerHTML = "";

  if (sortedKeyframes.length === 0) {
    const empty = document.createElement("span");
    empty.className = "keyframe-record-empty";
    empty.textContent = "暂无记录，选帧后点“保存当前帧”";
    el.keyframeRecordList.appendChild(empty);
  } else {
    sortedKeyframes.forEach((keyframe) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "record-frame-button";
      button.textContent = String(keyframe.frame);
      button.title = `跳到第 ${keyframe.frame} 帧${keyframe.contact ? `：${keyframe.contact}` : ""}`;
      if (keyframe.contact?.includes("左")) {
        button.classList.add("contact-left");
      }
      if (keyframe.contact?.includes("右")) {
        button.classList.add("contact-right");
      }
      if (keyframe.frame === state.currentFrame) {
        button.classList.add("is-current");
      }
      button.addEventListener("click", () => {
        selectFrame(keyframe.frame, { announce: true, stopPlayback: true });
      });
      el.keyframeRecordList.appendChild(button);
    });
  }

  const isSaved = Boolean(currentKeyframe);
  const saveStateText = isSaved
    ? `第 ${state.currentFrame} 帧已保存`
    : `第 ${state.currentFrame} 帧未保存`;
  el.currentFrameSaveState.textContent = saveStateText;
  el.currentFrameSaveState.classList.toggle("is-saved", isSaved);
  if (el.hudFrameState) {
    el.hudFrameState.textContent = isSaved
      ? `${state.currentFrame} 已保存`
      : `${state.currentFrame} 未保存`;
    el.hudFrameState.closest(".hud-frame-card")?.classList.toggle("is-saved", isSaved);
  }
}

function exportJson() {
  const data = {
    version: "action_rig_demo_mvp",
    mode: state.mode,
    bones: state.bones.map((bone) => ({
      name: bone.name,
      start: getJoint(bone.start)?.name,
      end: getJoint(bone.end)?.name,
      color: bone.color,
    })),
    joints: state.joints.map((joint) => ({
      name: joint.name,
      position: joint.position.toArray().map((value) => Number(value.toFixed(3))),
    })),
    keyframes: state.keyframes,
  };
  const text = JSON.stringify(data, null, 2);
  el.exportPreview.value = text.slice(0, 1200);
  navigator.clipboard?.writeText(text).catch(() => {});
  setStatus("已生成 JSON 预览，并尝试复制到剪贴板");
}

function updateCenterLine() {
  const hips = findJointByName("hips") || getSelectedJoint();
  if (!hips) {
    return;
  }
  centerLine.geometry.dispose();
  centerLine.geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(hips.position.x, 0.02, hips.position.z),
    new THREE.Vector3(hips.position.x, Math.max(2.25, hips.position.y + 1.2), hips.position.z),
  ]);
}

function makeContactDisk(color) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.17, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function createWorldAxisHelper() {
  const group = new THREE.Group();
  group.name = "worldXYZAxes";
  group.position.set(0, 0.035, 0);
  group.add(createAxisArrow("X", new THREE.Vector3(1, 0, 0), 0xff4b5f));
  group.add(createAxisArrow("Y", new THREE.Vector3(0, 1, 0), 0x53e37e));
  group.add(createAxisArrow("Z", new THREE.Vector3(0, 0, 1), 0x4f83ff));
  return group;
}

function createWalkDirectionHelper() {
  const group = new THREE.Group();
  group.name = "walkDirectionHelper";
  group.position.set(0, 0.055, 0);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.62, 0x3fffd2, 0.13, 0.06);
  arrow.name = "walkForwardArrow";
  arrow.traverse((child) => {
    if (child.material) {
      child.material.depthTest = false;
      child.material.depthWrite = false;
      child.renderOrder = 22;
    }
  });
  const label = makeAxisLabel("前", 0x3fffd2);
  label.name = "walkForwardLabel";
  group.add(arrow, label);
  return group;
}

function updateWalkDirectionHelper(basis, base) {
  if (!walkDirectionHelper) {
    return;
  }
  walkDirectionHelper.position.copy(base).setY(0.055);
  const arrow = walkDirectionHelper.getObjectByName("walkForwardArrow");
  const label = walkDirectionHelper.getObjectByName("walkForwardLabel");
  arrow?.setDirection(basis.forward);
  if (label) {
    label.position.copy(basis.forward.clone().multiplyScalar(0.78)).setY(0.18);
  }
}

function createAxisArrow(label, direction, color) {
  const length = label === "Y" ? 1.55 : 1.35;
  const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(0, 0, 0), length, color, 0.16, 0.075);
  arrow.name = `axis${label}`;
  arrow.traverse((child) => {
    if (child.material) {
      child.material.depthTest = false;
      child.material.depthWrite = false;
      child.renderOrder = 20;
    }
  });

  const labelSprite = makeAxisLabel(label, color);
  labelSprite.position.copy(direction.clone().multiplyScalar(length + 0.16));
  arrow.add(labelSprite);
  return arrow;
}

function makeAxisLabel(text, color) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 96;
  labelCanvas.height = 96;
  const context = labelCanvas.getContext("2d");
  context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  context.fillStyle = "rgba(6, 13, 22, 0.78)";
  context.beginPath();
  context.roundRect(18, 18, 60, 60, 14);
  context.fill();
  context.strokeStyle = `#${new THREE.Color(color).getHexString()}`;
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  context.font = "700 44px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 48, 50);

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }));
  sprite.name = `axis${text}Label`;
  sprite.scale.set(0.19, 0.19, 0.19);
  sprite.renderOrder = 21;
  return sprite;
}

function projectWorldToScreen(worldPosition) {
  const rect = canvas.getBoundingClientRect();
  const projected = worldPosition.clone().project(camera);
  return {
    x: rect.left + ((projected.x + 1) * 0.5 * rect.width),
    y: rect.top + ((1 - projected.y) * 0.5 * rect.height),
  };
}

function panCameraByScreenDelta(dx, dy) {
  const panScale = cameraDistance * 0.0012;
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  cameraTarget
    .addScaledVector(cameraRight, -dx * panScale)
    .addScaledVector(cameraUp, dy * panScale);
}

function updateCamera() {
  const x = Math.sin(yaw) * Math.cos(pitch) * cameraDistance;
  const y = Math.sin(pitch) * cameraDistance + 1.2;
  const z = Math.cos(yaw) * Math.cos(pitch) * cameraDistance;
  camera.position.set(x, y, z).add(cameraTarget);
  camera.lookAt(cameraTarget);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = Math.max(rect.width / Math.max(rect.height, 1), 0.1);
  camera.updateProjectionMatrix();
}

function animate(now = 0) {
  requestAnimationFrame(animate);
  if (state.isPlaying) {
    const elapsed = (now - state.playStartMs) / 1600;
    const phase = elapsed % 1;
    state.currentFrame = 1 + Math.floor(phase * WALK_FRAME_COUNT);
    applyAnimationAtPhase(phase);
    renderTimeline();
  }
  renderer.render(scene, camera);
}
