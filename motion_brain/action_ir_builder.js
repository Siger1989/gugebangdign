import { getActionGrammar } from "./action_grammar.js";
import { createActionIR, validateActionIR } from "./action_ir.js";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function inferEffector(intent = {}) {
  const part = String(intent.main_body_part || "");
  const handUsage = String(intent.hand_usage || "");
  if (part.includes("right") || handUsage === "right_hand") return "right_hand";
  if (part.includes("left") || handUsage === "left_hand") return "left_hand";
  if (part.includes("both") || handUsage === "both_hands") return "both_hands";
  if (part.includes("foot") && part.includes("right")) return "right_foot";
  if (part.includes("foot") && part.includes("left")) return "left_foot";
  if (["idle", "locomotion", "posture_transition", "reaction", "hit_reaction", "traversal"].includes(intent.action_type)) {
    return "full_body";
  }
  return "full_body";
}

function inferVerbFamily(intent = {}) {
  if (intent.subtype === "walk" || intent.subtype === "run") return "move";
  if (String(intent.subtype || "").includes("jump")) return "jump";
  if (intent.subtype === "standing_to_ground" || intent.validation_profile === "lie_down") return "lie_down";
  if (String(intent.subtype || "").includes("push")) return "push";
  if (String(intent.subtype || "").includes("pick")) return "grab";
  if (String(intent.subtype || "").includes("strike") || intent.validation_profile === "attack") return "strike";
  if (String(intent.subtype || "").includes("collision") || intent.validation_profile === "hit_reaction") return "impact_body";
  if (String(intent.subtype || "").includes("roll") || intent.validation_profile === "dodge") return "roll";
  if (String(intent.subtype || "").includes("wave") || String(intent.subtype || "").includes("raise")) return "wave";
  if (intent.action_type === "idle") return "recover";
  return "move";
}

function inferContactType(intent = {}, verbFamily) {
  if (verbFamily === "strike" || verbFamily === "impact_body") return "impact";
  if (["push", "pull"].includes(verbFamily)) return "sustained_lock";
  if (verbFamily === "grab") return "grab_lock";
  if (verbFamily === "lie_down") return "ground_support";
  if (intent.validation_profile === "walk" || intent.validation_profile === "run") return "foot_support";
  return "none";
}

function inferEndPose(intent = {}, verbFamily) {
  if (verbFamily === "lie_down") return "lying_on_floor";
  if (intent.validation_profile === "idle") return "relaxed_idle";
  if (intent.validation_profile === "walk" || intent.validation_profile === "run") return "locomotion_cycle";
  if (verbFamily === "grab") return "secured_object";
  return "recovered";
}

export class ActionIRBuilder {
  build(intent, parserInfo = {}) {
    const verbFamily = inferVerbFamily(intent);
    const grammar = getActionGrammar({ ...intent, verb_family: verbFamily });
    const parserConfidence = Number(intent.parser_confidence ?? parserInfo.parser_confidence ?? 0);
    const uncertaintyFlags = unique([
      ...(intent.uncertainty_flags || []),
      ...(parserConfidence < 0.6 ? ["parser_uncertain"] : []),
      ...(intent.action_type === "generic" && intent.subtype === "generic" ? ["generic_fallback"] : []),
    ]);
    const ir = createActionIR({
      raw_text: intent.raw_text,
      parser_confidence: parserConfidence,
      action_type: intent.action_type === "combat" ? "attack" : intent.action_type,
      verb_family: verbFamily,
      subtype: intent.subtype,
      effector: inferEffector(intent),
      main_body_part: intent.main_body_part,
      target: intent.target,
      direction: intent.direction,
      contact_type: inferContactType(intent, verbFamily),
      force: intent.force === "strong" ? "heavy" : intent.force,
      speed: intent.speed,
      emotion: intent.emotion,
      style: intent.style,
      loopable: intent.loopable,
      duration_frames: intent.duration_frames,
      start_pose: "standing",
      end_pose: inferEndPose(intent, verbFamily),
      required_phases: [...(grammar.required_phases || [])],
      required_primitives: [...(grammar.required_primitives || [])],
      constraints: unique([...(intent.constraints || []), ...(intent.contact_requirements || [])]),
      validation_profile: intent.validation_profile,
      missing_slots: [...(intent.missing_slots || [])],
      uncertainty_flags: uncertaintyFlags,
      contact_state: {},
      external_force: null,
      physics_weight: 0,
      support_points: intent.foot_usage?.includes("support") ? ["feet"] : [],
      body_mass_hint: intent.energy === "low" ? "heavy" : "default",
      impact_force_hint: verbFamily === "impact_body" || verbFamily === "strike" ? intent.force : "none",
      ground_contact_points: verbFamily === "lie_down" ? ["feet", "hands", "torso"] : [],
      prop_weight_hint: intent.prop_usage === "weapon" ? "weapon_light" : "none",
    });
    return {
      action_ir: ir,
      validation: validateActionIR(ir),
    };
  }
}
