struct Uniforms {
    resolution: vec2<f32>,
    time: f32,
    speed: f32,
    scale: f32,
    scaleX: f32,
    amount: f32,
    direction: f32,
    use_mask: f32,
    _padding: f32, // 添加padding以满足16字节对齐
};

@group(0) @binding(0) var sourceTexture : texture_2d<f32>;
@group(0) @binding(1) var maskTexture : texture_2d<f32>;
@group(0) @binding(2) var noiseTexture : texture_2d<f32>;
@group(0) @binding(3) var sampler0 : sampler;
@group(0) @binding(4) var repeatSampler : sampler;
@group(0) @binding(5) var<uniform> uniforms : Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) noiseCoord: vec2<f32>,
};

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;

    // 计算噪声坐标，考虑宽高比
    var noiseCoord = o.uv;
    noiseCoord.x *= uniforms.resolution.x / uniforms.resolution.y;

    // 应用缩放
    noiseCoord *= uniforms.scale;
    noiseCoord.x *= uniforms.scaleX;

    // 添加时间动画
    noiseCoord.x += uniforms.time * uniforms.speed;

    o.noiseCoord = noiseCoord;
    return o;
}

fn rotateVec2(v: vec2<f32>, angle: f32) -> vec2<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return vec2<f32>(
        v.x * c - v.y * s,
        v.x * s + v.y * c
    );
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>, @location(1) noiseCoord: vec2<f32>) -> @location(0) vec4<f32> {
    // Sample noise texture with animated coordinates using repeat sampler
    let noise = textureSample(noiseTexture, repeatSampler, noiseCoord).rgb;

    // Get initial mask value
    var mask = 1.0;
    if uniforms.use_mask > 0.5 {
        let maskSample = textureSample(maskTexture, sampler0, uv);
        mask = maskSample.r; // 使用红色通道而不是alpha通道
    }

    // Calculate offset based on noise, scaled by mask
    var offset = vec2<f32>((noise.x * 2.0 - 1.0) * uniforms.amount * mask, 0.0);
    offset = rotateVec2(offset, uniforms.direction + 1.57079632679);

    var uvs = uv + offset;

    // Sample mask at offset position for smooth blending
    if uniforms.use_mask > 0.5 {
        let dstMaskSample = textureSample(maskTexture, sampler0, uvs);
        let dstMask = dstMaskSample.r; // 使用红色通道
        uvs = mix(uv, uvs, dstMask);
    }

    // Sample source texture with distorted UV
    let albedo = textureSample(sourceTexture, sampler0, uvs);

    return albedo;
}
