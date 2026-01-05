import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import type { PropertyList } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null

export async function createShakeEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    flowMaskTexture: GPUTexture,
    timeOffsetTexture: GPUTexture,
    opacityMaskTexture: GPUTexture,
}) {

    const shakeUniforms = renderer.createUniforms(16)
    shakeUniforms.values[0] = performance.now() / 1000 // time
    shakeUniforms.values[1] = 1.0 // speed
    shakeUniforms.values[2] = 0.1 // amp
    shakeUniforms.values[3] = 1.0 // friction_x
    shakeUniforms.values[4] = 1.0 // friction_y
    shakeUniforms.values[5] = 0.0 // bounds_min
    shakeUniforms.values[6] = 1.0 // bounds_max
    shakeUniforms.values[7] = 0.0 // use_noise
    shakeUniforms.values[8] = 1.0 // use_flow_mask
    shakeUniforms.values[9] = 0.0 // use_opacity_mask
    shakeUniforms.values[10] = 0.0 // use_time_offset
    shakeUniforms.values[11] = 0.0 // direction (0=center, 1=left, 2=right)

    const properties: PropertyList = [
        createProperty({
            name: 'use_noise',
            label: '噪声模式',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [7, 1],
        }),
        
        createProperty({
            name: 'use_flow_mask',
            label: '使用流向蒙版',
            type: PropertyType.Checkbox,
            defaultValue: true,
            uniformIndex: [8, 1],
        }),
        createProperty({
            name: 'flow_mask',
            label: '流向蒙版',
            type: PropertyType.FlowMask,
            defaultValue: 'defaultMask-7F7F00',
            uniformIndex: [-1, -7],
            condition: () => shakeUniforms.values[8] === 1.0,
        }),
        createProperty({
            name: 'use_opacity_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [9, 1],
        }),
        createProperty({
            name: 'opacity_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-3, -10],
            condition: () => shakeUniforms.values[9] === 1.0,
        }),
        createProperty({
            name: 'direction',
            label: '摇动方向',
            type: PropertyType.Select,
            defaultValue: 0,
            uniformIndex: [11, 1],
            options: [
                { value: 0, label: '居中' },
                { value: 1, label: '左' },
                { value: 2, label: '右' },
            ],
        }),
        createProperty({
            name: 'speed',
            label: '摇动速度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.0, 10.0],
            uniformIndex: [1, 1],
        }),
        createProperty({
            name: 'amp',
            label: '摇动强度',
            type: PropertyType.Float,
            defaultValue: 0.1,
            range: [0.01, 0.5],
            uniformIndex: [2, 1],
        }),
        createProperty({
            name: 'friction',
            label: '摩擦力',
            type: PropertyType.Vec2,
            defaultValue: [1.0, 1.0],
            range: [0.01, 10.0],
            uniformIndex: [3, 2],
        }),
        createProperty({
            name: 'bounds_min',
            label: '摇动下限',
            type: PropertyType.Float,
            defaultValue: 0.0,
            range: [0.0, 0.9],
            uniformIndex: [5, 1],
        }),
        createProperty({
            name: 'bounds_max',
            label: '摇动上限',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.1, 1.0],
            uniformIndex: [6, 1],
        }),

        // createProperty({
        //     name: 'use_time_offset',
        //     label: '使用时间偏移蒙版',
        //     type: PropertyType.Checkbox,
        //     defaultValue: false,
        //     uniformIndex: [10, 1],
        // }),
        // createProperty({
        //     name: 'time_offset_mask',
        //     label: '时间偏移蒙版',
        //     type: PropertyType.AlphaMask,
        //     defaultValue: 'defaultMask-000000',
        //     uniformIndex: [-1, -1],
        //     condition: () => shakeUniforms.values[10] === 1.0,
        // }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/shake/shake.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name,
        id: 'shake',
        label: '摇动',
        properties,
        uniforms: shakeUniforms,
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.flowMaskTexture,
            textures.timeOffsetTexture,
            textures.opacityMaskTexture,
            samplerStore.getSampler('linear', renderer),
            shakeUniforms.getBuffer(),
        ],
    })
}
