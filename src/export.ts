/**
 * Exportação do relatório: Markdown, pacote ZIP (md + imagens),
 * HTML autónomo e impressão/PDF.
 */
import { marked } from 'marked'
import { buildMarkdown } from './generator'
import type { ReportDoc, ImageAsset } from './types'
import { createZip, dataUrlToBytes } from './zip'
import { extensionFor, safeFilename } from './images'

/* ------------------------------------------------------------------ */
/* Imagens utilizadas                                                  */
/* ------------------------------------------------------------------ */

function usedAssets(doc: ReportDoc): ImageAsset[] {
  const ids = new Set<string>()
  if (doc.cover.logoId) ids.add(doc.cover.logoId)
  if (doc.cover.bannerId) ids.add(doc.cover.bannerId)
  for (const f of doc.figures) if (f.assetId) ids.add(f.assetId)
  return doc.images.filter((i) => ids.has(i.id))
}

function assetNames(doc: ReportDoc): Map<string, string> {
  const map = new Map<string, string>()
  usedAssets(doc).forEach((asset, index) => {
    const base = safeFilename(asset.filename, `imagem-${index + 1}`)
    map.set(asset.id, `${base}-${index + 1}.${extensionFor(asset.dataUrl)}`)
  })
  return map
}

/* ------------------------------------------------------------------ */
/* Ficheiros                                                           */
/* ------------------------------------------------------------------ */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function documentName(doc: ReportDoc): string {
  return (
    (doc.cover.title || 'relatorio')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'relatorio'
  )
}

/** Texto efetivo: markdown manual, se existir; senão o gerado. */
export function effectiveMarkdown(doc: ReportDoc): string {
  return doc.manualMd.trim() ? doc.manualMd : buildMarkdown(doc)
}

/** Markdown com as imagens embutidas (data URL) — ficheiro único. */
export function exportMarkdown(doc: ReportDoc, md = effectiveMarkdown(doc)): void {
  downloadBlob(
    new Blob([md], { type: 'text/markdown;charset=utf-8' }),
    `${documentName(doc)}.md`,
  )
}

/** Markdown com imagens em pasta relativa + ZIP. */
export async function exportZip(
  doc: ReportDoc,
  md = effectiveMarkdown(doc),
): Promise<void> {
  const names = assetNames(doc)

  // Reaproveita o mesmo markdown, trocando os data URLs por caminhos relativos.
  let relMd = md
  for (const asset of usedAssets(doc)) {
    const path = `imagens/${names.get(asset.id) ?? asset.filename}`
    relMd = relMd.split(asset.dataUrl).join(path)
  }

  const entries = [
    {
      name: `${documentName(doc)}.md`,
      data: new TextEncoder().encode(relMd),
    },
    ...usedAssets(doc).map((asset) => ({
      name: `imagens/${names.get(asset.id) ?? asset.filename}`,
      data: dataUrlToBytes(asset.dataUrl),
    })),
  ]

  downloadBlob(createZip(entries), `${documentName(doc)}.zip`)
}

export function buildHtml(doc: ReportDoc, md = effectiveMarkdown(doc)): string {
  const rendered = marked.parse(md) as string
  const title = doc.cover.title || 'Relatório'

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto;
    padding: 48px 56px;
    max-width: 820px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11.5pt;
    line-height: 1.7;
    color: #1a1a1a;
    background: #fff;
  }
  h1 { font-size: 22pt; margin: 0 0 18px; letter-spacing: -0.01em; }
  h2 {
    font-size: 14pt; margin: 34px 0 12px; padding-bottom: 6px;
    border-bottom: 1px solid #ddd; page-break-after: avoid;
  }
  h3 { font-size: 12pt; margin: 22px 0 8px; page-break-after: avoid; }
  h4 {
    font-size: 9pt; text-transform: uppercase; letter-spacing: .08em;
    color: #666; margin: 18px 0 6px; page-break-after: avoid;
  }
  p { margin: 0 0 11px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin-bottom: 4px; }
  img { max-width: 100%; height: auto; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 10pt; }
  th { background: #f4f4f4; text-align: left; padding: 7px 9px; border: 1px solid #ddd; }
  td { padding: 7px 9px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  blockquote {
    margin: 0 0 14px; padding: 8px 14px; border-left: 3px solid #999;
    background: #fafafa; color: #444; font-style: italic;
  }
  code {
    font-family: 'Courier New', monospace; font-size: .88em;
    background: #f4f4f4; padding: 1px 4px; border-radius: 3px;
  }
  pre {
    background: #1e1e1e; color: #e6e6e6; padding: 12px 14px;
    border-radius: 6px; overflow-x: auto; font-size: 9pt; line-height: 1.55;
    page-break-inside: avoid;
  }
  pre code { background: none; padding: 0; color: inherit; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 26px 0; }
  a { color: #1a4fa0; word-break: break-word; }
  h2, h3, h4, table, pre, blockquote, img { page-break-inside: avoid; }
  @media print {
    body { padding: 0; max-width: none; font-size: 11pt; }
    a { color: #000; text-decoration: none; }
  }
</style>
</head>
<body>
${rendered}
</body>
</html>`
}

export function exportHtml(doc: ReportDoc, md = effectiveMarkdown(doc)): void {
  downloadBlob(
    new Blob([buildHtml(doc, md)], { type: 'text/html;charset=utf-8' }),
    `${documentName(doc)}.html`,
  )
}

export function printDocument(doc: ReportDoc, md = effectiveMarkdown(doc)): void {
  const html = buildHtml(doc, md)
  const win = window.open('', '_blank')
  if (!win) {
    // Popup bloqueado: abre o HTML numa nova aba para impressão manual.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    try {
      win.print()
    } catch {
      /* o utilizador imprime manualmente */
    }
  }, 400)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
