import JSZip from 'jszip'
import type { EffectData, LayerData, MaterialData, ProjectData } from 'src/types/project'
import { PROJECT_VERSION } from 'src/types/project'
import type { ImageLayer, Material } from 'src/stores/layers'
import type { Effect } from 'src/effects'
import { PropertyType } from 'src/effects'

/**
 * 项目管理工具类 - 使用 JSZip 打包保存
 */
export class ProjectManager {

    /**
   * 从当前状态导出项目数据并保存为 zip 文件
   */
    static async exportProject(
        layers: ImageLayer[],
        materials: Map<string, Material>,
        canvasSettings: { width: number; height: number },
        projectName: string,
    ): Promise<void> {
        const zip = new JSZip()

        // 1. 收集所有需要保存的图片 URL
        const imageUrls = new Set<string>()

        // 收集图层图片
        for (const layer of layers) {
            if (this.isBlobUrl(layer.url)) {
                imageUrls.add(layer.url)
            }
        }

        // 收集材质图片（蒙版等）
        for (const [name, material] of materials) {

            // 跳过默认蒙版
            if (name.startsWith('defaultMask-')) {
                continue
            }
            if (this.isBlobUrl(material.url)) {
                imageUrls.add(material.url)
            }
        }

        // 2. 为每个 URL 生成唯一文件名
        const urlToFilename = new Map<string, string>()

        let fileIndex = 0
        for (const url of imageUrls) {
            const filename = `asset_${fileIndex++}.dat`
            urlToFilename.set(url, filename)
        }

        // 3. 序列化项目数据（使用原始 URL，稍后会被替换）
        const projectData: ProjectData = {
            version: PROJECT_VERSION,
            name: projectName,
            canvas: {
                width: canvasSettings.width,
                height: canvasSettings.height,
            },
            layers: layers.map(layer => this.serializeLayer(layer)),
            materials: this.serializeMaterials(materials),
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
        }

        // 4. 替换 projectData 中的 URL 为文件名
        for (const layer of projectData.layers) {
            const filename = urlToFilename.get(layer.url)
            if (filename) {
                layer.url = filename
            }
        }

        for (const material of Object.values(projectData.materials)) {
            const filename = urlToFilename.get(material.url)
            if (filename) {
                material.url = filename
            }
        }

        // 5. 添加项目 JSON 到 zip
        zip.file('project.json', JSON.stringify(projectData, null, 2))

        // 6. 从 Blob URL 获取图片数据并添加到 zip
        for (const [url, filename] of urlToFilename) {
            try {
                const response = await fetch(url)
                const blob = await response.blob()
                zip.file(filename, blob)
            }
            catch(error) {
                console.error(`Failed to fetch image: ${url}`, error)
            }
        }

        // 7. 生成 zip 文件并下载
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipUrl = URL.createObjectURL(zipBlob)

        const link = document.createElement('a')
        link.href = zipUrl
        link.download = `${projectName}.fx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(zipUrl)
    }

    /**
     * 导出HTML TODO: 导出HTML尚未实现
     */
    static async exportHTML(
        layers: ImageLayer[],
        materials: Map<string, Material>,
        canvasSettings: { width: number; height: number },
        projectName: string,
    ) {
        const zip = new JSZip()

        // 1. 压缩所有图片
        for await (const [name, material] of materials) {
            const response = await fetch(material.url)
            const blob = await response.blob()
            zip.file(name, blob)
        }

        // 2. 为每个 URL 生成唯一文件名
        const urlToFilename = new Map<string, string>()

        let fileIndex = 0
        for (const layer of layers) {
            const filename = `asset_${fileIndex++}.dat`
            urlToFilename.set(layer.url, filename)
        }

        // 3. 序列化项目数据
        const projectData: ProjectData = {
            version: PROJECT_VERSION,
            name: projectName,
            canvas: {
                width: canvasSettings.width,
                height: canvasSettings.height,
            },
            layers: layers.map(layer => this.serializeLayer(layer)),
            materials: this.serializeMaterials(materials),
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
        }

        // 4. 替换 projectData 中的 URL 为文件名
        for (const layer of projectData.layers) {
            const filename = urlToFilename.get(layer.url)
            if (filename) {
                layer.url = filename
            }
        }

    }

    /**
   * 从 zip 文件加载项目
   */
    static async loadFromFile(file: File): Promise<ProjectData> {
        const zip = await JSZip.loadAsync(file)

        // 1. 读取项目 JSON
        const projectJson = zip.file('project.json')
        if (!projectJson) {
            throw new Error('无效的项目文件：缺少 project.json')
        }

        const projectData = JSON.parse(await projectJson.async('string')) as ProjectData

        // 2. 验证版本兼容性
        if (!this.isVersionCompatible(projectData.version)) {
            throw new Error(`不兼容的项目版本: ${projectData.version}`)
        }

        // 3. 从 zip 中提取图片并创建 Blob URL
        const filenameToNewUrl = new Map<string, string>() // filename -> new Blob URL

        const files = Object.keys(zip.files)
        for (const filename of files) {

            // 跳过 JSON 文件
            if (filename === 'project.json' || filename.endsWith('.json')) {
                continue
            }

            const zipFile = zip.file(filename)!
            const blob = await zipFile.async('blob')
            const newUrl = URL.createObjectURL(blob)
            filenameToNewUrl.set(filename, newUrl)
        }

        // 4. 替换 projectData 中的 URL 为新的 Blob URL
        for (const layer of projectData.layers) {
            const newUrl = filenameToNewUrl.get(layer.url)
            if (newUrl) {
                layer.url = newUrl
            }
        }

        for (const material of Object.values(projectData.materials)) {
            const newUrl = filenameToNewUrl.get(material.url)
            if (newUrl) {
                material.url = newUrl
            }
        }

        return projectData
    }

    /**
   * 判断是否为 Blob URL
   */
    private static isBlobUrl(url: string): boolean {
        return url.startsWith('blob:')
    }

    /**
   * 序列化单个图层数据
   */
    private static serializeLayer(layer: ImageLayer): LayerData {
        return {
            name: layer.name,
            url: layer.url,
            crc: layer.crc,
            size: {
                width: layer.size.width,
                height: layer.size.height,
            },
            transform: {
                origin: { x: layer.origin.x, y: layer.origin.y },
                scale: { x: layer.scale.x, y: layer.scale.y },
                rotation: layer.rotation,
            },
            effects: layer.effects.map(effect => this.serializeEffect(effect)),
        }
    }

    /**
   * 序列化效果数据
   */
    private static serializeEffect(effect: Effect): EffectData {
        const effectData: EffectData = {
            name: effect.name,
            id: effect.id,
            label: effect.label,
            enable: effect.enable,
            properties: {},
            masks: {},
        }

        for (const property of effect.properties) {
            effectData.properties[property.name] = effect.refs[property.name]
        }

        // 序列化蒙版数据（支持多 pass 和单 pass 效果）
        for (const property of effect.properties) {
            const isAlphaMask = property.type === PropertyType.AlphaMask
            const isFlowMask = property.type === PropertyType.FlowMask

            if (isAlphaMask || isFlowMask) {
                const materialName = effect.refs[property.name]
                if (materialName && typeof materialName === 'string' && !materialName.startsWith('defaultMask-')) {
                    effectData.masks![property.name] = materialName
                }
            }
        }

        // 也处理 maskConfigs 中的蒙版（多 pass 效果）
        if (effect.maskConfigs) {
            for (const [maskName, _] of Object.entries(effect.maskConfigs)) {
                const materialName = effect.refs[maskName]
                if (materialName && typeof materialName === 'string' && !materialName.startsWith('defaultMask-')) {
                    effectData.masks![maskName] = materialName
                }
            }
        }

        // 直接使用效果 id
        effectData.id = effect.id

        return effectData
    }

    /**
   * 序列化材质数据
   */
    private static serializeMaterials(materials: Map<string, any>): Record<string, MaterialData> {
        const result: Record<string, MaterialData> = {}

        for (const [name, material] of materials) {
            if (name.startsWith('defaultMask-')) {
                continue
            }

            let type: 'alpha_mask' | 'flow_mask' | 'image' = 'image'
            if (name.includes('__mask')) {
                type = name.includes('flow') ? 'flow_mask' : 'alpha_mask'
            }

            result[name] = {
                url: material.url,
                width: material.width,
                height: material.height,
                type,
            }
        }

        return result
    }

    /**
   * 检查版本兼容性
   */
    private static isVersionCompatible(version: string): boolean {
        const current = PROJECT_VERSION.split('.').map(Number)
        const file = version.split('.').map(Number)

        return current[0] === file[0]
    }
}
