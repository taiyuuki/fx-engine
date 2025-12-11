<script setup lang="ts">
import { currentEffect, currentImage, propBarDisplay, selectEffect } from './composibles'

const effectsModal = ref(false)
const active = ref<string | null>(null)
const layers = useLayers()

function addEffect() {
    switch (active.value) {
        case 'water-ripple':

            layers.addEffect(0, 'water-ripple')
            break
    }
    effectsModal.value = false
}

function editEffect() {
    if (currentEffect) {
        propBarDisplay.value = 'effectProps'
    }
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
      class="p-1"
    >
      <q-item
        v-for="e in currentImage?.effects"
        :key="e.name"
        v-ripple
        clickable
        @click="selectEffect(e)"
      >
        <q-item-section>
          {{ e.name }}
        </q-item-section>
      </q-item>
    </q-list>
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
        >
          <q-tooltip>Close</q-tooltip>
        </q-btn>
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
