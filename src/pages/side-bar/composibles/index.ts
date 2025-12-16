import type { Effect } from 'src/effects'
import type { ImageLayer } from 'src/stores/layers'

type DisplayType = 'effectProps' | 'imageProps' | 'maskProps'
const propBarDisplay = ref<DisplayType>('imageProps')
const currentImage = ref<ImageLayer | null>(null)
const currentEffect = ref<Effect | null>(null)

// 画布设置
const canvasSettings = ref({
    width: 1280,
    height: 720,
    initialized: false,
})

const maskControls = ref<{
    brushSize: number
    brushHardness: number
    brushAmount: number
    maskOpacity: number
    isDrawMode: boolean
    flowMode: boolean
}>({
    brushSize: 50,
    brushHardness: 0.8,
    brushAmount: 255,
    maskOpacity: 0.5,
    isDrawMode: false,
    flowMode: false,
})

const maskCanvasRef = ref<any>(null)

function selectImage(image: ImageLayer) {
    if (image !== currentImage.value) {
        currentImage.value = image
        propBarDisplay.value = 'imageProps'
        currentEffect.value = null
    }
}

function selectEffect(effect: Effect) {
    currentEffect.value = effect
}

export type { DisplayType }

export {
    propBarDisplay,
    currentImage,
    currentEffect,
    maskControls,
    maskCanvasRef,
    canvasSettings,
    selectImage,
    selectEffect,
}
