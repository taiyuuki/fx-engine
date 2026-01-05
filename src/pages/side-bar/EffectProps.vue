<script setup lang="ts">
import { PropertyType } from 'src/effects'
import AngleKnob from 'src/components/AngleKnob.vue'
import { currentEffect, propBarDisplay } from './composibles'
import MaskMenu from './MaskMenu.vue'

function rgbToHex(rgb: number[]): string {
    const toHex = (n: number) => {
        const hex = Math.round(n * 255).toString(16)

        return hex.length === 1 ? `0${hex}` : hex
    }

    return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

function hexToRgb(hex: string) {
    const result = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)

    return result ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 }
}
</script>

<template>
  <q-form
    class="p-5"
  >
    <q-breadcrumbs
      active-color="primary"
      class="mb-5"
    >
      <template #separator>
        <q-icon
          size="1.2em"
          name="arrow_forward"
          color="primary"
        />
      </template>

      <q-breadcrumbs-el
        label="图层"
        icon="layers"
        class="cursor-pointer select-none"
        @click="propBarDisplay = 'imageProps'"
      />
      <q-breadcrumbs-el
        label="效果"
        icon="widgets"
        class="select-none"
      />
    </q-breadcrumbs>
    <template v-if="currentEffect">
      <q-input
        v-model="currentEffect.label"
        label="效果名称"
        outlined
        dense
      />
      <template
        v-for="(p, i) in currentEffect?.properties"
        :key="p.name"
      >
        <div
          v-if="typeof p.condition === 'function' ? p.condition() : p"
          class="mb-2"
        >
          <template v-if="p.type === PropertyType.Float">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ p.label }}
              </label>
              <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                {{ currentEffect.refs[p.name] }}
              </span>
            </div>
            <q-slider
              v-model="currentEffect!.refs[p.name] as number"
              :min="p.range![0]"
              :max="p.range![1]"
              :step="p.range![2] ?? 0.01"
              class="flex-1"
              @change="currentEffect.applyUniforms(p.name)"
            />
          </template>
          <template v-if="p.type === PropertyType.Checkbox">
            <q-checkbox
              v-model="currentEffect.refs[p.name]"
              left-label
              :label="p.label"
              @update:model-value="currentEffect.applyUniforms(p.name)"
            />
          </template>
          <template v-if="p.type === PropertyType.Select">
            <div class="mb-2">
              <q-select
                v-model="currentEffect!.refs[p.name] as number"
                :options="p.options || []"
                :label="p.label"
                option-label="label"
                option-value="value"
                emit-value
                map-options
                outlined
                dense
                class="w-full"
                @update:model-value="currentEffect.applyUniforms(p.name)"
              />
            </div>
          </template>
          <template v-if="p.type === PropertyType.AlphaMask">
            <MaskMenu
              :prop-name="currentEffect.refs[p.name] as string"
              :binding-index="-p.uniformIndex[0]"
              :property-index="i"
              :property-key="p.name"
              :flow-mode="false"
            />
          </template>
          <template v-if="p.type === PropertyType.FlowMask">
            <MaskMenu
              :prop-name="currentEffect.refs[p.name] as string"
              :binding-index="-p.uniformIndex[0]"
              :property-index="i"
              :property-key="p.name"
              :flow-mode="true"
            />
          </template>
          <template v-if="p.type === PropertyType.Vec2">
            <div class="mb-3">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                {{ p.label }}
              </label>
              <div class="flex gap-4 items-center">
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-gray-500">X</span>
                    <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                      {{ (currentEffect.refs[p.name] as number[])[0].toFixed(2) }}
                    </span>
                  </div>
                  <q-slider
                    v-model="(currentEffect.refs[p.name] as number[])[0]"
                    :step="0.01"
                    :min="p.range![0]"
                    :max="p.range![1]"
                    @change="currentEffect.applyUniforms(p.name)"
                  />
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-gray-500">Y</span>
                    <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                      {{ (currentEffect.refs[p.name] as number[])[1].toFixed(2) }}
                    </span>
                  </div>
                  <q-slider
                    v-model="(currentEffect.refs[p.name] as number[])[1]"
                    :step="0.01"
                    :min="p.range![0]"
                    :max="p.range![1]"
                    @change="currentEffect.applyUniforms(p.name)"
                  />
                </div>
              </div>
            </div>
          </template>
          <template v-if="p.type === PropertyType.Color">
            <div class="mb-2">
              <q-input
                outlined
                dense
                :label="p.label"
                :model-value="rgbToHex(currentEffect.refs[p.name] as number[])"
                class="w-full"
                @update:model-value="(hex: string | number | null) => {
                  if (!hex) return
                  const colorArray = currentEffect!.refs[p.name] as number[]
                  const rgb = hexToRgb(hex.toString())
                  colorArray[0] = rgb.r / 255
                  colorArray[1] = rgb.g / 255
                  colorArray[2] = rgb.b / 255
                  currentEffect?.applyUniforms(p.name)
                }"
              >
                <template #prepend>
                  <div
                    class="w-6 h-6 cursor-pointer border-1 border-black"
                    :style="{ backgroundColor: rgbToHex(currentEffect.refs[p.name] as number[]) }"
                  >
                    <q-popup-proxy
                      cover
                      transition-show="scale"
                      transition-hide="scale"
                    >
                      <q-color
                        :model-value="rgbToHex(currentEffect.refs[p.name] as number[])"
                        @update:model-value="(hex: string | null) => {
                          if (!hex) return
                          const colorArray = currentEffect!.refs[p.name] as number[]
                          const rgb = hexToRgb(hex)
                          colorArray[0] = rgb.r / 255
                          colorArray[1] = rgb.g / 255
                          colorArray[2] = rgb.b / 255
                          currentEffect?.applyUniforms(p.name)
                        }"
                      />
                    </q-popup-proxy>
                  </div>
                </template>
              </q-input>
            </div>
          </template>
          <template v-if="p.type === PropertyType.Angle">
            <AngleKnob
              :model-value="currentEffect.refs[p.name] as number"
              :label="p.label"
              @update:model-value="(val: number) => {
                currentEffect!.refs[p.name] = val
                currentEffect?.applyUniforms(p.name)
              }"
            />
          </template>
        </div>
      </template>
    </template>
  </q-form>
</template>

<style lang="scss">
</style>
