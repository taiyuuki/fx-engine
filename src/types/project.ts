/**
 * 项目保存/加载的数据结构定义
 */

export interface ProjectData {
    version: string
    name: string
    canvas: CanvasData
    layers: LayerData[]
    materials: Record<string, MaterialData>
    createdAt: string
    modifiedAt: string
}

export interface CanvasData {
    width: number
    height: number
}

export interface LayerData {
    name: string
    url: string
    crc: string
    size: {
        width: number
        height: number
    }
    transform: {
        origin: { x: number; y: number }
        scale: { x: number; y: number }
        rotation: number
    }
    effects: EffectData[]
}

export interface EffectData {
    name: string
    type: string
    enable: boolean
    properties: Record<string, any>
    masks?: Record<string, string> // key: 蒙版属性名, value: 材质名称
}

export interface MaterialData {
    url: string
    width: number
    height: number
    type: 'alpha_mask' | 'flow_mask' | 'image'
}

export const PROJECT_VERSION = '1.0.0'
