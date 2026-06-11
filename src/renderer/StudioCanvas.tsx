import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { BackgroundAsset, Layer, ProjectSettings } from '../project/types'

interface Props {
  project: ProjectSettings
  analyser: AnalyserNode | null
  audioClock: RefObject<HTMLAudioElement>
  playing: boolean
  exporting: boolean
  coverUrl: string | null
  backgroundAssets: BackgroundAsset[]
  canvasRef: RefObject<HTMLCanvasElement | null>
  exportTrackRef: RefObject<CanvasCaptureMediaStreamTrack | null>
  selectedLayer: string
  onSelectLayer: (id: string) => void
  onLayerChange: (id: string, values: Partial<Layer>) => void
}

const particles = Array.from({ length: 130 }, (_, i) => ({
  x: ((i * 47) % 100) / 100,
  y: ((i * 83) % 100) / 100,
  size: 0.6 + (i % 5) * 0.5,
  speed: 0.15 + (i % 7) * 0.04,
}))

function pathRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.closePath()
}

export default function StudioCanvas(props: Props) {
  const { project, analyser, audioClock, playing, exporting, coverUrl, backgroundAssets, canvasRef, exportTrackRef, selectedLayer, onSelectLayer, onLayerChange } = props
  const coverRef = useRef<HTMLImageElement | null>(null)
  const mediaRef = useRef<Map<string, HTMLImageElement | { videos: [HTMLVideoElement, HTMLVideoElement]; active: 0 | 1; preparing: boolean; lastFrame: HTMLCanvasElement; lastFrameAt: number }>>(new Map())
  const mediaSourcesRef = useRef<Map<string, string>>(new Map())
  const activeMediaRef = useRef('')
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({})
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const guidesRef = useRef<{ x?: number; y?: number }>({})
  const [outputWidth, outputHeight] = project.resolution.split(' x ').map(Number)
  const previewScale = Math.min(1, 1280 / (outputWidth || 1920), 720 / (outputHeight || 1080))
  const canvasWidth = exporting ? outputWidth : Math.max(1, Math.round(outputWidth * previewScale))
  const canvasHeight = exporting ? outputHeight : Math.max(1, Math.round(outputHeight * previewScale))
  const layersByKind = useMemo(() => {
    const layers = new Map<Layer['kind'], Layer>()
    for (const layer of project.layers) layers.set(layer.kind, layer)
    return layers
  }, [project.layers])
  const playlist = useMemo(() => {
    const durations = new Float64Array(backgroundAssets.length)
    let totalDuration = 0
    for (let i = 0; i < backgroundAssets.length; i += 1) {
      const asset = backgroundAssets[i]
      const duration = asset.type === 'video' ? videoDurations[asset.id] || asset.duration : asset.duration || project.backgroundMediaDuration
      durations[i] = duration
      totalDuration += duration
    }
    return { durations, totalDuration }
  }, [backgroundAssets, project.backgroundMediaDuration, videoDurations])
  const mediaSourceKey = useMemo(() => backgroundAssets.map(asset => `${asset.id}:${asset.type}:${asset.url}`).join('|'), [backgroundAssets])
  const projectRef = useRef(project)
  const backgroundAssetsRef = useRef(backgroundAssets)
  const layersByKindRef = useRef(layersByKind)
  const playlistRef = useRef(playlist)
  const selectedLayerRef = useRef(selectedLayer)
  const exportingRef = useRef(exporting)
  const playingRef = useRef(playing)
  projectRef.current = project
  backgroundAssetsRef.current = backgroundAssets
  layersByKindRef.current = layersByKind
  playlistRef.current = playlist
  selectedLayerRef.current = selectedLayer
  exportingRef.current = exporting
  playingRef.current = playing

  useEffect(() => {
    if (!coverUrl) { coverRef.current = null; return }
    const image = new Image(); image.src = coverUrl; coverRef.current = image
  }, [coverUrl])

  useEffect(() => {
    const previous = mediaRef.current
    const next = new Map<string, HTMLImageElement | { videos: [HTMLVideoElement, HTMLVideoElement]; active: 0 | 1; preparing: boolean; lastFrame: HTMLCanvasElement; lastFrameAt: number }>()
    const nextSources = new Map<string, string>()
    backgroundAssets.forEach(asset => {
      const sourceKey = `${asset.type}:${asset.url}`
      const cached = previous.get(asset.id)
      if (cached && mediaSourcesRef.current.get(asset.id) === sourceKey) {
        next.set(asset.id, cached)
        nextSources.set(asset.id, sourceKey)
        return
      }
      if (asset.type === 'image') { const image = new Image(); image.src = asset.url; next.set(asset.id, image) }
      else {
        const createVideo = () => { const video = document.createElement('video'); video.preload = 'metadata'; video.src = asset.url; video.muted = true; video.loop = false; video.playsInline = true; video.playbackRate = asset.playbackRate; video.addEventListener('loadedmetadata', () => { if (Number.isFinite(video.duration) && video.duration > 0) setVideoDurations(current => current[asset.id] === video.duration ? current : { ...current, [asset.id]: video.duration }) }); video.load(); return video }
        next.set(asset.id, { videos: [createVideo(), createVideo()], active: 0, preparing: false, lastFrame: document.createElement('canvas'), lastFrameAt: -1 })
      }
      nextSources.set(asset.id, sourceKey)
    })
    previous.forEach((media, id) => {
      if (next.get(id) === media) return
      if (!(media instanceof HTMLImageElement)) media.videos.forEach(video => { video.pause(); video.removeAttribute('src'); video.load() })
    })
    mediaRef.current = next
    mediaSourcesRef.current = nextSources
  }, [mediaSourceKey])

  useEffect(() => () => {
    mediaRef.current.forEach(media => {
      if (!(media instanceof HTMLImageElement)) media.videos.forEach(video => { video.pause(); video.removeAttribute('src'); video.load() })
    })
    mediaRef.current.clear()
    mediaSourcesRef.current.clear()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!
    const frequency = new Uint8Array(analyser?.frequencyBinCount || 1024)
    const waveform = new Uint8Array(analyser?.fftSize || 2048)
    let frame = 0
    let raf = 0
    let lastRenderTime = 0
    let ambient: CanvasGradient | null = null
    let ambientKey = ''

    const valueAt = (i: number, count: number) => frequency[Math.floor(i / count * frequency.length * 0.38)] / 255
    const render = (timestamp = performance.now()) => {
      raf = requestAnimationFrame(render)
      const project = projectRef.current
      const backgroundAssets = backgroundAssetsRef.current
      const layersByKind = layersByKindRef.current
      const playlist = playlistRef.current
      const selectedLayer = selectedLayerRef.current
      const exporting = exportingRef.current
      if (document.hidden && !exporting) return
      const targetFps = exporting || playingRef.current ? project.fps : Math.min(15, project.fps)
      const frameInterval = 1000 / targetFps
      if (lastRenderTime && timestamp - lastRenderTime < frameInterval - .5) return
      lastRenderTime = timestamp - ((timestamp - lastRenderTime) % frameInterval)
      frame += 1
      const w = canvas.width, h = canvas.height
      const mediaLayer = layersByKind.get('media')
      const effectLayer = layersByKind.get('effect')
      const cover = layersByKind.get('cover')
      const spectrum = layersByKind.get('spectrum')
      const needsWaveform = project.visualizerType === 'waveform' || project.visualizerType === 'circular-wave'
      const nextAmbientKey = `${w}:${h}:${project.visualizerColor}`
      if (!ambient || ambientKey !== nextAmbientKey) {
        ambient = ctx.createRadialGradient(w * .52, h * .42, 10, w * .52, h * .42, w * .48)
        ambient.addColorStop(0, project.visualizerColor + '2c')
        ambient.addColorStop(1, 'transparent')
        ambientKey = nextAmbientKey
      }
      if (analyser) {
        analyser.smoothingTimeConstant = project.smoothing
        analyser.getByteFrequencyData(frequency)
        if (needsWaveform) analyser.getByteTimeDomainData(waveform)
      } else {
        for (let i = 0; i < frequency.length; i += 1) frequency[i] = 35 + Math.sin(frame * .025 + i * .34) * 24 + Math.sin(i * .09) * 17
      }
      let bassTotal = 0, midTotal = 0, fullTotal = 0
      for (let i = 0; i < frequency.length; i += 1) {
        const value = frequency[i]
        fullTotal += value
        if (i < 28) bassTotal += value
        else if (i < 120) midTotal += value
      }
      const bass = bassTotal / (28 * 255)
      const mid = midTotal / (92 * 255)
      const full = fullTotal / (frequency.length * 255)

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)

      if (mediaLayer?.visible && backgroundAssets.length) {
        const audio = audioClock.current
        const elapsed = audio?.src ? audio.currentTime : performance.now() / 1000
        const { durations, totalDuration } = playlist
        const playlistTime = project.backgroundPlaylistLoop ? elapsed % totalDuration : Math.min(elapsed, totalDuration - .001)
        let currentIndex = 0, itemStart = 0
        while (currentIndex < durations.length - 1 && playlistTime >= itemStart + durations[currentIndex]) { itemStart += durations[currentIndex]; currentIndex += 1 }
        const nextIndex = project.backgroundPlaylistLoop ? (currentIndex + 1) % backgroundAssets.length : Math.min(currentIndex + 1, backgroundAssets.length - 1)
        const itemTime = playlistTime - itemStart, itemDuration = durations[currentIndex]
        const transitionProgress = project.backgroundTransition === 'none' ? 0 : Math.max(0, Math.min(1, (itemTime - (itemDuration - project.backgroundTransitionDuration)) / project.backgroundTransitionDuration))
        const currentAssetId = backgroundAssets[currentIndex].id
        const nextAssetId = transitionProgress > 0 && nextIndex !== currentIndex ? backgroundAssets[nextIndex].id : ''
        mediaRef.current.forEach((runtime, id) => {
          if (id !== currentAssetId && id !== nextAssetId && !(runtime instanceof HTMLImageElement)) {
            runtime.videos.forEach(video => { if (!video.paused) video.pause() })
          }
        })
        if (activeMediaRef.current !== currentAssetId) {
          activeMediaRef.current = currentAssetId
          const activeMedia = mediaRef.current.get(currentAssetId)
          if (activeMedia && !(activeMedia instanceof HTMLImageElement)) {
            const video = activeMedia.videos[activeMedia.active]
            const desiredTime = Number.isFinite(video.duration) && video.duration > 0 ? (itemTime * backgroundAssets[currentIndex].playbackRate) % video.duration : 0
            if (video.readyState >= 1) video.currentTime = desiredTime
          }
        }
        const drawMedia = (asset: BackgroundAsset, alpha: number, incoming: boolean) => {
          const runtime = mediaRef.current.get(asset.id); if (!runtime) return
          let media: HTMLImageElement | HTMLVideoElement = runtime instanceof HTMLImageElement ? runtime : runtime.videos[runtime.active]
          if (media instanceof HTMLVideoElement) {
            media.preload = 'auto'
            if (media.playbackRate !== asset.playbackRate) media.playbackRate = asset.playbackRate
            if (media.paused) media.play().catch(() => undefined)
            if (Number.isFinite(media.duration) && media.duration > 0) {
              const lead = Math.min(Math.max(asset.loopTransitionDuration, .35), media.duration / 3)
              const remaining = media.duration - media.currentTime
              if (remaining <= lead && !(runtime instanceof HTMLImageElement) && !runtime.preparing) {
                const standby = runtime.videos[runtime.active === 0 ? 1 : 0]
                runtime.preparing = true; standby.preload = 'auto'; standby.playbackRate = asset.playbackRate; standby.currentTime = 0
                standby.play().catch(() => { runtime.preparing = false })
              }
              if (!(runtime instanceof HTMLImageElement) && runtime.preparing) {
                const standbyIndex = runtime.active === 0 ? 1 : 0, standby = runtime.videos[standbyIndex]
                if (standby.readyState >= 2 && standby.currentTime > .04 && remaining <= .08) {
                  media.pause(); media.currentTime = 0; runtime.active = standbyIndex; runtime.preparing = false; media = standby
                }
              }
            }
          }
          const ready = media instanceof HTMLVideoElement ? media.readyState >= 2 : media.complete
          const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.width, mh = media instanceof HTMLVideoElement ? media.videoHeight : media.height
          const fallback = !(runtime instanceof HTMLImageElement) ? runtime.lastFrame : null
          if ((!ready || !mw || !mh) && (!fallback || !fallback.width)) return
          if (media instanceof HTMLVideoElement && !(runtime instanceof HTMLImageElement) && ready && mw && mh) {
            const fallbackInterval = Math.max(12, Math.round(project.fps / 2))
            if (fallback && (runtime.lastFrameAt < 0 || frame - runtime.lastFrameAt >= fallbackInterval)) {
              const fallbackScale = Math.min(1, 1920 / mw, 1080 / mh)
              const fallbackWidth = Math.max(1, Math.round(mw * fallbackScale))
              const fallbackHeight = Math.max(1, Math.round(mh * fallbackScale))
              if (fallback.width !== fallbackWidth || fallback.height !== fallbackHeight) { fallback.width = fallbackWidth; fallback.height = fallbackHeight }
              fallback.getContext('2d', { alpha: false, desynchronized: true })?.drawImage(media, 0, 0, fallbackWidth, fallbackHeight)
              runtime.lastFrameAt = frame
            }
            const desiredTime = (itemTime * asset.playbackRate) % media.duration
            const drift = Math.abs(media.currentTime - desiredTime)
            if (exporting && drift > .5 && drift < media.duration - .5) media.currentTime = desiredTime
          }
          const source = ready && mw && mh ? media : fallback!
          const sourceWidth = ready && mw ? mw : fallback!.width, sourceHeight = ready && mh ? mh : fallback!.height
          const fit = asset.fit === 'inherit' ? project.backgroundMediaFit : asset.fit
          const ratio = fit === 'stretch' ? 1 : fit === 'contain' ? Math.min(w / sourceWidth, h / sourceHeight) : Math.max(w / sourceWidth, h / sourceHeight)
          let iw = fit === 'stretch' ? w : sourceWidth * ratio, ih = fit === 'stretch' ? h : sourceHeight * ratio
          const assetZoom = asset.zoom ?? 1
          iw *= assetZoom; ih *= assetZoom
        const bgReaction = bass * project.backgroundReactionAmount
        const bgScale = project.backgroundReactiveEffect === 'zoom' ? 1 + bgReaction * .12 : project.backgroundReactiveEffect === 'pulse' ? 1 + Math.sin(frame * .12) * bgReaction * .05 : 1
          iw *= bgScale; ih *= bgScale
          ctx.save(); ctx.globalAlpha = mediaLayer.opacity * project.backgroundImageOpacity * asset.opacity * alpha
        const reactiveBlur = project.backgroundReactiveEffect === 'blur' ? bgReaction * 14 : 0
        const hue = project.backgroundReactiveEffect === 'hue' ? ` hue-rotate(${bgReaction * 240}deg) saturate(${1 + bgReaction})` : ''
        const brightness = project.backgroundReactiveEffect === 'brightness' ? ` brightness(${1 + bgReaction * 1.2})` : ''
        const saturate = project.backgroundReactiveEffect === 'saturate' ? ` saturate(${1 + bgReaction * 3})` : ''
        ctx.filter = `blur(${project.backgroundImageBlur + reactiveBlur}px)${hue}${brightness}${saturate}`
        if (project.backgroundReactiveEffect === 'glow') { ctx.shadowColor = project.visualizerColor; ctx.shadowBlur = 30 + bgReaction * 100 }
          const bgShake = project.backgroundReactiveEffect === 'shake' ? bgReaction * 18 : 0
          const cropOffsetX = Math.max(0, iw - w) * (asset.cropX ?? 0) / 2
          const cropOffsetY = Math.max(0, ih - h) * (asset.cropY ?? 0) / 2
          let dx = (w - iw) / 2 - cropOffsetX + Math.sin(frame * .8) * bgShake, dy = (h - ih) / 2 - cropOffsetY + Math.cos(frame * .65) * bgShake
          if (project.backgroundTransition === 'slide') dx += (incoming ? 1 - transitionProgress : -transitionProgress) * w
          if (project.backgroundTransition === 'zoom') { const zoom = incoming ? 1.12 - transitionProgress * .12 : 1 + transitionProgress * .08; iw *= zoom; ih *= zoom; dx = (w - iw) / 2; dy = (h - ih) / 2 }
          if (project.backgroundTransition === 'dissolve') ctx.globalAlpha *= incoming ? transitionProgress * transitionProgress : 1 - transitionProgress * transitionProgress
          if (!(runtime instanceof HTMLImageElement)) ctx.globalAlpha *= project.videoOpacity
          ctx.drawImage(source, dx, dy, iw, ih); ctx.restore()
        }
        drawMedia(backgroundAssets[currentIndex], 1 - transitionProgress, false)
        if (transitionProgress > 0 && nextIndex !== currentIndex) drawMedia(backgroundAssets[nextIndex], transitionProgress, true)
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = ambient; ctx.fillRect(0, 0, w, h)

      if (effectLayer?.visible && project.effect !== 'none') {
        let directionX = 0, directionY = 0
        if (project.effectDirection.includes('left')) directionX = -1
        else if (project.effectDirection.includes('right')) directionX = 1
        if (project.effectDirection.includes('up')) directionY = -1
        else if (project.effectDirection.includes('down')) directionY = 1
        if (directionX && directionY) { directionX *= Math.SQRT1_2; directionY *= Math.SQRT1_2 }
        const reactiveValue = project.effectReactiveSource === 'mid' ? mid : project.effectReactiveSource === 'full' ? full : bass
        const beatBoost = project.effectBeatReactive ? 1 + reactiveValue * project.effectAmount * 2 : 1
        const baseOpacity = effectLayer.opacity * project.effectOpacity * project.effectAmount * beatBoost
        ctx.save()
        ctx.shadowColor = project.effectGlossy > 0 ? '#ffffff' : 'transparent'
        ctx.shadowBlur = project.effectGlossy * 18
        particles.forEach((p, i) => {
          const effectColor = project.effectColorMode === 'rainbow'
            ? `hsl(${(i * 31 + frame * project.effectSpeed) % 360} 90% 65%)`
            : project.effectColorMode === 'palette'
              ? project.effectColors[i % project.effectColors.length]
              : project.effectColors[0]
          ctx.fillStyle = effectColor
          ctx.strokeStyle = effectColor
          let originX = p.x, originY = p.y
          let particleDirectionX = directionX, particleDirectionY = directionY
          const angle = i * 2.399963229728653
          if (project.effectDirection === 'random') {
            particleDirectionX = Math.cos(angle); particleDirectionY = Math.sin(angle)
          } else if (project.effectDirection === 'center-out') {
            originX = .5 + Math.cos(angle) * .04; originY = .5 + Math.sin(angle) * .04
            particleDirectionX = Math.cos(angle); particleDirectionY = Math.sin(angle)
          } else if (project.effectDirection === 'edges-in') {
            originX = .5 + Math.cos(angle) * .52; originY = .5 + Math.sin(angle) * .52
            particleDirectionX = -Math.cos(angle); particleDirectionY = -Math.sin(angle)
          }
          if (project.effectDirection !== 'center-out' && project.effectDirection !== 'edges-in') {
            const origin = project.effectOrigin === 'random' ? (['top','bottom','left','right','center','full'] as const)[i % 6] : project.effectOrigin
            if (origin === 'top') originY *= .12
            else if (origin === 'bottom') originY = .88 + originY * .12
            else if (origin === 'left') originX *= .12
            else if (origin === 'right') originX = .88 + originX * .12
            else if (origin === 'center') { originX = .42 + originX * .16; originY = .42 + originY * .16 }
          }
          const travel = frame * p.speed * project.effectSpeed * (project.effect === 'blizzard' ? 4 : 1) / 1000
          let x = ((originX + particleDirectionX * travel + 2) % 1) * w
          let y = ((originY + particleDirectionY * travel + 2) % 1) * h
          const size = project.effectSize * (project.effectSizeMode === 'random' ? .35 + ((i * 37) % 100) / 100 * .65 : 1)
          ctx.globalAlpha = baseOpacity * (.13 + (i % 4) * .07)
          if (project.effect === 'rain' || project.effect === 'heavy-rain') {
            const heavy = project.effect === 'heavy-rain' ? 2.4 : 1
            const length = (8 + p.size * 5) * heavy * size
            ctx.lineWidth = heavy * size
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - particleDirectionX * length, y - particleDirectionY * length); ctx.stroke(); return
          }
          if (project.effect === 'snow' || project.effect === 'blizzard') {
            x += Math.sin(frame / 30 + i) * (project.effect === 'blizzard' ? 30 : 8) * (particleDirectionY || 1)
            y += Math.cos(frame / 35 + i) * 4 * particleDirectionX
            ctx.beginPath(); ctx.arc(x, y, p.size * size * beatBoost * (project.effect === 'blizzard' ? 2 : 1.5), 0, Math.PI * 2); ctx.fill(); return
          }
          if (project.effect === 'fog') {
            ctx.globalAlpha = baseOpacity * .024; ctx.beginPath(); ctx.arc(x, y, (40 + p.size * 18) * size, 0, Math.PI * 2); ctx.fill(); return
          }
          if (project.effect === 'stars' && i % 3) return
          const pulse = project.effect === 'fireflies' ? 1 + Math.sin(frame * .05 + i) * .8 : 1
          ctx.beginPath(); ctx.arc(x, y, p.size * size * beatBoost * pulse, 0, Math.PI * 2); ctx.fill()
        })
        ctx.restore()
      }
      ctx.globalAlpha = 1

      const cx = (cover?.x ?? .5) * w, cy = (cover?.y ?? .42) * h
      let reaction = 1
      if (project.imageReactiveEffect === 'scale' || project.imageReactiveEffect === 'pulse') reaction += bass * project.imageReactionAmount
      const baseSize = 215 * (cover?.scale ?? 1) * reaction
      let coverX = cx, coverY = cy
      if (project.imageReactiveEffect === 'shake') {
        coverX += Math.sin(frame * .9) * bass * 18 * project.imageReactionAmount
        coverY += Math.cos(frame * 1.12) * bass * 12 * project.imageReactionAmount
      }
      if (project.imageReactiveEffect === 'bounce') coverY -= bass * 42 * project.imageReactionAmount
      const x = coverX - baseSize / 2, y = coverY - baseSize / 2
      if (cover?.visible) {
        ctx.save(); ctx.globalAlpha = cover.opacity
        ctx.translate(coverX, coverY)
        const reactiveTilt = project.imageReactiveEffect === 'tilt' ? Math.sin(frame * .06) * bass * project.imageReactionAmount * .35 : 0
        ctx.rotate((cover.rotation * Math.PI / 180) + (project.coverRotation ? frame * .0018 : 0) + reactiveTilt)
        ctx.translate(-coverX, -coverY)
        const glowAmount = project.imageReactiveEffect === 'glow' ? 25 + bass * 90 * project.imageReactionAmount : 28 + bass * 22
        ctx.shadowColor = project.visualizerColor; ctx.shadowBlur = glowAmount
        if (project.imageReactiveEffect === 'blur') ctx.filter = `blur(${bass * 9 * project.imageReactionAmount}px)`
        if (project.imageReactiveEffect === 'hue') ctx.filter = `hue-rotate(${bass * 260 * project.imageReactionAmount}deg) saturate(${1 + bass})`
        if (project.imageReactiveEffect === 'contrast') ctx.filter = `contrast(${1 + bass * project.imageReactionAmount * 2}) saturate(${1 + bass})`
        if (project.coverShape === 'circle') { ctx.beginPath(); ctx.arc(coverX, coverY, baseSize / 2, 0, Math.PI * 2); ctx.clip() }
        else { pathRoundedRect(ctx, x, y, baseSize, baseSize, project.coverShape === 'rounded' ? 28 : 0); ctx.clip() }
        if (coverRef.current?.complete) ctx.drawImage(coverRef.current, x, y, baseSize, baseSize)
        else {
          const coverGrad = ctx.createLinearGradient(x, y, x + baseSize, y + baseSize)
          coverGrad.addColorStop(0, project.visualizerColor); coverGrad.addColorStop(1, '#131521')
          ctx.fillStyle = coverGrad; ctx.fillRect(x, y, baseSize, baseSize)
          ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '700 58px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SV', coverX, coverY + 20)
        }
        ctx.restore()
      }

      if (spectrum?.visible) {
        const sx = spectrum.x * w, sy = spectrum.y * h, count = Math.max(16, project.bars)
        const reactiveValue = project.spectrumReactiveSource === 'mid' ? mid : project.spectrumReactiveSource === 'full' ? full : bass
        const spectrumBeat = reactiveValue * project.spectrumEffectAmount
        const effectScale = project.spectrumEffect === 'zoom' ? 1 + spectrumBeat * .18 : project.spectrumEffect === 'pulse' ? 1 + Math.sin(frame * .18 * project.spectrumEffectSpeed) * spectrumBeat * .1 : 1
        const bounceY = project.spectrumEffect === 'bounce' ? -spectrumBeat * 55 : 0
        ctx.save(); ctx.translate(sx, sy + bounceY); ctx.rotate(spectrum.rotation * Math.PI / 180); ctx.scale(spectrum.scale * effectScale, spectrum.scale * effectScale)
        ctx.globalAlpha = project.spectrumEffect === 'flicker'
          ? spectrum.opacity * (.55 + Math.abs(Math.sin(frame * .16 * project.spectrumEffectSpeed)) * .45)
          : spectrum.opacity
        ctx.shadowColor = project.visualizerColor; ctx.shadowBlur = project.glow + (project.spectrumEffect === 'neon' ? 24 + spectrumBeat * 70 : 0)
        const spectrumPaint = project.spectrumColorMode === 'gradient'
          ? (() => { const gradient = ctx.createLinearGradient(-w * project.spectrumWidth / 2, 0, w * project.spectrumWidth / 2, 0); gradient.addColorStop(0, project.visualizerColor); gradient.addColorStop(1, project.visualizerColorSecondary); return gradient })()
          : project.visualizerColor
        ctx.strokeStyle = spectrumPaint; ctx.fillStyle = spectrumPaint
        const radial = ['radial', 'radial-inverse', 'circular-wave'].includes(project.visualizerType)
        if (radial) {
          for (let i = 0; i < count; i++) {
            if (project.spectrumColorMode === 'rainbow') { const color = `hsl(${(i / count * 300 + frame * .4) % 360} 90% 62%)`; ctx.fillStyle = color; ctx.strokeStyle = color }
            const angle = i / count * Math.PI * 2 - Math.PI / 2
            const value = project.visualizerType === 'circular-wave'
              ? Math.abs((waveform[Math.floor(i / count * waveform.length)] - 128) / 128)
              : valueAt(i, count)
            const inverse = project.visualizerType === 'radial-inverse'
            const inner = baseSize * .61, length = 9 + value * project.spectrumHeight * project.sensitivity
            const start = inverse ? inner + length : inner, end = inverse ? inner : inner + length
            ctx.lineWidth = Math.max(1.5, 8 - count / 18) * project.spectrumBarThickness; ctx.beginPath()
            ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start); ctx.lineTo(Math.cos(angle) * end, Math.sin(angle) * end); ctx.stroke()
          }
        } else if (project.visualizerType === 'waveform' || project.visualizerType === 'line') {
          ctx.lineWidth = (project.visualizerType === 'line' ? 2 : 3) * project.spectrumBarThickness; ctx.beginPath()
          const samples = project.visualizerType === 'line' ? count : Math.min(420, waveform.length)
          for (let i = 0; i < samples; i++) {
            const px = (i / (samples - 1) - .5) * w * project.spectrumWidth
            const sample = project.visualizerType === 'line' ? valueAt(i, samples) * 2 - .2 : (waveform[Math.floor(i / samples * waveform.length)] - 128) / 128
            const py = -sample * project.spectrumHeight * project.sensitivity
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
          }
          ctx.stroke()
        } else {
          const span = w * project.spectrumWidth, gap = project.spectrumGap, bw = Math.max(1.5, span / count - gap)
          for (let i = 0; i < count; i++) {
            if (project.spectrumColorMode === 'rainbow') ctx.fillStyle = `hsl(${(i / count * 300 + frame * .4) % 360} 90% 62%)`
            const value = valueAt(i, count), waveBoost = project.spectrumEffect === 'wave' ? 1 + Math.sin(i * .42 + frame * .1 * project.spectrumEffectSpeed) * project.spectrumEffectAmount * .45 : 1
            const bh = (5 + value * project.spectrumHeight * project.sensitivity) * waveBoost
            const renderWidth = Math.min(span / count, bw * project.spectrumBarThickness)
            const px = -span / 2 + i * (bw + gap) + (bw - renderWidth) / 2
            if (project.visualizerType === 'classic-led') {
              const segments = Math.ceil(bh / 7)
              for (let j = 0; j < segments; j++) ctx.fillRect(px, -j * 7, renderWidth, 4)
            } else if (project.visualizerType === 'dots' || project.visualizerType === 'snow-spectrum') {
              const segments = project.visualizerType === 'snow-spectrum' ? Math.ceil(bh / 10) : 1
              for (let j = 0; j < segments; j++) { ctx.beginPath(); ctx.arc(px + renderWidth / 2, -j * 9 - 3, Math.max(1.5, renderWidth / 2), 0, Math.PI * 2); ctx.fill() }
            } else {
              const mirrored = project.visualizerType === 'mirrored-bars' || project.mirrorSpectrum
              pathRoundedRect(ctx, px, mirrored ? -bh / 2 : -bh, renderWidth, bh, renderWidth / 2); ctx.fill()
            }
          }
        }
        if (project.spectrumEffect === 'glossy') {
          const shine = ctx.createLinearGradient(0, -project.spectrumHeight, 0, project.spectrumHeight)
          shine.addColorStop(0, 'rgba(255,255,255,.75)'); shine.addColorStop(.42, 'rgba(255,255,255,.08)'); shine.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = spectrum.opacity * (.18 + spectrumBeat * .45); ctx.fillStyle = shine
          ctx.fillRect(-w * project.spectrumWidth / 2, -project.spectrumHeight * 1.4, w * project.spectrumWidth, project.spectrumHeight * 2.4)
        }
        ctx.restore()
      }

      const textLayer = layersByKind.get('text')
      if (textLayer?.visible) {
        const tx = textLayer.x * w, ty = textLayer.y * h
        ctx.save(); ctx.globalAlpha = textLayer.opacity; ctx.translate(tx, ty); ctx.rotate(textLayer.rotation * Math.PI / 180); ctx.scale(textLayer.scale, textLayer.scale)
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '600 29px Inter, sans-serif'; ctx.fillText(project.title, 0, 0)
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '400 17px Inter, sans-serif'; ctx.fillText(project.artist.toUpperCase(), 0, 36)
        ctx.restore()
      }

      const selected = project.layers.find(layer => layer.id === selectedLayer)
      if (selected && selected.visible && ['cover', 'spectrum', 'text'].includes(selected.kind)) {
        const sw = selected.kind === 'cover' ? baseSize : selected.kind === 'spectrum' ? w * project.spectrumWidth * selected.scale : 360 * selected.scale
        const sh = selected.kind === 'cover' ? baseSize : selected.kind === 'spectrum' ? Math.max(80, project.spectrumHeight * 2) * selected.scale : 75 * selected.scale
        ctx.save(); ctx.strokeStyle = '#a892ff'; ctx.lineWidth = 1; ctx.setLineDash([6, 5]); ctx.strokeRect(selected.x * w - sw / 2, selected.y * h - sh / 2, sw, sh); ctx.setLineDash([])
        for (const [hx, hy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) { ctx.fillStyle = '#fff'; ctx.fillRect(selected.x*w + hx*sw/2 - 3, selected.y*h + hy*sh/2 - 3, 6, 6) }
        ctx.restore()
      }
      if (guidesRef.current.x !== undefined || guidesRef.current.y !== undefined) {
        ctx.save(); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 5])
        if (guidesRef.current.x !== undefined) { ctx.beginPath(); ctx.moveTo(guidesRef.current.x * w, 0); ctx.lineTo(guidesRef.current.x * w, h); ctx.stroke() }
        if (guidesRef.current.y !== undefined) { ctx.beginPath(); ctx.moveTo(0, guidesRef.current.y * h); ctx.lineTo(w, guidesRef.current.y * h); ctx.stroke() }
        ctx.restore()
      }
      ctx.globalAlpha = 1; ctx.filter = 'none'
      if (exporting) exportTrackRef.current?.requestFrame()
    }
    render()
    return () => cancelAnimationFrame(raf)
  }, [analyser, audioClock, canvasRef, exportTrackRef, canvasWidth, canvasHeight])

  const pointerPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event)
    const candidates = project.layers.filter(layer => ['cover','spectrum','text'].includes(layer.kind) && layer.visible && !layer.locked)
    const hit = candidates.find(layer => {
      const dx = Math.abs(point.x - layer.x), dy = Math.abs(point.y - layer.y)
      if (layer.kind === 'cover') return dx < .11 * layer.scale && dy < .2 * layer.scale
      if (layer.kind === 'text') return dx < .2 * layer.scale && dy < .08 * layer.scale
      return dx < project.spectrumWidth * .5 * layer.scale && dy < .13 * layer.scale
    })
    if (!hit) { onSelectLayer(''); guidesRef.current = {}; return }
    onSelectLayer(hit.id); dragRef.current = { id: hit.id, dx: point.x - hit.x, dy: point.y - hit.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const point = pointerPosition(event)
    let x = Math.max(0, Math.min(1, point.x - dragRef.current.dx)), y = Math.max(0, Math.min(1, point.y - dragRef.current.dy))
    const others = project.layers.filter(layer => layer.id !== dragRef.current?.id && layer.visible && ['cover','spectrum','text'].includes(layer.kind))
    const xTargets = [0.5, ...others.map(layer => layer.x)], yTargets = [0.5, ...others.map(layer => layer.y)]
    const snapX = xTargets.reduce<number | undefined>((best, target) => Math.abs(target - x) < .012 && (best === undefined || Math.abs(target - x) < Math.abs(best - x)) ? target : best, undefined)
    const snapY = yTargets.reduce<number | undefined>((best, target) => Math.abs(target - y) < .018 && (best === undefined || Math.abs(target - y) < Math.abs(best - y)) ? target : best, undefined)
    if (snapX !== undefined) x = snapX; if (snapY !== undefined) y = snapY
    guidesRef.current = { x: snapX, y: snapY }
    onLayerChange(dragRef.current.id, { x, y })
  }

  const endDrag = () => { dragRef.current = null; guidesRef.current = {} }
  return <canvas ref={canvasRef} width={canvasWidth || 1280} height={canvasHeight || 720} className="studio-canvas interactive" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} />
}
