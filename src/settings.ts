/**
 * Preferências de aparência e persistência local.
 */

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Settings {
  theme: ThemeMode
  accent: string
  previewScale: number
  previewFont: 'sans' | 'serif'
  previewWidth: number
}

export interface AccentPreset {
  name: string
  value: string
  hover: string
}

export const ACCENTS: AccentPreset[] = [
  { name: 'Índigo', value: '#4f46e5', hover: '#4338ca' },
  { name: 'Azul', value: '#2563eb', hover: '#1d4ed8' },
  { name: 'Ciano', value: '#0891b2', hover: '#0e7490' },
  { name: 'Esmeralda', value: '#059669', hover: '#047857' },
  { name: 'Violeta', value: '#7c3aed', hover: '#6d28d9' },
  { name: 'Rosa', value: '#e11d48', hover: '#be123c' },
  { name: 'Âmbar', value: '#d97706', hover: '#b45309' },
  { name: 'Grafite', value: '#475569', hover: '#334155' },
]

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#4f46e5',
  previewScale: 1,
  previewFont: 'sans',
  previewWidth: 48,
}

const SETTINGS_KEY = 'relatorio.settings.v1'
const DOC_KEY = 'relatorio.doc.v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* armazenamento indisponível */
  }
}

export function saveDoc(doc: unknown): void {
  try {
    localStorage.setItem(DOC_KEY, JSON.stringify(doc))
  } catch {
    /* armazenamento indisponível */
  }
}

export function loadDocRaw(): unknown | null {
  try {
    const raw = localStorage.getItem(DOC_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearDoc(): void {
  try {
    localStorage.removeItem(DOC_KEY)
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Aplicação do tema                                                   */
/* ------------------------------------------------------------------ */

const media = window.matchMedia('(prefers-color-scheme: dark)')

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return media.matches ? 'dark' : 'light'
  return mode
}

export function applySettings(s: Settings): void {
  const root = document.documentElement
  root.dataset.theme = resolveTheme(s.theme)

  const accent =
    ACCENTS.find((a) => a.value === s.accent) ?? ACCENTS[0]
  root.style.setProperty('--accent', accent.value)
  root.style.setProperty('--accent-hover', accent.hover)

  root.style.setProperty('--preview-scale', String(s.previewScale))
  root.style.setProperty(
    '--preview-font',
    s.previewFont === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : 'var(--font-sans)',
  )
  root.style.setProperty('--preview-width', `${s.previewWidth}rem`)
}

/** Reaplica o tema quando o sistema muda (modo "Sistema"). */
export function watchSystemTheme(onChange: () => void): void {
  const handler = () => onChange()
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler)
  } else {
    const legacy = media as MediaQueryList & {
      addListener?: (cb: () => void) => void
    }
    legacy.addListener?.(handler)
  }
}

/* ------------------------------------------------------------------ */
/* Restauro do documento com compatibilidade                           */
/* ------------------------------------------------------------------ */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Mescla os valores guardados sobre os padrões, preservando campos novos. */
export function mergeDoc<T>(defaults: T, stored: unknown): T {
  if (stored === null || stored === undefined) return defaults
  if (!isPlainObject(defaults) || !isPlainObject(stored)) {
    return stored as T
  }
  const out: Record<string, unknown> = {}
  for (const [k, defVal] of Object.entries(defaults)) {
    const storedVal = stored[k]
    if (Array.isArray(defVal)) {
      out[k] = Array.isArray(storedVal) ? storedVal : defVal
    } else if (isPlainObject(defVal)) {
      out[k] = mergeDoc(defVal, storedVal)
    } else {
      out[k] = storedVal === undefined ? defVal : storedVal
    }
  }
  return out as T
}
