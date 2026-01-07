struct Uniforms {
    ripple_strength: f32,
};

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;
@group(0) @binding(2) var sourceTexture : texture_2d<f32>;
@group(0) @binding(3) var rippleTexture : texture_2d<f32>;

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;
    return o;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {

    var albedo = textureSample(rippleTexture, samp, uv);
    albedo *= albedo;

    let dir = vec2<f32>(albedo.x - albedo.z, albedo.y - albedo.w);

    let distort_amt = uniforms.ripple_strength * 0.1;
    var offset = dir;
    offset *= -0.1 * distort_amt;

    var screen = textureSample(sourceTexture, samp, uv + offset);
    return screen;
}