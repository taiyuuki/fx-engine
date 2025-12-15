struct Uniforms {
    time: f32,
    speed: f32,
    amp: f32,
    scale: f32,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var flowmask_tex : texture_2d<f32>;
@group(0) @binding(2) var phase_tex : texture_2d<f32>;
@group(0) @binding(3) var samp : sampler;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

fn rotation2d(v: vec2<f32>, angle: f32) -> vec2<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return vec2<f32>(c * v.x - s * v.y, s * v.x + c * v.y);
}

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

    let time = uniforms.time;
    let speed = uniforms.speed;
    let amp = uniforms.amp;
    let scale = uniforms.scale;

    let flow_phase = textureSample(phase_tex, samp, uv * scale).r;
    let flow_colors = textureSample(flowmask_tex, samp, uv).rg;
    let flow_mask = (vec2<f32>(0.5, 0.5) - flow_colors.rg) * 2.0;
    let flow_amount = length(flow_mask);

    var cycles = vec4<f32>(
        fract(time * speed),
        fract(time * speed + 0.5),
        fract(0.25 + time * speed),
        fract(0.25 + time * speed + 0.5)
    );

    let blend = 2.0 * abs(cycles.x - 0.5);
    let blend2 = 2.0 * abs(cycles.z - 0.5);

    cycles = cycles - vec4<f32>(0.5);

    let flow_uv_offset = vec4<f32>(flow_mask.xyxy * amp * 0.1) * cycles.xxyy;
    let flow_uv_offset2 = vec4<f32>(flow_mask.xyxy * amp * 0.1) * cycles.zzww;

    let albedo = textureSample(tex, samp, uv);
    let flow_albedo = mix(
        textureSample(tex, samp, uv + flow_uv_offset.xy),
        textureSample(tex, samp, uv + flow_uv_offset.zw),
        blend
    );
    let flow_albedo2 = mix(
        textureSample(tex, samp, uv + flow_uv_offset2.xy),
        textureSample(tex, samp, uv + flow_uv_offset2.zw),
        blend2
    );

    let final_albedo = mix(flow_albedo, flow_albedo2, smoothstep(0.2, 0.8, flow_phase));

    return mix(albedo, final_albedo, flow_amount);
}