function max(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : 0;
}

function min(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : 0;
}

function range(values = []) {
  return max(values) - min(values);
}

function includesPhase(motionPlan, fragment) {
  return (motionPlan?.phases || []).some((phase) => String(phase.phase_name || "").includes(fragment));
}

function issue(code, message, evidence = {}, severity = "blocker") {
  return {
    code,
    severity,
    message,
    affected_frames: evidence.affected_frames || [],
    suggested_fix: evidence.suggested_fix || "regenerate_main_action_from_action_ir",
    evidence,
  };
}

export class IntentFulfillmentValidator {
  validate(actionIR, poseFeatures, motionPlan) {
    const issues = [];
    const checks = {};
    const summary = poseFeatures?.summary || {};
    const samples = poseFeatures?.samples || [];
    const arm = summary.arm || {};
    const body = summary.body || {};
    const legs = summary.legs || {};
    const contact = summary.contact || {};

    const add = (name, passed, message = "Passed") => {
      checks[name] = passed ? "Passed" : message;
    };

    const bodyMotion = (body.root_motion_amount || 0)
      + (body.cog_vertical_motion || 0)
      + (body.cog_forward_motion || 0)
      + (body.hip_rotation || 0)
      + (body.chest_rotation || 0);
    const visibleMotion = bodyMotion
      + range(arm.upper_arm_forward_swing_angle?.R || [])
      + range(arm.upper_arm_forward_swing_angle?.L || []);
    const minVisibleMotion = actionIR?.validation_profile === "idle" || actionIR?.action_type === "idle" ? 0.015 : 0.08;
    add("visible_motion", visibleMotion > minVisibleMotion, "No visible action");
    if (visibleMotion <= minVisibleMotion) {
      issues.push(issue("NO_VISIBLE_ACTION", "The generated result has no visible main action.", { visibleMotion }));
    }

    if (actionIR?.verb_family === "strike") {
      const side = actionIR.effector === "left_hand" ? "L" : "R";
      const forwardRange = range(arm.upper_arm_forward_swing_angle?.[side] || []);
      const elbowValues = arm.elbow_bend_angle?.[side] || [];
      const elbowExtension = max(elbowValues) - min(elbowValues);
      const elbowExtensionPassed = elbowExtension > 0.05 || forwardRange > 0.25;
      const hasImpact = includesPhase(motionPlan, "impact");
      const torsoMotion = (body.hip_rotation || 0) + (body.chest_rotation || 0);
      add("strike_effector", actionIR.effector === "right_hand" || actionIR.effector === "left_hand", "Strike effector missing");
      add("strike_forward_motion", forwardRange > 0.10, "Punch does not move forward enough");
      add("strike_elbow_extension", elbowExtensionPassed, "Punch elbow does not extend enough");
      add("strike_body_driver", torsoMotion > 0.08, "Punch lacks torso/hip drive");
      add("strike_impact_phase", hasImpact, "Impact phase missing");
      if (forwardRange <= 0.10 || !elbowExtensionPassed || torsoMotion <= 0.08 || !hasImpact) {
        issues.push(issue("INTENT_NOT_FULFILLED", "Strike intent is not fulfilled by the solved motion.", {
          effector: actionIR.effector,
          forwardRange,
          elbowExtension,
          torsoMotion,
          hasImpact,
          suggested_fix: "amplify_effector_forward_drive_and_insert_impact",
        }));
      }
    }

    if (actionIR?.verb_family === "lie_down") {
      const cogDrop = body.cog_vertical_motion || 0;
      const finalSamples = samples.slice(-2);
      const finalHeadLow = finalSamples.some((sample) => (
        Math.max(
          sample.arms.R.wrist_height_relative_to_pelvis,
          sample.arms.L.wrist_height_relative_to_pelvis,
        ) < 0.9
      ));
      const hasLower = includesPhase(motionPlan, "lower");
      const hasSettle = includesPhase(motionPlan, "settle");
      add("lie_down_cog_drop", cogDrop > 0.35, "COG does not descend enough");
      add("lie_down_phases", hasLower && hasSettle, "Lie-down phases missing");
      add("lie_down_ground_contact", actionIR.contact_type === "ground_support", "Ground support contact missing");
      if (cogDrop <= 0.35 || !hasLower || !hasSettle || actionIR.contact_type !== "ground_support") {
        issues.push(issue("INTENT_NOT_FULFILLED", "Lie-down intent is not fulfilled by a controlled descent to the floor.", {
          cogDrop,
          finalHeadLow,
          hasLower,
          hasSettle,
          contact_type: actionIR.contact_type,
          suggested_fix: "insert_lower_center_support_contact_and_settle_on_floor",
        }));
      }
    }

    if (actionIR?.verb_family === "crouch" || actionIR?.validation_profile === "crouch") {
      const cogDrop = body.cog_vertical_motion || 0;
      const footStates = legs.foot_contact_state || [];
      const hasR = footStates.some((state) => state.R === "locked");
      const hasL = footStates.some((state) => state.L === "locked");
      const hasCrouchPhase = includesPhase(motionPlan, "crouch") || includesPhase(motionPlan, "lower");
      const hasRecover = includesPhase(motionPlan, "recover");
      add("crouch_cog_drop", cogDrop > 0.18, "Crouch does not lower COG enough");
      add("crouch_foot_support", hasR && hasL, "Crouch lacks locked foot support");
      add("crouch_phase_chain", hasCrouchPhase && hasRecover, "Crouch phase chain missing");
      if (cogDrop <= 0.18 || !hasR || !hasL || !hasCrouchPhase || !hasRecover) {
        issues.push(issue("INTENT_NOT_FULFILLED", "Crouch intent is not fulfilled by a controlled supported descent.", {
          cogDrop,
          hasR,
          hasL,
          hasCrouchPhase,
          hasRecover,
          suggested_fix: "insert_crouch_down_with_locked_feet",
        }));
      }
    }

    if (["push", "pull"].includes(actionIR?.verb_family)) {
      const hasTarget = Boolean(actionIR.target);
      const hasReach = includesPhase(motionPlan, "reach");
      const hasLock = includesPhase(motionPlan, "contact") || includesPhase(motionPlan, "lock");
      const hasForce = includesPhase(motionPlan, "force") || includesPhase(motionPlan, "push") || includesPhase(motionPlan, "execute");
      const handDrift = contact.hand_contact_drift || 0;
      add("interaction_target", hasTarget, "Interaction target missing");
      add("interaction_reach_lock_force", hasReach && hasLock && hasForce, "Interaction phase chain missing");
      add("interaction_contact_drift", handDrift <= 0.22, "Hand contact drifts too much");
      add("interaction_body_driver", bodyMotion > 0.08, "Interaction body motion too small");
      if (!hasTarget || !hasReach || !hasLock || !hasForce || handDrift > 0.22 || bodyMotion <= 0.08) {
        issues.push(issue("INTENT_NOT_FULFILLED", "Push/pull interaction intent is not fulfilled.", {
          target: actionIR.target,
          hasReach,
          hasLock,
          hasForce,
          handDrift,
          bodyMotion,
          suggested_fix: "add_reach_contact_lock_force_apply_and_body_weight_shift",
        }));
      }
    }

    if (actionIR?.validation_profile === "walk") {
      const footStates = legs.foot_contact_state || [];
      const hasR = footStates.some((state) => state.R === "locked");
      const hasL = footStates.some((state) => state.L === "locked");
      const handIk = arm.average_hand_ik_weight || 0;
      const armForward = arm.forward_swing_range || 0;
      add("walk_alternating_contact", hasR && hasL, "Walk lacks alternating foot contact");
      add("walk_no_handik", handIk <= 0.2, "Ordinary walk should not lock HandIK");
      add("walk_arm_swing", armForward > 0.01, "Walk arm swing too small");
      if (!hasR || !hasL || handIk > 0.2 || armForward <= 0.01) {
        issues.push(issue("INTENT_NOT_FULFILLED", "Walk intent is not fulfilled.", {
          hasR,
          hasL,
          handIk,
          armForward,
          suggested_fix: "use_relaxed_locomotion_base_pose_and_fk_arm_swing",
        }));
      }
    }

    if (actionIR?.action_type === "gesture") {
      const raised = (arm.max_wrist_height_relative_to_chest || 0) > 0.05;
      add("gesture_allows_raised_hand", raised, "Gesture hand did not raise");
      if (!raised) {
        issues.push(issue("INTENT_NOT_FULFILLED", "Gesture intent requires a visibly raised hand.", {
          max_wrist_height_relative_to_chest: arm.max_wrist_height_relative_to_chest || 0,
          suggested_fix: "raise_gesture_effector_and_add_wave_phase",
        }));
      }
    }

    return {
      schema: "intent_fulfillment_report_v1",
      passed: issues.length === 0,
      status: issues.length === 0 ? "Passed" : "Issues",
      checks,
      issues,
      checked_at: new Date().toISOString(),
    };
  }
}
