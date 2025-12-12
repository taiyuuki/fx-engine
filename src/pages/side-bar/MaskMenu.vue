<script setup lang="ts">
import { currentMask, maskInfo } from 'src/composibles/mask'
import { maskCanvasRef, maskControls, propBarDisplay } from './composibles'

const props = defineProps<{ propName: string, bindingIndex: number, propertyIndex: number }>()
const layers = useLayers()

const material = computed(() => {

    return layers.materials.get(props.propName)!
})

function drawMask() {
    currentMask.value = material.value
    maskInfo.value.bindingIndex = props.bindingIndex
    maskInfo.value.propertyIndex = props.propertyIndex
    maskInfo.value.refKey = 'alpha_mask'
    propBarDisplay.value = 'maskProps'
    // 直接进入绘制模式
    nextTick(() => {
        maskControls.value.isDrawMode = true
        maskCanvasRef.value?.toggleDrawMode()
    })
}
</script>

<template>
  <div
    v-if="material"
    class="flex gap-2"
  >
    <q-img
      :src="material.url"
      spinner-color="white"
      class="w-[80px] h-[80px] border-2 border-solid"
    />
    <div>
      <q-btn
        color="primary"
        label="绘制蒙版"
        @click="drawMask"
      />
    </div>
  </div>
</template>
