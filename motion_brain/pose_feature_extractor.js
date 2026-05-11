function vec(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length !== 3) {
    return [...fallback];
  }
  return value.map((item, index) => Number.isFinite(Number(item)) ? Number(item) : fallback[index] || 0);
}

function sub(a, b) {
  const av = vec(a);
  const bv = vec(b);
  return [av[0] - bv[0], av[1] - bv[1], av[2] - bv[2]];
}

function dot(a, b) {
  const av = vec(a);
  const bv = vec(b);
  return av[0] * bv[0] + av[1] * bv[1] + av[2] * bv[2];
}

function length(a) {
  return Math.hypot(...vec(a));
}

function distance(a, b) {
  return length(sub(a, b));
}

function normalize(a, fallback = [0, 0, 0]) {
  const av = vec(a);
  const len = length(av);
  if (len < 0.000001) {
    return [...fallback];
  }
  return av.map((item) => item / len);
}

function angleDegrees(a, b) {
  const an = normalize(a);
  const bn = normalize(b);
  const value = Math.max(-1, Math.min(1, dot(an, bn)));
  return Math.acos(value) * 180 / Math.PI;
}

function range(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (finite.length === 0) return 0;
  return Math.max(...finite) - Math.min(...finite);
}

function average(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (finite.length === 0) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function max(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : 0;
}

function getByName(items = [], key = "name") {
  return new Map((items || []).map((item) => [item[key], item]));
}

function getJoint(joints, name) {
  return joints.get(name)?.position || null;
}

function getControl(controls, id) {
  return controls.get(id) || null;
}

function getControllerMeta(sample, controlId) {
  return sample?.motion_brain?.controller_keyframe?.controllers?.[controlId] || null;
}

function getIkWeight(sample, controlId) {
  const controllerMeta = getControllerMeta(sample, controlId);
  if (!controllerMeta) {
    return 0;
  }
  if (Number.isFinite(Number(controllerMeta.ik_weight))) {
    return Number(controllerMeta.ik_weight);
  }
  const blend = sample?.motion_brain?.controller_keyframe?.ik_fk_blend;
  const side = controlId.startsWith("R_") ? "R" : "L";
  const blendValue = blend?.hands?.[side] ?? blend?.hand_ik?.[side] ?? blend?.[controlId];
  if (Number.isFinite(Number(blendValue))) {
    return Number(blendValue);
  }
  return controlId.includes("_Hand_IK") ? 1 : 0;
}

function contactStateForSample(sample, side, kind) {
  const state = sample?.motion_brain?.contact_state?.[kind]?.[side]
    || sample?.motion_brain?.controller_keyframe?.contact_state?.[kind]?.[side];
  if (state) return state;
  if (kind === "feet" && sample?.foot_locks?.[side]) return "locked";
  const controlId = `${side}_${kind === "hands" ? "Hand" : "Foot"}_IK`;
  return getControl(getByName(sample?.ik_controls || [], "id"), controlId)?.locked ? "locked" : "free";
}

function controllerPositionForSample(sample, controlId) {
  const control = getControl(getByName(sample?.ik_controls || [], "id"), controlId);
  return control?.position || null;
}

function getLockedDrift(samples, kind) {
  let maxDrift = 0;
  ["R", "L"].forEach((side) => {
    const controlId = `${side}_${kind === "hands" ? "Hand" : "Foot"}_IK`;
    let anchor = null;
    samples.forEach((sample) => {
      const locked = contactStateForSample(sample, side, kind) === "locked";
      const position = controllerPositionForSample(sample, controlId);
      if (!locked || !position) {
        anchor = null;
        return;
      }
      if (!anchor) {
        anchor = position;
      } else {
        maxDrift = Math.max(maxDrift, distance(anchor, position));
      }
    });
  });
  return maxDrift;
}

export class PoseFeatureExtractor {
  extract({ intent, motion_plan, controller_keyframes = [], pose_sample_set }) {
    const samples = pose_sample_set?.samples || [];
    const basis = pose_sample_set?.rig_basis || {};
    const up = normalize(basis.up || [0, 1, 0], [0, 1, 0]);
    const right = normalize(basis.right || [1, 0, 0], [1, 0, 0]);
    const forward = normalize(basis.forward || [0, 0, 1], [0, 0, 1]);
    const down = up.map((item) => -item);

    const perSample = samples.map((sample) => {
      const joints = getByName(sample.joints || []);
      const controls = getByName(sample.ik_controls || [], "id");
      const hips = getJoint(joints, "Hips") || [0, 0, 0];
      const chest = getJoint(joints, "Chest") || getJoint(joints, "Spine") || hips;
      const head = getJoint(joints, "Head") || chest;
      const pelvisControl = getControl(controls, "Pelvis_CTRL");
      const chestControl = getControl(controls, "Chest_CTRL");
      const rootControl = getControl(controls, "Root_CTRL");
      const cogControl = getControl(controls, "COG_CTRL");
      const bodyVector = sub(head, hips);
      const bodyForwardLean = dot(normalize(bodyVector, up), forward);
      const centerOfFeet = averageFootPosition(joints);
      const bodyBalanceOffset = centerOfFeet ? dot(sub(hips, centerOfFeet), forward) : 0;

      const arms = {};
      ["R", "L"].forEach((side) => {
        const shoulder = getJoint(joints, `${side}_UpperArm`) || chest;
        const elbow = getJoint(joints, `${side}_Forearm`) || shoulder;
        const wrist = getJoint(joints, `${side}_Hand`) || elbow;
        const upperVector = sub(elbow, shoulder);
        const forearmVector = sub(wrist, elbow);
        const shoulderToWrist = sub(wrist, shoulder);
        const wristRelativeChest = dot(sub(wrist, chest), up);
        const abduction = angleDegrees(upperVector, down);
        const forwardSwing = dot(shoulderToWrist, forward);
        const sideSwing = dot(shoulderToWrist, right) * (side === "R" ? 1 : -1);
        const elbowBend = 180 - angleDegrees(upperVector, forearmVector);
        const handIkWeight = getIkWeight(sample, `${side}_Hand_IK`);
        const armFkWeight = Math.max(0, 1 - handIkWeight);
        arms[side] = {
          wrist_height_relative_to_pelvis: dot(sub(wrist, hips), up),
          wrist_height_relative_to_chest: wristRelativeChest,
          upper_arm_abduction_angle: abduction,
          upper_arm_forward_swing_angle: forwardSwing,
          upper_arm_side_swing_amount: sideSwing,
          elbow_bend_angle: elbowBend,
          hand_ik_weight: handIkWeight,
          arm_fk_weight: armFkWeight,
          t_pose_score: abduction > 66 && Math.abs(wristRelativeChest) < 0.30 ? Math.min(1, (abduction - 60) / 35) : 0,
          a_pose_score: abduction > 42 && abduction <= 66 ? Math.min(1, (abduction - 38) / 32) : 0,
        };
      });

      const footHeights = {
        R: dot(sub(getJoint(joints, "R_Foot") || [0, 0, 0], [0, 0, 0]), up),
        L: dot(sub(getJoint(joints, "L_Foot") || [0, 0, 0], [0, 0, 0]), up),
      };
      const kneeBend = {
        R: getKneeBend(joints, "R"),
        L: getKneeBend(joints, "L"),
      };

      return {
        frame: sample.frame,
        arms,
        body: {
          root_position: rootControl?.position || hips,
          cog_position: cogControl?.position || hips,
          pelvis_rotation: pelvisControl?.rotation || [0, 0, 0],
          chest_rotation: chestControl?.rotation || [0, 0, 0],
          body_forward_lean: bodyForwardLean,
          body_balance_offset: bodyBalanceOffset,
        },
        legs: {
          foot_contact_state: {
            R: contactStateForSample(sample, "R", "feet"),
            L: contactStateForSample(sample, "L", "feet"),
          },
          knee_bend_angle: kneeBend,
          knee_flip_score: {
            R: kneeBend.R < 2 ? 1 : 0,
            L: kneeBend.L < 2 ? 1 : 0,
          },
          foot_height: footHeights,
        },
        contact: {
          hand_contact_state: {
            R: contactStateForSample(sample, "R", "hands"),
            L: contactStateForSample(sample, "L", "hands"),
          },
        },
      };
    });

    const summary = summarizeFeatures({ intent, motion_plan, controller_keyframes, samples, perSample, forward, up });
    return {
      schema: "pose_feature_set_v1",
      intent: {
        action_type: intent?.action_type,
        subtype: intent?.subtype,
        validation_profile: intent?.validation_profile,
      },
      sample_count: samples.length,
      samples: perSample,
      summary,
    };
  }
}

function averageFootPosition(joints) {
  const r = getJoint(joints, "R_Foot");
  const l = getJoint(joints, "L_Foot");
  if (!r || !l) return null;
  return [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2, (r[2] + l[2]) / 2];
}

function getKneeBend(joints, side) {
  const hip = getJoint(joints, `${side}_UpperLeg`);
  const knee = getJoint(joints, `${side}_LowerLeg`);
  const foot = getJoint(joints, `${side}_Foot`);
  if (!hip || !knee || !foot) return 0;
  return 180 - angleDegrees(sub(hip, knee), sub(foot, knee));
}

function summarizeFeatures({ motion_plan, samples, perSample, forward, up }) {
  const rootPositions = perSample.map((sample) => sample.body.root_position);
  const cogPositions = perSample.map((sample) => sample.body.cog_position);
  const pelvisRotations = perSample.map((sample) => sample.body.pelvis_rotation);
  const chestRotations = perSample.map((sample) => sample.body.chest_rotation);
  const rightForward = perSample.map((sample) => sample.arms.R.upper_arm_forward_swing_angle);
  const leftForward = perSample.map((sample) => sample.arms.L.upper_arm_forward_swing_angle);
  const rightSide = perSample.map((sample) => sample.arms.R.upper_arm_side_swing_amount);
  const leftSide = perSample.map((sample) => sample.arms.L.upper_arm_side_swing_amount);
  const phaseNames = new Set((motion_plan?.phases || []).map((phase) => String(phase.phase_name || "")));
  const first = samples[0];
  const last = samples.at(-1);
  const loopContinuity = first && last ? Math.max(
    distance(getJoint(getByName(first.joints || []), "Hips"), getJoint(getByName(last.joints || []), "Hips")),
    distance(getJoint(getByName(first.joints || []), "R_Hand"), getJoint(getByName(last.joints || []), "R_Hand")),
    distance(getJoint(getByName(first.joints || []), "L_Hand"), getJoint(getByName(last.joints || []), "L_Hand")),
  ) : 0;

  return {
    arm: {
      wrist_height_relative_to_pelvis: {
        R: perSample.map((sample) => sample.arms.R.wrist_height_relative_to_pelvis),
        L: perSample.map((sample) => sample.arms.L.wrist_height_relative_to_pelvis),
      },
      wrist_height_relative_to_chest: {
        R: perSample.map((sample) => sample.arms.R.wrist_height_relative_to_chest),
        L: perSample.map((sample) => sample.arms.L.wrist_height_relative_to_chest),
      },
      upper_arm_abduction_angle: {
        R: perSample.map((sample) => sample.arms.R.upper_arm_abduction_angle),
        L: perSample.map((sample) => sample.arms.L.upper_arm_abduction_angle),
      },
      upper_arm_forward_swing_angle: {
        R: rightForward,
        L: leftForward,
      },
      elbow_bend_angle: {
        R: perSample.map((sample) => sample.arms.R.elbow_bend_angle),
        L: perSample.map((sample) => sample.arms.L.elbow_bend_angle),
      },
      hand_ik_weight: {
        R: perSample.map((sample) => sample.arms.R.hand_ik_weight),
        L: perSample.map((sample) => sample.arms.L.hand_ik_weight),
      },
      arm_fk_weight: {
        R: perSample.map((sample) => sample.arms.R.arm_fk_weight),
        L: perSample.map((sample) => sample.arms.L.arm_fk_weight),
      },
      t_pose_score: max(perSample.flatMap((sample) => [sample.arms.R.t_pose_score, sample.arms.L.t_pose_score])),
      a_pose_score: max(perSample.flatMap((sample) => [sample.arms.R.a_pose_score, sample.arms.L.a_pose_score])),
      max_wrist_height_relative_to_chest: max(perSample.flatMap((sample) => [
        sample.arms.R.wrist_height_relative_to_chest,
        sample.arms.L.wrist_height_relative_to_chest,
      ])),
      average_hand_ik_weight: average(perSample.flatMap((sample) => [sample.arms.R.hand_ik_weight, sample.arms.L.hand_ik_weight])),
      forward_swing_range: Math.max(range(rightForward), range(leftForward)),
      side_swing_range: Math.max(range(rightSide), range(leftSide)),
    },
    body: {
      root_motion_amount: getPathAmount(rootPositions),
      cog_vertical_motion: range(cogPositions.map((position) => dot(position, up))),
      cog_forward_motion: range(cogPositions.map((position) => dot(position, forward))),
      hip_rotation: max(pelvisRotations.map(length)),
      chest_rotation: max(chestRotations.map(length)),
      hip_chest_counter_rotation: average(pelvisRotations.map((pelvis, index) => Math.abs(dot(pelvis, chestRotations[index] || [0, 0, 0])))),
      body_forward_lean: max(perSample.map((sample) => sample.body.body_forward_lean)),
      body_balance_offset: max(perSample.map((sample) => Math.abs(sample.body.body_balance_offset))),
    },
    legs: {
      foot_contact_state: perSample.map((sample) => ({ frame: sample.frame, ...sample.legs.foot_contact_state })),
      foot_sliding_amount: getLockedDrift(samples, "feet"),
      knee_bend_angle: {
        R: perSample.map((sample) => sample.legs.knee_bend_angle.R),
        L: perSample.map((sample) => sample.legs.knee_bend_angle.L),
      },
      knee_flip_score: max(perSample.flatMap((sample) => [sample.legs.knee_flip_score.R, sample.legs.knee_flip_score.L])),
      foot_height: perSample.map((sample) => ({ frame: sample.frame, ...sample.legs.foot_height })),
      flight_phase_exists: perSample.some((sample) => sample.legs.foot_contact_state.R !== "locked" && sample.legs.foot_contact_state.L !== "locked"),
    },
    contact: {
      hand_contact_drift: getLockedDrift(samples, "hands"),
      foot_contact_drift: getLockedDrift(samples, "feet"),
      locked_target_world_drift: Math.max(getLockedDrift(samples, "hands"), getLockedDrift(samples, "feet")),
    },
    rhythm: {
      phase_count: motion_plan?.phases?.length || 0,
      anticipation_exists: [...phaseNames].some((name) => name.includes("anticipation") || name.includes("prepare")),
      impact_or_peak_exists: [...phaseNames].some((name) => name.includes("impact") || name.includes("peak") || name.includes("contact")),
      follow_through_exists: [...phaseNames].some((name) => name.includes("follow_through")),
      recover_exists: [...phaseNames].some((name) => name.includes("recover") || name.includes("settle")),
      loop_continuity_score: loopContinuity,
    },
  };
}

function getPathAmount(positions) {
  let total = 0;
  for (let index = 1; index < positions.length; index += 1) {
    total += distance(positions[index - 1], positions[index]);
  }
  return total;
}
