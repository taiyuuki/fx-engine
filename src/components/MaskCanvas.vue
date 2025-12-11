<script setup lang="ts">
import { currentMask } from 'src/composibles/mask'

const props = defineProps<{
    width?: number
    height?: number
    brushSize?: number
    brushHardness?: number
    brushAmount?: number
    maskOpacity?: number
    isDrawMode?: boolean
}>()

const emit = defineEmits<{ maskUpdate: [dataUrl: string] }>()

const $canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const ctx = ref<CanvasRenderingContext2D | null>(null)
  
const isDrawMode = ref(props.isDrawMode || false)
const brushSize = ref(props.brushSize || 50)
const brushHardness = ref(props.brushHardness || 0.8)
const brushAmount = ref(props.brushAmount || 200)
const maskOpacity = ref(props.maskOpacity || 0.5)

const isDrawing = ref(false)
const showMask = ref(false)
const brushPreview = ref({ x: 0, y: 0, show: false })

watch(currentMask, () => {
    if (currentMask.value) {
        const image = new Image()
        image.src = currentMask.value.url
        image.onload = () => {
            if (ctx.value) {
                ctx.value?.drawImage(image, 0, 0, $canvas.value!.width, $canvas.value!.height)
            }
        }
    }
})

// 监听props变化
watch(() => props.isDrawMode, val => {
    isDrawMode.value = val || false
})

watch(() => props.brushSize, val => {
    if (val !== undefined) brushSize.value = val
})

watch(() => props.brushHardness, val => {
    if (val !== undefined) brushHardness.value = val
})

watch(() => props.brushAmount, val => {
    if (val !== undefined) brushAmount.value = val
})

watch(() => props.maskOpacity, val => {
    if (val !== undefined) maskOpacity.value = val
})

function initCanvas() {
    if (!$canvas.value) return
    ctx.value = $canvas.value.getContext('2d')!
    $canvas.value.width = props.width || 1280
    $canvas.value.height = props.height || 720
    clearCanvas(0)
}

function clearCanvas(c: number) {
    if (!ctx.value) return
    ctx.value.fillStyle = `rgb(${c}, ${c}, ${c})`
    ctx.value.fillRect(0, 0, $canvas.value!.width, $canvas.value!.height)
    emit('maskUpdate', $canvas.value!.toDataURL())
}

function startDrawing(e: MouseEvent) {
    if (!isDrawMode.value) return
    isDrawing.value = true
    draw(e)
}

function draw(e: MouseEvent) {
    if (!isDrawing.value || !ctx.value || !$canvas.value) return

    const rect = $canvas.value.getBoundingClientRect()
    const x = (e.clientX - rect.left) * ($canvas.value.width / rect.width)
    const y = (e.clientY - rect.top) * ($canvas.value.height / rect.height)

    ctx.value.globalCompositeOperation = 'source-over'
    const colorValue = Math.round(brushAmount.value)

    // 创建径向渐变来实现羽化效果
    const gradient = ctx.value.createRadialGradient(x, y, 0, x, y, brushSize.value)

    // 计算羽化起始位置（hardness 越大，羽化范围越小）
    const featherStart = brushSize.value * (brushHardness.value * 0.8)

    // 设置渐变颜色
    gradient.addColorStop(0, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
    gradient.addColorStop(featherStart / brushSize.value, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
    gradient.addColorStop(1, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 0)`)

    ctx.value.fillStyle = gradient
    ctx.value.beginPath()
    ctx.value.arc(x, y, brushSize.value, 0, Math.PI * 2)
    ctx.value.fill()
}

function stopDrawing() {
    if (!isDrawing.value) return
    isDrawing.value = false
    emit('maskUpdate', $canvas.value!.toDataURL())
}

function updateBrushPreview(e: MouseEvent) {
    if (!isDrawMode.value || !$canvas.value) {
        brushPreview.value.show = false

        return
    }
    brushPreview.value = { x: e.clientX, y: e.clientY, show: true }
}

function hideBrushPreview() {
    brushPreview.value.show = false
}

function toggleDrawMode() {
    isDrawMode.value = !isDrawMode.value
    showMask.value = isDrawMode.value
    if ($canvas.value) {
        $canvas.value.style.pointerEvents = isDrawMode.value ? 'auto' : 'none'
        $canvas.value.style.cursor = isDrawMode.value ? 'crosshair' : 'default'
    }
}

function clearMask() {
    clearCanvas(255 - brushAmount.value)
}

defineExpose({
    toggleDrawMode,
    clearMask,
    isDrawMode: readonly(isDrawMode),
    showMask: readonly(showMask),
})

onMounted(() => {
    initCanvas()
})
</script>

<template>
  <div
    class="mask-canvas-container"
    @mousemove="updateBrushPreview"
    @mouseleave="hideBrushPreview"
  >
    <canvas
      ref="canvas"
      class="mask-canvas absolute inset-0"
      :class="{ 'cursor-crosshair': isDrawMode }"
      :style="{ opacity: showMask ? maskOpacity : 0 }"
      @mousedown="startDrawing"
      @mousemove="draw"
      @mouseup="stopDrawing"
      @mouseleave="stopDrawing"
    />

    <!-- 画笔预览 -->
    <div
      v-if="brushPreview.show && isDrawMode"
      class="brush-preview fixed rounded-full border-2 border-white pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-50"
      :style="{
        left: brushPreview.x + 'px',
        top: brushPreview.y + 'px',
        width: brushSize * 2 + 'px',
        height: brushSize * 2 + 'px',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.3)',
      }"
    />

    <!-- 控制面板 -->
    <div class="control-panel fixed top-4 right-4 bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gray-700 w-72">
      <h3 class="text-white text-sm font-semibold mb-3">
        蒙版控制
      </h3>

      <div class="space-y-3">
        <button
          :class="[
            'w-full py-2 px-3 rounded text-sm font-medium transition-all',
            isDrawMode
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white',
          ]"
          @click="toggleDrawMode"
        >
          {{ isDrawMode ? '退出绘制' : '开始绘制' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask-canvas {
  pointer-events: none;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
}

input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
  border: none;
}
</style>
