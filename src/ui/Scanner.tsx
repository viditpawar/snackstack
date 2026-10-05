import { useEffect, useRef, useState } from 'react'
import { Loader2, ScanBarcode } from 'lucide-react'
import { createBarcodeDetector, lookupBarcode } from '../lib/device'

// Live camera view that reads a grocery barcode and looks up the product name.
export function Scanner({ onResult }: { onResult: (name: string | null, code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const [state, setState] = useState<'starting' | 'scanning' | 'looking' | 'error'>('starting')

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let timer = 0
    const stopCamera = () => stream?.getTracks().forEach((t) => t.stop())
    const detector = createBarcodeDetector()

    async function start() {
      if (!detector) return setState('error')
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return stopCamera()
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setState('scanning')
        const tick = async () => {
          if (stopped) return
          try {
            const [code] = await detector.detect(video)
            if (code) {
              navigator.vibrate?.(30)
              setState('looking')
              stopCamera()
              const name = await lookupBarcode(code.rawValue)
              if (!stopped) onResultRef.current(name, code.rawValue)
              return
            }
          } catch {
            // Frame not ready yet; try the next one.
          }
          timer = window.setTimeout(tick, 200)
        }
        tick()
      } catch {
        setState('error')
      }
    }

    start()
    return () => {
      stopped = true
      clearTimeout(timer)
      stopCamera()
    }
  }, [])

  return (
    <div className="scanner">
      <div className="scanner-view">
        <video ref={videoRef} playsInline muted />
        {state === 'scanning' && <div className="scanner-frame" aria-hidden />}
        {(state === 'starting' || state === 'looking') && (
          <div className="scanner-overlay">
            <Loader2 className="spin" size={28} />
          </div>
        )}
        {state === 'error' && (
          <div className="scanner-overlay">
            <ScanBarcode size={32} />
          </div>
        )}
      </div>
      <p className="hint">
        {state === 'starting' && 'Starting camera…'}
        {state === 'scanning' && 'Point your camera at a barcode.'}
        {state === 'looking' && 'Looking up the product…'}
        {state === 'error' && "Couldn't open the camera. Allow camera access in your browser settings and try again."}
      </p>
    </div>
  )
}
