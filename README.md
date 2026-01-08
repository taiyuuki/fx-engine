# FX-Engine

基于 WebGPU 的实时特效引擎，支持为图片添加各种视觉效果，并支持导出视频。

效果基本都是参(chao)考(xi) [Wallpaper Engine](https://www.wallpaperengine.io/) 的内置效果，我将它们从GLSL移植到了WGSL。

**需要说明的是，我的初衷并不是实现一个类似Wallpaper Engine的壁纸引擎**，我也没时间、没能力去实现。虽然理论上确实可以通过平台端封装，将画布装渲染到桌面充当壁纸，但本项目主要目的是还为了展示 [wgsl-renderer](https://github.com/taiyuuki/wgsl-renderer) 这个库的使用，它是一个多通道的WGSL渲染器，通过本项目，你就能大概知道它能做什么，如果你想在自己的网站中使用WebGPU渲染一些酷炫的着色器效果，可以参考本项目并借助wgls-renderer来实现。

## 特性

- **WebGPU 加速** - 使用 WGSL 着色器实现高性能 GPU 渲染
- **多图层支持** - 可以添加多个图层，每个图层都可以添加多个效果。
- **参数可调** - 每个效果都有丰富的可调参数
- **蒙版支持** - 部分特效支持 Alpha 蒙版、Flow 蒙版，控制效果影响区域，并支持手动绘制
- **项目保存** - 支持保存和加载项目文件
- **视频导出** - 支持导出为 WebM 视频

## 效果列表

| 特效名称 | 描述 | 主要参数 |
|---------|------|---------|
| **光标波纹** | 鼠标移动产生的水波纹效果 | 波纹大小、速度、衰减、强度、边界反射、着色 |
| **水波纹** | 持续的水面波纹动画 | 速度、密度、强度 |
| **水流动** | 流动的水波效果 | 速度、方向、密度 |
| **视差** | 基于深度图的视差效果 | 强度、平滑度 |
| **反射** | 倒影反射效果 | 反射强度、透明度 |
| **折射** | 基于法线图的折射效果 | 折射强度 |
| **着色** | 颜色叠加效果 | 颜色、混合模式 |
| **滚动** | 自动滚动效果 | X/Y 方向速度 |
| **云动** | 云层飘动效果 | 速度、缩放、方向 |
| **摇动** | 画面抖动效果 | 强度、速度 |
| **虹膜移动** | 眼睛跟随鼠标移动 | 瞳孔位置 |
| **水波** | 波浪起伏效果 | 振幅、频率、速度 |

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 生产构建

```bash
pnpm build
```

## 📖 使用说明

### 基本工作流程

1. **导入图片** - 点击"打开图片"或拖拽图片到应用
2. **添加特效** - 从特效面板选择要应用的特效
3. **调整参数** - 在右侧面板调整特效参数
4. **预览效果** - 在画布上移动鼠标查看交互效果
5. **导出视频** - 点击"导出视频"保存为 WebM 格式

## 🛠️ 技术栈

- **框架**: [Quasar](https://quasar.dev/) - Vue 3 UI 框架
- **渲染**: [wgsl-renderer](https://github.com/taiyuuki/wgsl-renderer) - WebGPU 渲染器
- **着色器**: WGSL (WebGPU Shading Language)
- **视频导出**: webm-muxer - WebM 视频封装

## 📁 项目结构

```
fx-engine/
├── public/effects/        # WGSL 着色器文件
├── src/
│   ├── effects/           # 特效 TypeScript 实现
│   ├── pages/             # 页面组件
│   ├── stores/            # Pinia 状态管理
│   └── utils/             # 工具函数
└── quasar.config.ts       # Quasar 配置
```

## 特效开发

### 添加新特效

1. 在 `src/effects/` 创建新的特效文件
2. 在 `public/effects/` 创建对应的 WGSL 着色器
3. 实现 `createXXXEffect` 函数
4. 在 `src/effects/index.ts` 中导出

### 着色器示例

```wgsl
struct Uniforms {
    param1: f32,
    param2: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var inputTexture : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(inputTexture, samp, uv);
    // 处理逻辑
    return color;
}
```

## 📝 许可证

MIT License

## 参考与致谢

- [Wallpaper Engine](https://www.wallpaperengine.io/)
- [Quasar Framework](https://quasar.dev/)
- [WebGPU](https://www.w3.org/TR/webgpu/)
- [WGSL](https://www.w3.org/TR/WGSL/)
