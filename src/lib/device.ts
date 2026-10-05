import { useEffect, useState } from 'react'

// Browser features that only some devices have: voice input, barcode scanning, sharing, CSV download.

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }

type BrowserExtras = {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
  BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike
}

const extras = window as unknown as BrowserExtras
const RecognitionCtor = extras.SpeechRecognition ?? extras.webkitSpeechRecognition

export const canListen = Boolean(RecognitionCtor)
export const canScan = Boolean(extras.BarcodeDetector && navigator.mediaDevices?.getUserMedia)

export function listen(onText: (text: string) => void, onEnd: () => void): () => void {
  const r = new RecognitionCtor!()
  r.lang = navigator.language
  r.interimResults = false
  r.continuous = false
  r.onresult = (e) => onText(e.results[0][0].transcript)
  r.onend = onEnd
  r.onerror = onEnd
  r.start()
  return () => r.stop()
}

export function createBarcodeDetector(): BarcodeDetectorLike | null {
  try {
    return new extras.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
  } catch {
    return null
  }
}

// Product names come from Open Food Facts, a free open database of grocery barcodes.
export async function lookupBarcode(code: string): Promise<string | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands`)
    if (!res.ok) return null
    const { product } = await res.json()
    const name: string | undefined = product?.product_name?.trim()
    if (!name) return null
    const brand: string | undefined = product.brands?.split(',')[0]?.trim()
    return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name
  } catch {
    return null
  }
}

// Returns 'shared', 'copied' or 'failed'.
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function downloadCSV(filename: string, columns: string[], rows: Record<string, unknown>[]) {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
