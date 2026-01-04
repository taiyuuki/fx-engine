import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import type { PropertyList, SelectOption } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null

const perspectiveOptions: SelectOption[] = [
    { value: 0, label: '平面' },
    { value: 1, label: '透视' },
]

const blendModeOptions: SelectOption[] = [
    { value: 0, label: '正常' },
    { value: 1, label: '正片叠底' },
    { value: 2, label: '滤色' },
    { value: 3, label: '叠加' },
    { value: 4, label: '变暗' },
    { value: 5, label: '变亮' },
    { value: 6, label: '颜色减淡' },
    { value: 7, label: '颜色加深' },
    { value: 8, label: '强光' },
    { value: 9, label: '相加' },
]

export async function createReflectionEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture,
}) {

    const reflUniforms = renderer.createUniforms(20)
    reflUniforms.values[0] = canvasSettings.value.width // canvas_res.x
    reflUniforms.values[1] = canvasSettings.value.height // canvas_res.y
    reflUniforms.values[2] = 0.0 // perspective (0=planar, 1=perspective)
    reflUniforms.values[3] = 0.0 // direction
    reflUniforms.values[4] = 0.0 // offset
    reflUniforms.values[5] = 0.0 // point0_x
    reflUniforms.values[6] = 0.0 // point0_y
    reflUniforms.values[7] = 1.0 // point1_x
    reflUniforms.values[8] = 0.0 // point1_y
    reflUniforms.values[9] = 1.0 // point2_x
    reflUniforms.values[10] = 1.0 // point2_y
    reflUniforms.values[11] = 0.0 // point3_x
    reflUniforms.values[12] = 1.0 // point3_y
    reflUniforms.values[13] = 1.0 // alpha
    reflUniforms.values[14] = 9.0 // blend_mode
    reflUniforms.values[15] = 0.0 // use_mask

    const properties: PropertyList = [
        createProperty({
            name: 'perspective',
            label: '模式',
            type: PropertyType.Select,
            defaultValue: 0,
            uniformIndex: [2, 1],
            options: perspectiveOptions,
        }),
        createProperty({
            name: 'blend_mode',
            label: '混合模式',
            type: PropertyType.Select,
            defaultValue: 9,
            uniformIndex: [14, 1],
            options: blendModeOptions,
        }),
        createProperty({
            name: 'use_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [15, 1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-1, -1],
            condition: () => reflUniforms.values[15] === 1.0,
        }),
        createProperty({
            name: 'alpha',
            label: '反射强度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [0.0, 1.0],
            uniformIndex: [13, 1],
        }),

        // Planar mode properties
        createProperty({
            name: 'direction',
            label: '反射方向',
            type: PropertyType.Angle,
            defaultValue: 180,
            range: [0.0, 360],
            uniformIndex: [3, 1],
            condition: () => reflUniforms.values[2] === 0.0,
        }),
        createProperty({
            name: 'offset',
            label: 'Y轴偏移',
            type: PropertyType.Float,
            defaultValue: 0.0,
            range: [-1.0, 1.0],
            uniformIndex: [4, 1],
            condition: () => reflUniforms.values[2] === 0.0,
        }),

        // Perspective mode properties
        createProperty({
            name: 'point0',
            label: '左上角',
            type: PropertyType.Vec2,
            defaultValue: [0.0, 0.0],
            range: [0.0, 1.0],
            uniformIndex: [5, 2],
            condition: () => reflUniforms.values[2] === 1.0,
        }),
        createProperty({
            name: 'point1',
            label: '右上角',
            type: PropertyType.Vec2,
            defaultValue: [1.0, 0.0],
            range: [0.0, 1.0],
            uniformIndex: [7, 2],
            condition: () => reflUniforms.values[2] === 1.0,
        }),
        createProperty({
            name: 'point2',
            label: '右下角',
            type: PropertyType.Vec2,
            defaultValue: [1.0, 1.0],
            range: [0.0, 1.0],
            uniformIndex: [9, 2],
            condition: () => reflUniforms.values[2] === 1.0,
        }),
        createProperty({
            name: 'point3',
            label: '左下角',
            type: PropertyType.Vec2,
            defaultValue: [0.0, 1.0],
            range: [0.0, 1.0],
            uniformIndex: [11, 2],
            condition: () => reflUniforms.values[2] === 1.0,
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/reflection/reflection.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name,
        id: 'reflection',
        label: '反射',
        properties,
        uniforms: reflUniforms,
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.maskTexture,
            samplerStore.getSampler('linear', renderer),
            reflUniforms.getBuffer(),
        ],
    })
}
