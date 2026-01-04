import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import type { PropertyList } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null

export async function createWaterWavesEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture | PassTextureRef,
}) {

    const wwUniforms = renderer.createUniforms(16)
    wwUniforms.values[0] = canvasSettings.value.width // resolution.x
    wwUniforms.values[1] = canvasSettings.value.height // resolution.y
    wwUniforms.values[2] = performance.now() / 1000 // time
    wwUniforms.values[3] = 5.0 // speed
    wwUniforms.values[4] = 200.0 // scale
    wwUniforms.values[5] = 1.0 // exponent
    wwUniforms.values[6] = 0.1 // strength
    wwUniforms.values[7] = 0.0 // direction
    wwUniforms.values[8] = 3.0 // speed2
    wwUniforms.values[9] = 66.0 // scale2
    wwUniforms.values[10] = 0.0 // offset2
    wwUniforms.values[11] = 1.0 // exponent2
    wwUniforms.values[12] = 0.0 // direction2
    wwUniforms.values[13] = 0.0 // use_dual_waves
    wwUniforms.values[14] = 0.0 // use_mask

    const properties: PropertyList = [
        createProperty({
            name: 'use_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [14, 1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-1, -1],
            condition: () => wwUniforms.values[14] === 1.0,
        }),
        createProperty({
            name: 'use_dual_waves',
            label: '双波叠加',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [13, 1],
        }),
        createProperty({
            name: 'speed',
            label: '波浪速度',
            type: PropertyType.Float,
            defaultValue: 5.0,
            range: [0.01, 50.0],
            uniformIndex: [3, 1],
        }),
        createProperty({
            name: 'scale',
            label: '波浪缩放',
            type: PropertyType.Float,
            defaultValue: 200.0,
            range: [0.01, 1000.0],
            uniformIndex: [4, 1],
        }),
        createProperty({
            name: 'exponent',
            label: '波浪指数',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.51, 4.0],
            uniformIndex: [5, 1],
        }),
        createProperty({
            name: 'strength',
            label: '波浪强度',
            type: PropertyType.Float,
            defaultValue: 0.1,
            range: [0.01, 1.0],
            uniformIndex: [6, 1],
        }),
        createProperty({
            name: 'direction',
            label: '波浪方向',
            type: PropertyType.Angle,
            defaultValue: 180,
            range: [0.0, 360],
            uniformIndex: [7, 1],
        }),
        createProperty({
            name: 'speed2',
            label: '第二波速度',
            type: PropertyType.Float,
            defaultValue: 3.0,
            range: [0.01, 50.0],
            uniformIndex: [8, 1],
            condition: () => wwUniforms.values[13] === 1.0,
        }),
        createProperty({
            name: 'scale2',
            label: '第二波缩放',
            type: PropertyType.Float,
            defaultValue: 66.0,
            range: [0.01, 1000.0],
            uniformIndex: [9, 1],
            condition: () => wwUniforms.values[13] === 1.0,
        }),
        createProperty({
            name: 'offset2',
            label: '第二波偏移',
            type: PropertyType.Float,
            defaultValue: 0.0,
            range: [-5.0, 5.0],
            uniformIndex: [10, 1],
            condition: () => wwUniforms.values[13] === 1.0,
        }),
        createProperty({
            name: 'exponent2',
            label: '第二波指数',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.51, 4.0],
            uniformIndex: [11, 1],
            condition: () => wwUniforms.values[13] === 1.0,
        }),
        createProperty({
            name: 'direction2',
            label: '第二波方向',
            type: PropertyType.Angle,
            defaultValue: 180,
            range: [0.0, 360],
            uniformIndex: [12, 1],
            condition: () => wwUniforms.values[13] === 1.0,
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/waterwaves/waterwaves.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name,
        id: 'waterwaves',
        label: '水波浪',
        properties,
        uniforms: wwUniforms,
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.maskTexture,
            samplerStore.getSampler('linear', renderer),
            wwUniforms.getBuffer(),
        ],
    })
}
