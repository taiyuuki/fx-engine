import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import type { PropertyList } from './index'
import { Effect, PropertyType, createProperty } from './index'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null
let normalTexture: GPUTexture | null = null

export async function createWaterRippleEffect(renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture | PassTextureRef,
}) {

    const wrUniforms = renderer.createUniforms(16)
    wrUniforms.values[0] = 1280 // resolution.x
    wrUniforms.values[1] = 720 // resolution.y
    wrUniforms.values[2] = 1280 // miku_tex_resolution.x
    wrUniforms.values[3] = 720 // miku_tex_resolution.y

    wrUniforms.values[4] = performance.now() // time

    wrUniforms.values[5] = 0.1 // speed
    wrUniforms.values[6] = 0.2 // scroll_speed
    wrUniforms.values[7] = 1.0 // angle
    wrUniforms.values[8] = 1.0 // ratio
    wrUniforms.values[9] = 0.1 // strength
    wrUniforms.values[10] = 2.0 // scale
    wrUniforms.values[11] = 0.0 // use_mask

    if (!normalTexture) {
        const { texture } = await renderer.loadImageTexture('/effects/water-ripple/normal_texture.png')
        normalTexture = texture
    }

    const properties: PropertyList = [
        createProperty({
            name: 'use_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [11, 1],
        }), 
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.Texture,
            defaultValue: 'white_mask',
            uniformIndex: [-3, -1], // [着色器绑定号的相反数，属性号的相反数]
            condition: () => wrUniforms.values[11] === 1.0,
        }),                   
        createProperty({
            name: 'speed',
            label: '速度',
            type: PropertyType.Float,
            defaultValue: 0.1,
            range: [0.0, 1.0],
            uniformIndex: [5, 1],
        }),
        createProperty({
            name: 'scroll_speed',
            label: '滚动速度',
            type: PropertyType.Float,
            defaultValue: 0.2,
            range: [0.0, 1.0],
            uniformIndex: [6, 1],
        }),
        createProperty({
            name: 'angle',
            label: '滚动角度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.0, 6.28],
            uniformIndex: [7, 1],
        }),
        createProperty({
            name: 'ratio',
            label: '比例',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.5, 2.0],
            uniformIndex: [8, 1],
        }),
        createProperty({
            name: 'strength',
            label: '强度',
            type: PropertyType.Float,
            defaultValue: 0.1,
            range: [0.0, 1.0],
            uniformIndex: [9, 1],
        }),
        createProperty({
            name: 'scale',
            label: '缩放',
            type: PropertyType.Float,
            defaultValue: 2.0,
            range: [0.5, 5.0],
            uniformIndex: [10, 1],
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/water-ripple/water-ripple.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name: 'Water Ripple',
        properties,
        uniforms: wrUniforms,
        shaderCode,
        resources: [
            wrUniforms.getBuffer(),
            samplerStore.getSampler('linear', renderer),
            textures.baseTexture,
            textures.maskTexture,
            normalTexture,
        ],
    })
}
