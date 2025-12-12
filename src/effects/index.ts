import type { BindingResource, RenderPassOptions } from 'wgsl-renderer'

enum PropertyType {
    Float = 'float',
    Vec2 = 'vec2',
    Color = 'color',
    Texture = 'texture',
    AlphaMask = 'alpha_mask',
    Checkbox = 'checkbox',
    Array = 'array',
}

interface PropertyValueMap {
    [PropertyType.Float]: number;
    [PropertyType.Vec2]: [number, number];
    [PropertyType.Color]: [number, number, number];
    [PropertyType.Texture]: string;
    [PropertyType.AlphaMask]: string;
    [PropertyType.Checkbox]: boolean;
    [PropertyType.Array]: number[];
}

type PropertyValue<T extends PropertyType> = PropertyValueMap[T]

type Property<P extends PropertyType> = {
    name: string
    label: string
    type: P
    defaultValue: PropertyValue<P>
    uniformIndex: [number, number] // [offset, size]
    range: [number, number]
    condition: boolean | ({ (): boolean })
} 

type PropertyList<P extends PropertyType = PropertyType> = Property<P>[]

type Uniforms = {
    values: Float32Array;
    apply: { (): void };
    getBuffer: { (): GPUBuffer };
}

interface EffectOptions {
    name: string;
    label: string;
    properties: PropertyList;
    uniforms: Uniforms;
    shaderCode: string;
    resources?: BindingResource[]
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
    shaderCode: string
    resources: BindingResource[] | undefined
    refs: Record<string, PropertyValue<keyof PropertyValueMap>>

    constructor(options: EffectOptions) {
        this.name = options.name
        this.label = options.label
        this.properties = options.properties
        this.uniforms = options.uniforms
        this.shaderCode = options.shaderCode
        this.resources = options.resources

        this.refs = {}

        for (const k in this.properties) {
            const p = this.properties[k]!
            this.refs[p.name] = p.defaultValue
        }
        console.log(this.refs)
    }

    applyUniforms(name: string) {
        const p = this.properties.find(p => p.name === name)
        switch (p?.type) {
            case PropertyType.Float:
                this.uniforms.values[p.uniformIndex[0]] = this.refs[name] as number
                break
            case PropertyType.Checkbox:
                this.uniforms.values[p.uniformIndex[0]] = this.refs[name] ? 1.0 : 0.0
                break
        }
        this.uniforms.apply()
    }

    setResources(resources: BindingResource[]) {
        this.resources = resources
    }

    setResource(index: number, resource: BindingResource) {
        if (this.resources) {
            this.resources[index] = resource
        }
    }

    getPassOptions(): RenderPassOptions {
        return {
            name: this.name,
            shaderCode: this.shaderCode,
            resources: this.resources || [],
            bindGroupSets: { default: this.resources || [] },
        }
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
}
