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
    scale?: number
}>()

const previewSize = computed(() => {
    const diameter = brushSize.value * 2
    const size = diameter * (props.scale || 1)

    return size
})

const emit = defineEmits<{ maskUpdate: [dataUrl: string] }>()

const $canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const ctx = ref<CanvasRenderingContext2D | null>(null)

const isDrawMode = ref(props.isDrawMode || false)
const brushSize = ref(props.brushSize || 50)
const brushHardness = ref(props.brushHardness || 0.8)
const brushAmount = ref(props.brushAmount || 200)
const maskOpacity = ref(props.maskOpacity || 0.5)
const flowMode = ref(props.flowMode || false)
const lastPos = ref<{ x: number; y: number } | null>(null)
const lastDir = ref<{ x: number; y: number }>({ x: 0, y: 1 })
const isDrawing = ref(false)
const showMask = ref(false)
const brushPreview = ref({ x: 0, y: 0, show: false })
const displayScale = ref(1)

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

watch(() => props.isDrawMode, val => {
    isDrawMode.value = val || false
})

watch(() => props.scale, () => {
    nextTick(() => {
        updateDisplayScale()
    })
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

watch(() => props.flowMode, val => {
    flowMode.value = !!val
})

watch([() => props.width, () => props.height], ([newWidth, newHeight]) => {
    if (newWidth && newHeight && $canvas.value) {
        const imageData = ctx.value?.getImageData(0, 0, $canvas.value.width, $canvas.value.height)
        $canvas.value.width = newWidth
        $canvas.value.height = newHeight
        if (imageData && imageData.width === newWidth && imageData.height === newHeight) {
            ctx.value?.putImageData(imageData, 0, 0)
        }
        else {
            clearCanvas(0)
        }
        updateDisplayScale()
    }
})

function updateDisplayScale() {
    if (props.scale !== undefined) {
        displayScale.value = props.scale
    }
}

function initCanvas() {
    if (!$canvas.value) return
    ctx.value = $canvas.value.getContext('2d')!
    const width = props.width || 1280
    const height = props.height || 720
    $canvas.value.width = width
    $canvas.value.height = height
    clearCanvas(0)
}

function clearCanvas(c: number) {
    if (!ctx.value || !$canvas.value) return
    ctx.value.fillStyle = props.flowMode ? '#7F7F00' : `rgb(${c}, ${c}, ${c})`
    ctx.value.fillRect(0, 0, $canvas.value.width, $canvas.value.height)
    emit('maskUpdate', $canvas.value.toDataURL())
}

function startDrawing(e: MouseEvent) {
    if (!isDrawMode.value || e.ctrlKey || e.metaKey) return
    isDrawing.value = true
    const rect = $canvas.value!.getBoundingClientRect()
    const scaleX = $canvas.value!.width / rect.width
    const scaleY = $canvas.value!.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    lastPos.value = { x, y }
    draw(e)
}

function hexToRgb(hex: string) {
    const h = hex.replace('#', '')

    return {
        r: Number.parseInt(h.slice(0, 2), 16),
        g: Number.parseInt(h.slice(2, 4), 16),
        b: Number.parseInt(h.slice(4, 6), 16),
    }
}

function draw(e: MouseEvent) {
    if (!isDrawing.value || !ctx.value || !$canvas.value || e.ctrlKey || e.metaKey) return

    const rect = $canvas.value.getBoundingClientRect()
    const scaleX = $canvas.value.width / rect.width
    const scaleY = $canvas.value.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    ctx.value.globalCompositeOperation = 'source-over'

    if (flowMode.value) {
        let dx = 0
        let dy = 1
        if (lastPos.value) {
            dx = x - lastPos.value.x
            dy = y - lastPos.value.y
            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
                dx = 0
                dy = 1
            }
        }

        const colorMap = {
            down: '7FFF00',
            up: '7F0000',
            right: 'FF7F00',
            left: '007F00',
        } as const

        const alpha = Math.max(0.02, Math.min(1, brushAmount.value / 255))
        const len = Math.hypot(dx, dy)
        let nx = 0
        let ny = 1
        if (len > 1e-4) {
            nx = dx / len
            ny = dy / len
        }

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
        const gg = Math.round(cUp.g * upW + cDown.g * downW + cLeft.g * leftW + cRight.r * rightW)
        const bb = Math.round(cUp.b * upW + cDown.b * downW + cLeft.b * leftW + cRight.r * rightW)

        const blendedSolid = `rgba(${rr}, ${gg}, ${bb}, ${alpha})`
        const blendedTransparent = `rgba(${rr}, ${gg}, ${bb}, 0)`

        const gradient = ctx.value.createRadialGradient(x, y, 0, x, y, brushSize.value)

        if (brushHardness.value >= 1) {
            gradient.addColorStop(0, blendedSolid)
            gradient.addColorStop(1, blendedSolid)
        }
        else {
            const featherStart = brushSize.value * (brushHardness.value * 0.8)
            gradient.addColorStop(0, blendedSolid)
            gradient.addColorStop(featherStart / brushSize.value, blendedSolid)
            gradient.addColorStop(1, blendedTransparent)
        }

        ctx.value.fillStyle = gradient
        ctx.value.beginPath()
        ctx.value.arc(x, y, brushSize.value, 0, Math.PI * 2)
        ctx.value.fill()
    }
    else {
        const colorValue = Math.round(brushAmount.value)
        const gradient = ctx.value.createRadialGradient(x, y, 0, x, y, brushSize.value)

        if (brushHardness.value >= 1) {
            gradient.addColorStop(0, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
            gradient.addColorStop(1, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
        }
        else {
            const featherStart = brushSize.value * (brushHardness.value * 0.8)
            gradient.addColorStop(0, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
            gradient.addColorStop(featherStart / brushSize.value, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 1)`)
            gradient.addColorStop(1, `rgba(${colorValue}, ${colorValue}, ${colorValue}, 0)`)
        }

        ctx.value.fillStyle = gradient
        ctx.value.beginPath()
        ctx.value.arc(x, y, brushSize.value, 0, Math.PI * 2)
        ctx.value.fill()
    }

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

    const rect = $canvas.value.getBoundingClientRect()

    if (e.clientX < rect.left || e.clientX > rect.right
        || e.clientY < rect.top || e.clientY > rect.bottom) {
        brushPreview.value.show = false

        return
    }

    brushPreview.value = {
        x: e.clientX,
        y: e.clientY,
        show: true,
    }
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
    window.addEventListener('resize', updateDisplayScale)
    nextTick(() => {
        initCanvas()
        nextTick(() => {
            updateDisplayScale()
        })
    })
})

function globalMouseMoveHandler(e: MouseEvent) {
    if (isDrawMode.value) {
        updateBrushPreview(e)
    }
}

watch(isDrawMode, newValue => {
    if (newValue) {
        document.addEventListener('mousemove', globalMouseMoveHandler)
    }
    else {
        document.removeEventListener('mousemove', globalMouseMoveHandler)
        hideBrushPreview()
    }
})

onUnmounted(() => {
    document.removeEventListener('mousemove', globalMouseMoveHandler)
})
</script>

<template>
  <div>
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

    <Teleport to="body">
      <div
        v-if="brushPreview.show && isDrawMode"
        class="fixed rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
        style="z-index: 99999;"
        :style="{
          left: brushPreview.x + 'px',
          top: brushPreview.y + 'px',
          width: previewSize + 'px',
          height: previewSize + 'px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 0 20px rgba(0,0,0,0.3)',
        }"
      >
        <div
          class="absolute opacity-50"
          :style="{
            width: '1px',
            height: '20px',
            background: 'rgba(255,255,255,0.6)',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }"
        />
        <div
          class="absolute opacity-50"
          :style="{
            width: '20px',
            height: '1px',
            background: 'rgba(255,255,255,0.6)',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.mask-canvas {
  pointer-events: none;
}
</style>
