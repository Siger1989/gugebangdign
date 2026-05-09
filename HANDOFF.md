# 动作生成流水线工具交接文档

## 2026-05-09 当前交接：方向绑定修正 + EXE 输出

本轮目标已经完成到可本地测试：

- 导入工作流收敛为一个入口：顶部 `导入模型` 负责打开 GLB 文件选择，右侧不再重复放一个可见导入按钮。
- 骨骼识别收敛为一个绑定动作：确认固定地图前方后，点击 `绑定骨骼赋值`。
- 黄色箭头现在表示固定的地图前方，不再表示一个会跟着角色推断结果乱转的“角色前方”。
- `create_humanoid_skeleton` 对导入 GLB 增加方向确认拦截：未确认方向时不允许绑定 Humanoid_v1。
- 修复了前后方向翻转导致 `basis.right` 反转的问题。现在前后可反，左右身份不跟着交换，Walk_8F 后右手/左手 IK 保持各自侧向。
- 添加 Electron 桌面壳：
  - `electron-main.cjs`
  - `npm run desktop`
  - `npm run dist:win`
- 已生成 Windows EXE：
  - 单文件便携版：`release/动作生成工作台 0.1.0.exe`
  - 目录版：`release-dir/win-unpacked/动作生成工作台.exe`
- 用户复现“确认方向后绑定骨骼，角度又跳回去”的问题后，已追加修复：
  - 方向调整现在直接作用到 `Runtime.importedModelScene` 本体。
  - 绑定读取的是对齐后的源骨骼世界坐标，不再读取未旋转的原始坐标。
  - 最新便携版输出为：`release-fixed2/动作生成工作台 0.1.0.exe`

验证：

- `npm run check`：PASS
- `npm run validate:import`：PASS
- 最新截图：`artifacts/screenshots/pipeline_acceptance_20260509_150343Z.png`
- Electron smoke test：PASS，`electron .` 能打开 file 模式桌面窗口并加载 `#rigCanvas`。
- 两个 EXE 都做过启动 smoke test，进程可正常保持运行。
- 最新 `release-fixed2/动作生成工作台 0.1.0.exe` 也已做启动 smoke test。

注意：

- `npm run dist:win` 已生成便携 EXE，但最后清理 `release/codex-action-rig-demo-0.1.0-x64.nsis.7z` 时 Windows 报文件锁，命令返回非 0。文件本身已生成并能启动。
- 为了获得干净的成功构建，额外运行了目录版构建：`npx electron-builder --win dir --config.directories.output=release-dir`。
- 如果后续要推 GitHub，建议提交源码、打包配置和交接文档；`release/`、`release-dir/`、`dist/` 这类大体积产物是否入库需要先确认。

## 2026-05-09 当前交接：先暂停功能，上传当前状态

当前用户要求先写交接并上传 GitHub，功能修复暂时停止在“旋转 Gizmo 手柄可选中”问题前。

### 当前用户正在反馈的问题

- 选中控制器后按 `R`，界面能显示白色视图旋转圈和 `X/Y/Z` 彩色旋转圈。
- 但这些旋转圈目前主要还是视觉提示，不能像 Blender 一样直接点击某一个圈作为旋转手柄。
- 用户期望：
  - 点击蓝/绿/红旋转圈后，按对应轴旋转当前选中的 Control Rig 控制器。
  - 点击白色外圈或内圈后，按当前视角轴旋转。
  - 这些操作最终都必须走 `set_control_transform`，并写入 `command_log`，支持 undo/redo。

### 本地代码状态

- `E:\codex骨骼软件\app.js` 已经有一段未发布的半成品改动：
  - `renderTransformGizmo()` 给旋转圈传入了 `mode / axis_key / control_id` 这类 pick metadata。
  - 这段改动本身不会完成拾取，因为 `createGizmoRing()` 仍未创建可 raycast 的粗命中圈。
  - `onPointerDown()` 仍未优先检测 `gizmoGroup` 的旋转圈命中。
- 因此下一步不应继续叠功能，而应补齐：
  - `createGizmoRing(..., pickData)` 生成细视觉圈 + 透明粗 hit ring。
  - `getTransformGizmoPick(event)` 对 `gizmoGroup` 做 raycast。
  - `onPointerDown()` 在 Transform 模式下优先处理 gizmo ring pick。
  - ring pick 后设置 `MotionState.transform.axis` 为 `x/y/z` 或 `null(view)`，并从当前鼠标点重新建立本次旋转 baseline，避免点击瞬间抖动。

### 建议下一步验收

1. 选择 `COG_CTRL`。
2. 按 `R`。
3. 点击绿色 `Y` 旋转圈并拖动，控制器应绕 Y 轴旋转。
4. 点击白色视图圈并拖动，控制器应绕当前摄像机视图轴旋转。
5. 松开左键后，`command_log` 出现成功的 `set_control_transform`。
6. `Ctrl+Z` 能回退这次旋转。
7. `npm run validate:import` 增加一条自动化覆盖：通过 debug API 取旋转圈屏幕坐标，模拟点击拖动并确认命令提交。

## 2026-05-09 最新交接重点

- 页面主流程已整理为中文：`模型 -> 骨架/方向 -> 映射校正 -> 控制器层 -> 动作模板 -> 验证 -> 导出`。
- 主视口显示开关已简化，只保留模型、骨架参考、控制器、变换手柄、地面、问题提示；调试项默认隐藏。
- `生成参考骨架` 会停留在 `骨架/方向`，不会再自动跳到控制器层。
- 导入 GLB 后必须先确认黄色角色前方箭头，才能创建控制器层；这可以避免方向未确认时创建 Rig 后看起来前后反了。
- 黄色角色前方箭头在骨架、映射、控制器层、动作模板阶段都会继续显示，方便随时确认方向状态。
- 控制器和 Transform Gizmo 线宽已大幅变细；默认控制器线粗为 `0.28`，右上角仍可调。
- 旋转方向已反向修正：鼠标拖动方向应与模型可见旋转方向一致。
- Walk_8F 增加防交叉规则：手 IK 目标按各自肩膀外侧下垂，不再用全局左右偏移导致双手穿胸交叉；验证覆盖 dummy 和导入 sample GLB。
- `R` 键交互补齐为 Blender 风格：进入旋转模式后鼠标移动实时旋转；左键释放或 Enter 确认，右键或 Esc 取消。旋转时显示外圈、内圈、XYZ 彩色环和从控制器拖出的白色半径线。
- 视口地面层增加了 XYZ 场景轴提示。
- Walk_8F 会把 T-Pose 横向展开的手臂先约束到身体两侧附近，再应用走路摆臂；Pole 控制器会按当前角色前方重新放置为膝盖在前、手肘在后。
- 控制器显示已经从调试盒子改成轻量 Control Rig：圆环、线段、三角 Pole、脚底/手腕面片。
- `Labels` 默认关闭；打开后也只显示当前选中或鼠标悬停的控制器标签。
- 右上视图控制增加了模型透明、骨架透明、控制器透明、控制器大小、控制器线粗。
- `R` 键默认按当前视图角度旋转；按 `X/Y/Z` 后才进入轴向旋转约束。
- `G` 移动手脚 IK 时会保留 IK target 控制器位置，不再被两骨 IK 末端长度限制直接吸回。
- `COG_CTRL` / `Root_CTRL` / `Global_CTRL` 旋转现在会驱动 Hips 分支，腰部/重心控制器能扭动身体。
- IK Pole 默认规则：膝盖 Pole 在角色前方，手肘 Pole 在角色后方。
- Walk_8F 模板不再因为未手动确认角色前方而失败；如果未确认，会使用当前前方并自动标记 confirmed。
- 最新验证：`npm run validate:import` 通过，截图 `artifacts/screenshots/pipeline_acceptance_20260509_095328Z.png`。

## 项目定位

当前项目不是完整 3D 编辑器，也不是 Blender 插件。它是一个面向角色动作生成的 Web MVP，目标是先打通稳定闭环：

```text
导入/加载模型
-> 读取或确认人形骨骼
-> 确认角色前方 / 必要时前后反转
-> 创建 Control Rig
-> 应用 Walk_8F 走路模板
-> 手动调整 Control Rig
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
   - 导入 GLB 后必须确认 `角色前方`；如果走路方向反了，点击 `前后反转` 后再套动作。

3. `Control Rig` 阶段：
   - 创建 14 个主要 Control Rig 控制器。
   - 默认只显示主要 Control Rig；19 个关节控制器保留为 Joint Debug，默认隐藏。
   - `Global_CTRL` / `Root_CTRL` / `COG_CTRL` / `Pelvis_CTRL` / `Chest_CTRL` / `Head_CTRL` 必须存在。
   - 手脚 IK 和膝/肘 Pole 仍用于末端和弯曲方向控制。
   - 视口拖拽、G/R/S 键盘变换都通过 `set_control_transform` 修改控制器。

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
- `direction`
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
- `set_character_direction`
- `create_ik_controls`
- `apply_motion_template`
- `set_control_transform`
- `set_ik_target`
- `set_joint_position`
- `rotate_joint_branch`
- `scale_joint_branch`
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

## Control Rig 和关节点 Debug

当前主要 Control Rig 控制器：

- `Global_CTRL`
- `Root_CTRL`
- `COG_CTRL`
- `Pelvis_CTRL`
- `Chest_CTRL`
- `Head_CTRL`
- `R_Foot_IK`
- `L_Foot_IK`
- `R_Hand_IK`
- `L_Hand_IK`
- `R_Knee_Pole`
- `L_Knee_Pole`
- `R_Elbow_Pole`
- `L_Elbow_Pole`

当前关节 Debug 控制器：

- 每个 `Humanoid_v1` 标准关节点都有一个 `${JointName}_CTRL`。
- 这 19 个控制器只作为 Debug Display 使用，默认不铺在视口里。
- 状态栏显示为 `14 Rig + 19 Debug`，导出的 Motion JSON 中两类控制器都会保存。
- 默认操作对象是 Control Rig，不是 Deform Skeleton。

当前 IK 行为：

- `COG_CTRL` 控制整体重心移动。
- `Pelvis_CTRL` 控制骨盆摆动和旋转。
- `Chest_CTRL` 控制胸腔扭转。
- 手 IK 解两段链：上臂 -> 前臂 -> 手。
- 脚 IK 解两段链：大腿 -> 小腿 -> 脚，并保持脚尖相对偏移。
- Pole 控制肘/膝弯曲方向；膝盖 Pole 跟随已确认的角色前方，避免默认放到后面。
- `Global_CTRL` / `Root_CTRL` 用于整体移动和 root motion。
- Hips / Spine / Chest / Neck / Head 的旋转会写入 `joint_rotations`，用于处理绕自身轴线旋转时“关节位置没变但模型需要扭转”的情况。
- 视口拖拽结束后记录 `set_control_transform` 命令。

普通关节点控制：

- 关节点显示小方块、插槽和方向箭头。
- 可在视口拖动关节点。
- 拖动结束后记录 `set_joint_position` 命令。
- 子链会跟随被拖动关节点，同时保留父骨段长度。
- 选中 Control Rig 控制器后，可用 `G` / `R` / `S` 进入移动、旋转、缩放式调整。
- `X` / `Y` / `Z` 在变换中约束轴向，顶部按钮可切换 Local / Global。
- 鼠标悬停控制器会先高亮，点击只负责选中；只有拖动超过阈值才开始实际变换，避免点击时骨骼跳动。

如果需要直接查看或调试普通关节点，打开顶部 `Joint Debug` 显示开关。

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
- `R_Toe` / `L_Toe` 是可选映射；如果导入模型没有独立脚尖骨骼，只要核心关节完整，程序会按脚掌、腿部和角色前方自动补出脚尖点。此时 `17 / 19（脚尖自动补）` 可以继续创建 IK 和 Walk_8F。
- Walk_8F 和 IK 不是控制一套孤立默认骨架，而是通过映射驱动导入模型自己的源骨骼。
- 导入模型初始方向只作为推断值，`Walk_8F` 应用前必须在骨架阶段确认角色前方。
- `前后反转` 会切换 `MotionState.direction.forward_sign`，并清空旧关键帧，避免复用错误方向动作。
- 如果自动推断的前方轴本身有角度偏差，可用骨架面板里的角度滑杆或 `左转15°` / `右转15°` 修正；这个角度保存在 `MotionState.direction.yaw_degrees`。
- 导出的 Motion JSON 包含 `direction.forward_sign`、`direction.yaw_degrees`、`direction.confirmed`，重新导入时会恢复前方方向状态。

已验证示例：

```text
C:\Users\sigeryang\Downloads\female+figure+3d+model.glb
```

验证结果：

- 源骨骼：41
- GLB skins：1
- GLB joints：41
- 人形映射：19 / 19
- Control Rig：14 个主控制器 + 19 个 Joint Debug 控制器
- Walk_8F 关键姿势：8

## 视口操作

当前参考 Blender 基础方式：

- 中键旋转视图；旋转时锁定当前 camera distance，不会改变远近。
- `Shift + 中键` 平移。
- `Ctrl + 中键` 或滚轮缩放。
- 没有中键时可用 `Alt + 左键` 替代旋转。
- 左键拖 Control Rig 控制器。
- 普通关节点默认不可操作；需要时打开 `Joint Debug`。
- 选中控制器后，视图围绕该控制器/关节点旋转。
- 缩放范围已放宽，可以比早期版本更贴近模型检查。

可调显示：

- Model。
- Deform Skeleton。
- Control Rig。
- IK Controls。
- Joint Debug。
- Labels。
- Transform Gizmo。
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
- 导入 `sample_models/stylized_3d_character_model.glb` 后，`17 / 19` 映射会通过脚尖 fallback 创建 Humanoid_v1、14 个主 Control Rig 控制器、19 个 Joint Debug 控制器和 8 个 Walk_8F 关键帧。
- `set_control_transform(COG_CTRL)` 会写入 command log，undo / redo 覆盖该状态。
- Walk_8F 关键帧包含 `COG_CTRL`、`Pelvis_CTRL`、`Chest_CTRL` 控制器数据，不再只保存手脚 IK。
- 导入同一 GLB 后执行 `rotate_joint_branch(Hips)`，源骨骼 Hips 世界四元数会变化，验证腰部显式旋转已传递到模型源骨骼。
- 导入 GLB 后，未确认角色前方时应用 Walk_8F 会被阻止并给出明确错误。
- 确认角色前方后，Walk_8F 可正常创建 8 个关键帧。
- `前后反转` 会清空旧关键帧，等待重新应用方向正确的 Walk_8F。
- 中键旋转会改变 yaw/pitch，但 camera distance 保持不变。
- 视口拖 Control Rig：记录 `set_control_transform` 成功。
- Joint Debug 模式下仍可测试普通关节点拖动。
- 保存第 5 帧：成功创建额外关键帧。
- 平滑第 4 到第 5 帧：成功设置 smooth 插值。
- 导入 `female+figure+3d+model.glb` 后源骨骼映射、IK、Walk_8F 通过验证。

## 当前限制

- 当前只实现第一阶段动作生成闭环，不是完整动画软件。
- 动作模板只支持 `walk_cycle_8f`。
- 真实 glTF animation sampler/channel 导出尚未实现，目前导出 Motion JSON。
- IK 是两段链 MVP，后续需要加入关节限位、锁轴、脚底锁定优化和更稳定的 Pole 约束。
- 源骨骼映射对不同 GLB 命名风格仍需人工确认面板继续增强。
- 角色前方目前是人工确认/前后反转，不做复杂自动视觉识别定向。
- Electron / EXE 打包未做。

## 建议下一步

1. 加强源骨骼映射确认面板，支持更明确的拖拽吸附和错误提示。
2. 加入脚底锁定的真实约束逻辑，减少走路脚滑。
3. 增加手脚 IK 的轴向限制和关节角度限制。
4. 把 Motion JSON 转成 glTF animation 并导出。
5. 做项目保存/打开格式，保存映射、IK、关键帧和显示参数。
6. 再考虑 LLM、MCP、视频动捕或复杂动作模板库。

## 2026-05-09 手动方向绑定更新

当前方向流程已简化：

1. 导入带骨骼的 T-Pose GLB。
2. 用模型旋转按钮把角色正面对准场景里的黄色地图前方箭头。
3. 点击 `确认方向`。
4. 点击 `绑定骨骼赋值`，系统只读取当前已摆正状态下的源骨骼世界坐标。
5. 生成 IK 控制器，再加载 Walk_8F。

关键变更：

- GLB 导入后不再自动猜前方，默认 `yaw_degrees: 0`、`confirmed: false`。
- `forward_sign` 固定为 `1` 以兼容旧 Motion JSON，不再作为前后翻转逻辑使用。
- `getRigBasis()` 在确认方向后固定使用地图坐标：X=右、Y=上、Z=前。
- 绑定时不再二次旋转、翻转或重新推断方向，避免点击绑定后模型角度跳变。
- EXE 已接入 Electron 原生文件选择器，可以在桌面版导入 GLB。
- 顶部无实际功能的菜单文字已移除。
- `重心`、`胯部`、`胸腰` 控制已拆开：重心控制整体，胯部偏下半身，胸腰偏上半身。

最新验证：

- `npm run validate:import`: PASS
- 截图：`artifacts/screenshots/pipeline_acceptance_20260509_171602Z.png`
- 最新 EXE：`release-fixed5/动作生成工作台 0.1.0.exe`
- EXE 启动烟测：PASS
