struct Uniforms {
    resolution: vec2<f32>,
    pointer: vec2<f32>,
    pointer_last: vec2<f32>,
    pointer_state: f32,
    ripple_scale: f32,
    frame_time: f32,
};

// Common sampler
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var currentForceTexture : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;

// Vertex shader outputs
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

    let albedo = textureSample(currentForceTexture, samp, uv);

    let pointer = uniforms.pointer * 2.0 - 1.0;
    let pointer_last = uniforms.pointer_last * 2.0 - 1.0;

    var pointer_uv = pointer.xy;
    var pointer_uv_last = pointer_last.xy;  // 修复：应该用 pointer_last 而不是 pointer

    pointer_uv *= 0.5;
    pointer_uv_last *= 0.5;

    var ratio = uniforms.resolution.y / -uniforms.resolution.x;

    var pointer_delta = vec2<f32>(length(pointer - pointer_last), 60.0 / max(0.0001, uniforms.ripple_scale));
    pointer_delta.x *= 100.0;

    ratio *= -pointer_delta.y;

    pointer_uv += 0.5;
    pointer_uv_last += 0.5;
    pointer_uv.y = pointer_uv.y;
    pointer_uv_last.y = pointer_uv_last.y;

    let mask = 1.0;

    var l_delta = pointer_uv - pointer_uv_last;
    let tex_delta = uv - pointer_uv_last;

    let dist_l_delta = length(l_delta) + 0.0001;
    l_delta /= dist_l_delta;
    var dist_on_line = dot(l_delta, tex_delta);

    let ray_mask = max(step(0.0, dist_on_line) * step(dist_on_line, dist_l_delta), step(dist_l_delta, 0.1));
    dist_on_line = clamp(dist_on_line / dist_l_delta, 0.0, 1.0) * dist_l_delta;
    let pos_on_line = pointer_uv_last + l_delta * dist_on_line;

    pointer_uv = (uv - pos_on_line) * vec2<f32>(pointer_delta.y, ratio);

    var point_dist = length(pointer_uv);
    point_dist = clamp(1.0 - point_dist, 0.0, 1.0);
    point_dist *= ray_mask * mask;

    let time_amt = min(1.0 / 30.0, uniforms.frame_time) / 0.02;
    let point_move_amt = pointer_delta.x;
    let input_strength = point_dist * time_amt * (point_move_amt + uniforms.pointer_state * 5.0);

    let impulse_dir = max(vec2<f32>(-1.0), min(vec2<f32>(1.0), pointer_uv));

    let color_add = vec4<f32>(
        step(0.0, impulse_dir.x) * impulse_dir.x * input_strength,
        step(0.0, impulse_dir.y) * impulse_dir.y * input_strength,
        step(impulse_dir.x, 0.0) * -impulse_dir.x * input_strength,
        step(impulse_dir.y, 0.0) * -impulse_dir.y * input_strength
    );

    return albedo + color_add;
}