import { useRef, useCallback, useEffect } from 'react'

const SOUND_FILES = {
  qrScanSuccess:    '/static/sounds/qr-scan-success.mp3',
  friendAdded:      '/static/sounds/friend-added.mp3',
  messageSend:      '/static/sounds/message-send.mp3',
  messageReceive:   '/static/sounds/message-receive.mp3',
  voiceRecordStart: '/static/sounds/voice-record-start.mp3',
  voiceSend:        '/static/sounds/voice-send.mp3',
  callRingback:     '/static/sounds/call-ringback.mp3',
  callAnswer:       '/static/sounds/call-answer.mp3',
  incomingRingtone: '/static/sounds/incoming-ringtone.mp3',
  incomingGroup:    '/static/sounds/incoming-group.mp3',
  connectingRtc:    '/static/sounds/connecting-rtc.mp3',
  callEnd:          '/static/sounds/call-end.mp3',
  friendRequest:    '/static/sounds/friend-request.mp3',
}

export function useSounds() {
  const buffers = useRef({})
  const loops = useRef({})
  const unlocked = useRef(false)

  useEffect(() => {
    Object.entries(SOUND_FILES).forEach(([key, src]) => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      buffers.current[key] = audio
    })

    const unlock = () => {
      if (unlocked.current) return
      unlocked.current = true
      Object.values(buffers.current).forEach((a) => {
        a.muted = true
        Promise.resolve(a.play()).catch(() => {}).finally(() => {
          a.pause(); a.currentTime = 0; a.muted = false
        })
      })
    }
    ;['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
      document.addEventListener(ev, unlock, { once: true, capture: true })
    )
    return () => {
      ;['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
        document.removeEventListener(ev, unlock, { capture: true })
      )
    }
  }, [])

  const play = useCallback((name, { loop = false, volume = 1 } = {}) => {
    const src = buffers.current[name]
    if (!src) return
    if (loop) {
      const prev = loops.current[name]
      if (prev) { prev.pause(); prev.currentTime = 0 }
    }
    const audio = src.cloneNode()
    audio.loop = loop
    audio.volume = volume
    audio.currentTime = 0
    Promise.resolve(audio.play()).catch(() => {})
    if (loop) loops.current[name] = audio
    return audio
  }, [])

  const stop = useCallback((name) => {
    const audio = loops.current[name]
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    delete loops.current[name]
  }, [])

  const stopAllCallSounds = useCallback(() => {
    stop('callRingback')
    stop('incomingRingtone')
  }, [stop])

  return { play, stop, stopAllCallSounds }
}
