export const ACTION_INTENT_FIELDS = [
  "raw_text",
  "action_type",
  "subtype",
  "emotion",
  "mood",
  "energy",
  "speed",
  "force",
  "style",
  "loopable",
  "duration_frames",
  "body_posture",
  "direction",
  "target",
  "main_body_part",
  "hand_usage",
  "foot_usage",
  "prop_usage",
  "contact_requirements",
  "constraints",
  "validation_profile",
  "parser_confidence",
  "parsed_verbs",
  "parsed_body_parts",
  "parsed_direction",
  "parsed_target",
  "missing_slots",
  "uncertainty_flags",
];

export const DEFAULT_ACTION_INTENT = {
  raw_text: "",
  action_type: "unknown",
  subtype: "generic",
  emotion: "neutral",
  mood: "neutral",
  energy: "medium",
  speed: "medium",
  force: "medium",
  style: "natural",
  loopable: false,
  duration_frames: 24,
  body_posture: "upright",
  direction: "forward",
  target: null,
  main_body_part: "full_body",
  hand_usage: "none",
  foot_usage: "balanced",
  prop_usage: "none",
  contact_requirements: [],
  constraints: [],
  validation_profile: "generic",
  parser_confidence: 0,
  parsed_verbs: [],
  parsed_body_parts: [],
  parsed_direction: null,
  parsed_target: null,
  missing_slots: [],
  uncertainty_flags: [],
};

export function createActionIntent(overrides = {}) {
  const intent = {
    ...DEFAULT_ACTION_INTENT,
    ...overrides,
  };
  intent.duration_frames = Math.max(8, Math.round(Number(intent.duration_frames) || DEFAULT_ACTION_INTENT.duration_frames));
  intent.loopable = Boolean(intent.loopable);
  intent.contact_requirements = Array.isArray(intent.contact_requirements) ? intent.contact_requirements : [];
  intent.constraints = Array.isArray(intent.constraints) ? intent.constraints : [];
  intent.parsed_verbs = Array.isArray(intent.parsed_verbs) ? intent.parsed_verbs : [];
  intent.parsed_body_parts = Array.isArray(intent.parsed_body_parts) ? intent.parsed_body_parts : [];
  intent.missing_slots = Array.isArray(intent.missing_slots) ? intent.missing_slots : [];
  intent.uncertainty_flags = Array.isArray(intent.uncertainty_flags) ? intent.uncertainty_flags : [];
  intent.parser_confidence = Math.max(0, Math.min(1, Number(intent.parser_confidence) || 0));
  return intent;
}

export function validateActionIntent(intent) {
  const errors = [];
  ACTION_INTENT_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(intent || {}, field)) {
      errors.push(`missing:${field}`);
    }
  });
  if (!Number.isFinite(Number(intent?.duration_frames)) || Number(intent.duration_frames) < 1) {
    errors.push("invalid:duration_frames");
  }
  if (typeof intent?.loopable !== "boolean") {
    errors.push("invalid:loopable");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
