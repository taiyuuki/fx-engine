struct Uniforms {
    ripple_strength: f32,
    use_shading: f32,
    shading_amount: f32,
    shading_high: vec3<f32>,
    shading_low: vec3<f32>,
    shading_direction: f32,
};

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var sourceTexture : texture_2d<f32>;
@group(0) @binding(1) var rippleTexture : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

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

    let distort_amt = uniforms.ripple_strength * 0.2;
    var offset = dir;
    offset *= -0.1 * distort_amt;

    var screen = textureSample(sourceTexture, samp, uv + offset);

    // SHADING 选项：添加光照效果
    if uniforms.use_shading > 0.5 {
        var shading_dir = dir;
        let shading_length = max(0.99, length(shading_dir));
        shading_dir = mix(shading_dir, shading_dir / shading_length, step(1.0, shading_length));

        // 旋转方向向量 (0, -1) 旋转 shading_direction 角度
        let angle = uniforms.shading_direction;
        let cos_a = cos(angle);
        let sin_a = sin(angle);
        let rotated = vec2<f32>(0.0 * cos_a - (-1.0) * sin_a, 0.0 * sin_a + (-1.0) * cos_a);

        let shading = dot(rotated, shading_dir);
        let shading_mix = mix(uniforms.shading_low, vec3<f32>(1.0, 1.0, 1.0) + uniforms.shading_high, shading * 0.5 + 0.5);
        let shading_factor = abs(shading * uniforms.shading_amount);

        let new_rgb = mix(screen.rgb, screen.rgb * shading_mix, shading_factor);
        screen = vec4<f32>(new_rgb, screen.a);
    }

    return screen;
}