struct Uniforms {
    scale_x: f32,
    scale_y: f32,
    strength: f32,
    use_mask: f32,
    padding: f32,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var normal_tex : texture_2d<f32>;
@group(0) @binding(2) var mask_tex : texture_2d<f32>;
@group(0) @binding(3) var samp : sampler;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) uv_normal: vec2<f32>,
    @location(2) uv_mask: vec2<f32>,
}

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;
    o.uv_normal = o.uv * vec2<f32>(uniforms.scale_x, uniforms.scale_y);
    o.uv_mask = o.uv;
    return o;
}

// 解压法线贴图 [0,1] -> [-1,1]
fn decompressNormal(encoded: vec4<f32>) -> vec3<f32> {
    let normal = encoded.rgb * 2.0 - vec3<f32>(1.0, 1.0, 1.0);
    let len = length(normal.xy);
    if (len > 1.0) {
        return normalize(normal);
    }
    let z = sqrt(max(0.0, 1.0 - len * len));
    return vec3<f32>(normal.x, normal.y, z);
}

@fragment
fn fs_main(
    @location(0) uv: vec2<f32>,
    @location(1) uv_normal: vec2<f32>,
    @location(2) uv_mask: vec2<f32>
) -> @location(0) vec4<f32> {
    var mask = 1.0;
    if uniforms.use_mask > 0.5 {
        mask = textureSample(mask_tex, samp, uv_mask).r;
    }

    let normal = decompressNormal(textureSample(normal_tex, samp, uv_normal));
    var strength = uniforms.strength;
    let strengthValue = sign(strength) * strength * strength;

    var texCoord = uv;
    texCoord = texCoord + normal.xy * strengthValue * mask;

    return textureSample(tex, samp, texCoord);
}
