# CURRENT_STATE

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
