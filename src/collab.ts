/**
 * Colaboração em tempo real com Yjs + y-webrtc.
 * Sincroniza o relatório inteiro entre peers da mesma sala.
 */

import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

export interface CollabState {
  room: string
  userName: string
  color: string
  provider: WebrtcProvider
  doc: Y.Doc
  awareness: WebrtcProvider['awareness']
}

const COLORS = [
  '#22d3ee', '#a78bfa', '#f59e0b', '#34d399', '#f472b6', '#fb7185',
  '#60a5fa', '#facc15', '#4ade80', '#c084fc',
]

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function randomName(): string {
  const adjs = ['Rápido', 'Ágil', 'Claro', 'Firme', 'Sábio', 'Prático']
  const noms = ['Lince', 'Coruja', 'Falcão', 'Águia', 'Tigre', 'Leão']
  return `${adjs[Math.floor(Math.random() * adjs.length)]} ${
    noms[Math.floor(Math.random() * noms.length)]
  }`
}

export function getOrCreateUser(): { name: string; color: string } {
  const name = localStorage.getItem('relatorio.collab.name') || randomName()
  const color = localStorage.getItem('relatorio.collab.color') || randomColor()
  localStorage.setItem('relatorio.collab.name', name)
  localStorage.setItem('relatorio.collab.color', color)
  return { name, color }
}

export function setUser(name: string, color: string): void {
  localStorage.setItem('relatorio.collab.name', name)
  localStorage.setItem('relatorio.collab.color', color)
}

export function initCollab(room: string): CollabState {
  const ydoc = new Y.Doc()
  const { name, color } = getOrCreateUser()

  // Signaling público. Para uso interno pode trocar por servidor próprio.
  const provider = new WebrtcProvider(room, ydoc, {
    signaling: ['wss://signaling.yjs.dev'],
    filterBcConns: true,
    maxConns: 40,
  })

  provider.awareness.setLocalStateField('user', { name, color })

  return { room, userName: name, color, provider, doc: ydoc, awareness: provider.awareness }
}

export function destroyCollab(state: CollabState | null): void {
  if (!state) return
  try {
    state.provider.awareness.setLocalState(null)
    state.provider.destroy()
    state.doc.destroy()
  } catch {
    /* ignore */
  }
}
