import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import pinia from 'src/stores'
import { Effect, PropertyType, createProperty } from './index'

let shaderCode: string | null = null
const sampler = useSamplerStore(pinia)

export async function createScrollEffect(
    name: string,
    renderer: WGSLRenderer,
    textures: { baseTexture: GPUTexture | PassTextureRef, },
) {
    if (!shaderCode) {
        const response = await fetch('/effects/scroll/scroll.wgsl')
        shaderCode = await response.text()
    }

    // Create uniforms: canvas_res(2), scroll(2), time(1), scale(1) = 6 floats (24 bytes)
    const uniforms = renderer.createUniforms(6)

    const canvasWidth = canvasSettings.value.width
    const canvasHeight = canvasSettings.value.height

    // Initialize uniforms
    uniforms.values[0] = canvasWidth
    uniforms.values[1] = canvasHeight
    uniforms.values[2] = 0.0 // scroll.x
    uniforms.values[3] = 0.0 // scroll.y
    uniforms.values[4] = 0.0 // time
    uniforms.values[5] = 1.0 // scale
    uniforms.apply()

    const properties = [
        createProperty({
            name: 'scroll_x',
            label: '水平滚动方向',
            type: PropertyType.Float,
            defaultValue: 0.0,
            uniformIndex: [2, 1],
            range: [-1, 1],
        }),
        createProperty({
            name: 'scroll_y',
            label: '垂直滚动方向',
            type: PropertyType.Float,
            defaultValue: 0.0,
            uniformIndex: [3, 1],
            range: [-1, 1],
        }),
        createProperty({
            name: 'scale',
            label: '缩放',
            type: PropertyType.Float,
            defaultValue: 1.0,
            uniformIndex: [5, 1],
            range: [0.1, 2],
        }),
    ]

    const effect = new Effect({
        name,
        id: 'scroll',
        label: '滚动',
        shaderCode,
        resources: [
            textures.baseTexture,
            sampler.getSampler('linear', renderer),
            uniforms.getBuffer(),
        ],
        properties,
        uniforms,
    })

    return effect
}
