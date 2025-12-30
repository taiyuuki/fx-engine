struct Uniforms {
    canvas_res: vec2<f32>,
    perspective: f32, // 0=planar, 1=perspective
    direction: f32, // rotation direction for planar mode
    offset: f32, // y offset for planar mode
    point0_x: f32,
    point0_y: f32,
    point1_x: f32,
    point1_y: f32,
    point2_x: f32,
    point2_y: f32,
    point3_x: f32,
    point3_y: f32,
    alpha: f32, // reflection alpha
    blend_mode: f32, // 0=normal, 1=multiply, 2=screen, etc.
    use_mask: f32,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var mask_tex : texture_2d<f32>;
@group(0) @binding(2) var samp : sampler;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) uv_mask: vec2<f32>,
    @location(2) reflected_coord: vec2<f32>,
    @location(3) tex_coord_perspective: vec3<f32>,
}

// 2D rotation function
fn rotateVec2(v: vec2<f32>, angle: f32) -> vec2<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return vec2<f32>(
        v.x * c - v.y * s,
        v.x * s + v.y * c
    );
}

// Compute inverse of a 3x3 matrix (for perspective transform)
fn inverse3x3(m: mat3x3<f32>) -> mat3x3<f32> {
    let det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
              - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
              + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    let invDet = 1.0 / det;

    return mat3x3<f32>(
        vec3<f32>(
            (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invDet,
            (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invDet,
            (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invDet
        ),
        vec3<f32>(
            (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invDet,
            (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invDet,
            (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invDet
        ),
        vec3<f32>(
            (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invDet,
            (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invDet,
            (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invDet
        )
    );
}

// Compute square to quad transformation
fn squareToQuad(p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, p3: vec2<f32>) -> mat3x3<f32> {
    let col1 = vec3<f32>(p1.x - p0.x, p2.x - p3.x, p0.x - p1.x + p2.x - p3.x);
    let col2 = vec3<f32>(p1.y - p0.y, p2.y - p3.y, p0.y - p1.y + p2.y - p3.y);
    let col3 = vec3<f32>(p0.x, p3.x, 0.0);

    let row1 = vec3<f32>(p1.y - p0.y, p2.y - p3.y, p0.y - p1.y + p2.y - p3.y);
    let row2 = vec3<f32>(p1.x - p0.x, p2.x - p3.x, p0.x - p1.x + p2.x - p3.x);
    let row3 = vec3<f32>(0.0, 0.0, 1.0);

    // Construct the transformation matrix
    let m1 = mat3x3<f32>(
        vec3<f32>(col1.x, col2.x, col3.x),
        vec3<f32>(col1.y, col2.y, col3.y),
        vec3<f32>(col1.z, col2.z, col3.z)
    );

    let det = col1.x * (col2.y * row3.z - col2.z * row3.y)
              - col1.y * (col2.x * row3.z - col2.z * row3.x)
              + col1.z * (col2.x * row3.y - col2.y * row3.x);

    let invDet = 1.0 / det;

    // For perspective, we need a different approach
    // Simplified: return identity for now, will implement properly
    return mat3x3<f32>(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<f32>(0.0, 0.0, 1.0)
    );
}

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    o.uv.y = 1.0 - o.uv.y;
    o.uv_mask = o.uv;

    let perspective = i32(uniforms.perspective);

    if (perspective == 0) {
        // Planar reflection mode
        let center = vec2<f32>(0.5, 0.5);
        var delta = o.uv - center;
        delta.y += uniforms.offset;
        delta.y = -delta.y;

        delta = rotateVec2(delta, uniforms.direction);
        o.reflected_coord = center + delta;

        // Not used in planar mode
        o.tex_coord_perspective = vec3<f32>(0.0, 0.0, 1.0);
    } else {
        // Perspective reflection mode
        let p0 = vec2<f32>(uniforms.point0_x, uniforms.point0_y);
        let p1 = vec2<f32>(uniforms.point1_x, uniforms.point1_y);
        let p2 = vec2<f32>(uniforms.point2_x, uniforms.point2_y);
        let p3 = vec2<f32>(uniforms.point3_x, uniforms.point3_y);

        // Simplified perspective transform
        // In a full implementation, this would compute the homography
        let uv_centered = o.uv - vec2<f32>(0.5, 0.5);

        // Simple quad mapping (not full perspective)
        let top = mix(p0, p1, o.uv.x);
        let bottom = mix(p3, p2, o.uv.x);
        let perspective_uv = mix(top, bottom, o.uv.y);

        o.tex_coord_perspective = vec3<f32>(perspective_uv, 1.0);
        o.reflected_coord = o.uv;
    }

    return o;
}

// Blending modes
fn applyBlending(mode: i32, base: vec3<f32>, blend: vec3<f32>, t: f32) -> vec3<f32> {
    let clampedT = clamp(t, 0.0, 1.0);

    if (mode == 0) {
        // Normal
        return mix(base, blend, clampedT);
    } else if (mode == 1) {
        // Multiply
        return base * (blend * clampedT + (1.0 - clampedT));
    } else if (mode == 2) {
        // Screen
        return 1.0 - (1.0 - base) * (1.0 - blend * clampedT);
    } else if (mode == 3) {
        // Overlay
        let val = mix(base, blend, clampedT);
        return mix(
            2.0 * base * val,
            1.0 - 2.0 * (1.0 - base) * (1.0 - val),
            step(vec3<f32>(0.5), base)
        );
    } else if (mode == 4) {
        // Darken
        return min(base, 1.0 - blend * (1.0 - clampedT));
    } else if (mode == 5) {
        // Lighten
        return max(base, blend * clampedT);
    } else if (mode == 6) {
        // Color Dodge
        return base / (1.0 - blend * clampedT + 0.001);
    } else if (mode == 7) {
        // Color Burn
        return 1.0 - (1.0 - base) / (blend * clampedT + 0.001);
    } else if (mode == 8) {
        // Hard Light
        let val = mix(base, blend, clampedT);
        return mix(
            2.0 * base * val,
            1.0 - 2.0 * (1.0 - base) * (1.0 - val),
            step(vec3<f32>(0.5), val)
        );
    } else if (mode == 9) {
        // Additive
        return base + blend * clampedT;
    } else {
        return mix(base, blend, clampedT);
    }
}

@fragment
fn fs_main(
    @location(0) uv: vec2<f32>,
    @location(1) uv_mask: vec2<f32>,
    @location(2) reflected_coord: vec2<f32>,
    @location(3) tex_coord_perspective: vec3<f32>
) -> @location(0) vec4<f32> {
    let perspective = i32(uniforms.perspective);

    var mask = 1.0;
    if uniforms.use_mask > 0.5 {
        mask = textureSample(mask_tex, samp, uv_mask).r;
    }

    var reflectedCoord: vec2<f32>;

    if (perspective == 0) {
        // Planar mode
        reflectedCoord = reflected_coord;
    } else {
        // Perspective mode
        reflectedCoord = tex_coord_perspective.xy / tex_coord_perspective.z;
        reflectedCoord.y = 1.0 - reflectedCoord.y;

        // Clamp to [0,1] range for mask
        let inBoundsX = step(abs(reflectedCoord.x - 0.5), 0.5);
        let inBoundsY = step(abs(reflectedCoord.y - 0.5), 0.5);
        mask *= inBoundsX * inBoundsY;
    }

    let albedo = textureSample(tex, samp, uv);
    let reflected = textureSample(tex, samp, reflectedCoord);

    let blendMode = i32(uniforms.blend_mode);
    let alpha = uniforms.alpha * mask;

    let rgb = applyBlending(blendMode, albedo.rgb, reflected.rgb, alpha);
    let a = min(1.0, albedo.a + reflected.a * alpha);

    return vec4<f32>(rgb, a);
}
