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

class Effect {
    constructor(public name: string, public properties: PropertyList, public uniforms: Uniforms) {}

    applyUniforms() {
        this.uniforms.apply()
    }
}

export { Effect }

export type { PropertyType, PropertyValue, Property, PropertyList }
