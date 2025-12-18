import type { Directive } from 'vue'

export const vZoom: Directive = {
    mounted(el, binding) {
        el._zoomWheelHandler = function(e: WheelEvent) {
            binding.value(e)
        }
        el.addEventListener('wheel', el._zoomWheelHandler, { passive: false })
    },
    unmounted(el) {
        if (el._zoomWheelHandler) {
            el.removeEventListener('wheel', el._zoomWheelHandler)
            delete el._zoomWheelHandler
        }
    },
}
