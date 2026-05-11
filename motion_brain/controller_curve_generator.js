function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function vectorIsNonZero(value) {
  return Array.isArray(value) && value.some((item) => Math.abs(Number(item) || 0) > 0.0001);
}

function mergeControllerData(phase) {
  const controllers = clone(phase.controllers || {});
  if (vectorIsNonZero(phase.root_motion)) {
    controllers.Root_CTRL = {
      ...(controllers.Root_CTRL || {}),
      offset: clone(phase.root_motion),
    };
  }
  Object.entries(phase.fk_controls || {}).forEach(([controlId, value]) => {
    controllers[controlId] = clone(value);
  });
  return controllers;
}

function deriveLocks(controllers, contactState, side) {
  return Boolean(
    controllers?.[`${side}_Foot_IK`]?.locked
    || contactState?.feet?.[side] === "locked"
  );
}

function summarizeControllerCurves(controllerKeyframes) {
  const controllerIds = new Set();
  const fkControllerIds = new Set();
  const lockedFeet = new Set();
  const lockedHands = new Set();
  controllerKeyframes.forEach((keyframe) => {
    Object.keys(keyframe.controllers || {}).forEach((id) => {
      controllerIds.add(id);
      if (id.endsWith("_CTRL") && !["Global_CTRL", "Root_CTRL", "COG_CTRL", "Pelvis_CTRL", "Chest_CTRL", "Head_CTRL"].includes(id)) {
        fkControllerIds.add(id);
      }
    });
    ["R", "L"].forEach((side) => {
      if (keyframe.foot_locks?.[side]) lockedFeet.add(side);
      if (keyframe.contact_state?.hands?.[side] === "locked") lockedHands.add(side);
    });
  });
  return {
    keyframe_count: controllerKeyframes.length,
    controller_ids: [...controllerIds].sort(),
    fk_controller_ids: [...fkControllerIds].sort(),
    locked_feet: [...lockedFeet].sort(),
    locked_hands: [...lockedHands].sort(),
  };
}

export class ControllerCurveGenerator {
  generate(motionPlan) {
    const keyframes = (motionPlan.phases || []).map((phase, index) => {
      const controllers = mergeControllerData(phase);
      return {
        timeline_frame: Math.max(1, Math.round(Number(phase.frame) || 1)),
        pose_index: index + 1,
        label: phase.phase_name,
        phase_name: phase.phase_name,
        controllers,
        contact_state: clone(phase.contact_state || {}),
        primitives_used: [...(phase.primitives_used || [])],
        ik_fk_blend: clone(phase.ik_fk_blend || {}),
        foot_locks: {
          R: deriveLocks(controllers, phase.contact_state, "R"),
          L: deriveLocks(controllers, phase.contact_state, "L"),
        },
        interpolation: "smooth",
      };
    });

    const first = keyframes[0];
    const last = keyframes.at(-1);
    const endFrame = Math.max(1, Math.round(Number(motionPlan.duration_frames) || last?.timeline_frame || 1));
    if (first && motionPlan.loopable) {
      if (!last || last.timeline_frame !== endFrame) {
        keyframes.push({
          ...clone(first),
          timeline_frame: endFrame,
          pose_index: keyframes.length + 1,
          label: `${first.label}_loop`,
          phase_name: `${first.phase_name}_loop`,
        });
      }
    } else if (last && last.timeline_frame !== endFrame) {
      keyframes.push({
        ...clone(last),
        timeline_frame: endFrame,
        pose_index: keyframes.length + 1,
        label: `${last.label}_hold`,
        phase_name: `${last.phase_name}_hold`,
      });
    }

    return {
      schema: "controller_curve_set_v1",
      motion_plan_id: motionPlan.prototype_id || `${motionPlan.action_type}:${motionPlan.subtype}`,
      duration_frames: endFrame,
      loopable: Boolean(motionPlan.loopable),
      controller_keyframes: keyframes.sort((a, b) => a.timeline_frame - b.timeline_frame),
      controller_summary: summarizeControllerCurves(keyframes),
    };
  }
}
