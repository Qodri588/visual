import { useCallback, useRef, useState } from 'react'
import {
  AudioLines, ChevronDown, CirclePlay, Copy, Download, Eye, EyeOff, FileAudio,
  FileImage, FolderOpen, GripVertical, Image, Layers3, Lock, Menu, Mic2, Minus,
  Monitor, MoreHorizontal, MousePointer2, Pause, Play, Plus, Redo2, Save, Settings2, Video,
  SlidersHorizontal, Sparkles, Square, Trash2, Type, Undo2, Upload, Volume2, WandSparkles,
  X, ZoomIn, ZoomOut,
} from 'lucide-react'
import { useAudioAnalyzer } from '../audio/useAudioAnalyzer'
import { effectPresets, presets } from '../presets'
import { defaultProject, type BackgroundAsset, type Layer, type ProjectSettings } from '../project/types'
import StudioCanvas from '../renderer/StudioCanvas'

type Tab = 'media' | 'visualizer' | 'effects' | 'text' | 'presets'

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const iconFor = (kind: Layer['kind']) => ({
  media: Video, effect: Sparkles, cover: FileImage, spectrum: AudioLines, text: Type,
}[kind])

export default function App() {
  const [project, setProject] = useState<ProjectSettings>(defaultProject)
  const [tab, setTab] = useState<Tab>('media')
  const [selectedLayer, setSelectedLayer] = useState('spectrum')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [backgroundAssets, setBackgroundAssets] = useState<BackgroundAsset[]>([])
  const [selectedBackgroundAsset, setSelectedBackgroundAsset] = useState('')
  const [zoom, setZoom] = useState(76)
  const [exporting, setExporting] = useState(false)
  const [exportPaused, setExportPaused] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [customEffectPreset, setCustomEffectPreset] = useState<Partial<ProjectSettings> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const exportTrackRef = useRef<CanvasCaptureMediaStreamTrack | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const exportCancelled = useRef(false)
  const exportCleanup = useRef<() => void>(() => undefined)
  const audioInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const bgInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const projectInput = useRef<HTMLInputElement>(null)
  const { audioRef, analyserRef, audioName, duration, currentTime, playing, loadAudio, toggle, seek, getRecordingStream } = useAudioAnalyzer()

  const patch = useCallback((values: Partial<ProjectSettings>) => setProject(p => ({ ...p, ...values })), [])
  const effectPresetKeys: (keyof ProjectSettings)[] = ['effect','effectAmount','effectSpeed','effectSize','effectDirection','effectOrigin','effectOpacity','effectGlossy','effectSizeMode','effectBeatReactive','effectReactiveSource','effectColorMode','effectColors']
  const saveCustomEffectPreset = () => setCustomEffectPreset(Object.fromEntries(effectPresetKeys.map(key => [key, project[key]])) as Partial<ProjectSettings>)
  const applyRandomEffectPreset = () => {
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
    const color = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
    patch({
      effect: pick(['particles','rain','heavy-rain','snow','blizzard','fog','stars','fireflies'] as const),
      effectAmount: .45 + Math.random() * 1.25, effectSpeed: .25 + Math.random() * 2.5,
      effectSize: .5 + Math.random() * 2, effectDirection: pick(['random','up','down','left','right','up-left','up-right','down-left','down-right','center-out','edges-in'] as const),
      effectOrigin: pick(['random','top','bottom','left','right','center','full'] as const), effectOpacity: .6 + Math.random() * .4,
      effectGlossy: Math.random(), effectSizeMode: pick(['fixed','random'] as const), effectBeatReactive: Math.random() > .35,
      effectReactiveSource: pick(['bass','mid','full'] as const), effectColorMode: pick(['palette','rainbow'] as const), effectColors: [color(), color(), color()],
    })
    setSelectedLayer('particles')
  }
  const updateLayer = (id: string, values: Partial<Layer>) => patch({ layers: project.layers.map(l => l.id === id ? { ...l, ...values } : l) })

  const handleAsset = (file: File, kind: 'audio' | 'cover' | 'background' | 'video') => {
    if (kind === 'audio') loadAudio(file)
    else {
      const url = URL.createObjectURL(file)
      if (kind === 'cover') setCoverUrl(url)
      else {
        const asset: BackgroundAsset = { id: `${Date.now()}-${file.name}`, name: file.name, type: kind === 'background' ? 'image' : 'video', url, opacity: 1, fit: 'inherit', duration: 8, playbackRate: 1, seamlessLoop: true, loopTransitionDuration: 1, zoom: 1, cropX: 0, cropY: 0 }
        setBackgroundAssets(items => [...items, asset]); setSelectedBackgroundAsset(asset.id); setSelectedLayer('media')
      }
    }
  }

  const handleAssets = (files: FileList, kind: 'background' | 'video') => Array.from(files).forEach(file => handleAsset(file, kind))
  const removeBackgroundAsset = (id: string) => setBackgroundAssets(items => {
    const removed = items.find(item => item.id === id); if (removed) URL.revokeObjectURL(removed.url)
    return items.filter(item => item.id !== id)
  })
  const updateBackgroundAsset = (id: string, values: Partial<BackgroundAsset>) => setBackgroundAssets(items => items.map(item => item.id === id ? { ...item, ...values } : item))

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (!file) return
    if (file.type.startsWith('audio/')) handleAsset(file, 'audio')
    else if (file.type.startsWith('video/')) handleAsset(file, 'video')
    else if (file.type.startsWith('image/')) handleAsset(file, event.shiftKey ? 'background' : 'cover')
  }

  const saveProject = () => {
    const blob = new Blob([JSON.stringify({ ...project, audio: audioName }, null, 2)], { type: 'application/json' })
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = 'studio-project.json'; anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  const loadProject = async (file: File) => {
    try {
      const loaded = JSON.parse(await file.text()) as Partial<ProjectSettings>
      const layers = defaultProject.layers.map(base => ({ ...base, ...(loaded.layers?.find(layer => layer.id === base.id) || {}) }))
      setProject({ ...defaultProject, ...loaded, layers })
    }
    catch { window.alert('Project file is not valid JSON.') }
  }

  const runExport = async () => {
    const audio = audioRef.current
    if (!canvasRef.current || !audio.src) { window.alert('Import audio before exporting video.'); return }
    if (!window.MediaRecorder || !canvasRef.current.captureStream) { window.alert('Browser ini tidak mendukung video recording. Gunakan Chrome atau Edge terbaru.'); return }
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
    if (!mimeType) { window.alert('Codec WebM tidak tersedia di browser ini.'); return }
    const startTime = Math.max(0, Math.min(project.exportStartTime, audio.duration || 0))
    const endTime = project.exportEndTime > startTime ? Math.min(project.exportEndTime, audio.duration) : audio.duration
    if (!Number.isFinite(endTime) || endTime <= startTime) { window.alert('Start time dan end time export tidak valid.'); return }
    const cleanName = (project.exportFileName || project.title || 'studio-visualizer').replace(/[<>:"/\\|?*]+/g, '-').replace(/\.webm$/i, '').trim() || 'studio-visualizer'
    type SaveWriter = { write: (data: Blob) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }
    type SaveHandle = { createWritable: () => Promise<SaveWriter> }
    let fileWriter: SaveWriter | null = null
    let saveHandle: SaveHandle | null = null
    const picker = (window as Window & { showSaveFilePicker?: (options: object) => Promise<SaveHandle> }).showSaveFilePicker
    if (picker) {
      try {
        saveHandle = await picker({ suggestedName: `${cleanName}.webm`, types: [{ description: 'WebM video', accept: { 'video/webm': ['.webm'] } }] })
        fileWriter = await saveHandle.createWritable()
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return
        window.alert('Lokasi penyimpanan tidak dapat dibuka.'); return
      }
    }
    setExporting(true)
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const canvas = canvasRef.current
    if (!canvas) { setExporting(false); return }
    const stream = canvas.captureStream(0)
    exportTrackRef.current = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    if (project.exportIncludeAudio) getRecordingStream()?.getAudioTracks().forEach(track => stream.addTrack(track))
    const pixels = canvas.width * canvas.height
    const baseBitrate = pixels >= 8_000_000 ? 12_000_000 : pixels >= 3_000_000 ? 8_000_000 : 5_000_000
    const videoBitsPerSecond = project.exportQuality === 'high' ? Math.round(baseBitrate * 1.5) : baseBitrate
    stream.getVideoTracks().forEach(track => { track.contentHint = 'motion' })
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
    const chunks: Blob[] = []
    let writeQueue = Promise.resolve()
    recorderRef.current = recorder; exportCancelled.current = false
    recorder.ondataavailable = event => { if (!event.data.size) return; if (fileWriter) writeQueue = writeQueue.then(() => fileWriter!.write(event.data)); else chunks.push(event.data) }
    recorder.onerror = () => { exportCancelled.current = true; audio.pause(); window.alert('Encoder berhenti karena error. Coba turunkan resolusi atau kualitas export.') }
    recorder.onstop = async () => {
      stream.getVideoTracks().forEach(track => track.stop())
      exportTrackRef.current = null
      await writeQueue
      if (fileWriter) {
        if (exportCancelled.current && fileWriter.abort) await fileWriter.abort()
        else await fileWriter.close()
      } else if (!exportCancelled.current && chunks.length) {
        const output = new Blob(chunks, { type: mimeType })
        if (!exportCancelled.current) {
          if (saveHandle) {
            const writer = await saveHandle.createWritable(); await writer.write(output); await writer.close()
          } else {
            const url = URL.createObjectURL(output)
            const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${cleanName}.webm`; anchor.click()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          }
          setExportProgress(100)
        }
      }
      recorderRef.current = null
      setExportPaused(false)
      setExporting(false)
    }
    const updateProgress = () => {
      setExportProgress(Math.min(99, Math.max(0, (audio.currentTime - startTime) / (endTime - startTime) * 100)))
      if (audio.currentTime >= endTime) finish()
    }
    const finish = () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('ended', finish)
      if (recorder.state !== 'inactive') recorder.stop()
    }
    exportCleanup.current = finish
    audio.addEventListener('timeupdate', updateProgress); audio.addEventListener('ended', finish, { once: true })
    audio.pause(); audio.currentTime = startTime; setExportProgress(0); setExportPaused(false)
    recorder.start(2000)
    try { await audio.play() } catch { exportCancelled.current = true; finish(); setExporting(false); window.alert('Audio tidak dapat diputar untuk export.') }
  }

  const cancelExport = () => {
    exportCancelled.current = true; audioRef.current.pause()
    exportCleanup.current()
    setExporting(false)
  }

  const toggleExportPause = async () => {
    const recorder = recorderRef.current
    const audio = audioRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (recorder.state === 'recording') {
      recorder.pause(); audio.pause(); setExportPaused(true)
    } else {
      recorder.resume(); setExportPaused(false)
      try { await audio.play() } catch { window.alert('Audio tidak dapat dilanjutkan.') }
    }
  }

  const stopAndSaveExport = () => {
    exportCancelled.current = false
    audioRef.current.pause()
    exportCleanup.current()
  }

  const tabs: { id: Tab; label: string; icon: typeof Image }[] = [
    { id: 'media', label: 'Media', icon: Image }, { id: 'visualizer', label: 'Visualizer', icon: AudioLines },
    { id: 'effects', label: 'Effects', icon: WandSparkles }, { id: 'text', label: 'Text', icon: Type },
    { id: 'presets', label: 'Presets', icon: SlidersHorizontal },
  ]

  return (
    <div className="app" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <header className="titlebar">
        <div className="brand"><div className="brand-mark"><AudioLines size={18} /></div><b>STUDIO</b><span>VISUALIZER</span></div>
        <div className="project-title"><span className="status-dot" /> Untitled Project <ChevronDown size={13} /></div>
        <div className="header-actions">
          <button className="icon-button"><Undo2 size={16} /></button><button className="icon-button disabled"><Redo2 size={16} /></button>
          <span className="separator" /><button className="top-button" onClick={() => projectInput.current?.click()}><FolderOpen size={15} /> Open</button>
          <button className="top-button" onClick={saveProject}><Save size={15} /> Save</button>
          <button className="export-button" onClick={runExport}><Download size={15} /> Export</button>
        </div>
      </header>

      <div className="workspace">
        <nav className="toolrail">
          {tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><item.icon size={19} /><span>{item.label}</span></button>)}
          <div className="rail-spacer" /><button><Settings2 size={19} /><span>Settings</span></button>
        </nav>

        <aside className="library-panel">
          <div className="panel-heading"><div><span className="eyebrow">ASSET LIBRARY</span><h2>{tab === 'media' ? 'Media' : tab[0].toUpperCase() + tab.slice(1)}</h2></div><button className="icon-button"><MoreHorizontal size={17} /></button></div>
          {tab === 'media' && <MediaPanel audioName={audioName} backgroundAssets={backgroundAssets} selectedAsset={selectedBackgroundAsset} onSelectAsset={id => { setSelectedBackgroundAsset(id); setSelectedLayer('media') }} onRemoveAsset={removeBackgroundAsset} onAudio={() => audioInput.current?.click()} onCover={() => coverInput.current?.click()} onBackground={() => bgInput.current?.click()} onVideo={() => videoInput.current?.click()} />}
          {tab === 'presets' && <div className="preset-list">{presets.map(preset => <button key={preset.name} className="preset-card" onClick={() => patch(preset.apply)}><div className="preset-preview" style={{ background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})` }}><i style={{ background: preset.colors[2] }} /></div><div><b>{preset.name}</b><span>Apply theme</span></div></button>)}</div>}
          {tab === 'visualizer' && <LibraryOptions title="Visualizer Styles" items={['Classic Bars','Mirrored Bars','Classic LED','Waveform','Line Spectrum','Radial','Radial Inverse','Circular Wave','Snow Spectrum','Dot Spectrum']} active={['bars','mirrored-bars','classic-led','waveform','line','radial','radial-inverse','circular-wave','snow-spectrum','dots'].indexOf(project.visualizerType)} onPick={i => patch({ visualizerType: (['bars','mirrored-bars','classic-led','waveform','line','radial','radial-inverse','circular-wave','snow-spectrum','dots'] as const)[i] })} />}
          {tab === 'effects' && <><LibraryOptions title="Reactive Effects" items={['None','Floating Particles','Rain','Heavy Rain','Snow','Blizzard','Fog & Mist','Stars','Fireflies']} active={['none','particles','rain','heavy-rain','snow','blizzard','fog','stars','fireflies'].indexOf(project.effect)} onPick={i => { patch({ effect: (['none','particles','rain','heavy-rain','snow','blizzard','fog','stars','fireflies'] as const)[i] }); setSelectedLayer('particles') }} /><div className="effect-presets"><div className="effect-preset-actions"><button onClick={saveCustomEffectPreset}>Save Custom</button><button onClick={applyRandomEffectPreset}>Random Preset</button></div>{customEffectPreset && <button className="effect-preset-card custom" onClick={() => { patch(customEffectPreset); setSelectedLayer('particles') }}><div className="effect-palette">{(customEffectPreset.effectColors || project.effectColors).map((color, i) => <i key={i} style={{ background: color }} />)}</div><span><b>Custom Preset</b><small>Your saved effect settings</small></span></button>}<h3>10 EFFECT PRESETS</h3>{effectPresets.map(preset => <button key={preset.name} className="effect-preset-card" onClick={() => { patch(preset.apply); setSelectedLayer('particles') }}><div className="effect-palette">{preset.colors.map(color => <i key={color} style={{ background: color }} />)}</div><span><b>{preset.name}</b><small>{preset.description}</small></span></button>)}</div></>}
          {tab === 'text' && <div className="text-panel"><label>Song title<input value={project.title} onChange={e => patch({ title: e.target.value })} /></label><label>Artist<input value={project.artist} onChange={e => patch({ artist: e.target.value })} /></label><label>Album<input value={project.album} onChange={e => patch({ album: e.target.value })} /></label><button className="add-button"><Plus size={16} /> Add text layer</button></div>}
        </aside>

        <main className="stage-area">
          <div className="stage-toolbar">
            <div className="toolbar-group"><button className="tool selected"><MousePointer2 size={16} /></button><button className="tool"><Menu size={16} /></button></div>
            <div className="canvas-meta"><Monitor size={15} /> {project.resolution} <span /> {project.fps} FPS</div>
            <div className="zoom-tools"><button onClick={() => setZoom(z => Math.max(40, z - 8))}><ZoomOut size={15} /></button><span>{zoom}%</span><button onClick={() => setZoom(z => Math.min(110, z + 8))}><ZoomIn size={15} /></button></div>
          </div>
          <div className="canvas-wrap">
            <div className={`canvas-shell${exporting ? ' export-active' : ''}`} style={{ width: `${zoom}%`, aspectRatio: project.resolution.replace(' x ', ' / ') }}><StudioCanvas canvasRef={canvasRef} exportTrackRef={exportTrackRef} project={project} analyser={analyserRef.current} audioClock={audioRef} playing={playing} exporting={exporting} coverUrl={coverUrl} backgroundAssets={backgroundAssets} selectedLayer={exporting ? '' : selectedLayer} onSelectLayer={setSelectedLayer} onLayerChange={updateLayer} /></div>
            <div className="stage-hint">Drag elements on canvas · Drop audio, image, or video files</div>
          </div>
          <Timeline current={currentTime} duration={duration} playing={playing} onToggle={toggle} onSeek={seek} />
        </main>

        <aside className="inspector-panel">
          <div className="inspector-tabs"><button className="active">Properties</button><button>Animation</button></div>
          <section><div className="section-title"><span>Export WebM</span><ChevronDown size={14} /></div><TextRow label="File name" value={project.exportFileName} onChange={exportFileName => patch({ exportFileName })} /><TimeRow label="Start time" value={project.exportStartTime} max={duration} onChange={exportStartTime => patch({ exportStartTime })} /><TimeRow label="End time" value={project.exportEndTime} max={duration} placeholder={duration ? `Full (${formatTime(duration)})` : 'Full audio'} onChange={exportEndTime => patch({ exportEndTime })} /><ToggleRow label="Include audio" value={project.exportIncludeAudio} onChange={exportIncludeAudio => patch({ exportIncludeAudio })} /><SelectRow label="Quality" value={project.exportQuality} options={['standard','high']} onChange={exportQuality => patch({ exportQuality: exportQuality as ProjectSettings['exportQuality'] })} /></section>
          {!selectedLayer && <section><div className="section-title"><span>Canvas</span><ChevronDown size={14} /></div><SelectRow label="Resolution" value={project.resolution} options={['1280 x 720','1920 x 1080','2560 x 1440','3840 x 2160','1080 x 1920','1080 x 1080']} onChange={value => patch({ resolution: value })} /><SelectRow label="Frame rate" value={`${project.fps} FPS`} options={['30 FPS','60 FPS']} onChange={value => patch({ fps: value.startsWith('30') ? 30 : 60 })} /></section>}
          {project.layers.find(layer => layer.id === selectedLayer)?.kind === 'spectrum' && <section><div className="section-title"><span>Spectrum Options</span><ChevronDown size={14} /></div><SelectRow label="Style" value={project.visualizerType} options={['bars','mirrored-bars','classic-led','waveform','line','radial','radial-inverse','circular-wave','snow-spectrum','dots']} onChange={value => patch({ visualizerType: value as ProjectSettings['visualizerType'] })} /><SelectRow label="Color style" value={project.spectrumColorMode} options={['solid','gradient','rainbow']} onChange={value => patch({ spectrumColorMode: value as ProjectSettings['spectrumColorMode'] })} /><ColorRow label="Primary" value={project.visualizerColor} onChange={value => patch({ visualizerColor: value })} />{project.spectrumColorMode === 'gradient' && <ColorRow label="Secondary" value={project.visualizerColorSecondary} onChange={value => patch({ visualizerColorSecondary: value })} />}<SelectRow label="Reactive effect" value={project.spectrumEffect} options={['none','zoom','pulse','bounce','wave','flicker','glossy','neon']} onChange={value => patch({ spectrumEffect: value as ProjectSettings['spectrumEffect'] })} />{project.spectrumEffect !== 'none' && <><SelectRow label="React to" value={project.spectrumReactiveSource} options={['bass','mid','full']} onChange={value => patch({ spectrumReactiveSource: value as ProjectSettings['spectrumReactiveSource'] })} /><RangeRow label="Effect amount" value={project.spectrumEffectAmount} min={.05} max={1.5} step={.05} onChange={value => patch({ spectrumEffectAmount: value })} /><RangeRow label="Effect speed" value={project.spectrumEffectSpeed} min={.25} max={3} step={.05} onChange={value => patch({ spectrumEffectSpeed: value })} /></>}<RangeRow label="Bars" value={project.bars} min={16} max={180} onChange={value => patch({ bars: value })} /><RangeRow label="Bar thickness" value={project.spectrumBarThickness} min={.5} max={2.5} step={.05} onChange={value => patch({ spectrumBarThickness: value })} /><RangeRow label="Width" value={project.spectrumWidth} min={.2} max={.95} step={.01} onChange={value => patch({ spectrumWidth: value })} /><RangeRow label="Height" value={project.spectrumHeight} min={20} max={240} onChange={value => patch({ spectrumHeight: value })} /><RangeRow label="Gap" value={project.spectrumGap} min={0} max={12} step={.5} onChange={value => patch({ spectrumGap: value })} /><RangeRow label="Sensitivity" value={project.sensitivity} min={.4} max={3} step={.05} onChange={value => patch({ sensitivity: value })} /><RangeRow label="Smoothing" value={project.smoothing} min={0} max={.98} step={.01} onChange={value => patch({ smoothing: value })} /><RangeRow label="Glow" value={project.glow} min={0} max={60} onChange={value => patch({ glow: value })} /></section>}
          {project.layers.find(layer => layer.id === selectedLayer)?.kind === 'cover' && <section><div className="section-title"><span>Cover Art Options</span><ChevronDown size={14} /></div><SelectRow label="Shape" value={project.coverShape} options={['circle','rounded','square']} onChange={value => patch({ coverShape: value as ProjectSettings['coverShape'] })} /><SelectRow label="Reactive effect" value={project.imageReactiveEffect} options={['none','scale','pulse','bounce','shake','tilt','glow','blur','hue','contrast']} onChange={value => patch({ imageReactiveEffect: value as ProjectSettings['imageReactiveEffect'] })} /><RangeRow label="Reaction" value={project.imageReactionAmount} min={.05} max={1.5} step={.05} onChange={value => patch({ imageReactionAmount: value })} /><ToggleRow label="Auto rotation" value={project.coverRotation} onChange={value => patch({ coverRotation: value })} /></section>}
          {project.layers.find(layer => layer.id === selectedLayer)?.kind === 'media' && <section><div className="section-title"><span>Main Background Media</span><ChevronDown size={14} /></div><SelectRow label="Fit" value={project.backgroundMediaFit} options={['cover','contain','stretch']} onChange={value => patch({ backgroundMediaFit: value as ProjectSettings['backgroundMediaFit'] })} /><SelectRow label="Transition" value={project.backgroundTransition} options={['none','fade','slide','zoom','dissolve']} onChange={value => patch({ backgroundTransition: value as ProjectSettings['backgroundTransition'] })} />{project.backgroundTransition !== 'none' && <RangeRow label="Transition time" value={project.backgroundTransitionDuration} min={.2} max={4} step={.1} onChange={value => patch({ backgroundTransitionDuration: value })} />}<ToggleRow label="Loop playlist" value={project.backgroundPlaylistLoop} onChange={value => patch({ backgroundPlaylistLoop: value })} /><RangeRow label="Opacity" value={project.backgroundImageOpacity} min={0} max={1} step={.05} onChange={value => patch({ backgroundImageOpacity: value })} /><RangeRow label="Blur" value={project.backgroundImageBlur} min={0} max={30} step={1} onChange={value => patch({ backgroundImageBlur: value })} /><SelectRow label="Reactive effect" value={project.backgroundReactiveEffect} options={['none','zoom','pulse','shake','blur','hue','glow','brightness','saturate']} onChange={value => patch({ backgroundReactiveEffect: value as ProjectSettings['backgroundReactiveEffect'] })} />{project.backgroundReactiveEffect !== 'none' && <RangeRow label="Reaction" value={project.backgroundReactionAmount} min={.05} max={1.5} step={.05} onChange={value => patch({ backgroundReactionAmount: value })} />}</section>}
          {project.layers.find(layer => layer.id === selectedLayer)?.kind === 'media' && (() => { const asset = backgroundAssets.find(item => item.id === selectedBackgroundAsset); return asset ? <section><div className="section-title"><span>{asset.type === 'video' ? 'Video' : 'Image'}: {asset.name}</span><ChevronDown size={14} /></div><RangeRow label="Opacity" value={asset.opacity} min={0} max={1} step={.05} onChange={opacity => updateBackgroundAsset(asset.id, { opacity })} /><SelectRow label="Fit" value={asset.fit} options={['inherit','cover','contain','stretch']} onChange={fit => updateBackgroundAsset(asset.id, { fit: fit as BackgroundAsset['fit'] })} />{asset.type === 'image' && <RangeRow label="Display duration" value={asset.duration} min={2} max={30} step={.5} onChange={duration => updateBackgroundAsset(asset.id, { duration })} />}<RangeRow label="Zoom" value={asset.zoom ?? 1} min={1} max={3} step={.05} onChange={zoom => updateBackgroundAsset(asset.id, { zoom })} /><RangeRow label="Crop X" value={asset.cropX ?? 0} min={-1} max={1} step={.05} onChange={cropX => updateBackgroundAsset(asset.id, { cropX })} /><RangeRow label="Crop Y" value={asset.cropY ?? 0} min={-1} max={1} step={.05} onChange={cropY => updateBackgroundAsset(asset.id, { cropY })} /></section> : null })()}
          {project.layers.find(layer => layer.id === selectedLayer)?.kind === 'effect' && <section><div className="section-title"><span>Effect Options</span><ChevronDown size={14} /></div><SelectRow label="Effect" value={project.effect} options={['none','particles','rain','heavy-rain','snow','blizzard','fog','stars','fireflies']} onChange={value => patch({ effect: value as ProjectSettings['effect'] })} />{project.effect !== 'none' && <><SelectRow label="Color mode" value={project.effectColorMode} options={['solid','palette','rainbow']} onChange={value => patch({ effectColorMode: value as ProjectSettings['effectColorMode'] })} /><ColorRow label="Color 1" value={project.effectColors[0]} onChange={value => patch({ effectColors: [value, project.effectColors[1], project.effectColors[2]] })} />{project.effectColorMode === 'palette' && <><ColorRow label="Color 2" value={project.effectColors[1]} onChange={value => patch({ effectColors: [project.effectColors[0], value, project.effectColors[2]] })} /><ColorRow label="Color 3" value={project.effectColors[2]} onChange={value => patch({ effectColors: [project.effectColors[0], project.effectColors[1], value] })} /></>}<SelectRow label="Direction" value={project.effectDirection} options={['random','up','down','left','right','up-left','up-right','down-left','down-right','center-out','edges-in']} onChange={value => patch({ effectDirection: value as ProjectSettings['effectDirection'] })} /><SelectRow label="Spawn from" value={project.effectOrigin} options={['random','top','bottom','left','right','center','full']} onChange={value => patch({ effectOrigin: value as ProjectSettings['effectOrigin'] })} /><ToggleRow label="Follow audio beat" value={project.effectBeatReactive} onChange={value => patch({ effectBeatReactive: value })} />{project.effectBeatReactive && <SelectRow label="React to" value={project.effectReactiveSource} options={['bass','mid','full']} onChange={value => patch({ effectReactiveSource: value as ProjectSettings['effectReactiveSource'] })} />}<RangeRow label="Opacity" value={project.effectOpacity} min={0} max={1} step={.05} onChange={value => patch({ effectOpacity: value })} /><RangeRow label="Glossy" value={project.effectGlossy} min={0} max={1} step={.05} onChange={value => patch({ effectGlossy: value })} /><RangeRow label="Amount" value={project.effectAmount} min={.1} max={2} step={.05} onChange={value => patch({ effectAmount: value })} /><RangeRow label="Speed" value={project.effectSpeed} min={0} max={3} step={.05} onChange={value => patch({ effectSpeed: value })} /><SelectRow label="Size mode" value={project.effectSizeMode} options={['fixed','random']} onChange={value => patch({ effectSizeMode: value as ProjectSettings['effectSizeMode'] })} /><RangeRow label={project.effectSizeMode === 'random' ? 'Max size' : 'Size'} value={project.effectSize} min={.25} max={3} step={.05} onChange={value => patch({ effectSize: value })} /></>}</section>}
          <ElementControls layer={project.layers.find(layer => layer.id === selectedLayer)} onChange={values => updateLayer(selectedLayer, values)} />
          {project.layers.find(layer => layer.id === selectedLayer)?.kind === 'media' && <section><div className="section-title"><span>Video Defaults</span><ChevronDown size={14} /></div><RangeRow label="Opacity" value={project.videoOpacity} min={0} max={1} step={.05} onChange={value => patch({ videoOpacity: value })} /></section>}
        </aside>
      </div>

      <input hidden ref={audioInput} type="file" accept="audio/*,.flac" onChange={e => e.target.files?.[0] && handleAsset(e.target.files[0], 'audio')} />
      <input hidden ref={coverInput} type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleAsset(e.target.files[0], 'cover')} />
      <input hidden multiple ref={bgInput} type="file" accept="image/*" onChange={e => e.target.files && handleAssets(e.target.files, 'background')} />
      <input hidden multiple ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => e.target.files && handleAssets(e.target.files, 'video')} />
      <input hidden ref={projectInput} type="file" accept=".json" onChange={e => e.target.files?.[0] && loadProject(e.target.files[0])} />

      <LayerPanel layers={project.layers} selected={selectedLayer} onSelect={setSelectedLayer} onUpdate={updateLayer} onReorder={layers => patch({ layers })} />
      {exporting && <ExportProgressModal progress={exportProgress} paused={exportPaused} onPause={toggleExportPause} onStop={stopAndSaveExport} onClose={cancelExport} />}
    </div>
  )
}

function MediaPanel({ audioName, backgroundAssets, selectedAsset, onSelectAsset, onRemoveAsset, onAudio, onCover, onBackground, onVideo }: { audioName: string; backgroundAssets: BackgroundAsset[]; selectedAsset: string; onSelectAsset: (id: string) => void; onRemoveAsset: (id: string) => void; onAudio: () => void; onCover: () => void; onBackground: () => void; onVideo: () => void }) {
  return <div className="media-panel"><button className="drop-card" onClick={onAudio}><div className="upload-icon"><FileAudio size={21} /></div><b>Import audio</b><span>MP3, WAV, FLAC, AAC, OGG</span><small><Upload size={12} /> Browse files</small></button><h3>PROJECT MEDIA</h3><div className="asset-row"><button onClick={onCover}><FileImage size={18} /><span><b>Cover art</b><small>JPG, PNG, WEBP</small></span><Plus size={15} /></button><button onClick={onBackground}><Image size={18} /><span><b>Add images</b><small>Select multiple files</small></span><Plus size={15} /></button><button onClick={onVideo}><Video size={18} /><span><b>Add videos</b><small>Select multiple files</small></span><Plus size={15} /></button></div>{backgroundAssets.map(asset => <div className={`loaded-audio ${selectedAsset === asset.id ? 'selected' : ''}`} key={asset.id} onClick={() => onSelectAsset(asset.id)}>{asset.type === 'video' ? <Video size={17} /> : <Image size={17} />}<div><b>{asset.name}</b><span>Click to edit {asset.type} options</span></div><button className="icon-button" onClick={event => { event.stopPropagation(); onRemoveAsset(asset.id) }}><X size={14} /></button></div>)}{audioName !== 'No audio loaded' && <div className="loaded-audio"><AudioLines size={17} /><div><b>{audioName}</b><span>Audio track</span></div><CirclePlay size={17} /></div>}</div>
}

function LibraryOptions({ title, items, active, onPick }: { title: string; items: string[]; active: number; onPick: (i: number) => void }) {
  return <div className="library-options"><h3>{title.toUpperCase()}</h3>{items.map((item, i) => <button key={item} className={active === i ? 'active' : ''} onClick={() => onPick(i)}><div className="option-visual"><AudioLines size={21} /></div><span>{item}</span>{active === i && <i />}</button>)}</div>
}

function LayerPanel({ layers, selected, onSelect, onUpdate, onReorder }: { layers: Layer[]; selected: string; onSelect: (id: string) => void; onUpdate: (id: string, p: Partial<Layer>) => void; onReorder: (l: Layer[]) => void }) {
  const [open, setOpen] = useState(true)
  const move = (index: number, delta: number) => { const next = [...layers]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onReorder(next) }
  const moveTo = (index: number, target: number) => { const next = [...layers]; const [layer] = next.splice(index, 1); next.splice(target, 0, layer); onReorder(next) }
  return <div className={`layers-panel ${open ? '' : 'collapsed'}`}><div className="layers-head"><div><Layers3 size={16} /><b>Layers</b><span>{layers.length}</span></div><div><button onClick={() => setOpen(!open)}><ChevronDown size={15} /></button></div></div>{open && <><div className="layer-manager"><span>Top layer renders in front</span>{selected && <div><button onClick={() => { const index = layers.findIndex(layer => layer.id === selected); if (index > 0) moveTo(index, 0) }} title="Bring to front">Front</button><button onClick={() => { const index = layers.findIndex(layer => layer.id === selected); if (index >= 0 && index < layers.length - 1) moveTo(index, layers.length - 1) }} title="Send to back">Back</button></div>}</div><div className="layers-list">{layers.map((layer, index) => { const Icon = iconFor(layer.kind); return <div key={layer.id} className={`layer-row ${selected === layer.id ? 'selected' : ''}`} onClick={() => onSelect(layer.id)}><GripVertical size={14} className="grip" /><div className="layer-icon"><Icon size={15} /></div><div className="layer-name"><b>{layer.name}</b><span>{index + 1} · {layer.kind}</span></div><button disabled={index === 0} onClick={e => { e.stopPropagation(); move(index, -1) }} title="Move up"><ChevronDown size={13} className="up" /></button><button disabled={index === layers.length - 1} onClick={e => { e.stopPropagation(); move(index, 1) }} title="Move down"><ChevronDown size={13} /></button><button onClick={e => { e.stopPropagation(); onUpdate(layer.id, { locked: !layer.locked }) }} title={layer.locked ? 'Unlock' : 'Lock'}>{layer.locked ? <Lock size={14} /> : <Square size={11} />}</button><button onClick={e => { e.stopPropagation(); onUpdate(layer.id, { visible: !layer.visible }) }} title={layer.visible ? 'Hide' : 'Show'}>{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button></div>})}</div></>}</div>
}

function ElementControls({ layer, onChange }: { layer?: Layer; onChange: (values: Partial<Layer>) => void }) {
  if (!layer || !['cover', 'spectrum', 'text'].includes(layer.kind)) return null
  return <section><div className="section-title"><span>Selected: {layer.name}</span><ChevronDown size={14} /></div><RangeRow label="Position X" value={layer.x} min={0} max={1} step={.01} onChange={x => onChange({ x })} /><RangeRow label="Position Y" value={layer.y} min={0} max={1} step={.01} onChange={y => onChange({ y })} /><RangeRow label="Scale" value={layer.scale} min={.2} max={2.5} step={.05} onChange={scale => onChange({ scale })} /><RangeRow label="Rotation" value={layer.rotation} min={-180} max={180} onChange={rotation => onChange({ rotation })} /><RangeRow label="Opacity" value={layer.opacity} min={0} max={1} step={.05} onChange={opacity => onChange({ opacity })} /></section>
}

function Timeline({ current, duration, playing, onToggle, onSeek }: { current: number; duration: number; playing: boolean; onToggle: () => void; onSeek: (v: number) => void }) {
  const safeDuration = duration || 224
  const peaks = Array.from({ length: 115 }, (_, i) => 7 + Math.abs(Math.sin(i * .38) * 18 + Math.sin(i * .1) * 12))
  return <div className="timeline"><div className="transport"><button><Minus size={14} /></button><button className="play-button" onClick={onToggle}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><button><Volume2 size={15} /></button><span className="timecode">{formatTime(current)} <i>/</i> {formatTime(safeDuration)}</span></div><div className="wave-track" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX-r.left)/r.width*safeDuration) }}><div className="waveform">{peaks.map((p,i) => <i key={i} style={{ height: p }} className={i / peaks.length < current / safeDuration ? 'passed' : ''} />)}</div><div className="playhead" style={{ left: `${current / safeDuration * 100}%` }}><span /></div></div><div className="timeline-actions"><button><ZoomOut size={14} /></button><input type="range" defaultValue="55" /><button><ZoomIn size={14} /></button></div></div>
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label className="control-row"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select></label> }
function TextRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="control-row"><span>{label}</span><input className="text-control" value={value} onChange={e => onChange(e.target.value)} /></label> }
function TimeRow({ label, value, max, placeholder, onChange }: { label: string; value: number; max: number; placeholder?: string; onChange: (v: number) => void }) { return <label className="control-row"><span>{label}</span><input className="text-control" type="number" min={0} max={max || undefined} step={.1} value={value || ''} placeholder={placeholder || '0 seconds'} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} /></label> }
function RangeRow({ label, value, min, max, step=1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) { return <div className="range-row"><div><span>{label}</span><output>{Number.isInteger(value) ? value : value.toFixed(2)}</output></div><input type="range" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))} /></div> }
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="color-row"><span>{label}</span><div><input type="color" value={value} onChange={e => onChange(e.target.value)} /><code>{value.toUpperCase()}</code></div></label> }
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} /><i /></label> }

function ExportProgressModal({ progress, paused, onPause, onStop, onClose }: { progress: number; paused: boolean; onPause: () => void; onStop: () => void; onClose: () => void }) {
  return <div className="modal-backdrop"><div className="export-modal"><div className="modal-icon"><Download size={25} /></div><button className="modal-close" onClick={onClose} title="Cancel and discard"><X size={17} /></button><span className="eyebrow">WEBM ENCODER</span><h2>{paused ? 'Export paused' : 'Exporting visualizer'}</h2><p>{paused ? 'Export dapat dilanjutkan tanpa mengulang dari awal.' : 'Canvas dan audio sedang direkam sesuai rentang waktu export.'}</p><div className="progress-info"><span>WebM recording</span><b>{Math.round(progress)}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="export-actions"><button onClick={onPause}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume' : 'Pause'}</button><button className="save-export" onClick={onStop}><Save size={15} /> Stop & Save</button></div><small>Export otomatis berhenti pada end time. Tombol X membatalkan hasil.</small></div></div>
}

function ExportModal({ progress, paused, onPause, onStop, onClose }: { progress: number; paused: boolean; onPause: () => void; onStop: () => void; onClose: () => void }) {
  return <div className="modal-backdrop"><div className="export-modal"><div className="modal-icon"><Download size={25} /></div><button className="modal-close" onClick={onClose} title="Cancel and discard"><X size={17} /></button><span className="eyebrow">LIVE VIDEO ENCODER</span><h2>{paused ? 'Export paused' : 'Exporting visualizer'}</h2><p>{paused ? 'Export dapat dilanjutkan tanpa mengulang dari awal.' : 'Canvas dan audio sedang direkam secara real-time. Jangan tutup tab ini.'}</p><div className="progress-info"><span>WebM · Canvas · Audio</span><b>{Math.round(progress)}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="export-actions"><button onClick={onPause}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume' : 'Pause'}</button><button className="save-export" onClick={onStop}><Save size={15} /> Stop & Save</button></div><small>Export berjalan hingga audio selesai. Tombol X membatalkan dan membuang hasil.</small></div></div>
}
