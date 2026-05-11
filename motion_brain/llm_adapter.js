import { validateActionIntent } from "./action_intent.js";
import { validateActionIR } from "./action_ir.js";

export function validateLlmActionIntentJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["invalid:object"] };
  }
  return validateActionIntent(value);
}

export function validateLlmActionIRJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["invalid:object"] };
  }
  return validateActionIR(value);
}

export function validateLlmMotionPlanJson(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("invalid:object");
  }
  if (!Array.isArray(value?.phases) || value.phases.length === 0) {
    errors.push("missing:phases");
  }
  (value?.phases || []).forEach((phase, index) => {
    if (!phase.phase_name) errors.push(`missing:phases.${index}.phase_name`);
    if (!Number.isFinite(Number(phase.duration))) errors.push(`invalid:phases.${index}.duration`);
    if (!Array.isArray(phase.primitives_used)) errors.push(`missing:phases.${index}.primitives_used`);
  });
  return {
    valid: errors.length === 0,
    errors,
  };
}

export class LLMAdapter {
  parseIntentJson(value) {
    const validation = validateLlmActionIntentJson(value);
    if (!validation.valid) {
      throw new Error(`LLM ActionIntent schema failed: ${validation.errors.join(", ")}`);
    }
    return value;
  }

  parseActionIRJson(value) {
    const validation = validateLlmActionIRJson(value);
    if (!validation.valid) {
      throw new Error(`LLM ActionIR schema failed: ${validation.errors.join(", ")}`);
    }
    return value;
  }

  parseMotionPlanJson(value) {
    const validation = validateLlmMotionPlanJson(value);
    if (!validation.valid) {
      throw new Error(`LLM MotionPlan schema failed: ${validation.errors.join(", ")}`);
    }
    return value;
  }
}
