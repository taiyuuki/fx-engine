import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import pinia from 'src/stores'
import { Effect, PropertyType, createProperty } from './index'

let shaderCode: string | null = null
const sampler = useSamplerStore(pinia)
let noiseTex: GPUTexture | null = null

export async function createCloudMotionEffect(
    name: string,
    renderer: WGSLRenderer,
    textures: {
        baseTexture: GPUTexture | PassTextureRef,
        maskTexture: GPUTexture | PassTextureRef, 
    },
) {
    if (!shaderCode) {
        const response = await fetch('/effects/cloud-motion/cloud-motion.wgsl')
        shaderCode = await response.text()
    }

    // Create uniforms: resolution(2), time(1), speed(1), scale(1), scaleX(1), amount(1), direction(1), use_mask(1), padding(1) = 10 floats
    const uniforms = renderer.createUniforms(10)

    const canvasWidth = canvasSettings.value.width
    const canvasHeight = canvasSettings.value.height

    // Initialize uniforms
    uniforms.values[0] = canvasWidth
    uniforms.values[1] = canvasHeight
    uniforms.values[2] = 0.0 // time
    uniforms.values[3] = 0.001 // speed - 减小速度
    uniforms.values[4] = 2.0 // scale
    uniforms.values[5] = 0.5 // scaleX
    uniforms.values[6] = 0.1 // amount
    uniforms.values[7] = 1.57079632679 // direction
    uniforms.values[8] = 1.0 // use mask - 默认开启
    uniforms.values[9] = 0.0 // padding
    uniforms.apply()

    // Load noise texture
    if (!noiseTex) {
        const { texture } = await renderer.loadImageTexture('/textures/perlin_256.png')
        noiseTex = texture
    }

    const properties = [
        createProperty({
            name: 'use_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: true, // 默认使用蒙版
            uniformIndex: [8, 1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-1, -1],
            condition: () => uniforms.values[8] === 1.0,
        }),
        createProperty({
            name: 'speed',
            label: '移动速度',
            type: PropertyType.Float,
            defaultValue: 0.1,
            uniformIndex: [3, 1],
            range: [0.01, 1],
        }),
        createProperty({
            name: 'scale',
            label: '颗粒度',
            type: PropertyType.Float,
            defaultValue: 2.0,
            uniformIndex: [4, 1],
            range: [0.5, 4],
        }),
        createProperty({
            name: 'scaleX',
            label: '水平颗粒度',
            type: PropertyType.Float,
            defaultValue: 0.5,
            uniformIndex: [5, 1],
            range: [0.1, 1],
        }),
        createProperty({
            name: 'amount',
            label: '云动强度',
            type: PropertyType.Float,
            defaultValue: 0.1,
            uniformIndex: [6, 1],
            range: [0, 0.2],
        }),
        createProperty({
            name: 'direction',
            label: '云动方向',
            type: PropertyType.Angle,
            defaultValue: 90,
            uniformIndex: [7, 1],
            range: [0, 360],
        }),
    ]

    const effect = new Effect({
        name,
        id: 'cloud-motion',
        label: '云朵移动',
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.maskTexture,
            noiseTex.createView(),
            sampler.getSampler('linear', renderer),
            sampler.getSampler('repeat', renderer),
            uniforms.getBuffer(),
        ],
        properties,
        uniforms,
    })

    return effect
}
