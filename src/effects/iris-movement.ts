import type { PassTextureRef, WGSLRenderer } from 'wgsl-renderer'
import pinia from 'src/stores'
import type { PropertyList } from '.'
import { Effect } from '.'

const samplerStore = useSamplerStore(pinia)

let shaderCode: string | null = null

export async function createIrisMovementEffect(renderer: WGSLRenderer, textures: {
    baseTexture: GPUTexture | PassTextureRef,
    maskTexture: GPUTexture | PassTextureRef,
}) {
    const imUniform = renderer.createUniforms(8)
    imUniform.values[0] = 1280
    imUniform.values[1] = 720
    const properties: PropertyList = []

    if (!shaderCode) {
        const response = await fetch('/effects/iris-movement/iris-movement.wgsl')
        shaderCode = await response.text()
    }

    return new Effect({
        name: 'iris-movement',
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
