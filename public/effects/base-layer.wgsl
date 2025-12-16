struct Uniforms {
    canvas_res: vec2<f32>,
    image_res: vec2<f32>,
    origin: vec2<f32>,
    scale: vec2<f32>,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var samp : sampler;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);

    // 将屏幕空间坐标转换为纹理坐标
    // 考虑原点位置、缩放比例
    var screenPos = p.xy;
    screenPos = screenPos * uniforms.canvas_res * 0.5 + uniforms.canvas_res * 0.5;

    // 转换到图像坐标系（考虑原点和缩放）
    var imagePos = (screenPos - uniforms.origin) / uniforms.scale;

    // 转换为纹理坐标（0-1范围）
    o.uv = imagePos / uniforms.image_res;
    o.uv.y = 1.0 - o.uv.y; // 翻转Y轴

    return o;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // 检查UV是否在有效范围内
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        discard;
    }

    return textureSample(tex, samp, uv);
}