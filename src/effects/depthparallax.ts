import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import type { PropertyList, SelectOption } from '.'
import { Effect, PropertyType, createProperty } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null

export async function createDepthParallaxEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    depthTexture: GPUTexture,
}) {

    const dpUniforms = renderer.createUniforms(14)
    dpUniforms.values[0] = canvasSettings.value.width // canvas_res.x
    dpUniforms.values[1] = canvasSettings.value.height // canvas_res.y
    dpUniforms.values[2] = 0.5 // pointer_x
    dpUniforms.values[3] = 0.5 // pointer_y
    dpUniforms.values[4] = 1.0 // scale_x
    dpUniforms.values[5] = 1.0 // scale_y
    dpUniforms.values[6] = 1.0 // sensitivity
    dpUniforms.values[7] = 0.3 // center
    dpUniforms.values[8] = 0.0 // quality (0=basic, 1=occlusion perf, 2=occlusion quality)
    dpUniforms.values[9] = 1.0 // enable_x
    dpUniforms.values[10] = 1.0 // enable_y
    dpUniforms.values[11] = 0.0 // invert_x
    dpUniforms.values[12] = 0.0 // invert_y

    const qualityOptions: SelectOption[] = [
        { value: 0, label: '基础' },
        { value: 1, label: '遮挡性能' },
        { value: 2, label: '遮挡质量' },
    ]

    const properties: PropertyList = [
        createProperty({
            name: 'depth_map',
            label: '深度贴图',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultDepthMap-000000',
            uniformIndex: [-1, -1],
        }),
        createProperty({
            name: 'quality',
            label: '质量',
            type: PropertyType.Select,
            defaultValue: 0,
            uniformIndex: [8, 1],
            options: qualityOptions,
        }),
        createProperty({
            name: 'enable_x',
            label: '横向视差',
            type: PropertyType.Checkbox,
            defaultValue: true,
            uniformIndex: [9, 1],
        }),
        createProperty({
            name: 'enable_y',
            label: '纵向视差',
            type: PropertyType.Checkbox,
            defaultValue: true,
            uniformIndex: [10, 1],
        }),
        createProperty({
            name: 'invert_x',
            label: '翻转横向',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [11, 1],
        }),
        createProperty({
            name: 'invert_y',
            label: '翻转纵向',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [12, 1],
        }),
        createProperty({
            name: 'scale',
            label: '深度缩放',
            type: PropertyType.Vec2,
            defaultValue: [1.0, 1.0],
            range: [0.01, 2.0],
            uniformIndex: [4, 2],
        }),
        createProperty({
            name: 'sensitivity',
            label: '透视敏感度',
            type: PropertyType.Float,
            defaultValue: 1.0,
            range: [-5.0, 5.0],
            uniformIndex: [6, 1],
        }),
        createProperty({
            name: 'center',
            label: '中心点',
            type: PropertyType.Float,
            defaultValue: 0.3,
            range: [0.0, 1.0],
            uniformIndex: [7, 1],
        }),
    ]

    if (!shaderCode) {
        const response = await fetch('/effects/depthparallax/depthparallax.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name,
        label: '深度视差',
        properties,
        uniforms: dpUniforms,
        shaderCode,
        resources: [
            textures.baseTexture,
            textures.depthTexture,
            samplerStore.getSampler('linear', renderer),
            dpUniforms.getBuffer(),
        ],
    })
}
