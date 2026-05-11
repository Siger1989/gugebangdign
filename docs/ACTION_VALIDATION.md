# Action Validation And Auto Fixing

Motion Brain validation runs before a generated result is accepted. The app also runs the existing rig/timeline validator after controller keyframes are applied to the current humanoid rig.

The current acceptance loop is:

1. Solve controller keyframes onto the rig.
2. Sample final keyframes and in-between frames with `PoseSampler`.
3. Extract final pose features with `PoseFeatureExtractor`.
4. Review intent-aware quality with `MotionCritic`.
5. Check semantic completion with `IntentFulfillmentValidator`.
6. Validate parser confidence, generic fallback state, plan, controller data, and final pose features with `ActionValidator`.
7. Classify blocker/warning/style issues with `MotionQualityGate`.
8. Run `ActionAutoFixer` and repeat the solve/review/validate loop up to 3 times when blockers remain.

## Validator Checks

- `no_tpose_residue`: hand IK should not keep arms wide and high like a T Pose.
- `has_body_motion`: Root / COG / Pelvis / Chest must drive the action.
- `contact_consistency`: locked HandIK should not drift during contact.
- `foot_sliding`: locked FootIK should not drift during support contact.
- `knee_elbow_flip`: pole target data must be valid.
- `loop_continuity`: loopable actions must end close to their first controller pose.
- `action_type_specific_rules`: run needs flight, jump needs anticipation/flight/landing, attack needs anticipation/follow-through, interaction needs contact lock.
- `parser_confidence`: low-confidence parser output is a review draft, not a fully accepted result.
- `visible_main_action`: generic fallback still needs visible motion and cannot be an empty "Passed" action.

## Intent Fulfillment

`IntentFulfillmentValidator` checks final solved poses against `ActionIR`.

- Strike: requested hand/fist, local-forward hand motion, elbow extension, torso/hip drive, and impact phase.
- Lie down: COG descent, lower/support/settle phases, and ground support contact.
- Push/pull interaction: target, reach/contact-lock/force phases, low hand-contact drift, and body weight participation.
- Walk: alternating foot contacts, no ordinary HandIK locking, and natural forward arm swing.
- Gesture: raised hand is required and is allowed by intent, so `ARM_TOO_HIGH` does not reject it.

## Pose Features

`PoseFeatureExtractor` currently extracts:

- arm height, abduction, forward/side swing, elbow bend, HandIK/FK weights, T Pose score, and A Pose score.
- Root/COG travel, vertical and forward COG motion, Pelvis/Chest rotation, counter-rotation, lean, and balance offset.
- foot contact state, foot sliding, knee bend, knee flip score, foot height, and flight existence.
- hand/foot locked target drift.
- phase count, anticipation, follow-through, recover, and loop continuity.

## Motion Critic

`MotionCritic` is global and intent-aware. Raised arms are allowed for wave, raise-hand, attack, weapon, push, pull, climb, defend, and interaction intents. The same raised arms are blockers for ordinary idle/walk/run when there is no upper-body task.

Examples of blocker issues:

- `ARM_TOO_HIGH`
- `HAND_IK_UNEXPECTED`
- `ARM_SWING_PLANE_WRONG`
- `TPOSE_RESIDUE`
- `NO_BODY_MOTION`
- `RUN_MISSING_FLIGHT`
- `CONTACT_LOCK_MISSING`
- `CONTACT_LOCK_DRIFT`

## Auto Fixes

- T Pose residue: lower HandIK and add natural asymmetry.
- Missing body motion: add COG travel and Hip/Chest counter-rotation.
- Foot sliding: pin locked FootIK offsets through contact spans.
- Run missing flight: insert a flight phase with free feet and higher COG.
- Jump missing anticipation: insert crouch anticipation and locked feet.
- Attack missing follow-through: insert follow-through before recover.
- Interaction hand drift or missing lock: lock HandIK through contact/execute and release afterward.
- Final lock drift: pin locked HandIK/FootIK targets and re-solve.
- Intent not fulfilled: amplify the main effector, add missing contact/impact/lower phases, or reinforce body drive depending on `ActionIR.verb_family`.

## Template Self Check

Existing motion templates can be reviewed with `self_check_motion_templates`. The report is stored in `MotionState.motion_template_self_check` and exposed through `window.__motionDebug.getMotionTemplateSelfCheck()`.

## LLM Guardrail

Future LLM output must pass schema validation in `motion_brain/llm_adapter.js`. Valid outputs are limited to:

- `ActionIntent` JSON
- `ActionIR` JSON
- `MotionPlan` JSON

Final skeleton poses, direct joint positions, and direct timeline keyframes are not valid LLM outputs. Even LLM-provided MotionPlans still go through `ControllerCurveGenerator`, `ActionValidator`, `ActionAutoFixer`, and app rig validation.
