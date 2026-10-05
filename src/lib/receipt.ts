// Reads the text on a receipt photo, entirely on the device, using Tesseract.js.
// The OCR engine (~10 MB) downloads the first time you scan, then the browser caches it.

export type ReadProgress = { label: string; progress: number }

// Shrinks huge phone photos, converts to grayscale and stretches contrast, which helps OCR on faded receipts.
async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(2, 2200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = image.data
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < px.length; i += 4) {
    const gray = Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114)
    px[i] = gray
    histogram[gray]++
  }
  // Ignore the darkest and lightest 2% so a shadow or glare doesn't decide the range.
  const cut = (px.length / 4) * 0.02
  let low = 0
  let high = 255
  for (let sum = 0; low < 255 && (sum += histogram[low]) < cut; low++);
  for (let sum = 0; high > 0 && (sum += histogram[high]) < cut; high--);
  const range = Math.max(1, high - low)
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - low) / range) * 255))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export async function readReceipt(file: File, onProgress: (p: ReadProgress) => void): Promise<string> {
  onProgress({ label: 'Preparing photo…', progress: 0 })
  const image = await prepareImage(file)
  onProgress({ label: 'Loading the text reader…', progress: 0.05 })

  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress({ label: 'Reading your receipt…', progress: 0.2 + m.progress * 0.8 })
      else if (m.status.includes('load')) onProgress({ label: 'Loading the text reader…', progress: 0.05 + m.progress * 0.15 })
    },
  })
  try {
    // Receipts are one column of text; keeping spaces helps separate names from prices.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}
