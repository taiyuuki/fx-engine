import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import type { PropertyList, SelectOption } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null

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

export async function createTintEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture,
}) {

    const tintUniforms = renderer.createUniforms(8)
    tintUniforms.values[0] = canvasSettings.value.width // canvas_res.x
    tintUniforms.values[1] = canvasSettings.value.height // canvas_res.y
    tintUniforms.values[2] = 0.0 // blend_mode
    tintUniforms.values[3] = 0.0 // use_mask
    tintUniforms.values[4] = 1.0 // blend_alpha
    tintUniforms.values[5] = 1.0 // tint_r
    tintUniforms.values[6] = 0.0 // tint_g

    const properties: PropertyList = [
        createProperty({
            name: 'blend_mode',
            label: '混合模式',
            type: PropertyType.Select,
            defaultValue: 0,
            uniformIndex: [2, 1],
            options: blendModeOptions,
        }),
        createProperty({
            name: 'use_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [3, 1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-1, -1],
            condition: () => tintUniforms.values[3] === 1.0,
        }),
        createProperty({
            name: 'blend_alpha',
            label: '强度',
            type: PropertyType.Float,
            defaultValue: 0.5,
            range: [0.0, 1.0],
            uniformIndex: [4, 1],
        }),
        createProperty({
            name: 'tint_color',
            label: '染色',
            type: PropertyType.Color,
            defaultValue: [1.0, 0.0, 0.0],
            uniformIndex: [5, 3],
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/tint/tint.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name,
        id: 'tint',
        label: '染色',
        properties,
        uniforms: tintUniforms,
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.maskTexture,
            samplerStore.getSampler('linear', renderer),
            tintUniforms.getBuffer(),
        ],
    })
}
