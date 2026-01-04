import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import type { PropertyList } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null
let normalTexture: GPUTexture | null = null

export async function createRefractionEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture,
}) {

    // 需要一个默认的法线贴图
    if (!normalTexture) {
        const { texture } = await renderer.loadImageTexture('/textures/refractnormal.png')
        normalTexture = texture
    }

    const refractionUniforms = renderer.createUniforms(5)
    refractionUniforms.values[0] = 1.0 // scale_x
    refractionUniforms.values[1] = 1.0 // scale_y
    refractionUniforms.values[2] = 0.1 // strength
    refractionUniforms.values[3] = 0.0 // use_mask

    const properties: PropertyList = [
        createProperty({
            name: 'scale',
            label: '法线缩放',
            type: PropertyType.Vec2,
            defaultValue: [1.0, 1.0],
            uniformIndex: [0, 2],
            range: [0.1, 10.0],
        }),
        createProperty({
            name: 'strength',
            label: '折射强度',
            type: PropertyType.Float,
            defaultValue: 0.1,
            range: [-1.0, 1.0],
            uniformIndex: [2, 1],
        }),
        createProperty({
            name: 'use_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [3, 1],
        }),
        createProperty({
            name: 'normal_map',
            label: '法线贴图',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultNormalMap',
            uniformIndex: [-1, -1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-1, -1],
            condition: () => refractionUniforms.values[3] === 1.0,
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/refraction/refraction.wgsl')
        shaderCode = await response.text()
    }

    const effect = new Effect({
        name,
        id: 'refraction',
        label: '折射',
        properties,
        uniforms: refractionUniforms,
        shaderCode,
        resources: [
            textures.baseTexture,
            normalTexture,
            textures.maskTexture,
            samplerStore.getSampler('linear', renderer),
            refractionUniforms.getBuffer(),
        ],
        maskConfigs: {
            normal_map: {
                passName: name,
                bindingIndex: 1,
            },
            alpha_mask: {
                passName: name,
                bindingIndex: 2,
            },
        },
    })

    return effect
}
