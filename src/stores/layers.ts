import { createWaterRippleEffect } from 'src/effects/water-ripple'
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
                const { texture, width, height } = await this.renderer.loadImageTexture(image.blob)
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

                // 创建纯白色蒙版
                const imageData = new ImageData(width, height)
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = 255
                    imageData.data[i + 1] = 255
                    imageData.data[i + 2] = 255
                    imageData.data[i + 3] = 255
                }
                const cvs = document.createElement('canvas')
                cvs.width = width
                cvs.height = height
                const ctx = cvs.getContext('2d')!
                ctx.putImageData(imageData, 0, 0)
                const whiteBlob = await new Promise<Blob>(resolve => {
                    cvs.toBlob(blob => {
                        resolve(blob!)
                    })
                })
                const { texture: maskTexture } = await this.renderer.loadImageTexture(whiteBlob)
                
                this.images.push(image)
                this.renderer.addPass(image.passes[0]!)
                const waterRipplerEffect = await createWaterRippleEffect(this.renderer as WGSLRenderer, {
                    baseTexture: texture,
                    maskTexture: maskTexture,
                })
                this.renderer.addPass(waterRipplerEffect.getPassOptions())
                this.renderer.loopRender(t => {
                    waterRipplerEffect.uniforms.values[4] = t * 0.001
                    waterRipplerEffect.applyUniforms()
                })
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
