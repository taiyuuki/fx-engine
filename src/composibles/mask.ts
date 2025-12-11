import type { Material } from 'src/stores/layers'

const currentMask = ref<Material | null>(null)

const maskInfo = ref({
    bindingIndex: -1,
    propertyIndex: -1,
    refKey: null as string | null,
})

export { currentMask, maskInfo }
