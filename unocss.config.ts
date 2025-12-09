import {
    defineConfig,
    presetAttributify,
    presetIcons,
} from 'unocss'
import { presetWind3 } from '@unocss/preset-wind3'

export default defineConfig({
    presets: [
        presetWind3,
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
