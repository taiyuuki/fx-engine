/**
 * 效果配置
 * 集中管理所有效果的类型、标签和映射关系
 */

export interface EffectConfig {
    id: string
    label: string

    // 加载项目时使用的中文名称映射
    chineseLabels: string[]
}

/**
 * 所有效果的配置列表
 */
export const EFFECTS_CONFIG: EffectConfig[] = [
    {
        id: 'cursor-ripple',
        label: '光标波纹',
        chineseLabels: ['光标波纹', '光标涟漪'],
    },
    {
        id: 'water-ripple',
        label: '水波纹',
        chineseLabels: ['水波纹'],
    },
    {
        id: 'reflection',
        label: '反射',
        chineseLabels: ['反射'],
    },
    {
        id: 'refraction',
        label: '折射',
        chineseLabels: ['折射'],
    },
    {
        id: 'cloud-motion',
        label: '云朵移动',
        chineseLabels: ['云朵移动', '云动'],
    },
    {
        id: 'depthparallax',
        label: '深度视差',
        chineseLabels: ['深度视差'],
    },
    {
        id: 'iris-movement',
        label: '虹膜移动',
        chineseLabels: ['虹膜移动', '眼球移动'],
    },
    {
        id: 'shake',
        label: '摇动',
        chineseLabels: ['摇动'],
    },
    {
        id: 'tint',
        label: '染色',
        chineseLabels: ['染色', '着色'],
    },
    {
        id: 'scroll',
        label: '滚动',
        chineseLabels: ['滚动'],
    },
    {
        id: 'waterwaves',
        label: '波浪',
        chineseLabels: ['波浪', '水波'],
    },
    {
        id: 'water-flow',
        label: '水流',
        chineseLabels: ['水流'],
    },
]

/**
 * 中文名称到效果 ID 的映射（用于加载项目）
 */
export const CHINESE_LABEL_TO_ID: Record<string, string> = EFFECTS_CONFIG.reduce((acc, effect) => {
    for (const label of effect.chineseLabels) {
        acc[label] = effect.id
    }

    return acc
}, {} as Record<string, string>)

/**
 * 获取效果配置
 */
export function getEffectConfig(id: string): EffectConfig | undefined {
    return EFFECTS_CONFIG.find(e => e.id === id)
}

/**
 * 根据中文名称获取效果 ID
 */
export function getEffectIdByChineseLabel(label: string): string | undefined {
    return CHINESE_LABEL_TO_ID[label]
}
