import type { BindingResource } from 'wgsl-renderer'

enum PropertyType {
    Float = 'float',
    Vec2 = 'vec2',
    Color = 'color',
    Texture = 'texture',
    AlphaMask = 'alpha_mask',
    FlowMask = 'flow_mask',
    Checkbox = 'checkbox',
    Array = 'array',
    Select = 'select',
}

interface PropertyValueMap {
    [PropertyType.Float]: number;
    [PropertyType.Vec2]: [number, number];
    [PropertyType.Color]: [number, number, number];
    [PropertyType.Texture]: string;
    [PropertyType.AlphaMask]: string;
    [PropertyType.FlowMask]: string;
    [PropertyType.Checkbox]: boolean;
    [PropertyType.Array]: number[];
    [PropertyType.Select]: number;
}

type PropertyValue<T extends PropertyType> = PropertyValueMap[T]

type SelectOption = {
    value: number
    label: string
}

type Property<P extends PropertyType> = {
    name: string
    label: string
    type: P
    defaultValue: PropertyValue<P>
    uniformIndex: [number, number] | [string, number, number] // [offset, size] 或 [passName, offset, size] for multi-pass
    range: [number, number]
    condition: boolean | ({ (): boolean })
    options?: SelectOption[] // For Select type only
} 

type PropertyList<P extends PropertyType = PropertyType> = Property<P>[]

export type Uniforms = {
    values: Float32Array;
    apply: { (): void };
    getBuffer: { (): GPUBuffer };
}

interface MaskConfig {
    passName: string; // 蒙版所在的pass名称
    bindingIndex: number; // 蒙版在pass中的binding索引
}

interface EffectOptions {
    name: string;
    label: string;
    properties: PropertyList;
    uniforms: Uniforms;
    shaderCode?: string; // 单个效果的shader代码
    passes?: EffectPassOptions[]; // 多个pass的配置
    resources?: BindingResource[]
    passUniforms?: Record<string, Uniforms>; // 多pass效果的uniform buffers
    maskConfigs?: Record<string, MaskConfig>; // 支持多个蒙版配置，key为蒙版属性名
}

interface EffectPassOptions {
    name: string
    shaderCode: string
    resources?: BindingResource[]
    view?: GPUTextureView
    format?: GPUTextureFormat
    condition?: boolean | { (): boolean }
}

type Optional<O extends object, K extends keyof O> = Omit<O, K> & Partial<Pick<O, K>>

type OptionalKey = 'condition' | 'range' | 'uniformIndex'

function createProperty<P extends PropertyType>(options: Optional<Property<P>, OptionalKey>): Property<P> {
    return Object.assign({ range: [-1, -1], uniformIndex: [-1, -1], condition: true }, options) as Property<P>
}

class Effect {
    name: string
    label: string
    properties: PropertyList
    enable: boolean = true
    uniforms: Uniforms
    shaderCode?: string
    passes?: EffectPassOptions[]
    resources: BindingResource[] | undefined
    refs: Record<string, PropertyValue<keyof PropertyValueMap>>
    isMultiPass: boolean
    passUniforms: Record<string, Uniforms> // 存储每个pass的uniform buffers
    maskConfigs?: Record<string, MaskConfig> // 支持多个蒙版配置，key为蒙版属性名

    constructor(options: EffectOptions) {
        this.name = options.name
        this.label = options.label
        this.properties = options.properties
        this.uniforms = options.uniforms
        this.shaderCode = options.shaderCode
        this.passes = options.passes
        this.resources = options.resources
        this.isMultiPass = !!options.passes && options.passes.length > 0
        this.passUniforms = options.passUniforms || {}
        this.maskConfigs = options.maskConfigs

        this.refs = {}

        for (const k in this.properties) {
            const p = this.properties[k]!
            this.refs[p.name] = p.defaultValue
            this._setUniform(p)
        }

        // Don't apply uniforms in constructor - let calling code handle timing
    }

    private _setUniform(p: Property<PropertyType>) {
        const uniformIndex = p.uniformIndex
        let targetUniforms: Uniforms
        let offset: number

        if (uniformIndex.length === 3) {

            const [passName, passOffset] = uniformIndex as [string, number, number]
            const foundUniforms = this.passUniforms[passName]
            if (!foundUniforms) {
                console.warn(`Pass "${passName}" uniform buffer not found for property "${name}"`)

                return
            }
            targetUniforms = foundUniforms
            offset = passOffset
        }
        else {

            // 单pass格式: [offset, size]
            targetUniforms = this.uniforms
            offset = (uniformIndex as [number, number])[0]
        }

        switch (p?.type) {
            case PropertyType.Float:
                targetUniforms.values[offset] = this.refs[p.name] as number
                break
            case PropertyType.Checkbox:
                targetUniforms.values[offset] = this.refs[p.name] ? 1.0 : 0.0
                break
            case PropertyType.Select:
                targetUniforms.values[offset] = this.refs[p.name] as number
                break
            default:
                return
        }
        targetUniforms.apply()
    }

    applyUniforms(name: string) {
        const p = this.properties.find(p => p.name === name)
        if (!p) return

        this._setUniform(p)
    }

    setResources(resources: BindingResource[]) {
        this.resources = resources
    }

    setResource(index: number, resource: BindingResource, passName?: string) {
        if (passName) {
            const pass = this.passes?.find(p => p.name === passName)
            if (pass?.resources) {
                pass.resources[index] = resource
            }
        }
        else if (this.resources) {
            this.resources[index] = resource
        }
    }

    // 获取所有可用的passes
    getPassOptionsList(): EffectPassOptions[] {

        if (!this.isMultiPass || !this.passes) {

            // 单个pass模式
            if (this.shaderCode) {

                return [{
                    name: this.name,
                    shaderCode: this.shaderCode,
                    resources: this.resources || [],
                }]
            }

            return []
        }

        return this.passes
    }

    // 检查是否有指定的pass
    hasPass(passName: string): boolean {
        if (!this.isMultiPass || !this.passes) return false
        const pass = this.passes.find(p => p.name === passName)
        if (!pass) return false

        // 检查条件
        if (typeof pass.condition === 'boolean') {
            return pass.condition
        }
        if (typeof pass.condition === 'function') {
            return pass.condition()
        }

        return true
    }

    // 获取指定蒙版属性名的配置
    getMaskConfig(maskPropertyName: string): MaskConfig | undefined {
        return this.maskConfigs?.[maskPropertyName]
    }
}

export {
    PropertyType,
    Effect,
    createProperty,
}

export type {
    PropertyValue,
    Property, PropertyList,
    EffectPassOptions,
    SelectOption,
}
