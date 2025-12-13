import type { Effect } from 'src/effects'
import { createWaterRippleEffect } from 'src/effects/water-ripple'
import { crc32 } from 'src/utils/crc'
import type { RenderPassOptions, WGSLRenderer } from 'wgsl-renderer'
import { defineStore } from 'pinia'
import { createIrisMovementEffect } from 'src/effects/iris-movement'
import pinia from 'stores/index'
import { currentImage } from 'src/pages/side-bar/composibles'

const pointer = usePointer(pinia)

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

export function baseLayerPassname(imageLayer: ImageLayer) {
    return `${imageLayer.crc}__base-shader`
}

const useLayers = defineStore('layers', {
    state: () => {
        return { 
            renderer: null as WGSLRenderer | null,
            imageLayers: [] as ImageLayer[],
            materials: new Map<string, Material>(),
            updateFrame: [] as { (t: number): void }[],
            outputPass: [] as string[],
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

        async getDefaultMaskTexture(colorValue: number) {
            const materialName = `defaultMask-${colorValue}`
            if (!this.materials.has(materialName)) {
                
                const imageData = new ImageData(100, 100)
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = colorValue
                    imageData.data[i + 1] = colorValue
                    imageData.data[i + 2] = colorValue
                    imageData.data[i + 3] = 255
                }
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
    
                const { texture: maskTexture, width, height } = await this.renderer!.loadImageTexture(whiteBlob)
                this.materials.set(materialName, {
                    url: URL.createObjectURL(whiteBlob),
                    texture: maskTexture,
                    width,
                    height,
                })
            }

            const { texture } = this.materials.get(materialName)!

            return texture
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

        async addWaterRippleEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)

            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)
            this.outputPass.push(prePassName)
            const waterRipplerEffect = await createWaterRippleEffect(`${imageLayer.crc}-effect-${c}__water-ripple`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(waterRipplerEffect)
        
            this.renderer.addPass(waterRipplerEffect.getPassOptions())

            this.updateFrame.push(t => {
                waterRipplerEffect.uniforms.values[4] = t * 0.001
                waterRipplerEffect.uniforms.apply()
            })
        },

        async addIrisMovementEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)

            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)
            this.outputPass.push(prePassName)
            const irisMovementEffect = await createIrisMovementEffect(`${imageLayer.crc}-effect-${c}__irir-movement`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(irisMovementEffect)
        
            this.renderer.addPass(irisMovementEffect.getPassOptions())

            this.updateFrame.push(() => {
                irisMovementEffect.uniforms.values[2] = pointer.x
                irisMovementEffect.uniforms.values[3] = pointer.y
                irisMovementEffect.uniforms.apply()
            })
        },

        async addEffect(layerIndex: number, effectName: string) {
            const imageLayer = this.imageLayers[layerIndex]
            if (!imageLayer) return
            switch (effectName) {
                case 'water-ripple':
                    await this.addWaterRippleEffect(imageLayer)
                    break
                case 'iris-movement':
                    await this.addIrisMovementEffect(imageLayer)
                    break
            }
        },

        byPass(e: Effect, i: number) {
            if (!this.renderer || !e.resources || !currentImage.value) return -1
            const passIndex = this.outputPass.findIndex(o => o === e.name)
            const pre = this.outputPass[passIndex - 1]
            const nextEffect = currentImage.value?.effects[i + 1]

            if (pre && nextEffect?.resources) {
                nextEffect.setResource(0, this.renderer.getPassTexture(pre))
            
                this.renderer?.updateBindGroupSetResources(nextEffect.name, 'default', nextEffect.resources)    
                this.renderer?.switchBindGroupSet(nextEffect.name, 'default')
            }

            return passIndex
        },

        rePass(e: Effect, i: number) {
            if (!this.renderer || !e.resources || !currentImage.value) return
            const passIndex = this.outputPass.findIndex(o => o === e.name)
            const cur = this.outputPass[passIndex]
            const nextEffect = currentImage.value?.effects[i + 1]
            if (cur && nextEffect?.resources) {
                nextEffect.setResource(0, this.renderer.getPassTexture(cur))
                this.renderer?.updateBindGroupSetResources(nextEffect.name, 'default', nextEffect.resources)
            }
        },

        removeEffect(e: Effect, i: number) {
            let passIndex = -1
            if (this.renderer?.getPassByName(e.name)?.enabled) {
                passIndex = this.byPass(e, i)
            }
            else {
                passIndex = this.outputPass.findIndex(o => o === e.name)
            }
            if (passIndex >= 0) { 
                this.outputPass.splice(passIndex, 1) 
            }

            this.renderer?.removePass(e.name)
            currentImage.value?.effects.splice(i, 1)         
        },

        switchEnable(e: Effect, i: number) {
            if (e.enable) {
                this.renderer?.enablePass(e.name)
                this.rePass(e, i)
            }
            else {
                this.renderer?.disablePass(e.name)
                this.byPass(e, i)
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
