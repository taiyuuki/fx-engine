struct Uniforms {
    canvas_res: vec2<f32>,
    image_res: vec2<f32>,
    // 变换矩阵：从屏幕空间到图层空间的变换 (3x3 matrix, column-major)
    // 使用 vec4 数组保证 16 字节对齐
    // | m[0].x  m[1].x  m[2].x |
    // | m[0].y  m[1].y  m[2].y |
    // | m[0].z  m[1].z  m[2].z |
    // | m[0].w  m[1].w  m[2].w | (unused)
    transform: array<vec4<f32>, 3>,
};

@group(0) @binding(0) var tex : texture_2d<f32>;
@group(0) @binding(1) var samp : sampler;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
    var o: VSOut;
    o.pos = vec4<f32>(p, 1.0);

    // 将NDC坐标(-1到1)转换为屏幕像素坐标
    var screenPos = p.xy * uniforms.canvas_res * 0.5 + uniforms.canvas_res * 0.5;

    // 使用变换矩阵将屏幕坐标转换到图层空间
    // 手动矩阵乘法: | m[0].x  m[1].x  m[2].x |   | screenPos.x |
    //               | m[0].y  m[1].y  m[2].y | * | screenPos.y |
    //               | m[0].z  m[1].z  m[2].z |   |      1       |

    let m = uniforms.transform;
    var layerX = m[0].x * screenPos.x + m[1].x * screenPos.y + m[2].x;
    var layerY = m[0].y * screenPos.x + m[1].y * screenPos.y + m[2].y;

    // 转换为纹理坐标（0-1范围）
    o.uv = vec2<f32>(layerX, layerY) / uniforms.image_res;
    o.uv.y = 1.0 - o.uv.y; // 翻转Y轴

    return o;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // 检查UV是否在有效范围内
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        discard;
    }

    return textureSample(tex, samp, uv);
}