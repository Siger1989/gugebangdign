# CURRENT_STATE

## IK/FK Hybrid Wrist Rotation Interference - 2026-05-12

Current objective:
- Fix the bent-arm `R VIEW` wrist rotation issue where IK/FK hybrid mode can make the hand/palm flip or "fly" after pressing `R`.

Current progress:
- Started after user observed that rotation feels normal when the arm is straight, but fails after the arm is bent.
- Diagnosis:
  - This is likely not just mouse angle mapping.
  - In hybrid mode the same terminal joint can be represented by both an end-effector IK control, such as `R_Hand_IK`, and an FK/debug joint control, such as `R_Hand_CTRL`.
  - Existing rotate filtering removes nested parent/child FK conflicts, but does not remove controls that target the exact same joint.
  - If both controls are selected or picked into the same modal rotation, the wrist can receive the same view-axis rotation twice.
- Implemented a global rotate-writer filter:
  - For each arm/leg limb, one `R` operation now chooses either the active IK end-effector writer or the active FK writer.
  - Same-joint duplicates such as `R_Hand_IK` + `R_Hand_CTRL` are collapsed before rotation.
  - The same filter is applied to modal `R` transforms and direct `set_control_transforms` batch commands.
  - If the active control is IK, FK debug controls on the same limb are ignored for that rotation; if the active control is FK, IK on that limb is ignored.
- Added regression coverage:
  - Imported GLB right arm is first bent with `R_Hand_IK`.
  - A direct batch rotate containing both `R_Hand_CTRL` and `R_Hand_IK` must apply only one writer.
  - A modal `R VIEW` rotation with both selected must commit only `R_Hand_IK` when it is the active control.
  - The hand IK target and wrist joint position must stay attached, and the source hand rotation delta must align with the camera view axis.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `scripts/validate_demo_import.mjs`

Validation result: PASS.

Commands run:
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation details:
- Full validation log: `artifacts/logs/validate_hybrid_wrist_rotation_20260512.log`
- NPM check log: `artifacts/logs/npm_check_hybrid_wrist_rotation_20260512.log`
- Acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260512_035354Z.png`

Current blocking issue:
- None.

Git publish:
- Publish repo: `E:\codex骨骼软件_github_publish`
- Branch: `main`
- Commit: `4282b17 Fix hybrid IK FK wrist rotation`
- Remote push: PASS.

## Walk Identity Validation False Positive Fix - 2026-05-12

Current objective:
- Explain and fix why `Walk_8F` can look visually normal but validation still reports `有问题 / 骨骼身份错误 / 左右身份不匹配`.

Current progress:
- Diagnosis:
  - The visible walk was not failing foot sliding, knee flip, or loop continuity.
  - The failing item was `bone_identity_error`.
  - The old identity check assumed `R_` joints must always project to positive rig-right and `L_` joints to negative rig-right.
  - Imported rigs or confirmed facing direction can flip that side-axis sign even while the skeleton is internally correct.
- Fixed `buildValidationReport()`:
  - It now checks whether all `R_` joints are consistently on one side and all `L_` joints are consistently on the opposite side.
  - It no longer hard-codes which sign is right or left.
  - It still fails if R/L joints are mixed onto the same side or one side cannot be determined.
- Added regression coverage:
  - Walk validation must pass without `bone_identity_error`.
  - Imported GLB walk validation accepts either left/right side sign convention.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `scripts/validate_demo_import.mjs`

Validation result: PASS.

Commands run:
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation details:
- Full validation log: `artifacts/logs/validate_walk_identity_validation_20260512.log`
- NPM check log: `artifacts/logs/npm_check_walk_identity_validation_20260512.log`
- Acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260512_031446Z.png`

Current blocking issue:
- Need sync to publish repo and push.

## Motion Brain Load Button Disabled State Fix - 2026-05-12

Current objective:
- Fix the UI issue where `加载文字生成动作` could stay disabled after generating a text motion, leaving the user unable to load the generated result.

Current progress:
- Reproduced the button state path and checked the real disable reasons:
  - A failed/uncertain Motion Brain result should stay blocked.
  - A passed preview result should be loadable.
  - A result should only be treated as "already loaded" if the current timeline actually contains Motion Brain keyframes.
- Updated `updateMotionBrainLoadButton()`:
  - Uses `hasLoadedMotionBrainTimeline` instead of only trusting `result.loaded_to_timeline`.
  - Keeps the button enabled for a passed preview even if a previous Motion Brain timeline existed.
  - Changes button text by state:
    - `加载文字生成动作`
    - `自检未通过，不能加载`
    - `已加载到时间轴`
- Added `Load: ready / blocked / loaded` to the Motion Brain debug preview.
- Added regression coverage for the exact default input:
  - `生成一个自然站立呼吸`
  - Must parse as `idle/breath`.
  - Must pass quality gate.
  - Must leave `ready_to_load=true`.
  - Must enable the load button and show `Load: ready`.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `scripts/validate_demo_import.mjs`

Validation result: PASS.

Commands run:
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation details:
- Full validation log: `artifacts/logs/validate_motion_brain_load_button_20260512.log`
- NPM check log: `artifacts/logs/npm_check_motion_brain_load_button_20260512.log`
- Acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260512_030120Z.png`

Current blocking issue:
- Need sync to publish repo and push.

## R View Hand Palm Flip Fix - 2026-05-12

Current objective:
- Fix the persistent `R VIEW` hand rotation bug:
  - If the palm is facing the camera, pressing `R` and dragging should rotate around the camera/view axis.
  - The wrist/hand target should stay in place.
  - The palm should keep facing the camera instead of pitching upward or flipping from rest pose.

Current progress:
- Diagnosed the root cause:
  - `R VIEW` produced a world-space camera-axis rotation.
  - For terminal end-effectors such as `R_Hand`, `driveMappedSourceRigFromJoints()` then applied that explicit rotation on top of the source bone rest quaternion.
  - That meant a tiny view-axis drag could recompute the hand from rest pose instead of the currently solved pose, making the palm tilt/flip.
- Fixed terminal explicit rotations globally:
  - Explicit rotations that were not already applied through a parent/child bone connection now use the current solved source-bone world quaternion as their base.
  - This keeps hand/foot terminal rotations relative to the live solved pose.
- Added a regression test:
  - Select `R_Hand_IK`.
  - Press `R`.
  - First pointer move must not snap.
  - Committed rotation delta axis must align with the camera view axis.
  - `R_Hand_IK` position and `R_Hand` joint position must stay stable.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `scripts/validate_demo_import.mjs`

Validation result: PASS.

Commands run:
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation details:
- Full validation log: `artifacts/logs/validate_r_view_hand_20260512_b.log`
- NPM check log: `artifacts/logs/npm_check_r_view_hand_20260512_b.log`
- Acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260512_023659Z.png`

Current blocking issue:
- Need sync to publish repo and push.

## Text Motion Load Button And Validation Fix - 2026-05-12

Current objective:
- Fix the Motion Brain UI flow so text-generated motion is not confused with template loading:
  - Generate/self-check text motion first.
  - Only load it to the timeline after it passes the quality gate.
- Fix validation false positives where dynamic attack poses, such as `Punch_R_12F`, were reported as left/right bone identity mismatch.

Current progress:
- Added a separate `load_motion_brain_result` command and `加载文字生成动作` button.
- Changed the visible Motion Brain button to run `preview_motion_from_text`, which compiles and self-checks the text motion but restores the existing timeline until the user explicitly loads it.
- The load button is enabled only for a passed, not-yet-loaded Motion Brain result.
- Direct API command `generate_motion_from_text` still works and marks the result as loaded for compatibility.
- `buildValidationReport()` now checks left/right bone identity from the saved/rest skeleton instead of the current posed frame, so a right punch crossing the center line no longer looks like a rig identity error.
- Added regression coverage for:
  - Motion Brain UI preview + load flow.
  - Punch template validation using rest skeleton identity.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`

Validation result: PASS.

Commands run:
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation details:
- Full validation log: `artifacts/logs/validate_text_motion_load_20260512.log`
- NPM check log: `artifacts/logs/npm_check_text_motion_load_20260512.log`
- Acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260512_015733Z.png`

Current blocking issue:
- Browser plugin connection timed out during manual in-app check, but the local Playwright validation covered the UI flow.
- GitHub push succeeded after syncing to the publishing repo.

Git publish:
- Publish repo: `E:\codex骨骼软件_github_publish`
- Branch: `main`
- Commit: latest `Add motion brain pipeline and rig workflow fixes` on `main`
- Remote push: PASS

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Use Motion Brain panel:
  1. Enter text.
  2. Click `生成 / 自检文字动作`.
  3. If the report passes, click `加载文字生成动作`.

## Template Idle And Rest Pose Persistence - 2026-05-11

Current objective:
- Fix two related workflow issues:
  - Legacy action template `Idle_Breathe` raises both arms and bypasses Motion Brain self-critique.
  - A user-saved initial skeleton/rest pose can be overwritten when generating IK/FK or loading actions.

Current progress:
- User clarified the screenshot is from the action template dropdown, with `Motion Brain: 尚未生成`.
- Diagnosis:
  - Prior Motion Brain self-critic fix does not cover the legacy `apply_motion_template` path.
  - Legacy templates need either the same relaxed-arm post process or a quality gate before writing keyframes.
  - `create_ik_controls` currently calls `saveCurrentSkeletonAsInitial()` unconditionally, which can overwrite the previously saved custom initial skeleton with the current animated/edited pose.

Files changed:
- `CURRENT_STATE.md`

Validation result: Not run yet.

Current blocking issue:
- Need patch template generation and IK creation state flow.

Next step:
- Preserve saved rest pose unless the user explicitly clicks save, and make Idle/locomotion templates generate relaxed arms from the saved rest pose.

## Initial Skeleton Persistence Regression - 2026-05-11

Current objective:
- Fix the workflow where users bind/assign bones, adjust the skeleton, save the initial skeleton, then generate IK/FK and load actions, but the adjusted saved skeleton appears to be lost.

Current progress:
- Started after user clarified the intended flow:
  - Bone recognition / assignment first.
  - Manual skeleton adjustment before IK generation.
  - Save adjusted skeleton as initial/rest pose.
  - Generate IK/FK controls.
  - Load/generate actions from that saved rest pose.
- Suspected issue:
  - A later command is likely re-saving or rebuilding the skeleton and overwriting `skeleton.rest_joints`.

Files changed:
- `CURRENT_STATE.md`

Validation result: Not run yet.

Current blocking issue:
- Need inspect `saveCurrentSkeletonAsInitial`, `create_ik_controls`, action/template loading, and skeleton rebuild paths.

Next step:
- Patch the state flow so saved custom rest joints are preserved unless the user explicitly saves again or rebinds mapping.

## Idle Breath Self-Critic Regression - 2026-05-11

Current objective:
- Fix the Motion Brain regression where `生成一个自然站立呼吸` produces raised arms while UI validation still reports passed.

Current progress:
- User showed in-app screenshots where generated idle/breath lifts both arms overhead.
- Diagnosis so far:
  - This is not acceptable for idle/breath.
  - MotionCritic should produce a blocker for ordinary idle with high arms / HandIK usage / T/A pose residue.
  - AutoFix should force relaxed FK arms and revalidate, not leave the clip accepted.
- Browser plugin connection timed out twice; continuing through the existing local validation/debug scripts.
- Reproduced the imported-GLB failure path with Playwright:
  - Before the fix, MotionCritic could detect `ARM_TOO_HIGH` and `TPOSE_RESIDUE`, but the command still left the failed/generated clip on the live timeline.
  - The first relaxed-arm AutoFix still depended too much on imported bone local axes, so it could leave arms high on some GLB rigs.
- Implemented global fixes:
  - `ActionAutoFixer` now marks ordinary idle/walk/run arm fixes with `relaxed_arm_pose`.
  - `app.js` applies `relaxed_arm_pose` through a shared world/basis arm guide, not through model-specific local bone axes.
  - Motion Brain blocker results are rejected from the timeline globally; the last report remains visible, but failed generated keyframes do not overwrite the current accepted motion.
  - Idle visible-motion thresholds are lower than action/locomotion thresholds, so subtle breathing can pass without allowing a static pose.
  - Walk arm-swing fulfillment now only blocks if there is effectively no swing; small amplitude remains a critic warning.
- Added regression coverage:
  - Imported GLB `生成一个自然站立呼吸` must pass with hands below chest, HandIK disabled, no ARM/TPOSE critic issue, and relaxed FK arm fix applied.
  - A blocker result such as generic fallback must not overwrite the current accepted timeline.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `scripts/validate_demo_import.mjs`
- `motion_brain/action_auto_fixer.js`
- `motion_brain/action_validator.js`
- `motion_brain/intent_fulfillment_validator.js`

Validation result: PASS.

Current blocking issue:
- None.

Next step:
- Manual browser check: reload `http://localhost:8780/index.html`, import or use the sample character, generate `生成一个自然站立呼吸`, and confirm the preview/debug panel shows Motion Brain passed with relaxed arms.

Validation details:
- Failed reproduction log before threshold fix: `artifacts/logs/validate_motion_brain_idle_gate_20260511_160140.log`
- Full validation log: `artifacts/logs/validate_motion_brain_idle_gate_20260511_160458.log`
- NPM check log: `artifacts/logs/npm_check_motion_brain_idle_gate_20260511_160616.log`
- Regression screenshots:
  - `artifacts/screenshots/idle_breath_glb_after_visible_threshold.png`
  - `artifacts/screenshots/pipeline_acceptance_20260511_080500Z.png`

## Motion Brain ActionIR Compiler - 2026-05-11

Current objective:
- Convert the existing Motion Brain from a template-like natural-language generator into an extensible ActionIR-driven compiler pipeline with parser confidence, primitive composition, intent fulfillment validation, critic/autofix loop, and explainable debug output.

Current progress:
- Started after user clarified this must not keep growing as one-off action templates.
- Scanned existing project and confirmed reusable systems already exist:
  - IK/FK/Pole/Root/COG/Pelvis/Chest/Head controls in `app.js`.
  - Timeline/keyframes/playback/export in `app.js`.
  - Existing `motion_brain/` modules for intent parser, grammar, primitive library, prototype library, planner, controller curve generator, pose sampler, pose feature extractor, MotionCritic, quality gate, validator, and auto fixer.
- Identified missing architecture pieces:
  - ActionIR / ActionSemanticFrame.
  - ActionIRBuilder.
  - PrimitiveComposer.
  - IntentFulfillmentValidator.
  - Strong parser confidence / generic fallback gating.
  - More explicit coordinate-space documentation and debug fields.
- Implemented the missing compiler layers:
  - `ActionIntentParser` now emits parser confidence, parsed verbs/body parts/direction/target, missing slots, and uncertainty flags.
  - `ActionIRBuilder` compiles parser output into ActionIR.
  - `PrimitiveComposer` parameterizes primitives by effector/target/direction/timing instead of using one-off action templates.
  - `IntentFulfillmentValidator` checks solved-pose features against ActionIR.
  - `MotionBrainPipeline.generate_from_text()` now returns ActionIR, primitive sequence, validation, critic, autofix, and debug trace data.
- Added parser and grammar support for:
  - forward right/left hand strike.
  - lie down / standing to ground.
  - push door/object interactions.
  - panic backward wall impact reaction.
  - walk/run/jump/idle/gesture/pickup/generic fallback.
- Added blocker behavior for low-confidence generic fallback: it can produce a visible draft action, but cannot be accepted as fully passed.
- Updated UI debug preview to show parser result, ActionIR, phases, primitives, controller tracks, critic issues, intent-fulfillment result, validator result, autofix actions, and final state.
- Updated docs for ActionIR pipeline, coordinate-space conventions, validation gates, LLM guardrails, and PhysicsAssistLayer placeholders.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `scripts/validate_demo_import.mjs`
- `motion_brain/action_intent.js`
- `motion_brain/action_intent_parser.js`
- `motion_brain/action_grammar.js`
- `motion_brain/action_primitive_library.js`
- `motion_brain/action_ir.js`
- `motion_brain/action_ir_builder.js`
- `motion_brain/primitive_composer.js`
- `motion_brain/motion_planner.js`
- `motion_brain/motion_brain_pipeline.js`
- `motion_brain/action_validator.js`
- `motion_brain/action_auto_fixer.js`
- `motion_brain/pose_feature_extractor.js`
- `motion_brain/motion_critic.js`
- `motion_brain/intent_fulfillment_validator.js`
- `motion_brain/llm_adapter.js`
- `docs/MOTION_BRAIN.md`
- `docs/ACTION_VALIDATION.md`

Commands run:
- `Get-ChildItem -LiteralPath . -Force | Select-Object Name,Mode,Length`
- `Get-ChildItem -LiteralPath motion_brain -Force | Select-Object Name,Length`
- `rg -n "MotionBrain|generate_from_text|generate_motion_from_text|ActionIR|MotionCritic|PoseSampler|PoseFeatureExtractor|IntentFulfillment|PrimitiveComposer|ActionValidator|ActionAutoFixer|motion_brain" app.js motion_brain scripts\validate_demo_import.mjs docs index.html`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 120`
- `node --check motion_brain\intent_fulfillment_validator.js`: PASS
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `Get-ChildItem -LiteralPath .\motion_brain -Filter *.js | ForEach-Object { node --check $_.FullName }`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation result: PASS.

Current blocking issue:
- None.

Next step:
- Manual browser check: generate these prompts from the Motion Brain panel and inspect the debug preview:
  - `向前挥出右拳`
  - `躺下`
  - `疲惫地推开门`
  - `惊慌后退并撞到墙`
  - `普通走路`
  - `举手挥手`
  - `随便动一下`

Validation details:
- Full validation log: `artifacts/logs/validate_motion_brain_actionir_20260511_150802.log`
- NPM check log: `artifacts/logs/npm_check_motion_brain_actionir_20260511_150939.log`
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_070803Z.png`

## Pre-IK Skeleton Edit Stage - 2026-05-11

Current objective:
- Add a pre-IK skeleton edit/save step so users can adjust the generated/imported humanoid skeleton before creating IK/FK controls, and make the Generate IK/FK page reachable again from motion editing.

Current progress:
- Started after user reported that the motion editing stage cannot click back to the Generate IK page and that skeleton adjustment must happen before IK binding.
- Added `save_initial_skeleton` and changed skeleton creation to stay in the skeleton stage.
- Changed the top toolbar Generate IK/FK action to navigate to the IK/FK page instead of immediately regenerating controls.
- Added pre-IK skeleton edit controls: the skeleton stage now creates 19 temporary joint edit controls that use the same G/R/S transform workflow before final IK/FK generation.
- Verified with targeted Playwright that pre-IK G/R/S edits move/rotate/scale a skeleton joint, save into `rest_joints`, and final IK generation replaces edit controls with full IK/FK controls.
- Fixed skeleton-recognition viewport picking so pre-IK editing only selects real temporary controllers or transform gizmos; clicking blank viewport space clears selection instead of jumping to a nearby bone.
- In skeleton-recognition stage, all 19 temporary joint controllers render and pick like action controllers, including hand/foot endpoints.
- Added map axis view switching: clicking X/Y/Z while in Select mode switches the viewport to that map-axis view; keyboard X/Y/Z does the same outside an active transform. During G/R/S transforms, X/Y/Z still constrain axes.
- Stabilized walk elbow Pole controls after torso sync so imported GLB walk templates keep both elbow poles outside the body.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `index.html`
- `scripts/validate_demo_import.mjs`

Commands run:
- `rg -n "stage|current_stage|create_ik_controls|create_humanoid_skeleton|control_rig|motion|mapping|skeleton|work-action|data-action|setStage|Runtime\\.stage|handleWorkbenchAction|createSkeleton|createIk|disabled|is-active" app.js index.html styles.css scripts\\validate_demo_import.mjs`
- `Get-Content -Path index.html -TotalCount 180`
- `Get-Content -Path CURRENT_STATE.md -TotalCount 120`
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- Targeted Playwright pre-IK skeleton controls check: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation result: PASS.

Current blocking issue:
- None.

Next step:
- Manual browser check: hard refresh, enter skeleton recognition, select a hand/foot/head temporary controller, use G/R/S, click blank space to confirm selection clears, then save initial skeleton before generating IK/FK.

Validation details:
- Full validation log: `artifacts/logs/validate_skeleton_pick_axis_20260511_141622.log`
- NPM check log: `artifacts/logs/npm_check_skeleton_pick_axis_20260511_141734.log`

## View Axis Rotate Drag Bug - 2026-05-11

Current objective:
- Fix R/view-axis rotation so pressing R uses the current pose as the start and mouse drag applies a relative rotation around the current view axis, instead of snapping the joint/control toward the initial mouse position.

Current progress:
- Started after the user reproduced the rotate snap bug with screenshots.
- Paused Motion Critic validation work to prioritize the latest interaction bug.

Files changed:
- `CURRENT_STATE.md`

Commands run:
- `Get-Content -Path CURRENT_STATE.md -TotalCount 80`
- `rg -n "transformMode|transform_mode|startTransform|beginTransform|rotate|rotation|R VIEW|VIEW|transformAxis|selectTransformGizmoAxis|gizmo|mouse|pointer|drag" app.js styles.css scripts/validate_demo_import.mjs`
- `rg -n "function setRigControlRotation|rotateJointBranchByQuaternion|applyControlToJoint|set_control_transform|set_control_transforms|selected_control|Runtime\\.transform" app.js`

Validation result: Not run yet.

Current blocking issue:
- Need inspect the rotate accumulator and pointer drag code to remove the first-move snap.

Next step:
- Patch transform rotate startup/drag math and add regression coverage for R view-axis no-snap behavior.

## Motion Critic Quality Gate - 2026-05-11

Current objective:
- Add an independent final-pose self-check loop after Motion Brain generation, so generated actions are solved, sampled, feature-extracted, criticized, auto-fixed, and revalidated before being accepted.

Current progress:
- Started implementation after user clarified the problem is missing global MotionCritic / Pose Quality Gate, not a single Walk_Basic parameter.
- Reconfirmed current MotionBrain only has an abstract plan/controller validator and app-side rig validation; it does not yet critique final solved poses for human-like quality.
- Identified app integration points:
  - `generate_motion_from_text`
  - `applyMotionBrainResultToRig`
  - `createMotionBrainKeyframes`
  - `applyPoseAtFrame`
  - `interpolatePose`
  - existing `buildValidationReport`

Files changed:
- `CURRENT_STATE.md`

Commands run:
- `Get-Content -Path CURRENT_STATE.md -TotalCount 120`
- `Get-ChildItem -Path motion_brain -Filter *.js | Sort-Object Name | Select-Object Name`
- `rg -n "generate_motion_from_text|applyMotionBrainResultToRig|createMotionBrainKeyframes|interpolatePose|applyPoseAtFrame|createMotionTemplateKeyframes|ActionAutoFixer|validator|final_passed|motion_brain|ik_fk_blend|Hand_IK|_Hand_CTRL" app.js motion_brain scripts/validate_demo_import.mjs`

Validation result: Not run yet.

Current blocking issue:
- None.

Next step:
- Implement PoseSampler, PoseFeatureExtractor, MotionCritic, MotionQualityGate, critic-driven AutoFix iterations, and self-check for existing templates.

## Transform Value Box Placement - 2026-05-11

Current objective:
- Move the G/R/S numeric value popup farther from the selected controller, make it draggable, and remember the last adjusted popup offset for future appearances.

Current progress:
- Increased default numeric popup offset from the controller anchor to `82px / 34px`.
- Added drag handling on `.transform-value-box`; input and close button remain interactive.
- Persisted the adjusted offset in `localStorage` under `action_rig_transform_value_box_offset_v1`.
- Added debug state fields for the popup offset and drag state.
- Added Playwright coverage for default distance and drag-persisted offset.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`

Commands run:
- `node --check app.js`: PASS
- `node --check scripts/validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Final response to user with the popup placement behavior and validation result.

Validation details:
- Full validation log: `artifacts/logs/validate_transform_value_box_20260511_123357.log`
- NPM check log: `artifacts/logs/npm_check_transform_value_box_20260511_123459.log`
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_043402Z.png`

## Motion Brain Pipeline - 2026-05-11

Current objective:
- Build a global Motion Brain system that compiles natural-language action text into ActionIntent, MotionPlan, ActionPrimitives, controller keyframes, validator results, and automatic fixes.

Current progress:
- Scanned the existing app and confirmed reusable systems:
  - `CORE_IK_CONTROL_DEFS` has Global / Root / COG / Pelvis / Chest / Head / HandIK / FootIK / Pole controls.
  - `JOINT_CONTROL_DEFS` provides FK joint controls in hybrid mode.
  - `MotionState.keyframes`, timeline commands, playback, loop range, motion templates, import/export, and `buildValidationReport()` already exist.
- Started a new `motion_brain/` module set instead of rewriting the app.
- Added ActionIntent data structure, keyword ActionIntentParser, ActionGrammar, ActionPrimitiveLibrary, and ActionPrototypeLibrary.
- Added MotionPlanner, ControllerCurveGenerator, ActionValidator, ActionAutoFixer, LLM schema adapter, and the unified MotionBrainPipeline entry.
- Smoke-tested `MotionBrain.generate_from_text()` with the requested Chinese sample actions using Unicode escapes; all currently return controller keyframes and pass the abstract Motion Brain validator.
- Integrated MotionBrain into `app.js` through `generate_motion_from_text`, UI controls, debug API, JSON export/import state, and existing timeline keyframes.
- Added docs for the pipeline, grammar, validation, auto fixing, and LLM guardrails.
- Added Playwright validation coverage for 7 required prompts plus the fallback "翻滚闪避" primitive-composition path.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `motion_brain/action_intent.js`
- `motion_brain/action_intent_parser.js`
- `motion_brain/action_grammar.js`
- `motion_brain/action_primitive_library.js`
- `motion_brain/action_prototype_library.js`
- `motion_brain/motion_planner.js`
- `motion_brain/controller_curve_generator.js`
- `motion_brain/action_validator.js`
- `motion_brain/action_auto_fixer.js`
- `motion_brain/llm_adapter.js`
- `motion_brain/motion_brain_pipeline.js`
- `docs/MOTION_BRAIN.md`
- `docs/ACTION_GRAMMAR.md`
- `docs/ACTION_VALIDATION.md`

Commands run:
- `Get-Content -Path CURRENT_STATE.md -TotalCount 120`
- `rg -n "const MotionState|MOTION_TEMPLATE_DEFS|createMotionTemplateKeyframes|buildValidationReport|installDebugApi|executeCommand|apply_motion_template|motionTemplateSelect|function renderUi|export_project_json|import_project_json|isUndoableCommand|COMMAND_SCHEMAS|translateCommandName|snapshotCoreState|restoreCoreState|setRigControlPosition|setRigControlRotation" app.js index.html package.json scripts/validate_demo_import.mjs`
- `node --check motion_brain/*.js`: PASS
- `node --input-type=module` smoke test for 8 MotionBrain sample prompts: PASS abstract validator
- `node --check app.js`: PASS
- `node --check scripts/validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Final response with changed files, pipeline flow, supported action types, invocation, validator/autofixer behavior, and LLM integration path.

Validation details:
- Full validation log: `artifacts/logs/validate_motion_brain_20260511_122743.log`
- NPM check log: `artifacts/logs/npm_check_motion_brain_20260511_122845.log`
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_042746Z.png`

## ZBrush Style Transform Gizmo - 2026-05-11

Current objective:
- Replace the cluttered same-looking G/R/S controller display with a usable ZBrush-inspired universal transform gizmo.

Current progress:
- Started investigation after user feedback that controllers pile together and G/R/S feel indistinguishable.
- Researched Maxon ZBrush references:
  - Gizmo 3D is a compact universal manipulator for move, scale, and rotate.
  - Move uses red/green/blue axis arrows plus screen-plane movement.
  - Scale uses red/green/blue axis rectangles and a center yellow square for uniform scale.
  - Rotate uses red/green/blue axis circles plus a grey screen-plane circle.
  - TransPose uses an action line for move/scale/rotate and is separate from Gizmo 3D.
- Reworked `renderZBrushTransformGizmo()` into mode-specific rendering:
  - Select: only a light pivot marker.
  - Move/G: screen-plane handle plus X/Y/Z arrows.
  - Rotate/R: X/Y/Z rings plus a view-plane ring.
  - Scale/S: uniform center box plus X/Y/Z scale boxes.
- Increased gizmo screen size so it reads as a transform manipulator instead of another tiny skeleton control.
- Made `COG_CTRL` scalable so the common center control can actually show/use S mode.
- Scale now respects axis selection: free scale is uniform, while X/Y/Z scale handles adjust only that component and deform the skeleton branch through a directional scale basis.
- Reduced FK control pile-up by only showing main FK joints by default; overlapping hand/foot/toe FK controls remain available through selection and appear when selected.
- Added `getTransformGizmoDebug()` and validation coverage to assert G/R/S do not all expose the same handle set.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `scripts/validate_demo_import.mjs`

Commands run:
- Web search/open of Maxon ZBrush Gizmo 3D and TransPose documentation.
- `Get-Content -LiteralPath CURRENT_STATE.md -Encoding UTF8 -TotalCount 80`
- `rg -n "transformGizmo|gizmo|TransformGizmo|renderTransform|createTransform|Runtime\\.transform|transformAxis|selectTransformGizmoAxis|makeLabel|addControlArrow|arrow|RingGeometry|ConeGeometry|BoxGeometry|axis" app.js styles.css index.html`
- `rg -n "function renderAll|function renderScene|function render.*Gizmo|function build.*Gizmo|transform_gizmo|gizmoGroup|transform" app.js`
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Final response to user with the concrete control/gizmo fixes and validation details.

Validation details:
- Full validation log: `artifacts/logs/validate_zbrush_gizmo_20260511_115337.log`
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_035339Z.png`

## FK IK Hybrid Controls - 2026-05-11

Current objective:
- Make the advertised IK/FK hybrid controller feel real: FK controls should be visible in hybrid mode and rotating them should rotate skeleton branches.

Current progress:
- Started investigation. Existing hybrid mode exposes IK controls, but FK joint controls are hidden behind a debug toggle and several rotate paths explicitly skip joint controls.
- Patched hybrid mode so FK bone controls are shown by default.
- Renamed the visible Joint Debug control surface to FK bone controls in the UI.
- Allowed FK joint controls through command, keyboard, and numeric rotate paths.
- FK joint rotation now applies the rotation delta to the target joint branch; terminal FK joints also store explicit orientation.
- Added validation coverage for visible FK controls, upper-arm FK branch rotation, bone-length preservation, IK endpoint resync, and terminal wrist FK rotation.
- Updated README and handoff wording from IK-only controls to IK/FK controls where relevant.

Files changed:
- `CURRENT_STATE.md`
- `app.js`
- `index.html`
- `scripts/validate_demo_import.mjs`
- `README.md`
- `HANDOFF.md`

Commands run:
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 220`
- `rg -n "CONTROL_SOLVE_MODES|JOINT_CONTROL_DEFS|showJointDebugControls|joint_debug_controls|is_joint_control|set_control_transform|set_control_transforms|getSelectedTransformControls|applyControlToJoint|rotateJointBranchByQuaternion|IK/FK|Joint Debug|IK 控制器|控制逻辑" app.js index.html scripts/validate_demo_import.mjs styles.css`
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Final response to user with FK/IK behavior summary and validation details.

Validation details:
- Full validation log: `artifacts/logs/validate_fk_controls_20260511_112121.log`
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_032123Z.png`

## Timeline Labels And Common Motion Templates - 2026-05-11

Current objective:
- Clarify the timeline visible-window controls that were hard to understand.
- Add more common humanoid action templates using common game animation sets as reference.

Current progress:
- Researched common character animation sets online. References point to a basic locomotion set of Idle / Walk / Run, with Jump and posture/action clips such as Crouch and Attack/Punch as common next templates.
- Updated timeline control labels from ambiguous icon-only controls to clearer visible-frame wording:
  - `窗口` -> `可见帧`
  - `固定` -> `视图已固定`
  - `< / - / + / >` -> `左移 / 缩小 / 放大 / 右移`
- Added a motion template selector in the motion panel.
- Added common procedural humanoid templates:
  - `idle_breathe_24f`
  - `walk_cycle_8f`
  - `run_cycle_8f`
  - `jump_in_place_16f`
  - `crouch_16f`
  - `punch_right_12f`
- Reworked template creation through `createMotionTemplateKeyframes(templateId)`.
- Updated timeline key-pose rendering to show the active template's keyframes instead of hard-coding Walk_8F.
- Added validation coverage for the template selector and each new template's keyed frame count/loop range.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `scripts/validate_demo_import.mjs`
- `README.md`
- `HANDOFF.md`
- `CURRENT_STATE.md`

Commands run:
- Online research through web search.
- `npm run check`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run validate:import`: PASS
- Playwright visual screenshot check: PASS

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Final response to user with a concise explanation of the clarified controls, added templates, and verification results.

Validation details:
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_030339Z.png`
- Template UI screenshot: `artifacts/screenshots/templates_ui_20260511_110431.png`

## Timeline Clip Loop Editing - 2026-05-11

Current objective:
- Make the timeline behave more like a video editor: wheel zooms the visible timeline length, selected frame ranges can be dragged as clips with an insertion cursor, loop playback uses a draggable range bar, and playback speed is adjustable from the timeline.

Current progress:
- Added timeline playback speed state and a timeline speed slider.
- Added `loop_range` state and a loop range bar above the frame ruler with draggable start/end/body handles.
- Updated playback so loop mode uses the selected loop range instead of always looping across all frames.
- Expanded the visible timeline zoom limit from 240 to 960 frames.
- Reworked frame selection so Shift-click selects a continuous frame segment and Ctrl-click toggles frames.
- Added selected-range drag support for keyframed timeline segments, including a live insertion cursor and a `move_timeline_range` command.
- Updated Motion JSON export/import to preserve `playback_speed`, `loop_enabled`, and `loop_range`.
- Added automated validation coverage for the speed slider, loop range handle drag, loop toggle, insertion cursor, and clip-like keyframe segment movement.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run validate:import`: PASS
- Playwright visual screenshot check: PASS

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Final response to the user with changed files and verification summary.

Validation details:
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_023817Z.png`
- Timeline layout screenshot: `artifacts/screenshots/timeline_visual_20260511_104320.png`
- Timeline insertion cursor screenshot: `artifacts/screenshots/timeline_drag_cursor_20260511_104400.png`

## Handoff And Git Upload Prep - 2026-05-11

Current objective:
- Write a clean handoff document for the current version.
- Re-run upload-time validation before committing and pushing to git.
- Keep the existing verified feature set intact.

Current progress:
- Replaced the old `HANDOFF.md` content with a clean Chinese handoff document.
- The handoff now covers current project positioning, run/validation commands, stable capabilities, recent major changes, key files, debug APIs, known limits, next-step recommendations, and recovery steps.
- Confirmed the working tree is on `main` with modified source, validation, style, package, handoff, and state files.
- Upload-time validation passed.
- Synced the updated source, validation script, style, package metadata, handoff, and state files into `backups/snapshot_20260511_010246_assignment_final`.

Files changed:
- `HANDOFF.md`
- `CURRENT_STATE.md`
- Existing pending implementation files remain part of this upload:
  - `.gitignore`
  - `app.js`
  - `index.html`
  - `package.json`
  - `scripts/validate_demo_import.mjs`
  - `styles.css`

Commands run:
- `git status --short --branch`
- `git diff --stat`
- `Get-ChildItem -Name README.md,ARCH.md,TASK.md,RULES.md,CURRENT_STATE.md,LOG.md,HANDOFF.md -ErrorAction SilentlyContinue`
- `Get-Content README.md -TotalCount 220`
- `Get-Content CURRENT_STATE.md -Tail 260`
- `Get-Content HANDOFF.md -TotalCount 120`
- `Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`
- `Copy-Item` sync of tracked changed files into `backups/snapshot_20260511_010246_assignment_final`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Playwright result reported no failures and no browser console messages.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_233101Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Stage, commit, and push `main` to `origin`.

## Timeline Pinned Visual Cue - 2026-05-11

Current objective:
- Give users a clear visual cue when the timeline window is pinned.
- Keep the cue isolated to timeline UI/readout state without changing motion data or timeline commands.

Current progress:
- Added a compact `固定` badge beside the timeline visible-window range.
- The badge appears when `Runtime.timelineViewPinned` is true and hides when the timeline window is reset.
- The badge title explains that reset restores automatic current-frame following.
- `getTimelineViewState()` now reports `pinned_badge_visible` and `pinned_badge_text`.
- Validation now confirms:
  - reset keeps the pinned badge hidden.
  - zoom/pan makes the badge visible and reports text `固定`.
  - reset after a pinned jump hides the badge again.

Files changed:
- `index.html`
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 210`
- `rg`/diff inspections for timeline pinned badge code
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- Full Playwright import pipeline passed.
- New pinned visual cue checks passed.
- Existing pinned timeline window/current-frame-jump checks, keyboard-accessible timeline buttons, timeline readout/reset, timeline debug-state wheel checks, transform numeric debug/close, exact G/R/S numeric transform, assignment skeleton, binding preset, timeline navigation, frame/FPS inputs, and export validation checks remained passing.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_231338Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop. A useful next target is adding a small timeline window keyboard shortcut layer for direct zoom/pan commands while avoiding conflicts with existing transform shortcuts.

## Timeline Pinned Window Across Frame Jumps - 2026-05-11

Current objective:
- Preserve a user-adjusted timeline visible window across current-frame jumps when the user has manually panned/zoomed the window.
- Keep the behavior isolated to timeline view state; do not change keyframes, playback, IK, or motion data.

Current progress:
- Added `Runtime.timelineViewPinned`.
- Wheel zoom/pan and timeline zoom/pan buttons now pin the timeline window.
- `ensureTimelineFrameVisible()` now respects the pinned window unless called with `force`.
- `reset_timeline_view` clears the pinned state and force-restores a 24-frame window around the current frame.
- Timeline zoom still keeps the current frame visible when the current frame was visible before zooming, preserving the previous zoom expectation.
- `getTimelineViewState()` reports `pinned`.
- Validation now confirms:
  - reset leaves the window unpinned.
  - button/wheel zoom and pan pin the window.
  - after a pinned window is created, jumping current frame to frame 1 does not change the visible window.
  - reset clears pinning and makes the current frame visible again.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 190`
- `Get-Content -LiteralPath README.md -TotalCount 80`
- `rg`/diff inspections for timeline pin/follow code
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- First full validation showed wheel zoom could push current frame 80 out of view; zoom now clamps to keep the current frame visible when it was visible before zooming.
- Final full Playwright import pipeline passed.
- New pinned timeline window/current-frame-jump checks passed.
- Existing keyboard-accessible timeline buttons, timeline readout/reset, timeline debug-state wheel checks, transform numeric debug/close, exact G/R/S numeric transform, assignment skeleton, binding preset, timeline navigation, frame/FPS inputs, and export validation checks remained passing.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_224440Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop. A useful next target is giving users an explicit visual cue when the timeline window is pinned, so they understand why current-frame jumps no longer auto-follow.

## Timeline Window Buttons And Keyboard Access - 2026-05-11

Current objective:
- Make timeline zoom/pan accessible without requiring mouse wheel gestures.
- Keep the change isolated to the timeline visible window; do not change keyframes or motion data.

Current progress:
- Added compact timeline window controls beside the range readout:
  - pan left
  - zoom out
  - zoom in
  - pan right
- Added `zoom_timeline_view` and `pan_timeline_view` commands.
- Timeline zoom buttons preserve the current frame as the zoom anchor when it is visible.
- Timeline pan buttons move the visible window in frame-sized steps derived from the current window width.
- The existing wheel handler now reuses the same zoom/pan helpers as the buttons.
- `getTimelineViewState()` now reports button availability for pan/zoom controls.
- Validation activates zoom/pan buttons via keyboard focus and Enter/Space, confirming:
  - zoom in reduces visible frame count.
  - pan right moves the visible start frame.
  - zoom out expands the visible frame count.
  - range text remains synchronized with the debug state.

Files changed:
- `index.html`
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 180`
- `Get-Content -LiteralPath README.md -TotalCount 80`
- File/diff inspections for timeline window buttons, commands, and validation
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- Full Playwright import pipeline passed.
- New keyboard-accessible timeline zoom/pan button checks passed.
- Existing timeline readout/reset, timeline debug-state wheel checks, transform numeric debug/close, exact G/R/S numeric transform, assignment skeleton, binding preset, timeline navigation, frame/FPS inputs, and export validation checks remained passing.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_221605Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop. A useful next target is making timeline visible-window changes non-destructive across current-frame jumps by preserving a user-pinned window when appropriate.

## Timeline Range Readout And Reset - 2026-05-11

Current objective:
- Add a user-facing timeline visible-window readout and reset control.
- Let users recover from wheel zoom/pan without relying on more wheel gestures.

Current progress:
- Timeline header now shows the current visible window as `start-end`.
- Added a compact `Reset View` timeline metric button (`timelineResetViewButton`).
- Added `reset_timeline_view`, which restores a 24-frame timeline window while keeping the current frame visible.
- `getTimelineViewState()` now also reports the displayed range text and whether the reset button is available.
- Validation now clicks the reset button after wheel zoom/pan and confirms:
  - the command succeeds.
  - the visible window returns to 24 frames.
  - current frame remains visible.
  - slider min/max match the visible range.
  - displayed range text matches the debug window state.

Files changed:
- `index.html`
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 170`
- `rg`/file inspections for timeline range/readout/reset code
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- Full Playwright import pipeline passed.
- New user-facing timeline window readout/reset checks passed.
- Existing timeline debug-state wheel checks, transform numeric debug/close, exact G/R/S numeric transform, assignment skeleton, binding preset, timeline navigation, frame/FPS inputs, and export validation checks remained passing.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_214601Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop. A useful next target is making timeline zoom/pan keyboard-accessible, so users without mouse wheel can still adjust the timeline window.

## Timeline View Debug State Hook - 2026-05-11

Current objective:
- Add a stable debug/readout API for the timeline visible frame window.
- Validate wheel zoom and Shift+wheel pan behavior without relying only on rendered tick DOM counts.

Current progress:
- Added `getTimelineViewState()` to the in-browser debug API.
- The timeline debug state reports:
  - visible `start`, `end`, and `frames`
  - current frame and whether it is visible
  - total frames
  - slider min/max/value
  - rendered tick count and first/last/current tick
  - selected frames and keyframes currently in view
  - zoom-in/zoom-out availability
- Validation now simulates timeline wheel zoom and Shift+wheel pan, then confirms:
  - current frame remains visible
  - zoom reduces visible frame count
  - pan moves the visible start frame
  - slider min/max match the debug view window
- Validation restores the timeline window after the wheel test so later keyframe DOM checks remain independent.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 160`
- `rg`/file inspections for timeline view code and validation coverage
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- First full validation exposed that the new wheel test left the timeline at a 19-frame window, so a later DOM check only saw 7 visible key poses. The validation now restores the window before continuing.
- Final full Playwright import pipeline passed.
- New timeline view debug-state and wheel zoom/pan checks passed.
- Existing transform numeric debug/close, exact G/R/S numeric transform, assignment skeleton, binding preset, timeline navigation, frame/FPS inputs, and export validation checks remained passing.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_211404Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop. A useful next target is adding a small user-facing timeline range readout or reset-window control so users can recover from zoom/pan without relying on wheel gestures.

## Transform Numeric Debug State Hook - 2026-05-11

Current objective:
- Add a stable debug/readout API for the floating transform numeric box.
- Reduce future validation dependence on DOM class names while keeping the user-facing transform workflow unchanged.

Current progress:
- Added `getTransformValueBoxState()` to the in-browser debug API.
- The debug state reports:
  - `visible`
  - `mode`
  - `label`
  - `input_value`
  - `numeric_value`
  - `control_ids`
  - active transform mode/axis
  - focus and screen position
- Validation now confirms the floating value box reports a visible `G X` value of `0.025` after precise translate input.
- Validation also confirms the debug state reports hidden after using the close button.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 140`
- `Get-Content -LiteralPath README.md -TotalCount 70`
- File inspections around transform numeric box/debug API/validation code
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- Full Playwright import pipeline passed.
- New transform numeric debug-state checks passed.
- Existing close-button, exact G/R/S numeric transform, assignment skeleton, binding preset, timeline navigation, frame/FPS inputs, and export validation checks remained passing.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_204323Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop. A useful next target is improving timeline viewport ergonomics by adding explicit visible-range readout/debug coverage for wheel zoom/pan behavior.

## Dismissible Transform Numeric Box - 2026-05-11

Current objective:
- Make the persistent floating transform numeric box easy to dismiss after precise edit/copy workflows.
- Prevent clicks on the numeric box from leaking through into viewport selection or gizmo drag handling.

Current progress:
- Added a small close button to the floating transform numeric box.
- Pointer/click events inside the numeric box now stop propagation before reaching the viewport.
- Escape in the numeric input or close button dismisses the box; if a keyboard transform is still active, it cancels that transform cleanly.
- Closing the value box returns focus to the canvas so viewport shortcuts remain available.
- Validation now closes the box after a precise `G X` edit and confirms the selected controller stays unchanged.

Files changed:
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 120`
- `Get-Content -LiteralPath README.md -TotalCount 80`
- `rg`/file inspections for transform numeric box code and validation coverage
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- Full Playwright import pipeline passed.
- New close-button check passed: the numeric box hides without changing the selected controller.
- Existing exact G/R/S numeric transform, assignment skeleton, binding preset, timeline navigation, frame/FPS inputs, and export validation checks remained passing.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_201304Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop. A practical next target is adding a small transform numeric state readout/debug hook so tests and future features can inspect the floating value box without relying only on DOM class checks.

## Exact Rotate And Scale Numeric Transform - 2026-05-11

Current objective:
- Extend the persistent transform numeric box so precision input works for `R` rotate and `S` scale, not only constrained `G` translate.
- Keep this isolated to transform input/command generation without changing IK solve rules or skeleton recognition.

Current progress:
- `R` now stores the active view/world axis in the numeric payload and accepts an exact degree value from the floating input.
- `S` now accepts an exact scale factor from the floating input, clamped to a practical `0.05-20` range.
- Active numeric commits update the live preview and final `set_control_transforms` command for rotate/scale.
- After a completed translate/rotate/scale command, the numeric box persists when it belongs to that transform mode, so the user can still edit/copy the value.
- Finished numeric rotate/scale edits now apply delta/ratio changes from the current transform, matching the existing translate-after-commit behavior.
- Validation now checks:
  - `R` exact value commit changes `COG_CTRL` rotation and keeps the numeric input visible.
  - `S` exact value commit scales `Global_CTRL` by `1.25` and keeps the numeric input visible.
  - The validation test undoes its own rotate/scale edits so later workflow checks remain independent.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 180`
- `Get-Content -LiteralPath README.md -TotalCount 120`
- `rg` inspections for transform numeric/gizmo/validation code
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- First full validation exposed test contamination from the new Global scale check; the test now undoes its own scale/rotate edits.
- Final full Playwright import pipeline passed.
- Existing assignment skeleton, binding preset, timeline navigation, keyframe delete, numeric frame/FPS inputs, and export validation checks remained passing.
- New exact rotate/scale numeric transform checks passed.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_195007Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop with another independent workflow gap. A good next target is making the floating transform value box easier to dismiss/reposition without interfering with viewport selection.

## Editable Timeline Playback FPS - 2026-05-11

Current objective:
- Make the timeline playback FPS a direct editable workflow control instead of a static display value.
- Keep the change independent from IK solving, controller transforms, and binding assignment state.

Current progress:
- Added a numeric FPS input in the timeline metrics area.
- Added `set_playback_fps`, clamped to 1-120 FPS.
- Changing FPS while playback is active restarts playback timing from the current frame so animation does not jump through stale timing state.
- `getMotionStateSummary()` and Motion JSON export now expose the current `playback_fps`.
- Validation now edits FPS to 12 through the UI and confirms exported JSON contains `playback_fps: 12`.

Files changed:
- `index.html`
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -LiteralPath CURRENT_STATE.md -TotalCount 140`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- Full Playwright import pipeline passed.
- Existing assignment skeleton, binding preset, timeline navigation, keyframe delete, numeric frame input, and export validation checks remained passing.
- New editable playback FPS check passed.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_192026Z.png`

Current blocking issue:
- None for this pass.

Next step:
- Continue the self-review loop with another independent professional workflow gap. Likely next target: exact rotate/scale numeric commit behavior, because the current precise numeric workflow is strongest for translation.

## Editable Assignment Skeleton For Unrecognized Rigs - 2026-05-10

Current objective:
- If a model cannot be fully recognized/mapped, generate an editable Humanoid_v1 assignment skeleton before IK generation.
- Allow the user to drag key joints onto the imported model/skeleton and use that adjusted skeleton as the IK generation source.

Current progress:
- `create_humanoid_skeleton` now uses a shared Humanoid binding path that works with full, partial, and missing mappings.
- Missing Humanoid joints on imported GLB models are estimated from the model bounds instead of falling back to the small default test T-pose.
- Partial or unrecognized imported models mark the skeleton as `editable_assignment_skeleton` and automatically enable visible joint debug handles.
- `ensureHumanoidSkeletonForAnimation()` no longer hard-fails only because required mappings are missing; it can create the editable assignment skeleton first.
- For editable assignment skeletons, `set_joint_position` now allows free keypoint placement instead of preserving parent bone length. Normal IK/control transforms still keep their existing constraints.
- Dropping an editable assignment keypoint onto a nearby imported source bone now records the Humanoid-to-source-bone mapping and clears duplicate source assignments.
- Editable assignment keypoint/rotate/scale edits persist back into `skeleton.rest_joints`, so later IK or Walk_8F generation uses the manually fitted rest skeleton.
- Header/debug status now labels this mode as `赋值骨架 v1` with the missing required joint count, instead of looking like a normal completed Humanoid skeleton.
- `.gitignore` now ignores `backups/` and `.tmp/`, keeping validation caches and source snapshots out of git status.
- `export_motion_json` now auto-runs motion validation when keyframes exist and the report is stale/not passed, then stores `export_meta.validation_status` in the JSON.
- Added independent binding preset workflow:
  - `export_binding_preset` writes `humanoid_binding_preset_v1` JSON containing direction, Humanoid mapping, source bone names, fitted joints, bones, and rest skeleton.
  - `import_binding_preset` restores that fitted skeleton and remaps source bones by ID or name when possible.
  - Export panel now has `导出绑定预设` and `导入绑定预设` buttons using the existing JSON textarea.
- Added timeline key navigation:
  - `go_to_previous_keyframe` and `go_to_next_keyframe` commands.
  - Timeline panel now has `上一关键帧` and `下一关键帧` buttons.
- Added `delete_current_keyframe` and a `删除当前帧` timeline button.
- Added timeline keyboard shortcuts:
  - `[` / `PageUp`: previous keyframe.
  - `]` / `PageDown`: next keyframe.
  - `Delete` / `Backspace`: delete current keyframe.
- Timeline transport layout now wraps buttons instead of using the old fixed 8-button grid, preventing horizontal overflow after adding keyframe tools.
- Timeline keyframe tools now disable themselves when the action is unavailable:
  - previous/next keyframe disabled when there are no keyframes.
  - delete current frame disabled when the current frame is not keyed.
  - paste remains disabled until a frame is copied.
- Added direct numeric frame entry beside the timeline slider:
  - typing a frame number runs `set_current_frame`.
  - frames beyond the current range extend the timeline just like other frame navigation.
  - the input blurs after commit so stale values do not re-submit when clicking timeline buttons.
- Added validation that simulates an incomplete Humanoid mapping, generates the assignment skeleton, moves `R_Hand` to an exact manual target, then creates IK controls from it.
- Extended validation to snap `L_Hand` onto a live source bone, confirm the mapping is recorded, and confirm the rest pose is updated.
- Extended validation to confirm the assignment skeleton status is visible in the header/debug summary.
- Extended validation to export immediately after generating Walk_8F and confirm export auto-validation writes a passed report.
- Extended validation to export a fitted assignment skeleton as a binding preset, clear the current skeleton/mapping, import the preset, and confirm mapping/rest pose are restored before creating IK.
- Extended validation to jump from frame 11 to previous Walk keyframe 10, then next keyframe 13.
- Extended validation to delete the current keyframe, confirm keyframe count drops to 7, then regenerate Walk_8F to keep later tests independent.
- Extended validation to trigger previous/next/delete keyframe through keyboard shortcuts and then regenerate Walk_8F.
- Extended validation to check the timeline transport does not overflow horizontally.
- Extended validation to confirm timeline tool disabled states before keyframes exist and after Walk_8F keyframes are generated.
- Extended validation to type frame 37 into the numeric frame input and confirm the timeline jumps exactly to that frame.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `.gitignore`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Full import pipeline passed.
- New incomplete-mapping assignment skeleton checks passed.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_184413Z.png`

Current blocking issue:
- None for the editable assignment skeleton pass.

Next step:
- Back up the current source state, then start a self-review loop focused on independent professional workflow gaps.

Backup:
- Created source snapshot at `backups/snapshot_20260511_005340`.
- Manifest: `backups/snapshot_20260511_005340/BACKUP_MANIFEST.txt`.
- Created final post-assignment snapshot at `backups/snapshot_20260511_010246_assignment_final`.
- Manifest: `backups/snapshot_20260511_010246_assignment_final/BACKUP_MANIFEST.txt`.

## ZBrush Gizmo, Multi-Select, Timeline, And Numeric Transform - 2026-05-10

Current objective:
- Continue the queued controller interaction fixes in order:
  - multi-select / exclude / group transform for controllers.
  - timeline view that can expand past 24 frames and zoom with the wheel.
  - persistent editable numeric value box for precise G-axis transforms.
  - R rotation around the current view axis.
  - replace the previous mode-specific gizmo rings with a ZBrush Gizmo 3D style transform controller.

Current progress:
- Added controller selection sets:
  - normal click selects one control.
  - Shift adds to the current selection.
  - Ctrl/Cmd toggles a control.
  - Alt removes/excludes a control.
- Added `set_control_transforms` for batch controller transforms.
- Dragging or keyboard-transforming a selected group now moves the group together.
- Separated IK target handle position from solved end-effector position, so an unreachable hand/foot target no longer gets snapped back by the IK solve.
- Replaced the previous transform-gizmo rendering path with a ZBrush-like always-visible gizmo:
  - center move handle.
  - X/Y/Z move arrows.
  - X/Y/Z scale cubes.
  - view-plane rotate ring and handle.
- R now defaults to the camera/view axis instead of a world/local axis.
- Added persistent transform numeric input near the viewport control for G-axis precision input and copy/edit workflows.
- Timeline view now tracks a visible frame window, can extend beyond 24 frames, and supports wheel zoom/pan behavior.
- Validation coverage now includes multi-select, remove/exclude, group move, numeric transform commit, timeline expansion to frame 80, and the new batch transform command.

Files changed:
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- Small Playwright reproduction for grouped hand target preservation.
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Full import pipeline validation passed.
- New multi-select/group-transform/timeline/numeric-transform checks passed.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_160213Z.png`
- Temporary D-drive npm/cache folder was removed after validation.

Current blocking issue:
- None for this pass.

Next step:
- Continue manual bug triage from the current browser/EXE view. The next likely areas are fine-tuning the visible ZBrush gizmo proportions and deciding whether numeric edit should also commit exact rotate/scale values, not only translate.

## Mapping Button Colors And Natural Elbow Guide - 2026-05-10

Current objective:
- Make mapping buttons green by default and yellow after binding confirmation.
- Soften the previous elbow-backward fix because it made elbows feel locked in place.

Current progress:
- Added `hasConfirmedHumanoidBinding()` to distinguish mapped-but-unconfirmed state from confirmed Humanoid_v1 binding.
- Mapping chips and source bone rows now use green as the default/mapped state.
- After `绑定骨骼赋值` creates a confirmed Humanoid_v1 skeleton, mapped/fallback chips and assigned source rows gain `is-confirmed` and turn yellow.
- Reworked `getWalkArmGuidePose()` again:
  - hand target follows walk swing dynamically.
  - elbow is computed from two-bone geometry and bend guide instead of being placed at a fixed backward offset.
  - bend guide prevents obvious forward folding but allows natural arm swing.
  - pole position follows the solved elbow/bend direction instead of pinning a static world position.
- Updated validation wording from "must bend backward" to "avoid forward elbow fold".
- Added validation that mapping chips are green before binding and yellow after binding.

Files changed:
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Full import pipeline validation passed.
- New mapping color checks passed.
- Forward-elbow-fold checks passed.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_151653Z.png`
- Temporary D-drive npm/cache folder was removed after validation.

Current blocking issue:
- None for this pass.

Next step:
- Manual side-view check of Walk_8F on imported human models; if the arm still looks too stylized, tune hand swing amplitude and bend guide weights rather than using a fixed elbow offset.

## Walk Elbow Backward Bend Fix - 2026-05-10

Current objective:
- Fix Walk_8F arms bending elbows forward in side view; elbows should bias backward during the walk.
- Clarify that the three IK choices are solve modes, not three separate visible controller rigs.

Current progress:
- Increased elbow pole backward offset in `setWalkElbowPoleControl()`.
- Updated shared `getWalkArmGuidePose()` so elbow joints are biased behind the shoulder relative to character forward.
- Kept hand swing motion, but separated it from elbow bend direction so the elbow does not follow the hand forward too much.
- Moved generated elbow pole positions farther behind the elbow to keep IK bend direction stable.
- Updated solve-mode descriptions:
  - `IK/FK 混合`: default editor mode using same controls for IK ends and FK/torso rotations, with foot target preservation.
  - `脚底锁定 IK`: currently emphasizes foot pinning and shares most solving with hybrid.
  - `简易 IK`: lightweight two-bone IK, no body-move foot reverse constraint.
- Added validation that Walk elbows bend backward for both test dummy and imported sample GLB.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Full pipeline validation passed.
- New backward-elbow validation passed for Walk_8F.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_150653Z.png`
- Temporary D-drive npm/cache folder was removed after validation.

Current blocking issue:
- None for the elbow-forward bend fix.

Next step:
- Manual side-view check in the browser/EXE webview while continuing bug triage.

## Walk Arm IK Mode Fix - 2026-05-10

Current objective:
- Fix Walk_8F arm pose mismatch where simple IK looked correct but hybrid and pinned modes produced wrong arm positions.

Current progress:
- Found that `basic` used `setWalkArmPose()` with a shoulder/elbow/hand guide pose, while `hybrid` and `pinned` used `setWalkHandIkControl()` with a separate fixed hand target.
- Added shared `getWalkArmGuidePose()` logic so all Walk_8F solve modes use the same arm guide pose.
- Updated hybrid/pinned Walk generation to write hand IK controls, elbow pole controls, forearm joints, and hand joints from that shared guide.
- Changed the empty validation report status from `Issues` to `Not run`, so loading or editing before validation no longer shows a false `有问题` state.
- Added Playwright validation coverage comparing `basic`, `hybrid`, and `pinned` Walk arm offsets.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP`, `TMP`, and `npm_config_cache` redirected to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- Syntax checks passed.
- Full import pipeline validation passed.
- Screenshot: `artifacts/screenshots/pipeline_acceptance_20260510_144829Z.png`
- No browser console failures.

Current blocking issue:
- None for this specific Walk arm solve-mode mismatch.

Next step:
- Manual browser check of Walk_8F under `basic`, `hybrid`, and `pinned` if the user wants visual confirmation while continuing bug triage.

## Select Option Contrast Fix - 2026-05-10

Current objective:
- Make native dropdown options readable; unselected options in the control logic dropdown were too pale on the white popup background.

Current progress:
- Added explicit `select option` colors:
  - unselected options: dark text on white background.
  - selected option: white text on blue background.
- Did not build EXE or commit changes.

Files changed:
- `styles.css`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `git diff -- styles.css`

Validation result: PASS

Validation details:
- `npm run check`: PASS.

Current blocking issue:
- None for this CSS change.

Next step:
- Continue manual bug finding.

## Pointer-Only Timeline And Parameter Sliders - 2026-05-10

Current objective:
- Prevent direct-drag sliders such as the timeline frame slider and viewport parameter sliders from staying selected or stealing transform hotkeys.

Current progress:
- Marked pointer-only range inputs with `tabindex="-1"` in `index.html`.
- Added runtime `pointer-only-range` tagging for all direct-drag range inputs.
- Range sliders now blur on focus, pointer down, pointer up, pointer cancel, and change.
- Added CSS to remove focus outlines/box shadows from pointer-only range sliders in viewport controls, timeline controls, model panel fields, and direction controls.
- Updated app cache query to `20260510-pointer-only-ranges`.
- Extended validation so `R` rotation still commits when focus was on:
  - model opacity slider
  - timeline frame slider

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import` with `TEMP/TMP` and `npm_config_cache` pointed to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Latest pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_142942Z.png`

Current blocking issue:
- C drive free space remains `0`; default npm/Playwright temp/cache paths still need a D-drive override until disk space is freed.

Next step:
- Hard refresh the browser/EXE webview if it still shows the old top-level `验证` button or old controller defaults.

## Frame Tools, Focus, And Validation Stage Fix - 2026-05-10

Current objective:
- Fix action editing interruptions where focused viewport sliders swallow `R/G/S` shortcuts and playback/validation jumps out of the motion panel.
- Add current-frame copy/paste and mirror tools.
- Reduce default controller visual weight.

Current progress:
- Removed the top-level `验证` workflow step; validation is now a motion-panel action/report instead of a primary stage.
- Changed `play` to keep `Runtime.stage = "motion"` instead of switching to `validate`.
- Changed `validate_motion` to update the report without switching panels.
- Added timeline buttons:
  - `复制当前帧`
  - `粘贴当前帧`
  - `镜像当前帧`
- Added keyboard shortcuts:
  - `Ctrl+C` / `Cmd+C`: copy current frame.
  - `Ctrl+V` / `Cmd+V`: paste copied frame to current frame.
- Added Command API entries:
  - `copy_current_frame`
  - `paste_copied_frame`
  - `mirror_current_frame`
- Added mirrored-pose generation that swaps R/L joints and IK controls across the character center plane, writes a keyframe at the current frame, and applies the mirrored pose immediately.
- Fixed focused range sliders so viewport parameter sliders blur after pointer use and no longer block global transform hotkeys.
- `R` pressed while the model-opacity slider has focus now starts controller rotation instead of staying locked on the slider.
- Reduced default controller visual size from `0.82` to `0.68`.
- Reduced default controller line thickness from `0.28` to `0.20`.
- Updated validation script coverage for:
  - slider-focus `R` rotation on `Head_CTRL`
  - current-frame copy/paste
  - mirror current frame
  - playback staying in motion stage
  - validation staying in motion stage
  - export through the top `导出` action

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `node scripts\validate_demo_import.mjs` with `TEMP/TMP` pointed to `D:\codex骨骼绑定\.tmp`
- `npm run validate:import` with `TEMP/TMP` and `npm_config_cache` pointed to `D:\codex骨骼绑定\.tmp`

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS with D-drive temp/cache override.
- Latest pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_142345Z.png`

Current blocking issue:
- C drive free space is `0`, so default `npm` cache writes and default Playwright/Edge temp profile creation fail unless `TEMP`, `TMP`, and `npm_config_cache` are redirected to D drive.

Next step:
- Manual browser test the new timeline buttons and controller feel.
- If building EXE next, use D-drive temp/cache environment variables or free C-drive space first.

## Handoff Document Refresh - 2026-05-10

Current objective:
- Produce a clean handoff document for the current IK solve mode, Walk_8F, binding, EXE, and performance state.

Current progress:
- Rewrote `HANDOFF.md` as the current primary handoff document.
- Removed stale early-session handoff details from the main handoff file.
- Document now covers current workflow, EXE path, Command API, IK/control logic modes, Walk_8F state, GPU/WebGL performance notes, validation commands, known limitations, and suggested next steps.

Files changed:
- `HANDOFF.md`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `Get-Content -Raw -Encoding UTF8 README.md`
- `Get-Content -Raw -Encoding UTF8 HANDOFF.md`
- `Get-Content -Raw CURRENT_STATE.md`
- `Get-Content -Raw -Encoding UTF8 package.json`
- `rg` lookups for current UI/control logic symbols
- `npm run check`
- `Get-Content -Encoding UTF8 HANDOFF.md | Select-Object -First 40`

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- `HANDOFF.md` exists and opens as UTF-8 Chinese text.

Current blocking issue:
- None.

Next step:
- Use `HANDOFF.md` as the primary handoff entry before continuing IK/Walk_8F fixes.

## IK Solve Modes And GPU Render Path - 2026-05-10

Current objective:
- Move the new controller options from visual styles to actual control logic choices, keep the lightweight polygon controller look, and reduce viewport lag.

Current progress:
- Replaced the visible IK panel option with `控制逻辑`.
- Added three solve modes:
  - `hybrid`: IK/FK mixed animator mode, default.
  - `pinned`: foot-pinned IK mode.
  - `basic`: lighter two-bone IK mode.
- Added `MotionState.control_rig_options.solve_mode`.
- Added `set_control_solve_mode` command and extended `create_ik_controls` with `solve_mode`.
- Walk_8F now uses IK hand targets in non-basic modes instead of directly forcing forearm/hand joint positions.
- Pelvis/COG body movement only pins feet in `hybrid` and `pinned`; `basic` stays lighter.
- Kept generated controls in the compact lightweight polygon visual style by default.
- Changed WebGL renderer to request `powerPreference: "high-performance"`, disabled renderer antialiasing, capped pixel ratio at `1.35`, and added renderer info to debug state.
- Fixed the biggest viewport lag source: imported GLB scenes are now reused instead of being cloned on every `renderAll()`.
- Changed the render loop to render on demand when idle, while still rendering during playback, drag, and transform.
- Fixed top `导入模型` workflow so Electron/EXE uses `desktopBridge.openGlbFile()` first and browser falls back to the hidden file input.

Files changed:
- `app.js`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `node --check electron-main.cjs`
- `node --check electron-preload.cjs`
- Targeted Playwright validation for solve mode UI and Command API.
- `npm run validate:import`
- `npx electron-builder --win --dir --config.directories.output=release-fixed21 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed21\win-unpacked\动作生成工作台.exe`

Validation result: PASS

Validation details:
- Solve mode screenshot:
  - `artifacts/screenshots/solve_modes_gpu_2026-05-10T13-03-40-346Z.png`
- Pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_130613Z.png`
- Targeted checks:
  - UI has `控制逻辑` select.
  - UI no longer exposes controller visual preset select.
  - `hybrid`, `pinned`, and `basic` all generate 14 main controls.
  - `hybrid` applies Walk_8F and creates 8 keyframes.
  - Debug summary reports `renderer: WebGL GPU` and pixel ratio.
- `npm run validate:import`: PASS.
- Desktop build:
  - `release-fixed21\win-unpacked\动作生成工作台.exe`
  - Launch smoke stayed alive for 6 seconds: PASS.

Current blocking issue:
- None for this change.

Next step:
- Manual test imported GLB in `release-fixed21` and compare the three solve modes on the same T-Pose model.

## Control Visual Presets - 2026-05-10

Current objective:
- Add common IK controller visual styles as optional generation schemes, based on typical custom rig control shapes used in Blender/Rigify and MotionBuilder-style control rigs.

Current progress:
- Added controller visual presets:
  - `compact`: current low-occlusion polygon controls.
  - `rigify`: Blender/Rigify-like IK, pole, foot, torso, and hand custom shapes.
  - `motionbuilder`: larger effector-style global/IK controls with lighter joint debug markers.
- Added `MotionState.control_rig_options.visual_preset`.
- Added `visual_preset` to generated controls so exported/imported motion JSON preserves the selected controller style.
- Added `set_control_visual_preset` command.
- Extended `create_ik_controls` to accept `visual_preset`.
- Added the IK panel dropdown `控制器方案`.
- Updated debug summary to show the active controller preset.

Files changed:
- `app.js`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- Targeted Playwright validation for `compact`, `rigify`, and `motionbuilder` controller presets.
- `npm run validate:import`
- `npx electron-builder --win --dir --config.directories.output=release-fixed20 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed20\win-unpacked\动作生成工作台.exe`

Validation result: PASS

Validation details:
- Targeted screenshot:
  - `artifacts/screenshots/control_presets_2026-05-10T12-04-18-727Z.png`
- Targeted checks:
  - UI dropdown contains `compact`, `rigify`, and `motionbuilder`.
  - Each preset can be set through Command API.
  - `create_ik_controls` generates 14 main controls and 19 joint debug controls for each preset.
  - Every generated control carries the selected `visual_preset`.
- `npm run validate:import`: PASS.
- Pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_120533Z.png`
- Desktop build:
  - `release-fixed20\win-unpacked\动作生成工作台.exe`
  - Launch smoke stayed alive for 6 seconds: PASS.

Current blocking issue:
- None for this change.

Next step:
- Use `release-fixed20\win-unpacked\动作生成工作台.exe` for manual testing.

## Control Multi-Select - 2026-05-10

Current objective:
- Add normal editor-style multi-selection for IK/controllers: plain click selects one, Ctrl+click adds/removes a controller, and empty viewport click clears all selections.

Current progress:
- Added `selected_controls` to `MotionState` while keeping `selected_control` as the active/primary controller for existing G/R/S tools and inspector fields.
- Extended `select_control` with `additive` and `toggle` args.
- Ctrl/Cmd viewport clicking now toggles controller membership without starting a drag.
- Plain viewport clicking still replaces the selection with one active controller.
- Empty viewport clicking still calls `clear_selection` and clears all selected controllers.
- Multi-selected controllers render as selected; the primary controller remains the last clicked control.
- Export/debug state now reports `selected_controls` and `selected_control_count`.

Files changed:
- `app.js`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- Targeted Playwright validation for controller Ctrl multi-select and empty viewport clear.
- `npm run validate:import`
- `npx electron-builder --win --dir --config.directories.output=release-fixed19 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed19\win-unpacked\动作生成工作台.exe`

Validation result: PASS

Validation details:
- Targeted screenshot:
  - `artifacts/screenshots/control_multiselect_2026-05-10T11-06-52-798Z.png`
- Targeted checks:
  - Plain click on `R_Hand_IK` selects only `R_Hand_IK`.
  - Ctrl+click on `L_Hand_IK` adds it and makes it primary.
  - Ctrl+click on an already selected controller removes it.
  - Ctrl+click on the final selected controller clears the controller selection.
  - Empty viewport click logs `clear_selection` and clears all selected controllers.
- `npm run validate:import`: PASS.
- Pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_110802Z.png`
- Desktop build:
  - `release-fixed19\win-unpacked\动作生成工作台.exe`
  - Launch smoke stayed alive for 6 seconds: PASS.

Current blocking issue:
- None for this change.

Next step:
- Use `release-fixed19\win-unpacked\动作生成工作台.exe` for manual testing.

## Viewport Clear Selection - 2026-05-10

Current objective:
- Make viewport selection behave like a normal 3D tool: clicking empty space clears the current selection, and non-edit stages should not select bone points or controls.

Current progress:
- Added the `clear_selection` command.
- Empty left-clicks in the 3D viewport now clear selected bone, source bone, selected control, selected timeline frames, hover state, and pending viewport drag state.
- Humanoid joint and source skeleton picking is now limited to the skeleton/mapping stages.
- IK/control picking is now limited to editable control stages (`motion`, `control_rig`, `ik`).
- The transform gizmo no longer renders in non-edit stages such as `validate`.
- Updated the `app.js` cache query in `index.html`.

Files changed:
- `app.js`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- Targeted Playwright validation for empty viewport click and validate-stage click behavior.
- `npm run validate:import` (first attempt timed out at 120 seconds)
- `npm run validate:import` (second attempt)
- `npx electron-builder --win --dir --config.directories.output=release-fixed18 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed18\win-unpacked\动作生成工作台.exe`

Validation result: PASS

Validation details:
- Targeted screenshot:
  - `artifacts/screenshots/clear_selection_2026-05-10T10-13-49-032Z.png`
- Targeted checks:
  - Selecting `R_Hand_IK`, then clicking empty viewport space clears selected control and selected bone.
  - In `validate` stage, clicking a visible joint debug point/control area clears instead of selecting.
  - In `motion` stage, joint control command selection still works.
- `npm run validate:import`: PASS.
- Pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_101424Z.png`
- Desktop build:
  - `release-fixed18\win-unpacked\动作生成工作台.exe`
  - Launch smoke stayed alive for 6 seconds: PASS.

Current blocking issue:
- None for this change.

Next step:
- Use `release-fixed18\win-unpacked\动作生成工作台.exe` for manual testing.

## Chest And Head G Translate Fix - 2026-05-10

Current objective:
- Fix `G` translation not working on chest and head controls.

Current progress:
- `Chest_CTRL` now handles position deltas in `applyControlToJoint()`.
- `Head_CTRL` now handles position deltas in `applyControlToJoint()`.
- Chest translation moves the chest branch through `moveJointBranch("Chest", ...)`, keeping the Spine-Chest segment at fixed rest length.
- Head translation moves the head through `moveJointBranch("Head", ...)`, keeping the Neck-Head segment at fixed rest length.
- Updated the `app.js` query version in `index.html` to avoid stale browser cache.

Files changed:
- `app.js`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- Targeted Playwright validation for `Chest_CTRL` and `Head_CTRL` translation.
- `npm run validate:import`
- `npx electron-builder --win --dir --config.directories.output=release-fixed17 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed17\win-unpacked\动作生成工作台.exe`

Validation result: PASS

Validation details:
- Targeted screenshot:
  - `artifacts/screenshots/chest_head_g_20260510T091225.png`
- Targeted checks:
  - `Chest_CTRL` translate moves Chest and Head.
  - Spine-Chest length stays within `0.002m` of rest length.
  - `Head_CTRL` translate moves Head.
  - Neck-Head length stays within `0.002m` of rest length.
  - Keyboard `G` on `Head_CTRL` commits `set_control_transform` successfully.
- `npm run validate:import`: PASS.
- Pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_091300Z.png`
- Desktop build:
  - `release-fixed17\win-unpacked\动作生成工作台.exe`
  - Launch smoke stayed alive for 6 seconds: PASS.

Current blocking issue:
- None for this change.

Next step:
- Use `release-fixed17\win-unpacked\动作生成工作台.exe` for manual testing.
- Continue control-rig behavior cleanup if torso/head translate still needs different artistic limits.

## Axis Quick Switch And Fixed-Length IK - 2026-05-10

Current objective:
- Add visible XYZ axis quick switching, remove free-rotate dead spots and initial R-key angle jumps, and prevent waist/COG movement from stretching leg controllers.

Current progress:
- Added a compact `自由 / X / Y / Z / 视角` axis switch group beside the transform toolbar.
- Axis buttons update `MotionState.transform.axis` and visually show the active axis.
- Rotation transform now accumulates incremental mouse movement instead of recalculating from the initial pointer-to-center angle:
  - Pressing `R` starts at zero delta, so the selected control no longer jumps immediately.
  - Free/view rotation can continue past 180 degrees without hitting the previous dead angle.
  - X/Y/Z constrained rotation uses incremental screen-axis movement.
- `COG_CTRL` translation now uses anchored-foot pelvis solving instead of moving the whole skeleton like Global/Root.
- Pelvis/COG anchored-foot movement now clamps the requested translation to the reachable leg length. If the feet cannot stay locked, the move stops at the physical limit.
- Two-bone IK now uses fixed rest-pose upper/lower segment lengths only, so stretched previous poses cannot become the new bone length.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Targeted Playwright validation for axis buttons, COG foot lock, fixed leg lengths, and R-key no-jump behavior.
- `npx electron-builder --win --dir --config.directories.output=release-fixed16 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed16\win-unpacked\动作生成工作台.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_085616Z.png`
- Targeted validation screenshot:
  - `artifacts/screenshots/axis_locks_rotate_20260510T085855.png`
- Targeted checks:
  - Axis button `X` sets axis to `x`.
  - Axis button `视角` sets axis to `view`.
  - Axis button `自由` clears axis.
  - `COG_CTRL` translation keeps both feet locked within `0.003m`.
  - Leg segments stay within `0.002m` of rest-pose lengths.
  - Pressing `R` and moving slightly keeps initial rotation delta under `0.12`, preventing the previous jump.
- Desktop build:
  - `release-fixed16\win-unpacked\动作生成工作台.exe`
  - Launch smoke stayed alive for 6 seconds: PASS.

Current blocking issue:
- None for this change.

Next step:
- Rebuild the unpacked EXE if the user wants the desktop app refreshed with these changes.
- Continue with the larger control-rig cleanup separately: simpler polygon controllers, clearer torso handle spacing, and full DCC-style transform handles.

## Toolbar Axis Mode And Keyboard Undo - 2026-05-10

Current objective:
- Separate keyboard modal transforms from toolbar axis-tool transforms, reduce transform gizmo visual weight, and add keyboard undo/redo.

Current progress:
- Keyboard `G/R/S` remains the direct modal workflow:
  - Press `G`, move the mouse, then confirm with Enter or left click.
  - Press `G` then `X/Y/Z` to constrain movement to that axis.
  - Press `R` then `X/Y/Z` to rotate around that axis.
- Toolbar buttons now behave as tool selection only:
  - Clicking `移动 G` / `旋转 R` / `缩放 S` shows the corresponding gizmo.
  - Dragging the controller body while a toolbar tool is active only selects the control; it no longer directly moves it.
  - To transform in toolbar mode, the user must drag the visible axis/handle/ring.
- Translate and scale gizmo axes are now pickable transform-gizmo targets with invisible hit geometry.
- Reduced visual thickness and size for transform arrows, arrowheads, scale boxes, labels, and rotation rings while preserving click targets.
- Added keyboard undo/redo:
  - `Ctrl+Z` / `Cmd+Z`: undo
  - `Ctrl+Y` / `Cmd+Y`: redo
  - `Ctrl+Shift+Z` / `Cmd+Shift+Z`: redo
- Updated `index.html` app.js query version to avoid loading stale cached script.

Files changed:
- `app.js`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- Targeted Playwright transform test:
  - keyboard `G` moved selected control
  - `Ctrl+Z` restored original control position
  - toolbar `移动 G` body drag did not directly move the selected control
- `npm run validate:import`
- `npx electron-builder --win portable --config.directories.output=release-fixed15 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed15\win-unpacked\动作生成工作台.exe`
- Packaged `win-unpacked` import smoke through CDP.

Validation result: PASS

Validation details:
- Targeted transform test:
  - keyboardMoveDelta: `0.2256026020459955`
  - undoDelta: `0`
  - toolbarBodyDragDelta: `0`
  - screenshot: `artifacts/screenshots/toolbar_axis_keyboard_undo_20260510.png`
- `npm run validate:import`: PASS.
- Latest pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_075051Z.png`
- `release-fixed15\win-unpacked\动作生成工作台.exe` launch smoke:
  - PASS. Process stayed alive after 8 seconds.
- `release-fixed15\win-unpacked` import smoke:
  - imported: Loaded
  - source bones: 39
  - GLB skins: 1

Current blocking issue:
- Single-file portable NSIS build for `release-fixed15\动作生成工作台 0.1.0.exe` failed during the final NSIS compression step with `Internal compiler error #12345: error creating mmap`.
- The unpacked EXE was generated before that failure and is validated.

Next step:
- Use `release-fixed15\win-unpacked\动作生成工作台.exe` for manual testing.
- If a single-file portable EXE is required, retry/fix the NSIS packaging issue separately without changing app behavior.

## Polygon Control Handles And Rotation Axis Pick - 2026-05-10

Current objective:
- Reduce controller visual clutter and make rotate mode behave closer to common DCC controls: simple polygon handles, pickable X/Y/Z/current-view rotation rings, and less torso overlap.

Current progress:
- Replaced the large torso/root control rings with smaller simple polygon handles:
  - Global_CTRL: octagon ground handle.
  - Root_CTRL: diamond/rect ground handle.
  - COG_CTRL / Pelvis_CTRL / Chest_CTRL / Head_CTRL: compact hexagon/pentagon/diamond body handles.
- Reduced filled handle opacity and visual footprint for torso/root/head controls while keeping invisible hit areas for clicking.
- Rotation mode now provides four selectable ring orientations:
  - X axis
  - Y axis
  - Z axis
  - current camera/view direction
- Rotation rings are tagged as transform-gizmo pick targets and highlight on hover.
- Clicking a rotation ring selects that axis and starts the rotate transform from the current control state.
- Added `V` in active rotate transform as a view-axis toggle, alongside existing X/Y/Z axis keys.
- Transform-gizmo size now scales with camera distance and is clamped by rig scale, so zooming in does not leave a huge world-sized ring covering the model.
- Updated `index.html` app.js query version so browser/EXE load this controller update instead of cached script.

Files changed:
- `app.js`
- `index.html`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Playwright visual screenshot checks for imported-model polygon controls and rotate gizmo.
- `npx electron-builder --win portable --config.directories.output=release-fixed14 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- `npx asar list release-fixed14\win-unpacked\resources\app.asar`
- Start-process smoke test for `release-fixed14\动作生成工作台 0.1.0.exe`
- Packaged `win-unpacked` import smoke through CDP.

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest pipeline screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_065955Z.png`
- Controller/gizmo visual screenshots:
  - `artifacts/screenshots/polygon_controls_rotate_normal_20260510.png`
  - `artifacts/screenshots/polygon_controls_rotate_close_scaled3_20260510.png`
- Packaged `win-unpacked` import smoke:
  - imported: Loaded
  - source bones: 39
  - GLB skins: 1
- EXE launch smoke:
  - PASS. Process stayed alive after 8 seconds.
- Latest EXE:
  - `release-fixed14\动作生成工作台 0.1.0.exe`

Current blocking issue:
- None for this controller-visual pass. Remaining behavior work, if needed, should be handled separately from the visual controller cleanup.

Next step:
- User manual check in `release-fixed14`: import a GLB, bind skeleton, generate IK, select a torso/hand/foot control, switch to `旋转 R`, then click the X/Y/Z/current-view rings.

## EXE Unified Import Fix - 2026-05-10

Current objective:
- Fix the user-reported issue where the packaged EXE still cannot correctly import a GLB model from the top `导入模型` entry.

Current progress:
- Removed the EXE-only default import branch from the top toolbar click path.
- The top `导入模型` entry now always opens the same hidden `#modelFileInput` path in both browser and Electron.
- This avoids the previous split behavior where the browser used file input but the EXE used `desktopBridge.openGlbFile()`.
- Updated the `app.js` query string in `index.html` so the new import handler is loaded instead of a stale cached script.
- Found the actual packaged-EXE failure:
  - `app.js` was not executing in the packaged app.
  - `three/examples/jsm/loaders/GLTFLoader.js` and `three/examples/jsm/utils/SkeletonUtils.js` were missing from `app.asar`.
  - The browser worked because local `node_modules` existed; the EXE only showed static HTML with no working app logic.
- Updated `package.json` so `node_modules/three/examples/jsm/**/*` is explicitly included in the packaged app.
- Verified `release-fixed13\win-unpacked\resources\app.asar` contains:
  - `node_modules\three\examples\jsm\loaders\GLTFLoader.js`
  - `node_modules\three\examples\jsm\utils\SkeletonUtils.js`
  - `node_modules\three\examples\jsm\utils\BufferGeometryUtils.js`
- Verified Electron source behavior by clicking the real top `导入模型` entry:
  - a file chooser event is emitted
  - setting `sample_models/stylized_3d_character_model.glb` imports successfully
  - import result reads 39 source bones and 1 GLB skin
- Verified packaged `win-unpacked` EXE behavior through CDP:
  - `window.__motionDebug` exists, proving `app.js` now runs
  - clicking `导入模型` emits a file chooser event
  - setting `sample_models/stylized_3d_character_model.glb` imports successfully
  - import result reads 39 source bones and 1 GLB skin

Files changed:
- `app.js`
- `index.html`
- `package.json`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`
- Electron source file-input smoke test through Playwright `_electron`
- `npm run validate:import`
- `npx electron-builder --win portable --config.directories.output=release-fixed12 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed12\动作生成工作台 0.1.0.exe`
- `npx electron-builder --win portable --config.directories.output=release-fixed13 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- `npx asar list release-fixed13\win-unpacked\resources\app.asar`
- Packaged `win-unpacked` EXE import smoke through CDP
- Start-process smoke test for `release-fixed13\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- Electron source import smoke: PASS.
- Packaged `win-unpacked` EXE import smoke: PASS.
- `npm run validate:import`: PASS.
- Latest validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_043205Z.png`
- Latest EXE:
  - `release-fixed13\动作生成工作台 0.1.0.exe`
- EXE launch smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- None for EXE import. Packaged `win-unpacked` import was verified. The portable EXE was launch-smoked and is built from the same fixed app package.

Next step:
- User manual check in `release-fixed13`: click `导入模型`, select the GLB, confirm the model and source bones appear.

## Walk_8F Arm Direction Stabilization - 2026-05-10

Current objective:
- Fix the user-visible issue where applying Walk_8F makes the shoulder/arm area look reversed or crossed near the torso.

Current progress:
- Changed Walk_8F to favor stable retargeting over decorative torso motion:
  - Pelvis_CTRL / Chest_CTRL / Head_CTRL rotations are now neutral in the template.
  - This removes the automatic torso twist that was making the imported character's shoulder area read backwards on some rigs.
- Replaced generic hand IK placement for Walk_8F:
  - Walk arms are now generated from the current T-Pose shoulder width and actual side direction.
  - Forearm and hand joints are placed directly on their own side before syncing IK controls.
  - Hand IK controls are then attached to the solved hand positions.
  - Elbow pole controls are placed from the solved elbow, not from a generic template target.
- Added validation that the whole arm chain stays on its own side:
  - R_Forearm / R_Hand must remain on the right side.
  - L_Forearm / L_Hand must remain on the left side.
  - The validation no longer only checks hand endpoints.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Visual inspection of `artifacts/screenshots/pipeline_acceptance_20260510_040706Z.png`
- `npx electron-builder --win portable --config.directories.output=release-fixed11 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed11\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_040706Z.png`
- Latest EXE:
  - `release-fixed11\动作生成工作台 0.1.0.exe`
- EXE smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- Packaged EXE GLB import still needs manual user confirmation because Playwright cannot launch the portable EXE directly through `_electron.launch`; source Electron import path is verified, packaged smoke launch is verified.

Next step:
- User manual check in `release-fixed11`: import model, confirm direction, bind skeleton, generate IK, apply Walk_8F.

## IK Control Attachment Fix - 2026-05-10

Current objective:
- Fix the user-reported issue where dragging one controller can leave other IK controllers visually detached from the model.

Current progress:
- Changed IK end-effector behavior:
  - Hand IK and Foot IK controls now snap back to the solved hand/foot joint after IK runs.
  - If a target is outside the limb's reachable range, the controller clamps to the actual reachable hand/foot position instead of staying in space.
- Changed controller synchronization:
  - Non-selected controls now resync from the current model joints after a control operation.
  - Pole controls preserve their manually edited position only while they are the actively changed control.
  - Other pole controls follow the current limb again instead of being left at stale positions.
- Updated drag preview:
  - The final drag command now uses the solved controller position after preview, not the raw mouse-plane point if the limb cannot reach it.
- Added validation coverage:
  - After pelvis movement, R/L Hand IK and R/L Foot IK must remain attached to their target joints.
  - After dragging a foot IK below ground, the foot control must clamp above ground and stay attached to the foot joint.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- `npx electron-builder --win portable --config.directories.output=release-fixed10 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed10\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_034706Z.png`
- Latest EXE:
  - `release-fixed10\动作生成工作台 0.1.0.exe`
- EXE smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- None for the IK controller detachment bug. Remaining visual retarget issues around Walk_8F arm direction are separate.

Next step:
- User manual check in `release-fixed10`, especially dragging pelvis/feet/hands and applying Walk_8F.

## Import Entry And Workflow Explanation - 2026-05-10

Current objective:
- Fix the still-reported EXE import click issue and document the actual current model -> skeleton -> IK -> walk workflow logic so the remaining reversed-motion problem is clear.

Current progress:
- Changed the top toolbar `导入模型` control into a label backed by the real `#modelFileInput` for browser imports.
- Updated the click handler:
  - EXE / Electron path now calls `desktopBridge.openGlbFile()` and prevents the label default file-input click.
  - Browser path now lets the label open the file chooser directly.
  - Keyboard Enter / Space on the label still opens the file chooser.
- Added label-style layout rules so the new import label keeps the same compact toolbar appearance.
- Updated the `app.js` query string in `index.html` to avoid stale browser cache.
- Confirmed Electron source click calls the patched main-process `dialog.showOpenDialog` once.
- Current known logic issue for the "still reversed after Walk_8F" report:
  - Walk_8F is still a generic helper-rig template.
  - It drives the imported GLB through mapped source-bone direction matching.
  - It is not yet a true per-model local-axis IK/retarget solver.
  - Visual reversal can still appear on models with different local hand/arm axes or when the generic hand target path is too close to the body center.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import`
- Electron source automation: patched `dialog.showOpenDialog`, clicked `#toolbarImportButton`, confirmed one native dialog call.
- `npx electron-builder --win portable --config.directories.output=release-fixed9 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed9\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_032246Z.png`
- Electron dialog path:
  - launched: true
  - dialogPatched: true
  - dialogCalls: 1
- Latest EXE:
  - `release-fixed9\动作生成工作台 0.1.0.exe`
- EXE smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- The import click path is now verified in Electron source, but the remaining Walk_8F visual reversal needs a more structural retarget fix rather than another direction-button patch.

Next step:
- Replace the current generic Walk_8F hand/arm target logic with a source-rig-aware retarget pass that respects the confirmed model direction, mapped side identity, and each imported bone's local axis basis.

## Walk_8F Hand Wrist Twist Fix - 2026-05-10

Current objective:
- Investigate why IK binding is mostly correct but loading Walk_8F still makes the hands look reversed, then fix pelvis down / grounded foot behavior reported during manual pose editing.

Current progress:
- Reproduced the imported GLB flow with the local sample model:
  - import T-Pose GLB
  - rotate model right 90 degrees
  - confirm direction
  - bind Humanoid_v1
  - create IK controls
  - apply Walk_8F
- Confirmed the root cause:
  - hand IK target positions stayed on their own left/right sides
  - Walk_8F was also writing explicit `R_Hand` and `L_Hand` wrist rotations on every key pose
  - those wrist rotations caused the real GLB hand bones to look flipped/twisted even when IK binding was broadly correct
- Changed Walk_8F so hand IK controls only drive arm placement and no longer auto-write wrist rotations.
- Changed the two PASSING key poses so hand forward/back offsets return to neutral instead of crossing through a small opposite offset.
- Added validation that exported/imported Walk_8F keyframes contain no `R_Hand` / `L_Hand` joint rotation overrides.
- Moved Walk_8F elbow pole targets outside the body and farther behind the arm plane so elbow bend direction is stable instead of folding across the torso.
- Added Pelvis_CTRL translation:
  - moving the pelvis translates hips, spine, arms, and thigh roots
  - foot IK targets are treated as anchors
  - legs are re-solved so pelvis can lower into a squat while feet stay planted
- Added foot-ground clamping for foot IK targets:
  - foot IK controls cannot be dragged below the ground clamp
  - the target foot joint is clamped above the model's rest sole/foot height
- Added validation for pelvis lowering and foot ground clamp.
- Added an app.js query version in `index.html` so browser refreshes do not keep using a stale cached script.

Files changed:
- `app.js`
- `index.html`
- `scripts/validate_demo_import.mjs`
- `styles.css` from the previous EXE import trigger fix is still included in the current working tree.
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import`
- Manual Playwright diagnostic for imported GLB Walk_8F hand/foot phase and wrist rotation keys.
- Manual Playwright screenshot for frame 17 after the wrist fix.
- `npx electron-builder --win portable --config.directories.output=release-fixed7 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed7\动作生成工作台 0.1.0.exe`
- `npx electron-builder --win portable --config.directories.output=release-fixed8 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed8\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260510_024250Z.png`
- Diagnostic result after fix:
  - all 8 Walk_8F key poses have `wristRotKeys: []`
  - contact/down/up hand swing remains opposite the same-side foot
- Pelvis / foot validation:
  - Pelvis_CTRL translate lowers Hips while R_Foot and L_Foot stay planted.
  - R_Foot_IK dragged below ground clamps above ground.
- Manual frame screenshot:
  - `artifacts/screenshots/walk_frame17_hands_after_wrist_fix.png`
- Latest EXE:
  - `release-fixed8\动作生成工作台 0.1.0.exe`
- EXE smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- None in automated checks. Needs user visual check in the browser/EXE because the remaining complaints are visual control behavior.

Next step:
- User manual check in browser after hard refresh and in `release-fixed8\动作生成工作台 0.1.0.exe`.

## EXE Import And Aligned Source Rest Fix - 2026-05-10

Current objective:
- Fix the user-reported EXE import button not responding and the IK/walk direction using a reversed or crooked source rig basis after manual direction alignment.

Current progress:
- Changed the top `导入模型` button so it opens the file picker immediately in the click event instead of awaiting `set_stage` first.
- Default import now uses the same file-input path in browser and Electron, avoiding separate web/EXE import behavior.
- Added a safe `showPicker()` fallback to `input.click()`.
- Added `refreshAlignedSourceRestCache()`:
  - resets imported source bones to their local rest pose
  - reads their world transforms after the user's confirmed model yaw is applied
  - stores `alignedWorldPosition` / `alignedWorldQuaternion`
- `driveMappedSourceRigFromJoints()` now uses the aligned source rest transforms, not the original unrotated GLB import transforms.
- `getSourceRigDebug()` now exposes both aligned and original rest transforms so direction cache issues are visible.
- Validation now checks:
  - clicking top `导入模型` opens a file chooser
  - confirmed direction refreshes source rest cache
  - after Walk_8F, the real source rig hands stay on their own sides

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Electron source smoke: click top import, file chooser opens, sample GLB imports.
- `npx electron-builder --win portable --config.directories.output=release-fixed6 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed6\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_174335Z.png`
- Manual diagnostic screenshot:
  - `artifacts/screenshots/manual_direction_rest_cache_fix.png`
- Electron source import smoke:
  - file chooser opened: true
  - imported sample model source bones: 39
  - humanoid mapping: 17, optional toes fallback
- Latest EXE:
  - `release-fixed6\动作生成工作台 0.1.0.exe`
- EXE smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- None for import trigger and aligned source rest cache.

Next step:
- User manual check in `release-fixed6`.

## Confirmed Direction Drives Binding And Walk Basis - 2026-05-09

Current objective:
- Make the user-adjusted model direction the only authority for binding and the Walk_8F motion basis.

Current progress:
- `getRigBasis()` now uses fixed map coordinates after direction confirmation:
  - X = right
  - Y = up
  - Z = forward
- `estimateHumanoidBasisFromPositions()` uses the same fixed map basis when direction is confirmed.
- Binding still reads the current aligned imported source-bone world coordinates and does not rotate or flip the model again.
- The import validation now simulates the sample model's correct manual alignment by rotating the model right 90 degrees before confirming direction.
- Added validation that the confirmed rig basis forward vector is fixed to map forward.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- `npx electron-builder --win portable --config.directories.output=release-fixed5 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed5\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_171602Z.png`
- Latest EXE:
  - `release-fixed5\动作生成工作台 0.1.0.exe`
- EXE smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- None.

Next step:
- User manual check in the latest EXE.

## Manual Direction Is Authoritative - 2026-05-09

Current objective:
- Simplify the imported GLB direction workflow so the user's manually adjusted visible model direction is the only authority before binding.

Current progress:
- Removed automatic initial direction guessing on GLB import.
- Imported models now start at `yaw_degrees: 0` and `confirmed: false`.
- The user rotates the whole model with the model rotation buttons until the face matches the fixed yellow map-forward arrow.
- `确认方向` only locks the currently visible model yaw.
- `绑定骨骼赋值` reads the current aligned source-bone world coordinates and does not apply another front/back flip.
- Walk_8F and IK generation use the bound aligned skeleton as the basis.
- Added Electron preload and IPC file picker:
  - `electron-preload.cjs`
  - `desktopBridge.openGlbFile()`
  - EXE no longer depends only on browser file input for importing GLB.
- Removed the visible top menu labels (`文件 / 编辑 / 视图 / 动作 / 导出 / 帮助`) from the layout.
- Split body controls:
  - `重心` still affects the whole body.
  - `胯部` rotates lower body and legs.
  - `胸腰` rotates upper body without dragging the feet.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `electron-main.cjs`
- `electron-preload.cjs`
- `package.json`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `node --check electron-main.cjs`
- `node --check electron-preload.cjs`
- `npm run check`
- `npm run validate:import`
- Electron smoke check for `desktopBridge.openGlbFile`
- `npx electron-builder --win portable --config.directories.output=release-fixed4 --config.win.signAndEditExecutable=false --config.win.signDlls=false`
- Start-process smoke test for `release-fixed4\动作生成工作台 0.1.0.exe`

Validation result: PASS

Validation details:
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_165158Z.png`
- Electron smoke:
  - `window.desktopBridge.openGlbFile`: present.
  - `.desktop-menu nav`: removed.
- Latest EXE:
  - `release-fixed4\动作生成工作台 0.1.0.exe`
- EXE smoke:
  - PASS. Process stayed alive after 8 seconds.

Current blocking issue:
- None for the simplified direction-binding workflow.

Next step:
- User manual check in EXE:
  1. `导入模型`
  2. use model rotation buttons until the face matches the yellow map-forward arrow
  3. `确认方向`
  4. `绑定骨骼赋值`
  5. `生成 IK 控制器`
  6. `加载 Walk_8F 走路模板`

## Button Direction Bind Stability Fix - 2026-05-09

Current objective:
- Fix the user-reported issue where using the built-in model rotation buttons, then clicking `确认方向` and `绑定骨骼赋值`, caused the imported character and source bones to jump angle/pose.

Current progress:
- Confirmed the correct workflow is based on the app's model rotation buttons, not mouse/camera view rotation.
- `确认方向` now keeps the current `MotionState.direction.forward_sign` and `MotionState.direction.yaw_degrees`; it does not infer direction from the camera.
- `绑定骨骼赋值` reads the already aligned imported source-bone world positions.
- `syncSourceRigToMotionState()` no longer drives/deforms the imported GLB source rig during initial rest-pose binding.
- Added validation that reproduces the user flow:
  - import sample GLB
  - click `模型右转15°` six times
  - click `确认方向`
  - capture imported source-rig world transforms
  - click `绑定骨骼赋值`
  - assert source-rig positions and rotations stay stable
  - assert bound Humanoid hips match the confirmed aligned source hips

Files changed:
- `app.js`
- `index.html`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short`
- `git diff --stat`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import`

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_152737Z.png`

Current blocking issue:
- None for the binding jump regression.

Next step:
- Rebuild the Windows portable EXE so the desktop version contains this fix.

## Direction Binding And EXE Package - 2026-05-09

Current objective:
- Clean up the current imported-GLB workflow and produce a runnable Windows EXE.

Current progress:
- Removed the practical dependency on duplicate model import buttons:
  - The top `导入模型` action opens the GLB file picker.
  - The right inspector no longer exposes a second visible `导入 GLB` button.
- Changed skeleton binding flow to one authoritative action:
  - Import T-Pose GLB.
  - Align/confirm model direction against the fixed yellow map-forward arrow.
  - Click `绑定骨骼赋值`.
- Added a guard so imported models cannot bind `Humanoid_v1` before direction is confirmed.
- Changed the yellow direction arrow to mean fixed map forward, not a movable inferred character-forward arrow.
- Fixed the left/right identity bug:
  - Front/back direction flips no longer invert `basis.right`.
  - Right/left hand IK controls keep their own side after direction correction and Walk_8F application.
- Added Electron desktop packaging:
  - `electron-main.cjs`
  - `npm run desktop`
  - `npm run dist:win`
- Built runnable Windows outputs:
  - `release/动作生成工作台 0.1.0.exe`
  - `release-dir/win-unpacked/动作生成工作台.exe`
- Follow-up fix after user reproduced a binding jump:
  - Direction alignment is now applied directly to `Runtime.importedModelScene`.
  - `create_humanoid_skeleton` reads the aligned source-bone world coordinates.
  - Binding no longer drops the temporary preview rotation when switching from source skeleton to Humanoid_v1.
  - Added validation that imports a GLB, rotates the model direction by 90 degrees, binds the skeleton, and checks the bound Hips position matches the rotated source Hips position.
  - Rebuilt the latest fixed portable EXE at `release-fixed2/动作生成工作台 0.1.0.exe`.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `package.json`
- `package-lock.json`
- `electron-main.cjs`
- `CURRENT_STATE.md`

Commands run:
- `npm install`
- `node --check app.js`
- `node --check scripts/validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import`
- `npm run dist:win`
- `npx electron-builder --win dir --config.directories.output=release-dir`
- Electron smoke test through Playwright.
- Start-process smoke test for both packaged EXE outputs.

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_150343Z.png`
- Desktop app smoke test:
  - `electron .` opened `index.html` and found `#rigCanvas`.
  - `release-dir/win-unpacked/动作生成工作台.exe` stayed running after launch.
  - `release/动作生成工作台 0.1.0.exe` stayed running after launch.
  - `release-fixed2/动作生成工作台 0.1.0.exe` stayed running after launch.

Current blocking issue:
- `npm run dist:win` generated the portable EXE but returned a cleanup error because `release/codex-action-rig-demo-0.1.0-x64.nsis.7z` was briefly locked by Windows.
- A clean directory build was generated successfully under `release-dir/win-unpacked`.

Next step:
- Use `release-fixed2/动作生成工作台 0.1.0.exe` for direct testing.
- If portable cleanup continues to be noisy, keep `release-dir/win-unpacked` as the stable build target or zip that folder for delivery.

## Desktop Workbench UI Layout - 2026-05-09

Current objective:
- Convert the current numbered web workflow UI into the agreed Chinese desktop-style action workbench layout while keeping existing skeleton, IK, and motion logic unchanged.

Current progress:
- Replaced the numbered top flow with a desktop-style menu and workbench toolbar:
  - 导入模型
  - 骨骼识别
  - 生成 IK 控制器
  - 动作编辑
  - 验证
  - 导出
- Removed the visible `吸附` and `镜像` toolbar buttons because they do not yet have real implemented behavior.
- Added a left `场景` panel showing current model, skeleton, IK controller, and motion state.
- Reworked the center/right structure into:
  - left scene panel
  - center 3D viewport
  - right property inspector
  - bottom timeline
- Renamed the right-side panels to match the current agreed workflow:
  - `导入模型`
  - `骨骼识别`
  - `IK 控制器`
  - `动作编辑`
  - `验证`
  - `导出`
- Changed the bottom timeline from large 8-pose cards into a compact Dope Sheet style layout with:
  - frame ruler
  - key pose row
  - global / COG row
  - body row
  - hand IK row
  - foot IK row
- Kept the existing keyframe data model and `.key-pose.has-keyframe` validation contract intact.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `CURRENT_STATE.md`

Commands run:
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run check`
- `npm run validate:import`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_133533Z.png`

Current blocking issue:
- Browser-use plugin screenshot attempt timed out twice, but the Playwright validation screenshot was generated successfully and manually inspected.

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Continue discussion/implementation around the professional timeline functions: copy keyframe, paste keyframe, mirror selected keyframe, delete keyframe, and draggable keyframe movement.

## Handoff Before Gizmo Ring Fix - 2026-05-09

Current objective:
- Pause feature work, write a clear handoff, and upload the current local state to GitHub before continuing.

Current user-reported issue:
- After selecting a Control Rig controller and pressing `R`, the visible rotation rings cannot be selected or dragged as Blender-style rotation handles.
- Expected behavior: colored X/Y/Z rings constrain rotation by axis, white rings rotate around the current view axis, and commits go through `set_control_transform` with undo/redo support.

Current progress:
- Updated `HANDOFF.md` with the latest issue, current code state, and next implementation plan.
- Local `app.js` already contains a small in-progress change in `renderTransformGizmo()` that passes `mode / axis_key / control_id` metadata into rotation ring creation.
- That in-progress change is not enough to fix the issue because `createGizmoRing()` still needs an invisible thick hit ring and `onPointerDown()` still needs to raycast `gizmoGroup` before ordinary control picking.

Files changed:
- `HANDOFF.md`
- `CURRENT_STATE.md`
- `app.js` has pre-existing local changes versus the GitHub publish folder and should be included in the upload so the handoff matches the code state.

Validation result:
- PASS.

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_101212Z.png`
- Publish-folder validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_101842Z.png`

Next step:
- Sync the current local files into `E:\codex骨骼软件_github_publish`, run syntax/import validation, commit, and push.
- After upload, resume by implementing pickable Transform Gizmo rotation rings.

## Chinese UI And Stage Flow Cleanup - 2026-05-09

Current objective:
- Make the interface readable in Chinese and remove confusing workflow jumps/display clutter around direction confirmation, source skeleton preview, and Control Rig creation.

Current progress:
- Top workflow labels are now Chinese:
  - 模型
  - 骨架/方向
  - 映射校正
  - 控制器层
  - 动作模板
  - 验证
  - 导出
- Top transform tools are now Chinese:
  - 选择
  - 移动 G
  - 旋转 R
  - 缩放 S
  - 全局/局部
  - 吸附
  - 镜像
- Visible display toggles were reduced to only:
  - 模型
  - 骨架参考
  - 控制器
  - 变换手柄
  - 地面
  - 问题提示
- Advanced debug/display switches still exist internally but are hidden from the main viewport toolbar.
- The debug panel is now collapsed by default and renamed `高级调试`.
- `生成参考骨架` no longer jumps to the Control Rig stage; it stays in `骨架/方向` so the direction arrow and mapping context remain visible.
- `生成 Humanoid_v1` only advances to `控制器层` after imported-model direction has been confirmed; otherwise it keeps the user in `骨架/方向`.
- `创建控制器层` now requires confirmed character forward on imported models, preventing Control Rig creation from silently using an unconfirmed/reversed direction.
- The yellow character-forward arrow is now rendered through `骨架/方向`, `映射校正`, `控制器层`, and `动作模板` stages while a skeleton is present.
- Validation now checks the imported GLB flow: import -> generate reference skeleton -> remain on skeleton stage -> confirm direction -> generate Humanoid -> enter control rig.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_095328Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- Recommended imported-GLB flow:
  1. `模型`: 导入 GLB
  2. `骨架/方向`: 生成参考骨架，调整黄色前方箭头并确认
  3. `骨架/方向`: 生成 Humanoid_v1
  4. `控制器层`: 创建控制器层
  5. `动作模板`: 应用 8 姿势走路模板

## Thin Controls, Rotation Direction, And Walk Hand Crossing Fix - 2026-05-09

Current objective:
- Respond to usability issues where controls/gizmo lines were too thick, mouse rotation felt inverted, and default Walk_8F crossed both arms in front of the body.

Current progress:
- Reduced default Control Rig line thickness from `0.72` to `0.28`.
- Reduced the actual generated tube radii for Control Rig lines and Transform Gizmo rings/drag guide, so the result is genuinely thinner rather than only changing the slider value.
- Reduced translate/world-axis arrow shaft and head size.
- Reversed view-axis and constrained rotation angle signs so mouse drag direction matches the model's visible rotation direction.
- Reworked `setWalkHandIkControl`:
  - hand targets are now derived from each side's shoulder direction, not a generic global left/right offset
  - right hand stays outside the right shoulder side
  - left hand stays outside the left shoulder side
  - fallback side direction still uses the current rig basis
- Added validation that Walk_8F keeps `R_Hand_IK` and `L_Hand_IK` on their own shoulder sides for both the dummy flow and the imported sample GLB flow.

Files changed:
- `app.js`
- `index.html`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_085830Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- Re-apply Walk_8F on the stylized GLB and verify hands stay on their own sides; if a specific imported rig has swapped left/right naming, inspect the mapping stage before applying templates.

## Blender Rotate Interaction And Walk Relaxed Arms - 2026-05-09

Current objective:
- Make keyboard transform behavior closer to Blender and make Walk_8F adapt from imported T-Pose models without leaving arms stretched sideways.

Current progress:
- Fixed `R` interaction so left-drag no longer immediately confirms. `R` now enters transform mode, mouse movement rotates live, and left mouse release / Enter commits through `set_control_transform`; right mouse / Esc cancels.
- Added rotate-mode visual feedback:
  - XYZ colored rotation rings.
  - white outer view-axis ring.
  - smaller inner view-axis ring.
  - live white drag radius line from selected control to current pointer.
  - X/Y/Z labels on the active gizmo.
- Added a visible scene XYZ axis triad on the ground layer.
- Walk_8F now relaxes hand IK targets from T-Pose into a side-of-body arm pose before applying forward/back arm swing.
- Walk_8F now repositions Pole controls before solving limbs so knees stay forward and elbows stay behind relative to current character-forward basis.
- Added Playwright coverage for a real `R` key + mouse move + left-release rotation commit.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_082721Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- Select `COG_CTRL`, press `R`, move the mouse without clicking or left-drag from the control; a white radius line should appear and the body should rotate around the current view axis. Release left mouse or press Enter to confirm.

## Blender-Style Control Rig Usability Pass - 2026-05-09

Current objective:
- Fix the animator-facing control workflow: Blender-like R/G behavior, working torso controls, lighter controller visuals, adjustable controller size/thickness, and usable Walk_8F generation.

Current progress:
- `R` keyboard transform now defaults to rotating around the current camera/view axis, instead of forcing a horizontal/yaw axis. `X/Y/Z` still constrain rotation when pressed during transform.
- `COG_CTRL`, `Root_CTRL`, and `Global_CTRL` rotations now drive the Hips branch, so the waist/root controls can actually twist the body.
- `G` translation previews now preserve hand/foot IK target positions instead of snapping the controller back to the clamped end-effector position after solving.
- Control Rig visuals were simplified from debug boxes/cones into lighter rings, line segments, triangles, and a few translucent panels.
- Labels are off by default and only render for the selected or hovered control.
- Added viewport sliders for controller size and controller line thickness.
- IK Pole defaults now place knees in front of the character and elbows behind the character.
- `apply_motion_template` no longer fails just because character forward was not manually confirmed; it uses the current forward and marks it confirmed when applying Walk_8F.
- Validation coverage now checks COG rotation via `set_control_transform`, controller size/thickness commands, and auto-confirmed Walk_8F generation on the imported sample GLB.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `HANDOFF.md`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_075300Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- Test manual interaction on the imported GLB: select `COG_CTRL`, press `R`, move the mouse around the current view angle, then left-click/Enter to confirm; select a hand/foot IK and press `G` to verify the control target moves consistently.

## Control Rig Layer Refactor - 2026-05-09

Current objective:
- Stop feature growth and refactor the viewport from a mixed skeleton/debug display into an animator-facing Control Rig workflow.

Current progress:
- Split viewport display into model, deform skeleton, control rig, IK controls, joint debug controls, labels, transform gizmo, motion path, foot locks, ground, and validation layers.
- Default view now keeps `Joint Debug` off; the 19 debug joint controls no longer flood the viewport.
- Added main Control Rig controllers:
  - `Global_CTRL`
  - `Root_CTRL`
  - `COG_CTRL`
  - `Pelvis_CTRL`
  - `Chest_CTRL`
  - `Head_CTRL`
  - `L_Hand_IK` / `R_Hand_IK`
  - `L_Foot_IK` / `R_Foot_IK`
  - `L_Knee_Pole` / `R_Knee_Pole`
  - `L_Elbow_Pole` / `R_Elbow_Pole`
- Top toolbar now has workflow steps plus Select / Move G / Rotate R / Scale S / Local-Global / Snap / Mirror controls.
- Added `set_control_transform` command for Control Rig transforms.
- G/R/S keyboard transforms now commit through `set_control_transform` for selected Control Rig controls.
- Transform gizmo now renders only on the selected Control Rig control.
- Walk_8F now creates keyframes on Control Rig controls first, including `COG_CTRL`, `Pelvis_CTRL`, and `Chest_CTRL`, then solves the skeleton from those controls.
- Exported keyframes carry Control Rig positions, rotations, and scales.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `scripts/validate_demo_import.mjs`
- `HANDOFF.md`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Validation now checks:
  - 14 main Control Rig controls exist.
  - 19 joint debug controls still exist but default hidden.
  - `COG_CTRL`, `Pelvis_CTRL`, and `Chest_CTRL` exist.
  - `set_control_transform` writes a successful command log entry.
  - Walk_8F keyframes include COG and pelvis control data.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_065946Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- Continue refining controller shapes and transform gizmo hit-testing if animator usability still feels rough.

## IK Control Visual Simplification And Torso Rotation - 2026-05-09

Current objective:
- Fix IK viewport clutter where all controllers looked alike, and fix torso/pelvis rotation where rotating the waist visually moved hands but did not twist the body.

Current progress:
- Core IK controls now have distinct simple shapes:
  - pelvis/waist: green belt ring
  - hands: palm block with wrist stem
  - feet: flat sole with toe direction
  - pole controls: triangular pole markers
- Core IK controls always show short Chinese labels such as `腰`, `右手`, `左脚`, `右膝`.
- The 19 ordinary joint controls are no longer rendered as large duplicate boxes by default; only the selected joint control appears as a small control point.
- IK picking now ignores hidden ordinary joint controls so clicks are less likely to hit the wrong overlapping controller.
- Added `MotionState.joint_rotations` for explicit torso/waist rotation overrides.
- `rotate_joint_branch` stores explicit rotation for Hips/Spine/Chest/Neck/Head.
- Source rig driving now applies explicit joint rotations to mapped source bones, so waist/chest rotation can twist the imported model instead of only moving distant hand positions.
- Keyframes, interpolation, export/import, undo/redo, and playback now carry `joint_rotations`.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `HANDOFF.md`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Imported `sample_models/stylized_3d_character_model.glb` creates Humanoid_v1, IK, Walk_8F, and a regression command rotates `Hips`; source rig Hips quaternion changes after the command.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_053348Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- Recreate IK controls. The viewport should show only the 9 core IK controls plus any currently selected joint control.

## IK Optional Toe Fallback - 2026-05-09

Current objective:
- Fix the IK stage failure on the imported `stylized_3d_character_model.glb` where auto mapping reports `17 / 19` and blocks `create_ik_controls`.

Current progress:
- Changed Humanoid_v1 animation readiness from strict `19 / 19` mapping to complete required core mapping.
- Marked `R_Toe` and `L_Toe` as optional imported mappings.
- Missing toe joints now get generated fallback positions from the corresponding foot, lower leg, and current character-forward basis.
- Mapping UI now shows `脚尖自动补` for the optional fallback case instead of making it look like a hard error.
- `set_character_direction` rebuilds Humanoid rest data so fallback toe positions stay aligned with the current front direction.
- Added validation coverage for the bundled imported GLB path, not only the default dummy model.

Files changed:
- `app.js`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Imported `sample_models/stylized_3d_character_model.glb` validates with no missing required humanoid mapping, Humanoid_v1 creation, 9 core IK controls, 19 joint controls, and 8 Walk_8F keyframes.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_050311Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- Re-import the GLB, create/default-map Humanoid, confirm front direction, then create IK. `17 / 19（脚尖自动补）` is acceptable for this model.

## Character Forward Angle Adjustment - 2026-05-09

Current objective:
- Fix the character-forward adjustment shown in the skeleton panel: `前后反转` only flipped 180 degrees, so a sideways or angled inferred arrow could not be corrected.

Current progress:
- Added manual character-forward yaw controls in the skeleton panel:
  - angle slider `-180°` to `180°`
  - `左转15°`
  - `右转15°`
- Extended `MotionState.direction` with `yaw_degrees`.
- Extended `set_character_direction` command args/result with `yaw_degrees`.
- `getRigBasis()` now applies `forward_sign` and then rotates the forward vector around the rig up axis by `yaw_degrees`.
- Direction UI now shows current front/back state, angle, and confirmation state.
- Exported Motion JSON now preserves `direction.yaw_degrees`.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `CURRENT_STATE.md`

Validation result: PASS

Validation details:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- Targeted Playwright check with `sample_models/stylized_3d_character_model.glb`:
  - set `yaw_degrees: 90`
  - rotated basis forward became orthogonal to previous forward
  - rotated basis forward aligned with previous right (`dot = 1`)
  - exported Motion JSON includes `{ forward_sign: 1, yaw_degrees: 90, confirmed: true }`
- `npm run validate:import`: PASS.
- Latest screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_043943Z.png`

Next step:
- Hard refresh `http://localhost:8780/`.
- In the skeleton panel, use the angle slider or `左转15°` / `右转15°` until the yellow arrow points along the character's real front, then click `确认当前前方`.
- If it points exactly backward after angle correction, use `前后反转`.

## Handoff Refresh And GitHub Publish - 2026-05-09

Current objective:
- Update the handoff document to include the latest direction-confirmation, joint-control, and viewport-interaction changes, then publish to GitHub.

Current progress:
- Updated `HANDOFF.md` with:
  - direction confirmation before Walk_8F
  - `set_character_direction`
  - exported/imported `direction`
  - 9 core IK controls plus 19 joint controls
  - G/R/S control notes
  - hover-before-select behavior
  - middle-mouse orbit distance lock
  - knee pole following confirmed character forward
  - latest validation notes and remaining limitations
- Published local commit `aeef251 Refresh direction handoff` to `origin/main`.

Files changed:
- `HANDOFF.md`
- `CURRENT_STATE.md`

Commands run:
- `git status -sb`
- `git diff --stat`
- `npm run check`
- `git add -- CURRENT_STATE.md HANDOFF.md`
- `git commit -m "Refresh direction handoff"`
- `git push origin main`
- `git push origin main` retry: PASS, `1b05360..aeef251 main -> main`

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- Existing latest pipeline validation remains:
  - `npm run validate:import`: PASS
  - latest screenshot `artifacts/screenshots/pipeline_acceptance_20260509_001441Z.png`

Current blocking issue:
- None.

Next step:
- Manual browser refresh at `http://localhost:8780/index.html` and continue testing imported GLB workflow from the latest GitHub state.

## Direction Confirmation And Blender Orbit Fix - 2026-05-09

Current objective:
- Add a required character-forward confirmation step before applying imported-model walk motion, and fix viewport/control interaction problems reported after binding.

Current progress:
- Added skeleton-stage direction confirmation:
  - `确认当前前方`
  - `前后反转`
  - status text for confirmed / pending direction
  - small viewport forward arrow near the rig
- Added `set_character_direction` into the Command API and MotionState snapshot/undo/export flow.
- Exported/imported Motion JSON now includes `direction`.
- Imported GLB rigs must confirm forward direction before `apply_motion_template` can apply `walk_cycle_8f`.
- Validation now reports `Character forward not confirmed` for imported skeletons that have not confirmed front/back direction.
- `前后反转` clears existing keyframes so old wrong-direction motion is not reused.
- Expanded controls:
  - kept 9 core IK controls
  - added 19 joint controls so head, torso, limbs, feet, and toes are directly selectable/controllable
  - status summary now separates core IK, joint controls, and all controls
- Fixed viewport interaction:
  - hover highlights controls before selection
  - click selects first, dragging starts only after a movement threshold
  - middle-mouse orbit now uses the previous pointer position correctly
  - orbit keeps camera distance locked
  - zoom range is widened
  - selecting a control retargets orbit around that selected point

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Playwright direction gate validation with `sample_models/stylized_3d_character_model.glb`
- Playwright middle-mouse orbit validation
- Playwright forward-flip validation

Validation result: PASS

Validation details:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Latest generated validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260509_001441Z.png`
- Imported GLB direction gate:
  - applying Walk_8F before direction confirmation is blocked with a clear error.
  - confirming front direction allows Walk_8F and creates 8 keyframes.
- Orbit validation:
  - middle-mouse drag changed yaw/pitch.
  - camera distance delta stayed `0`.
- Forward flip validation:
  - `forward_sign` changed from `1` to `-1`.
  - existing 8 keyframes were cleared.

Current blocking issue:
- None.

Next step:
- Manual browser refresh at `http://localhost:8780/index.html`.
- With the target GLB: import -> map/confirm bones -> confirm or flip character front -> create IK -> apply Walk_8F -> play.

## Handoff Documentation And GitHub Publish - 2026-05-09

Current objective:
- Write a clear project handoff document for the current motion-generation pipeline state, then publish the latest local project contents to GitHub.

Current progress:
- Rewrote `HANDOFF.md` from the outdated early editor description to the current workflow:
  - Command API architecture
  - MotionState scope
  - Humanoid_v1 naming
  - source GLB skeleton mapping
  - IK and joint dragging controls
  - 1-24 timeline frame editing
  - Walk_8F key poses
  - validation commands
  - known limitations and next steps
- Fetched `origin/main`; local `main` is aligned with remote before commit.

Files changed:
- `HANDOFF.md`
- `CURRENT_STATE.md`

Commands run:
- `git status -sb`
- `git remote -v`
- `git branch --show-current`
- `git fetch origin`
- `npm run check`
- `npm run validate:import`
- `git add -- CURRENT_STATE.md HANDOFF.md README.md app.js index.html package.json scripts/validate_demo_import.mjs scripts/create_tutorial_video.mjs start_demo.bat styles.css`
- `git commit -m "Refactor motion pipeline controls"`
- `git push origin main`

Validation result: PASS

Validation details:
- `npm run check`: PASS
- `npm run validate:import`: PASS
- Latest generated validation screenshot:
  - `artifacts/screenshots/pipeline_acceptance_20260508_170706Z.png`

Current blocking issue:
- None.

Next step:
- GitHub is updated through commit `6829e8a` on `origin/main`.
- Continue product work from the current motion-generation pipeline state.

## Limb IK, Joint Drag Controls, Frame Smoothing - 2026-05-09

Current objective:
- Fix the IK/controller interaction so IK controls affect whole limbs instead of only one joint, restore direct humanoid joint-point controls, and make the bottom timeline support saving any adjusted frame plus smoothing a selected frame span.

Current progress:
- Added Command API commands:
  - `set_joint_position`
  - `smooth_keyframes_between`
- `set_ik_target` now solves two-bone limb chains:
  - hand IK moves upper arm -> forearm -> hand chain
  - foot IK moves upper leg -> lower leg -> foot chain and keeps toe offset
  - pole targets re-solve elbow/knee bend direction
  - pelvis control translates the whole skeleton and IK set
- Added humanoid joint controls in the viewport:
  - small joint boxes
  - socket detail
  - angle arrow shaft/head
  - invisible hit sphere for practical picking
- Added viewport joint dragging:
  - left-drag a humanoid joint point to preview movement
  - on release, the app restores the drag-start snapshot and executes `set_joint_position`
  - child branch follows the dragged joint while preserving parent-bone length
- IK picking now has a small screen-distance fallback so visible IK controls are easier to grab without making the handles visually huge.
- Bottom timeline now distinguishes:
  - 8 Walk_8F template poses
  - 24 timeline frames
  - saved keyframes across frames 1-24
- Added bottom timeline controls:
  - save current frame
  - smooth current/selected segment
  - 24 small frame ticks
- Clicking saved keyframe ticks records the last two selected keyframes. `smooth_keyframes_between` uses those first; otherwise it uses the current frame's neighboring keyframe span.
- Keyframe list now shows real timeline frame numbers and interpolation mode.
- Debug API now exposes:
  - `getJointScreenPositions()`
  - existing IK screen positions for viewport validation

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `npm run validate:import`
- Playwright command-level IK/joint/timeline validation on test dummy
- Playwright viewport drag validation:
  - drag `R_Hand_IK`
  - drag `R_Forearm` humanoid joint with IK display toggled off
- Playwright GLB validation with `C:\Users\sigeryang\Downloads\female+figure+3d+model.glb`

Validation result: PASS

Validation details:
- `npm run check`: PASS
- `npm run validate:import`: PASS
- Command-level validation:
  - `set_ik_target` moved `R_Forearm` and `R_Hand`, while keeping `R_UpperArm` stable
  - `set_joint_position` moved `R_Forearm` and carried child `R_Hand`
  - saving frame 5 created an additional manual keyframe
  - smoothing frame 4 -> 5 set both keyframes to smooth interpolation
  - timeline rendered 24 frame ticks
- Viewport drag validation:
  - IK drag logged `set_ik_target` success
  - humanoid joint drag logged `set_joint_position` success
- Female GLB validation:
  - source bones: 41
  - GLB skins: 1
  - GLB joints: 41
  - humanoid mapping: 19 / 19
  - IK controls: 9 / 9
  - Walk_8F keyframes: 8
- Screenshots:
  - `artifacts/screenshots/ik_joint_timeline_validation_20260508_165341Z.png`
  - `artifacts/screenshots/play_visible_20260508_165906Z.png`
  - `artifacts/screenshots/female_import_ik_timeline_20260508_170018Z.png`
  - `artifacts/screenshots/pipeline_acceptance_20260508_170319Z.png`

Current blocking issue:
- None.

Next step:
- Manual refresh `http://localhost:8780/index.html`.
- Test with the target GLB:
  import GLB -> visual/mapped skeleton -> create IK -> drag hand/foot IK -> save frame -> select two saved frame ticks -> smooth segment -> play.

## Viewport Controls, Transparency, Timeline - 2026-05-09

Current objective:
- Make the current IK/motion step manually controllable and reduce visual obstruction from skeleton and IK controls. Keep the bottom timeline visible in one laptop-sized viewport.

Current progress:
- Added always-visible viewport opacity controls:
  - model opacity
  - skeleton opacity
  - IK/control opacity
- Added Command API commands:
  - `set_skeleton_opacity`
  - `set_control_opacity`
- Existing model opacity now has a second viewport slider wired through `set_model_opacity`.
- Reduced generated Humanoid skeleton visual weight:
  - thinner bone cylinders
  - smaller joint boxes
  - transparent basic materials
- Reduced imported source skeleton overlay visual weight:
  - thinner source bone cylinders
  - smaller source joint boxes
  - mapped labels only show when skeleton labels are enabled
  - labels are smaller and more transparent
- Reduced IK controller visual weight:
  - smaller pelvis ring, foot pads, hand cubes, pole triangles
  - separate control opacity controls both fill and wire opacity
  - invisible hit area keeps controls easy to pick even when visually small
- Added viewport IK dragging:
  - left-drag an IK controller to preview movement
  - on mouse release, the app restores the start snapshot and executes `set_ik_target`
  - command log records the final `set_ik_target` without flooding during drag
  - overlapping controls now pick the closest projected control to the cursor
- Added bottom timeline transport:
  - Play
  - Stop
  - current-frame scrubber
- Timeline panel is now fixed to the bottom of the main work area and stays visible at 1366x768.
- Fixed model disappearing after repeated renders by not disposing shared GLB geometry when clearing `modelGroup`.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `npm run validate:import`
- Playwright visual validation with `C:\Users\sigeryang\Downloads\female+figure+3d+model.glb`
- Playwright IK drag validation using projected `Pelvis_CTRL` screen position

Validation result: PASS

Validation details:
- Existing pipeline validation: PASS
- Timeline visible in 1366x768 viewport:
  - top: 650
  - bottom: 768
  - height: 118
- Viewport opacity panel visible.
- Opacity command state:
  - model opacity: `0.78`
  - skeleton opacity: `0.18`
  - control opacity: `0.22`
- Command log records:
  - `set_model_opacity`
  - `set_skeleton_opacity`
  - `set_control_opacity`
  - `set_ik_target`
- IK drag test:
  - target: `Pelvis_CTRL`
  - final command: `set_ik_target` success
- Screenshot:
  - `artifacts/screenshots/compact_controls_timeline_20260508_162122Z.png`

Current blocking issue:
- None.

Next step:
- Manual refresh `http://localhost:8780/index.html` and test left-dragging IK controls with the user's target GLB.

## Source Bone Driven Walk Direction - 2026-05-08

Current objective:
- Make Walk_8F drive the imported model's own source bones using the rig's actual T-Pose directions, instead of applying fixed global XYZ offsets to a generated overlay skeleton.

Current progress:
- Added runtime maps from imported source bone ids to their live `THREE.Bone` objects.
- Cached source-bone Rest local transforms and Rest world transforms during GLB import.
- Added rig-basis inference from mapped T-Pose joints:
  - right axis from mapped right/left side pairs.
  - up axis from Hips to Head / Chest.
  - forward axis from Foot to Toe direction, with fallback from right/up.
- Changed Walk_8F generation so foot stride, lift, pole targets, and arm swing are projected through the inferred rig basis.
- Changed the T-Pose walk start so arms are lowered from the imported model's T-Pose before walking.
- Added source-rig driving from Humanoid key pose joints back onto the imported source bones.
- Source skeleton overlay now reads live source-bone world positions, so it follows the driven rig.
- Added `window.__motionDebug.getSourceRigDebug()` for checking mapped source-bone rest/current transforms.
- Updated validation so side identity and pole target direction use the inferred rig basis instead of fixed global X/Z.
- Adjusted auto-mapping to prefer non-`Twist` main bones, while still allowing a `Twist` fallback when a model has no clean main joint.

Files changed:
- `app.js`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `npm run validate:import`
- Playwright source-rig direction check with `C:\Users\sigeryang\Downloads\female+figure+3d+model.glb`
- Playwright screenshot capture to `artifacts/screenshots/source_rig_walk_drives_model_20260508_160341Z.png`
- Playwright validation check:
  import GLB -> create SourceRig_v1 -> create IK controls -> apply Walk_8F -> validate motion

Validation result: PASS

Validation details:
- Female GLB source bones: 41
- GLB joints: 41
- Humanoid mapping: 19 / 19
- Runtime source bones cached: 41
- Rest transform cache: 41
- Final skeleton after IK: `Humanoid_v1`
- IK controls: 9 / 9
- Keyframes: 8 / 8
- Source rig max quaternion delta after Walk_8F: `0.7964`
- Right hand dropped along inferred up axis: `-0.2428`
- Left hand dropped along inferred up axis: `-0.2378`
- Validation report after source-rig walk: `Passed`

Current blocking issue:
- Browser plugin connection timed out during in-app-browser reload; Playwright validation against the same localhost app passed.

Next step:
- Manual browser refresh at `http://localhost:8780/index.html`.
- Re-test with the user's target GLB: import -> visual source skeleton -> confirm/adjust mapping -> create IK -> apply Walk_8F -> play.

## Bound Source Overlay And IK Conversion Fix - 2026-05-08

Current objective:
- Fix user feedback that mapped/imported source bones should not become large viewport boxes, and that Create IK Controls failed after creating `SourceRig_v1`.

Current progress:
- Reduced source joint handle size substantially.
- Reduced source bone segment thickness.
- Mapped source bones now show a small nearby Humanoid binding label instead of a large box.
- Selected source joint still highlights, but no longer dominates the character.
- `create_ik_controls` and `apply_motion_template` now call `ensureHumanoidSkeletonForAnimation()`.
- If the current skeleton is `SourceRig_v1` and the Humanoid mapping is complete (`19 / 19`), the app automatically rebuilds `Humanoid_v1` from mapped source bone T-Pose coordinates before creating IK controls.
- If mapping is incomplete, the command still blocks with a clear message.

Files changed:
- `app.js`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- Playwright check using `C:\Users\sigeryang\Downloads\female+figure+3d+model.glb`:
  import GLB -> create `SourceRig_v1` -> click Create IK Controls -> auto-convert to `Humanoid_v1` -> create 9 IK controls.
- `npm run validate:import`

Validation result: PASS

Validation details:
- Source bones: 41
- GLB joints: 41
- Humanoid mapping: 19 / 19
- Final skeleton after Create IK Controls: `Humanoid_v1`
- IK controls: 9 / 9
- Command log last entry: `create_ik_controls` success

Current blocking issue:
- None.

Next step:
- Add viewport drag mapping so users can drag standard joint names directly onto visible source joints in the viewport.

## Source Skeleton Viewport Overlay - 2026-05-08

Current objective:
- Restore the early-version skeleton display style for imported models with readable bones, so source bone structure is visible inside the mesh during the mapping stage.

Current progress:
- Added `sourceSkeletonGroup` rendered between the model and generated skeleton/IK overlays.
- When a GLB exposes source bones, the viewport now immediately draws the imported source skeleton before creating Humanoid_v1.
- Source skeleton uses the early-style colored bone segments and box joint handles:
  - Right side: warm color
  - Left side: cool color
  - Center: green
- Source bone overlay uses `depthTest: false`, so bones remain visible even when they are inside the character mesh.
- Increased source bone visual scale for readability.
- Added source bone picking:
  - left-click a source joint handle in the viewport to run `select_source_bone`
  - the selected source joint is highlighted yellow/white
  - the corresponding source bone row in the right panel is highlighted
  - the bone inspector shows source bone name, parent, length, side, and color rule before Humanoid_v1 is generated

Files changed:
- `app.js`
- `styles.css`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- Playwright import/overlay/pick check using `C:\Users\sigeryang\Downloads\female+figure+3d+model.glb`
- `npm run validate:import`

Validation result: PASS

Validation details:
- Source bones: 41
- GLB joints: 41
- Auto humanoid mapping: 19 / 19
- Source bone selection: selected `Root`, highlighted one source row, and updated bone inspector.

Current blocking issue:
- None.

Next step:
- Add direct drag/drop from viewport source joints to standard humanoid slots, so the user can map without relying only on the right-side list.

## Viewport Orbit Direction And Distance Lock - 2026-05-08

Current objective:
- Fix viewport navigation after user reported the mouse orbit direction felt reversed and orbit dragging changed zoom distance.

Current progress:
- Reversed orbit drag direction for both horizontal and vertical middle-mouse orbit.
- Added `navigationStartDistance` so orbit and pan lock camera distance for the full drag gesture.
- Wheel events are ignored while orbiting or panning, preventing accidental zoom during middle-mouse drag.
- Only mouse wheel or Ctrl + middle mouse drag changes camera distance.

Files changed:
- `app.js`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- Playwright camera interaction check:
  - right/down middle drag changes yaw/pitch in the corrected direction
  - orbit distance stays unchanged
  - pan distance stays unchanged
  - Ctrl + middle drag changes distance
  - mouse wheel changes distance
- `npm run validate:import`

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Hard refresh `http://localhost:8780/index.html` and test middle-mouse orbit manually.

## Static GLB Skeleton Diagnosis - 2026-05-08

Current objective:
- Explain and fix the case where the user's downloaded `police+officer+3d+model.glb` displays a character mesh but imports with zero readable bones.

Current progress:
- Parsed the actual GLB file at `C:\Users\sigeryang\Downloads\police+officer+3d+model.glb`.
- Confirmed the GLB JSON has:
  - generator: `Tripo`
  - nodes: 1
  - meshes: 1
  - skins: 0
  - joints: 0
  - animations: 0
- Added browser-side GLB diagnostics during import so the UI/debug summary exposes `skins`, `joints`, `nodes`, generator, and extracted source bone count.
- When a GLB has no `skins / joints`, the skeleton panel now states that no glTF skeleton was found instead of implying a silent failure.
- Changed `视觉辅助适配骨架` so it no longer fails on static mesh GLBs. If source bones are zero, it estimates a `Humanoid_v1` from the imported model's bounds and human proportions, sets model opacity to 50%, and moves to the IK stage.
- Verified the police model path:
  - source bones after import: 0
  - GLB skins: 0
  - GLB joints: 0
  - estimated Humanoid_v1 joints: 19
  - estimated Humanoid_v1 bones: 18
  - IK controls after estimate: 9

Files changed:
- `app.js`
- `README.md`
- `CURRENT_STATE.md`

Commands run:
- Direct Node GLB JSON parser for `C:\Users\sigeryang\Downloads\police+officer+3d+model.glb`
- `npm run check`
- Playwright import + visual estimate + IK check for the police model
- `npm run validate:import`

Validation result: PASS

Current blocking issue:
- The police GLB itself does not contain a standards-readable glTF skeleton. Any bones for this file must be estimated from mesh shape, or created by a separate rigging/auto-rigging step.

Next step:
- Improve mesh-based estimation beyond simple bounds: silhouette/landmark analysis for head, shoulders, elbows, wrists, hips, knees, ankles, and feet.

## SourceRig Visual Overlay Mode - 2026-05-08

Current objective:
- Add the user's requested second skeleton path: keep the imported model's original bone count and generate an adapted skeleton from the T-Pose source bones instead of forcing the default 19-joint Humanoid_v1.

Current progress:
- Added `create_source_skeleton_from_import` command.
- Skeleton stage now exposes two paths:
  - `默认 / 映射 Humanoid_v1` for IK, Walk_8F, validation, and export.
  - `视觉辅助适配骨架` for preserving imported source bone count and hierarchy.
- Importing a GLB now extracts source bones, parent ids, source world positions, side guesses, and an auto-suggested humanoid mapping.
- `视觉辅助适配骨架` sets model opacity to 50%, overlays source skeleton points, and creates `SourceRig_v1` using the imported T-Pose bone count and parent-child hierarchy.
- `SourceRig_v1` is intentionally blocked from IK / Walk_8F commands until mapped back to Humanoid_v1, so default animation flow remains stable.
- Updated debug summaries and export JSON to include source bones, humanoid mapping, and visual analysis metadata.
- Updated README with the two skeleton generation paths.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `npm run validate:import`
- Playwright GLB import + `create_source_skeleton_from_import` check using `sample_models/stylized_3d_character_model.glb`

Validation result: PASS

Validation details:
- Sample GLB source bones: 39
- Generated `SourceRig_v1` joints: 39
- Generated `SourceRig_v1` bones: 38
- Model opacity after visual overlay generation: 0.5
- Visual screenshot: `artifacts/screenshots/source_rig_visual_overlay_20260508_145534Z.png`

Current blocking issue:
- This is local geometry/overlay inference, not an external AI image-recognition model yet. It deliberately uses GLB source bones as the authoritative data and visual overlay as an assistive view.

Next step:
- Improve source-to-Humanoid mapping suggestions and allow clicking/dragging bones directly in the viewport.

## Blender-Style Viewport Navigation - 2026-05-08

Current objective:
- Make viewport camera controls follow Blender conventions instead of left-drag view rotation.

Current progress:
- Changed orbit to middle mouse drag.
- Changed pan to Shift + middle mouse drag.
- Changed zoom to Ctrl + middle mouse drag or mouse wheel.
- Kept Alt + left mouse drag as a fallback for trackpads or mice without a middle button.
- Left mouse is now free for future bone/control selection and direct manipulation.
- Updated viewport help text.

Files changed:
- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- Playwright camera interaction check:
  middle orbit, Shift+middle pan, Ctrl+middle zoom, wheel zoom, Alt+left orbit.

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Add viewport picking for bones and controls now that left click is available.

## IK Control Visual Cleanup - 2026-05-08

Current objective:
- Restore the IK controller visual style so controllers read as 3D handles instead of large blocking text labels.

Current progress:
- Disabled skeleton/control labels by default.
- Changed IK controls back to compact 3D visual handles:
  - `Pelvis_CTRL`: double green wire ring.
  - Foot IK: warm/cool foot pad with wire outline.
  - Hand IK: small warm/cool wire cube.
  - Pole targets: warm/cool triangular target.
- IK control labels now only appear when the `骨架标签` toggle is enabled.
- Shrunk label canvases, font size, world scale, and made labels depth-tested so they no longer draw permanently over the model.
- Captured visual validation screenshot:
  `artifacts/screenshots/pipeline_acceptance_20260508_143346Z.png`

Files changed:
- `index.html`
- `app.js`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `node --check scripts\validate_demo_import.mjs`
- `Invoke-WebRequest -UseBasicParsing http://localhost:8780/index.html`
- Playwright IK visual screenshot to `artifacts/screenshots/ik_controls_compact_20260508_143319Z.png`
- `npm run validate:import`

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Hard refresh `http://localhost:8780/index.html` so the browser picks up the smaller labels and restored controller handles.

## File Protocol Load Fix - 2026-05-08

Current objective:
- Fix the user-visible loading failure caused by opening `index.html` through `file://` instead of the local HTTP server.

Current progress:
- Confirmed `http://localhost:8780/index.html` returns HTTP 200.
- Added a `file://` guard in `index.html`; when the local server is reachable, the page shows a Chinese notice and redirects to `http://localhost:8780/index.html`.
- If the local server is not reachable, the notice explains that `start_demo.bat` must be run first.
- Updated `start_demo.bat` so it starts the server and opens the correct localhost URL automatically.
- Updated `README.md` with the safer startup behavior.

Files changed:
- `index.html`
- `styles.css`
- `start_demo.bat`
- `README.md`
- `CURRENT_STATE.md`

Commands run:
- `Invoke-WebRequest -UseBasicParsing http://localhost:8780/index.html`
- `npm run check`
- `node --check scripts\validate_demo_import.mjs`
- Playwright file-url redirect check from `file:///D:/codex%E9%AA%A8%E9%AA%BC%E7%BB%91%E5%AE%9A/index.html` to `http://localhost:8780/index.html`
- `npm run validate:import`

Validation result: PASS

Current blocking issue:
- None.

Next step:
- In the browser, refresh the current `file://` tab once, or directly open `http://localhost:8780/index.html`.
- For future runs, use `start_demo.bat` or `npm start` plus the localhost URL.

## Tutorial Video - 2026-05-08

Current objective:
- Create a short animated tutorial showing how to use the phase-one action generation pipeline.

Current progress:
- Added `scripts/create_tutorial_video.mjs`.
- Added `npm run tutorial:video`.
- The script opens `http://localhost:8780/index.html`, overlays Chinese captions and a visible cursor, then records:
  load test dummy -> create skeleton -> create IK controls -> apply walk template -> play -> validate -> export -> undo -> redo.
- Generated WebM tutorial video:
  `artifacts/videos/action_pipeline_tutorial_20260508_140439Z.webm`
- Converted the WebM to MP4 for easier playback:
  `artifacts/videos/action_pipeline_tutorial_20260508_140439Z.mp4`
- Updated README with the tutorial video command.

Files changed:
- `package.json`
- `scripts/create_tutorial_video.mjs`
- `README.md`
- `CURRENT_STATE.md`

Commands run:
- `node --check scripts\create_tutorial_video.mjs`
- `Invoke-WebRequest -UseBasicParsing http://localhost:8780/index.html`
- `npm run check`
- `npm run tutorial:video`
- `ffmpeg -y -i artifacts\videos\action_pipeline_tutorial_20260508_140439Z.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart artifacts\videos\action_pipeline_tutorial_20260508_140439Z.mp4`

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Watch `artifacts/videos/action_pipeline_tutorial_20260508_140439Z.mp4`.
- Re-run `npm run tutorial:video` whenever the UI changes and a fresh demo short is needed.

## Chinese UI Pass - 2026-05-08

Current objective:
- Translate the user-facing pipeline UI from English to Chinese while preserving required internal Command API names and exported JSON field names.

Current progress:
- Translated flow steps, status strip, viewport toggles, timeline labels, inspector panels, buttons, validation labels, undo/redo labels, and debug panel headings.
- Translated runtime status values such as loaded/missing/passed/issues/unsaved.
- Translated viewport skeleton and IK control display labels while keeping internal Humanoid_v1 joint/control IDs unchanged.
- Translated command log display names in the debug panel; internal command names still remain available through `executeCommand`.
- Updated README workflow labels to Chinese.

Files changed:
- `index.html`
- `app.js`
- `README.md`
- `CURRENT_STATE.md`

Commands run:
- `git status --short --branch`
- `git diff --stat`
- `rg -n ... index.html app.js README.md scripts/validate_demo_import.mjs`
- `npm run check`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Screenshot capture to `artifacts/screenshots/pipeline_acceptance_20260508_135949Z.png`.
- Screenshot capture to `artifacts/screenshots/pipeline_acceptance_20260508_140132Z.png`.

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Note: raw JSON keys and internal command IDs intentionally remain English because they are part of the required data/API contract.

## Pipeline Command Architecture Refactor - 2026-05-08

Current objective:
- Refactor the app away from a broad 3D editor surface into a phase-one action generation pipeline:
  Load Test Dummy -> Create Humanoid Skeleton -> Create IK Controls -> Apply Walk_8F Template -> Play -> Validate Motion -> Export Motion JSON -> Undo / Redo.

Current progress:
- Replaced the old editor-style `index.html` with a six-stage pipeline UI:
  Model, Skeleton, IK Controls, Motion Template, Validate / Fix, Export.
- Replaced the compact-editor CSS with pipeline-specific layout, status strip, timeline, inspector, viewport toggles, and Command API Debug panel.
- Replaced `app.js` with a command-driven MotionState implementation:
  - all primary UI actions call `executeCommand(createCommand(...))`.
  - implemented `command_log`, `undo_stack`, `redo_stack`, `validation_report`, and MotionState summary.
  - implemented Humanoid_v1 fixed naming, 9 IK controls, Walk_8F key poses, playback, validation, export/import JSON, undo, redo.
- Routed stage buttons, timeline frame buttons, and view toggles through Command API commands instead of direct state mutation.
- Added automatic stage progression for the first-phase pipeline:
  Load -> Skeleton -> IK -> Motion -> Validate -> Export.
- Replaced the old GLB/editor regression script with a pipeline acceptance script.
- Updated `README.md` to describe the new first-phase pipeline instead of the old editor feature list.

Files changed:
- `README.md`
- `index.html`
- `styles.css`
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `git status --short --branch`
- `git diff --stat`
- `Get-Content -Encoding utf8 README.md`
- `Get-Content -Encoding utf8 CURRENT_STATE.md`
- `npm run check`
- `node --check app.js`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Screenshot capture to `artifacts/screenshots/pipeline_acceptance_20260508_135122Z.png`.

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Use the pipeline in order; check Command API Debug to confirm every action is logged.
- Next engineering layer should improve command boundaries and tests, not add new features.

## Compact Laptop UI - 2026-05-08

Current objective:
- Shrink the overall UI so the app is usable on a small laptop screen and the main model view, right controls, and timeline can fit in one browser viewport.

Current progress:
- Removed the remaining forced small-screen minimum layout width.
- Added responsive global UI scaling for shorter screens.
- Compressed top controls, HUD cards, timeline rows, keyframe records, and frame ticks.
- Compressed right-side tool cards, inputs, toggles, mapping rows, and status blocks.
- Made the humanoid mapping list internally scrollable so the right panel no longer grows uncontrollably.
- Added collapsible right-panel tool cards; low-frequency modules default collapsed on laptop screens, and mode switching expands the matching tool card when needed.
- Tuned the 1366x768 compact layout so the main shell, timeline, right panel, and every right-panel module header fit in the first viewport.
- Preserved existing humanoid mapping, quick Pose, weight, walk-template, and timeline controls.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `CURRENT_STATE.md`

Commands run:
- `git status --short --branch`
- `git diff --stat`
- `Get-Content -Encoding utf8 README.md`
- `Get-Content -Encoding utf8 CURRENT_STATE.md`
- `Get-Content -Encoding utf8 styles.css`
- `npm run check`
- `node --check scripts\validate_demo_import.mjs`
- Screenshot capture to `artifacts/screenshots/compact_ui_20260508_125648Z.png`.
- Screenshot capture to `artifacts/screenshots/compact_ui_collapsed_20260508_130021Z.png`.
- Screenshot capture to `artifacts/screenshots/compact_ui_final_20260508_130123Z.png`.
- `npm run validate:import`

Validation result: PASS

Current blocking issue:
- None.

Next step:
- Hard refresh `http://localhost:8780/index.html` and use the small arrow on each right-panel card title to expand low-frequency tools when needed.

## Humanoid Mapping, Quick Pose, Timeline Editing - 2026-05-08

Current objective:
- Add the first stable layer of human rig mapping, Cascadeur-style quick pose helpers, and timeline editing while preserving existing GLB import, pose, weight, and walk-template behavior.

Current progress:
- Added a right-panel `人形映射` section:
  - auto maps Hip / Spine / Chest / Neck / Head and left/right arm, forearm, hand, thigh, calf, foot roles.
  - allows manual role correction with joint dropdowns.
  - confirms mapping and stores character forward/right/up axis overrides.
  - mapping is now used by character basis, mirror direction, walk direction, support checks, and role lookup.
- Fixed side-name detection so names like `lower_arm.R` and `lower_leg.R` no longer get mistaken for left-side bones because they start with `lower`.
- Added a `neck` segment to the built-in human template, so the template can map all 17 human roles.
- Added a right-panel `快速 Pose` section:
  - left/right hand and foot IK target buttons select the mapped endpoint and switch to Pose translate control.
  - left/right foot lock toggles keep the foot target fixed through IK during pose/playback updates.
  - copy/paste pose snapshots.
  - mirror pose by swapping mapped left/right limb local transforms.
  - reset mapped limb/body roles to rest/base pose.
  - support-foot and balance status text.
  - previous/next keyframe ghost line preview.
- Upgraded the timeline:
  - delete current keyframe.
  - copy keyframe.
  - paste copied keyframe to current frame.
  - move keyframe backward/forward.
  - per-keyframe interpolation: linear / smooth / hold.
  - playback speed slider.
  - import current model animation Clip into editable timeline keyframes when the loaded GLB contains animations.
- Made `scripts/validate_demo_import.mjs` portable:
  - it now falls back to `sample_models/stylized_3d_character_model.glb` if the old `C:\Users\bodean\Downloads\...` path does not exist.
  - added regression checks for humanoid mapping, quick Pose helpers, and timeline editing.

Files changed:
- `app.js`
- `index.html`
- `styles.css`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Commands run:
- `npm run check`
- `node --check scripts\validate_demo_import.mjs`
- `npm run validate:import`
- Headless Edge smoke test for humanoid mapping / IK / timeline edit debug APIs.
- Screenshot capture to `artifacts/screenshots/humanoid_pose_timeline_20260508_2035.png`.

Validation result: PASS

Current blocking issue:
- None for this implementation pass.
- Note: the bundled stylized test GLB exposes no separate Neck joint, so imported-model auto mapping reports 16/17 roles. The built-in template maps 17/17 after the new neck segment. The user can manually map Neck if a model exposes it.

Next step:
- Manually open `http://localhost:8780/index.html`, hard refresh, load the test model, and inspect the new `人形映射`, `快速 Pose`, and timeline edit controls.
- Next useful feature layer is real GLB animation export from the edited keyframes.

## Local Run Fix - 2026-05-08

Current objective:
- Restore local usability after the app was opened directly through `file:///D:/codex骨骼绑定/index.html`.

Current progress:
- Confirmed the project is designed to run through a local static server, not direct `file://`.
- Installed npm dependencies with `npm install`; `node_modules/three` is now present.
- Started a hidden Python static server from `D:\codex骨骼绑定` on `http://localhost:8780/index.html`.
- Server logs are written under `logs/http_server_20260508_201443*.log`.
- Reverted an incomplete in-progress UI addition in `index.html` so the currently opened app stays on the previous stable functional surface.

Files changed:
- `CURRENT_STATE.md`
- `package-lock.json` and `package.json` unchanged by content; `node_modules/` installed locally and ignored by Git.

Commands run:
- `npm install`
- `Start-Process python -ArgumentList @('-m','http.server','8780') ...`
- `Invoke-WebRequest http://localhost:8780/index.html`
- `npm run check`
- Headless Edge smoke test against `http://localhost:8780/index.html`

Validation result: PASS

Current blocking issue:
- Codex in-app browser automation could not attach to the current in-app browser backend, so the tab was not navigated automatically.

Next step:
- In the in-app browser address bar, open `http://localhost:8780/index.html` instead of the current `file://` URL.
- After this local run issue is confirmed fixed, continue the planned human mapping / quick Pose / timeline upgrade work.

## GitHub Handoff Upload - 2026-05-08

Current objective:
- Upload the completed MVP and handoff documentation to `https://github.com/Siger1989/gugebangdign`.

Current progress:
- Created `HANDOFF.md` with project positioning, run steps, implemented features, validation results, limitations, and next-phase recommendations.
- Added `.gitignore` to exclude `node_modules/`, `artifacts/`, logs, and OS metadata.
- Synced project files into a clean clone at `E:\codex骨骼软件_github_publish`.
- Committed and pushed:
  - repository: `https://github.com/Siger1989/gugebangdign`
  - branch: `main`
  - commit: `fdf7e69 Add action rig adjustment MVP`

Validation:
- `npm run check`: PASS before upload.
- Full `npm run validate:import`: PASS before handoff.
- Git push to `origin/main`: PASS.

Next step:
- Continue future work from `E:\codex骨骼软件` locally or clone the GitHub repository.
- For the next phase, prioritize real GLB animation/weight export and Electron EXE packaging.

## Pose G Keep-Length Default And Stretch Toggle - 2026-05-08

Current objective:
- Fix Pose mode `G` moving a middle joint so it does not stretch bones by default.
- Keep the skinned model following the actual skeleton when middle joints move.
- Provide an explicit option for workflows that intentionally allow bone-length stretching.

Current progress:
- Added a right-panel toggle: `允许 G 拉长骨骼`.
- Default unchecked behavior:
  - `G` on a middle joint uses IK-style movement.
  - incoming/outgoing bone lengths are preserved.
  - source bones rotate, so the model follows through the real GLB skeleton.
  - same-side chain isolation prevents the opposite leg from moving.
- Toggle checked behavior:
  - middle-joint `G` explicitly allows length change.
  - the incoming source bone rotates and scales toward the moved joint.
  - the skinned model follows the stretched source bone instead of leaving the mesh behind.
- Added debug helpers:
  - `setAllowPoseStretch(value)`
  - `getPoseMoveModeInfo()`
- Removed the duplicated weight-target status update.
- Added `HANDOFF.md` and `.gitignore` for GitHub handoff.

Validation:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- User GLB targeted checks:
  - default `R_Calf` G move: `R_Thigh` length delta `0.0000000018`, `R_Calf` length delta `0.0000000031`.
  - right foot/lower branch follows: foot delta `0.483756`.
  - opposite foot stays isolated: `L_Foot` delta `0`.
  - stretch toggle enabled: incoming length delta `0.011464`, child branch/model follow delta `0.477754`, confirming stretching is opt-in and model follows.

Next step:
- Hard refresh the browser.
- Keep `允许 G 拉长骨骼` off for normal posing.
- Only enable it when intentionally editing bone proportions/lengths.

## Transform Priority, IK Isolation, And Foot Weight Target - 2026-05-08

Current objective:
- Make rotate rings easier to click when they overlap skeleton controls.
- Prevent right-leg end-effector dragging from pulling the opposite leg or central hip chain.
- Make terminal foot joint weight preview target the foot, not the incoming calf segment.

Current progress:
- Canvas pointer picking now gives active TransformControls handles priority over joint/bone picking outside weight paint mode.
- Added pointer-priority debug helpers for transform handle overlap checks.
- Limited pose IK chain traversal to same-side limb segments with a shorter default chain, so dragging `R_Foot` no longer rotates/moves hip or `L_*` bones.
- Weight selection now distinguishes clicked joint targets from clicked bone segments:
  - selecting a bone segment still previews that segment's source weights.
  - selecting a terminal joint such as `R_Foot` previews `R_Foot` weights.
  - the weight target dropdown can show terminal joint weight targets.

Validation:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Added regression checks:
  - transform ring priority wins even when a joint/bone is underneath.
  - dragging `R_Foot` moves the selected foot while `L_Foot`, `L_Calf`, and `Hip` stay at `0` delta.
  - selecting `R_Foot` in weight mode reports `R_Foot` as the selected influence and does not include `R_Calf`.

Next step:
- Hard refresh the browser.
- Test the inner rotate ring on overlapping joints, then drag a right foot/leg end point with `G`.
- In weight mode, click the foot joint and confirm the preview label/area is foot-specific.

## Pose Middle Joint Downstream Move - 2026-05-08

Current objective:
- When dragging a middle joint in Pose mode, avoid moving the upstream chain.
- Make the selected middle joint mainly affect itself and its child branch.

Current progress:
- Changed Pose-mode joint `G` behavior:
  - If the selected joint has child bones, `G` now moves the selected joint and its downstream branch.
  - The upstream parent joint stays fixed.
  - End joints with no child bones still use the previous rope/IK behavior.
- For imported GLB skeletons, downstream movement writes to the selected source bone's local position, so the skinned lower branch follows without moving upper source bones.
- Fallback editor skeletons use the same downstream branch translation on visible joints.
- Updated the modal transform label decision so middle joints no longer report the rope/IK behavior.

Validation:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Middle joint downstream validation on the user's GLB:
  - selected joint: `R_Calf`.
  - upstream `R_Thigh` joint delta: `0`.
  - middle `R_Calf` joint delta: `0.239068192164245`.
  - child branch endpoint delta: `0.23906819216424502`.
  - undo delta: `0`.
- End-effector rope/IK validation for `R_Hand` still passes.

Next step:
- Hard refresh the browser.
- In Pose mode, select a middle joint such as knee/elbow/forearm start, press `G`, and drag.
- The parent/upstream side should stay in place while the selected point and its child branch move.

## Adjustable Skeleton Display Size - 2026-05-08

Current objective:
- Let the user adjust the visible skeleton control size and thickness from the UI.

Current progress:
- Added two sliders in the skeleton panel:
  - `骨骼粗细`: controls visible bone segment thickness on X/Z without changing bone length.
  - `节点大小`: controls joint cube/socket/rotation-arrow display scale.
- The sliders update live through `syncSkeletonMeshes()`.
- Bone segment length remains driven by joint distance; only display thickness changes.
- Joint hit/control groups scale with the visible node size.
- Added debug validation helpers:
  - `setBoneDisplaySize()`
  - `getDisplaySizeInfo()`

Validation:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Display size validation:
  - default bone scale: `[1, 1.0142858754728858, 1]`.
  - changed `骨骼粗细` to `1.55`, bone X/Z scale became `1.55`.
  - changed `节点大小` to `1.42`, joint scale became `1.42`.
  - restored both to `1.00`.

Next step:
- Hard refresh the browser.
- In the right skeleton panel, adjust `骨骼粗细` and `节点大小` to tune the visual control size for the current zoom/model.

## Weight Brush Selection Workflow And Performance - 2026-05-08

Current objective:
- Fix weight brush mode so it does not immediately start painting when entered.
- Make the brush visible only when the user explicitly switches to brush mode.
- Reduce weight painting lag on the user's high-poly GLB.
- Soften brush edges and make selected/other-bound weight areas visually distinct.

Current progress:
- Added a two-step workflow in the weight panel:
  - `选择骨骼`: default when entering weight mode.
  - `涂刷权重`: only this mode shows the brush cursor and paints.
- Added a `目标骨骼` dropdown populated from the editable skeleton bones.
- Clicking a skeleton bone/joint in weight mode selects the target instead of painting immediately.
- Weight preview now uses the real imported `SkinnedMesh` vertex skin data:
  - model switches to neutral vertex-color preview in weight mode.
  - selected target influence is shown with bright weight colors.
  - other bound vertices remain a separate blue color.
- Selected influence is now aggregated across hidden child/twist bones between editor bones.
  - Example: `R_Upperarm` preview includes `R_Upperarm`, `R_UpperarmTwist01`, and `R_UpperarmTwist02`.
- Brush cursor:
  - hidden in `选择骨骼`.
  - visible in `涂刷权重`.
  - radius follows the radius slider.
- Painting performance:
  - Added a per-mesh spatial cache for skinned vertex world positions.
  - Brush updates only vertices inside nearby spatial buckets instead of scanning/recoloring all `475640` vertices every mouse move.
  - Recolors only affected vertex indices after a stroke.
- Brush falloff changed from hard/linear edge to a smoother falloff curve.
- The old random point cloud is now labeled as `显示调试点云` and remains off by default.

Validation:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- User GLB weight preview validation:
  - `skinnedMeshes`: `1`.
  - `colorAttributeCount`: `475640`.
  - default weight tool mode after entering paint: `select`.
  - brush hidden in select mode: `true`.
  - brush visible after switching to brush mode: `true`.
  - selected influence label: `R_Upperarm`.
  - selected influence bones: `R_Upperarm`, `R_UpperarmTwist01`, `R_UpperarmTwist02`.
  - selected vertices: `49854`.
  - other bound vertices: `425786`.

Next step:
- Hard refresh the browser.
- Enter `权重笔刷`; first choose a bone from `目标骨骼` or click a visible skeleton bone.
- Switch to `涂刷权重` only when ready to paint.
- Manual feel test: brush should be much less laggy after the first spatial-cache build, and the edge should fade instead of cutting sharply.

## Mirror Axis, Frame HUD, And Rotate Start Stabilization - 2026-05-08

Current objective:
- Fix mirror direction confusion on the imported character.
- Make the current frame save/edit status visible without relying only on the bottom timeline.
- Remove the first-frame jitter when starting `R` rotate near the selected pivot.

Current progress:
- Added a `镜像方向` selector in the skeleton panel:
  - `角色左右` is the default and uses the imported character's derived left/right axis.
  - `角色前后`, `世界 X`, and `世界 Z` are available when the automatic axis is not what the user wants.
- Changed `mirrorSelectedBranch()` from fixed world-X mirroring to plane reflection around the selected mirror axis and hip/root center.
- Improved mirror naming for common rig names:
  - `R_Upperarm` mirrors to `L_Upperarm`.
  - `L_`, `R_`, `_L`, `_R`, `Left`, and `Right` naming patterns are handled.
- Added an `动作前向` selector in the action parameter panel:
  - `角色前方`, `角色后方`, `角色右侧`, and `角色左侧`.
  - Walk contact markers and the `前` arrow follow this selected motion basis.
- Added a fourth viewport HUD card: `当前帧`.
  - It shows `N 未保存` or `N 已保存`.
  - Saved current frames turn green, so frame editing state is visible even when the bottom area is low on screen.
- Stabilized Blender-style `R` modal rotate:
  - Canvas hover now records the latest mouse position while idle.
  - Drag/orbit math no longer overwrites `lastPointer` before computing `dx/dy`.
  - If rotate starts very close to the pivot, the first movement uses linear rotation instead of an unstable screen-angle jump.
- Added debug validation helpers for mirror plane, selected joint info, frame HUD state, and modal rotate start radius.

Validation:
- `node --check app.js`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- User GLB mirror validation:
  - selected `R_Upperarm`.
  - default mirror axis: `角色左右轴`.
  - mirrored joint name: `L_Upperarm`.
  - side-axis movement: `0.3375109690078377`.
  - front/back leakage: `6.938893903907228e-18`.
- Frame HUD validation:
  - before save: `12 未保存`.
  - after save: `12 已保存`.
  - frame 25 without keyframe: `25 未保存`.
- Rotate start validation:
  - near-pivot start radius: `1.4142135623730951`.
  - near-pivot test rotation amount: `0.6`, confirming the linear path is used instead of angle snapping.
- Existing interaction validation still passes:
  - middle/right style orbit changes yaw/pitch.
  - Shift+middle pan changes target only.
  - manual keyframe playback still moves the imported GLB.

Blocked:
- Codex in-app browser automation timed out twice while reconnecting/reloading the tab.
- Independent Edge/Playwright validation succeeded against `http://localhost:8780/index.html`.

Next step:
- Hard refresh the in-app browser.
- Test `镜像方向 = 角色左右` on an arm/leg branch; it should no longer mirror front/back.
- Press `R` while the cursor is close to the selected joint; rotation should start smoothly without the initial twitch.

## Walk Template Character Direction And Rough Pose - 2026-05-08

Current objective:
- Fix action template direction so the forward/walk direction matches the imported character instead of a fixed world axis.
- Make action templates auto rough-adjust the imported T pose before playback.

Current progress:
- Added `getCharacterBasis()`:
  - averages left/right leg and arm joints.
  - derives character right direction from right-side joints minus left-side joints.
  - derives character forward direction from `up x right`.
- Updated foot contact disks:
  - left/right offsets use character right direction.
  - forward/back offsets use character forward direction.
- Added a visible `前` walk direction helper arrow so template forward is separate from world XYZ axes.
- Updated procedural source-walk pose:
  - thigh/calf swing rotates around character right axis.
  - upper arms are first auto-dropped from T pose toward a rough walking pose.
  - arm swing is layered on top of the rough arm drop.
- Editor fallback walk motion also uses character forward instead of world Z.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- User GLB direction validation:
  - derived right: `[-0.14103227196143606, 0, 0.9900049991113153]`.
  - derived forward: `[0.9900049991113153, 0, 0.14103227196143606]`.
  - right/forward dot: `0`.
  - walk direction helper visible: `true`.
- Rough procedural motion validation:
  - `R_Upperarm` endpoint delta: `0.0638734941016602`.
  - `R_Thigh` endpoint delta: `0.12466244421959022`.

Next step:
- Hard refresh the browser.
- Generate/play the walk template; the `前` arrow and contact disks should follow the character's actual forward direction.
- The generated template should no longer start as a pure T pose; arms should be roughly dropped into a walking stance.

## Weight Points Visibility Control - 2026-05-08

Current objective:
- Explain and remove the dense small colored dots from normal pose/action editing views.

Current progress:
- The dense colored dots are the weight brush demo point cloud.
- Added `显示权重点` toggle in the `权重笔刷` panel.
- Weight points are hidden by default.
- Weight points only show when:
  - current mode is `权重笔刷`
  - `显示权重点` is enabled
- Pose, Build, and Motion modes now keep weight points hidden even if the toggle is enabled.
- Added debug helpers for weight point visibility validation.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Weight point validation:
  - count: `210`.
  - Pose default visible: `false`.
  - Pose with toggle enabled visible: `false`.
  - Paint mode with toggle enabled visible: `true`.
  - Motion mode with toggle enabled visible: `false`.

Next step:
- Hard refresh the browser.
- In Pose/Action modes the colored dots should disappear.
- Switch to `权重笔刷` and enable `显示权重点` only when checking the weight demo.

## View Orbit Vertical Direction Flip - 2026-05-08

Current objective:
- Fix the viewport/model orbit vertical drag direction while keeping horizontal drag unchanged.

Current progress:
- Changed orbit pitch mapping in `onPointerMove`:
  - before: `pitch -= dy * 0.004`
  - now: `pitch += dy * 0.004`
- Horizontal orbit remains:
  - `yaw -= dx * 0.006`
- Updated interaction validation to expect:
  - dragging right makes yaw decrease.
  - dragging down makes pitch increase.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Interaction validation:
  - middleYawDelta: `-0.7800000000000002`
  - middlePitchDelta: `0.15999999999999998`
  - left drag still does not rotate.
  - Shift+middle pan still changes target only.

Next step:
- Hard refresh the browser.
- Manual check: middle/right/Alt-left drag up/down; vertical orbit should now feel reversed from the previous build.

## Visible Keyframe Record List - 2026-05-08

Current objective:
- Make it obvious which frames have been recorded, even when the lower frame grid is partly hidden by the browser window.

Current progress:
- Added a permanent `已记录帧` row above the timeline track.
- Saved frames render as clickable frame-number badges.
- Badge colors reuse contact meaning:
  - blue: left contact
  - amber: right contact
  - green: saved/generated record
- The active recorded frame gets a white highlight.
- Current frame now shows explicit save state:
  - `第 N 帧已保存`
  - `第 N 帧未保存`
- Clicking a recorded frame badge jumps directly to that frame and applies its pose.
- Validation debug output now includes `recordButtons` and `currentFrameSaveState`.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Timeline validation:
  - before save: `第 12 帧未保存`.
  - after save: `recordButtons: [12]`.
  - after save: `第 12 帧已保存`.
  - after selecting frame 25: `第 25 帧未保存`.

Next step:
- Hard refresh the browser.
- Save frame 10/12/etc.; confirm the `已记录帧` row shows those frame numbers immediately.

## Procedural Walk Drives Imported GLB - 2026-05-08

Current objective:
- Fix playback in `动作模板` mode where only the two foot contact disks moved while the imported character stayed still.

Current progress:
- Found the real cause:
  - HUD could show `关键帧 0`.
  - Playing with no saved keyframes used the procedural walk fallback.
  - That fallback only updated helper/contact marker state and did not drive imported GLB source bones.
- Fixed `播放`:
  - If there are zero keyframes, playback now auto-generates the walk template first.
- Fixed generated walk template:
  - Each generated keyframe now captures real GLB source bone transforms.
  - Playback interpolates these source transforms.
- Fixed procedural fallback:
  - Stores imported source bone rest pose.
  - Applies procedural leg/arm/hip motion directly to real GLB source bones.
  - Supports imported names like `R_Upperarm`, `R_Thigh`, `R_Calf`, not only demo names like `upper_arm.R`.
- Restored `findJointByName()` compatibility after role-based name matching, fixing an initialization error.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Procedural walk validation on the user's GLB:
  - `R_Thigh` endpoint delta: `0.12474398180045057`.
  - `R_Upperarm` endpoint delta: `0.01237241875915847`.
  - Both are real source-bone-driven movement, not just contact disk movement.
- Existing manual keyframe playback still passes:
  - frame 12 endpoint delta: `0.08837001512776453`.
  - interpolated frame 6 endpoint delta: `0.04042471816190665`.

Next step:
- Hard refresh the browser.
- Press `播放` with `关键帧 0`; it should auto-generate walk keys and move the character, not only the foot contact disks.

## Manual Keyframe Playback And Joint R Pivot - 2026-05-08

Current objective:
- Fix manual keyframe playback so a two-frame edited pose actually moves during playback.
- Fix selected joint `R` rotation so the pivot stays on the selected joint, not the previous parent joint.

Current progress:
- `保存当前帧` now stores:
  - visible editor joint positions
  - real imported GLB source bone local position/quaternion/scale
- Playback now checks for saved pose keyframes.
  - If saved pose keyframes exist, playback interpolates between adjacent saved frames.
  - Source bone quaternions use slerp; positions/scales use lerp.
  - If no manual pose keyframes exist, it still falls back to the procedural walk preview.
- Exact frame selection now restores saved frame poses.
- Joint rotation in Edit fallback now transforms the selected joint branch around the selected joint.
- Pose joint rotation fallback no longer routes through the incoming parent bone path.
- Added debug validation for selected-joint rotate pivot and manual keyframe playback.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- User model operation validation using `C:\Users\bodean\Downloads\stylized+3d+character+model.glb`:
  - saved frame `1`.
  - rotated `R_Forearm` and saved frame `12`.
  - frame 12 endpoint delta: `0.08837061566885088`.
  - interpolated frame 6 endpoint delta: `0.04042499249158203`.
- Joint rotate pivot validation:
  - selected joint: `R_Hand`.
  - pivotToJoint: `0`.
  - pivotToBoneStart: `0.23395880464849803`.

Blocked:
- Headless screenshot captured a blank WebGL canvas, so visual screenshot is not useful; numeric browser validation passed.

Next step:
- Hard refresh the in-app browser.
- Manual check: save frame `1`, change pose on frame `12`, save, press `播放`. The character should move between the two saved poses.
- Manual check: select a joint and press `R`; the ring/pivot should sit on that selected joint.

## Timeline Frame Selection - 2026-05-08

Current objective:
- Let the user choose an exact animation frame from the bottom timeline.

Current progress:
- Added a current-frame selector in the timeline header:
  - previous frame button
  - numeric frame input
  - range slider
  - next frame button
- Rendered all frames `1` through `25` as clickable frame ticks on the timeline.
- Clicking an empty area of the track selects the nearest frame.
- `保存当前帧` now saves to the explicitly selected frame.
- `生成走路` still creates the 24-frame loop keys and uses frame `25` as the loop endpoint.
- Added `selectFrame()`, frame clamping, frame-to-phase conversion, playback stop-on-manual-select, and timeline debug helpers.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Timeline validation:
  - selected frame `12`.
  - numeric input and range input both updated to `12`.
  - timeline rendered `25` clickable ticks.
  - saved keyframe landed on frame `12`.
  - selected loop endpoint frame `25`.

Blocked:
- In-app browser plugin reconnect timed out during visual confirmation, but headless browser validation passed.

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Manually check bottom timeline: click a frame number, type a frame number, drag the slider, then press `保存当前帧`.

## Pose G Rope IK Move - 2026-05-08

Current objective:
- Make Pose mode `G` move a selected joint without changing any bone length, like pulling a rope.

Current progress:
- Pose joint translate now uses a FABRIK-style IK solve over up to 3 parent segments.
- `G` moves the target joint in screen/world translate space.
- Segment lengths are measured from transform start and preserved.
- Imported GLB source bones are rotated to match the IK result, so the skinned mesh follows the visible skeleton.
- Transform start snapshots now include source bone transforms and world quaternions, keeping modal update, cancel, and undo stable.
- Removed the previous Pose joint `G` camera-axis rotation behavior; `R` remains the rotation operation.

Validation:
- `npm run check`: PASS.
- `node --check scripts\validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Pose joint IK validation:
  - selected `R_Hand`.
  - parentEndDelta: `0.0872222637348498`
  - childEndDelta: `0.16784513987466326`
  - parentLengthDelta: `3.661789677034122e-8`
  - childLengthDelta: `5.223033949786071e-10`
  - undoDelta: `0`

Next step:
- Hard refresh the browser.
- Manual check: Pose mode select a hand/wrist joint, press `G`, then drag. The arm should follow without changing upper/forearm length.

## Transform Control Ring Opacity - 2026-05-08

Current objective:
- Make the internal transform control rings respond to the skeleton opacity slider.

Current progress:
- `骨骼透明` now controls:
  - visible skeleton meshes
  - joint boxes/sockets/arrows
  - bone outlines/glow
  - Three.js TransformControls arrows
  - Three.js TransformControls rotation rings
  - internal helper/control circles
- Added `applyTransformControlOpacity()`.
- The function updates TransformControls gizmo/helper material `_opacity` values, because TransformControls resets material opacity internally during render.
- Added debug/validation helpers to set bone opacity and inspect transform control opacity.

Validation:
- `npm run check`: PASS.
- `node --check scripts/validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Transform control opacity validation:
  - before max opacity at slider `0.78`: `0.78`
  - after max opacity at slider `0.25`: `0.25`
  - before min opacity: `0.195`
  - after min opacity: `0.0625`

Next step:
- Hard refresh the browser.
- Move `骨骼透明` and confirm the rotation rings/control circles fade with the rest of the skeleton.

## Thin Bones And Opacity Controls - 2026-05-08

Current objective:
- Make the skeleton visually thinner/smaller and add adjustable transparency for both the character and skeleton.

Current progress:
- Added UI sliders:
  - `人物透明`: controls imported GLB model opacity and fallback ghost model opacity.
  - `骨骼透明`: controls skeleton body, collars, plugs, joint boxes, sockets, outlines, and direction arrows.
- Reduced visual skeleton dimensions:
  - embedded bone radius reduced from `0.082` to `0.043`.
  - joint cube reduced from `0.118` to `0.074`.
  - joint horizontal arrow shaft/head reduced.
  - bone collars/plugs reduced.
- Kept invisible hit areas wider than the visual geometry:
  - `jointHitArea`
  - `boneHitArea`
  This keeps click selection usable even though the visible bones are thinner.
- Imported model materials now use `state.modelOpacity` instead of a hard-coded `0.82`.
- The old `半透明模型` button now toggles the model opacity slider between `0.58` and `0.28`.
- Right panel now allows vertical scrolling if the viewport is too short, so new controls are not clipped.

Validation:
- `npm run check`: PASS.
- `node --check scripts/validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Existing validations still pass with the smaller visible geometry:
  - GLB import
  - pose transform
  - modal transform/cancel
  - joint/bone control detection
  - Ctrl+Z undo
  - selection and viewport interaction

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Manual tune the default `人物透明` and `骨骼透明` values if the model still feels too opaque or the skeleton still feels too strong.

## View Orbit Direction Flip - 2026-05-08

Current objective:
- Fix viewport orbit direction so the visible scene rotation follows the mouse drag direction.

Current progress:
- Reversed orbit yaw and pitch signs in `onPointerMove`.
- Middle/right/Alt+left drag now applies:
  - `yaw -= dx * 0.006`
  - `pitch -= dy * 0.004`
- Validation now asserts the new direction:
  - dragging right/down with middle mouse produces negative yaw/pitch deltas.

Validation:
- `npm run check`: PASS.
- `node --check scripts/validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Interaction validation:
  - middleYawDelta: `-0.7800000000000002`
  - middlePitchDelta: `-0.16000000000000003`
  - pan still changes target only, with panAngleDelta `0`.

Next step:
- Hard refresh the browser.
- Manual check: drag the scene right/down with middle mouse or right mouse; the visible model/grid should now rotate in the expected direction.

## G Move Keeps Joint Orientation - 2026-05-08

Current objective:
- Fix the issue where pressing `G` and dragging a joint left/right appeared to rotate the joint because the horizontal direction arrow changed.

Current progress:
- Joint orientation is now stored as independent data on each joint.
- Joint horizontal rotation arrows no longer derive their direction from the current bone segment line every frame.
- `G` / translate in Edit mode changes joint position only.
- `R` / rotate and Pose source-bone rotation are the operations that update joint orientation.
- Imported GLB joints initialize their orientation from the real source bone's world quaternion.
- Undo snapshots now include joint orientations.

Validation:
- `npm run check`: PASS.
- `node --check scripts/validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Build-mode `G` move validation:
  - selected `R_Hand`.
  - position delta after `G` move: `0.35279999999999995`.
  - joint orientation delta after `G` move: `0`.
  - undo position delta: `0`.

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Manual check: select a joint in Edit mode, press `G`, move left/right. The joint and connected bone segment should move, but the horizontal rotation arrow should keep its angle.

## Rotation Direction, XYZ Axes, Pan, Undo - 2026-05-08

Current objective:
- Fix modal rotation direction, add XYZ world axes, reduce viewport navigation blind spots, and add Ctrl+Z undo.

Current progress:
- `R` modal rotation now uses the mouse angle around the selected screen-space pivot.
  - Moving around the selected point clockwise/counter-clockwise maps to the same visual rotation direction.
  - The old direct `dx` rotation path was replaced for unconstrained rotation.
- Pose-mode joint `G` no longer translates the parent/previous bone.
  - When a joint is selected in Pose mode, `G` rotates the joint's child/source bone around the camera axis.
  - The previous bone endpoint stays fixed.
- View navigation:
  - middle/right/Alt+left drag rotates view.
  - Shift+middle/right/Alt+left drag pans view.
  - wheel zoom range is wider: `0.85` to `14`.
  - vertical pitch range is wider: `-1.35` to `1.35`.
  - reset camera also resets the camera target.
- Added world coordinate helper:
  - red X axis
  - green Y axis
  - blue Z axis
  - axis labels render near the ground origin.
- Added `Ctrl+Z` / `Cmd+Z` undo stack for:
  - generated child bones
  - mirrored/deleted branches
  - template/new root/clear
  - keyframe/template/smoothing changes
  - modal and gizmo transforms
- Skeleton display is now more embedded:
  - bone segments use an embedded tapered body, start collar, and end plug.
  - joints use a socket and a horizontal rotation arrow marker.

Validation:
- `npm run check`: PASS.
- `node --check scripts/validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- `R` modal direction validation:
  - selected `R_Forearm`
  - right-of-pivot to below-pivot mouse path produced `1.5707963267948966` radians.
  - bone endpoint moved `0.21266253082526385`.
- Pose joint `G` validation:
  - parent end delta: `0`
  - child end delta: `0.2572620359888276`
  - undo delta: `0`
- View validation:
  - left drag does not rotate.
  - middle drag rotates with positive yaw/pitch delta.
  - Shift+middle drag pans target by `0.72687913713354` with no yaw/pitch change.
- Axis validation confirms `axisX`, `axisY`, and `axisZ` exist.

Next step:
- Hard refresh `http://localhost:8780/index.html` in the in-app browser so it loads the new script.
- Manual check should focus on whether the `R` direction now matches hand feel from several camera angles.

## Selection And View Navigation Fix - 2026-05-08

Current objective:
- Fix selection conflicts and broken viewport rotation in the standalone skeleton editor.

Current progress:
- Left mouse is now reserved for selection and transform confirmation.
- View rotation now uses Blender-like navigation:
  - middle mouse drag
  - right mouse drag as a web fallback
  - Alt + left mouse drag
- Clicking a transform gizmo handle now takes priority over joint/bone picking and viewport rotation.
- Clicking a joint in Build mode now only selects it.
- Dragging from a joint only starts child-bone creation after a small movement threshold, preventing accidental long bones from a normal click.
- Joint picking now ignores the selected outline line mesh and only raycasts real cube/arrow meshes, which reduces false selection hits.
- Pointer capture/release is guarded so TransformControls and the app event handlers do not throw or fight over pointer ownership.
- View help text and README were updated to match the new controls.
- Validation script now covers the specific regression:
  - left-dragging empty viewport does not rotate the camera.
  - middle-dragging empty viewport rotates the camera.
  - clicking Root selects it without starting bone extension or changing bone count.

Validation:
- `npm run check`: PASS.
- `node --check scripts/validate_demo_import.mjs`: PASS.
- `npm run validate:import`: PASS.
- Interaction validation:
  - leftDelta: `0`
  - middleDelta: `0.9400000000000003`
  - Root click selected `j1` and kept bone count at `20`
  - `isExtending`: false
  - `pendingExtendJointId`: null

Next step:
- Hard refresh `http://localhost:8780/index.html` in the in-app browser if it still shows the previous left-click help text.
- Next likely improvement: add viewport pan with Shift + middle mouse and visible numeric transform values.

## Cubic Joint Controls With Direction Arrows - 2026-05-08

Current objective:
- Replace spherical joint controls with directional controls that make bone orientation readable.

Current progress:
- Joint controls are now `Group` objects made from:
  - `jointBox`: small cube control at the joint.
  - `jointArrowShaft`: direction shaft.
  - `jointArrowHead`: arrow head showing bone direction.
  - `jointOutline`: selected/highlight outline.
- Joint arrows orient toward the first child bone when available.
- End joints without children orient along their parent bone direction.
- Ray picking now targets the cube/arrow child meshes, so clicking the cube or arrow selects the joint.
- Selected joint controls get stronger outline and scale feedback.

Validation:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Joint control validation confirms the control contains `jointBox`, `jointArrowShaft`, `jointArrowHead`, and `jointOutline`.
- Existing GLB import, pose, gizmo, and modal transform validations still pass.

Next step:
- If the cube/arrow is visually too large or too small in manual use, tune `BoxGeometry(0.105)` and arrow shaft/head dimensions.

## Blender Modal G/R/S Controls - 2026-05-08

Current objective:
- Match Blender's transform modal behavior more closely: pressing `G`, `R`, or `S` should immediately start transforming the current selection, without requiring the user to grab a gizmo handle first.

Current progress:
- Added modal transform behavior:
  - `G`: immediately starts move transform.
  - `R`: immediately starts rotate transform.
  - `S`: immediately starts scale transform.
  - mouse movement directly changes the selected bone/joint after the key press.
  - `LMB` or `Enter`: confirm.
  - `RMB` or `Esc`: cancel and restore the original transform.
  - `X/Y/Z`: axis constraint during the modal operation.
- Existing visible gizmos remain available:
  - move arrows
  - rotation rings
  - scale handles
- Reduced modal move sensitivity so small mouse movement does not produce huge jumps.
- Modal transform works with the real imported GLB skeleton in Pose mode.

Reference behavior checked:
- Blender Manual move transform: `G` enters move mode and selected elements follow mouse movement; `LMB` confirms.
- Blender Manual transform modal map: `X/Y/Z` are the default transform constraint keys.

Validation:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Modal translate validation:
  - selected bone: `R_Forearm`
  - `G`-style modal move changed the bone endpoint by `0.23538741437013086`.
  - cancel path restored the transform with cancel delta `0`.
  - result: PASS.
- Existing rotate gizmo validation still passes and does not stretch the bone.

Next step:
- Add on-screen transform values and typed numeric input, because Blender also supports entering values during modal transform.

## Blender-Style Transform Gizmo - 2026-05-08

Current objective:
- Replace direct point dragging with Blender-like transform controls: Move, Rotate, Scale, and G/R/S shortcuts.

Current progress:
- Added Three.js `TransformControls`.
- Added visible top toolbar:
  - `移动 G`
  - `旋转 R`
  - `缩放 S`
  - `局部/世界`
- Selected bones now get a real viewport gizmo:
  - translate arrows for move
  - rotation rings for angle control
  - scale handles for scaling
- Keyboard behavior now follows Blender-style basics:
  - `G`: move tool
  - `R`: rotate tool / rotation rings
  - `S`: scale tool
  - `X/Y/Z`: show and constrain one axis
  - `Tab`: switch Edit/Pose
  - `Esc`: cancel temporary operation / clear axis lock
- Pose mode gizmo writes transforms to the real GLB `THREE.Bone`, not just the helper skeleton.
- Edit mode gizmo changes editor joint/bone structure.
- Bone segment naming was corrected so a visible segment uses the source bone name, e.g. `R_Forearm` now represents the forearm segment from `R_Forearm` to `R_Hand`.

Validation:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Import still passes for both original Downloads GLB and the local test GLB.
- Transform gizmo validation:
  - selected bone: `R_Forearm`
  - gizmo mode: `rotate`
  - transform control visible and attached: PASS
  - bone length delta after gizmo rotation: `0.000000005460359442377438`
  - endpoint moved after rotation: `0.04671384562605783`
  - result: PASS, rotation ring style transform moves the character through the real skeleton without stretching the bone.

Next step:
- Hard refresh the browser page and use the new toolbar / G R S shortcuts.
- Next improvement should add undo/redo and numeric transform fields, matching more Blender workflows.

## Pose Mode Stretch Fix And Blender-Like Control Split - 2026-05-08

Current objective:
- Fix the bug where dragging a bone in pose mode stretched it into a long line instead of rotating it.
- Make the control logic closer to Blender: Edit mode changes skeleton structure, Pose mode rotates bones and drives the skinned model.

Current progress:
- Split interactions by mode:
  - Edit / `骨架搭建`: dragging a joint can extend or edit the skeleton structure.
  - Pose / `姿势调整`: dragging a selected bone applies rotation only; it does not move the endpoint directly.
- Imported GLB bones now keep references to their real `THREE.Bone` objects.
- Pose rotation writes to the real GLB skeleton bone quaternion, so the skinned character follows the bone motion.
- After pose rotation, the visible editor skeleton is synced back from the real model bones.
- Imported skeleton display now filters out technical helper bones such as `Twist` bones and shows a cleaner common human rig.
- Added Blender-style keyboard helpers:
  - `Tab`: toggle Edit/Pose modes.
  - `R`: enter/confirm pose-rotation style.
  - `X/Y/Z`: axis-lock pose rotation.
  - `Esc`: cancel transient operation / clear axis lock.
- Added validation coverage for pose behavior.

Validation:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- Test model import still works for both file input and `加载测试模型`.
- Imported editor rig is now 20 main bones instead of 38 noisy raw bones.
- Pose validation:
  - selected bone: `R_Forearm`
  - bone length before: `0.24012064985439247`
  - bone length after: `0.24012066469391022`
  - length delta: `0.000000014839517753495457`
  - endpoint moved: `0.061119475267351064`
  - result: PASS, pose rotates without stretching.

Next step:
- Reload the browser page manually if it still shows the old script.
- Continue improving Blender-like controls: visible rotation gizmo, local/global axis display, undo/redo, and pose keyframes.

## GLB Import Fix And Stylized Character Validation - 2026-05-08

Current objective:
- Fix the issue where importing `C:\Users\bodean\Downloads\stylized+3d+character+model.glb` appeared to do nothing.

Current progress:
- Switched Three.js imports from CDN URLs to local npm dependency paths through an import map.
- Added `package.json`, `package-lock.json`, and local `node_modules` dependency setup.
- Copied the user's test GLB to `sample_models/stylized_3d_character_model.glb`.
- Changed model import from `URL.createObjectURL + loader.load` to `FileReader + GLTFLoader.parse`.
- Added visible import feedback: file name, file size, progress bar, and detailed error text.
- The import input now clears after selection, so choosing the same GLB again still triggers loading.
- Added a `加载测试模型` button using the copied stylized character GLB.
- Imported skeletons are detected from `SkinnedMesh.skeleton` and rebuilt as visible editor bones.
- Added validation script `scripts/validate_demo_import.mjs`.

Validation:
- `npm run check`: PASS.
- `npm run validate:import`: PASS.
- File input scenario using original Downloads file:
  - file: `stylized+3d+character+model.glb`
  - size: `36.07 MB`
  - meshes: `1`
  - skinnedMeshes: `1`
  - skins: `1`
  - bones detected in GLB: `39`
  - editor bones rebuilt: `38`
- Test button scenario using `sample_models/stylized_3d_character_model.glb`: PASS.
- Screenshot written to `artifacts/validate_import_stylized_model.png`.

Next step:
- Reload `http://localhost:8780/index.html` in the browser so it picks up the new import code.
- Continue editor work from this E-drive project.

## Action Rig Demo - 2026-05-08

Current objective:
- Build an independent Chinese UI MVP for a skeleton/action quick adjuster.
- Work location is now `E:\codex骨骼软件`.

Current progress:
- Moved the Web demo out of the Godot project into this standalone folder.
- Current UI is a single-page prototype:
  - Left side: 3D model / skeleton viewport.
  - Right side: dedicated parameter panels with distinct colors.
  - Chinese interface.
  - Skeleton build mode supports dragging from a joint to create a child bone.
  - Human skeleton template, branch mirror, bone delete, bone name/color adjustment.
  - Weight brush visual demo with add/subtract/smooth modes.
  - 24-frame walk cycle keyframe preview, playback, keyframe save, transition optimization marker.
  - JSON export preview.

Files:
- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `start_demo.bat`
- `CURRENT_STATE.md`

Validation:
- Files moved successfully from `D:\godot后室\tools\action_rig_demo` to `E:\codex骨骼软件`.
- Old local preview server on port `8780` was stopped before moving.

Next step:
- Start `start_demo.bat` or run `python -m http.server 8780` from this folder.
- Open `http://localhost:8780/index.html`.
- Browser-verify layout and 3D canvas, then continue feature work only inside `E:\codex骨骼软件`.

## Rotate And Control Length Regression - 2026-05-11

Current objective:
- Fix latest regression where pressing R makes wrist/limb fly and previously allowed controller/bone length adjustment appears to be constrained again.

Current progress:
- User interrupted with screenshots showing R VIEW rotation causing a hand/wrist chain to explode and leg/controller length behaving like the old no-stretch state.
- Pausing template UI/self-check work to debug transform and IK solve path first.

Files changed before this interruption:
- app.js
- scripts/validate_demo_import.mjs

Validation result:
- Static checks passed.
- Full validate:import currently failing on saved initial skeleton persistence before reaching this latest regression.

Next step:
- Inspect modal rotate and applyControlToJoint/syncIkControlsToJoints paths, then add regression coverage for R no-fly and scale/length behavior.

## Rotate And Saved Initial Skeleton Fix - 2026-05-11

Current objective:
- Fix the latest R-view rotation / wrist-flying regression without removing the pre-IK ability to lengthen and adjust skeleton bones.

Current progress:
- Diagnosed the real cause with a targeted Playwright trace:
  - After clicking "save initial skeleton", dragging a temporary pre-IK skeleton edit control still auto-wrote the draft into `skeleton.rest_joints`.
  - Generate IK/FK then used that unsaved draft as the rest baseline, so `R_Hand_IK` entered motion editing at a stretched position around x=2.09 instead of the saved initial x=0.82.
  - R rotation was then rotating a rig whose saved baseline had already been polluted, which looked like wrist flying and long controller lines.
- Fixed the state split:
  - `initial_rest_joints` is now the authoritative saved initial skeleton once the user clicks Save.
  - Post-save pre-IK edits are marked as `initial_skeleton_dirty` draft changes and do not become the IK/FK baseline unless the user clicks Save again.
  - Entering/generating IK/FK resets `joints` and `rest_joints` to the saved initial skeleton and clears the dirty flag.
  - `restoreCoreState()` and keyboard transform startup now resync hand/foot IK end-effectors to solved joints, preventing stale long-line targets from surviving undo/stage transitions.
- Kept the intended behavior:
  - Skeleton recognition stage still allows length changes with skeleton edit controls.
  - Animation/IK stage still uses no-stretch solved hand/foot targets unless the skeleton was explicitly saved with new lengths.
- Updated validation coverage:
  - Added a check that post-save pre-IK draft edits do not overwrite `initial_rest_joints`.
  - Added a check that IK/FK generation ignores unsaved post-save draft edits.
  - Adjusted multi-select hand IK translation validation to use a reachable direction while still checking that hand IK controls remain attached to the solved wrists.

Files changed:
- `app.js`
- `scripts/validate_demo_import.mjs`
- `CURRENT_STATE.md`

Validation result: PASS.

Commands run:
- `node --check app.js`: PASS
- `node --check scripts\validate_demo_import.mjs`: PASS
- `npm run check`: PASS
- `npm run validate:import`: PASS

Validation details:
- Full validation log: `artifacts/logs/validate_rotate_length_20260511_b.log`
- NPM check log: `artifacts/logs/npm_check_rotate_length_20260511_b.log`
- Full acceptance screenshot: `artifacts/screenshots/pipeline_acceptance_20260511_110954Z.png`

Next step:
- Hard refresh `http://localhost:8780/index.html`.
- Manual check:
  - In skeleton recognition, drag/scale a temporary bone control before saving, click Save Initial Skeleton, then Generate IK/FK.
  - In motion editing, select a wrist/forearm control and press R. The hand IK line should stay attached and the wrist should rotate from the current pose without snapping or flying.

## Handoff And Git Publish - 2026-05-11

Current objective:
- Create a clean handoff document and publish the current project state to Git.

Current progress:
- Rewrote `HANDOFF.md` with the current workspace, run commands, validation commands, Motion Brain architecture, latest R/initial-skeleton fix, known limitations, and next steps.
- Confirmed `E:\codex骨骼软件` is not itself a Git repository.
- Found the adjacent publishing repository at `E:\codex骨骼软件_github_publish`.
- Publishing repository details:
  - branch: `main`
  - remote: `origin https://github.com/Siger1989/gugebangdign.git`
- Synced source files from `E:\codex骨骼软件` to the publishing repository, excluding `.git`, `node_modules`, `artifacts`, backups, logs, and release output.

Files changed:
- `HANDOFF.md`
- `CURRENT_STATE.md`
- Project source files already listed in the previous sections.

Validation result:
- Handoff updated.
- Source validation before publishing:
  - `node --check app.js`: PASS
  - `node --check scripts\validate_demo_import.mjs`: PASS
  - `npm run check`: PASS
  - `npm run validate:import`: PASS

Current blocking issue:
- GitHub upload is blocked by authentication for the HTTPS remote.
- `git push origin main` failed with:
  - `remote: Invalid username or token. Password authentication is not supported for Git operations.`
- `gh` is not installed on this machine, so the GitHub CLI fallback is unavailable.

Next step:
- Local commit exists in `E:\codex骨骼软件_github_publish`:
  - `ecd52e8 Add motion brain pipeline and rig workflow fixes`
- To finish upload, authenticate Git for `https://github.com/Siger1989/gugebangdign.git` with a GitHub token, install/login `gh`, or switch the remote to an SSH URL with a valid key, then run `git push origin main`.

