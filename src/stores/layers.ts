import type { Effect } from 'src/effects'
import { createWaterRippleEffect } from 'src/effects/water-ripple'
import { crc32 } from 'src/utils/crc'
import type { RenderPassOptions, WGSLRenderer } from 'wgsl-renderer'
import { defineStore } from 'pinia'

export interface Material {
    url: string
    texture: GPUTexture
    width: number
    height: number
}

export interface ImageLayer {
    name: string,
    url: string,
    crc: string,
    size: {
        width: number,
        height: number,
    }
    passes: RenderPassOptions[],
    effects: Effect[],
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
    state: () => {
        return { 
            renderer: null as WGSLRenderer | null,
            imageLayers: [] as ImageLayer[],
            materials: new Map<string, Material>(),
            updateFrame: [] as { (t: number): void }[],
        }
    },
    actions: {
        async addImage(file: File) {
            if (this.renderer) {
                const baseShader = await createShader('base-layer')
                const imageLayer: ImageLayer = await this.createImageLayer(file)
                const sampler = this.renderer.createSampler()

                const { texture, width, height } = await this.renderer.loadImageTexture(file)

                this.materials.set(`${imageLayer.crc}__meterial`, {
                    url: imageLayer.url,
                    texture,
                    width,
                    height,
                })

                imageLayer.size.width = width
                imageLayer.size.height = height

                imageLayer.passes.push({
                    name: `${imageLayer.crc}__base-shader`,
                    shaderCode: baseShader,
                    resources: [
                        texture,
                        sampler,
                    ],
                })
                this.imageLayers.push(imageLayer)
                this.renderer.addPass(imageLayer.passes[0]!)
            }
        },

        async createImageLayer(file: File): Promise<ImageLayer> {
            const data = new Uint8Array(await file.arrayBuffer())
            const crc = crc32(data).toString(16)
                .padStart(8, '0')

            return {
                url: URL.createObjectURL(file),
                name: file.name,
                crc,
                size: {
                    width: 0,
                    height: 0,
                },
                passes: [],
                effects: [],
            }
        },

        async addEffect(layerIndex: number, effectName: string) {
            const imageLayer = this.imageLayers[layerIndex]
            if (!imageLayer || !this.renderer) return
            switch (effectName) {
                case 'water-ripple':
                    const imageData = new ImageData(imageLayer.size.width, imageLayer.size.height)
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] = 255
                        imageData.data[i + 1] = 255
                        imageData.data[i + 2] = 255
                        imageData.data[i + 3] = 255
                    }

                    if (!this.materials.has('white_mask')) {
                        const cvs = document.createElement('canvas')
                        cvs.width = 100
                        cvs.height = 100
                        const ctx = cvs.getContext('2d')!
                        ctx.putImageData(imageData, 0, 0)
                        const whiteBlob = await new Promise<Blob>(resolve => {
                            cvs.toBlob(blob => {
                                resolve(blob!)
                            })
                        })
    
                        const { texture: maskTexture, width, height } = await this.renderer.loadImageTexture(whiteBlob)
                        this.materials.set('white_mask', {
                            url: URL.createObjectURL(whiteBlob),
                            texture: maskTexture,
                            width,
                            height,
                        })
                    }

                    const { texture: maskTexture } = this.materials.get('white_mask')!

                    const waterRipplerEffect = await createWaterRippleEffect(this.renderer as WGSLRenderer, {
                        baseTexture: this.renderer.getPassTexture(`${imageLayer.crc}__base-shader`),
                        maskTexture: maskTexture,
                    })

                    imageLayer.effects.push(waterRipplerEffect)
        
                    this.renderer.addPass(waterRipplerEffect.getPassOptions())

                    this.updateFrame.push(t => {
                        waterRipplerEffect.uniforms.values[4] = t * 0.001
                        waterRipplerEffect.uniforms.apply()
                    })
                    break
            }
        },
    },
    getters: {
        passes(state) {
            return state.imageLayers.map(item => item.passes).flat() as RenderPassOptions[]
        },
    },
})

export { useLayers }
