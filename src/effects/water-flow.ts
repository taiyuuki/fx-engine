import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import type { PropertyList } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null
let phaseTexture: GPUTexture | null = null

export async function createWaterFlowEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture | PassTextureRef,
}) {

    const wfUniforms = renderer.createUniforms(4)
    wfUniforms.values[0] = performance.now() // time
    wfUniforms.values[1] = 1.0 // speed [0.01, 2.0]
    wfUniforms.values[2] = 1.0 // amp [0.01, 1.0]
    wfUniforms.values[3] = 2.0 // scale [0.01, 10.0]

    if (!phaseTexture) {
        const { texture } = await renderer.loadImageTexture('/effects/water-flow/waterflowphase.png')
        phaseTexture = texture
    }

    const properties: PropertyList = [
        createProperty({
            name: 'flow_mask',
            label: '流式蒙版',
            type: PropertyType.FlowMask,
            defaultValue: 'defaultMask-7F7F00',
            uniformIndex: [-1, 0], // [着色器绑定号的相反数，属性号的相反数]
        }),
        createProperty({
            name: 'speed',
            label: '速度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.01, 2.0],
            uniformIndex: [1, 1],
        }),
        createProperty({
            name: 'amp',
            label: '数量',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.01, 1.0],
            uniformIndex: [2, 1],
        }),
        createProperty({
            name: 'scale',
            label: '缩放',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.01, 10.0],
            uniformIndex: [3, 1],
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/water-flow/water-flow.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name,
        label: '水流',
        properties,
        uniforms: wfUniforms,
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.maskTexture,
            phaseTexture,
            samplerStore.getSampler('linear', renderer),
            wfUniforms.getBuffer(),
        ],
    })
}
