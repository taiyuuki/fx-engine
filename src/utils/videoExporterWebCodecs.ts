/**
 * 使用 WebCodecs API + webm-muxer 的视频导出工具类
 */

import type { WGSLRenderer } from 'wgsl-renderer'
import { RenderMode } from 'wgsl-renderer'
import { ArrayBufferTarget, Muxer } from 'webm-muxer'

export interface ExportOptionsWebCodecs {
    fps: number
    duration: number // 秒
    onProgress?: { (progress: number): void }
    updateFrameCallbacks?: { (t: number): void }[] // 每帧更新回调
}

/**
 * 使用 VideoEncoder 直接编码视频帧，使用实际时间戳
 */
export class VideoExporterWebCodecs {
    private renderer: WGSLRenderer
    private width: number
    private height: number
    private encoder: VideoEncoder | null = null
    private muxer: Muxer<ArrayBufferTarget> | null = null
    private isRecording = false
    private updateFrameCallbacks: { (t: number): void }[] = []

    constructor(renderer: WGSLRenderer, width: number, height: number) {
        this.renderer = renderer
        this.width = width
        this.height = height
    }

    /**
     * 开始录制视频
     */
    async start(options: ExportOptionsWebCodecs): Promise<void> {
        const { fps, duration, onProgress, updateFrameCallbacks = [] } = options
        const totalFrames = fps * (duration + 1)
        this.updateFrameCallbacks = updateFrameCallbacks

        // 停止正常渲染循环
        this.renderer.stopLoop()

        // 设置渲染模式为EXPORT模式
        this.renderer.setRenderMode(RenderMode.EXPORT)

        // 创建 WebM muxer
        this.muxer = new Muxer<ArrayBufferTarget>({
            target: new ArrayBufferTarget(),
            video: {
                codec: 'V_VP9',
                width: this.width,
                height: this.height,
            },

            // 自动偏移时间戳，使第一个帧的时间戳为0
            firstTimestampBehavior: 'offset',
        })

        // 检查 VideoEncoder 支持
        const support = await VideoEncoder.isConfigSupported({
            codec: 'vp09.00.10.08',
            width: this.width,
            height: this.height,
            bitrate: 8000000,
            framerate: fps,
        })

        if (!support.supported) {
            throw new Error('VP9 codec not supported')
        }

        // 创建 VideoEncoder
        this.encoder = new VideoEncoder({
            output: (chunk: EncodedVideoChunk) => {

                // 将编码的 chunk 添加到 muxer（chunk 已包含时间戳）
                this.muxer?.addVideoChunk(chunk)
            },
            error: (e: Error) => {
                console.error('VideoEncoder error:', e)
            },
        })

        this.encoder.configure({
            codec: 'vp09.00.10.08',
            width: this.width,
            height: this.height,
            bitrate: 8000000,
            framerate: fps,
        })

        this.isRecording = true

        // 逐帧渲染和编码
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            if (!this.isRecording) break

            // 计算虚拟时间，使动画速度正常（毫秒）
            const virtualTime = frameIndex / fps * 1000

            // 手动调用每帧更新回调（更新uniforms），传入虚拟时间
            this.updateFrameCallbacks.forEach(callback => callback(virtualTime))

            // 渲染一帧
            this.renderer.renderFrame()

            // 等待GPU完成渲染
            await this.renderer.getDevice().queue.onSubmittedWorkDone()

            // 从 outputTexture 读取像素数据
            const pixelData = await this.renderer.captureFrameFast()

            // 创建 VideoFrame，使用计算的时间戳确保视频时长正确
            // 时间戳单位是微秒，frameIndex / fps * 1_000_000
            const timestamp = frameIndex / fps * 1_000_000

            const videoFrame = new VideoFrame(pixelData, {
                timestamp: timestamp,
                format: 'BGRA',
                codedWidth: this.width,
                codedHeight: this.height,
            })

            // 编码帧
            this.encoder.encode(videoFrame, { keyFrame: frameIndex % 30 === 0 })

            // 关闭 VideoFrame
            videoFrame.close()

            // 更新进度
            const progress = (frameIndex + 1) / totalFrames
            onProgress?.(progress)
        }

        // 等待所有编码完成
        await this.encoder.flush()
    }

    /**
     * 停止录制并返回视频Blob
     */
    async stop(): Promise<Blob> {
        this.isRecording = false

        // 恢复正常渲染模式
        this.renderer.setRenderMode('normal' as RenderMode)

        if (!this.muxer) {
            return new Blob()
        }

        // 完成 muxing
        this.muxer.finalize()
        const buffer = this.muxer.target.buffer

        this.encoder = null
        this.muxer = null

        // 返回 WebM 格式
        return new Blob([buffer], { type: 'video/webm;codecs=vp9' })
    }

    /**
     * 取消录制
     */
    cancel(): void {
        this.isRecording = false
        this.encoder?.close()
        this.encoder = null
        this.muxer = null

        // 恢复正常渲染模式
        this.renderer.setRenderMode('normal' as RenderMode)
    }

    /**
     * 下载视频文件
     */
    static download(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }
}
