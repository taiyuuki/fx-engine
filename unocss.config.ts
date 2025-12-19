import {
    defineConfig,
    presetAttributify,
    presetIcons,
} from 'unocss'
import { presetWind4 } from '@unocss/preset-wind4'

export default defineConfig({
    presets: [
        presetWind4,
        presetAttributify({}),
        presetIcons({ autoInstall: true }),
    ],
    shortcuts: [],
    variants: [],
    
    // 确保动态图标被包含
    safelist: [],

    // 全局样式，确保图标类被正确识别
    theme: { extend: { fontFamily: { inter: ['Inter', 'sans-serif'] } } },
})
