import type { RenderPassOptions, WGSLRenderer } from 'wgsl-renderer'

interface ImageLayer {
    blob: Blob,
    name: string,
    size: {
        width: number,
        height: number,
    }
    passes: RenderPassOptions[],
}

const shaders: Record<string, string> = {}

async function createShader(name: string) {
    if (shaders[name]) {
        return shaders[name]
    }

    const res = await fetch(`/effects/${name}.wgsl`)
    const shader = await res.text()
    shaders[name] = shader

    return shader
}

const useLayers = defineStore('layers', {
    state: () => ({ 
        images: [] as ImageLayer[],
        renderer: null as WGSLRenderer | null,
    }),
    actions: {
        async addImage(image: ImageLayer) {
            const baseShader = await createShader('base-layer')
            if (this.renderer) {
                const sampler = this.renderer.createSampler()
                const { texture } = await this.renderer.loadImageTexture(image.blob)
                image.passes.push({
                    name: 'base',
                    shaderCode: baseShader,
                    blendMode: 'alpha',
                    renderToCanvas: true,
                    resources: [
                        texture,
                        sampler,
                    ],
                })
                this.images.push(image)
                this.renderer.addPass(image.passes[0]!)
                this.renderer.renderFrame()
            }
        },
    },
    getters: {
        passes(state) {
            return state.images.map(item => item.passes).flat()
        },
    },
})

export { useLayers }
