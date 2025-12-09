<script setup lang="ts">
const $inputImage = useTemplateRef<HTMLInputElement>('inputImage')

const layers = useLayers()

function addImageLayer(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
        layers.addImage({
            blob: file,
            name: file.name,
            size: {
                width: 0,
                height: 0,
            },
            passes: [],
        })
    }
}
</script>

<template>
  <div class="p-1">
    <q-btn
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
      @change="addImageLayer"
    >

    <q-separator />

    <q-list>
      <q-item
        v-for="(image, index) in layers.images"
        :key="index"
        v-ripple
        clickable
      >
        <q-item-section side>
          <div class="i-ic-image w-6 h-6" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="select-none">
            {{ image.name }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>
