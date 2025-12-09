import type { BandingResource, RenderPassOptions } from 'wgsl-renderer'

enum PropertyType {
    Float = 'float',
    Vec2 = 'vec2',
    Color = 'color',
    Texture = 'texture',
}

type PropertyValue<T extends PropertyType> = T extends PropertyType.Float
    ? number
    : T extends PropertyType.Vec2
        ? [number, number]
        : T extends PropertyType.Color
            ? [number, number, number]
            : T extends PropertyType.Texture
                ? string
                : never

interface Property<P extends PropertyType> {
    name: string;
    label: string;
    type: P;
    defaultValue: PropertyValue<P>;
    range: P extends PropertyType.Float ? [number, number] : never;
    uniformIndex: [number, number]; // [offset, size]
}

type PropertyList = Property<PropertyType>[]

type Uniforms = {
    values: Float32Array;
    apply: { (): void };
    getBuffer: { (): GPUBuffer };
}

interface EffectOptions {
    name: string;
    properties: PropertyList;
    uniforms: Uniforms;
    shaderCode: string;
    resources?: BandingResource[]
}

class Effect {
    name: string
    properties: PropertyList
    uniforms: Uniforms
    shaderCode: string
    resources: BandingResource[] | undefined

    constructor(options: EffectOptions) {
        this.name = options.name
        this.properties = options.properties
        this.uniforms = options.uniforms
        this.shaderCode = options.shaderCode
        this.resources = options.resources
    }

    applyUniforms() {
        this.uniforms.apply()
    }

    getPassOptions(): RenderPassOptions {
        return {
            name: this.name,
            shaderCode: this.shaderCode,
            resources: this.resources || [],
        }
    }
}

export {
    PropertyType,
    Effect, 
}

export type {
    PropertyValue,
    Property, PropertyList, 
}
