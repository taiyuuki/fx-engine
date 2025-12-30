struct Uniforms {
    canvas_res: vec2<f32>,
    blend_mode: f32,
    use_mask: f32,
    blend_alpha: f32,
    tint_r: f32,
    tint_g: f32,
    tint_b: f32,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var mask_tex : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) uv_mask: vec2<f32>,
}

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;
    o.uv_mask = o.uv;
    return o;
}

// Blending modes
fn applyBlending(mode: i32, base: vec3<f32>, blend: vec3<f32>, t: f32) -> vec3<f32> {
    let clampedT = clamp(t, 0.0, 1.0);

    // First compute the blending operation
    var result: vec3<f32>;

    if (mode == 0) {
        // Normal
        return mix(base, blend, clampedT);
    } else if (mode == 1) {
        // Multiply
        result = clamp(base * blend, vec3<f32>(0.0), vec3<f32>(1.0));
    } else if (mode == 2) {
        // Screen
        result = 1.0 - (1.0 - base) * (1.0 - blend);
    } else if (mode == 3) {
        // Overlay
        result = mix(
            2.0 * base * blend,
            1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
            step(vec3<f32>(0.5), base)
        );
    } else if (mode == 4) {
        // Darken
        result = min(base, blend);
    } else if (mode == 5) {
        // Lighten
        result = max(base, blend);
    } else if (mode == 6) {
        // Color Dodge
        let denominator = clamp(1.0 - blend, vec3<f32>(0.01), vec3<f32>(1.0));
        result = clamp(base / denominator, vec3<f32>(0.0), vec3<f32>(1.0));
    } else if (mode == 7) {
        // Color Burn
        let denominator = clamp(blend, vec3<f32>(0.01), vec3<f32>(1.0));
        result = clamp(1.0 - (1.0 - base) / denominator, vec3<f32>(0.0), vec3<f32>(1.0));
    } else if (mode == 8) {
        // Hard Light
        result = mix(
            2.0 * base * blend,
            1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
            step(vec3<f32>(0.5), blend)
        );
    } else if (mode == 9) {
        // Additive
        result = clamp(base + blend, vec3<f32>(0.0), vec3<f32>(1.0));
    } else {
        return mix(base, blend, clampedT);
    }

    // Then blend between base and result based on t
    return mix(base, result, clampedT);
}

@fragment
fn fs_main(
    @location(0) uv: vec2<f32>,
    @location(1) uv_mask: vec2<f32>
) -> @location(0) vec4<f32> {
    let albedo = textureSample(tex, samp, uv);

    var mask = uniforms.blend_alpha;
    if uniforms.use_mask > 0.5 {
        mask *= textureSample(mask_tex, samp, uv_mask).r;
    }

    let tintColor = vec3<f32>(uniforms.tint_r, uniforms.tint_g, uniforms.tint_b);
    let blendMode = i32(uniforms.blend_mode);

    let blendedRgb = applyBlending(blendMode, albedo.rgb, tintColor, mask);

    if (blendMode == 0) {
        return vec4<f32>(blendedRgb, 1.0);
    }

    return vec4<f32>(blendedRgb, albedo.a);
}
