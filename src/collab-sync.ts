/**
 * Sincronização do documento com Yjs.
 * Usa Y.Map para todo o estado + awareness para presença.
 */

import * as Y from 'yjs'
import type { ReportDoc } from './types'

export function syncToYdoc(ydoc: Y.Doc, doc: ReportDoc): void {
  const root = ydoc.getMap('relatorio')
  // Serializa o documento (arrays/objetos)
  root.set('state', JSON.parse(JSON.stringify(doc)))
}

export function syncFromYdoc(ydoc: Y.Doc): ReportDoc | null {
  const root = ydoc.getMap('relatorio')
  const state = root.get('state')
  if (!state) return null
  return state as ReportDoc
}

export function observeYdoc(
  ydoc: Y.Doc,
  onChange: (doc: ReportDoc) => void,
): () => void {
  const root = ydoc.getMap('relatorio')
  const handler = () => {
    const state = root.get('state')
    if (state) onChange(state as ReportDoc)
  }
  root.observe(handler)
  return () => root.unobserve(handler)
}
