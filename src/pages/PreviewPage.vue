<script setup lang="ts">
import { createWGSLRenderer } from 'wgsl-renderer'
import MaskCanvas from 'src/components/MaskCanvas.vue'
import { canvasSettings, currentEffect, currentImage, maskCanvasRef, maskControls, propBarDisplay } from 'src/pages/side-bar/composibles'
import { currentMask, maskInfo } from 'src/composibles/mask'
import { vZoom } from 'src/directives/v-zoom'

const $q = useQuasar()
const layers = useLayers()
const pointer = usePointer()

const hasLayer = computed(() => layers.imageLayers.length > 0)
const pageStyle = computed(() => {
    return { height: `${$q.screen.height - 50}px` }
})

// 创建画布相关
const showCanvasDialog = ref(false)
const tempCanvasWidth = ref(1280)
const tempCanvasHeight = ref(720)

function showCreateCanvasDialog() {
    showCanvasDialog.value = true
}

async function createCanvas() {
    canvasSettings.value.width = tempCanvasWidth.value
    canvasSettings.value.height = tempCanvasHeight.value
    canvasSettings.value.initialized = true
    showCanvasDialog.value = false

    // 在下一个 tick 初始化渲染器
    nextTick(async() => {
        if ($renderCanvas.value && !layers.renderer) {
            layers.renderer = await createWGSLRenderer($renderCanvas.value)
        }
    })
}

const $renderCanvas = useTemplateRef<HTMLCanvasElement>('renderCanvas')

// 画布视图变换
const canvasTransform = reactive({
    scale: 1,
    translateX: 0,
    translateY: 0,
})

// 控制面板显示状态
const controlPanelVisible = ref(true)

// 显示控制面板
function showControlPanel() {
    controlPanelVisible.value = true
}

// 放大画布
function zoomIn() {
    const newScale = Math.min(canvasTransform.scale * 1.2, 5)
    const rect = $renderCanvas.value!.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const canvasX = (centerX - canvasTransform.translateX) / canvasTransform.scale
    const canvasY = (centerY - canvasTransform.translateY) / canvasTransform.scale

    canvasTransform.scale = newScale
    canvasTransform.translateX = centerX - canvasX * newScale
    canvasTransform.translateY = centerY - canvasY * newScale
}

// 缩小画布
function zoomOut() {
    const newScale = Math.max(canvasTransform.scale / 1.2, 0.1)
    const rect = $renderCanvas.value!.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const canvasX = (centerX - canvasTransform.translateX) / canvasTransform.scale
    const canvasY = (centerY - canvasTransform.translateY) / canvasTransform.scale

    canvasTransform.scale = newScale
    canvasTransform.translateX = centerX - canvasX * newScale
    canvasTransform.translateY = centerY - canvasY * newScale
}

// 切换handler显示
const handlerVisible = ref(true)
function toggleHandler() {
    handlerVisible.value = !handlerVisible.value
}

// 默认适应屏幕大小
function fitToScreen() {
    if (!canvasSettings.value.initialized || !$renderCanvas.value) return

    const container = $renderCanvas.value.parentElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const canvasWidth = canvasSettings.value.width
    const canvasHeight = canvasSettings.value.height

    // 计算适应屏幕的缩放比例
    const scaleX = (containerRect.width - 10) / canvasWidth // 留5px边距
    const scaleY = (containerRect.height - 10) / canvasHeight
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
    document.removeEventListener('mousemove', dragImageHandler)
    document.removeEventListener('mouseup', endImageHandlerDrag)
})

// 拖动和缩放功能
const isCtrlPressed = ref(false)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const transformStart = ref({
    scale: 1,
    translateX: 0,
    translateY: 0,
})

// 图片位置 handler
const imageHandler = reactive({
    isDragging: false,
    axis: null as 'x' | 'y' | null,
    isScaling: false,
    isRotating: false,
    startX: 0,
    startY: 0,
    originStart: { x: 0, y: 0 },
    scaleStart: { x: 1, y: 1 },
    rotationStart: 0,
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
    e.preventDefault()

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

// 图片位置 handler 函数
function startImageHandlerDrag(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (isCtrlPressed.value) return // Ctrl+拖动时优先处理画布拖动

    imageHandler.isDragging = true
    imageHandler.axis = null // Both axes
    imageHandler.isScaling = false
    imageHandler.startX = e.clientX
    imageHandler.startY = e.clientY

    // 设置拖动时光标状态
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    if (currentImage.value) {
        imageHandler.originStart = {
            x: currentImage.value.origin.x,
            y: currentImage.value.origin.y,
        }
    }
}

// 单轴拖动
function startAxisDrag(e: MouseEvent, axis: 'x' | 'y') {
    e.stopPropagation()
    e.preventDefault()
    if (isCtrlPressed.value) return

    imageHandler.isDragging = true
    imageHandler.axis = axis // Only one axis
    imageHandler.isScaling = false
    imageHandler.startX = e.clientX
    imageHandler.startY = e.clientY

    // 设置拖动时光标状态
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    if (currentImage.value) {
        imageHandler.originStart = {
            x: currentImage.value.origin.x,
            y: currentImage.value.origin.y,
        }
    }
}

// 缩放拖动
function startScaleDrag(e: MouseEvent, axis?: 'x' | 'y') {
    e.stopPropagation()
    e.preventDefault()
    if (isCtrlPressed.value) return

    imageHandler.isDragging = true
    imageHandler.axis = axis || null
    imageHandler.isScaling = true
    imageHandler.startX = e.clientX
    imageHandler.startY = e.clientY

    // 设置拖动时光标状态
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    if (currentImage.value) {
        imageHandler.originStart = {
            x: currentImage.value.origin.x,
            y: currentImage.value.origin.y,
        }
        imageHandler.scaleStart = {
            x: currentImage.value.scale.x,
            y: currentImage.value.scale.y,
        }
    }
}

function dragImageHandler(e: MouseEvent) {
    if (!imageHandler.isDragging || !currentImage.value) return

    // 旋转操作
    if (imageHandler.isRotating) {
        e.preventDefault() // 阻止默认行为，防止选择文本等
        // 计算鼠标相对于起始位置的移动距离
        const dx = e.clientX - imageHandler.startX
        const dy = e.clientY - imageHandler.startY

        // 圆弧在第一象限，从上到下
        // 鼠标向右下移动 → 逆时针旋转（减少角度）
        // 鼠标向左上移动 → 顺时针旋转（增加角度）
        const angleDelta = (dx + dy) * 0.005

        // 基于起始旋转值计算
        currentImage.value.rotation = imageHandler.rotationStart + angleDelta
        layers.updateImageTransform(currentImage.value)

        return
    }

    // 考虑画布缩放，计算实际的偏移量
    const dx = (e.clientX - imageHandler.startX) / canvasTransform.scale
    const dy = (e.clientY - imageHandler.startY) / canvasTransform.scale

    if (imageHandler.isScaling) {

        // 缩放操作
        if (imageHandler.axis === 'x') {

            // 只缩放X轴
            const scaleX = imageHandler.scaleStart.x + dx * 0.01
            currentImage.value.scale.x = Math.max(0.1, Math.min(5, scaleX))
        }
        else if (imageHandler.axis === 'y') {

            // 只缩放Y轴
            const scaleY = imageHandler.scaleStart.y - dy * 0.01 // Y轴反向
            currentImage.value.scale.y = Math.max(0.1, Math.min(5, scaleY))
        }
        else {

            // 同时缩放两个轴
            const scaleX = imageHandler.scaleStart.x + dx * 0.01
            const scaleY = imageHandler.scaleStart.y - dy * 0.01 // Y轴反向
            currentImage.value.scale.x = Math.max(0.1, Math.min(5, scaleX))
            currentImage.value.scale.y = Math.max(0.1, Math.min(5, scaleY))
        }
    }
    else if (imageHandler.axis === 'x') {

        // 只改变 X 轴
        currentImage.value.origin.x = imageHandler.originStart.x + dx
    }
    else if (imageHandler.axis === 'y') {

        // 只改变 Y 轴 - 鼠标向下，origin减小，图像向下
        currentImage.value.origin.y = imageHandler.originStart.y - dy
    }
    else {

        // 改变两个轴 - X不变，Y反转
        currentImage.value.origin.x = imageHandler.originStart.x + dx
        currentImage.value.origin.y = imageHandler.originStart.y - dy
    }

    layers.updateImageTransform(currentImage.value)
}

function endImageHandlerDrag() {

    // 恢复光标和选择状态
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    imageHandler.isDragging = false
    imageHandler.axis = null
    imageHandler.isScaling = false
    imageHandler.isRotating = false
}

// 旋转拖动
function startRotateDrag(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (isCtrlPressed.value) return

    imageHandler.isDragging = true
    imageHandler.isRotating = true
    imageHandler.startX = e.clientX
    imageHandler.startY = e.clientY

    // 设置旋转时光标状态
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    if (currentImage.value) {
        imageHandler.rotationStart = currentImage.value.rotation
    }
}

function handleWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return // 需要按住 Ctrl/Cmd 键

    e.preventDefault()

    const rect = $renderCanvas.value!.getBoundingClientRect()

    // 鼠标在视口中的位置
    const viewportX = e.clientX - rect.left
    const viewportY = e.clientY - rect.top

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const oldScale = canvasTransform.scale
    const newScale = oldScale * delta

    if (newScale < 0.1 || newScale > 5) return

    // 鼠标在画布中的位置（考虑当前缩放和平移）
    const canvasX = (viewportX - canvasTransform.translateX) / oldScale
    const canvasY = (viewportY - canvasTransform.translateY) / oldScale

    // 更新缩放
    canvasTransform.scale = newScale

    // 计算新的平移值，使鼠标位置对应的画布位置不变
    canvasTransform.translateX = viewportX - canvasX * newScale
    canvasTransform.translateY = viewportY - canvasY * newScale
}

const moveEvent = (e: MouseEvent) => {
    const cvs = $renderCanvas.value!
    const r = cvs.getBoundingClientRect()
    if (r.width === 0) return
    pointer.lx = pointer.x
    pointer.ly = pointer.y
    pointer.x = e.layerX / r.width
    pointer.y = e.layerY / r.height
    pointer.ox = pointer.x * canvasSettings.value.width
    pointer.oy = pointer.y * canvasSettings.value.height 
}

const leaveEvent = () => {
    pointer.$reset()
}

const enterEvent = (e: MouseEvent) => {
    const cvs = $renderCanvas.value!
    const r = cvs.getBoundingClientRect()
    if (r.width === 0) return
    pointer.lx = pointer.x
    pointer.ly = pointer.y
    pointer.x = e.layerX / r.width
    pointer.y = e.layerY / r.height
    pointer.ox = pointer.x * canvasSettings.value.width
    pointer.oy = pointer.y * canvasSettings.value.height 
}

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

        const maskPropertyName = maskInfo.value.refKey

        // console.log(maskPropertyName)
        let maskName = ''
        if (currentEffect.value.isMultiPass && maskPropertyName) {

            // 多pass
            const maskConfig = currentEffect.value.getMaskConfig(maskPropertyName)

            if (maskConfig) {
                const { passName, bindingIndex } = maskConfig

                // 更新pass的资源
                const pass = currentEffect.value.passes?.find(p => p.name === passName)
                if (pass && pass.resources) {
                    pass.resources[bindingIndex] = texture
                    layers.renderer.updateBindGroupSetResources(passName, 'default', pass?.resources || [])
                    maskName = `${currentEffect.value.name}.${passName}__mask`
                }
            }
        }
        else {

            // 单pass
            currentEffect.value.setResource(maskInfo.value.bindingIndex, texture)
            layers.renderer.updateBindGroupSetResources(currentEffect.value.name, 'default', currentEffect.value!.resources!)
            maskName = `${currentEffect.value.name}__mask`
        }

        layers.materials.set(maskName, currentMask.value)
        currentEffect.value.refs[maskInfo.value.refKey!] = maskName
    }
}

// 添加快捷键监听
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

    // 全局鼠标移动和释放事件（用于图片 handler）
    document.addEventListener('mousemove', dragImageHandler)
    document.addEventListener('mouseup', endImageHandlerDrag)
})
</script>

<template>
  <div
    class="w-full relative overflow-hidden"
    :style="pageStyle"
  >
    <!-- 创建画布按钮 -->
    <div
      v-if="!canvasSettings.initialized"
      class="absolute inset-0 flex items-center justify-center bg-gray-100 z-50"
    >
      <div class="text-center">
        <q-btn
          color="primary"
          size="xl"
          label="创建画布"
          @click="showCreateCanvasDialog"
        />
      </div>
    </div>

    <!-- 画布容器 -->
    <div
      v-zoom="handleWheel"
      class="absolute inset-0 checkerboard"
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
        v-show="hasLayer"
        ref="renderCanvas"
        :width="canvasSettings.initialized ? canvasSettings.width : 1280"
        :height="canvasSettings.initialized ? canvasSettings.height : 720"
        class="absolute shadow-lg"
        :style="{
          transform: `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${canvasTransform.scale})`,
          transformOrigin: 'top left',
        }"
      />

      <!-- 蒙版画布 -->
      <div
        v-if="canvasSettings.initialized"
        class="absolute"
        :style="{
          left: 0,
          top: 0,
          width: canvasSettings.width + 'px',
          height: canvasSettings.height + 'px',
          transform: `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${canvasTransform.scale})`,
          transformOrigin: 'top left',
        }"
        @mousedown="startDrag"
        @mousemove="drag"
        @mouseup="endDrag"
        @mouseleave="endDrag"
        @pointermove="moveEvent"
        @pointerleave="leaveEvent"
        @pointerenter="enterEvent"
      >
        <MaskCanvas
          ref="maskCanvasRef"
          :width="canvasSettings.width"
          :height="canvasSettings.height"
          :brush-size="maskControls.brushSize"
          :brush-hardness="maskControls.brushHardness"
          :brush-amount="maskControls.brushAmount"
          :mask-opacity="maskControls.maskOpacity"
          :is-draw-mode="maskControls.isDrawMode"
          :flow-mode="maskControls.flowMode"
          :show-mask="propBarDisplay === 'maskProps'"
          :scale="1"
          @mask-update="handleMaskUpdate"
        />
      </div>

      <!-- Image position handler at bottom-left corner -->
      <div
        v-if="canvasSettings.initialized && currentImage && !maskControls.isDrawMode && handlerVisible"
        class="absolute"
        style="z-index: 1000; pointer-events: none;"
        :style="{
          left: 0,
          top: 0,
          width: canvasSettings.width + 'px',
          height: canvasSettings.height + 'px',
          transform: `translate(${canvasTransform.translateX}px, ${canvasTransform.translateY}px) scale(${canvasTransform.scale})`,
          transformOrigin: 'top left',
        }"
      >
        <div
          class="absolute"
          style="pointer-events: auto;"
          :style="{
            bottom: `${currentImage.origin.y}px`,
            left: `${currentImage.origin.x}px`,
            width: '150px',
            height: '150px',
            transform: `scale(${1 / canvasTransform.scale})`,
            transformOrigin: 'bottom left',
          }"
        >
          <!-- X轴 (水平) -->
          <div
            class="absolute bg-blue-500 hover:bg-blue-400 transition-colors cursor-move shadow-sm"
            style="height: 8px; bottom: 0; left: 0; width: 144px; border-radius: 0;"
            @mousedown="startAxisDrag($event, 'x')"
          >
            <!-- X轴箭头 (在端点向外) -->
            <svg
              class="absolute cursor-pointer transition-opacity group"
              style="right: -16px; top: -4px; width: 16px; height: 16px;"
              @mousedown="startScaleDrag($event, 'x')"
            >
              <path
                class="group-hover:fill-emerald-400 transition-colors"
                d="M 0 4 L 8 4 L 8 0 L 16 8 L 8 16 L 8 12 L 0 12 Z"
                fill="rgb(16 185 129)"
                stroke="none"
              />
            </svg>
          </div>

          <!-- Y轴 (垂直) -->
          <div
            class="absolute bg-red-500 hover:bg-red-400 transition-colors cursor-move shadow-sm"
            style="width: 8px; bottom: 0; left: 0; height: 144px; border-radius: 0;"
            @mousedown="startAxisDrag($event, 'y')"
          >
            <!-- Y轴箭头 (在端点向外) -->
            <svg
              class="absolute cursor-pointer transition-opacity group"
              style="top: -16px; left: -4px; width: 16px; height: 16px;"
              @mousedown="startScaleDrag($event, 'y')"
            >
              <path
                class="group-hover:fill-amber-400 transition-colors"
                d="M 4 16 L 4 8 L 0 8 L 8 0 L 16 8 L 12 8 L 12 16 Z"
                fill="rgb(251 146 60)"
                stroke="none"
              />
            </svg>
          </div>

          <!-- 中心原点 -->
          <div
            class="absolute bg-white hover:bg-gray-100 transition-colors rounded-full cursor-move border-2 border-slate-400 shadow-md"
            style="width: 16px; height: 16px; bottom: -6px; left: -6px;"
            @mousedown="startImageHandlerDrag"
          >
            <div
              class="absolute w-2 h-2 bg-slate-600 rounded-full"
              style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
            />
          </div>

          <!-- 拖动方块 (第一象限) -->
          <div
            class="absolute bg-indigo-500 hover:bg-indigo-400 transition-all shadow-lg cursor-move hover:shadow-xl hover:scale-105"
            style="width: 32px; height: 32px; bottom: 20px; left: 20px;"
            @mousedown="startImageHandlerDrag"
          />

          <!-- 旋转手柄 - 第一象限的圆弧，圆心在原点 -->
          <svg
            class="absolute"
            style="
              width: 300px;
              height: 300px;
              bottom: -150px;
              left: -150px;
              pointer-events: none;
            "
            viewBox="0 0 300 300"
          >
            <!-- 可点击的圆弧路径（透明） -->
            <path
              d="M 173 63 A 90 90 0 0 1 237 127"
              fill="none"
              stroke="transparent"
              stroke-width="30"
              style="pointer-events: auto; cursor: grab;"
              @mousedown="startRotateDrag"
            />
            <!-- 视觉圆弧 -->
            <path
              d="M 173 63 A 90 90 0 0 1 237 127"
              fill="none"
              stroke="rgb(168 85 247)"
              stroke-width="10"
              opacity="0.7"
              stroke-linecap="round"
              style="pointer-events: none;"
            />
            <!-- 旋转指示箭头 -->
            <path
              d="M 225 75 L 218 90 L 233 85 Z"
              fill="rgb(168 85 247)"
              opacity="0.9"
              style="pointer-events: none;"
            />
          </svg>

          <!-- 轴标签 -->
          <div
            class="absolute text-slate-600 text-sm font-bold select-none"
            style="bottom: 10px; right: -28px;"
          >
            X
          </div>
          <div
            class="absolute text-slate-600 text-sm font-bold select-none"
            style="top: -25px; left: 10px;"
          >
            Y
          </div>
        </div>
      </div>

      <!-- 控制面板 -->
      <div
        v-if="canvasSettings.initialized && controlPanelVisible"
        class="absolute bottom-4 left-4 bg-black/80 text-white transition-all duration-300 rounded-lg shadow-lg"
        style="z-index: 2000;"
      >
        <!-- 顶部信息 -->
        <div class="px-4 pt-3 pb-2 border-b border-gray-600/30">
          <div class="flex items-center justify-between">
            <div class="text-sm">
              <span class="font-semibold">{{ canvasSettings.width }} × {{ canvasSettings.height }}</span>
              <span class="mx-2 text-gray-400">|</span>
              <span>{{ (canvasTransform.scale * 100).toFixed(0) }}%</span>
            </div>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="i-mdi:close"
              text-color="grey-400"
              @click="controlPanelVisible = false"
            />
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="px-4 pb-3 pt-2">
          <div class="grid grid-cols-4 gap-2">
            <!-- 显示/隐藏Handler -->
            <q-btn
              :color="handlerVisible ? 'primary' : 'grey-8'"
              unelevated
              dense
              size="sm"
              :icon="handlerVisible ? 'i-mdi:axis-arrow' : 'i-mdi:axis-arrow-lock'"
              :title="handlerVisible ? '隐藏 Handler' : '显示 Handler'"
              @click="toggleHandler"
            />

            <!-- 放大 -->
            <q-btn
              color="grey-8"
              unelevated
              dense
              size="sm"
              icon="i-mdi:magnify-plus"
              class="hover:bg-primary-100"
              @click="zoomIn"
            />

            <!-- 缩小 -->
            <q-btn
              color="grey-8"
              unelevated
              dense
              size="sm"
              icon="i-mdi:magnify-minus"
              class="hover:bg-primary-100"
              @click="zoomOut"
            />

            <!-- 适应屏幕 -->
            <q-btn
              color="grey-8"
              unelevated
              dense
              size="sm"
              icon="i-mdi:fit-to-screen-outline"
              class="hover:bg-primary-100"
              @click="fitToScreen"
            />
          </div>
        </div>

        <!-- 快捷键提示 -->
        <div class="px-4 pb-2 text-xs text-gray-400">
          Ctrl/Cmd+拖动: 移动 • 滚轮: 缩放 • Ctrl/Cmd+0: 重置
        </div>
      </div>

      <!-- 显示按钮（当面板隐藏时） -->
      <q-btn
        v-if="canvasSettings.initialized && !controlPanelVisible"
        class="absolute bottom-4 left-4"
        style="z-index: 2000;"
        color="black"
        text-color="white"
        unelevated
        dense
        icon="i-mdi:cog"
        label="控制"
        @click="showControlPanel"
      />
    </div>

    <!-- 创建画布对话框 -->
    <q-dialog
      v-model="showCanvasDialog"
      transition-show="jump-down"
      transition-hide="jump-up"
    >
      <q-card class="dialog-card">
        <q-card-section class="dialog-header">
          <div class="text-h6 text-white">
            创建新画布
          </div>
          <q-btn
            v-close-popup
            flat
            round
            dense
            icon="close"
            class="text-white"
          />
        </q-card-section>

        <q-card-section class="dialog-content q-pt-none">
          <!-- 预设尺寸 -->
          <div class="section">
            <div class="section-title">
              预设尺寸
            </div>

            <div class="preset-group">
              <div class="group-label">
                横屏
              </div>
              <div class="preset-buttons">
                <q-btn
                  v-for="preset in [
                    { label: '720p', w: 1280, h: 720 },
                    { label: '1080p', w: 1920, h: 1080 },
                    { label: '2K', w: 2560, h: 1440 },
                    { label: '4K', w: 3840, h: 2160 },
                  ]"
                  :key="'landscape-' + preset.label"
                  unelevated
                  :label="preset.label"
                  :color="tempCanvasWidth === preset.w && tempCanvasHeight === preset.h ? 'primary' : 'grey-3'"
                  :text-color="tempCanvasWidth === preset.w && tempCanvasHeight === preset.h ? 'white' : 'grey-9'"
                  class="preset-btn"
                  @click="tempCanvasWidth = preset.w; tempCanvasHeight = preset.h"
                />
              </div>
            </div>

            <div class="preset-group">
              <div class="group-label">
                竖屏
              </div>
              <div class="preset-buttons">
                <q-btn
                  v-for="preset in [
                    { label: '720p', w: 720, h: 1280 },
                    { label: '1080p', w: 1080, h: 1920 },
                    { label: '2K', w: 1440, h: 2560 },
                    { label: '4K', w: 2160, h: 3840 },
                  ]"
                  :key="'portrait-' + preset.label"
                  unelevated
                  :label="preset.label"
                  :color="tempCanvasWidth === preset.w && tempCanvasHeight === preset.h ? 'primary' : 'grey-3'"
                  :text-color="tempCanvasWidth === preset.w && tempCanvasHeight === preset.h ? 'white' : 'grey-9'"
                  class="preset-btn"
                  @click="tempCanvasWidth = preset.w; tempCanvasHeight = preset.h"
                />
              </div>
            </div>
          </div>

          <!-- 自定义尺寸 -->
          <div class="section">
            <div class="section-title">
              自定义尺寸
            </div>
            <div class="custom-inputs">
              <q-input
                v-model.number="tempCanvasWidth"
                type="number"
                outlined
                dense
                label="宽度"
                :min="100"
                :max="7680"
                class="size-input"
              />
              <span class="separator">×</span>
              <q-input
                v-model.number="tempCanvasHeight"
                type="number"
                outlined
                dense
                label="高度"
                :min="100"
                :max="4320"
                class="size-input"
              />
              <span class="text-caption text-grey-6 q-ml-sm">px</span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions class="dialog-actions">
          <q-btn
            v-close-popup
            flat
            label="取消"
            class="action-btn"
          />
          <q-btn
            color="primary"
            label="创建"
            unelevated
            :disable="tempCanvasWidth < 100 || tempCanvasHeight < 100"
            class="action-btn"
            @click="createCanvas"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
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

/* 对话框样式 */
.dialog-card {
  width: 600px;
  border-radius: 2px;
}

.dialog-header {
  padding: 16px 24px;
  background-color: var(--q-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-content {
  padding: 20px 24px;
}

.dialog-actions {
  padding: 12px 24px;
  border-top: 1px solid #e0e0e0;
  gap: 12px;
  justify-content: flex-end;
}

/* 内容区块 */
.section {
  margin-bottom: 32px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

/* 预设按钮组 */
.preset-group {
  margin-bottom: 20px;
}

.preset-group:last-child {
  margin-bottom: 0;
}

.group-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.preset-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.preset-btn {
  min-width: 100px;
  height: 40px;
  border-radius: 4px;
  font-weight: 500;
}

/* 自定义输入 */
.custom-inputs {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.size-input {
  width: 90px;
}

.size-input :deep(input[type='number']::-webkit-outer-spin-button),
.size-input :deep(input[type='number']::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.separator {
  font-size: 16px;
  color: #999;
  margin-bottom: 6px;
}

/* 操作按钮 */
.action-btn {
  min-width: 64px;
  border-radius: 2px;
}
</style>
