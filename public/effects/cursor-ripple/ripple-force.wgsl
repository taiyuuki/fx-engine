struct Uniforms {
    pointer: vec2<f32>,      // offset 0-1
    pointerLast: vec2<f32>,  // offset 2-3
    pointerDelta: f32,       // offset 4
    rippleScale: f32,        // offset 5
    canvasRes: vec2<f32>,    // offset 6-7
    frameTime: f32,          // offset 8
};

// Common sampler
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var currentForceTexture : texture_2d<f32>;

// Vertex shader outputs
struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);
    o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
    return o;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let currentTexSize = vec2<f32>(textureDimensions(currentForceTexture));
    let maxCurrentCoord = currentTexSize - 1.0;
    let albedo = textureLoad(currentForceTexture, vec2<i32>(clamp(uv * currentTexSize, vec2<f32>(0.0), maxCurrentCoord)), 0);

    let unprojectedUVs = uniforms.pointer;
    let unprojectedUVsLast = uniforms.pointerLast;

    let lDelta = unprojectedUVs - unprojectedUVsLast;
    let texDelta = uv - unprojectedUVsLast;

    let distLDelta = length(lDelta) + 0.0001;
    let normalizedLDelta = lDelta / distLDelta;
    let distOnLine = dot(normalizedLDelta, texDelta);

    // Get pointer movement amount early (used in rayMask calculation)
    let pointerMoveAmt = uniforms.pointerDelta;

    // Smooth movement factor to avoid hard cutoffs
    let movementFactor = smoothstep(0.0, 0.02, pointerMoveAmt);

    // Generate ripples along the mouse trajectory with smooth falloff
    let onTrajectory = step(0.0, distOnLine) * step(distOnLine, distLDelta);
    let atMousePoint = step(distLDelta, 0.1);
    let rayMask = max(onTrajectory, atMousePoint) * movementFactor;

    let clampedDistOnLine = saturate(distOnLine / distLDelta) * distLDelta;
    let posOnLine = unprojectedUVsLast + normalizedLDelta * clampedDistOnLine;

    // Calculate ripple scale based on canvas resolution
    // rippleScale=1.0 means approximately 100px radius at current resolution
    let targetPixelRadius = 200.0;
    let scale = max(uniforms.canvasRes, vec2<f32>(1.0, 1.0)) / (targetPixelRadius * uniforms.rippleScale);

    let finalUV = (uv - posOnLine) * vec2<f32>(scale.x, -scale.y);

    let pointerDist = length(finalUV);
    let clampedPointerDist = saturate(1.0 - pointerDist);

    let timeAmt = min(1.0 / 30.0, uniforms.frameTime) / 0.02;

    // Additional safety check: prevent excessive forces from sudden mouse jumps
    let safePointerMoveAmt = min(pointerMoveAmt, 5.0); // Clamp to reasonable max movement

    let baseInputStrength = clampedPointerDist * timeAmt * safePointerMoveAmt * 1.0;

    // Smooth transition for very small movements to avoid hard cutoff
    let strengthFactor = smoothstep(0.0, 0.02, safePointerMoveAmt);
    let inputStrength = baseInputStrength * strengthFactor;

    let impulseDir = max(vec2<f32>(-1.0), min(vec2<f32>(1.0), finalUV));

    let colorAdd = vec4<f32>(
        step(0.0, impulseDir.x) * impulseDir.x * inputStrength,
        step(0.0, impulseDir.y) * impulseDir.y * inputStrength,
        step(impulseDir.x, 0.0) * -impulseDir.x * inputStrength,
        step(impulseDir.y, 0.0) * -impulseDir.y * inputStrength
    );

    return albedo + colorAdd * rayMask;
}