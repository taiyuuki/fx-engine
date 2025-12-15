<script setup lang="ts">
import { createWGSLRenderer } from 'wgsl-renderer'
import MaskCanvas from 'src/components/MaskCanvas.vue'
import { currentEffect, currentImage, maskCanvasRef, maskControls } from 'src/pages/side-bar/composibles'
import { currentMask, maskInfo } from 'src/composibles/mask'

const $q = useQuasar()
const layers = useLayers()
const pointer = usePointer()

const pageStyle = computed(() => {
    return { height: `${$q.screen.height - 50}px` }
})

const $renderCanvas = useTemplateRef<HTMLCanvasElement>('renderCanvas')

const moveEvent = (e: MouseEvent) => {
    const cvs = $renderCanvas.value!
    const r = cvs.getBoundingClientRect()
    pointer.lx = pointer.x
    pointer.ly = pointer.y
    pointer.x = (e.clientX - r.left) * window.devicePixelRatio
    pointer.y = (e.clientY - r.top) * window.devicePixelRatio
}

const leaveEvent = () => {
    pointer.$reset()
}

const enterEvent = (e: MouseEvent) => {
    const cvs = $renderCanvas.value!
    const r = cvs.getBoundingClientRect()
    pointer.x = (e.clientX - r.left) * window.devicePixelRatio
    pointer.y = (e.clientY - r.top) * window.devicePixelRatio
    pointer.lx = pointer.x
    pointer.ly = pointer.y
}

onMounted(async() => {
    if ($renderCanvas.value) {
        layers.renderer = await createWGSLRenderer($renderCanvas.value)
        layers.renderer.loopRender(t => {
            layers.updateFrame.forEach(f => f(t))
        })
    }
})

// 处理蒙版更新
async function handleMaskUpdate(dataUrl: string) {
    if (layers.renderer && currentEffect.value) {
        const { texture, width, height } = await layers.renderer.loadImageTexture(dataUrl)
        currentMask.value = {
            url: dataUrl,
            texture,
            width,
            height,
        }

        currentEffect.value.setResource(maskInfo.value.bindingIndex, texture)
        const maskName = `${currentImage.value!.crc}.${currentEffect.value.name}__mask`
        layers.materials.set(maskName, currentMask.value)
        currentEffect.value.refs[maskInfo.value.refKey!] = maskName

        layers.renderer.updateBindGroupSetResources(currentEffect.value.name, 'default', currentEffect.value!.resources!)
    }
}
</script>

<template>
  <div
    class="w-full relative"
    :style="pageStyle"
  >
    <canvas
      ref="renderCanvas"
      width="3840"
      height="2160"
      class="absolute w-[1280px] h=[720px]"
      @pointermove="moveEvent"
      @pointerleave="leaveEvent"
      @pointerenter="enterEvent"
    />
    <MaskCanvas
      ref="maskCanvasRef"
      :width="1280"
      :height="720"
      :brush-size="maskControls.brushSize"
      :brush-hardness="maskControls.brushHardness"
      :brush-amount="maskControls.brushAmount"
      :mask-opacity="maskControls.maskOpacity"
      :is-draw-mode="maskControls.isDrawMode"
      @mask-update="handleMaskUpdate"
    />
  </div>
</template>
