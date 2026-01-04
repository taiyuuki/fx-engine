<script setup lang="ts">
import { currentMask, maskInfo } from 'src/composibles/mask'
import { currentEffect, maskCanvasRef, maskControls, propBarDisplay } from './composibles'

const props = defineProps<{
    propName: string,
    bindingIndex: number,
    propertyIndex: number,
    propertyKey: string,
    flowMode?: boolean
}>()
const layers = useLayers()
const showTextureDialog = ref(false)
const selectedTexture = ref<string | null>(null)

const $inputEl = useTemplateRef<HTMLInputElement>('inputTexture')

function inputCurrentImage() {
    currentMask.value = material.value
    maskInfo.value.bindingIndex = props.bindingIndex
    maskInfo.value.propertyIndex = props.propertyIndex
    maskInfo.value.refKey = props.propertyKey
    maskControls.value.flowMode = props.flowMode
    $inputEl.value?.click()
}

const material = computed(() => {

    return layers.materials.get(props.propName)!
})

function drawMask() {
    currentMask.value = material.value
    maskInfo.value.bindingIndex = props.bindingIndex
    maskInfo.value.propertyIndex = props.propertyIndex
    maskInfo.value.refKey = props.propertyKey
    maskInfo.value.flowMode = props.flowMode
    maskControls.value.flowMode = props.flowMode

    propBarDisplay.value = 'maskProps'

    nextTick(() => {
        maskControls.value.isDrawMode = true
        maskCanvasRef.value?.toggleDrawMode()
    })
}

// 应用蒙版纹理的通用函数
async function applyMaskTexture(textureData: { texture: GPUTexture; url: string; width: number; height: number }) {
    if (!currentEffect.value || !layers.renderer) return

    currentMask.value = textureData
    const maskPropertyName = maskInfo.value.refKey

    let maskName = ''
    if (currentEffect.value.isMultiPass && maskPropertyName) {

        // 多pass
        const maskConfig = currentEffect.value.getMaskConfig(maskPropertyName)

        if (maskConfig) {
            const { passName, bindingIndex } = maskConfig

            // 更新pass的资源
            const pass = currentEffect.value.passes?.find(p => p.name === passName)
            if (pass && pass.resources) {
                pass.resources[bindingIndex] = textureData.texture
                layers.renderer.updateBindGroupSetResources(passName, 'default', pass?.resources || [])
                const maskMode = maskInfo.value.flowMode ? 'flow' : 'alpha'
                maskName = `${currentEffect.value.name}.${maskMode}__mask`
            }
        }
    }
    else {

        // 单pass
        currentEffect.value.setResource(maskInfo.value.bindingIndex, textureData.texture)
        layers.renderer.updateBindGroupSetResources(currentEffect.value.name, 'default', currentEffect.value!.resources!)
        const maskMode = maskInfo.value.flowMode ? 'flow' : 'alpha'
        maskName = `${currentEffect.value.name}.${maskMode}__mask`
    }
    layers.materials.set(maskName, currentMask.value)
    currentEffect.value.refs[maskInfo.value.refKey!] = maskName

    currentEffect.value.properties[maskInfo.value.bindingIndex].defaultValue = maskName
}

async function resolveCurrentImageMask(e: Event) {
    const t = e.target as HTMLInputElement
    const file = t.files?.[0]
    if (layers.renderer && currentEffect.value && file) {
        const { texture, width, height } = await layers.renderer.loadImageTexture(file)
        const textureData = {
            url: URL.createObjectURL(file),
            texture,
            width,
            height,
        }
        await applyMaskTexture(textureData)
    }
}

function showTextureSelection() {

    // 设置当前蒙版信息
    currentMask.value = material.value
    maskInfo.value.bindingIndex = props.bindingIndex
    maskInfo.value.propertyIndex = props.propertyIndex
    maskInfo.value.refKey = props.propertyKey

    showTextureDialog.value = true
    selectedTexture.value = null
}

function confirmTextureSelection() {
    if (selectedTexture.value && layers.renderer && currentEffect.value) {
        const textureData = layers.materials.get(selectedTexture.value)
        if (textureData && textureData.texture) {
            applyMaskTexture(textureData)
        }
    }
    showTextureDialog.value = false
}

function cancelTextureSelection() {
    showTextureDialog.value = false
    selectedTexture.value = null
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
      <q-btn-dropdown
        color="primary"
        label="选择纹理"
        class="block mt-2"
      >
        <q-list>
          <q-item
            v-close-popup
            clickable
            @click="showTextureSelection"
          >
            <q-item-section>
              <q-item-label>从纹理库选择</q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            v-close-popup
            clickable
            @click="inputCurrentImage"
          >
            <q-item-section>
              <q-item-label>导入本地图片</q-item-label>
              <input
                ref="inputTexture"
                type="file"
                name="导入图片"
                class="hidden"
                @change="resolveCurrentImageMask"
              >
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>
  </div>

  <!-- 选择纹理对话框 -->
  <q-dialog
    v-model="showTextureDialog"
    persistent
  >
    <q-card style="min-width: 500px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          选择纹理作为蒙版
        </div>
        <q-space />
        <q-btn
          v-close-popup
          icon="close"
          flat
          round
          dense
          @click="cancelTextureSelection"
        />
      </q-card-section>

      <q-card-section>
        <div class="q-gutter-md">
          <q-item
            v-for="[name, texture] in layers.materials"
            :key="name"
            clickable
            :class="{ 'bg-blue-100': selectedTexture === name }"
            class="rounded-borders"
            @click="selectedTexture = name"
          >
            <q-item-section avatar>
              <q-img
                :src="texture.url"
                style="width: 60px; height: 60px"
                class="rounded-borders"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ name }}</q-item-label>
              <q-item-label caption>
                尺寸: {{ texture.width }} x {{ texture.height }}
              </q-item-label>
            </q-item-section>
            <q-item-section
              v-if="selectedTexture === name"
              side
            >
              <q-icon
                name="check"
                color="primary"
                size="sm"
              />
            </q-item-section>
          </q-item>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          label="取消"
          @click="cancelTextureSelection"
        />
        <q-btn
          color="primary"
          label="确定"
          :disable="!selectedTexture"
          @click="confirmTextureSelection"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
