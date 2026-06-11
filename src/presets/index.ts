import type { ProjectSettings } from '../project/types'

export interface ThemePreset {
  name: string
  colors: [string, string, string]
  apply: Partial<ProjectSettings>
}

export interface EffectPreset {
  name: string
  description: string
  colors: [string, string, string]
  apply: Partial<ProjectSettings>
}

export const presets: ThemePreset[] = [
  { name: 'Minimal Dark', colors: ['#17181d', '#34363f', '#f5f5f5'], apply: { background: '#08090c', backgroundAccent: '#17181d', visualizerColor: '#f1f1f1', effect: 'none' } },
  { name: 'Neon Blue', colors: ['#050b1f', '#102b72', '#36d6ff'], apply: { background: '#030712', backgroundAccent: '#0d2862', visualizerColor: '#22d3ee', effect: 'particles' } },
  { name: 'Neon Purple', colors: ['#10071d', '#321269', '#a855f7'], apply: { background: '#090611', backgroundAccent: '#2a0f54', visualizerColor: '#a855f7', effect: 'particles' } },
  { name: 'Lo-Fi Night', colors: ['#111827', '#37306b', '#f09b8d'], apply: { background: '#090d1a', backgroundAccent: '#332659', visualizerColor: '#f3a6a0', effect: 'rain' } },
  { name: 'Retro Wave', colors: ['#160c2d', '#9c1b7b', '#ffb443'], apply: { background: '#10071e', backgroundAccent: '#70165f', visualizerColor: '#ffb238', effect: 'particles' } },
  { name: 'Gold Luxury', colors: ['#100d08', '#49381d', '#e5ba62'], apply: { background: '#090806', backgroundAccent: '#342712', visualizerColor: '#e6b95f', effect: 'particles' } },
]

export const effectPresets: EffectPreset[] = [
  { name: 'Aurora Dust', description: 'Soft multi-color particles', colors: ['#22d3ee','#8b5cf6','#f472b6'], apply: { effect: 'particles', effectColorMode: 'palette', effectColors: ['#22d3ee','#8b5cf6','#f472b6'], effectAmount: .8, effectSpeed: .65, effectSize: 1.25, effectDirection: 'up', effectOrigin: 'bottom', effectGlossy: .55, effectBeatReactive: true } },
  { name: 'Cyber Rain', description: 'Fast neon rainfall', colors: ['#22d3ee','#3b82f6','#a855f7'], apply: { effect: 'heavy-rain', effectColorMode: 'palette', effectColors: ['#22d3ee','#3b82f6','#a855f7'], effectAmount: 1.15, effectSpeed: 2.1, effectSize: .7, effectDirection: 'down-right', effectOrigin: 'top', effectGlossy: .35, effectBeatReactive: true } },
  { name: 'Rose Blizzard', description: 'Bright reactive snowstorm', colors: ['#ffffff','#f9a8d4','#c084fc'], apply: { effect: 'blizzard', effectColorMode: 'palette', effectColors: ['#ffffff','#f9a8d4','#c084fc'], effectAmount: 1.25, effectSpeed: 1.35, effectSize: 1.1, effectSizeMode: 'random', effectDirection: 'down-left', effectOrigin: 'top', effectGlossy: .7, effectBeatReactive: true } },
  { name: 'Golden Fireflies', description: 'Warm floating lights', colors: ['#fde047','#fb923c','#fef3c7'], apply: { effect: 'fireflies', effectColorMode: 'palette', effectColors: ['#fde047','#fb923c','#fef3c7'], effectAmount: .85, effectSpeed: .45, effectSize: 1.5, effectSizeMode: 'random', effectDirection: 'random', effectOrigin: 'full', effectGlossy: 1, effectBeatReactive: true } },
  { name: 'Deep Space', description: 'Slow colorful star field', colors: ['#ffffff','#60a5fa','#c084fc'], apply: { effect: 'stars', effectColorMode: 'palette', effectColors: ['#ffffff','#60a5fa','#c084fc'], effectAmount: .7, effectSpeed: .18, effectSize: 1.15, effectSizeMode: 'random', effectDirection: 'left', effectOrigin: 'full', effectGlossy: .8, effectBeatReactive: false } },
  { name: 'Prism Burst', description: 'Rainbow center explosion', colors: ['#ef4444','#22c55e','#3b82f6'], apply: { effect: 'particles', effectColorMode: 'rainbow', effectColors: ['#ef4444','#22c55e','#3b82f6'], effectAmount: 1.4, effectSpeed: 1.65, effectSize: 1.1, effectSizeMode: 'random', effectDirection: 'center-out', effectOrigin: 'center', effectGlossy: .75, effectBeatReactive: true } },
  { name: 'Ocean Mist', description: 'Layered blue fog', colors: ['#67e8f9','#38bdf8','#818cf8'], apply: { effect: 'fog', effectColorMode: 'palette', effectColors: ['#67e8f9','#38bdf8','#818cf8'], effectAmount: .65, effectSpeed: .32, effectSize: 1.65, effectSizeMode: 'random', effectDirection: 'right', effectOrigin: 'full', effectGlossy: .15, effectBeatReactive: false } },
  { name: 'Ember Drift', description: 'Rising red and gold sparks', colors: ['#facc15','#f97316','#ef4444'], apply: { effect: 'particles', effectColorMode: 'palette', effectColors: ['#facc15','#f97316','#ef4444'], effectAmount: 1, effectSpeed: .8, effectSize: .8, effectSizeMode: 'random', effectDirection: 'up', effectOrigin: 'bottom', effectGlossy: .9, effectBeatReactive: true } },
  { name: 'Icefall', description: 'Clean crystalline snowfall', colors: ['#ffffff','#bae6fd','#67e8f9'], apply: { effect: 'snow', effectColorMode: 'palette', effectColors: ['#ffffff','#bae6fd','#67e8f9'], effectAmount: .9, effectSpeed: .65, effectSize: 1.2, effectSizeMode: 'random', effectDirection: 'down', effectOrigin: 'top', effectGlossy: .55, effectBeatReactive: false } },
  { name: 'Violet Vortex', description: 'Particles pulled inward', colors: ['#f0abfc','#a855f7','#4f46e5'], apply: { effect: 'particles', effectColorMode: 'palette', effectColors: ['#f0abfc','#a855f7','#4f46e5'], effectAmount: 1.2, effectSpeed: 1.2, effectSize: 1.15, effectSizeMode: 'random', effectDirection: 'edges-in', effectOrigin: 'full', effectGlossy: .85, effectBeatReactive: true } },
]
