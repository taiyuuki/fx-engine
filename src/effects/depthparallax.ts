import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'stores/index'
import { canvasSettings } from 'src/pages/side-bar/composibles'
import type { PropertyList } from '.'
import { Effect, PropertyType, createProperty, type SelectOption } from '.'

const samplerStore = useSamplerStore(pinia)
const pointer = usePointer(pinia)

let shaderCode: string | null = null

export async function createDepthParallaxEffect(name: string, renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    depthTexture: GPUTexture,
    maskTexture: GPUTexture,
}) {

    const dpUniforms = renderer.createUniforms(16)
    dpUniforms.values[0] = canvasSettings.value.width // canvas_res.x
    dpUniforms.values[1] = canvasSettings.value.height // canvas_res.y
    dpUniforms.values[2] = 0.5 // pointer_x
    dpUniforms.values[3] = 0.5 // pointer_y
    dpUniforms.values[4] = 1.0 // scale_x
    dpUniforms.values[5] = 1.0 // scale_y
    dpUniforms.values[6] = 1.0 // sensitivity
    dpUniforms.values[7] = 0.3 // center
    dpUniforms.values[8] = 1.0 // quality (0=basic, 1=occlusion perf, 2=occlusion quality)
    dpUniforms.values[9] = 0.0 // use_mask

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
            defaultValue: 1,
            uniformIndex: [8, 1],
            options: qualityOptions,
        }),
        createProperty({
            name: 'use_mask',
            label: '使用不透明蒙版',
            type: PropertyType.Checkbox,
            defaultValue: false,
            uniformIndex: [9, 1],
        }),
        createProperty({
            name: 'alpha_mask',
            label: '不透明蒙版',
            type: PropertyType.AlphaMask,
            defaultValue: 'defaultMask-000000',
            uniformIndex: [-2, -1],
            condition: () => dpUniforms.values[9] === 1.0,
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
            textures.maskTexture,
            samplerStore.getSampler('linear', renderer),
            dpUniforms.getBuffer(),
        ],
    })
}
