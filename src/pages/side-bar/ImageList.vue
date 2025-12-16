<script setup lang="ts">
import { canvasSettings, currentImage, selectImage } from './composibles'

const $inputImage = useTemplateRef<HTMLInputElement>('inputImage')

const layers = useLayers()
const showCanvasDialog = ref(false)
const tempCanvasWidth = ref(1280)
const tempCanvasHeight = ref(720)

async function addImageLayer(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
        layers.addImage(file)
    }
}

async function removeImageLayer(i: number) {
    await layers.removeImage(i)
}

function showCreateCanvasDialog() {
    showCanvasDialog.value = true
}

async function createCanvas() {
    canvasSettings.value.width = tempCanvasWidth.value
    canvasSettings.value.height = tempCanvasHeight.value
    canvasSettings.value.initialized = true
    showCanvasDialog.value = false
}
</script>

<template>
  <div class="p-1">
    <!-- 创建画布或添加图片 -->
    <q-btn
      v-if="!canvasSettings.initialized"
      dense
      flat
      icon="aspect_ratio"
      label="创建画布"
      class="w-full bg-primary text-white"
      @click="showCreateCanvasDialog"
    />
    <q-btn
      v-else
      dense
      flat
      icon="add"
      label="添加图片"
      class="w-full bg-primary text-white"
      @click="$inputImage?.click()"
    />
    <input
      ref="inputImage"
      type="file"
      name=""
      class="hidden"
      accept="image/*"
      :disabled="!canvasSettings.initialized"
      @change="addImageLayer"
    >

    <q-separator />

    <q-list>
      <q-item
        v-for="(image, index) in layers.imageLayers"
        :key="index"
        v-ripple
        clickable
        :active="currentImage?.name === image.name"
        active-class="bg-primary text-white"
        class="cursor-auto select-none"
        @click="selectImage(image)"
      >
        <q-item-section side>
          <div
            class="i-ic:image w-6 h-6"
            :class="{ 'text-white': currentImage?.name === image.name }"
          />
        </q-item-section>
        <q-item-section
          no-wrap
        >
          <q-item-label class="select-none flex items-center justify-between">
            <div class="flex-1 truncate">
              {{ image.name }}
            </div>
            <div
              class="i-mdi:trash-can-outline w-5 h-5 text-gray-500 hover:text-inherit"
              @click="removeImageLayer(index)"
            />
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- 创建画布对话框 -->
    <q-dialog
      v-model="showCanvasDialog"
      persistent
    >
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">
            创建新画布
          </div>
        </q-card-section>

        <q-card-section>
          <div class="space-y-4">
            <!-- 预设尺寸 -->
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                预设尺寸
              </label>

              <!-- 横屏预设 -->
              <div class="mb-3">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  横屏
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <q-btn
                    flat
                    outline
                    label="720p"
                    @click="tempCanvasWidth = 1280; tempCanvasHeight = 720"
                  />
                  <q-btn
                    flat
                    outline
                    label="1080p"
                    @click="tempCanvasWidth = 1920; tempCanvasHeight = 1080"
                  />
                  <q-btn
                    flat
                    outline
                    label="2K"
                    @click="tempCanvasWidth = 2560; tempCanvasHeight = 1440"
                  />
                  <q-btn
                    flat
                    outline
                    label="4K"
                    @click="tempCanvasWidth = 3840; tempCanvasHeight = 2160"
                  />
                </div>
              </div>

              <!-- 竖屏预设 -->
              <div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  竖屏
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <q-btn
                    flat
                    outline
                    label="720p 竖屏"
                    @click="tempCanvasWidth = 720; tempCanvasHeight = 1280"
                  />
                  <q-btn
                    flat
                    outline
                    label="1080p 竖屏"
                    @click="tempCanvasWidth = 1080; tempCanvasHeight = 1920"
                  />
                  <q-btn
                    flat
                    outline
                    label="2K 竖屏"
                    @click="tempCanvasWidth = 1440; tempCanvasHeight = 2560"
                  />
                  <q-btn
                    flat
                    outline
                    label="4K 竖屏"
                    @click="tempCanvasWidth = 2160; tempCanvasHeight = 3840"
                  />
                </div>
              </div>
            </div>

            <!-- 自定义尺寸 -->
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                自定义尺寸
              </label>
              <div class="flex gap-2 items-center">
                <q-input
                  v-model.number="tempCanvasWidth"
                  type="number"
                  label="宽度"
                  outlined
                  dense
                  :min="100"
                  :max="7680"
                  class="flex-1"
                />
                <span class="text-gray-500">×</span>
                <q-input
                  v-model.number="tempCanvasHeight"
                  type="number"
                  label="高度"
                  outlined
                  dense
                  :min="100"
                  :max="4320"
                  class="flex-1"
                />
              </div>
            </div>

            <!-- 当前设置显示 -->
            <div class="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                画布尺寸: {{ tempCanvasWidth }} × {{ tempCanvasHeight }}
              </span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            label="取消"
            @click="showCanvasDialog = false"
          />
          <q-btn
            color="primary"
            label="创建"
            :disable="tempCanvasWidth < 100 || tempCanvasHeight < 100"
            @click="createCanvas"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>
