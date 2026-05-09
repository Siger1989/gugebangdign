# 交接：手动方向为准的 GLB 动作流程

## 当前结论

导入 T-Pose GLB 后，方向不再自动猜。用户先用模型旋转按钮把角色正面对准黄色地图前方箭头，再点击 `确认方向`。之后 `绑定骨骼赋值` 只读取当前已经摆正的源骨骼世界坐标，不再二次翻转或重新推断方向。

## 当前工作流

1. `导入模型`
2. 用 `模型左转15° / 模型右转15° / 模型转身180°` 摆正模型方向
3. `确认方向`
4. `绑定骨骼赋值`
5. `生成 IK 控制器`
6. `加载 Walk_8F 走路模板`
7. 播放、保存关键帧、验证、导出

## 本轮关键修改

- 去掉 GLB 导入时的自动方向推断。
- 方向状态只保留用户调整后的 `yaw_degrees`，`forward_sign` 固定为兼容旧 JSON 的 `1`。
- `绑定骨骼赋值` 使用当前可见模型姿态下的源骨骼世界坐标。
- `syncSourceRigToMotionState()` 在初次绑定静止姿态时不再驱动导入模型自己的骨骼，避免绑定后角度跳动。
- Walk_8F 基于已经绑定后的骨架数据生成，不再额外反向。
- `getRigBasis()` 在确认方向后固定使用地图坐标：X=右、Y=上、Z=前。
- `estimateHumanoidBasisFromPositions()` 在确认方向后也使用同一套固定地图基准。
- EXE 增加 Electron 原生文件选择器：
  - `electron-main.cjs`
  - `electron-preload.cjs`
  - `window.desktopBridge.openGlbFile()`
- 顶部无实际功能的 `文件 / 编辑 / 视图 / 动作 / 导出 / 帮助` 文本已移除。
- 控制器分层：
  - `重心` 控制整体。
  - `胯部` 控制下半身和腿。
  - `胸腰` 控制上半身。

## 验证结果

- `npm run check`: PASS
- `npm run validate:import`: PASS
- 最新验证截图：
  - `artifacts/screenshots/pipeline_acceptance_20260509_171602Z.png`
- EXE 启动测试：PASS
- 最新 EXE：
  - `release-fixed5/动作生成工作台 0.1.0.exe`

## 需要继续注意

- 如果用户说方向仍然反，优先检查用户是否已经在 `确认方向` 前把模型正面对准黄色箭头。
- 不要再恢复自动方向猜测作为默认流程。
- 后续可以增加一个“按当前视图辅助转向”的可选按钮，但不能覆盖用户手动确认后的方向。
