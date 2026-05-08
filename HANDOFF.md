# 动作快速调整器 Demo 交接文档

## 项目定位

这是一个独立软件方向的 Web MVP，用于验证 GLB 角色骨骼搭建、姿势调整、权重预览/笔刷和关键帧动作编辑逻辑。当前不是 Blender 插件，也不依赖 Godot 场景；后续可用 Electron 打包成 Windows EXE。

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

也可以双击 `start_demo.bat` 启动本地静态服务器。

## 主要文件

- `index.html`：中文单页界面，左侧模型视图、右侧参数面板、底部帧时间轴。
- `styles.css`：界面布局、控制面板、时间轴和工具按钮样式。
- `app.js`：Three.js 场景、GLB 导入、骨骼显示、Pose/Edit/Weight/Motion 逻辑。
- `scripts/validate_demo_import.mjs`：自动导入用户 GLB 并做回归验证。
- `sample_models/stylized_3d_character_model.glb`：本项目内置测试模型。
- `CURRENT_STATE.md`：开发过程状态记录和最近修复点。

## 当前已实现

- 导入带骨骼 GLB，并从 SkinnedMesh 自动生成可编辑主骨架。
- Blender 风格基础操作：
  - `G` 移动。
  - `R` 旋转。
  - `S` 缩放。
  - `X/Y/Z` 轴约束。
  - `Ctrl+Z` 撤销。
  - 中键/右键/Alt+左键旋转视图，Shift+中键/右键平移视图。
- 旋转环、移动箭头、缩放手柄优先拾取，避免点到下面的骨骼控制点。
- 骨骼节点使用方块、嵌入式骨段和方向箭头，方向性比球形节点更清楚。
- 骨骼粗细、节点大小、人物透明度、骨骼透明度可调。
- Pose 模式 `G` 默认保持骨长：
  - 中间关节移动使用 IK 样式调整。
  - 真实 GLB 骨骼旋转，模型跟随。
  - 不会默认拉长骨段。
  - 同侧链隔离，拖右腿不会带动左腿。
- 右侧提供 `允许 G 拉长骨骼` 开关：
  - 默认关闭用于正常摆姿势。
  - 打开后允许改骨长，源骨骼会旋转/缩放，模型也跟随。
- 权重模式：
  - 先选择目标骨骼，再切换笔刷涂刷。
  - 模型变成权重预览色。
  - 当前骨骼权重、其他已绑定区域、无权重区域分色显示。
  - 末端关节例如 `R_Foot` 会显示脚掌权重，不再误显示小腿。
- 24 帧动作时间轴：
  - 可选择具体帧。
  - 可保存当前帧。
  - 已保存帧可见。
  - 播放时会插值真实 GLB 骨骼变换。
- 走路模板：
  - 根据角色骨骼方向推导前进方向。
  - 可生成基础走路关键帧。
  - 可预览和继续手动调整。

## 验证结果

最近一次完整验证：

```powershell
node --check app.js
node --check scripts\validate_demo_import.mjs
npm run check
npm run validate:import
```

结果全部通过。

`validate:import` 已验证：

- 从 `C:\Users\bodean\Downloads\stylized+3d+character+model.glb` 文件导入成功。
- 从 `sample_models/stylized_3d_character_model.glb` 按钮导入成功。
- WebGL 正常。
- 旋转环优先于骨骼拾取。
- `R_Foot` 拖动不影响 `L_Foot`、`L_Calf`、`Hip`。
- 中间关节 `G` 默认保持骨长。
- 打开 `允许 G 拉长骨骼` 后，拉长变成显式可选行为。
- `R_Foot` 权重预览目标是 `R_Foot`，不包含 `R_Calf`。
- 手动关键帧保存和播放插值能驱动模型。

## 当前限制

- 这是 MVP，不是最终商业版编辑器。
- 权重笔刷当前主要是预览和交互验证，尚未完整写回 glTF skinWeight buffer 并导出。
- 还没有 GLB/FBX 动画导出，只提供 JSON 预览结构。
- 没有 Electron 打包配置，EXE 化需要下一阶段补 `electron-builder` 或类似方案。
- IK 目前是简化链路，适合验证角色四肢交互，后续应增加约束、极向量和关节限位。

## 下一阶段建议

1. 加入真实权重写回和归一化，确保刷权重后可以导出 GLB。
2. 加入动画导出，把关键帧转成 glTF animation sampler/channel。
3. 增加更完整的 IK 控制器：极向量、锁轴、关节角度限制。
4. 做 Electron 打包，生成 Windows EXE。
5. 增加项目保存/打开格式，保存骨架、权重、关键帧和 UI 参数。
