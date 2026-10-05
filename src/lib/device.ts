import { useEffect, useState } from 'react'

// Browser features that only some devices have: voice input, sharing, CSV download.

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

type BrowserExtras = {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

const extras = window as unknown as BrowserExtras
const RecognitionCtor = extras.SpeechRecognition ?? extras.webkitSpeechRecognition

export const canListen = Boolean(RecognitionCtor)

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
