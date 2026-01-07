struct Uniforms {
    resolution: vec2<f32>,
    ripple_speed: f32,
    ripple_decay: f32,
    frame_time: f32,
    use_mask: f32,
};

// Vertex shader outputs
struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Simulate Force Pass
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var force_texture : texture_2d<f32>;
@group(0) @binding(2) var mask_texture : texture_2d<f32>;
@group(0) @binding(3) var samp : sampler;

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;
    return o;
}

fn sample_force(a: vec4<f32>, b: vec4<f32>, c: vec4<f32>) -> vec4<f32> {
    return max(a, max(b, c));
}

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let sim_texel = 1.0 / uniforms.resolution;
    let ripple_offset = sim_texel * 100.0 * uniforms.ripple_speed * min(1.0 / 30.0, uniforms.frame_time);

    let inside_ripple = ripple_offset * 1.61;
    let outside_ripple = ripple_offset;

    let uc = textureSample(force_texture, samp, uv + vec2<f32>(0.0, -inside_ripple.y));
    let u00 = textureSample(force_texture, samp, uv + vec2<f32>(-outside_ripple.x, -outside_ripple.y));
    let u10 = textureSample(force_texture, samp, uv + vec2<f32>(outside_ripple.x, -outside_ripple.y));

    let dc = textureSample(force_texture, samp, uv + vec2<f32>(0.0, inside_ripple.y));
    let d01 = textureSample(force_texture, samp, uv + vec2<f32>(-outside_ripple.x, outside_ripple.y));
    let d11 = textureSample(force_texture, samp, uv + vec2<f32>(outside_ripple.x, outside_ripple.y));

    let lc = textureSample(force_texture, samp, uv + vec2<f32>(-inside_ripple.x, 0.0));
    let l00 = textureSample(force_texture, samp, uv + vec2<f32>(-outside_ripple.x, -outside_ripple.y));
    let l01 = textureSample(force_texture, samp, uv + vec2<f32>(-outside_ripple.x, outside_ripple.y));

    let rc = textureSample(force_texture, samp, uv + vec2<f32>(inside_ripple.x, 0.0));
    let r10 = textureSample(force_texture, samp, uv + vec2<f32>(outside_ripple.x, -outside_ripple.y));
    let r11 = textureSample(force_texture, samp, uv + vec2<f32>(outside_ripple.x, outside_ripple.y));

    let up = sample_force(uc, u00, u10);
    let down = sample_force(dc, d01, d11);
    let left = sample_force(lc, l00, l01);
    let right = sample_force(rc, r10, r11);

    let component_scale = 1.0 / 3.0;
    // let decay = 1.5;
    // let drop = max(1.001 / 255.0, decay / 255.0 * (uniforms.frame_time / 0.02) * uniforms.ripple_decay);

    var force = vec4(up.x + down.x + left.x,
        up.z + left.y + right.y,
        up.y + down.z + right.z,
        down.w + left.w + right.w) * component_scale;

    // 应用衰减
    // force *= drop;

    // 更改衰减计算方式
    let damping = 1.0 - (0.02 * uniforms.ripple_decay * (uniforms.frame_time / 0.02));
    force *= max(0.95, damping);

    if uniforms.use_mask > 0.5 {
        let inv_mask_center = step(0.01, textureSample(mask_texture, samp, uv).r);
        force *= inv_mask_center;
    }

    return force;
}