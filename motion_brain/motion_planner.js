import { getActionGrammar } from "./action_grammar.js";
import { getActionPrimitives } from "./action_primitive_library.js";
import { findPrototypeForIntent } from "./action_prototype_library.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function controller(offset = [0, 0, 0], rotation = [0, 0, 0], extra = {}) {
  return { offset, rotation, ...extra };
}

function makePhase(phaseName, duration, primitivesUsed, controllers = {}, contactState = {}, extra = {}) {
  return normalizePhase({
    frame: 1,
    phase_name: phaseName,
    duration,
    primitives_used: primitivesUsed,
    controllers,
    contact_state: contactState,
    ...extra,
  });
}

function normalizeVector(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length !== 3) {
    return [...fallback];
  }
  return value.map((item, index) => Number.isFinite(Number(item)) ? Number(item) : fallback[index] || 0);
}

function normalizePhase(source = {}) {
  const controllers = clone(source.controllers || {});
  const rootMotion = normalizeVector(source.root_motion || controllers.Root_CTRL?.offset);
  const cogMotion = normalizeVector(source.cog_motion || controllers.COG_CTRL?.offset);
  const hipMotion = normalizeVector(source.hip_motion || controllers.Pelvis_CTRL?.rotation);
  const chestMotion = normalizeVector(source.chest_motion || controllers.Chest_CTRL?.rotation);
  const headMotion = normalizeVector(source.head_motion || controllers.Head_CTRL?.rotation);
  return {
    frame: Math.max(1, Math.round(Number(source.frame) || 1)),
    phase_name: source.phase_name || "phase",
    duration: Math.max(1, Math.round(Number(source.duration) || 1)),
    root_motion: rootMotion,
    cog_motion: cogMotion,
    hip_motion: hipMotion,
    chest_motion: chestMotion,
    head_motion: headMotion,
    hand_ik: {
      R: clone(source.hand_ik?.R || controllers.R_Hand_IK || null),
      L: clone(source.hand_ik?.L || controllers.L_Hand_IK || null),
    },
    foot_ik: {
      R: clone(source.foot_ik?.R || controllers.R_Foot_IK || null),
      L: clone(source.foot_ik?.L || controllers.L_Foot_IK || null),
    },
    pole_targets: {
      R_Knee_Pole: clone(source.pole_targets?.R_Knee_Pole || controllers.R_Knee_Pole || null),
      L_Knee_Pole: clone(source.pole_targets?.L_Knee_Pole || controllers.L_Knee_Pole || null),
      R_Elbow_Pole: clone(source.pole_targets?.R_Elbow_Pole || controllers.R_Elbow_Pole || null),
      L_Elbow_Pole: clone(source.pole_targets?.L_Elbow_Pole || controllers.L_Elbow_Pole || null),
    },
    fk_controls: clone(source.fk_controls || {}),
    ik_fk_blend: clone(source.ik_fk_blend || {}),
    contact_state: clone(source.contact_state || {}),
    primitives_used: Array.isArray(source.primitives_used) ? [...source.primitives_used] : [],
    controllers,
  };
}

function scaleDurations(phases, targetDuration) {
  const safeTarget = Math.max(phases.length, Math.round(Number(targetDuration) || 24));
  const total = phases.reduce((sum, phase) => sum + Math.max(1, Number(phase.duration) || 1), 0) || safeTarget;
  const scaled = phases.map((phase) => ({
    ...phase,
    duration: Math.max(1, Math.round((Math.max(1, Number(phase.duration) || 1) / total) * safeTarget)),
  }));
  let delta = safeTarget - scaled.reduce((sum, phase) => sum + phase.duration, 0);
  let index = scaled.length - 1;
  while (delta !== 0 && scaled.length > 0) {
    const phase = scaled[index];
    if (delta > 0) {
      phase.duration += 1;
      delta -= 1;
    } else if (phase.duration > 1) {
      phase.duration -= 1;
      delta += 1;
    }
    index = (index - 1 + scaled.length) % scaled.length;
  }
  return scaled;
}

export function normalizeMotionPlan(plan) {
  const phases = (plan.phases || []).map(normalizePhase);
  let frame = 1;
  phases.forEach((phase) => {
    phase.frame = frame;
    frame += phase.duration;
  });
  return {
    schema: "motion_plan_v1",
    ...plan,
    duration_frames: Math.max(1, Math.round(Number(plan.duration_frames) || Math.max(1, frame - 1))),
    phases,
    primitives_used: [...new Set(phases.flatMap((phase) => phase.primitives_used || []))],
  };
}

function buildDodgeRollPlan(intent) {
  return [
    makePhase("anticipation", 1, ["crouch_down", "shift_weight"], {
      COG_CTRL: controller([0, -0.18, -0.05]),
      Chest_CTRL: controller([0, 0, 0], [0.28, 0, 0]),
      R_Hand_IK: controller([-0.10, -0.20, -0.10]),
      L_Hand_IK: controller([0.10, -0.20, -0.10]),
      R_Foot_IK: controller([0, 0, 0], [0, 0, 0], { locked: true }),
      L_Foot_IK: controller([0, 0, 0], [0, 0, 0], { locked: true }),
    }, { feet: { R: "locked", L: "locked" } }),
    makePhase("drop", Math.max(4, Math.round(intent.duration_frames * 0.22)), ["release_foot", "lean_body"], {
      COG_CTRL: controller([0, -0.36, 0.12]),
      Chest_CTRL: controller([0, 0, 0], [0.62, 0.12, 0.18]),
      R_Foot_IK: controller([0, 0.08, -0.05]),
      L_Foot_IK: controller([0, 0.10, 0.06]),
    }, { feet: { R: "free", L: "free" } }),
    makePhase("roll", Math.max(8, Math.round(intent.duration_frames * 0.42)), ["rotate_torso", "release_foot", "follow_through"], {
      COG_CTRL: controller([0.05, -0.44, 0.32]),
      Pelvis_CTRL: controller([0, 0, 0], [0.2, 0.5, 0.85]),
      Chest_CTRL: controller([0, 0, 0], [0.7, 0.75, 1.15]),
      Head_CTRL: controller([0, 0, 0], [0.28, 0.35, 0.4]),
      R_Hand_IK: controller([-0.08, -0.28, 0.22]),
      L_Hand_IK: controller([0.08, -0.28, 0.18]),
    }),
    makePhase("recover", Math.max(5, Math.round(intent.duration_frames * 0.28)), ["recover_pose", "plant_foot"], {
      COG_CTRL: controller([0, -0.04, 0.48]),
      Chest_CTRL: controller([0, 0, 0], [0.08, 0.10, 0]),
      R_Hand_IK: controller([-0.12, -0.26, 0.38]),
      L_Hand_IK: controller([0.12, -0.26, 0.36]),
      R_Foot_IK: controller([0, 0, 0.46], [0, 0, 0], { locked: true }),
      L_Foot_IK: controller([0, 0, 0.42], [0, 0, 0], { locked: true }),
    }, { feet: { R: "locked", L: "locked" } }),
  ];
}

function effectorSides(intent) {
  if (intent.effector === "right_hand" || intent.hand_usage === "right_hand" || String(intent.main_body_part || "").includes("right")) return ["R"];
  if (intent.effector === "left_hand" || intent.hand_usage === "left_hand" || String(intent.main_body_part || "").includes("left")) return ["L"];
  return ["R", "L"];
}

function handControllersForEffector(intent, offsetsBySide, extra = {}) {
  const controllers = {};
  effectorSides(intent).forEach((side) => {
    controllers[`${side}_Hand_IK`] = controller(offsetsBySide[side] || offsetsBySide.default || [0, 0, 0], [0, 0, 0], extra);
  });
  return controllers;
}

function buildStrikePlan(intent) {
  const side = effectorSides(intent)[0] || "R";
  const other = side === "R" ? "L" : "R";
  const sign = side === "R" ? -1 : 1;
  return [
    makePhase("anticipation", 4, ["shift_weight", "rotate_torso", "retract_effector"], {
      COG_CTRL: controller([0.02 * -sign, -0.02, -0.04]),
      Pelvis_CTRL: controller([0, 0, 0], [0, -0.16 * sign, 0.03 * sign]),
      Chest_CTRL: controller([0, 0, 0], [0.02, 0.22 * sign, -0.04 * sign]),
      [`${side}_Hand_IK`]: controller([0.28 * sign, -0.18, -0.24]),
      [`${other}_Hand_IK`]: controller([0.12 * -sign, -0.22, 0.02]),
    }),
    makePhase("execute", 5, ["shift_weight", "rotate_torso", "drive_effector", "extend_limb"], {
      COG_CTRL: controller([0.03 * sign, 0, 0.16]),
      Pelvis_CTRL: controller([0, 0, 0], [0, 0.10 * sign, 0]),
      Chest_CTRL: controller([0, 0, 0], [0.02, -0.18 * sign, 0.03 * sign]),
      [`${side}_Hand_IK`]: controller([0.36 * sign, -0.10, 0.50]),
      [`${other}_Hand_IK`]: controller([0.10 * -sign, -0.22, -0.02]),
    }),
    makePhase("impact", 3, ["impact", "brace_body"], {
      COG_CTRL: controller([0.04 * sign, 0.01, 0.24]),
      Chest_CTRL: controller([0, 0, 0], [0.04, -0.24 * sign, 0.02 * sign]),
      [`${side}_Hand_IK`]: controller([0.40 * sign, -0.08, 0.72], [0, 0, 0], { locked: true }),
      R_Foot_IK: controller([0, 0, 0.04], [0, 0, 0], { locked: true }),
      L_Foot_IK: controller([0, 0, -0.03], [0, 0, 0], { locked: true }),
    }, { hands: { [side]: "locked" }, feet: { R: "locked", L: "locked" } }),
    makePhase("follow_through", 5, ["follow_through", "release_contact"], {
      COG_CTRL: controller([0.03 * sign, 0, 0.30]),
      Chest_CTRL: controller([0, 0, 0], [0.02, -0.30 * sign, 0.03 * sign]),
      [`${side}_Hand_IK`]: controller([0.32 * sign, -0.12, 0.58]),
    }),
    makePhase("recover", 7, ["retract_effector", "recover_pose"], {
      COG_CTRL: controller([0, -0.01, 0.06]),
      Chest_CTRL: controller([0, 0, 0], [0, 0, 0]),
      [`${side}_Hand_IK`]: controller([0.20 * sign, -0.24, 0.02]),
      [`${other}_Hand_IK`]: controller([0.10 * -sign, -0.24, 0.02]),
    }),
  ];
}

function buildLieDownPlan(intent) {
  return [
    makePhase("prepare", 4, ["shift_weight", "bend_knees"], {
      COG_CTRL: controller([0, -0.10, -0.03]),
      Chest_CTRL: controller([0, 0, 0], [0.16, 0, 0]),
      R_Foot_IK: controller([0, 0, 0], [0, 0, 0], { locked: true }),
      L_Foot_IK: controller([0, 0, 0], [0, 0, 0], { locked: true }),
    }, { feet: { R: "locked", L: "locked" } }),
    makePhase("lower_center", 8, ["lower_cog", "bend_knees", "lean_body"], {
      COG_CTRL: controller([0, -0.36, -0.06]),
      Pelvis_CTRL: controller([0, 0, 0], [0.22, 0, 0]),
      Chest_CTRL: controller([0, 0, 0], [0.42, 0, 0]),
      Head_CTRL: controller([0, 0, 0], [0.22, 0, 0]),
      R_Hand_IK: controller([-0.16, -0.34, 0.10]),
      L_Hand_IK: controller([0.16, -0.34, 0.10]),
    }),
    makePhase("support_contact", 6, ["reach_effector", "lock_contact"], {
      COG_CTRL: controller([0, -0.50, 0.02]),
      Chest_CTRL: controller([0, 0, 0], [0.70, 0, 0]),
      R_Hand_IK: controller([-0.20, -0.62, 0.18], [0, 0, 0], { locked: true }),
      L_Hand_IK: controller([0.20, -0.62, 0.18], [0, 0, 0], { locked: true }),
    }, { hands: { R: "locked", L: "locked" }, feet: { R: "locked", L: "locked" } }),
    makePhase("body_lower", 10, ["lower_cog", "lean_body", "release_contact"], {
      COG_CTRL: controller([0, -0.74, 0.10]),
      Pelvis_CTRL: controller([0, 0, 0], [1.15, 0, 0]),
      Chest_CTRL: controller([0, 0, 0], [1.22, 0, 0]),
      Head_CTRL: controller([0, 0, 0], [0.70, 0, 0]),
      R_Hand_IK: controller([-0.24, -0.70, 0.22]),
      L_Hand_IK: controller([0.24, -0.70, 0.22]),
      R_Foot_IK: controller([0, 0.02, -0.16]),
      L_Foot_IK: controller([0, 0.02, -0.16]),
    }),
    makePhase("settle_on_floor", 8, ["settle_pose", "recover_pose"], {
      COG_CTRL: controller([0, -0.82, 0.14]),
      Pelvis_CTRL: controller([0, 0, 0], [1.35, 0, 0]),
      Chest_CTRL: controller([0, 0, 0], [1.35, 0, 0]),
      Head_CTRL: controller([0, 0, 0], [0.82, 0, 0]),
      R_Hand_IK: controller([-0.18, -0.58, 0.08]),
      L_Hand_IK: controller([0.18, -0.58, 0.08]),
    }, { ground: { body: "supported" } }),
  ];
}

function buildGenericPlan(intent, grammar) {
  if (intent.subtype === "dodge_roll") {
    return buildDodgeRollPlan(intent);
  }
  if (intent.verb_family === "strike" || intent.subtype === "forward_strike") {
    return buildStrikePlan(intent);
  }
  if (intent.verb_family === "lie_down" || intent.subtype === "standing_to_ground") {
    return buildLieDownPlan(intent);
  }
  const phases = grammar.required_phases || ["prepare", "main_action", "recover"];
  const primitivePool = grammar.required_primitives || ["shift_weight", "lean_body", "recover_pose"];
  return phases.map((phaseName, index) => {
    const t = phases.length <= 1 ? 0 : index / (phases.length - 1);
    const isRecover = phaseName.includes("recover");
    return makePhase(phaseName, Math.max(4, Math.round(intent.duration_frames / phases.length)), primitivePool.slice(0, Math.max(1, Math.min(3, primitivePool.length))), {
      COG_CTRL: controller([0.025 * Math.sin(t * Math.PI * 2), isRecover ? -0.02 : -0.04 + 0.08 * t, 0.20 * t]),
      Pelvis_CTRL: controller([0, 0, 0], [0, 0.12 * Math.sin(t * Math.PI), 0.02 * Math.cos(t * Math.PI)]),
      Chest_CTRL: controller([0, 0, 0], [0.08 * (1 - t), -0.14 + 0.28 * t, -0.02 * Math.sin(t * Math.PI)]),
      R_Hand_IK: controller([-0.12, -0.25, 0.08 + 0.12 * t]),
      L_Hand_IK: controller([0.12, -0.27, 0.06 + 0.10 * t]),
    });
  });
}

export class MotionPlanner {
  plan(intent) {
    const grammar = getActionGrammar(intent);
    const prototype = findPrototypeForIntent(intent);
    const sourcePhases = prototype
      ? clone(prototype.phases || [])
      : buildGenericPlan(intent, grammar);
    const scaledPhases = scaleDurations(sourcePhases.map(normalizePhase), intent.duration_frames || prototype?.duration_frames || 24);
    const plan = normalizeMotionPlan({
      schema: "motion_plan_v1",
      intent: clone(intent),
      action_ir: clone(intent),
      prototype_id: prototype?.id || null,
      grammar_profile: grammar.validation_profile || intent.validation_profile || "generic",
      action_type: intent.action_type,
      verb_family: intent.verb_family || null,
      subtype: intent.subtype,
      loopable: Boolean(intent.loopable || prototype?.loopable),
      duration_frames: intent.duration_frames || prototype?.duration_frames || 24,
      phases: scaledPhases,
    });
    plan.action_primitives = getActionPrimitives(plan.primitives_used);
    return plan;
  }
}
