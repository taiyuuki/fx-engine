struct Uniforms {
    pointer: vec2<f32>, // mouse position for iris to follow
    scale: f32, // iris scale [0.01, 5.0]
    irisSize: f32, // iris size [0.1, 0.8]
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var maskTex : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

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

    // Convert mouse position to normalized coordinates
    let mousePos = uniforms.pointer;

    // Calculate iris movement based on distance from mouse position
    // Flip both X and Y coordinates to match eye movement direction
    var irisOffset = vec2<f32>(
        (uv.x - mousePos.x) * uniforms.scale * 0.005,
        (uv.y - mousePos.y) * uniforms.scale * 0.005
    );

    // Limit the movement range based on iris size
    let maxDistance = uniforms.irisSize;
    let currentDistance = length(irisOffset);
    if currentDistance > maxDistance {
        irisOffset = normalize(irisOffset) * maxDistance;
    }

    // let sampled = textureSample(tex, samp, uv);
    let mask = textureSample(maskTex, samp, uv);

    // Apply iris distortion only within masked area
    let iris = textureSample(tex, samp, mix(uv, uv + irisOffset, mask.r));

    // Blend based on mask
    return iris;
}