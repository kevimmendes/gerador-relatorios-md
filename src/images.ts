/**
 * Carregamento, redimensionamento e compressão de imagens no browser.
 * As imagens são guardadas como data URL para o documento ser autónomo.
 */
import type { ImageAsset } from './types'
import { uid } from './types'

async function loadSource(file: File): Promise<{
  drawable: CanvasImageSource
  width: number
  height: number
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return { drawable: bmp, width: bmp.width, height: bmp.height }
    } catch {
      /* segue para o fallback */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        drawable: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem.'))
    }
    img.src = url
  })
}

function scaleTo(
  w: number,
  h: number,
  maxWidth: number,
): { w: number; h: number } {
  if (w <= maxWidth) return { w, h }
  const ratio = maxWidth / w
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) }
}

/**
 * Converte um ficheiro em ImageAsset, limitando a largura e comprimindo.
 * PNG com transparência é preservado quando o resultado é razoável.
 */
export async function fileToAsset(
  file: File,
  maxWidth = 1500,
): Promise<ImageAsset> {
  const { drawable, width, height } = await loadSource(file)
  const target = scaleTo(width, height, maxWidth)

  const canvas = document.createElement('canvas')
  canvas.width = target.w
  canvas.height = target.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível neste navegador.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(drawable, 0, 0, target.w, target.h)

  let dataUrl = canvas.toDataURL('image/png')
  const isPng = file.type === 'image/png' || file.type === 'image/svg+xml'

  // PNG grande demais → converte para JPEG com fundo branco.
  if (!isPng || dataUrl.length > 900_000) {
    const flat = document.createElement('canvas')
    flat.width = target.w
    flat.height = target.h
    const fctx = flat.getContext('2d')
    if (!fctx) throw new Error('Canvas indisponível neste navegador.')
    fctx.fillStyle = '#ffffff'
    fctx.fillRect(0, 0, target.w, target.h)
    fctx.imageSmoothingQuality = 'high'
    fctx.drawImage(drawable, 0, 0, target.w, target.h)
    const jpeg = flat.toDataURL('image/jpeg', 0.85)
    if (jpeg.length < dataUrl.length) dataUrl = jpeg
  }

  return {
    id: uid('img'),
    dataUrl,
    filename: file.name || 'imagem',
    width: target.w,
    height: target.h,
  }
}

/** Nome de ficheiro seguro para exportação em ZIP. */
export function safeFilename(name: string, fallback: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
  return base || fallback
}

export function extensionFor(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9+]+)/i.exec(dataUrl)
  const type = (m ? m[1] : 'png').toLowerCase()
  if (type === 'jpeg' || type === 'jpg') return 'jpg'
  if (type === 'svg+xml') return 'svg'
  return type
}
