struct Uniforms {
    canvas_res: vec2<f32>,
    scroll: vec2<f32>,
    time: f32,
    scale: f32,
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
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;
    return o;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let scroll = uniforms.scroll;
    let scroll_uv = sign(scroll) * pow(vec2<f32>(scroll.x, scroll.y), vec2<f32>(2.0)) * uniforms.time;
    return textureSample(tex, samp, fract(uv + scroll_uv) * uniforms.scale);
}