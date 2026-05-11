import { listActionPrimitives } from "./action_primitive_library.js";
import { ActionIntentParser } from "./action_intent_parser.js";
import { ActionIRBuilder } from "./action_ir_builder.js";
import { MotionPlanner } from "./motion_planner.js";
import { PrimitiveComposer } from "./primitive_composer.js";
import { ControllerCurveGenerator } from "./controller_curve_generator.js";
import { ActionValidator } from "./action_validator.js";
import { ActionAutoFixer } from "./action_auto_fixer.js";
import { IntentFulfillmentValidator } from "./intent_fulfillment_validator.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function primitiveSummary(ids = []) {
  const byId = new Map(listActionPrimitives().map((primitive) => [primitive.id, primitive]));
  return [...new Set(ids)].map((id) => byId.get(id) || { id, name: id, affects: [], tags: [] });
}

export class MotionBrainPipeline {
  constructor({
    parser = new ActionIntentParser(),
    irBuilder = new ActionIRBuilder(),
    planner = new MotionPlanner(),
    primitiveComposer = new PrimitiveComposer(),
    curveGenerator = new ControllerCurveGenerator(),
    validator = new ActionValidator(),
    intentFulfillmentValidator = new IntentFulfillmentValidator(),
    autoFixer = new ActionAutoFixer(),
  } = {}) {
    this.parser = parser;
    this.irBuilder = irBuilder;
    this.planner = planner;
    this.primitiveComposer = primitiveComposer;
    this.curveGenerator = curveGenerator;
    this.validator = validator;
    this.intentFulfillmentValidator = intentFulfillmentValidator;
    this.autoFixer = autoFixer;
  }

  generate_from_text(text, options = {}) {
    const parsed = this.parser.parse(text);
    if (!parsed.validation.valid && options.strict_schema) {
      throw new Error(`ActionIntent invalid: ${parsed.validation.errors.join(", ")}`);
    }

    const irBuild = this.irBuilder.build(parsed.intent, parsed.parser);
    if (!irBuild.validation.valid && options.strict_schema) {
      throw new Error(`ActionIR invalid: ${irBuild.validation.errors.join(", ")}`);
    }

    let motionPlan = this.planner.plan(irBuild.action_ir);
    let primitiveComposition = this.primitiveComposer.compose(irBuild.action_ir, motionPlan);
    motionPlan = primitiveComposition.motion_plan;
    let curveSet = this.curveGenerator.generate(motionPlan);
    let validation = this.validator.validate(irBuild.action_ir, motionPlan, curveSet.controller_keyframes);
    let autofix = {
      applied: false,
      fixes: [],
      source_issues: [],
    };

    if (validation.status !== "Passed") {
      autofix = this.autoFixer.fix({
        intent: irBuild.action_ir,
        action_ir: irBuild.action_ir,
        motion_plan: motionPlan,
        controller_keyframes: curveSet.controller_keyframes,
        validation,
      });
      if (autofix.applied) {
        motionPlan = autofix.motion_plan;
        primitiveComposition = this.primitiveComposer.compose(irBuild.action_ir, motionPlan);
        motionPlan = primitiveComposition.motion_plan;
        curveSet = this.curveGenerator.generate(motionPlan);
        validation = this.validator.validate(irBuild.action_ir, motionPlan, curveSet.controller_keyframes);
      }
    }

    const primitives = primitiveSummary(primitiveComposition.primitives_used || motionPlan.primitives_used);
    return {
      schema: "motion_brain_result_v1",
      generated_at: new Date().toISOString(),
      raw_text: String(text || ""),
      parser: parsed.parser,
      parser_validation: parsed.validation,
      action_intent: clone(parsed.intent),
      action_ir: clone(irBuild.action_ir),
      action_ir_validation: clone(irBuild.validation),
      motion_plan: clone(motionPlan),
      action_primitives: primitives,
      primitive_sequence: clone(primitiveComposition.primitive_sequence),
      controller_keyframes: clone(curveSet.controller_keyframes),
      controller_summary: clone(curveSet.controller_summary),
      validator: clone(validation),
      validation: clone(validation),
      autofix: clone(autofix),
      final_passed: validation.status === "Passed",
      pipeline_trace: [
        "ActionIntentParser",
        "ActionIRBuilder",
        "MotionPlanner",
        "PrimitiveComposer",
        "ControllerCurveGenerator",
        "ActionValidator",
        ...(autofix.applied ? ["ActionAutoFixer", "ControllerCurveGenerator", "ActionValidator"] : []),
      ],
    };
  }
}

export const MotionBrain = new MotionBrainPipeline();
