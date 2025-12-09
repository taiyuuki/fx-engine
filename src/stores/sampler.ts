import type { WGSLRenderer } from 'wgsl-renderer'

const useSamplerStore = defineStore('sampler', {
    state: () => ({ samplers: new Map<string, GPUSampler>() }),
    actions: {
        getSampler(key: 'linear' | 'nearest', renderer: WGSLRenderer): GPUSampler {
            if (this.samplers.has(key)) {
                return this.samplers.get(key)!
            }
            const sampler = renderer.getDevice().createSampler({
                magFilter: key === 'linear' ? 'linear' : 'nearest',
                minFilter: key === 'linear' ? 'linear' : 'nearest',
                mipmapFilter: key === 'linear' ? 'linear' : 'nearest',
                addressModeU: 'repeat',
                addressModeV: 'repeat',
                addressModeW: 'repeat',
            })
            this.samplers.set(key, sampler)

            return sampler
        },
    },
})

export { useSamplerStore }
