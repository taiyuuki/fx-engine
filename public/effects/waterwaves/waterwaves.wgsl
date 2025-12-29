struct Uniforms {
    resolution: vec2<f32>,
    time: f32,
    speed: f32,
    scale: f32,
    exponent: f32,
    strength: f32,
    direction: f32,
    speed2: f32,
    scale2: f32,
    offset2: f32,
    exponent2: f32,
    direction2: f32,
    use_dual_waves: f32,
    use_mask: f32,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var mask_tex : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

fn rotateVec2(v: vec2<f32>, angle: f32) -> vec2<f32> {
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
    let scale = uniforms.scale;
    let exponent = uniforms.exponent;
    let strength = uniforms.strength;

    var mask = 1.0;
    if uniforms.use_mask > 0.5 {
        mask = textureSample(mask_tex, samp, uv).r;
    }

    var texCoord = uv;
    let direction = rotateVec2(vec2<f32>(0.0, 1.0), uniforms.direction);
    let offset = vec2<f32>(direction.y, -direction.x);

    let distanceVar = time * speed + dot(uv, direction) * scale;
    var val1 = sin(distanceVar);
    let s1 = sign(val1);
    val1 = pow(abs(val1), exponent);

    if uniforms.use_dual_waves > 0.5 {
        let speed2 = uniforms.speed2;
        let scale2 = uniforms.scale2;
        let offset2 = uniforms.offset2;
        let exponent2 = uniforms.exponent2;

        let direction2 = rotateVec2(vec2<f32>(0.0, 1.0), uniforms.direction2);
        let offset2Vec = vec2<f32>(direction2.y, -direction2.x);

        let distance2 = (time + offset2) * speed2 + dot(uv, direction2) * scale2;
        var val2 = sin(distance2);
        let s2 = sign(val2);
        val2 = pow(abs(val2), exponent2);

        texCoord += val1 * s1 * val2 * s2 * offset * strength * strength * mask;
    } else {
        texCoord += val1 * s1 * offset * strength * strength * mask;
    }

    return textureSample(tex, samp, texCoord);
}
