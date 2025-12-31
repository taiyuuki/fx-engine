<script setup lang="ts">
interface Props {
    modelValue: number
    label: string
    min?: number
    max?: number
}

interface Emits { 'update:modelValue': [value: number] }

const props = withDefaults(defineProps<Props>(), {
    min: 0,
    max: 360,
})

const emit = defineEmits<Emits>()

// Knob dragging state
const isDragging = ref(false)
const knobCenterX = ref(0)
const knobCenterY = ref(0)
const knobRef: Ref<HTMLElement | null> = ref(null)

function onKnobMouseDown(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    knobCenterX.value = rect.left + rect.width / 2
    knobCenterY.value = rect.top + rect.height / 2

    isDragging.value = true

    document.addEventListener('mousemove', onKnobMouseMove)
    document.addEventListener('mouseup', onKnobMouseUp)
    event.preventDefault()
}

function onKnobMouseMove(event: MouseEvent) {
    if (!isDragging.value) return

    // Calculate angle from knob center to mouse position
    const dx = event.clientX - knobCenterX.value
    const dy = event.clientY - knobCenterY.value

    // atan2 returns angle in radians, -π to π
    // We need to convert to degrees and adjust so:
    // 0° = up, 90° = right, 180° = down, 270° = left
    let angle = Math.atan2(dy, dx) * 180 / Math.PI

    // Adjust: atan2 0° is right, we want 0° to be up
    // So we add 90° to shift: right(0°) → up(90°)
    angle = angle + 90

    // Normalize to 0-360
    if (angle < 0) angle += 360

    // Clamp to min/max
    angle = Math.max(props.min, Math.min(props.max, angle))

    emit('update:modelValue', angle)
}

function onKnobMouseUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', onKnobMouseMove)
    document.removeEventListener('mouseup', onKnobMouseUp)
}

function onInputChange(value: string | number | null) {
    const num = typeof value === 'string' ? Number.parseFloat(value) : value
    if (!Number.isNaN(num as number) && num !== null && num >= props.min && num <= props.max) {
        emit('update:modelValue', num as number)
    }
}
</script>

<template>
  <div class="mb-3">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
      {{ label }}
    </label>
    <div class="flex items-center gap-4">
      <!-- Knob control -->
      <div
        ref="knobRef"
        class="relative w-16 h-16 flex-shrink-0 cursor-grab select-none"
        :class="{ 'cursor-grabbing': isDragging }"
        @mousedown="onKnobMouseDown"
      >
        <svg
          class="w-full h-full"
          viewBox="0 0 64 64"
        >
          <!-- Background circle (full 360°) -->
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            class="text-gray-200 dark:text-gray-700"
            stroke-width="5"
          />
          <!-- Value arc - shows progress around full circle -->
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            class="text-primary"
            stroke-width="5"
            stroke-dasharray="175.93 175.93"
            :stroke-dashoffset="175.93 - modelValue / 360 * 175.93"
            stroke-linecap="butt"
            transform="rotate(-90, 32, 32)"
          />
          <!-- Indicator line - points in actual scroll direction -->
          <!-- 0° = up, 90° = right, 180° = down, 270° = left -->
          <line
            x1="32"
            y1="32"
            :x2="32 + 24 * Math.sin(modelValue * Math.PI / 180)"
            :y2="32 - 24 * Math.cos(modelValue * Math.PI / 180)"
            stroke="currentColor"
            class="text-primary"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <!-- Center dot -->
          <circle
            cx="32"
            cy="32"
            r="3.5"
            fill="currentColor"
            class="text-primary"
          />
        </svg>
      </div>
      <!-- Value display and input -->
      <div class="flex-1 flex items-center gap-2">
        <q-input
          :model-value="Math.round(modelValue)"
          type="number"
          outlined
          dense
          class="w-20"
          :min="min"
          :max="max"
          @update:model-value="onInputChange"
        />
        <span class="text-sm text-gray-500">°</span>
      </div>
    </div>
  </div>
</template>
