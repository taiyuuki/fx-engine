<script setup lang="ts">
import { createWGSLRenderer } from 'wgsl-renderer'
import MaskCanvas from 'src/components/MaskCanvas.vue'
import { canvasSettings, currentEffect, maskControls, propBarDisplay } from 'src/pages/side-bar/composibles'
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
const maskCanvasRef = ref<any>(null)

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

// 监听画布初始化，创建后初始化渲染器
watch(() => canvasSettings.value.initialized, async newValue => {
    if (newValue && $renderCanvas.value && !layers.renderer) {

        // 设置 canvas 尺寸
        $renderCanvas.value.width = canvasSettings.value.width
        $renderCanvas.value.height = canvasSettings.value.height

        // 创建渲染器
        layers.renderer = await createWGSLRenderer($renderCanvas.value)

        // 重新渲染所有图像
        await layers.reRender()
    }
})

// renderer 将在画布创建后初始化
onMounted(() => {

    // 不要在这里初始化 renderer，等待画布创建
})

onUnmounted(() => {
    window.removeEventListener('resize', fitToScreen)
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
        const maskName = `${currentEffect.value.name}__mask`
        layers.materials.set(maskName, currentMask.value)
        currentEffect.value.refs[maskInfo.value.refKey!] = maskName

        layers.renderer.updateBindGroupSetResources(currentEffect.value.name, 'default', currentEffect.value!.resources!)
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
      @mousedown="startDrag"
      @mousemove="drag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
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
        @pointermove="moveEvent"
        @pointerleave="leaveEvent"
        @pointerenter="enterEvent"
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
