<script setup lang="ts">
import { Effect } from 'src/effects'
import { currentEffect, currentImage, propBarDisplay, selectEffect } from './composibles'

const effectsModal = ref(false)
const active = ref<string | null>(null)
const layers = useLayers()

async function addEffect() {
    switch (active.value) {
        case 'water-ripple':
            await layers.addEffect(0, 'water-ripple')
            break
 
        case 'iris-movement':
            await layers.addEffect(0, 'iris-movement')
            break
    }
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

function switchEnable(e: Effect, i: number) {
    e.enable = !e.enable
    layers.switchEnable(e, i)
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
          <div
            class="w-5 h-5 text-gray-500 hover:text-inherit" 
            :class="{
              'i-mdi:eye-outline': e.enable,
              'i-mdi:eye-off-outline': !e.enable,
            }"
            @click="switchEnable(e, i)"
          />
          <div
            class="i-mdi:trash-can-outline w-5 h-5 text-gray-500 hover:text-inherit"
            @click="removeEffect(e, i)"
          />
        </div>
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
