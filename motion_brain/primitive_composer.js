import { getActionPrimitives } from "./action_primitive_library.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function defaultParamsForPrimitive(primitiveId, actionIR = {}, phase = {}) {
  const timing = {
    phase: phase.phase_name || "phase",
    frame: phase.frame || 1,
    duration: phase.duration || 1,
  };
  if (primitiveId.includes("effector") || primitiveId.includes("limb") || primitiveId.includes("contact")) {
    return {
      effector: actionIR.effector || "full_body",
      target: actionIR.target || null,
      direction: actionIR.direction || "forward",
      timing,
    };
  }
  if (primitiveId.includes("cog") || primitiveId.includes("weight") || primitiveId.includes("body")) {
    return {
      direction: actionIR.direction || "forward",
      amount: actionIR.force === "heavy" ? "large" : "medium",
      timing,
    };
  }
  return {
    direction: actionIR.direction || "forward",
    force: actionIR.force || "medium",
    timing,
  };
}

export class PrimitiveComposer {
  compose(actionIR, motionPlan) {
    const required = actionIR?.required_primitives || [];
    const phases = (motionPlan.phases || []).map((phase) => {
      const primitiveIds = unique([...(phase.primitives_used || []), ...required.filter((id) => {
        const name = String(phase.phase_name || "");
        if (name.includes("recover") || name.includes("settle")) return ["recover_pose", "settle_pose", "release_contact"].includes(id);
        if (name.includes("contact")) return ["lock_contact", "plant_foot", "reach_effector"].includes(id);
        if (name.includes("impact") || name.includes("execute") || name.includes("force") || name.includes("push")) return !["recover_pose"].includes(id);
        return ["shift_weight", "lower_cog", "lean_body", "rotate_torso", "reach_effector", "bend_knees"].includes(id);
      })]);
      return {
        ...phase,
        primitives_used: primitiveIds,
        primitive_ops: primitiveIds.map((primitiveId) => ({
          primitive_id: primitiveId,
          params: defaultParamsForPrimitive(primitiveId, actionIR, phase),
        })),
      };
    });
    const primitivesUsed = unique(phases.flatMap((phase) => phase.primitives_used || []));
    return {
      motion_plan: {
        ...clone(motionPlan),
        phases,
        primitives_used: primitivesUsed,
        action_primitives: getActionPrimitives(primitivesUsed),
      },
      primitive_sequence: phases.flatMap((phase) => phase.primitive_ops.map((op) => ({
        phase_name: phase.phase_name,
        ...op,
      }))),
      primitives_used: primitivesUsed,
    };
  }
}
