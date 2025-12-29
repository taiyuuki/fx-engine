struct Uniforms {
    canvas_res: vec2<f32>,
    pointer_x: f32,
    pointer_y: f32,
    scale_x: f32,
    scale_y: f32,
    sensitivity: f32,
    center: f32,
    quality: f32, // 0=basic, 1=occlusion performance, 2=occlusion quality
    use_mask: f32,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var depth_tex : texture_2d<f32>;
@group(0) @binding(2) var mask_tex : texture_2d<f32>;
@group(0) @binding(3) var samp : sampler;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

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

    // Normalize pointer to [0, 1] then convert to parallax offset
    let pointer = vec2<f32>(uniforms.pointer_x, 1.0 - uniforms.pointer_y);
    o.parallax_offset = pointer;

    return o;
}

fn ParallaxMapping(texCoords: vec2<f32>, viewDir: vec2<f32>) -> vec2<f32> {
    // Simplified parallax that works with WGSL uniform flow restrictions
    // Instead of iterative depth sampling, use direct depth-based offset

    let quality = i32(uniforms.quality);
    let depth = textureSample(depth_tex, samp, texCoords).r;

    // Apply parallax offset based on depth value
    let numLayers = select(24.0, 64.0, quality == 1);
    let layerDepth = 1.0 / numLayers;

    // Calculate parallax offset: higher depth values = more offset
    let parallaxDepth = depth * numLayers;
    let parallaxOffset = viewDir * parallaxDepth * layerDepth * 0.1;

    return texCoords - parallaxOffset;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>, @location(1) parallax_offset: vec2<f32>) -> @location(0) vec4<f32> {
    let scale = vec2<f32>(uniforms.scale_x, uniforms.scale_y);
    let sensitivity = uniforms.sensitivity;
    let center = uniforms.center;

    // Read depth value at the start so we can debug it
    let depth_value = textureSample(depth_tex, samp, uv).r;

    var mask = 1.0;
    if uniforms.use_mask > 0.5 {
        mask = textureSample(mask_tex, samp, uv).r;
    }

    var finalCoords = uv;

    if uniforms.quality < 0.5 {
        // Basic mode - simplified depth parallax

        // Calculate direction from pixel to mouse
        let dir = uv - parallax_offset;

        // Use depth value directly - pure black (0) should not move
        let offset = dir * depth_value * scale * sensitivity * 0.15;

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

        let fakeViewdir = ctrlDir * mask;
        finalCoords = ParallaxMapping(coords_center, fakeViewdir);
    }

    // Sample the final color at the parallax offset coordinate
    // Original GLSL does not blend - just return the offset color directly
    let result = textureSample(tex, samp, finalCoords);

    return result;
}
