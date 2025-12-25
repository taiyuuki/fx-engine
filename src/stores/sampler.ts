import type { WGSLRenderer } from 'wgsl-renderer'

type SamplerType = 'high-quality' | 'linear-mipmap' | 'linear' | 'nearest' | 'repeat'

const useSamplerStore = defineStore('sampler', {
    state: () => ({ samplers: new Map<string, GPUSampler>() }),
    actions: {
        getSampler(key: SamplerType, renderer: WGSLRenderer): GPUSampler {
            if (this.samplers.has(key)) {
                return this.samplers.get(key)!
            }

            let samplerDescriptor: GPUSamplerDescriptor

            switch (key) {
                case 'linear':
                    samplerDescriptor = {
                        magFilter: 'linear',
                        minFilter: 'linear',
                        mipmapFilter: 'linear',
                        addressModeU: 'clamp-to-edge',
                        addressModeV: 'clamp-to-edge',
                        addressModeW: 'clamp-to-edge',
                    }
                    break
                case 'nearest':
                    samplerDescriptor = {
                        magFilter: 'nearest',
                        minFilter: 'nearest',
                        mipmapFilter: 'nearest',
                        addressModeU: 'clamp-to-edge',
                        addressModeV: 'clamp-to-edge',
                        addressModeW: 'clamp-to-edge',
                    }
                    break
                case 'linear-mipmap':
                    samplerDescriptor = {
                        magFilter: 'linear',
                        minFilter: 'linear',
                        mipmapFilter: 'linear',
                        maxAnisotropy: 16,
                        addressModeU: 'clamp-to-edge',
                        addressModeV: 'clamp-to-edge',
                        addressModeW: 'clamp-to-edge',
                    }
                    break
                case 'high-quality':
                    samplerDescriptor = {
                        magFilter: 'linear',
                        minFilter: 'linear',
                        mipmapFilter: 'linear',
                        maxAnisotropy: 16,
                        lodMinClamp: 0,
                        lodMaxClamp: 1000,
                        addressModeU: 'clamp-to-edge',
                        addressModeV: 'clamp-to-edge',
                        addressModeW: 'clamp-to-edge',
                    }
                    break
                case 'repeat':
                    samplerDescriptor = {
                        magFilter: 'linear',
                        minFilter: 'linear',
                        mipmapFilter: 'linear',
                        addressModeU: 'repeat',
                        addressModeV: 'repeat',
                        addressModeW: 'repeat',
                    }
                    break
                default:
                    samplerDescriptor = {
                        magFilter: 'linear',
                        minFilter: 'linear',
                        mipmapFilter: 'linear',
                        addressModeU: 'clamp-to-edge',
                        addressModeV: 'clamp-to-edge',
                        addressModeW: 'clamp-to-edge',
                    }
            }

            const sampler = renderer.getDevice().createSampler(samplerDescriptor)
            this.samplers.set(key, sampler)

            return sampler
        },
    },
})

export { useSamplerStore }
