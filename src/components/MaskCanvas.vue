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
    flowMode?: boolean
}>()

const emit = defineEmits<{ maskUpdate: [dataUrl: string] }>()

const $canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const ctx = ref<CanvasRenderingContext2D | null>(null)
  
const isDrawMode = ref(props.isDrawMode || false)
const brushSize = ref(props.brushSize || 50)
const brushHardness = ref(props.brushHardness || 0.8)
const brushAmount = ref(props.brushAmount || 200)
const maskOpacity = ref(props.maskOpacity || 0.5)

// 新增 flowMode 支持和上次位置用于计算方向
const flowMode = ref(props.flowMode || false)
const lastPos = ref<{ x: number; y: number } | null>(null)

// 平滑后的方向，用于减少绘制时方向抖动
const lastDir = ref<{ x: number; y: number }>({ x: 0, y: 1 })

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

// 监听 flowMode prop
watch(() => props.flowMode, val => {
    flowMode.value = !!val
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
    ctx.value.fillStyle = props.flowMode ? '#7F7F00' : `rgb(${c}, ${c}, ${c})`
    ctx.value.fillRect(0, 0, $canvas.value!.width, $canvas.value!.height)
    emit('maskUpdate', $canvas.value!.toDataURL())
}

function startDrawing(e: MouseEvent) {
    if (!isDrawMode.value) return
    isDrawing.value = true

    // 初始化 lastPos
    const rect = $canvas.value!.getBoundingClientRect()
    const x = (e.clientX - rect.left) * ($canvas.value!.width / rect.width)
    const y = (e.clientY - rect.top) * ($canvas.value!.height / rect.height)
    lastPos.value = { x, y }
    draw(e)
}

// 返回不带 alpha 的 rgb 对象
function hexToRgb(hex: string) {
    const h = hex.replace('#', '')

    return {
        r: Number.parseInt(h.slice(0, 2), 16),
        g: Number.parseInt(h.slice(2, 4), 16),
        b: Number.parseInt(h.slice(4, 6), 16),
    }
}

// 在两个 hex 颜色间按 t (0..1) 插值，并附带 alpha
// ...existing code...

function draw(e: MouseEvent) {
    if (!isDrawing.value || !ctx.value || !$canvas.value) return

    const rect = $canvas.value.getBoundingClientRect()
    const x = (e.clientX - rect.left) * ($canvas.value.width / rect.width)
    const y = (e.clientY - rect.top) * ($canvas.value.height / rect.height)

    ctx.value.globalCompositeOperation = 'source-over'

    if (flowMode.value) {

        // flow 模式
        // 计算向量
        let dx = 0
        let dy = 1 // 默认向下
        if (lastPos.value) {
            dx = x - lastPos.value.x
            dy = y - lastPos.value.y

            // 停留不动时保持默认
            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
                dx = 0
                dy = 1
            }
        }

        // 方向颜色映射
        const colorMap = {
            down: '7FFF00',
            up: '7F0000',
            right: 'FF7F00',
            left: '007F00',
        } as const

        // 四方向加权平均（up/down/left/right）
        const alpha = Math.max(0.02, Math.min(1, brushAmount.value / 255))
        const len = Math.hypot(dx, dy)
        let nx = 0
        let ny = 1
        if (len > 1e-4) {
            nx = dx / len
            ny = dy / len
        }

        // 指向平滑（指数移动平均）
        const smooth = 0.25
        lastDir.value.x = lastDir.value.x * (1 - smooth) + nx * smooth
        lastDir.value.y = lastDir.value.y * (1 - smooth) + ny * smooth
        const vx = lastDir.value.x
        const vy = lastDir.value.y
        let upW = Math.max(-vy, 0)
        let downW = Math.max(vy, 0)
        let leftW = Math.max(-vx, 0)
        let rightW = Math.max(vx, 0)

        let wsum = upW + downW + leftW + rightW
        if (wsum <= 0) {
            downW = 1
            wsum = 1
        }

        upW /= wsum
        downW /= wsum
        leftW /= wsum
        rightW /= wsum

        const cUp = hexToRgb(colorMap.up)
        const cDown = hexToRgb(colorMap.down)
        const cLeft = hexToRgb(colorMap.left)
        const cRight = hexToRgb(colorMap.right)

        const rr = Math.round(cUp.r * upW + cDown.r * downW + cLeft.r * leftW + cRight.r * rightW)
        const gg = Math.round(cUp.g * upW + cDown.g * downW + cLeft.g * leftW + cRight.g * rightW)
        const bb = Math.round(cUp.b * upW + cDown.b * downW + cLeft.b * leftW + cRight.b * rightW)

        const blendedSolid = `rgba(${rr}, ${gg}, ${bb}, ${alpha})`
        const blendedTransparent = `rgba(${rr}, ${gg}, ${bb}, 0)`

        // 径向渐变
        const featherStart = brushSize.value * (brushHardness.value * 0.8)
        const gradient = ctx.value.createRadialGradient(x, y, 0, x, y, brushSize.value)
        gradient.addColorStop(0, blendedSolid)
        gradient.addColorStop(featherStart / brushSize.value, blendedSolid)
        gradient.addColorStop(1, blendedTransparent)

        ctx.value.fillStyle = gradient
        ctx.value.beginPath()
        ctx.value.arc(x, y, brushSize.value, 0, Math.PI * 2)
        ctx.value.fill()
    }
    else {
      
        const colorValue = Math.round(brushAmount.value)

        const gradient = ctx.value.createRadialGradient(x, y, 0, x, y, brushSize.value)

        const featherStart = brushSize.value * (brushHardness.value * 0.8)

        gradient.addColorStop(0, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
        gradient.addColorStop(featherStart / brushSize.value, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
        gradient.addColorStop(1, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 0)`)

        ctx.value.fillStyle = gradient
        ctx.value.beginPath()
        ctx.value.arc(x, y, brushSize.value, 0, Math.PI * 2)
        ctx.value.fill()
    }

    // 更新 lastPos 以便下次计算方向
    lastPos.value = { x, y }
}

function stopDrawing() {
    if (!isDrawing.value) return
    isDrawing.value = false
    lastPos.value = null
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
    @mousemove="updateBrushPreview"
    @mouseleave="hideBrushPreview"
  >
    <canvas
      ref="canvas"
      class="mask-canvas absolute"
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
