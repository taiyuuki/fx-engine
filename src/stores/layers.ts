import type { Effect, Uniforms } from 'src/effects'
import { crc32 } from 'src/utils/crc'
import type { RenderPassOptions, WGSLRenderer } from 'wgsl-renderer'
import { defineStore } from 'pinia'
import { createIrisMovementEffect } from 'src/effects/iris-movement'
import pinia from 'stores/index'
import { canvasSettings, currentEffect, currentImage } from 'src/pages/side-bar/composibles'

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
    rotation: number, // 旋转角度（弧度）
    passes: RenderPassOptions[],
    effects: Effect[],
    uniforms?: Uniforms,
}

const shaders: Record<string, string> = {}

/**
 * 构建从屏幕空间到图层空间的 3x3 变换矩阵（column-major order）
 * 变换顺序：先缩放，再旋转，最后平移 (T * R * S)
 *
 * 变换流程：
 * 1. 缩放：scale.x, scale.y
 * 2. 旋转：rotation (弧度)
 * 3. 平移：origin.x, origin.y (屏幕坐标系中的位置)
 *
 * 注意：这里的矩阵实现的是从屏幕坐标到图层坐标的转换
 * 即：layerPos = M * screenPos
 */
export function buildTransformMatrix(
    originX: number,
    originY: number,
    scaleX: number,
    scaleY: number,
    rotation: number,
): Float32Array {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)

    // 平移：屏幕坐标到图层原点的偏移
    // 我们需要将屏幕坐标转换到以图层原点为基准的坐标系
    const tx = -originX
    const ty = -originY

    // 缩放的倒数（用于从屏幕坐标映射到图层坐标）
    const sx = 1 / scaleX
    const sy = 1 / scaleY

    // 构建列主序矩阵 T * R * S：
    // | cos*sx  -sin*sy   tx |
    // | sin*sx   cos*sy   ty |
    // |   0        0       1  |

    return new Float32Array([
        cos * sx, // [0] col 0, row 0
        sin * sx, // [1] col 0, row 1
        0.0, // [2] col 0, row 2
        -sin * sy, // [3] col 1, row 0
        cos * sy, // [4] col 1, row 1
        0.0, // [5] col 1, row 2
        tx, // [6] col 2, row 0
        ty, // [7] col 2, row 1
        1.0, // [8] col 2, row 2
    ])
}

/**
 * 计算 3x3 矩阵的逆矩阵（列主序）
 * 用于从图层坐标转换回屏幕坐标
 *
 * 对于变换矩阵 M = T * R * S
 * 逆矩阵 M^-1 = S^-1 * R^-1 * T^-1
 */
export function invertMatrix3x3(m: Float32Array): Float32Array {

    // 行列式计算
    const det = m[0] * (m[4] * m[8] - m[5] * m[7])
        - m[3] * (m[1] * m[8] - m[2] * m[7])
        + m[6] * (m[1] * m[5] - m[2] * m[4])

    if (Math.abs(det) < 1e-10) {

        // 矩阵不可逆，返回单位矩阵
        return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
    }

    const invDet = 1.0 / det

    return new Float32Array([
        (m[4] * m[8] - m[5] * m[7]) * invDet, // [0]
        (m[2] * m[7] - m[1] * m[8]) * invDet, // [1]
        (m[1] * m[5] - m[2] * m[4]) * invDet, // [2]
        (m[5] * m[6] - m[3] * m[8]) * invDet, // [3]
        (m[0] * m[8] - m[2] * m[6]) * invDet, // [4]
        (m[2] * m[3] - m[0] * m[5]) * invDet, // [5]
        (m[3] * m[7] - m[4] * m[6]) * invDet, // [6]
        (m[1] * m[6] - m[0] * m[7]) * invDet, // [7]
        (m[0] * m[4] - m[1] * m[3]) * invDet, // [8]
    ])
}

/**
 * 使用逆矩阵将图层坐标转换为屏幕坐标
 * @param layerPos 图层空间坐标
 * @param invTransform 逆变换矩阵
 * @returns 屏幕空间坐标
 */
export function layerToScreen(
    layerX: number,
    layerY: number,
    invTransform: Float32Array,
): { x: number, y: number } {

    // 应用逆矩阵：screenPos = M^-1 * layerPos
    const screenX = invTransform[0] * layerX + invTransform[3] * layerY + invTransform[6]
    const screenY = invTransform[1] * layerX + invTransform[4] * layerY + invTransform[7]

    return { x: screenX, y: screenY }
}

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
                const hasEffects = layer.effects.length !== 0
                this.renderer?.addPass({
                    blendMode: hasEffects ? 'none' : 'alpha',
                    renderToCanvas: !hasEffects,
                    ...layer.passes[0]!,
                    clearColor: {
                        r: 1,
                        g: 1,
                        b: 1, 
                        a: 1,
                    },
                })

                // 添加效果passes
                layer.effects.forEach((fx, i) => {

                    const passoptionsList = fx.getPassOptionsList()
                    
                    passoptionsList.forEach((passOptions, passIndex) => {

                        // 判断是否是最后一个效果，且是否最后一个pass
                        const isLastEffect = i === layer.effects.length - 1
                        const isLastPassInEffect = passIndex === passoptionsList.length - 1
                        const isLast = isLastEffect && isLastPassInEffect

                        // Debug all passes for cursor ripple
                        const finalPassOptions = { ...passOptions }

                        this.renderer?.addPass({
                            blendMode: isLast ? 'alpha' : 'none',
                            renderToCanvas: isLast,
                            ...finalPassOptions,
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

                const imgUniforms = this.renderer.createUniforms(16)

                const canvasWidth = canvasSettings.value.width
                const canvasHeight = canvasSettings.value.height

                const transformMatrix = buildTransformMatrix(0, 0, 1, 1, 0)

                // 使用 vec4 数组存储 3x3 矩阵，每列一个 vec4
                // m[0] = col0: (cos/sx, sin/sx, 0, padding)
                // m[1] = col1: (-sin/sy, cos/sy, 0, padding)
                // m[2] = col2: (tx, ty, 1, padding)

                imgUniforms.values.set([
                    canvasWidth, canvasHeight, // [0-1] canvas_res
                    width, height, // [2-3] image_res
                    // m[0] = col0
                    transformMatrix[0], transformMatrix[1], transformMatrix[2], 0,

                    // m[1] = col1
                    transformMatrix[3], transformMatrix[4], transformMatrix[5], 0,

                    // m[2] = col2
                    transformMatrix[6], transformMatrix[7], transformMatrix[8], 0,
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

            // 构建变换矩阵
            const transformMatrix = buildTransformMatrix(
                imageLayer.origin.x,
                imageLayer.origin.y,
                imageLayer.scale.x,
                imageLayer.scale.y,
                imageLayer.rotation,
            )

            imageLayer.uniforms.values.set([
                canvasWidth, canvasHeight, // [0-1] canvas_res
                imageLayer.size.width, imageLayer.size.height, // [2-3] image_res
                // m[0] = col0
                transformMatrix[0], transformMatrix[1], transformMatrix[2], 0,

                // m[1] = col1
                transformMatrix[3], transformMatrix[4], transformMatrix[5], 0,

                // m[2] = col2
                transformMatrix[6], transformMatrix[7], transformMatrix[8], 0,
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
                rotation: 0,
                passes: [],
                effects: [],
            }
        },

        async addWaterRippleEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)

            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createWaterRippleEffect } = await import('src/effects/water-ripple')
            const waterRipplerEffect = await createWaterRippleEffect(`${imageLayer.crc}-effect-${c}__water-ripple`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(waterRipplerEffect)

            this.updateFrame.push(t => {
                waterRipplerEffect.uniforms.values[4] = t * 0.001
                waterRipplerEffect.uniforms.apply()
            })
        },

        async addWaterFlowEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return
            const maskTexture = await this.getDefaultMaskTexture(0x7F7F00)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createWaterFlowEffect } = await import('src/effects/water-flow')
            const waterFlowEffect = await createWaterFlowEffect(`${imageLayer.crc}-effect-${c}__water-ripple`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(waterFlowEffect)
            this.updateFrame.push(t => {
                waterFlowEffect.uniforms.values[0] = t * 0.001
                waterFlowEffect.uniforms.apply()
            })
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
                    irisMovementEffect.uniforms.values[0] = pointer.x
                }
                if (pointer.y >= 0) {
                    irisMovementEffect.uniforms.values[1] = pointer.y
                }
                irisMovementEffect.uniforms.apply()
            })
        },

        async addCloudMotionEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0x000000)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createCloudMotionEffect } = await import('src/effects/cloud-motion')
            const cloudMotionEffect = await createCloudMotionEffect(`${imageLayer.crc}-effect-${c}__cloud-motion`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(cloudMotionEffect)
            this.updateFrame.push(t => {
                cloudMotionEffect.uniforms.values[2] = t * 0.0001
                cloudMotionEffect.uniforms.apply()
            })
        },

        async addCursorRippleEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0xFFFFFF)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const baseTexture = this.renderer.getPassTexture(prePassName)
            const { createCursorRippleEffect } = await import('src/effects/cursor-ripple')
            const cursorRippleEffect = await createCursorRippleEffect(`${imageLayer.crc}-effect-${c}__cursor-ripple`, this.renderer as WGSLRenderer, {
                baseTexture: baseTexture,
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(cursorRippleEffect)

            // Initialize canvas resolution immediately after creation
            const canvasWidth = canvasSettings.value.width
            const canvasHeight = canvasSettings.value.height
            cursorRippleEffect.passUniforms.force!.values[6] = canvasWidth
            cursorRippleEffect.passUniforms.force!.values[7] = canvasHeight
            cursorRippleEffect.passUniforms.force?.apply()

            let lastTime = performance.now()

            // Track position ourselves since pointer.lx/ly may not update when mouse stops
            let trackedLastX = pointer.x
            let trackedLastY = pointer.y
            let isInitialized = false
            let wasOutOfBounds = true // Start with true to prevent initial ripple

            this.updateFrame.push(t => {

                const frameTime = Math.min(0.1, (t - lastTime) * 0.001)
                lastTime = t

                // Calculate actual pointer delta using our tracked position
                const currentX = pointer.x
                const currentY = pointer.y

                // Calculate delta based on tracked last position
                const rawDelta = Math.sqrt(Math.pow(currentX - trackedLastX, 2) + Math.pow(currentY - trackedLastY, 2))

                // Detect position jump (mouse entering canvas or large sudden movement)
                const isOutOfBounds = currentX < 0 || currentY < 0
                const isJump = !isInitialized // Only check initialization, not distance

                // Check if mouse just entered from outside
                const justEntered = !isOutOfBounds && wasOutOfBounds
                if (isOutOfBounds) {
                    wasOutOfBounds = true
                }
                else {
                    wasOutOfBounds = false
                }

                // Threshold for considering mouse stopped (very small movement)
                const stoppedThreshold = 0.0005 // ~0.05% of screen, or ~1px on 1920px
                const isStopped = rawDelta < stoppedThreshold

                let finalPointerDelta: number
                let finalLastX: number
                let finalLastY: number

                if (isJump || isOutOfBounds || justEntered) {

                    // On jump, out of bounds, or just entered: don't generate ripples
                    finalPointerDelta = 0
                    finalLastX = currentX >= 0 ? currentX : 0
                    finalLastY = currentY >= 0 ? currentY : 0
                    trackedLastX = finalLastX
                    trackedLastY = finalLastY
                    isInitialized = true
                }
                else if (isStopped) {

                    // Mouse stopped: don't generate ripples, reset tracking
                    finalPointerDelta = 0
                    finalLastX = currentX
                    finalLastY = currentY
                    trackedLastX = currentX
                    trackedLastY = currentY
                }
                else {

                    // Normal movement: use full trajectory for continuous ripples
                    finalPointerDelta = rawDelta * 100
                    finalLastX = trackedLastX
                    finalLastY = trackedLastY
                    trackedLastX = currentX
                    trackedLastY = currentY
                }

                // Get canvas resolution
                const canvasWidth = canvasSettings.value.width
                const canvasHeight = canvasSettings.value.height

                // Update dynamic mouse-related values only
                // Layout: [0-1]pointer, [2-3]pointerLast, [4]pointerDelta, [5]rippleScale, [6-7]canvasRes, [8]frameTime
                cursorRippleEffect.passUniforms.force!.values[0] = currentX
                cursorRippleEffect.passUniforms.force!.values[1] = currentY
                cursorRippleEffect.passUniforms.force!.values[2] = finalLastX
                cursorRippleEffect.passUniforms.force!.values[3] = finalLastY
                cursorRippleEffect.passUniforms.force!.values[4] = finalPointerDelta
                cursorRippleEffect.passUniforms.force!.values[6] = canvasWidth
                cursorRippleEffect.passUniforms.force!.values[7] = canvasHeight
                cursorRippleEffect.passUniforms.force!.values[8] = frameTime

                cursorRippleEffect.passUniforms.simulate!.values[4] = frameTime // frameTime at offset 4

                cursorRippleEffect.passUniforms.force?.apply()
                cursorRippleEffect.passUniforms.simulate?.apply()
                cursorRippleEffect.passUniforms.combine?.apply()
            })
        },

        async addScrollEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createScrollEffect } = await import('src/effects/scroll')
            const scrollEffect = await createScrollEffect(`${imageLayer.crc}-effect-${c}__scroll`, this.renderer as WGSLRenderer, { baseTexture: this.renderer.getPassTexture(prePassName) })

            imageLayer.effects.push(scrollEffect)

            this.updateFrame.push(t => {
                scrollEffect.uniforms.values[4] = t * 0.001 // Convert ms to seconds
                scrollEffect.uniforms.apply()
            })
        },

        async addWaterWavesEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createWaterWavesEffect } = await import('src/effects/waterwaves')
            const waterWavesEffect = await createWaterWavesEffect(`${imageLayer.crc}-effect-${c}__waterwaves`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(waterWavesEffect)

            this.updateFrame.push(t => {
                waterWavesEffect.uniforms.values[2] = t * 0.001 // time
                waterWavesEffect.uniforms.apply()
            })
        },

        async addShakeEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const flowMaskTexture = await this.getDefaultMaskTexture(0x7F7F00)
            const timeOffsetTexture = await this.getDefaultMaskTexture(0)
            const opacityMaskTexture = await this.getDefaultMaskTexture(0)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createShakeEffect } = await import('src/effects/shake')
            const shakeEffect = await createShakeEffect(`${imageLayer.crc}-effect-${c}__shake`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                flowMaskTexture: flowMaskTexture,
                timeOffsetTexture: timeOffsetTexture,
                opacityMaskTexture: opacityMaskTexture,
            })

            imageLayer.effects.push(shakeEffect)

            this.updateFrame.push(t => {
                shakeEffect.uniforms.values[0] = t * 0.001 // time in seconds
                shakeEffect.uniforms.apply()
            })
        },

        async addDepthParallaxEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            // Create default black depth texture (no depth)
            const depthTexture = await this.getDefaultMaskTexture(0x000000)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createDepthParallaxEffect } = await import('src/effects/depthparallax')
            const depthParallaxEffect = await createDepthParallaxEffect(`${imageLayer.crc}-effect-${c}__depthparallax`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                depthTexture: depthTexture,
            })

            imageLayer.effects.push(depthParallaxEffect)

            // Store default depth texture in materials
            const defaultDepthMaskName = 'defaultDepthMap-000000'
            if (!this.materials.has(defaultDepthMaskName)) {
                this.materials.set(defaultDepthMaskName, {
                    url: '',
                    texture: depthTexture,
                    width: 1,
                    height: 1,
                })
            }

            this.updateFrame.push(() => {
                if (pointer.x >= 0) {
                    depthParallaxEffect.uniforms.values[2] = pointer.x
                }
                if (pointer.y >= 0) {
                    depthParallaxEffect.uniforms.values[3] = pointer.y
                }
                depthParallaxEffect.uniforms.apply()
            })
        },

        async addReflectionEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)
            const { createReflectionEffect } = await import('src/effects/reflection')
            const reflectionEffect = await createReflectionEffect(`${imageLayer.crc}-effect-${c}__reflection`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(reflectionEffect)
        },

        async addTintEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createTintEffect } = await import('src/effects/tint')
            const tintEffect = await createTintEffect(`${imageLayer.crc}-effect-${c}__tint`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(tintEffect)
        },

        async addRefractionEffect(imageLayer: ImageLayer) {
            if (!this.renderer) return

            const maskTexture = await this.getDefaultMaskTexture(0)
            const c = imageLayer.effects.length
            const prePassName = c ? imageLayer.effects[c - 1]!.name : baseLayerPassname(imageLayer)

            const { createRefractionEffect } = await import('src/effects/refraction')
            const refractionEffect = await createRefractionEffect(`${imageLayer.crc}-effect-${c}__refraction`, this.renderer as WGSLRenderer, {
                baseTexture: this.renderer.getPassTexture(prePassName),
                maskTexture: maskTexture,
            })

            imageLayer.effects.push(refractionEffect)
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
                case 'cloud-motion':
                    await this.addCloudMotionEffect(image)
                    break
                case 'cursor-ripple':
                    await this.addCursorRippleEffect(image)
                    break
                case 'scroll':
                    await this.addScrollEffect(image)
                    break
                case 'waterwaves':
                    await this.addWaterWavesEffect(image)
                    break
                case 'shake':
                    await this.addShakeEffect(image)
                    break
                case 'depthparallax':
                    await this.addDepthParallaxEffect(image)
                    break
                case 'reflection':
                    await this.addReflectionEffect(image)
                    break
                case 'tint':
                    await this.addTintEffect(image)
                    break
                case 'refraction':
                    await this.addRefractionEffect(image)
                    break
                default: return
            }
            await this.reRender()
        },

        // 删除效果时修改后面一个Pass的输入Pass
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
            if (e === currentEffect.value) {
                currentEffect.value = null
            }
            currentImage.value?.effects.splice(i, 1)
            await this.reRender()
        },

    },
})

export { useLayers }
