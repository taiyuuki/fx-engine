<script setup lang="ts">
import ImageList from './side-bar/ImageList.vue'
import PropsBar from './side-bar/PropsBar.vue'

const splitterModel = ref(50)
</script>

<template>
  <q-splitter
    v-model="splitterModel"
    :limits="[30, 70]"
    class="h-screen"
  >
    <template #before>
      <ImageList />
    </template>

    <template #after>
      <PropsBar />
    </template>
  </q-splitter>
</template>
