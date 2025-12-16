import type { Effect } from 'src/effects'
import { createWaterRippleEffect } from 'src/effects/water-ripple'
import { crc32 } from 'src/utils/crc'
import type { RenderPassOptions, WGSLRenderer } from 'wgsl-renderer'
import { defineStore } from 'pinia'
import { createIrisMovementEffect } from 'src/effects/iris-movement'
import pinia from 'stores/index'
import { canvasSettings, currentImage } from 'src/pages/side-bar/composibles'
import { createWaterFlowEffect } from 'src/effects/water-flow'

const pointer = usePointer(pinia)
const samplerStore = useSamplerStore()

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
    },
    origin: {
        x: number,
        y: number,
    },
    scale: {
        x: number,
        y: number,
    },
    passes: RenderPassOptions[],
    effects: Effect[],
    uniformBuffer?: GPUBuffer,
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
        }
    },
    actions: {

        async reRender() {
            if (!this.renderer) return
            this.renderer.reset()
            this.imageLayers.forEach(layer => {
                const ec = layer.effects.length

                this.renderer?.addPass({
                    blendMode: 'alpha',
                    renderToCanvas: ec === 0,
                    ...layer.passes[0]!,
                })

                layer.effects.forEach((fx, i) => {
                    const options = fx.getPassOptions()
                    const last = i === ec - 1
                    this.renderer?.addPass({
                        blendMode: last ? 'alpha' : 'none',
                        renderToCanvas: last, 
                        ...options,
                    })
                })
            })

            this.renderer.loopRender(t => {
                this.updateFrame.forEach(f => f(t))
            })
        },

        async addImage(file: File) {
            if (this.renderer) {
                const baseShader = await createShader('base-layer')
                const imageLayer = await this.createImageLayer(file)

                const sampler = samplerStore.getSampler('high-quality', this.renderer as WGSLRenderer)

                const { texture, width, height } = await this.renderer.loadImageTexture(file, void 0, { resizeQuality: 'high' })

                this.materials.set(`${imageLayer.crc}__meterial`, {
                    url: imageLayer.url,
                    texture,
                    width,
                    height,
                })

                imageLayer.size.width = width
                imageLayer.size.height = height

                // 创建 uniform buffer
                const uniformBuffer = this.renderer.getDevice().createBuffer({
                    size: 32, // canvas_res(8) + image_res(8) + origin(8) + scale(8) = 32 bytes
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                })

                // 初始化 uniform 数据
                const canvasWidth = canvasSettings.value.initialized ? canvasSettings.value.width : 1280
                const canvasHeight = canvasSettings.value.initialized ? canvasSettings.value.height : 720
                const canvasRes = new Float32Array([canvasWidth, canvasHeight])
                const imageRes = new Float32Array([width, height])
                const origin = new Float32Array([0, 0])
                const scale = new Float32Array([1, 1])

                this.renderer.getDevice().queue.writeBuffer(
                    uniformBuffer,
                    0,
                    new Float32Array([
                        ...canvasRes,
                        ...imageRes,
                        ...origin,
                        ...scale,
                    ]),
                )

                imageLayer.passes.push({
                    name: `${imageLayer.crc}__base-shader`,
                    shaderCode: baseShader,
                    resources: [
                        texture,
                        sampler,
                        uniformBuffer,
                    ],
                })

                // 保存 uniform buffer 引用以便后续更新
                imageLayer.uniformBuffer = uniformBuffer
                this.imageLayers.push(imageLayer)

                await this.reRender()
            }
        },

        updateImageTransform(imageLayer: ImageLayer) {
            if (!imageLayer.uniformBuffer || !this.renderer) return

            // 使用动态画布尺寸
            const canvasWidth = canvasSettings.value.initialized ? canvasSettings.value.width : 1280
            const canvasHeight = canvasSettings.value.initialized ? canvasSettings.value.height : 720
            const canvasRes = new Float32Array([canvasWidth, canvasHeight])
            const imageRes = new Float32Array([imageLayer.size.width, imageLayer.size.height])
            const origin = new Float32Array([imageLayer.origin.x, imageLayer.origin.y])
            const scale = new Float32Array([imageLayer.scale.x, imageLayer.scale.y])

            this.renderer.getDevice().queue.writeBuffer(
                imageLayer.uniformBuffer,
                0,
                new Float32Array([
                    ...canvasRes,
                    ...imageRes,
                    ...origin,
                    ...scale,
                ]),
            )
        },

        async removeImage(i: number) {
            const imageLayer = this.imageLayers.splice(i, 1)[0]
            if (imageLayer === currentImage.value) {
                currentImage.value = null
            }
            await this.reRender()
        },

        async getDefaultMaskTexture(colorValue: number) {
            const materialName = `defaultMask-${colorValue.toString(16).toLocaleUpperCase()
                .padStart(6, '0')}`
            if (!this.materials.has(materialName)) {
                
                const imageData = new ImageData(100, 100)
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = colorValue >> 16 & 0xFF
                    imageData.data[i + 1] = colorValue >> 8 & 0xFF
                    imageData.data[i + 2] = colorValue & 0xFF
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
                origin: {
                    x: 0,
                    y: 0,
                },
                scale: {
                    x: 1,
                    y: 1,
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

            const waterRipplerEffect = await createWaterRippleEffect(`${imageLayer.crc}-effect-${c}__water-ripple`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(waterRipplerEffect)

            this.updateFrame.push(t => {
                waterRipplerEffect.uniforms.values[4] = t * 0.001
                waterRipplerEffect.uniforms.apply()
            })
            await this.reRender()
        },

        async addWaterFlowEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return
            const maskTexture = await this.getDefaultMaskTexture(0x7F7F00)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const waterFlowEffect = await createWaterFlowEffect(`${imageLayer.crc}-effect-${c}__water-ripple`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(waterFlowEffect)
            this.updateFrame.push(t => {
                waterFlowEffect.uniforms.values[0] = t * 0.001
                waterFlowEffect.uniforms.apply()
            })

            await this.reRender()
        },

        async addIrisMovementEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)

            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const irisMovementEffect = await createIrisMovementEffect(`${imageLayer.crc}-effect-${c}__irir-movement`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(irisMovementEffect)

            this.updateFrame.push(() => {
                if (pointer.x >= 0) {
                    irisMovementEffect.uniforms.values[2] = pointer.x
                }
                if (pointer.y >= 0) {
                    irisMovementEffect.uniforms.values[3] = pointer.y
                }
                irisMovementEffect.uniforms.apply()
            })
            
            await this.reRender()
        },

        async addEffect(effectName: string) {
            if (!currentImage.value) return
            switch (effectName) {
                case 'water-ripple':
                    await this.addWaterRippleEffect(currentImage.value)
                    break
                case 'iris-movement':
                    await this.addIrisMovementEffect(currentImage.value)
                    break
                case 'water-flow':
                    await this.addWaterFlowEffect(currentImage.value)
                    break
            }
        },

        byPass(e: Effect, i: number) {
            if (!this.renderer || !e.resources || !currentImage.value) return -1
            const preName = currentImage.value?.effects[i - 1]?.name ?? baseLayerPassname(currentImage.value)
            const nextEffect = currentImage.value?.effects[i + 1]

            if (preName && nextEffect?.resources) {
                nextEffect.setResource(0, this.renderer.getPassTexture(preName))
            }

        },

        async removeEffect(e: Effect, i: number) {
            this.byPass(e, i)
            currentImage.value?.effects.splice(i, 1)
            await this.reRender()
        },
    },
    getters: {
        passes(state) {
            return state.imageLayers.map(item => item.passes).flat() as RenderPassOptions[]
        },
    },
})

export { useLayers }
