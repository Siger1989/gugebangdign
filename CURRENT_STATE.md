# CURRENT_STATE

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
