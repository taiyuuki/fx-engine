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
    const forceUniforms = renderer.createUniforms(10)

    // Simulate pass uniforms - simulates ripple propagation
    const simulateUniforms = renderer.createUniforms(8)

    // Combine pass uniforms - combines ripples with the original image
    const combineUniforms = renderer.createUniforms(4)
    simulateUniforms.values[3] = 1.0

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
            uniformIndex: ['simulate', 3, 1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '碰撞蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-FFFFFF',
            uniformIndex: [-2, -1], // [绑定号的相反数，属性号的相反数]
            condition: () => simulateUniforms?.values[3] === 1,
        }),
        createProperty({
            name: 'rippleScale',
            label: '波纹大小',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['force', 5, 1],
            range: [0.0, 2.0],
        }),
        createProperty({
            name: 'rippleSpeed',
            label: '波纹速度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['simulate', 0, 1],
            range: [0.0, 2.0],
        }),
        createProperty({
            name: 'rippleDecay',
            label: '波纹衰减',
            type: PropertyType.Float,
            defaultValue: 0.98,
            uniformIndex: ['simulate', 1, 1],
            range: [0.0, 4.0],
        }),
        createProperty({
            name: 'rippleStrength',
            label: '波纹强度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['combine', 0, 1],
            range: [0.0, 5.0],
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
            ],
            view: rippleTextureA.createView(),
            format: FORMAT,
        },
        {
            name,
            shaderCode: combineShaderCode,
            resources: [
                samplerStore.getSampler('linear', renderer), // @group(0) @binding(0) sampler
                combineUniforms.getBuffer(), // @group(0) @binding(1) uniforms
                textures.baseTexture, // @group(0) @binding(2) sourceTexture (will be set by renderer from previous pass)
                rippleTextureA.createView(), // @group(0) @binding(3) rippleTexture (read simulation result)
            ],
        },
    ]

    return new Effect({
        name,
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
