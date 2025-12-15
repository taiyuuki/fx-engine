import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'src/stores'
import type { PropertyList } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null

export async function createIrisMovementEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture | PassTextureRef,
}) {
    const imUniform = renderer.createUniforms(8)
    imUniform.values[0] = 1280
    imUniform.values[1] = 720
    imUniform.values[2] = 0.5
    imUniform.values[3] = 0.5
    imUniform.values[4] = 1.0
    imUniform.values[5] = 0.3
    const properties: PropertyList = [
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-1, 0], // [着色器绑定号的相反数，属性号的相反数]
        }),
        createProperty({
            name: 'scale',
            label: '缩放',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.1, 5],
            uniformIndex: [4, 1],
        }),
        createProperty({
            name: 'size',
            label: '大小',
            type: PropertyType.Float,
            defaultValue: 0.3,
            range: [0.1, 0.8],
            uniformIndex: [5, 1],
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/iris-movement/iris-movement.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name,
        label: '虹膜移动',
        properties,
        uniforms: imUniform,
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.maskTexture,
            samplerStore.getSampler('linear', renderer),
            imUniform.getBuffer(),
        ],
    })
}
