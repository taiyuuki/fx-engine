import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import type { EffectPassOptions, PropertyList } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let forceShaderCode: string | null = null
let simulateShaderCode: string | null = null
let combineShaderCode: string | null = null

export async function createCursorRippleEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture | PassTextureRef,
}) {

    // Force pass uniforms - generates ripples from cursor movement
    // Layout: pointer(vec2) + pointerLast(vec2) + pointerDelta(f32) + rippleScale(f32) + canvasRes(vec2) + frameTime(f32) + padding
    const forceUniforms = renderer.createUniforms(12)

    // Simulate pass uniforms - simulates ripple propagation
    // Layout: resolution(vec2) + ripple_speed(f32) + ripple_decay(f32) + frame_time(f32) + use_mask(f32) + use_reflection(f32) + padding
    const simulateUniforms = renderer.createUniforms(8)
    simulateUniforms.values[6] = 1.0 // use_reflection 默认启用

    // Combine pass uniforms - combines ripples with the original image
    // Layout: ripple_strength(f32) + use_shading(f32) + shading_amount(f32) + shading_high(vec3) + shading_low(vec3) + shading_direction(f32) + padding
    const combineUniforms = renderer.createUniforms(16)

    // Load shader codes if not already loaded
    if (!forceShaderCode) {
        const response = await fetch('/effects/cursor-ripple/ripple-force.wgsl')
        forceShaderCode = await response.text()
    }

    if (!simulateShaderCode) {
        const response = await fetch('/effects/cursor-ripple/ripple-simulate.wgsl')
        simulateShaderCode = await response.text()
    }

    if (!combineShaderCode) {
        const response = await fetch('/effects/cursor-ripple/ripple-combine.wgsl')
        combineShaderCode = await response.text()
    }

    const properties: PropertyList = [
        createProperty({
            name: 'useMask',
            label: '使用碰撞蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: ['simulate', 5, 1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '碰撞蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-FFFFFF',
            uniformIndex: [-2, -1], // [绑定号的相反数，属性号的相反数]
            condition: () => simulateUniforms?.values[5] === 1,
        }),
        createProperty({
            name: 'useReflection',
            label: '边界反射',
            type: PropertyType.Checkbox,
            defaultValue: true,
            uniformIndex: ['simulate', 6, 1],
        }),
        createProperty({
            name: 'rippleScale',
            label: '波纹大小',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['force', 7, 1],
            range: [0.0, 4.0],
        }),
        createProperty({
            name: 'rippleSpeed',
            label: '波纹速度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['simulate', 2, 1],
            range: [0.1, 4.0],
        }),
        createProperty({
            name: 'rippleDecay',
            label: '波纹衰减',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['simulate', 3, 1],
            range: [0.1, 4.0],
        }),
        createProperty({
            name: 'rippleStrength',
            label: '波纹强度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['combine', 0, 1],
            range: [0.0, 4.0],
        }),
        createProperty({
            name: 'useShading',
            label: '使用着色',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: ['combine', 1, 1],
        }),
        createProperty({
            name: 'shadingAmount',
            label: '着色强度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['combine', 2, 1],
            range: [0.0, 2.0],
            condition: () => combineUniforms.values[1] === 1,
        }),
        createProperty({
            name: 'shadingHigh',
            label: '高光颜色',
            type: PropertyType.Color,
            defaultValue: [1, 1, 1],
            uniformIndex: ['combine', 3, 3],
            condition: () => combineUniforms.values[1] === 1,
        }),
        createProperty({
            name: 'shadingLow',
            label: '阴影颜色',
            type: PropertyType.Color,
            defaultValue: [0, 0, 0],
            uniformIndex: ['combine', 6, 3],
            condition: () => combineUniforms.values[1] === 1,
        }),
        createProperty({
            name: 'shadingDirection',
            label: '光照方向',
            type: PropertyType.Angle,
            defaultValue: 0.0,
            uniformIndex: ['combine', 9, 1],
            range: [0.0, 360],
            condition: () => combineUniforms.values[1] === 1,
        }),
    ]

    const FORMAT = 'rgba16float'
    function createRippleTexture() {
        return renderer.getDevice().createTexture({
            size: [canvasSettings.value.width, canvasSettings.value.height],
            format: FORMAT,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
        })
    }
    const rippleTextureA = createRippleTexture()
    const rippleTextureB = createRippleTexture()

    // Create multi-pass configuration with per-pass resources
    // Resources must match the exact binding layout expected by each shader
    const passes: EffectPassOptions[] = [
        {
            name: 'force',
            shaderCode: forceShaderCode,
            resources: [
                forceUniforms.getBuffer(), // @group(0) @binding(0) uniforms
                rippleTextureA.createView(), // @group(0) @binding(1) currentForceTexture
                samplerStore.getSampler('nearest', renderer), // @group(0) @binding(2) var samp : sampler;
            ],
            view: rippleTextureB.createView(),
            format: FORMAT,
        },

        {
            name: 'simulate',
            shaderCode: simulateShaderCode,
            resources: [
                simulateUniforms.getBuffer(), // @group(0) @binding(0) uniforms
                rippleTextureB.createView(), // @group(0) @binding(1) forceTexture (read from force pass)
                textures.maskTexture, // @group(0) @binding(2) maskTexture
                samplerStore.getSampler('nearest', renderer),
            ],
            view: rippleTextureA.createView(),
            format: FORMAT,
        },

        {
            name,
            shaderCode: combineShaderCode,
            resources: [
                textures.baseTexture, // @group(0) @binding(0) sourceTexture (will be set by renderer from previous pass)
                rippleTextureA.createView(), // @group(0) @binding(2) rippleTexture (read simulation result)
                samplerStore.getSampler('linear', renderer), // @group(0) @binding(3) sampler
                combineUniforms.getBuffer(), // @group(0) @binding(4) uniforms
            ],
        },

        // debug
        //         {
        //             name,
        //             shaderCode: `
        // @group(0) @binding(0) var tex : texture_2d<f32>;
        // @group(0) @binding(1) var samp : sampler;

        // struct VSOut {
        //     @builtin(position) pos: vec4<f32>,
        //     @location(0) uv: vec2<f32>,
        // };

        // @vertex
        // fn vs_main(@location(0) p: vec3<f32>) -> VSOut {
        //     var o: VSOut;
        //     o.pos = vec4<f32>(p, 1.0);
        //     o.uv = p.xy * 0.5 + vec2<f32>(0.5, 0.5);
        //     o.uv.y = 1.0 - o.uv.y;
        //     return o;
        // }

        // @fragment
        // fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {

        //     return textureSample(tex, samp, uv);
        // }
            
        //             `,
        //             resources: [
        //                 rippleTextureA.createView(),
        //                 samplerStore.getSampler('linear', renderer),
        //             ],
        //         },
    ]

    return new Effect({
        name,
        id: 'cursor-ripple',
        label: '光标波纹',
        properties,
        uniforms: forceUniforms,
        passes,
        passUniforms: {
            force: forceUniforms,
            simulate: simulateUniforms,
            combine: combineUniforms,
        },
        maskConfigs: {
            alpha_mask: {
                passName: 'simulate',
                bindingIndex: 2,
            },
        },
    })
}
