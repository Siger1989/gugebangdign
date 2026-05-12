# 动作生成工作台交接文档

更新时间：2026-05-11 19:13 +08:00
当前工作目录：`E:\codex骨骼软件`
发布 Git 工作目录：`E:\codex骨骼软件_github_publish`
发布远端：`origin https://github.com/Siger1989/gugebangdign.git`
当前发布分支：`main`

## Latest Update - 2026-05-12 Walk Validation Identity

- Fixed a false positive where `Walk_8F` could look correct but validation still showed `有问题` because `骨骼身份错误` reported `左右身份不匹配`.
- The old rule assumed a fixed side-axis sign: `R_` must be positive rig-right and `L_` must be negative rig-right.
- Imported rigs and confirmed facing direction can flip that sign while still being internally correct.
- The validator now checks consistency instead:
  - all `R_` joints must be on one side;
  - all `L_` joints must be on the opposite side;
  - either sign convention is accepted.
- Regression coverage added for normal walk and imported GLB walk validation.
- Latest validation:
  - `node --check app.js`: PASS
  - `node --check scripts\validate_demo_import.mjs`: PASS
  - `npm run check`: PASS
  - `npm run validate:import`: PASS
- Logs:
  - `artifacts/logs/npm_check_walk_identity_validation_20260512.log`
  - `artifacts/logs/validate_walk_identity_validation_20260512.log`

## Latest Update - 2026-05-12 Motion Brain Load Button

- Fixed the Motion Brain load button staying disabled after text generation.
- The load button now only treats a result as already loaded when the current timeline actually contains Motion Brain keyframes.
- Button text now explains the state:
  - `加载文字生成动作`
  - `自检未通过，不能加载`
  - `已加载到时间轴`
- The debug preview now includes `Load: ready`, `Load: blocked`, or `Load: loaded`.
- Added regression coverage for the default text input `生成一个自然站立呼吸`:
  - Parses as `idle/breath`.
  - Passes the quality gate.
  - Sets `ready_to_load=true`.
  - Enables the load button.
- Latest validation:
  - `node --check app.js`: PASS
  - `node --check scripts\validate_demo_import.mjs`: PASS
  - `npm run check`: PASS
  - `npm run validate:import`: PASS
- Logs:
  - `artifacts/logs/npm_check_motion_brain_load_button_20260512.log`
  - `artifacts/logs/validate_motion_brain_load_button_20260512.log`

## Latest Update - 2026-05-12 R View Hand Rotation

- Fixed the persistent `R VIEW` hand/palm flip:
  - Pressing `R` now keeps the current hand pose as the start pose.
  - Dragging rotates around the active camera/view axis.
  - Hand IK target and wrist joint position stay stable.
  - Terminal hand/foot explicit rotations are now applied on top of the current solved world rotation, not the source rest pose.
- New regression coverage:
  - Select `R_Hand_IK` on the imported GLB.
  - Press `R`.
  - First pointer move must not snap.
  - Committed rotation delta must align with the camera view axis.
  - Wrist and IK target must not drift.
- Latest validation:
  - `node --check app.js`: PASS
  - `node --check scripts\validate_demo_import.mjs`: PASS
  - `npm run check`: PASS
  - `npm run validate:import`: PASS
- Logs:
  - `artifacts/logs/npm_check_r_view_hand_20260512_b.log`
  - `artifacts/logs/validate_r_view_hand_20260512_b.log`

## Latest Update - 2026-05-12

- Motion Brain UI is now a two-step flow:
  - `生成 / 自检文字动作` compiles the text prompt, runs the quality gate, and keeps the current timeline unchanged.
  - `加载文字生成动作` writes the passed text-generated result into the timeline.
- The text-load button is disabled until a Motion Brain result has passed validation, and disabled again after that result is loaded.
- The old command `generate_motion_from_text` still works for debug/API compatibility, but the visible UI uses preview + explicit load.
- Validation no longer uses the current action pose to decide left/right bone identity. It checks the saved/rest skeleton instead, so `Punch_R_12F` or other crossing attack poses do not falsely fail with a left/right identity mismatch.
- New regression coverage was added in `scripts/validate_demo_import.mjs` for the Motion Brain preview/load UI flow and Punch template rest-skeleton identity validation.
- Latest validation:
  - `node --check app.js`: PASS
  - `node --check scripts\validate_demo_import.mjs`: PASS
  - `npm run check`: PASS
  - `npm run validate:import`: PASS
- Logs:
  - `artifacts/logs/npm_check_text_motion_load_20260512.log`
  - `artifacts/logs/validate_text_motion_load_20260512.log`
- Git publish:
  - Branch `main`
  - Latest commit message `Add motion brain pipeline and rig workflow fixes`
  - Remote push PASS

## 项目定位

这是一个基于浏览器 / Electron 的中文角色动作生成工作台 MVP。核心目标不是替代 Blender，而是打通一条可复用的动作生成与修正流程：

```text
导入 GLB 模型
-> 识别或手动绑定骨骼
-> 调整并保存初始骨骼
-> 生成 IK/FK 控制器
-> 通过动作模板或 Motion Brain 生成控制器关键帧
-> 手动精修控制器
-> MotionCritic / Validator 自检
-> 导出 Motion JSON
```

当前最重要的原则是：最终动画写控制器关键帧，不直接写死最终骨骼姿势。自然语言动作生成必须走 Motion Brain 管线，不能绕过 Validator 和 AutoFixer。

## 运行方式

```powershell
cd E:\codex骨骼软件
npm install
npm run start
```

浏览器打开：

```text
http://localhost:8780/index.html
```

不要用 `file:///.../index.html` 直接打开。Three.js import map、本地模型和 Playwright 验证都依赖 HTTP 静态服务。

## 验证方式

每轮重要修改后至少运行：

```powershell
node --check app.js
node --check scripts\validate_demo_import.mjs
npm run check
npm run validate:import
```

本轮验证结果：PASS。

最新验证日志：

```text
artifacts/logs/npm_check_rotate_length_20260511_b.log
artifacts/logs/validate_rotate_length_20260511_b.log
artifacts/screenshots/pipeline_acceptance_20260511_110954Z.png
```

## 本轮修复重点

### 1. R 后手腕乱飞 / 控制线变长

根因不是 `R` 旋转公式本身，而是状态污染：

- 用户点击“保存初始骨骼”之后，骨骼识别阶段的临时拖动仍然自动写进 `skeleton.rest_joints`。
- 生成 IK/FK 时又拿这个未再次保存的草稿骨骼作为 rest baseline。
- 结果是 `R_Hand_IK` 进入动作编辑阶段时已经在异常远的位置，后续 `R VIEW` 旋转看起来像手腕飞出去。

修复策略：

- `initial_rest_joints` 成为用户显式保存后的权威初始骨骼。
- 保存后继续在骨骼识别阶段拖动，只标记为草稿修改：`initial_skeleton_dirty = true`。
- 只有再次点击“保存初始骨骼”，草稿才会覆盖正式初始骨骼。
- 生成 IK/FK 时强制从 `initial_rest_joints` 恢复 `joints` 和 `rest_joints`。
- `restoreCoreState()` 和 `startKeyboardTransform()` 会同步手/脚 IK 端点到已解算的手腕/脚踝，避免 undo、阶段切换或旧状态留下长线目标。

关键位置：

- `app.js`
  - `saveCurrentSkeletonAsInitial()`
  - `prepareSavedInitialSkeletonForControlRig()`
  - `getLockedInitialRestJoints()`
  - `syncEndEffectorControlsToJoints()`
  - `persistEditableAssignmentRestJoints()`
  - `startKeyboardTransform()`

### 2. 骨骼识别阶段仍可调整长度

这次没有取消骨骼识别阶段的长度调整能力。

当前规则：

- 生成 IK/FK 前，临时骨骼控制器仍允许拖动和缩放。
- 如果用户想让这次调整成为后续控制器绑定基准，必须点击“保存初始骨骼”。
- 如果用户保存后又乱拖，没有再次保存，生成 IK/FK 会回到最后保存的初始骨骼。

这个行为符合用户现在要求的流程：

```text
绑定/赋值骨骼
-> 调整骨骼
-> 保存初始骨骼
-> 生成 IK/FK 控制器
-> 加载或生成动作
```

### 3. Motion Brain 自检闭环

Motion Brain 目前已经不是单纯模板系统，而是自然语言动作编译器雏形：

```text
文本
-> ActionIntentParser
-> ActionIRBuilder
-> MotionPlanner
-> PrimitiveComposer
-> ControllerCurveGenerator
-> RigSolver / app 侧解算
-> PoseSampler
-> PoseFeatureExtractor
-> MotionCritic / MotionQualityGate
-> ActionValidator
-> ActionAutoFixer
-> 重新解算和验证
```

已修复的重要问题：

- AutoFix 之后会重新解算、重新采样、重新 Critic，不再“修了但不复查”。
- 普通 idle / walk / run 会严格拦截 T Pose/A Pose 残留、手臂过高、普通 locomotion 使用 HandIK 等问题。
- attack / interaction / gesture 会按 intent 区分，不会把举手、推门、攻击误判为普通 T Pose。
- legacy 动作模板也纳入自检，避免 `Idle_Breathe` 绕过 Motion Brain 自审。

## 当前稳定能力

- 导入带 skin / joints 的 GLB，并生成可视化骨骼参考。
- 对标准或近似人形骨架生成 `Humanoid_v1` 映射。
- 在骨骼识别阶段手动调整标准关节点，再保存为初始骨骼。
- 生成 IK/FK 控制器：Global、Root、COG、Pelvis、Chest、Head、HandIK、FootIK、Pole、FK joint control。
- 动作编辑阶段支持 G/R/S、视角轴旋转、XYZ 轴切换、多选控制器、数值输入框。
- 时间轴支持关键帧、循环区间、速度滑块、窗口缩放和平移、片段拖动插入。
- Motion Brain 支持普通走路、奔跑、站立呼吸、跳跃、双手武器横挥、推门、后退撞墙、捡武器、右拳前挥、躺下、举手挥手等语义。
- 导出 Motion JSON。

## 关键文件

- `app.js`：主应用逻辑，包含 Three.js 场景、状态管理、命令系统、骨骼识别、IK/FK、时间轴、Motion Brain UI 集成和导出。
- `index.html`：中文 UI 结构。
- `styles.css`：布局、面板、时间轴、控制器 UI 样式。
- `motion_brain/`：自然语言动作编译器核心模块。
- `docs/MOTION_BRAIN.md`：Motion Brain 管线说明。
- `docs/ACTION_GRAMMAR.md`：动作语法说明。
- `docs/ACTION_VALIDATION.md`：动作验证和质量门说明。
- `scripts/validate_demo_import.mjs`：Playwright 端到端验证。
- `CURRENT_STATE.md`：长任务状态记录，恢复上下文时优先读取。
- `HANDOFF.md`：当前交接文档。

## Motion Brain 模块

- `motion_brain/action_intent.js`
- `motion_brain/action_intent_parser.js`
- `motion_brain/action_ir.js`
- `motion_brain/action_ir_builder.js`
- `motion_brain/action_grammar.js`
- `motion_brain/action_primitive_library.js`
- `motion_brain/primitive_composer.js`
- `motion_brain/action_prototype_library.js`
- `motion_brain/motion_planner.js`
- `motion_brain/controller_curve_generator.js`
- `motion_brain/pose_sampler.js`
- `motion_brain/pose_feature_extractor.js`
- `motion_brain/motion_critic.js`
- `motion_brain/motion_quality_gate.js`
- `motion_brain/intent_fulfillment_validator.js`
- `motion_brain/action_validator.js`
- `motion_brain/action_auto_fixer.js`
- `motion_brain/motion_brain_pipeline.js`
- `motion_brain/llm_adapter.js`

统一入口是：

```js
MotionBrain.generate_from_text(text)
```

app 侧命令入口是：

```js
executeCommand(createCommand("generate_motion_from_text", { text: "生成一个自然站立呼吸" }))
```

## 调试入口

浏览器控制台常用：

```js
window.__motionDebug.getMotionState()
window.__motionDebug.getMotionStateSummary()
window.__motionDebug.executeCommandByName("generate_motion_from_text", { text: "生成一个普通走路" })
window.__motionDebug.getMotionBrainLastResult()
window.__motionDebug.getMotionTemplateSelfCheck()
window.__motionDebug.getIkControlScreenPositions()
window.__motionDebug.getTransformGizmoDebug()
window.__motionDebug.getTimelineViewState()
```

命令示例：

```js
executeCommand(createCommand("load_test_dummy", {}));
executeCommand(createCommand("create_humanoid_skeleton", {}));
executeCommand(createCommand("save_initial_skeleton", {}));
executeCommand(createCommand("create_ik_controls", {}));
executeCommand(createCommand("generate_motion_from_text", { text: "向前挥出右拳" }));
executeCommand(createCommand("export_motion_json", {}));
```

## 已知限制

- 导出仍主要是 Motion JSON，不是完整 glTF animation sampler/channel。
- IK/FK 是轻量控制器，不是完整 DCC 级 rig。
- 物理辅助层目前只预留数据结构，还没有完整 ragdoll 或接触物理。
- Parser 现在是关键词规则版，未来 LLM 只能输出 ActionIR JSON 或 MotionPlan JSON 草案，不能直接写骨骼关键帧。
- MotionCritic 是启发式质量门，还不是专业动画师级审美评分器。
- 当前发布工作目录和开发工作目录分离：开发在 `E:\codex骨骼软件`，Git 发布在 `E:\codex骨骼软件_github_publish`。

## 后续建议

1. 把 `E:\codex骨骼软件` 直接初始化为 Git 仓库，或固定只在 `E:\codex骨骼软件_github_publish` 开发，避免双目录同步风险。
2. 增加“保存初始骨骼后有未保存草稿修改”的 UI 提示。
3. 把 Motion Brain debug 面板做成可折叠表格，展示 ActionIR、primitives、critic issues、autofix iterations。
4. 给 FK/IK Blend 做真实 0-1 混合显示和关键帧记录。
5. 扩展动作原子库，而不是继续给每个动作写固定模板。
6. 接入 LLM 时只允许 LLM 输出 ActionIR / MotionPlan JSON，并继续走现有 Validator / AutoFixer。

## 接手步骤

```powershell
cd E:\codex骨骼软件
Get-Content CURRENT_STATE.md -Tail 160
node --check app.js
node --check scripts\validate_demo_import.mjs
npm run check
npm run validate:import
```

如果要发布到 Git：

```powershell
cd E:\codex骨骼软件_github_publish
git status
git log --oneline -5
git remote -v
```

然后确认 `E:\codex骨骼软件` 与发布目录同步后再提交。
