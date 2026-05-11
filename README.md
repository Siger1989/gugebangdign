# 动作生成流水线演示

这是 `动作快速调整器` 的第一阶段重构版本。当前目标不是完整 3D 编辑器，而是先打通一个稳定动作生成闭环：

```text
加载测试假人
-> 创建人形骨架
-> 创建 IK/FK 控制器
-> 应用 8 姿势走路模板
-> 播放
-> 验证动作
-> 导出动作 JSON
-> 撤销 / 重做
```

## 运行

在项目根目录启动本地静态服务器：

```powershell
python -m http.server 8780
```

也可以直接双击：

```text
start_demo.bat
```

脚本会自动打开：

```text
http://localhost:8780/index.html
```

不要用 `file:///.../index.html` 打开；Three.js import map 和本地资源需要通过 HTTP 静态服务器加载。现在如果误打开 `file://` 页面，界面会提示并在检测到本地服务器后自动跳转到正确地址。

## 验证

```powershell
npm run check
npm run validate:import
```

`validate:import` 现在验证第一阶段流水线验收流程：

- 加载测试假人
- 创建人形骨架
- 创建 IK/FK 控制器
- 应用 8 姿势走路模板
- 播放
- 验证动作
- 导出动作 JSON
- 撤销
- 重做

## 演示短片

生成一段带中文字幕提示的使用流程短片：

```powershell
npm run tutorial:video
```

生成的视频会保存到：

```text
artifacts/videos/
```

当前短片内容覆盖：加载测试假人、创建骨架、创建 IK/FK 控制器、应用 8 姿势走路模板、播放、验证、导出、撤销和重做。

## 当前架构

- 所有会修改动作状态的 UI 操作都通过 `executeCommand(command)` 执行。
- `MotionState` 包含 skeleton、bones、joints、ik_controls、current_frame、total_frames、keyframes、motion_templates、selected_bone、selected_control、command_log、undo_stack、redo_stack、validation_report、dirty_state。
- 命令接口调试面板显示最近命令、结果、错误、日志、撤销/重做数量、动作状态摘要和验证报告。
- 当前动作模板支持 `Humanoid_v1` 下的 `idle_breathe_24f`、`walk_cycle_8f`、`run_cycle_8f`、`jump_in_place_16f`、`crouch_16f`、`punch_right_12f`。

## 骨架生成方式

骨架阶段现在有两条路：

- `默认 / 映射 Humanoid_v1`：用于 IK/FK 控制器、Walk_8F 动作模板、验证和导出。导入带骨骼的 T-Pose GLB 后，可以把标准关节点拖到导入模型骨骼上，Humanoid_v1 会吸附到导入骨骼的 T-Pose 坐标。
- `视觉辅助适配骨架`：用于保留导入模型原始骨骼数量和父子层级。软件会把模型透明度设为 50%，叠加源骨骼点，生成 `SourceRig_v1`。这个模式用于骨骼识别和适配确认，不直接套 Walk_8F 模板。
- 如果导入的 GLB 实际没有 glTF `skins / joints`，软件会明确显示诊断结果，例如 `GLB skins: 0`。这类文件是静态网格，不能读取原始骨骼；此时 `视觉辅助适配骨架` 会按模型轮廓估算一套 `Humanoid_v1`，再进入 IK 阶段。

视口操作参考 Blender：

- 中键旋转视图
- Shift + 中键平移
- Ctrl + 中键或滚轮缩放
- Alt + 左键可作为没有中键时的替代旋转方式

## 第一阶段范围

已实现：

- 固定命名 Humanoid_v1 骨架。
- 14 个 IK / Control Rig 控制器和 19 个 FK 骨骼控制器。
- 8 个走路关键姿势。
- 站立呼吸、走路、跑步、跳跃、下蹲、右拳基础动作模板。
- 24 FPS / 1-24 时间轴播放。
- 动作验证。
- 动作 JSON 导出 / 导入。
- command_log / undo_stack / redo_stack。

暂不做：

- LLM 接入
- MCP 接入
- 权重笔刷
- 自动蒙皮
- 视频动捕
- GLB 自动绑定
- 怪物骨架模板
- 大规模动作模板库
