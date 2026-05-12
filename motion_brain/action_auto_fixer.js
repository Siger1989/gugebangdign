import { normalizeMotionPlan } from "./motion_planner.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureController(phase, controlId) {
  phase.controllers ||= {};
  phase.controllers[controlId] ||= { offset: [0, 0, 0], rotation: [0, 0, 0] };
  phase.controllers[controlId].offset ||= [0, 0, 0];
  phase.controllers[controlId].rotation ||= [0, 0, 0];
  return phase.controllers[controlId];
}

function makePhase(name, duration, primitives, controllers = {}, contactState = {}) {
  return {
    frame: 1,
    phase_name: name,
    duration,
    primitives_used: primitives,
    controllers,
    contact_state: contactState,
    root_motion: controllers.Root_CTRL?.offset || [0, 0, 0],
    cog_motion: controllers.COG_CTRL?.offset || [0, 0, 0],
    hip_motion: controllers.Pelvis_CTRL?.rotation || [0, 0, 0],
    chest_motion: controllers.Chest_CTRL?.rotation || [0, 0, 0],
    head_motion: controllers.Head_CTRL?.rotation || [0, 0, 0],
    hand_ik: { R: controllers.R_Hand_IK || null, L: controllers.L_Hand_IK || null },
    foot_ik: { R: controllers.R_Foot_IK || null, L: controllers.L_Foot_IK || null },
    pole_targets: {},
    fk_controls: {},
    ik_fk_blend: {},
  };
}

function insertBeforeRecover(phases, phase) {
  const index = phases.findIndex((item) => String(item.phase_name || "").includes("recover"));
  phases.splice(index >= 0 ? index : phases.length, 0, phase);
}

function hasPhase(phases, fragment) {
  return phases.some((phase) => String(phase.phase_name || "").includes(fragment));
}

function pinLockedControls(phases, target) {
  ["R", "L"].forEach((side) => {
    const controlId = `${side}_${target === "hands" ? "Hand" : "Foot"}_IK`;
    let anchor = null;
    phases.forEach((phase) => {
      const locked = phase.contact_state?.[target]?.[side] === "locked" || phase.controllers?.[controlId]?.locked;
      if (!locked) {
        anchor = null;
        return;
      }
      const control = ensureController(phase, controlId);
      if (!anchor) {
        anchor = [...control.offset];
      } else {
        control.offset = [...anchor];
      }
      control.locked = true;
    });
  });
}

function shouldUseRelaxedFkArms(intent) {
  return intent?.action_type === "idle"
    || intent?.validation_profile === "walk"
    || intent?.validation_profile === "run"
    || ["walk", "run", "breath"].includes(intent?.subtype);
}

function getForwardSwingForPhase(phase, side) {
  const rFootZ = Number(phase.controllers?.R_Foot_IK?.offset?.[2] || 0);
  const lFootZ = Number(phase.controllers?.L_Foot_IK?.offset?.[2] || 0);
  const phaseName = String(phase.phase_name || "");
  const rightLegForward = rFootZ > lFootZ || phaseName.includes("_r") || phaseName.includes("contact");
  const amount = phaseName.includes("run") || phaseName.includes("flight") ? 0.34 : 0.22;
  if (side === "R") {
    return rightLegForward ? 0.18 : -amount;
  }
  return rightLegForward ? -amount : 0.18;
}

function applyRelaxedFkArmSwing(fixedPlan, intent) {
  fixedPlan.phases.forEach((phase, index) => {
    phase.controllers ||= {};
    phase.fk_controls ||= {};
    delete phase.controllers.R_Hand_IK;
    delete phase.controllers.L_Hand_IK;
    phase.hand_ik = { R: null, L: null };
    phase.ik_fk_blend ||= {};
    phase.ik_fk_blend.hands = { R: 0, L: 0 };
    const isIdle = intent?.validation_profile === "idle" || intent?.action_type === "idle";
    const idleSway = isIdle ? Math.sin(index * Math.PI * 0.65) * 0.04 : 0;
    const rightSwing = isIdle ? idleSway : getForwardSwingForPhase(phase, "R");
    const leftSwing = isIdle ? -idleSway * 0.65 : getForwardSwingForPhase(phase, "L");
    phase.fk_controls.R_UpperArm_CTRL = {
      rotation: [rightSwing, 0, -1.12],
      relaxed_arm_pose: true,
      forward_offset: rightSwing,
    };
    phase.fk_controls.L_UpperArm_CTRL = {
      rotation: [leftSwing, 0, 1.12],
      relaxed_arm_pose: true,
      forward_offset: leftSwing,
    };
    phase.fk_controls.R_Forearm_CTRL = { rotation: [0, 0, -0.22] };
    phase.fk_controls.L_Forearm_CTRL = { rotation: [0, 0, 0.22] };
    phase.fk_controls.R_Hand_CTRL = { rotation: [0, 0, -0.06] };
    phase.fk_controls.L_Hand_CTRL = { rotation: [0, 0, 0.06] };
  });
}

export class ActionAutoFixer {
  fix({ intent, motion_plan, validation }) {
    const fixedPlan = clone(motion_plan);
    fixedPlan.phases = fixedPlan.phases || [];
    const issueCodes = new Set((validation?.issues || []).map((issue) => issue.code));
    const fixes = [];

    if (issueCodes.has("no_tpose_residue") || issueCodes.has("TPOSE_RESIDUE") || issueCodes.has("ARM_TOO_HIGH")) {
      fixedPlan.phases.forEach((phase, index) => {
        const forward = (index % 2 === 0 ? 0.05 : -0.02) + (phase.controllers?.COG_CTRL?.offset?.[2] || 0) * 0.25;
        ensureController(phase, "R_Hand_IK").offset = [-0.14, -0.30, forward];
        ensureController(phase, "L_Hand_IK").offset = [0.12, -0.32, forward - 0.02];
      });
      fixes.push("lowered_hand_ik_from_tpose");
    }

    if (shouldUseRelaxedFkArms(intent) && (
      issueCodes.has("HAND_IK_UNEXPECTED")
      || issueCodes.has("ARM_SWING_PLANE_WRONG")
      || issueCodes.has("TPOSE_RESIDUE")
      || issueCodes.has("ARM_TOO_HIGH")
    )) {
      applyRelaxedFkArmSwing(fixedPlan, intent);
      fixes.push("converted_locomotion_arms_to_fk_relaxed_swing");
    }

    if (issueCodes.has("has_body_motion") || issueCodes.has("NO_BODY_MOTION")) {
      fixedPlan.phases.forEach((phase, index) => {
        const t = fixedPlan.phases.length <= 1 ? 0 : index / (fixedPlan.phases.length - 1);
        ensureController(phase, "COG_CTRL").offset = [
          0.025 * Math.sin(t * Math.PI * 2),
          -0.04 + 0.08 * Math.sin(t * Math.PI),
          0.12 * t,
        ];
        ensureController(phase, "Pelvis_CTRL").rotation = [0, -0.10 + 0.20 * t, 0.02 * Math.cos(t * Math.PI)];
        ensureController(phase, "Chest_CTRL").rotation = [0.04 * Math.sin(t * Math.PI), 0.12 - 0.24 * t, -0.02 * Math.cos(t * Math.PI)];
      });
      fixes.push("added_cog_hip_chest_driver_motion");
    }

    if (issueCodes.has("NO_VISIBLE_ACTION")) {
      fixedPlan.phases.forEach((phase, index) => {
        const t = fixedPlan.phases.length <= 1 ? 0 : index / (fixedPlan.phases.length - 1);
        ensureController(phase, "COG_CTRL").offset = [
          0.03 * Math.sin(t * Math.PI * 2),
          -0.03 + 0.08 * Math.sin(t * Math.PI),
          0.22 * t,
        ];
        ensureController(phase, "Chest_CTRL").rotation = [0.06 * Math.sin(t * Math.PI), 0.18 * Math.sin(t * Math.PI * 2), 0];
      });
      fixes.push("amplified_generic_visible_motion");
    }

    if (issueCodes.has("INTENT_NOT_FULFILLED")) {
      if (intent?.verb_family === "strike") {
        const side = intent.effector === "left_hand" ? "L" : "R";
        const sign = side === "R" ? -1 : 1;
        fixedPlan.phases.forEach((phase) => {
          const name = String(phase.phase_name || "");
          if (name.includes("anticipation") || name.includes("prepare")) {
            const control = ensureController(phase, `${side}_Hand_IK`);
            control.offset[0] = sign * Math.max(Math.abs(Number(control.offset[0]) || 0), 0.28);
            control.offset[2] = Math.min(Number(control.offset[2]) || 0, -0.24);
          }
          if (name.includes("execute") || name.includes("impact") || name.includes("follow")) {
            const control = ensureController(phase, `${side}_Hand_IK`);
            control.offset[0] = sign * Math.max(Math.abs(Number(control.offset[0]) || 0), name.includes("impact") ? 0.40 : 0.34);
            control.offset[2] = Math.max(Number(control.offset[2]) || 0, name.includes("impact") ? 0.78 : 0.58);
            ensureController(phase, "Chest_CTRL").rotation[1] += side === "R" ? -0.10 : 0.10;
          }
        });
        fixes.push("amplified_strike_effector_forward_drive");
      } else if (intent?.verb_family === "lie_down") {
        fixedPlan.phases.forEach((phase) => {
          const name = String(phase.phase_name || "");
          if (name.includes("lower") || name.includes("settle")) {
            ensureController(phase, "COG_CTRL").offset[1] = Math.min(ensureController(phase, "COG_CTRL").offset[1], name.includes("settle") ? -0.82 : -0.48);
            ensureController(phase, "Chest_CTRL").rotation[0] = Math.max(ensureController(phase, "Chest_CTRL").rotation[0], name.includes("settle") ? 1.2 : 0.65);
          }
        });
        fixes.push("amplified_lie_down_descent");
      } else if (intent?.verb_family === "crouch" || intent?.validation_profile === "crouch" || intent?.subtype === "crouch") {
        fixedPlan.phases.forEach((phase) => {
          const name = String(phase.phase_name || "");
          if (name.includes("crouch") || name.includes("hold") || name.includes("lower")) {
            ensureController(phase, "COG_CTRL").offset[1] = Math.min(ensureController(phase, "COG_CTRL").offset[1], name.includes("hold") ? -0.34 : -0.30);
            ensureController(phase, "Chest_CTRL").rotation[0] = Math.max(ensureController(phase, "Chest_CTRL").rotation[0], name.includes("hold") ? 0.14 : 0.20);
            phase.contact_state ||= {};
            phase.contact_state.feet = { R: "locked", L: "locked" };
            ensureController(phase, "R_Foot_IK").locked = true;
            ensureController(phase, "L_Foot_IK").locked = true;
          }
        });
        pinLockedControls(fixedPlan.phases, "feet");
        fixes.push("amplified_crouch_descent_and_foot_support");
      } else if (["push", "pull"].includes(intent?.verb_family)) {
        fixedPlan.phases.forEach((phase) => {
          const name = String(phase.phase_name || "");
          if (name.includes("contact") || name.includes("force") || name.includes("push") || name.includes("execute")) {
            phase.contact_state ||= {};
            phase.contact_state.hands = { R: "locked", L: "locked" };
            ensureController(phase, "R_Hand_IK").locked = true;
            ensureController(phase, "L_Hand_IK").locked = true;
            ensureController(phase, "COG_CTRL").offset[2] = Math.max(ensureController(phase, "COG_CTRL").offset[2], 0.18);
          }
        });
        pinLockedControls(fixedPlan.phases, "hands");
        fixes.push("reinforced_interaction_contact_and_body_drive");
      }
    }

    if (issueCodes.has("foot_sliding") || issueCodes.has("FOOT_SLIDING")) {
      pinLockedControls(fixedPlan.phases, "feet");
      fixes.push("pinned_locked_footik_offsets");
    }

    if (issueCodes.has("CONTACT_LOCK_DRIFT")) {
      pinLockedControls(fixedPlan.phases, "hands");
      pinLockedControls(fixedPlan.phases, "feet");
      fixes.push("pinned_locked_contact_targets");
    }

    if (issueCodes.has("hand_contact_consistency") || issueCodes.has("interaction_missing_contact_lock") || issueCodes.has("CONTACT_LOCK_MISSING") || issueCodes.has("CONTACT_LOCK_DRIFT")) {
      fixedPlan.phases.forEach((phase) => {
        const name = String(phase.phase_name || "");
        if (["contact", "execute", "push"].some((part) => name.includes(part))) {
          phase.contact_state ||= {};
          phase.contact_state.hands = { R: "locked", L: "locked" };
          ensureController(phase, "R_Hand_IK").locked = true;
          ensureController(phase, "L_Hand_IK").locked = true;
        }
      });
      pinLockedControls(fixedPlan.phases, "hands");
      fixes.push("locked_handik_during_contact");
    }

    if ((issueCodes.has("run_missing_flight") || issueCodes.has("RUN_MISSING_FLIGHT")) && !hasPhase(fixedPlan.phases, "flight")) {
      insertBeforeRecover(fixedPlan.phases, makePhase("flight", 4, ["release_foot", "swing_arm"], {
        COG_CTRL: { offset: [0, 0.16, 0.16], rotation: [0, 0, 0] },
        R_Foot_IK: { offset: [0, 0.12, 0.08], rotation: [0, 0, 0] },
        L_Foot_IK: { offset: [0, 0.12, -0.08], rotation: [0, 0, 0] },
      }, { feet: { R: "free", L: "free" } }));
      fixedPlan.duration_frames += 4;
      fixes.push("inserted_run_flight_phase");
    }

    if ((issueCodes.has("jump_missing_anticipation") || issueCodes.has("JUMP_MISSING_ANTICIPATION")) && !hasPhase(fixedPlan.phases, "anticipation")) {
      fixedPlan.phases.unshift(makePhase("anticipation", 4, ["crouch_down", "plant_foot"], {
        COG_CTRL: { offset: [0, -0.18, -0.02], rotation: [0, 0, 0] },
        Chest_CTRL: { offset: [0, 0, 0], rotation: [0.18, 0, 0] },
        R_Foot_IK: { offset: [0, 0, 0], rotation: [0, 0, 0], locked: true },
        L_Foot_IK: { offset: [0, 0, 0], rotation: [0, 0, 0], locked: true },
      }, { feet: { R: "locked", L: "locked" } }));
      fixedPlan.duration_frames += 4;
      fixes.push("inserted_jump_anticipation_phase");
    }

    if ((issueCodes.has("attack_missing_follow_through") || issueCodes.has("ATTACK_MISSING_FOLLOW_THROUGH")) && !hasPhase(fixedPlan.phases, "follow_through")) {
      insertBeforeRecover(fixedPlan.phases, makePhase("follow_through", 4, ["follow_through"], {
        COG_CTRL: { offset: [0.04, 0, 0.28], rotation: [0, 0, 0] },
        Chest_CTRL: { offset: [0, 0, 0], rotation: [-0.05, 0.22, -0.04] },
        R_Hand_IK: { offset: [-0.18, -0.10, 0.42], rotation: [0, 0, 0] },
        L_Hand_IK: { offset: [0.18, -0.09, 0.40], rotation: [0, 0, 0] },
      }));
      fixedPlan.duration_frames += 4;
      fixes.push("inserted_attack_follow_through_phase");
    }

    if (issueCodes.has("interaction_missing_contact_lock") && !hasPhase(fixedPlan.phases, "contact")) {
      insertBeforeRecover(fixedPlan.phases, makePhase("contact", 4, ["lock_hand", "brace_body"], {
        R_Hand_IK: { offset: [-0.10, -0.08, 0.32], rotation: [0, 0, 0], locked: true },
        L_Hand_IK: { offset: [0.10, -0.08, 0.32], rotation: [0, 0, 0], locked: true },
      }, { hands: { R: "locked", L: "locked" } }));
      fixedPlan.duration_frames += 4;
      fixes.push("inserted_interaction_contact_lock_phase");
    }

    return {
      applied: fixes.length > 0,
      fixes,
      motion_plan: normalizeMotionPlan(fixedPlan),
      source_issues: [...issueCodes],
    };
  }
}
