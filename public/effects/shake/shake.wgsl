struct Uniforms {
    time: f32,
    speed: f32,
    amp: f32,
    friction_x: f32,
    friction_y: f32,
    bounds_min: f32,
    bounds_max: f32,
    use_noise: f32,
    use_flow_mask: f32,
    use_opacity_mask: f32,
    use_time_offset: f32,
    direction: f32, // 0=center, 1=left, 2=right
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var flow_mask_tex : texture_2d<f32>;
@group(0) @binding(2) var time_offset_tex : texture_2d<f32>;
@group(0) @binding(3) var opacity_mask_tex : texture_2d<f32>;
@group(0) @binding(4) var samp : sampler;
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

const PI: f32 = 3.14159265359;
const PI_2: f32 = 1.57079632679;

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
    let time = uniforms.time;
    let speed = uniforms.speed;
    let amp = uniforms.amp;
    let frictionX = uniforms.friction_x;
    let frictionY = uniforms.friction_y;
    let boundsMin = uniforms.bounds_min;
    let boundsMax = uniforms.bounds_max;

    var flowPhase = 0.0;
    if uniforms.use_time_offset > 0.5 {
        flowPhase = textureSample(time_offset_tex, samp, uv).r * PI_2;
    }

    var flowMask = vec2<f32>(0.0, 0.0);
    if uniforms.use_flow_mask > 0.5 {
        let flowColors = textureSample(flow_mask_tex, samp, uv).rg;
        flowMask = (vec2<f32>(0.498, 0.498) - flowColors) * 2.0;
    } else {
        flowMask = vec2<f32>(1.0, 0.0); // Default: horizontal shake
    }

    var offset = 0.0;

    if uniforms.use_noise > 0.5 {
        // Noise mode: multiple sine waves with different frequencies
        let sinesBase = flowPhase + fract(speed * time / PI_2 * vec4<f32>(1.0, -0.16161616, 0.0083333, -0.00019841)) * PI_2;
        var sines = sin(sinesBase);
        sines = sines * 0.5 + 0.5;
        offset = dot(sines, vec4<f32>(0.25));
    } else {
        // Simple sine mode - smooth shake
        let t = speed * time + flowPhase;
        offset = sin(t) * 0.5 + 0.5;
    }

    // Apply bounds exactly as original GLSL: (offset - min) * (1 / (max - min))
    // This maps [min, max] to [0, 1] and clips the rest
    let boundsScale = 1.0 / (boundsMax - boundsMin);
    offset = saturate((offset - boundsMin) * boundsScale);

    // Apply direction transformation
    // Direction values: 0=center, 1=left, 2=right
    if uniforms.direction < 0.5 {
        // Center: map [0,1] to [-1,1] for bidirectional shake
        offset = offset * 2.0 - 1.0;
    } else if uniforms.direction > 1.5 {
        // Right: map [0,1] to [-1,0] for opposite one-directional shake
        offset = offset - 1.0;
    }
    // Left: keep [0,1] for one-directional shake (no transformation)

    let texCoordOffset = offset * amp * amp * flowMask;
    let finalCoord = texCoordOffset + uv;

    var result = textureSample(tex, samp, finalCoord);

    // Apply opacity mask if enabled
    if uniforms.use_opacity_mask > 0.5 {
        let mask = textureSample(opacity_mask_tex, samp, finalCoord).r;
        result = mix(textureSample(tex, samp, uv), result, mask);
    }

    return result;
}
