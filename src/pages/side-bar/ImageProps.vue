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
})

// 监听变换参数变化
watch([imageTransform], () => {
    if (currentImage.value) {
        currentImage.value.origin.x = imageTransform.originX
        currentImage.value.origin.y = imageTransform.originY
        currentImage.value.scale.x = imageTransform.scaleX
        currentImage.value.scale.y = imageTransform.scaleY

        // 更新 uniform buffer
        layers.updateImageTransform(currentImage.value)
    }
}, { deep: true })

async function addEffect() {
    if (!active.value) return
    await layers.addEffect(active.value)

    currentEffect.value = currentImage.value?.effects.at(-1) ?? null
    propBarDisplay.value = 'effectProps'
    effectsModal.value = false
}

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

      <div class="space-y-4">
        <!-- X 原点 -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
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
              @update:model-value="(v: string | number | null) => { imageTransform.originX = Number(v) || 0 }"
            >
              <template #append>
                <span class="text-xs text-gray-500">px</span>
              </template>
            </q-input>
          </div>
          <q-slider
            v-model="imageTransform.originX"
            :min="-1920"
            :max="1920"
            :step="1"
            class="flex-1"
            @change="(v: number) => imageTransform.originX = v"
          />
        </div>

        <!-- Y 原点 -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
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
              @update:model-value="(v: string | number | null) => { imageTransform.originY = Number(v) || 0 }"
            >
              <template #append>
                <span class="text-xs text-gray-500">px</span>
              </template>
            </q-input>
          </div>
          <q-slider
            v-model="imageTransform.originY"
            :min="-1080"
            :max="1080"
            :step="1"
            class="flex-1"
            @change="(v: number) => imageTransform.originY = v"
          />
        </div>

        <!-- X 缩放 -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
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
              :step="0.001"
              @update:model-value="(v: string | number | null) => { imageTransform.scaleX = Number(v) || 0.1 }"
            >
              <template #append>
                <span class="text-xs text-gray-500">x</span>
              </template>
            </q-input>
          </div>
          <q-slider
            v-model="imageTransform.scaleX"
            :min="0.1"
            :max="3"
            :step="0.001"
            class="flex-1"
            @change="(v: number) => imageTransform.scaleX = v"
          />
        </div>

        <!-- Y 缩放 -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
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
              @update:model-value="(v: string | number | null) => { imageTransform.scaleY = Number(v) || 0.1 }"
            >
              <template #append>
                <span class="text-xs text-gray-500">x</span>
              </template>
            </q-input>
          </div>
          <q-slider
            v-model="imageTransform.scaleY"
            :min="0.1"
            :max="3"
            :step="0.01"
            class="flex-1"
            @change="(v: number) => imageTransform.scaleY = v"
          />
        </div>

        <!-- 重置按钮 -->
        <q-btn
          flat
          size="sm"
          label="重置变换"
          color="primary"
          class="w-full"
          @click="() => {
            imageTransform.originX = 0
            imageTransform.originY = 0
            imageTransform.scaleX = 1
            imageTransform.scaleY = 1
          }"
        />
      </div>
    </div>
  </div>
  <q-dialog
    v-model="effectsModal"
  >
    <q-card>
      <q-bar
        class="bg-primary"
        flat
      >
        <q-toolbar-title class="text-white m-2">
          添加图片效果
        </q-toolbar-title>
        <q-btn
          v-close-popup
          dense
          flat
          icon="close"
          color="white"
        />
      </q-bar>

      <q-card-section>
        <q-list
          bordered
          separator
        >
          <q-item
            v-ripple
            clickable
            active-class="bg-primary text-white"
            :active="active === 'water-ripple'"
            @click="active = 'water-ripple'"
          >
            <q-item-section>水波纹</q-item-section>
          </q-item>
          <q-item
            v-ripple
            clickable
            active-class="bg-primary text-white"
            :active="active === 'iris-movement'"
            @click="active = 'iris-movement'"
          >
            <q-item-section>虹膜移动</q-item-section>
          </q-item>

          <q-item
            v-ripple
            clickable
            active-class="bg-primary text-white"
            :active="active === 'water-flow'"
            @click="active = 'water-flow'"
          >
            <q-item-section>水流</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          v-close-popup
          flat
          label="取消"
        />
        <q-btn
          flat
          label="添加"
          color="primary"
          @click="addEffect"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss">
</style>
