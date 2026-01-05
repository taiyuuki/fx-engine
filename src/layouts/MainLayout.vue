<script setup lang="ts">
import { canvasSettings } from 'src/pages/side-bar/composibles'
import SideBar from 'src/pages/SideBar.vue'

const extraTabs = ref<{
    title: string
    name: string
}[]>([])

const drawerWidth = computed(() => canvasSettings.value.initialized ? 600 : 0)
</script>

<template>
  <q-layout view="hHr lpR fFr">
    <q-header
      elevated
    >
      <q-tabs
        align="left"
        active-bg-color="black"
        active-color="white"
      >
        <q-route-tab
          to="/preview"
          label="预览"
        />
        <q-route-tab
          v-for="tab in extraTabs"
          :key="tab.name"
          :to="`/${tab.name}`"
          :label="tab.title"
        />
      </q-tabs>
    </q-header>

    <q-drawer
      :v-model="canvasSettings.initialized"
      show-if-above
      side="right"
      bordered
      :width="drawerWidth"
    >
      <SideBar />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
