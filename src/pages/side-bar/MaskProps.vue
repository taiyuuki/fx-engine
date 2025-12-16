<script setup lang="ts">
import { currentMask, maskInfo } from 'src/composibles/mask'
import { DisplayType, canvasSettings, maskCanvasRef, maskControls, propBarDisplay } from './composibles'

function clearMask() {
    maskCanvasRef.value?.clearMask()
}

function toggleDrawMode() {
    maskControls.value.isDrawMode = !maskControls.value.isDrawMode
    maskCanvasRef.value?.toggleDrawMode()
}

// 根据画布大小计算画笔大小的最大值
const maxBrushSize = computed(() => {
    if (!canvasSettings.value.initialized) {
        return 100
    }

    // 基准：1280x720 的画布，画笔最大 100
    const baseWidth = 1280
    const baseHeight = 720
    const baseMaxSize = 100

    // 计算画布的对角线长度
    const canvasDiagonal = Math.sqrt(canvasSettings.value.width ** 2
        + canvasSettings.value.height ** 2)

    // 计算基准画布的对角线长度
    const baseDiagonal = Math.sqrt(baseWidth ** 2 + baseHeight ** 2)

    // 根据对角线比例调整最大画笔大小
    const scaleFactor = canvasDiagonal / baseDiagonal
    const maxSize = Math.round(baseMaxSize * scaleFactor)

    // 确保最小值不低于 50，最大值不超过 500
    return Math.max(50, Math.min(500, maxSize))
})

function goBack(target: DisplayType) {
    if (maskControls.value.isDrawMode) {
        maskCanvasRef.value?.toggleDrawMode()
    }
    propBarDisplay.value = target
    currentMask.value = null
    maskInfo.value = {
        bindingIndex: -1,
        propertyIndex: -1,
        refKey: null,
        flowMode: false,
    }
}
</script>

<template>
  <div class="p-5">
    <!-- 头部 -->
    <q-breadcrumbs
      active-color="primary"
      class="mb-5"
    >
      <template #separator>
        <q-icon
          size="1.2em"
          name="arrow_forward"
          color="primary"
        />
      </template>

      <q-breadcrumbs-el
        label="图层"
        icon="home"
        class="cursor-pointer select-none"
        @click="goBack('imageProps')"
      />
      <q-breadcrumbs-el
        label="效果"
        icon="widgets"
        class="cursor-pointer select-none"
        @click="goBack('effectProps')"
      />
      <q-breadcrumbs-el
        label="绘制蒙版"
        icon="widgets"
        class="select-none"
      />
    </q-breadcrumbs>

    <!-- 绘制模式切换 -->
    <div class="mb-6">
      <button
        :class="[
          'w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2',
          maskControls.isDrawMode
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
            : 'bg-green-500 hover:bg-green-600 text-white shadow-lg',
        ]"
        @click="toggleDrawMode"
      >
        <span :class="maskControls.isDrawMode ? 'i-carbon-close' : 'i-carbon-edit'" />
        {{ maskControls.isDrawMode ? '退出绘制模式' : '开始绘制' }}
      </button>
    </div>

    <!-- 画笔设置 -->
    <div class="space-y-4">
      <!-- 画笔大小 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            画笔大小
          </label>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
            {{ maskControls.brushSize }}
          </span>
        </div>
        <q-slider
          v-model="maskControls.brushSize"
          :min="1"
          :max="maxBrushSize"
          class="flex-1"
          @change="(v: number) => maskControls.brushSize = v"
        />
      </div>

      <!-- 画笔硬度 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            画笔硬度
          </label>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
            {{ maskControls.brushHardness.toFixed(1) }}
          </span>
        </div>
        <q-slider
          v-model="maskControls.brushHardness"
          :min="0.1"
          :max="1"
          :step="0.1"
          class="flex-1"
          @change="(v: number) => maskControls.brushHardness = v"
        />
      </div>

      <!-- 画笔数量 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            画笔数量
          </label>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
            {{ maskControls.brushAmount }}
          </span>
        </div>
        <q-slider
          v-model="maskControls.brushAmount"
          :min="0"
          :max="255"
          :step="1"
          class="flex-1"
          @change="(v: number) => maskControls.brushAmount = v"
        />
      </div>

      <!-- 蒙版透明度 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            蒙版透明度
          </label>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
            {{ maskControls.maskOpacity.toFixed(1) }}
          </span>
        </div>
        <q-slider
          v-model="maskControls.maskOpacity"
          :min="0.1"
          :max="1"
          :step="0.1"
          class="flex-1"
          @change="(v: number) => maskControls.maskOpacity = v"
        />
      </div>

      <!-- 清除蒙版按钮 -->
      <button
        class="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        @click="clearMask"
      >
        <span class="i-carbon-trash-can" />
        清除蒙版
      </button>
    </div>
  </div>
</template>

<style scoped>
.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #3b82f6;
  cursor: pointer;
  border-radius: 50%;
  border: none;
}

.dark .slider::-webkit-slider-thumb {
  background: #60a5fa;
}

.dark .slider::-moz-range-thumb {
  background: #60a5fa;
}
</style>
