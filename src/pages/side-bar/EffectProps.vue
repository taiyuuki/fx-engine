<script setup lang="ts">
import { PropertyType } from 'src/effects'
import { currentEffect, propBarDisplay } from './composibles'
import MaskMenu from './MaskMenu.vue'
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
              :step="0.01"
              :min="p.range![0]"
              :max="p.range![1]"
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
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                {{ p.label }}
              </label>
              <q-select
                v-model="currentEffect!.refs[p.name] as number"
                :options="p.options || []"
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
        </div>
      </template>
    </template>
  </q-form>
</template>

<style lang="scss">
</style>
