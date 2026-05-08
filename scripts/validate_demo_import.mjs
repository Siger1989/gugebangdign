import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const url = "http://localhost:8780/index.html";
const downloadModelPath = "C:/Users/bodean/Downloads/stylized+3d+character+model.glb";

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
  args: ["--use-gl=swiftshader", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const browserMessages = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    browserMessages.push(`${message.type()}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  browserMessages.push(`pageerror: ${error.message}`);
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#rigCanvas", { timeout: 10000 });

  const fileImport = await runImport(page, "file-input", async () => {
    await page.locator("#modelFileInput").setInputFiles(downloadModelPath);
  });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#rigCanvas", { timeout: 10000 });
  const testButtonImport = await runImport(page, "test-button", async () => {
    await page.click("#loadProjectModelButton");
  });
  const poseValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    window.__actionRigDebug.setTransformMode("rotate");
    const selected = window.__actionRigDebug.selectBoneByName("R_Forearm");
    const before = window.__actionRigDebug.getSelectedBoneInfo();
    const gizmoResult = window.__actionRigDebug.gizmoRotateSelected(0.2, 0.28, 0);
    const after = window.__actionRigDebug.getSelectedBoneInfo();
    const transformInfo = window.__actionRigDebug.getTransformInfo();
    const lengthDelta = before && after ? Math.abs(before.length - after.length) : null;
    const endMove = before && after
      ? Math.hypot(
        after.endPosition[0] - before.endPosition[0],
        after.endPosition[1] - before.endPosition[1],
        after.endPosition[2] - before.endPosition[2],
      )
      : null;
    return {
      selected,
      before,
      after,
      gizmoResult,
      transformInfo,
      lengthDelta,
      endMove,
      pass: Boolean(
        selected
        && gizmoResult
        && transformInfo.mode === "rotate"
        && transformInfo.attached
        && before?.hasSourceBone
        && after?.hasSourceBone
        && lengthDelta < 0.01
        && endMove > 0.01
      ),
    };
  });
  const modalValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    window.__actionRigDebug.setTransformMode("translate");
    const selected = window.__actionRigDebug.selectBoneByName("R_Forearm");
    const before = window.__actionRigDebug.getSelectedBoneInfo();
    const moved = window.__actionRigDebug.modalTransformSelected("translate", 90, -25);
    const afterMove = window.__actionRigDebug.getSelectedBoneInfo();
    const cancel = window.__actionRigDebug.modalCancelSelected("translate", 120, 0);
    const afterCancel = window.__actionRigDebug.getSelectedBoneInfo();
    const moveDelta = before && afterMove
      ? Math.hypot(
        afterMove.endPosition[0] - before.endPosition[0],
        afterMove.endPosition[1] - before.endPosition[1],
        afterMove.endPosition[2] - before.endPosition[2],
      )
      : null;
    const cancelDelta = cancel.before && afterCancel
      ? Math.hypot(
        afterCancel.endPosition[0] - cancel.before.endPosition[0],
        afterCancel.endPosition[1] - cancel.before.endPosition[1],
        afterCancel.endPosition[2] - cancel.before.endPosition[2],
      )
      : null;
    return {
      selected,
      moved,
      before,
      afterMove,
      cancel,
      afterCancel,
      moveDelta,
      cancelDelta,
      transformInfo: window.__actionRigDebug.getTransformInfo(),
      pass: Boolean(selected && moved && moveDelta > 0.01 && cancel.started && cancelDelta < 0.0001),
    };
  });
  const jointControlValidation = await page.evaluate(() => {
    const stats = window.__actionRigDebug.getStats();
    const firstJoint = stats.jointControlKinds?.[0] || [];
    const firstBone = stats.boneControlKinds?.[0] || [];
    return {
      jointSample: firstJoint,
      boneSample: firstBone,
      joints: stats.joints,
      pass: Boolean(
        firstJoint.includes("jointBox")
        && firstJoint.includes("jointRotateArrowShaft")
        && firstJoint.includes("jointRotateArrowHead")
        && firstJoint.includes("jointEmbeddedSocket")
        && firstBone.includes("boneEmbeddedBody")
        && firstBone.includes("boneEndPlug")
        && stats.worldAxisKinds.includes("axisX")
        && stats.worldAxisKinds.includes("axisY")
        && stats.worldAxisKinds.includes("axisZ")
      ),
    };
  });
  const transformHandlePriorityValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    const selected = window.__actionRigDebug.selectJointByName("Head") || window.__actionRigDebug.selectBoneByName("R_Forearm");
    window.__actionRigDebug.setTransformMode("rotate");
    const sample = window.__actionRigDebug.findTransformHandlePrioritySample();
    return {
      selected,
      sample,
      pass: Boolean(selected && sample?.transformHit && sample.priority === "transform"),
    };
  });
  const displaySizeValidation = await page.evaluate(() => {
    const before = window.__actionRigDebug.getDisplaySizeInfo();
    const changed = window.__actionRigDebug.setBoneDisplaySize({ thickness: 1.55, jointSize: 1.42 });
    const restored = window.__actionRigDebug.setBoneDisplaySize({ thickness: 1, jointSize: 1 });
    return {
      before,
      changed,
      restored,
      pass: Boolean(
        changed.boneThickness === 1.55
        && changed.jointSize === 1.42
        && Math.abs(changed.boneScale[0] - 1.55) < 0.001
        && Math.abs(changed.boneScale[2] - 1.55) < 0.001
        && Math.abs(changed.jointScale[0] - 1.42) < 0.001
        && Math.abs(restored.boneScale[0] - 1) < 0.001
        && Math.abs(restored.jointScale[0] - 1) < 0.001
      ),
    };
  });
  const poseJointValidation = await page.evaluate(() => {
    const lengthDelta = (before, after) => Math.abs((after?.length ?? 0) - (before?.length ?? 0));
    const endDelta = (before, after) => before && after
      ? Math.hypot(
        after.endPosition[0] - before.endPosition[0],
        after.endPosition[1] - before.endPosition[1],
        after.endPosition[2] - before.endPosition[2],
      )
      : null;
    window.__actionRigDebug.setMode("pose");
    const selected = window.__actionRigDebug.selectJointByName("R_Hand");
    const beforeParent = window.__actionRigDebug.getBoneInfoByName("R_UpperArm");
    const beforeChild = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    const beforeState = window.__actionRigDebug.getInteractionState();
    const moved = window.__actionRigDebug.modalTransformSelected("translate", 120, 0);
    const afterParent = window.__actionRigDebug.getBoneInfoByName("R_UpperArm");
    const afterChild = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    const afterState = window.__actionRigDebug.getInteractionState();
    const parentEndDelta = endDelta(beforeParent, afterParent);
    const childEndDelta = endDelta(beforeChild, afterChild);
    const parentLengthDelta = lengthDelta(beforeParent, afterParent);
    const childLengthDelta = lengthDelta(beforeChild, afterChild);
    window.__actionRigDebug.undo();
    const afterUndoChild = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    const undoDelta = endDelta(beforeChild, afterUndoChild);
    return {
      selected,
      moved,
      beforeState,
      afterState,
      parentEndDelta,
      childEndDelta,
      parentLengthDelta,
      childLengthDelta,
      undoDelta,
      pass: Boolean(
        selected
        && moved
        && beforeState.selectionKind === "joint"
        && afterState.selectionKind === "joint"
        && parentLengthDelta < 0.002
        && childLengthDelta < 0.002
        && childEndDelta > 0.01
        && undoDelta < 0.001
      ),
    };
  });
  const middleJointDownstreamValidation = await page.evaluate(() => {
    const vDelta = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const lengthDelta = (before, after) => Math.abs((after?.length ?? 0) - (before?.length ?? 0));
    window.__actionRigDebug.setMode("pose");
    window.__actionRigDebug.setAllowPoseStretch(false);
    const selected = window.__actionRigDebug.selectJointByName("R_Calf");
    const beforeUpper = window.__actionRigDebug.getJointInfoByName("R_Thigh");
    const beforeMiddle = window.__actionRigDebug.getJointInfoByName("R_Calf");
    const beforeChild = window.__actionRigDebug.getBoneInfoByName("R_Calf");
    const beforeIncoming = window.__actionRigDebug.getBoneInfoByName("R_Thigh");
    const moved = window.__actionRigDebug.modalTransformSelected("translate", 90, -30);
    const afterUpper = window.__actionRigDebug.getJointInfoByName("R_Thigh");
    const afterMiddle = window.__actionRigDebug.getJointInfoByName("R_Calf");
    const afterChild = window.__actionRigDebug.getBoneInfoByName("R_Calf");
    const afterIncoming = window.__actionRigDebug.getBoneInfoByName("R_Thigh");
    const upperDelta = beforeUpper && afterUpper ? vDelta(beforeUpper.position, afterUpper.position) : null;
    const middleDelta = beforeMiddle && afterMiddle ? vDelta(beforeMiddle.position, afterMiddle.position) : null;
    const childDelta = beforeChild && afterChild ? vDelta(beforeChild.endPosition, afterChild.endPosition) : null;
    const incomingLengthDelta = lengthDelta(beforeIncoming, afterIncoming);
    const childLengthDelta = lengthDelta(beforeChild, afterChild);
    window.__actionRigDebug.undo();
    const afterUndo = window.__actionRigDebug.getJointInfoByName("R_Calf");
    const undoDelta = beforeMiddle && afterUndo ? vDelta(beforeMiddle.position, afterUndo.position) : null;
    return {
      selected,
      moved,
      beforeUpper,
      afterUpper,
      upperDelta,
      middleDelta,
      childDelta,
      incomingLengthDelta,
      childLengthDelta,
      undoDelta,
      pass: Boolean(
        selected
        && moved
        && upperDelta !== null
        && upperDelta < 0.001
        && middleDelta > 0.01
        && childDelta > 0.01
        && incomingLengthDelta < 0.002
        && childLengthDelta < 0.002
        && undoDelta < 0.001
      ),
    };
  });
  const poseStretchToggleValidation = await page.evaluate(() => {
    const vDelta = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null;
    const lengthDelta = (before, after) => Math.abs((after?.length ?? 0) - (before?.length ?? 0));
    window.__actionRigDebug.setMode("pose");
    window.__actionRigDebug.setAllowPoseStretch(true);
    const selected = window.__actionRigDebug.selectJointByName("R_Calf");
    const beforeIncoming = window.__actionRigDebug.getBoneInfoByName("R_Thigh");
    const beforeChild = window.__actionRigDebug.getBoneInfoByName("R_Calf");
    const moveMode = window.__actionRigDebug.getPoseMoveModeInfo();
    const moved = window.__actionRigDebug.modalTransformSelected("translate", 90, -30);
    const afterIncoming = window.__actionRigDebug.getBoneInfoByName("R_Thigh");
    const afterChild = window.__actionRigDebug.getBoneInfoByName("R_Calf");
    const incomingLengthDelta = lengthDelta(beforeIncoming, afterIncoming);
    const childEndDelta = vDelta(beforeChild?.endPosition, afterChild?.endPosition);
    window.__actionRigDebug.undo();
    window.__actionRigDebug.setAllowPoseStretch(false);
    const resetMode = window.__actionRigDebug.getPoseMoveModeInfo();
    return {
      selected,
      moved,
      moveMode,
      resetMode,
      incomingLengthDelta,
      childEndDelta,
      pass: Boolean(
        selected
        && moved
        && moveMode.allowPoseStretch
        && incomingLengthDelta > 0.002
        && childEndDelta > 0.01
        && !resetMode.allowPoseStretch
      ),
    };
  });
  const oppositeSideIsolationValidation = await page.evaluate(() => {
    const vDelta = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null;
    window.__actionRigDebug.setMode("pose");
    window.__actionRigDebug.setAllowPoseStretch(false);
    const selected = window.__actionRigDebug.selectJointByName("R_Foot") || window.__actionRigDebug.selectJointByName("R_Hand");
    const beforeSelected = window.__actionRigDebug.getSelectedJointInfo();
    const beforeLeftFoot = window.__actionRigDebug.getJointInfoByName("L_Foot");
    const beforeLeftCalf = window.__actionRigDebug.getJointInfoByName("L_Calf");
    const beforeHip = window.__actionRigDebug.getJointInfoByName("Hip");
    const moved = window.__actionRigDebug.modalTransformSelected("translate", 120, -20);
    const afterSelected = window.__actionRigDebug.getSelectedJointInfo();
    const afterLeftFoot = window.__actionRigDebug.getJointInfoByName("L_Foot");
    const afterLeftCalf = window.__actionRigDebug.getJointInfoByName("L_Calf");
    const afterHip = window.__actionRigDebug.getJointInfoByName("Hip");
    const selectedDelta = vDelta(beforeSelected?.position, afterSelected?.position);
    const leftFootDelta = vDelta(beforeLeftFoot?.position, afterLeftFoot?.position);
    const leftCalfDelta = vDelta(beforeLeftCalf?.position, afterLeftCalf?.position);
    const hipDelta = vDelta(beforeHip?.position, afterHip?.position);
    window.__actionRigDebug.undo();
    const afterUndo = window.__actionRigDebug.getSelectedJointInfo();
    const undoDelta = vDelta(beforeSelected?.position, afterUndo?.position);
    return {
      selected,
      moved,
      selectedDelta,
      leftFootDelta,
      leftCalfDelta,
      hipDelta,
      undoDelta,
      pass: Boolean(
        selected
        && moved
        && selectedDelta > 0.01
        && leftFootDelta !== null
        && leftFootDelta < 0.001
        && leftCalfDelta !== null
        && leftCalfDelta < 0.001
        && hipDelta !== null
        && hipDelta < 0.001
        && undoDelta !== null
        && undoDelta < 0.001
      ),
    };
  });
  const modalRotateDirectionValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    const selected = window.__actionRigDebug.selectBoneByName("R_Forearm");
    const before = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    const result = window.__actionRigDebug.modalRotateSelectedAroundPivot([120, 0], [0, 120]);
    const after = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    const endDelta = before && after
      ? Math.hypot(
        after.endPosition[0] - before.endPosition[0],
        after.endPosition[1] - before.endPosition[1],
        after.endPosition[2] - before.endPosition[2],
      )
      : null;
    window.__actionRigDebug.undo();
    return {
      selected,
      result,
      endDelta,
      pass: Boolean(selected && result.started && result.amount > 1.2 && result.amount < 1.8 && endDelta > 0.01),
    };
  });
  const buildMoveOrientationValidation = await page.evaluate(() => {
    const qDelta = (a, b) => {
      const direct = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
      const flipped = Math.hypot(a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]);
      return Math.min(direct, flipped);
    };
    const vDelta = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    window.__actionRigDebug.setMode("build");
    const selected = window.__actionRigDebug.selectJointByName("R_Hand");
    const before = window.__actionRigDebug.getJointInfoByName("R_Hand");
    const moved = window.__actionRigDebug.modalTransformSelected("translate", 140, 0);
    const after = window.__actionRigDebug.getJointInfoByName("R_Hand");
    window.__actionRigDebug.undo();
    const afterUndo = window.__actionRigDebug.getJointInfoByName("R_Hand");
    return {
      selected,
      moved,
      positionDelta: before && after ? vDelta(before.position, after.position) : null,
      orientationDelta: before && after ? qDelta(before.orientation, after.orientation) : null,
      undoPositionDelta: before && afterUndo ? vDelta(before.position, afterUndo.position) : null,
      pass: Boolean(
        selected
        && moved
        && before?.hasSourceBone
        && after?.hasSourceBone
        && vDelta(before.position, after.position) > 0.01
        && qDelta(before.orientation, after.orientation) < 0.0001
        && vDelta(before.position, afterUndo.position) < 0.0001
      ),
    };
  });
  const transformControlOpacityValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    window.__actionRigDebug.selectBoneByName("R_Forearm");
    window.__actionRigDebug.setTransformMode("rotate");
    window.__actionRigDebug.setBoneOpacity(0.78);
    const before = window.__actionRigDebug.getTransformInfo();
    window.__actionRigDebug.setBoneOpacity(0.25);
    const after = window.__actionRigDebug.getTransformInfo();
    window.__actionRigDebug.setBoneOpacity(0.78);
    return {
      before,
      after,
      pass: Boolean(
        before.controlOpacityMax !== null
        && after.controlOpacityMax !== null
        && after.controlOpacityMax < before.controlOpacityMax
        && after.controlOpacityMax <= 0.26
      ),
    };
  });
  const weightPointVisibilityValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    const poseDefault = window.__actionRigDebug.getWeightPointInfo();
    window.__actionRigDebug.setWeightPointsVisible(true);
    const poseEnabled = window.__actionRigDebug.getWeightPointInfo();
    window.__actionRigDebug.setMode("paint");
    const paintVisible = window.__actionRigDebug.getWeightPointInfo();
    window.__actionRigDebug.setMode("motion");
    const motionHidden = window.__actionRigDebug.getWeightPointInfo();
    window.__actionRigDebug.setWeightPointsVisible(false);
    return {
      poseDefault,
      poseEnabled,
      paintVisible,
      motionHidden,
      pass: Boolean(
        poseDefault.count > 0
        && !poseDefault.visible
        && !poseEnabled.visible
        && paintVisible.visible
        && !motionHidden.visible
      ),
    };
  });
  const weightPreviewValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("paint");
    const selected = window.__actionRigDebug.selectBoneByName("R_Upperarm") || window.__actionRigDebug.selectBoneByName("R_Forearm");
    const selectInfo = window.__actionRigDebug.getWeightPreviewInfo();
    window.__actionRigDebug.setWeightToolMode("brush");
    const brush = window.__actionRigDebug.previewBrushAtSelection();
    const paintInfo = window.__actionRigDebug.getWeightPreviewInfo();
    window.__actionRigDebug.setMode("pose");
    const restoredInfo = window.__actionRigDebug.getWeightPreviewInfo();
    return {
      selected,
      brush,
      selectInfo,
      paintInfo,
      restoredInfo,
      pass: Boolean(
        selected
        && selectInfo.weightToolMode === "select"
        && !selectInfo.brushVisible
        && paintInfo.mode === "paint"
        && paintInfo.weightToolMode === "brush"
        && paintInfo.skinnedMeshes > 0
        && paintInfo.materialIsWeightPreview
        && paintInfo.colorAttributeCount > 0
        && paintInfo.selectedVertices > 0
        && paintInfo.otherBoundVertices > 0
        && paintInfo.brushVisible
        && !paintInfo.debugPointVisible
        && restoredInfo.mode === "pose"
        && !restoredInfo.materialIsWeightPreview
      ),
    };
  });
  const terminalWeightTargetValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("paint");
    const selected = window.__actionRigDebug.selectJointByName("R_Foot") || window.__actionRigDebug.selectJointByName("L_Foot");
    const info = window.__actionRigDebug.getWeightPreviewInfo();
    return {
      selected,
      info,
      pass: Boolean(
        selected
        && info.selectedSourceBone?.includes("Foot")
        && info.selectedInfluenceBones.length > 0
        && info.selectedInfluenceBones.every((name) => !name.includes("Calf"))
        && info.selectedVertices > 0
      ),
    };
  });
  const timelineValidation = await page.evaluate(() => {
    const selected = window.__actionRigDebug.selectFrame(12);
    const afterSelect = window.__actionRigDebug.getTimelineInfo();
    window.__actionRigDebug.saveCurrentKeyframe();
    const afterSave = window.__actionRigDebug.getTimelineInfo();
    const selectedLoop = window.__actionRigDebug.selectFrame(25);
    const afterLoopSelect = window.__actionRigDebug.getTimelineInfo();
    return {
      selected,
      selectedLoop,
      afterSelect,
      afterSave,
      afterLoopSelect,
      pass: Boolean(
        selected === 12
        && selectedLoop === 25
        && afterSelect.currentFrame === 12
        && afterSelect.numberValue === 12
        && afterSelect.rangeValue === 12
        && afterSelect.tickCount === 25
        && afterSelect.selectedTick === 12
        && afterSave.keyframes.includes(12)
        && afterSave.keyframeTicks.includes(12)
        && afterSave.recordButtons.includes(12)
        && afterSave.currentFrameSaveState.includes("已保存")
        && afterSave.hudFrameState.includes("已保存")
        && afterSave.hudFrameSaved
        && afterLoopSelect.currentFrame === 25
        && afterLoopSelect.selectedTick === 25
        && afterLoopSelect.currentFrameSaveState.includes("未保存")
        && afterLoopSelect.hudFrameState.includes("未保存")
        && !afterLoopSelect.hudFrameSaved
      ),
    };
  });
  const mirrorDirectionValidation = await page.evaluate(() => {
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    window.__actionRigDebug.setMode("build");
    const direction = window.__actionRigDebug.getWalkDirectionInfo();
    const plane = window.__actionRigDebug.setMirrorAxis("characterRight");
    const selected = window.__actionRigDebug.selectJointByName("R_UpperArm") || window.__actionRigDebug.selectJointByName("R_Thigh");
    const before = window.__actionRigDebug.getSelectedJointInfo();
    const result = window.__actionRigDebug.mirrorSelectedBranch();
    const mirrored = window.__actionRigDebug.getSelectedJointInfo();
    const delta = before && mirrored ? sub(mirrored.position, before.position) : null;
    const sideMove = delta ? Math.abs(dot(delta, plane.normal)) : null;
    const frontBackLeak = delta ? Math.abs(dot(delta, direction.forward)) : null;
    const normalMatchesCharacterSide = Math.abs(dot(plane.normal, direction.right));
    window.__actionRigDebug.undo();
    return {
      selected,
      before,
      mirrored,
      plane,
      result,
      sideMove,
      frontBackLeak,
      normalMatchesCharacterSide,
      pass: Boolean(
        selected
        && before
        && mirrored
        && result?.axis === "characterRight"
        && normalMatchesCharacterSide > 0.92
        && sideMove > 0.02
        && frontBackLeak < sideMove * 0.15
      ),
    };
  });
  const modalStartValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    const selected = window.__actionRigDebug.selectBoneByName("R_Forearm");
    window.__actionRigDebug.setTransformMode("rotate");
    const initial = window.__actionRigDebug.inspectModalStart("rotate");
    if (!initial?.pivotScreen) {
      return { selected, initial, pass: false };
    }
    window.__actionRigDebug.setLastPointer(initial.pivotScreen.x + 1, initial.pivotScreen.y + 1);
    const nearStart = window.__actionRigDebug.inspectModalStart("rotate");
    window.__actionRigDebug.setLastPointer(initial.pivotScreen.x + 1, initial.pivotScreen.y + 1);
    const amount = window.__actionRigDebug.modalRotationAmountFromLastPointer(20, 60);
    return {
      selected,
      initial,
      nearStart,
      amount,
      pass: Boolean(
        selected
        && nearStart?.startRadius < 18
        && amount?.startRadius < 18
        && amount.amount > 0.45
        && amount.amount < 0.75
      ),
    };
  });
  const jointRotatePivotValidation = await page.evaluate(() => {
    window.__actionRigDebug.setMode("pose");
    const selected = window.__actionRigDebug.selectJointByName("R_Hand");
    window.__actionRigDebug.setTransformMode("rotate");
    const pivotInfo = window.__actionRigDebug.getTransformPivotInfo();
    return {
      selected,
      pivotInfo,
      pass: Boolean(
        selected
        && pivotInfo.selectionKind === "joint"
        && pivotInfo.selectedJoint === "R_Hand"
        && pivotInfo.pivotToJoint !== null
        && pivotInfo.pivotToJoint < 0.001
        && pivotInfo.pivotToBoneStart !== null
        && pivotInfo.pivotToBoneStart > 0.02
      ),
    };
  });
  const proceduralWalkValidation = await page.evaluate(() => {
    const vDelta = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    window.__actionRigDebug.setMode("motion");
    window.__actionRigDebug.clearKeyframes();
    window.__actionRigDebug.applyAnimationAtPhase(0);
    const beforeArm = window.__actionRigDebug.getBoneInfoByName("R_UpperArm");
    const beforeLeg = window.__actionRigDebug.getBoneInfoByName("R_Thigh");
    window.__actionRigDebug.applyAnimationAtPhase(0.25);
    const afterArm = window.__actionRigDebug.getBoneInfoByName("R_UpperArm");
    const afterLeg = window.__actionRigDebug.getBoneInfoByName("R_Thigh");
    const direction = window.__actionRigDebug.getWalkDirectionInfo();
    const armDelta = beforeArm && afterArm ? vDelta(beforeArm.endPosition, afterArm.endPosition) : null;
    const legDelta = beforeLeg && afterLeg ? vDelta(beforeLeg.endPosition, afterLeg.endPosition) : null;
    return {
      beforeArm,
      afterArm,
      beforeLeg,
      afterLeg,
      direction,
      armDelta,
      legDelta,
      pass: Boolean(
        ((armDelta !== null && armDelta > 0.005) || (legDelta !== null && legDelta > 0.005))
        && Math.abs(direction.dot) < 0.01
        && direction.visible
      ),
    };
  });
  const manualPlaybackValidation = await page.evaluate(() => {
    const vDelta = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    window.__actionRigDebug.setMode("pose");
    window.__actionRigDebug.selectFrame(1);
    window.__actionRigDebug.selectBoneByName("R_Forearm");
    window.__actionRigDebug.saveCurrentKeyframe();
    window.__actionRigDebug.selectFrame(12);
    window.__actionRigDebug.selectBoneByName("R_Forearm");
    const rotated = window.__actionRigDebug.gizmoRotateSelected(0.38, 0.22, 0);
    window.__actionRigDebug.saveCurrentKeyframe();

    window.__actionRigDebug.applyAnimationAtFrame(1);
    const atFrame1 = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    window.__actionRigDebug.applyAnimationAtFrame(12);
    const atFrame12 = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    window.__actionRigDebug.applyAnimationAtPhase((6 - 1) / 24);
    const atFrame6 = window.__actionRigDebug.getBoneInfoByName("R_Forearm");
    const timeline = window.__actionRigDebug.getTimelineInfo();
    const fullDelta = atFrame1 && atFrame12 ? vDelta(atFrame1.endPosition, atFrame12.endPosition) : null;
    const midDelta = atFrame1 && atFrame6 ? vDelta(atFrame1.endPosition, atFrame6.endPosition) : null;
    return {
      rotated,
      timeline,
      fullDelta,
      midDelta,
      pass: Boolean(
        rotated
        && timeline.keyframes.includes(1)
        && timeline.keyframes.includes(12)
        && fullDelta > 0.01
        && midDelta > 0.002
        && midDelta < fullDelta + 0.02
      ),
    };
  });
  const interactionValidation = await validateInteraction(page);

  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/validate_import_stylized_model.png", fullPage: false });

  const results = [fileImport, testButtonImport];
  const failed = results.some((result) => result.progress < 100 || !result.hasWebgl || !result.exportPreview.includes("\"skinnedMeshes\": 1"))
    || !poseValidation.pass
    || !modalValidation.pass
    || !jointControlValidation.pass
    || !transformHandlePriorityValidation.pass
    || !displaySizeValidation.pass
    || !poseJointValidation.pass
    || !middleJointDownstreamValidation.pass
    || !poseStretchToggleValidation.pass
    || !oppositeSideIsolationValidation.pass
    || !modalRotateDirectionValidation.pass
    || !buildMoveOrientationValidation.pass
    || !transformControlOpacityValidation.pass
    || !weightPointVisibilityValidation.pass
    || !weightPreviewValidation.pass
    || !terminalWeightTargetValidation.pass
    || !timelineValidation.pass
    || !mirrorDirectionValidation.pass
    || !modalStartValidation.pass
    || !jointRotatePivotValidation.pass
    || !proceduralWalkValidation.pass
    || !manualPlaybackValidation.pass
    || !interactionValidation.pass;
  console.log(JSON.stringify({ failed, results, poseValidation, modalValidation, jointControlValidation, transformHandlePriorityValidation, displaySizeValidation, poseJointValidation, middleJointDownstreamValidation, poseStretchToggleValidation, oppositeSideIsolationValidation, modalRotateDirectionValidation, buildMoveOrientationValidation, transformControlOpacityValidation, weightPointVisibilityValidation, weightPreviewValidation, terminalWeightTargetValidation, timelineValidation, mirrorDirectionValidation, modalStartValidation, jointRotatePivotValidation, proceduralWalkValidation, manualPlaybackValidation, interactionValidation, browserMessages }, null, 2));
  if (failed) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function validateInteraction(page) {
  const canvasBox = await page.locator("#rigCanvas").boundingBox();
  if (!canvasBox) {
    return { pass: false, reason: "canvas box missing" };
  }

  await page.evaluate(() => {
    window.__actionRigDebug.setMode("build");
    window.__actionRigDebug.setTransformMode("translate");
  });

  const emptyX = canvasBox.x + 96;
  const emptyY = canvasBox.y + 96;
  const beforeLeft = await page.evaluate(() => window.__actionRigDebug.getCameraInfo());
  await page.mouse.move(emptyX, emptyY);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(emptyX + 130, emptyY + 40, { steps: 4 });
  await page.mouse.up({ button: "left" });
  const afterLeft = await page.evaluate(() => window.__actionRigDebug.getCameraInfo());

  await page.mouse.move(emptyX, emptyY);
  const beforeMiddle = await page.evaluate(() => window.__actionRigDebug.getCameraInfo());
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(emptyX + 130, emptyY + 40, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  const afterMiddle = await page.evaluate(() => window.__actionRigDebug.getCameraInfo());

  await page.mouse.move(emptyX, emptyY);
  const beforePan = await page.evaluate(() => window.__actionRigDebug.getCameraInfo());
  await page.keyboard.down("Shift");
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(emptyX + 90, emptyY + 60, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  await page.keyboard.up("Shift");
  const afterPan = await page.evaluate(() => window.__actionRigDebug.getCameraInfo());

  const point = await page.evaluate(() => window.__actionRigDebug.projectJoint("root") || window.__actionRigDebug.projectJoint(""));
  if (!point) {
    return { pass: false, reason: "joint projection missing", beforeLeft, afterLeft, beforeMiddle, afterMiddle };
  }
  const beforeClick = await page.evaluate(() => window.__actionRigDebug.getInteractionState());
  await page.mouse.click(point.x, point.y, { button: "left" });
  const afterClick = await page.evaluate(() => window.__actionRigDebug.getInteractionState());

  const leftDelta = cameraDelta(beforeLeft, afterLeft);
  const middleDelta = cameraDelta(beforeMiddle, afterMiddle);
  const panTargetDelta = vectorDelta(beforePan.target, afterPan.target);
  const panAngleDelta = cameraDelta(beforePan, afterPan);
  return {
    point,
    leftDelta,
    middleDelta,
    middleYawDelta: afterMiddle.yaw - beforeMiddle.yaw,
    middlePitchDelta: afterMiddle.pitch - beforeMiddle.pitch,
    panTargetDelta,
    panAngleDelta,
    beforeClick,
    afterClick,
    pass: Boolean(
      leftDelta < 0.0001
      && middleDelta > 0.05
      && afterMiddle.yaw < beforeMiddle.yaw
      && afterMiddle.pitch > beforeMiddle.pitch
      && panTargetDelta > 0.01
      && panAngleDelta < 0.0001
      && afterClick.selectedJointId === point.id
      && afterClick.bones === beforeClick.bones
      && !afterClick.isExtending
      && !afterClick.pendingExtendJointId
    ),
  };
}

function cameraDelta(before, after) {
  return Math.abs(after.yaw - before.yaw) + Math.abs(after.pitch - before.pitch);
}

function vectorDelta(before, after) {
  return Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
}

async function runImport(page, scenario, action) {
  await action();
  await page.waitForFunction(
    () => {
      const status = document.querySelector("#importStatusText")?.textContent || "";
      const progress = Number(document.querySelector("#importProgress")?.value || 0);
      return progress >= 100 || status.includes("加载失败") || status.includes("失败");
    },
    null,
    { timeout: 90000 },
  );

  return page.evaluate((scenarioName) => {
    const canvas = document.querySelector("#rigCanvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      scenario: scenarioName,
      title: document.title,
      status: document.querySelector("#importStatusText")?.textContent || "",
      progress: Number(document.querySelector("#importProgress")?.value || 0),
      size: document.querySelector("#importSizeText")?.textContent || "",
      hudBone: document.querySelector("#hudBoneName")?.textContent || "",
      exportPreview: document.querySelector("#exportPreview")?.value || "",
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      hasWebgl: Boolean(context),
    };
  }, scenario);
}
