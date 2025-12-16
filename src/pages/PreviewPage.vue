<script setup lang="ts">
import { createWGSLRenderer } from 'wgsl-renderer'
import MaskCanvas from 'src/components/MaskCanvas.vue'
import { canvasSettings, currentEffect, currentImage, maskCanvasRef, maskControls } from 'src/pages/side-bar/composibles'
import { currentMask, maskInfo } from 'src/composibles/mask'

const $q = useQuasar()
const layers = useLayers()
const pointer = usePointer()

const pageStyle = computed(() => {
    return { height: `${$q.screen.height - 50}px` }
})

const $renderCanvas = useTemplateRef<HTMLCanvasElement>('renderCanvas')

// 画布视图变换
const canvasTransform = reactive({
    scale: 1,
    translateX: 0,
    translateY: 0,
})

// 默认适应屏幕大小
function fitToScreen() {
    if (!canvasSettings.value.initialized || !$renderCanvas.value) return

    const container = $renderCanvas.value.parentElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const canvasWidth = canvasSettings.value.width
    const canvasHeight = canvasSettings.value.height

    // 计算适应屏幕的缩放比例
    const scaleX = (containerRect.width - 40) / canvasWidth // 留20px边距
    const scaleY = (containerRect.height - 40) / canvasHeight
    const scale = Math.min(scaleX, scaleY, 1) // 不超过原始大小

    // 居中显示
    canvasTransform.scale = scale
    canvasTransform.translateX = (containerRect.width - canvasWidth * scale) / 2
    canvasTransform.translateY = (containerRect.height - canvasHeight * scale) / 2
}

// 监听画布尺寸变化
watch(() => canvasSettings.value, newVal => {
    if ($renderCanvas.value && newVal.initialized) {
        $renderCanvas.value.width = newVal.width
        $renderCanvas.value.height = newVal.height
        nextTick(fitToScreen)
    }
}, { deep: true })

// 监听窗口大小变化
onMounted(() => {
    window.addEventListener('resize', fitToScreen)
    nextTick(fitToScreen)
})

onUnmounted(() => {
    window.removeEventListener('resize', fitToScreen)
})

// 拖动和缩放功能
const isDragging = ref(false)
const isCtrlPressed = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const transformStart = ref({ scale: 1, translateX: 0, translateY: 0 })

// 监听 Ctrl 键
onMounted(() => {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            isCtrlPressed.value = true
            $renderCanvas.value!.style.cursor = 'grab'
            if (e.code === 'Digit0') {
   
                // Ctrl/Cmd + 0 重置视图
                e.preventDefault()
                fitToScreen()
            }
        }
    })

    document.addEventListener('keyup', (e: KeyboardEvent) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            e.preventDefault()
            isCtrlPressed.value = false
            $renderCanvas.value!.style.cursor = 'default'
        }
    })
})

function startDrag(e: MouseEvent) {
    if (!isCtrlPressed.value) return

    isDragging.value = true
    dragStart.value = { x: e.clientX, y: e.clientY }
    transformStart.value = {
        scale: canvasTransform.scale,
        translateX: canvasTransform.translateX,
        translateY: canvasTransform.translateY,
    }
    $renderCanvas.value!.style.cursor = 'grabbing'
}

function drag(e: MouseEvent) {
    if (!isDragging.value) return

    const dx = e.clientX - dragStart.value.x
    const dy = e.clientY - dragStart.value.y

    canvasTransform.translateX = transformStart.value.translateX + dx
    canvasTransform.translateY = transformStart.value.translateY + dy
}

function endDrag() {
    isDragging.value = false
    if (isCtrlPressed.value) {
        $renderCanvas.value!.style.cursor = 'grab'
    }
    else {
        $renderCanvas.value!.style.cursor = 'default'
    }
}

function handleWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return // 需要按住 Ctrl/Cmd 键

    e.preventDefault()

    const rect = $renderCanvas.value!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, canvasTransform.scale * delta))

    // 以鼠标位置为中心进行缩放
    const scaleRatio = newScale / canvasTransform.scale
    canvasTransform.translateX = x - (x - canvasTransform.translateX) * scaleRatio
    canvasTransform.translateY = y - (y - canvasTransform.translateY) * scaleRatio
    canvasTransform.scale = newScale
}

const moveEvent = (e: MouseEvent) => {
    const cvs = $renderCanvas.value!
    const r = cvs.getBoundingClientRect()

    // 考虑画布变换，计算实际的画布坐标
    const x = (e.clientX - r.left - canvasTransform.translateX) / canvasTransform.scale
    const y = (e.clientY - r.top - canvasTransform.translateY) / canvasTransform.scale

    pointer.lx = pointer.x
    pointer.ly = pointer.y
    pointer.x = x * window.devicePixelRatio
    pointer.y = y * window.devicePixelRatio
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
    class="w-full relative overflow-hidden"
    :style="pageStyle"
  >
    <!-- 画布容器 -->
    <div
      class="absolute inset-0 checkerboard"
      @mousedown="startDrag"
      @mousemove="drag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
      @wheel.prevent="handleWheel"
    >
      <!-- 渲染画布背景 -->
      <div
        v-if="canvasSettings.initialized"
        class="absolute shadow-lg"
        :style="{
          width: canvasSettings.width + 'px',
          height: canvasSettings.height + 'px',
          transform: `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${canvasTransform.scale})`,
          transformOrigin: 'top left',
          backgroundColor: '#ffffff',
        }"
      />

      <!-- 渲染画布 -->
      <canvas
        ref="renderCanvas"
        :width="canvasSettings.initialized ? canvasSettings.width : 1280"
        :height="canvasSettings.initialized ? canvasSettings.height : 720"
        class="absolute shadow-lg"
        :style="{
          transform: `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${canvasTransform.scale})`,
          transformOrigin: 'top left',
        }"
        @pointermove="moveEvent"
        @pointerleave="leaveEvent"
        @pointerenter="enterEvent"
      />

      <!-- 蒙版画布 -->
      <MaskCanvas
        ref="maskCanvasRef"
        :width="canvasSettings.initialized ? canvasSettings.width : 1280"
        :height="canvasSettings.initialized ? canvasSettings.height : 720"
        :brush-size="maskControls.brushSize"
        :brush-hardness="maskControls.brushHardness"
        :brush-amount="maskControls.brushAmount"
        :mask-opacity="maskControls.maskOpacity"
        :is-draw-mode="maskControls.isDrawMode"
        :flow-mode="maskControls.flowMode"
        :scale="canvasTransform.scale"
        :style="{
          position: 'absolute',
          transform: `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${canvasTransform.scale})`,
          transformOrigin: 'top left',
          pointerEvents: maskControls.isDrawMode ? 'auto' : 'none',
        }"
        @mask-update="handleMaskUpdate"
        @mounted="() => console.log('MaskCanvas mounted with scale:', canvasTransform.scale)"
      />
    </div>

    <!-- 提示信息 -->
    <div
      v-if="canvasSettings.initialized"
      class="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-2 rounded"
    >
      <div>画布: {{ canvasSettings.width }} × {{ canvasSettings.height }}</div>
      <div>缩放: {{ (canvasTransform.scale * 100).toFixed(0) }}%</div>
      <div class="mt-1 text-gray-300">
        Ctrl/Cmd+拖动: 移动画布 • Ctrl/Cmd+滚轮: 缩放 • Ctrl/Cmd+0: 重置视图
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkerboard {
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
    linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
</style>
