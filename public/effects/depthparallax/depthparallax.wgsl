struct Uniforms {
    canvas_res: vec2<f32>,
    pointer_x: f32,
    pointer_y: f32,
    scale_x: f32,
    scale_y: f32,
    sensitivity: f32,
    center: f32,
    quality: f32, // 0=basic, 1=occlusion performance, 2=occlusion quality
    enable_x: f32,
    enable_y: f32,
    invert_x: f32,
    invert_y: f32,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var depth_tex : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) parallax_offset: vec2<f32>,
};

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;

    // Normalize pointer to [0, 1]
    let pointer = vec2<f32>(uniforms.pointer_x, 1.0 - uniforms.pointer_y);
    o.parallax_offset = pointer;

    return o;
}

fn ParallaxMapping(texCoords: vec2<f32>, viewDir: vec2<f32>) -> vec2<f32> {
    // Simplified parallax mapping - depth controls offset amount
    // depth = 0 (black/far) -> no offset
    // depth = 1 (white/close) -> maximum offset

    let depth = textureSample(depth_tex, samp, texCoords).r;

    // Apply parallax offset based on depth value
    let parallaxOffset = viewDir * depth * 0.1;

    return texCoords - parallaxOffset;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>, @location(1) parallax_offset: vec2<f32>) -> @location(0) vec4<f32> {
    let scale = vec2<f32>(uniforms.scale_x, uniforms.scale_y);
    let sensitivity = uniforms.sensitivity;
    let center = uniforms.center;
    let enableX = uniforms.enable_x > 0.5;
    let enableY = uniforms.enable_y > 0.5;
    let invertX = uniforms.invert_x > 0.5;
    let invertY = uniforms.invert_y > 0.5;

    var finalCoords = uv;

    if uniforms.quality < 0.5 {
        // Basic mode - simplified depth parallax

        // Calculate direction from pixel to mouse
        let dir = uv - parallax_offset;

        // Sample depth value
        let depth_value = textureSample(depth_tex, samp, uv).r;

        // Apply parallax offset based on depth
        // depth = 0 (far/black) -> no movement
        // depth = 1 (near/white) -> maximum movement
        var offset = dir * depth_value * scale * sensitivity * 0.15;

        // Apply direction masking
        if (!enableX) {
            offset.x = 0.0;
        }
        if (!enableY) {
            offset.y = 0.0;
        }

        // Apply inversion
        if (invertX) {
            offset.x = -offset.x;
        }
        if (invertY) {
            offset.y = -offset.y;
        }

        finalCoords = uv - offset;
    } else {
        // Occlusion modes - use depth-based parallax mapping
        let ctrlSign = step(0.0, sensitivity);
        let negPerspective = -sensitivity;
        let ctrlPerspOrtho = saturate(sensitivity) + step(0.0001, negPerspective);

        let prlx = mix(parallax_offset, vec2<f32>(1.0) - parallax_offset, ctrlSign);

        let coords = mix(uv, (uv - vec2<f32>(0.5)) / (1.0 + sensitivity * 0.2) + vec2<f32>(0.5), ctrlSign);
        let center_offset = vec2<f32>(-0.05, 0.05) * center * scale * mix(-1.0, negPerspective, ctrlPerspOrtho);
        let coords_center = coords - (prlx * 2.0 - 1.0) * center_offset;

        let pointer = vec2<f32>(1.0 - parallax_offset.x, parallax_offset.y);
        var ctrlDir = pointer - prlx;

        ctrlDir = mix(
            vec2<f32>(1.0 - prlx.x, prlx.y) - vec2<f32>(0.5),
            ctrlDir * vec2<f32>(-negPerspective, negPerspective),
            ctrlPerspOrtho
        );

        // Apply direction masking
        if (!enableX) {
            ctrlDir.x = 0.0;
        }
        if (!enableY) {
            ctrlDir.y = 0.0;
        }

        // Apply inversion
        if (invertX) {
            ctrlDir.x = -ctrlDir.x;
        }
        if (invertY) {
            ctrlDir.y = -ctrlDir.y;
        }

        finalCoords = ParallaxMapping(coords_center, ctrlDir);
    }

    // Sample the final color at the parallax offset coordinate
    let result = textureSample(tex, samp, finalCoords);

    return result;
}
