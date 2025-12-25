<script setup lang="ts">
import { Effect } from 'src/effects'
import { currentEffect, currentImage, propBarDisplay, selectEffect } from './composibles'

const effectsModal = ref(false)
const active = ref<string | null>(null)
const layers = useLayers()

// 图片变换参数
const imageTransform = reactive({
    originX: 0,
    originY: 0,
    scaleX: 1,
    scaleY: 1,
})

// 监听当前图片变化
watch(currentImage, () => {
    if (currentImage.value) {
        imageTransform.originX = currentImage.value.origin.x
        imageTransform.originY = currentImage.value.origin.y
        imageTransform.scaleX = currentImage.value.scale.x
        imageTransform.scaleY = currentImage.value.scale.y
    }
}, { immediate: true })

// 监听图片属性变化，同步到UI
watch(() => currentImage.value?.origin, () => {
    if (currentImage.value) {
        imageTransform.originX = currentImage.value.origin.x
        imageTransform.originY = currentImage.value.origin.y
    }
}, { deep: true })

watch(() => currentImage.value?.scale, () => {
    if (currentImage.value) {
        imageTransform.scaleX = currentImage.value.scale.x
        imageTransform.scaleY = currentImage.value.scale.y
    }
}, { deep: true })

// 监听变换参数变化
watch([imageTransform], () => {
    if (currentImage.value) {
        currentImage.value.origin.x = imageTransform.originX
        currentImage.value.origin.y = imageTransform.originY
        currentImage.value.scale.x = imageTransform.scaleX
        currentImage.value.scale.y = imageTransform.scaleY

        // 更新 uniform buffer
        if (currentImage.value) {
            layers.updateImageTransform(currentImage.value)
        }
    }
}, { deep: true })

async function addEffect() {
    if (!active.value) return
    await layers.addEffect(active.value)

    currentEffect.value = currentImage.value?.effects.at(-1) ?? null
    propBarDisplay.value = 'effectProps'
    effectsModal.value = false
}

// 效果列表
const effectsList = [
    { id: 'water-ripple', label: '水波纹' },
    { id: 'iris-movement', label: '虹膜移动' },
    { id: 'water-flow', label: '水流' },
    { id: 'cursor-ripple', label: '游标波纹' },
    { id: 'cloud-motion', label: '云朵移动' },
]

function editEffect() {
    if (currentEffect) {
        propBarDisplay.value = 'effectProps'
    }
}

function removeEffect(e: Effect, i: number) {
    if (!currentImage.value) {
        return
    }
    layers.removeEffect(e, i)
}

function resetTransform() {
    imageTransform.originX = 0
    imageTransform.originY = 0
    imageTransform.scaleX = 1
    imageTransform.scaleY = 1
    currentImage.value && layers.updateImageTransform(currentImage.value)
}
</script>

<template>
  <h4 class="text-sm text-center p-0 m-3">
    图层
  </h4>
  <q-img
    v-if="currentImage"
    :src="currentImage.url"
    spinner-color="white"
    class="h-[140px] max-w-full px-2 block"
  />
  <div class="my-2 w-full">
    <q-btn-group
      class="w-full p-1"
      flat
    >
      <q-btn
        label="新增"
        icon="add"
        color="primary"
        class="flex-1"
        @click="effectsModal = true"
      />
      <q-btn
        label="编辑"
        icon="edit"
        color="primary"
        class="flex-1"
        :disable="!currentEffect"
        @click="editEffect"
      />
    </q-btn-group>
  </div>
  <q-list
    bordered
    separator
    dense
    class="p-1 h-[150px] overflow-auto"
  >
    <q-item
      v-for="(e, i) in currentImage?.effects"
      :key="e.name"
      :active="currentEffect?.name === e.name"
      active-class="bg-primary text-white"
      class="cursor-auto select-none"
      clickable
      @click="selectEffect(e)"
    >
      <div class="flex-1 flex items-center">
        {{ e.label }}
      </div>

      <div class="w-fit flex items-center gap-3">
        <!-- <div
            class="w-5 h-5 text-gray-500 hover:text-inherit"
            :class="{
              'i-mdi:eye-outline': e.enable,
              'i-mdi:eye-off-outline': !e.enable,
            }"
            @click="switchEnable(e, i)"
          /> -->
        <div
          class="i-mdi:trash-can-outline w-5 h-5 text-gray-500 hover:text-inherit"
          @click="removeEffect(e, i)"
        />
      </div>
    </q-item>
  </q-list>

  <!-- 图片变换控制 -->
  <div
    v-if="currentImage"
    class="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
  >
    <h5 class="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
      图片变换
    </h5>

    <div class="space-y-3">
      <!-- X 原点 -->
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
          X 原点
        </label>
        <q-input
          v-model.number="imageTransform.originX"
          type="number"
          dense
          outlined
          style="width: 100px"
          :min="-1920"
          :max="1920"
          @update:model-value="v => {
            const value = Number(v) || 0;
            imageTransform.originX = value;
            currentImage && layers.updateImageTransform(currentImage);
          }"
        >
          <template #append>
            <span class="text-xs text-gray-500">px</span>
          </template>
        </q-input>
      </div>

      <!-- Y 原点 -->
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
          Y 原点
        </label>
        <q-input
          v-model.number="imageTransform.originY"
          type="number"
          dense
          outlined
          style="width: 100px"
          :min="-1080"
          :max="1080"
          @update:model-value="v => {
            const value = Number(v) || 0;
            imageTransform.originY = value;
            currentImage && layers.updateImageTransform(currentImage);
          }"
        >
          <template #append>
            <span class="text-xs text-gray-500">px</span>
          </template>
        </q-input>
      </div>

      <!-- X 缩放 -->
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
          X 缩放
        </label>
        <q-input
          v-model.number="imageTransform.scaleX"
          type="number"
          dense
          outlined
          style="width: 100px"
          :min="0.1"
          :max="3"
          step="0.01"
          @update:model-value="v => {
            const value = Number(v) || 0.1;
            imageTransform.scaleX = value;
            currentImage && layers.updateImageTransform(currentImage);
          }"
        >
          <template #append>
            <span class="text-xs text-gray-500">x</span>
          </template>
        </q-input>
      </div>

      <!-- Y 缩放 -->
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
          Y 缩放
        </label>
        <q-input
          v-model.number="imageTransform.scaleY"
          type="number"
          dense
          outlined
          style="width: 100px"
          :min="0.1"
          :max="3"
          step="0.01"
          @update:model-value="v => {
            const value = Number(v) || 0.1;
            imageTransform.scaleY = value;
            currentImage && layers.updateImageTransform(currentImage);
          }"
        >
          <template #append>
            <span class="text-xs text-gray-500">x</span>
          </template>
        </q-input>
      </div>

      <!-- 重置按钮 -->
      <q-btn
        flat
        size="sm"
        label="重置变换"
        color="primary"
        class="w-full"
        @click="resetTransform"
      />
    </div>
  </div>

  <q-dialog
    v-model="effectsModal"
    transition-show="jump-down"
    transition-hide="jump-up"
  >
    <q-card class="dialog-card">
      <q-card-section class="dialog-header">
        <div class="text-h6 text-white">
          添加图片效果
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
        <div class="q-gutter-sm">
          <q-btn
            v-for="effect in effectsList"
            :key="effect.id"
            :label="effect.label"
            outline
            color="grey-6"
            text-color="grey-8"
            class="effect-btn full-width"
            :class="{ 'effect-btn-active': active === effect.id }"
            @click="active = effect.id"
          />
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
          label="添加"
          unelevated
          :disable="!active"
          class="action-btn"
          @click="addEffect"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss">
.dialog-card {
  width: 400px;
  max-width: 95vw;
  border-radius: 2px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: var(--q-primary);
}

.dialog-content {
  padding: 20px 24px;
}

.dialog-actions {
  padding: 12px 24px;
  justify-content: flex-end;
  gap: 8px;
}

.effect-btn {
  height: 48px;
  border-radius: 4px;
  background-color: white !important;
}

.effect-btn-active {
  background-color: var(--q-primary) !important;
  border-color: var(--q-primary) !important;
  color: white !important;
}

.action-btn {
  min-width: 64px;
  border-radius: 2px;
}
</style>
