export const ACTION_IR_FIELDS = [
  "raw_text",
  "parser_confidence",
  "action_type",
  "verb_family",
  "subtype",
  "effector",
  "main_body_part",
  "target",
  "direction",
  "contact_type",
  "force",
  "speed",
  "emotion",
  "style",
  "loopable",
  "start_pose",
  "end_pose",
  "required_phases",
  "required_primitives",
  "constraints",
  "validation_profile",
  "missing_slots",
  "uncertainty_flags",
  "contact_state",
  "external_force",
  "physics_weight",
  "support_points",
  "body_mass_hint",
  "impact_force_hint",
  "ground_contact_points",
  "prop_weight_hint",
];

export const DEFAULT_ACTION_IR = {
  raw_text: "",
  parser_confidence: 0,
  action_type: "custom",
  verb_family: "move",
  subtype: "generic",
  effector: "full_body",
  main_body_part: "full_body",
  target: null,
  direction: "forward",
  contact_type: "none",
  force: "medium",
  speed: "medium",
  emotion: "neutral",
  style: "natural",
  loopable: false,
  duration_frames: 24,
  start_pose: "current",
  end_pose: "current",
  required_phases: [],
  required_primitives: [],
  constraints: [],
  validation_profile: "generic",
  missing_slots: [],
  uncertainty_flags: [],
  contact_state: {},
  external_force: null,
  physics_weight: 0,
  support_points: [],
  body_mass_hint: "default",
  impact_force_hint: "none",
  ground_contact_points: [],
  prop_weight_hint: "none",
};

export function createActionIR(overrides = {}) {
  const ir = {
    ...DEFAULT_ACTION_IR,
    ...overrides,
  };
  ir.parser_confidence = Math.max(0, Math.min(1, Number(ir.parser_confidence) || 0));
  ir.duration_frames = Math.max(8, Math.round(Number(ir.duration_frames) || DEFAULT_ACTION_IR.duration_frames));
  ir.loopable = Boolean(ir.loopable);
  ir.required_phases = Array.isArray(ir.required_phases) ? ir.required_phases : [];
  ir.required_primitives = Array.isArray(ir.required_primitives) ? ir.required_primitives : [];
  ir.constraints = Array.isArray(ir.constraints) ? ir.constraints : [];
  ir.missing_slots = Array.isArray(ir.missing_slots) ? ir.missing_slots : [];
  ir.uncertainty_flags = Array.isArray(ir.uncertainty_flags) ? ir.uncertainty_flags : [];
  ir.support_points = Array.isArray(ir.support_points) ? ir.support_points : [];
  ir.ground_contact_points = Array.isArray(ir.ground_contact_points) ? ir.ground_contact_points : [];
  return ir;
}

export function validateActionIR(ir) {
  const errors = [];
  ACTION_IR_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(ir || {}, field)) {
      errors.push(`missing:${field}`);
    }
  });
  if (!Number.isFinite(Number(ir?.parser_confidence)) || ir.parser_confidence < 0 || ir.parser_confidence > 1) {
    errors.push("invalid:parser_confidence");
  }
  if (!Array.isArray(ir?.required_phases)) {
    errors.push("invalid:required_phases");
  }
  if (!Array.isArray(ir?.required_primitives)) {
    errors.push("invalid:required_primitives");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
