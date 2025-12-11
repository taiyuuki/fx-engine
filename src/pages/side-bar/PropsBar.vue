<script setup lang="ts">
import ImageProps from './ImageProps.vue'
import EffectProps from './EffectProps.vue'
import MaskProps from './MaskProps.vue'
import { currentImage, propBarDisplay } from './composibles'
</script>

<template>
  <div>
    <ImageProps v-if="currentImage && propBarDisplay === 'imageProps'" />
    <EffectProps
      v-else-if="propBarDisplay === 'effectProps'"
    />
    <MaskProps
      v-else-if="propBarDisplay === 'maskProps'"
    />
  </div>
</template>
