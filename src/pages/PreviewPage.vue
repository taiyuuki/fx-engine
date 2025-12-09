<script setup lang="ts">
import { createWGSLRenderer } from 'wgsl-renderer'

const $q = useQuasar()
const layers = useLayers()

const pageStyle = computed(() => {
    return { height: `${$q.screen.height - 50}px` }
})

const $renderCanvas = useTemplateRef<HTMLCanvasElement>('renderCanvas')
onMounted(async() => {
    if ($renderCanvas.value) {
        layers.renderer = await createWGSLRenderer($renderCanvas.value)
    }
})
</script>

<template>
  <div
    class="w-full relative"
    :style="pageStyle"
  >
    <canvas
      ref="renderCanvas"
      width="1280"
      height="720"
      class="absolute"
    />
  </div>
</template>
