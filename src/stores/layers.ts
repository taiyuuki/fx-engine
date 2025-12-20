import type { Effect, Uniforms } from 'src/effects'
import { createWaterRippleEffect } from 'src/effects/water-ripple'
import { createCursorRippleEffect } from 'src/effects/cursor-ripple'
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
    uniforms?: Uniforms,
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

                // 先添加基础pass（图像层）
                this.renderer?.addPass({
                    blendMode: 'alpha',
                    renderToCanvas: layer.effects.length === 0,
                    clearColor: { r: 1, g: 1, b: 1, a: 0 },
                    ...layer.passes[0]!,
                })

                // 添加效果passes
                layer.effects.forEach((fx, i) => {

                    const passoptionsList = fx.getPassOptionsList()
                    
                    passoptionsList.forEach((passOptions, passIndex) => {

                        // 判断是否是最后一个效果，且是否最后一个pass
                        const isLastEffect = i === layer.effects.length - 1
                        const isLastPassInEffect = passIndex === passoptionsList.length - 1

                        this.renderer?.addPass({
                            blendMode: isLastEffect && isLastPassInEffect ? 'alpha' : 'none',
                            renderToCanvas: isLastEffect && isLastPassInEffect,
                            clearColor: { r: 1, g: 1, b: 1, a: 0 },
                            name: passOptions.name,
                            shaderCode: passOptions.shaderCode,
                            resources: passOptions.resources || [],
                        })
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

                const { texture, width, height } = await this.renderer.loadImageTexture(file)

                this.materials.set(`${imageLayer.crc}__meterial`, {
                    url: imageLayer.url,
                    texture,
                    width,
                    height,
                })

                imageLayer.size.width = width
                imageLayer.size.height = height

                const imgUniforms = this.renderer.createUniforms(8)

                const canvasWidth = canvasSettings.value.width
                const canvasHeight = canvasSettings.value.height

                imgUniforms.values.set([
                    canvasWidth, canvasHeight,
                    width, height,
                    0, 0,
                    1, 1,
                ])
                imgUniforms.apply()

                imageLayer.passes.push({
                    name: `${imageLayer.crc}__base-shader`,
                    shaderCode: baseShader,
                    resources: [
                        texture,
                        sampler,
                        imgUniforms.getBuffer(),
                    ],
                })

                imageLayer.uniforms = imgUniforms
                this.imageLayers.push(imageLayer)
                currentImage.value = imageLayer

                await this.reRender()
            }
        },

        updateImageTransform(imageLayer: ImageLayer) {
            if (!imageLayer.uniforms || !this.renderer) return

            // 使用动态画布尺寸
            const canvasWidth = canvasSettings.value.width
            const canvasHeight = canvasSettings.value.height

            imageLayer.uniforms.values.set([
                canvasWidth, canvasHeight,
                imageLayer.size.width, imageLayer.size.height,
                imageLayer.origin.x, imageLayer.origin.y,
                imageLayer.scale.x, imageLayer.scale.y,
            ])

            imageLayer.uniforms.apply()
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

        async addCursorRippleEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0xFFFFFF)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const cursorRippleEffect = await createCursorRippleEffect(`${imageLayer.crc}-effect-${c}__cursor-ripple`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(cursorRippleEffect)

            const canvasWidth = canvasSettings.value.width
            const canvasHeight = canvasSettings.value.height

            let lastTime = performance.now()
            this.updateFrame.push(t => {

                const frameTime = Math.min(0.1, (t - lastTime) * 0.001)
                lastTime = t

                // Normalize pointer coordinates - no Y flip for Apply Force Pass (match reference implementation)
                const normPointer = {
                    x: pointer.x / canvasWidth,
                    y: pointer.y / canvasHeight,
                }
                const normPointerLast = {
                    x: pointer.lx / canvasWidth,
                    y: pointer.ly / canvasHeight,
                }

                const pointerDelta = Math.sqrt(Math.pow(normPointer.x - normPointerLast.x, 2)
                    + Math.pow(normPointer.y - normPointerLast.y, 2))

                // Much stricter clamp to prevent huge ripples from mouse jumps
                // This happens when mouse enters from taskbar or page loads
                const maxPointerDelta = 0.02 // Reduced from 0.05 to prevent large jumps
                const clampedPointerDelta = Math.min(pointerDelta, maxPointerDelta)

                // Additional safety: completely ignore pointer if it's far outside canvas bounds
                const isPointerOutOfBounds = pointer.x < -50 || pointer.y < -50
                    || pointer.x > canvasWidth + 50
                    || pointer.y > canvasHeight + 50

                const finalPointerDelta = isPointerOutOfBounds ? 0 : clampedPointerDelta
                
                cursorRippleEffect.passUniforms.force?.values.set([
                    normPointer.x, normPointer.y,
                    normPointerLast.x, normPointerLast.y,
                    finalPointerDelta * 100,
                    1.0, // scale
                    frameTime,
                ])
                cursorRippleEffect.passUniforms.force?.apply()

                cursorRippleEffect.passUniforms.simulate?.values.set([
                    canvasWidth, canvasHeight,
                    1.0, // speed
                    1.0, // decay
                    frameTime,
                    0.0, // useMask
                ])
                cursorRippleEffect.passUniforms.simulate?.apply()

                cursorRippleEffect.passUniforms.combine?.values.set([
                    canvasWidth, canvasHeight,
                    1.0, // strength
                    0.0,
                ])
                cursorRippleEffect.passUniforms.combine?.apply()
            })

            await this.reRender()
        },

        async addEffect(effectName: string) {
            if (!currentImage.value) return
            const image = currentImage.value
            switch (effectName) {
                case 'water-ripple':
                    await this.addWaterRippleEffect(image)
                    break
                case 'iris-movement':
                    await this.addIrisMovementEffect(image)
                    break
                case 'water-flow':
                    await this.addWaterFlowEffect(image)
                    break
                case 'cursor-ripple':
                    await this.addCursorRippleEffect(image)
                    break
            }
        },

        byPass(e: Effect, i: number) {
            if (!this.renderer || !e.resources || !currentImage.value) return -1
            const preName = currentImage.value.effects[i - 1]?.name ?? baseLayerPassname(currentImage.value)
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
