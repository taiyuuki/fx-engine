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
    const forceUniforms = renderer.createUniforms(8)

    // Simulate pass uniforms - simulates ripple propagation
    const simulateUniforms = renderer.createUniforms(8)

    // Combine pass uniforms - combines ripples with the original image
    const combineUniforms = renderer.createUniforms(4)

    // Initialize force uniforms
    forceUniforms.values[0] = 0.0 // pointer.x
    forceUniforms.values[1] = 0.0 // pointer.y
    forceUniforms.values[2] = 0.0 // pointerLast.x
    forceUniforms.values[3] = 0.0 // pointerLast.y
    forceUniforms.values[4] = 0.0 // pointerDelta
    forceUniforms.values[5] = 1.0 // rippleScale
    forceUniforms.values[6] = 0.016 // frameTime

    // Initialize simulate uniforms
    simulateUniforms.values[0] = canvasSettings.value.width // resolution.x
    simulateUniforms.values[1] = canvasSettings.value.height // resolution.y
    simulateUniforms.values[2] = 1.0 // rippleSpeed
    simulateUniforms.values[3] = 0.98 // rippleDecay
    simulateUniforms.values[4] = 0.016 // frameTime
    simulateUniforms.values[5] = 0.0 // useMask

    // Initialize combine uniforms
    combineUniforms.values[0] = canvasSettings.value.width // resolution.x
    combineUniforms.values[1] = canvasSettings.value.height // resolution.y
    combineUniforms.values[2] = 0.05 // rippleStrength

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
            condition: () => (simulateUniforms?.values[5] ?? 0) > 0.5,
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
            uniformIndex: ['simulate', 2, 1],
            range: [0.0, 2.0],
        }),
        createProperty({
            name: 'rippleDecay',
            label: '波纹衰减',
            type: PropertyType.Float,
            defaultValue: 0.98,
            uniformIndex: ['simulate', 3, 1],
            range: [0.0, 4.0],
        }),
        createProperty({
            name: 'rippleStrength',
            label: '波纹强度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: ['combine', 2, 1],
            range: [0.0, 5.0],
        }),
    ]

    const FORMAT = 'rgba16float'
    function createRippleTexture() {
        return renderer.getDevice().createTexture({
            size: [canvasSettings.value.width, canvasSettings.value.width],
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
            condition: true,
            resources: [
                forceUniforms.getBuffer(), // @group(0) @binding(0) uniforms
                rippleTextureA.createView(), // @group(0) @binding(1) currentForceTexture (will be set by renderer as ping-pong texture)
            ],
            view: rippleTextureB.createView(),
            format: FORMAT,
        },
        {
            name: 'simulate',
            shaderCode: simulateShaderCode,
            condition: true,
            resources: [
                simulateUniforms.getBuffer(), // @group(0) @binding(0) uniforms
                rippleTextureB.createView(), // @group(0) @binding(1) forceTexture (will be set by renderer from force pass)
                textures.maskTexture, // @group(0) @binding(2) maskTexture
            ],
            view: rippleTextureA.createView(),
            format: FORMAT,
        },
        {
            name,
            shaderCode: combineShaderCode,
            condition: true,
            resources: [
                samplerStore.getSampler('linear', renderer), // @group(0) @binding(0) sampler
                combineUniforms.getBuffer(), // @group(0) @binding(1) uniforms
                textures.baseTexture, // @group(0) @binding(2) sourceTexture (will be set by renderer from previous pass)
                rippleTextureA.createView(), // @group(0) @binding(3) rippleTexture (will be set by renderer from simulate pass)
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
