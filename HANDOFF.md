# 动作生成工作台交接文档

更新时间：2026-05-11 07:29 CST
工作目录：`D:\codex骨骼绑定`
当前分支：`main`
远端仓库：`origin https://github.com/Siger1989/gugebangdign`

## 当前定位

这个项目是一个基于浏览器 / Electron 的中文动作生成工作台 MVP。当前目标不是替代 Blender，而是打通一条稳定的角色动作编辑闭环：

```text
导入 GLB 模型
-> 识别或手动赋值骨骼
-> 生成 IK / Control Rig 控制器
-> 加载或编辑动作关键帧
-> 精调控制器
-> 验证动作质量
-> 导出 Motion JSON
```

重点工作流已经从“只能识别标准人形骨架”扩展到“不完整或未命名骨架也能进入手动赋值流程”。

## 运行方式

```powershell
cd D:\codex骨骼绑定
npm install
npm run start
```

打开：

```text
http://localhost:8780/index.html
```

不要直接用 `file:///.../index.html` 打开。Three.js import map、本地模型和 Playwright 验证都依赖 HTTP 静态服务。

## 验证方式

上传前应至少运行：

```powershell
node --check app.js
node --check scripts\validate_demo_import.mjs
npm run check
npm run validate:import
```

本次上传前验证结果：PASS。

最新截图：

```text
artifacts/screenshots/pipeline_acceptance_20260510_233101Z.png
```

## 当前稳定能力

- 导入带 skin / joints 的 GLB，并生成可视化骨架参考。
- 对标准或近似人形骨架生成 `Humanoid_v1` 映射。
- 对识别不完整的模型生成可编辑赋值骨架，允许把标准关键点拖到源骨骼上完成手动绑定。
- 支持绑定预设导入 / 导出，格式为 `humanoid_binding_preset_v1`。
- 支持生成 IK / Control Rig，包括全局、重心、骨盆、胸腔、头、手、脚、肘 pole、膝 pole 等控制器。
- 支持控制器多选、排除选择、批量变换。
- 支持 ZBrush 风格的变换手柄和 Blender 风格 `G` / `R` / `S` 快捷键。
- 支持精确变换数值框：移动、旋转、缩放时保留数值输入，可手动改值或复制。
- 支持复制当前帧、粘贴当前帧、镜像当前帧、删除当前帧关键帧。
- 时间轴不再固定 24 帧，可滚轮缩放、平移窗口、跳转并自动扩展总帧数。
- 手动缩放 / 平移时间轴后会进入固定视图状态，旁边显示 `固定` 标记；重置窗口后解除固定。
- Motion JSON 导出前会在存在关键帧且验证过期时自动触发验证，并写入导出元数据。
- 支持可编辑 FPS，并在播放中修改后更新播放节奏。

## 最近完成的关键改动

1. 可编辑赋值骨架
   - 对未识别或缺失关节的模型，根据模型包围盒估算缺失的人形关键点。
   - 用户可拖动标准关节点到源骨骼位置。
   - 吸附到源骨骼后自动写入映射，并清理重复绑定。
   - 休息姿态写入 `skeleton.rest_joints`，供后续 IK 和控制器生成使用。

2. 绑定预设
   - 新增绑定预设导出 / 导入。
   - 导入后恢复拟合骨架、源骨骼映射和休息姿态。
   - 适合给同一类模型复用一次手工赋值结果。

3. 时间轴专业化
   - 当前帧可以直接输入数字跳转。
   - 跳转到超出范围的帧会扩展总帧数。
   - 支持滚轮缩放、Shift + 滚轮平移、按钮缩放 / 平移。
   - 增加固定窗口状态，避免用户精调某段时间轴时自动跳走。

4. 控制器和变换手感
   - 控制器支持多选后一起调整。
   - 变换数值框会保留到用户确认或关闭，便于左右侧精确对称调整。
   - 自由移动显示的是本次拖动位移长度；轴向移动显示对应轴增量；视角旋转显示度数。
   - 旋转视角模式围绕当前相机视图轴处理，避免手腕位置被错误跳动。

5. 动作验证和导出
   - 自动化脚本覆盖导入、识别、赋值骨架、IK 生成、关键帧编辑、时间轴、导出等流程。
   - 导出 Motion JSON 时携带验证状态、FPS、关键帧和控制器数据。

## 关键文件

- `index.html`：中文 UI 结构、顶部流程栏、右侧检查器、底部时间轴。
- `styles.css`：整体布局、控制面板、时间轴、数值框、绑定面板样式。
- `app.js`：核心逻辑，包含 Three.js 场景、命令系统、骨架识别、赋值骨架、IK、时间轴、验证和导出。
- `scripts/validate_demo_import.mjs`：Playwright 自动化验收脚本。
- `package.json`：本地运行、语法检查、Playwright 验证脚本。
- `CURRENT_STATE.md`：长任务状态、每轮自检记录、验证结果。
- `backups/snapshot_20260511_010246_assignment_final`：当前长期优化任务的同步备份目录。

所有会修改状态的功能都应走 `executeCommand(command)`。不要在 UI 事件里直接改 `MotionState`、骨骼、IK 控制器或关键帧。

## 调试入口

常用浏览器调试 API：

- `window.MotionState`
- `window.executeCommand(...)`
- `window.getTimelineViewState()`
- `window.getTransformValueBoxState()`
- `window.exportMotionJson()`
- `window.exportBindingPresetJson()`

常用命令示例：

```js
executeCommand({ type: "load_test_dummy" });
executeCommand({ type: "create_humanoid_skeleton" });
executeCommand({ type: "create_ik_controls" });
executeCommand({ type: "apply_motion_template", template_id: "walk_cycle_8f" });
executeCommand({ type: "set_current_frame", frame: 48 });
executeCommand({ type: "zoom_timeline_view", factor: 0.8 });
executeCommand({ type: "export_motion_json" });
```

## 已知限制

- 目前导出主要是 Motion JSON，还不是完整 glTF animation sampler / channel。
- IK 仍是轻量控制器，不是完整 DCC 级 rig；关节限位、FK/IK 权重混合、复杂 pole 稳定器还需要继续做。
- 自动骨骼识别仍偏人形；怪物、机械、多足、翅膀等需要专门模板。
- 手动赋值骨架已经可用，但还需要更完整的批量命名、镜像赋值和错误提示。
- 验证页签目前保留为功能入口，质量检查还不是最终专业级动画体检。

## 下一步建议

1. 做时间轴快捷键层：缩放、平移、跳关键帧时不与 G / R / S 变换冲突。
2. 完善手动赋值骨架：增加镜像赋值、批量清空、未绑定关节高亮。
3. 增加 FK/IK 真正权重混合，让 `IK/FK 混合` 能在 0-1 权重上可见。
4. 完善脚底锁定和地面约束，减少走路模板里脚掌穿地或滑动。
5. 把验证面板改成明确的动作质量报告，而不是一个容易误点的流程页签。
6. 增加标准动作库和导入动作重定向，避免 Walk_8F 成为唯一模板。

## 接手步骤

```powershell
cd D:\codex骨骼绑定
git status
git diff --stat
Get-Content CURRENT_STATE.md -Tail 120
npm run check
npm run validate:import
```

如果从备份恢复，请优先使用：

```text
backups/snapshot_20260511_010246_assignment_final
```

恢复后仍要重新运行 `npm run validate:import`，不要只相信备份文件时间。
