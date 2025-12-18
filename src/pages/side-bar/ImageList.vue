<script setup lang="ts">
import { canvasSettings, currentImage, propBarDisplay, selectImage } from './composibles'

const $inputImage = useTemplateRef<HTMLInputElement>('inputImage')

const layers = useLayers()

async function addImageLayer(e: Event) {
    const $t = e.target as HTMLInputElement
    const file = $t.files?.[0]
    if (file) {
        await layers.addImage(file)
        propBarDisplay.value = 'imageProps'
        $t.value = ''
    }
}

async function removeImageLayer(i: number) {
    await layers.removeImage(i)
}
</script>

<template>
  <div class="p-1">
    <!-- 添加图片按钮 -->
    <q-btn
      v-if="canvasSettings.initialized"
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
        :active="currentImage === image"
        class="image-item"
        :class="{ 'image-item-active': currentImage === image }"
        @click="selectImage(image)"
      >
        <q-item-section avatar>
          <q-avatar>
            <img
              :src="image.url"
              alt=""
              style="width: 100%; height: 100%;"
            >
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label lines="1">
            <span>图层 {{ index + 1 }}</span>
          </q-item-label>
          <q-item-label caption>
            尺寸: {{ image.size.width }} × {{ image.size.height }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-btn
            icon="close"
            flat
            round
            dense
            class="delete-btn"
            @click="removeImageLayer(index)"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style scoped>
.image-item {
  border-left: 3px solid transparent;
}

.image-item-active {
  background-color: var(--q-primary);
  border-left-color: var(--q-primary-dark);
}

.image-item-active .q-item__label {
  color: white;
}

.delete-btn {
  color: rgba(0, 0, 0, 0.6);
}

.delete-btn:hover {
  color: rgba(0, 0, 0, 0.9);
  background-color: rgba(0, 0, 0, 0.05);
}

.image-item-active .delete-btn {
  color: rgba(255, 255, 255, 0.8);
}

.image-item-active .delete-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
