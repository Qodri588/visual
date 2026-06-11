import { useCallback, useEffect, useRef, useState } from 'react'

export function useAudioAnalyzer() {
  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const recordingRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const [audioName, setAudioName] = useState('No audio loaded')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const ensureGraph = useCallback(() => {
    if (!contextRef.current) contextRef.current = new AudioContext()
    if (!analyserRef.current) {
      const analyser = contextRef.current.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.78
      analyserRef.current = analyser
      recordingRef.current = contextRef.current.createMediaStreamDestination()
    }
    if (!sourceRef.current) {
      sourceRef.current = contextRef.current.createMediaElementSource(audioRef.current)
      sourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(contextRef.current.destination)
      analyserRef.current.connect(recordingRef.current!)
    }
  }, [])

  const loadAudio = useCallback((file: File) => {
    const audio = audioRef.current
    if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src)
    audio.src = URL.createObjectURL(file)
    audio.load()
    setAudioName(file.name.replace(/\.[^.]+$/, ''))
    ensureGraph()
  }, [ensureGraph])

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio.src) return
    ensureGraph()
    await contextRef.current?.resume()
    if (audio.paused) await audio.play()
    else audio.pause()
  }, [ensureGraph])

  const seek = useCallback((time: number) => {
    audioRef.current.currentTime = time
  }, [])

  const getRecordingStream = useCallback(() => {
    ensureGraph()
    return recordingRef.current?.stream || null
  }, [ensureGraph])

  useEffect(() => {
    const audio = audioRef.current
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onTime = () => setCurrentTime(audio.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.pause()
      if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src)
      sourceRef.current?.disconnect()
      analyserRef.current?.disconnect()
      recordingRef.current?.disconnect()
      void contextRef.current?.close()
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  return { audioRef, analyserRef, audioName, duration, currentTime, playing, loadAudio, toggle, seek, getRecordingStream }
}
