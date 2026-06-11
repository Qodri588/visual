export type VisualizerType =
  | 'bars' | 'mirrored-bars' | 'classic-led' | 'line' | 'waveform'
  | 'radial' | 'radial-inverse' | 'circular-wave' | 'snow-spectrum' | 'dots'
export type EffectType = 'none' | 'rain' | 'heavy-rain' | 'snow' | 'blizzard' | 'particles' | 'fog' | 'stars' | 'fireflies'
export type ImageReactiveEffect = 'none' | 'scale' | 'pulse' | 'bounce' | 'shake' | 'tilt' | 'glow' | 'blur' | 'hue' | 'contrast'
export type BackgroundReactiveEffect = 'none' | 'zoom' | 'pulse' | 'shake' | 'blur' | 'hue' | 'glow' | 'brightness' | 'saturate'
export type SpectrumColorMode = 'solid' | 'gradient' | 'rainbow'
export type SpectrumEffect = 'none' | 'zoom' | 'pulse' | 'bounce' | 'wave' | 'flicker' | 'glossy' | 'neon'
export type ReactiveSource = 'bass' | 'mid' | 'full'
export type MediaTransition = 'none' | 'fade' | 'slide' | 'zoom' | 'dissolve'
export type EffectDirection = 'random' | 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | 'center-out' | 'edges-in'
export type EffectOrigin = 'random' | 'top' | 'bottom' | 'left' | 'right' | 'center' | 'full'
export type EffectSizeMode = 'fixed' | 'random'
export type EffectColorMode = 'solid' | 'palette' | 'rainbow'
export interface BackgroundAsset {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  opacity: number
  fit: 'inherit' | 'cover' | 'contain' | 'stretch'
  duration: number
  playbackRate: number
  seamlessLoop: boolean
  loopTransitionDuration: number
  zoom: number
  cropX: number
  cropY: number
}

export interface Layer {
  id: string
  name: string
  kind: 'media' | 'effect' | 'cover' | 'spectrum' | 'text'
  visible: boolean
  locked: boolean
  opacity: number
  x: number
  y: number
  scale: number
  rotation: number
}

export interface ProjectSettings {
  title: string
  artist: string
  album: string
  resolution: string
  fps: 30 | 60
  background: string
  backgroundAccent: string
  visualizerColor: string
  visualizerColorSecondary: string
  spectrumColorMode: SpectrumColorMode
  spectrumEffect: SpectrumEffect
  spectrumEffectAmount: number
  spectrumEffectSpeed: number
  spectrumReactiveSource: ReactiveSource
  visualizerType: VisualizerType
  effect: EffectType
  bars: number
  sensitivity: number
  smoothing: number
  glow: number
  coverShape: 'circle' | 'rounded' | 'square'
  coverRotation: boolean
  beatScale: boolean
  imageReactiveEffect: ImageReactiveEffect
  imageReactionAmount: number
  backgroundImageOpacity: number
  backgroundImageBlur: number
  backgroundReactiveEffect: BackgroundReactiveEffect
  backgroundReactionAmount: number
  backgroundMediaFit: 'cover' | 'contain' | 'stretch'
  backgroundMediaDuration: number
  backgroundTransition: MediaTransition
  backgroundTransitionDuration: number
  backgroundPlaylistLoop: boolean
  exportIncludeAudio: boolean
  exportQuality: 'standard' | 'high'
  exportFileName: string
  exportStartTime: number
  exportEndTime: number
  spectrumWidth: number
  spectrumHeight: number
  spectrumGap: number
  spectrumBarThickness: number
  mirrorSpectrum: boolean
  effectAmount: number
  effectSpeed: number
  effectSize: number
  effectDirection: EffectDirection
  effectOrigin: EffectOrigin
  effectOpacity: number
  effectGlossy: number
  effectSizeMode: EffectSizeMode
  effectBeatReactive: boolean
  effectReactiveSource: ReactiveSource
  effectColorMode: EffectColorMode
  effectColors: [string, string, string]
  videoOpacity: number
  videoPlaybackRate: number
  layers: Layer[]
}

export const defaultProject: ProjectSettings = {
  title: 'Midnight Memories',
  artist: 'The Cassette Dreams',
  album: 'After Hours',
  resolution: '1920 x 1080',
  fps: 60,
  background: '#090b12',
  backgroundAccent: '#101a2f',
  visualizerColor: '#8b5cf6',
  visualizerColorSecondary: '#22d3ee',
  spectrumColorMode: 'solid',
  spectrumEffect: 'none',
  spectrumEffectAmount: 0.35,
  spectrumEffectSpeed: 1,
  spectrumReactiveSource: 'bass',
  visualizerType: 'bars',
  effect: 'none',
  bars: 72,
  sensitivity: 1.1,
  smoothing: 0.78,
  glow: 18,
  coverShape: 'rounded',
  coverRotation: false,
  beatScale: false,
  imageReactiveEffect: 'none',
  imageReactionAmount: 0.35,
  backgroundImageOpacity: 1,
  backgroundImageBlur: 0,
  backgroundReactiveEffect: 'none',
  backgroundReactionAmount: 0.3,
  backgroundMediaFit: 'cover',
  backgroundMediaDuration: 8,
  backgroundTransition: 'none',
  backgroundTransitionDuration: 1.2,
  backgroundPlaylistLoop: true,
  exportIncludeAudio: true,
  exportQuality: 'standard',
  exportFileName: 'studio-visualizer',
  exportStartTime: 0,
  exportEndTime: 0,
  spectrumWidth: 0.62,
  spectrumHeight: 92,
  spectrumGap: 3,
  spectrumBarThickness: 1.2,
  mirrorSpectrum: false,
  effectAmount: 0.75,
  effectSpeed: 1,
  effectSize: 1,
  effectDirection: 'random',
  effectOrigin: 'random',
  effectOpacity: 1,
  effectGlossy: 0,
  effectSizeMode: 'fixed',
  effectBeatReactive: false,
  effectReactiveSource: 'bass',
  effectColorMode: 'palette',
  effectColors: ['#8b5cf6', '#22d3ee', '#f472b6'],
  videoOpacity: 0.55,
  videoPlaybackRate: 1,
  layers: [
    { id: 'text', name: 'Track Information', kind: 'text', visible: true, locked: false, opacity: 1, x: 0.5, y: 0.86, scale: 1, rotation: 0 },
    { id: 'spectrum', name: 'Bar Spectrum', kind: 'spectrum', visible: true, locked: false, opacity: 1, x: 0.5, y: 0.745, scale: 1, rotation: 0 },
    { id: 'cover', name: 'Album Cover', kind: 'cover', visible: true, locked: false, opacity: 1, x: 0.5, y: 0.42, scale: 1, rotation: 0 },
    { id: 'particles', name: 'Floating Particles', kind: 'effect', visible: true, locked: false, opacity: 0.72, x: 0.5, y: 0.5, scale: 1, rotation: 0 },
    { id: 'media', name: 'Media Playlist', kind: 'media', visible: true, locked: true, opacity: 1, x: 0.5, y: 0.5, scale: 1, rotation: 0 },
  ],
}
