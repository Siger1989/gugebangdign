# 动作生成流水线工具交接文档

## 项目定位

当前项目不是完整 3D 编辑器，也不是 Blender 插件。它是一个面向角色动作生成的 Web MVP，目标是先打通稳定闭环：

```text
导入/加载模型
-> 读取或确认人形骨骼
-> 创建 IK 控制器
-> 应用 Walk_8F 走路模板
-> 手动调整关节/IK
-> 保存关键帧
-> 平滑关键帧段
-> 播放验证
-> 导出 Motion JSON
-> 撤销 / 重做
```

后续再接 LLM、MCP、自动绑定、复杂模板库或商业化打包。

## 运行方式

项目目录：

```powershell
cd D:\codex骨骼绑定
```

安装依赖：

```powershell
npm install
```

启动本地服务：

```powershell
npm run start
```

浏览器打开：

```text
http://localhost:8780/index.html
```

也可以双击：

```text
start_demo.bat
```

不要直接用 `file:///.../index.html` 打开。Three.js import map 和本地 GLB 资源需要通过 HTTP 静态服务加载。

## 当前主流程

1. `模型` 阶段：
   - 加载测试假人。
   - 导入 GLB。
   - 调整模型透明度。
   - 重置视角。

2. `骨架` 阶段：
   - 从导入 GLB 读取原始骨骼。
   - 自动推断 T-Pose 源骨骼结构。
   - 生成或映射 `Humanoid_v1`。
   - 支持源骨骼到标准人形关节的映射确认。

3. `IK 控制器` 阶段：
   - 创建 9 个 IK 控制器。
   - 支持手、脚、骨盆、肘/膝 Pole 控制。
   - 视口里可以拖 IK 控制器。
   - 视口里可以拖普通人形关节点。

4. `动作模板` 阶段：
   - 当前只支持 `walk_cycle_8f`。
   - 8 个关键姿势映射到 1-24 时间轴。
   - 可播放、停止、循环。
   - 可保存任意当前帧为关键帧。
   - 可平滑选中的关键帧段。

5. `验证 / 修正` 阶段：
   - 验证脚底滑动、膝盖翻转、循环断点、骨骼身份错误。

6. `导出` 阶段：
   - 导出 Motion JSON。
   - 导入 Motion JSON。

## Command API 架构

所有会修改动作状态的操作必须走：

```js
executeCommand(command)
```

UI 按钮和视口拖拽不能直接改 `MotionState`，只能创建命令再执行。

每个命令对象包含：

- `name`
- `args`
- `args_schema`
- `dry_run`
- `execute`
- `undo`
- `result`
- `error`

当前核心状态在 `MotionState`：

- `model`
- `source_bones`
- `humanoid_mapping`
- `skeleton`
- `bones`
- `joints`
- `ik_controls`
- `current_frame`
- `total_frames`
- `playback_fps`
- `keyframes`
- `motion_templates`
- `selected_bone`
- `selected_control`
- `command_log`
- `undo_stack`
- `redo_stack`
- `validation_report`
- `dirty_state`

已实现的主要命令：

- `load_test_dummy`
- `import_glb`
- `create_humanoid_skeleton`
- `create_source_skeleton_from_import`
- `assign_humanoid_mapping`
- `create_ik_controls`
- `apply_motion_template`
- `set_ik_target`
- `set_joint_position`
- `insert_keyframe`
- `smooth_keyframes_between`
- `validate_motion`
- `export_motion_json`
- `import_motion_json`
- `undo`
- `redo`
- `play`
- `stop`

## 人形骨架命名

`Humanoid_v1` 固定关节命名：

- `Hips`
- `Spine`
- `Chest`
- `Neck`
- `Head`
- `R_UpperArm`
- `R_Forearm`
- `R_Hand`
- `L_UpperArm`
- `L_Forearm`
- `L_Hand`
- `R_UpperLeg`
- `R_LowerLeg`
- `R_Foot`
- `R_Toe`
- `L_UpperLeg`
- `L_LowerLeg`
- `L_Foot`
- `L_Toe`

颜色规则：

- 右侧：暖色
- 左侧：冷色
- 中轴：绿色

左右身份不能根据视角或姿态临时交换。

## IK 和关节点控制

当前 IK 控制器：

- `Pelvis_CTRL`
- `R_Foot_IK`
- `L_Foot_IK`
- `R_Hand_IK`
- `L_Hand_IK`
- `R_Knee_Pole`
- `L_Knee_Pole`
- `R_Elbow_Pole`
- `L_Elbow_Pole`

当前 IK 行为：

- 手 IK 解两段链：上臂 -> 前臂 -> 手。
- 脚 IK 解两段链：大腿 -> 小腿 -> 脚，并保持脚尖相对偏移。
- Pole 控制肘/膝弯曲方向。
- 骨盆控制器移动整套骨架和 IK 控制器。
- 视口拖拽结束后记录 `set_ik_target` 命令。

普通关节点控制：

- 关节点显示小方块、插槽和方向箭头。
- 可在视口拖动关节点。
- 拖动结束后记录 `set_joint_position` 命令。
- 子链会跟随被拖动关节点，同时保留父骨段长度。

如果 IK 控制器遮挡普通关节点，可临时关闭顶部 `IK 控制器` 显示开关后再拖关节点。

## 时间轴

底部时间轴区分三件事：

- 关键姿势：Walk_8F 的 8 个模板姿势。
- 播放帧率：24 FPS。
- 时间轴帧：1-24。

Walk_8F 模板姿势：

- Frame 01 - 接触
- Frame 04 - 下沉
- Frame 07 - 经过
- Frame 10 - 上升
- Frame 13 - 对侧接触
- Frame 16 - 下沉
- Frame 19 - 经过
- Frame 22 - 上升

当前可操作：

- 拖动时间轴滑块切换当前帧。
- 点击 1-24 帧小格切换帧。
- `保存当前帧` 会把当前姿态写入该时间轴帧。
- 点击两个已保存关键帧后，点 `平滑当前段` 会把这两个帧之间设为平滑插值。
- 未选择两个关键帧时，平滑当前帧所在的相邻关键帧段。

## 源骨骼和 GLB

导入带骨骼 GLB 后：

- 程序会读取 glTF skin / joints。
- 生成源骨骼列表。
- 自动尝试映射到 `Humanoid_v1`。
- Walk_8F 和 IK 不是控制一套孤立默认骨架，而是通过映射驱动导入模型自己的源骨骼。

已验证示例：

```text
C:\Users\sigeryang\Downloads\female+figure+3d+model.glb
```

验证结果：

- 源骨骼：41
- GLB skins：1
- GLB joints：41
- 人形映射：19 / 19
- IK 控制器：9 / 9
- Walk_8F 关键姿势：8

## 视口操作

当前参考 Blender 基础方式：

- 中键旋转视图。
- `Shift + 中键` 平移。
- `Ctrl + 中键` 或滚轮缩放。
- 没有中键时可用 `Alt + 左键` 替代旋转。
- 左键拖 IK 控制器。
- 左键拖普通关节点。

可调显示：

- 骨架标签。
- IK 控制器。
- 骨骼颜色。
- 脚底锁定。
- 运动路径。
- 地面。
- 验证问题。

可调透明度：

- 模型透明度。
- 骨架透明度。
- 控制器透明度。

## 主要文件

- `index.html`：中文单页 UI、流程条、Inspector、底部时间轴。
- `styles.css`：紧凑 UI、视口覆盖控件、时间轴、调试面板样式。
- `app.js`：Three.js 场景、Command API、MotionState、GLB 导入、骨架/IK/时间轴/验证/导出逻辑。
- `scripts/validate_demo_import.mjs`：自动验收第一阶段流水线。
- `scripts/create_tutorial_video.mjs`：生成中文使用演示短片。
- `start_demo.bat`：Windows 一键启动本地静态服务。
- `CURRENT_STATE.md`：长期任务状态记录。
- `README.md`：项目说明和运行/验证说明。

## 验证命令

```powershell
npm run check
npm run validate:import
```

最近验证结果：

- `npm run check`：PASS。
- `npm run validate:import`：PASS。
- 视口拖 IK 控制器：记录 `set_ik_target` 成功。
- 视口拖普通关节点：记录 `set_joint_position` 成功。
- 保存第 5 帧：成功创建额外关键帧。
- 平滑第 4 到第 5 帧：成功设置 smooth 插值。
- 导入 `female+figure+3d+model.glb` 后源骨骼映射、IK、Walk_8F 通过验证。

## 当前限制

- 当前只实现第一阶段动作生成闭环，不是完整动画软件。
- 动作模板只支持 `walk_cycle_8f`。
- 真实 glTF animation sampler/channel 导出尚未实现，目前导出 Motion JSON。
- IK 是两段链 MVP，后续需要加入关节限位、锁轴、脚底锁定优化和更稳定的 Pole 约束。
- 源骨骼映射对不同 GLB 命名风格仍需人工确认面板继续增强。
- Electron / EXE 打包未做。

## 建议下一步

1. 加强源骨骼映射确认面板，支持更明确的拖拽吸附和错误提示。
2. 加入脚底锁定的真实约束逻辑，减少走路脚滑。
3. 增加手脚 IK 的轴向限制和关节角度限制。
4. 把 Motion JSON 转成 glTF animation 并导出。
5. 做项目保存/打开格式，保存映射、IK、关键帧和显示参数。
6. 再考虑 LLM、MCP、视频动捕或复杂动作模板库。
