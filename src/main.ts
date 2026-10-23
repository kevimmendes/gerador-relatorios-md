import './style.css'
import { marked } from 'marked'
import { inTextCitation } from './generator'
import {
  defaultDoc,
  emptyFinding,
  emptyListItem,
  emptyReference,
  emptySection,
  SEVERITIES,
  REF_TYPES,
  uid,
} from './types'
import type { ReportDoc, Severity, RefType } from './types'
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  applySettings,
  clearDoc,
  loadDocRaw,
  loadSettings,
  mergeDoc,
  resolveTheme,
  saveDoc,
  saveSettings,
  watchSystemTheme,
} from './settings'
import type { Settings, ThemeMode } from './settings'
import { destroyCollab, initCollab, setUser } from './collab'
import type { CollabState } from './collab'
import { observeYdoc, syncToYdoc } from './collab-sync'
import { fileToAsset } from './images'
import {
  effectiveMarkdown,
  exportHtml,
  exportMarkdown,
  exportZip,
  printDocument,
} from './export'
import { DEFAULT_CONFIG, generateWithAI, loadAIConfig, saveAIConfig } from './ai'
import type { AIConfig } from './ai'

/* ================================================================== */
/* Estado                                                              */
/* ================================================================== */

const doc: ReportDoc = mergeDoc(defaultDoc(), loadDocRaw())
let settings: Settings = loadSettings()
let activeTab = 0
let aiConfig: AIConfig = loadAIConfig()

applySettings(settings)
watchSystemTheme(() => applySettings(settings))

const TABS = [
  'Capa',
  'Resumo',
  'Objetivo',
  'Âmbito',
  'Metodologia',
  'Secções',
  'Achados',
  'Conclusão',
  'Recomendações',
  'Referências',
  'Anexos',
  'Imagens',
]

/* ================================================================== */
/* Utilitários                                                         */
/* ================================================================== */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  for (const c of children) {
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return node
}

const ICONS: Record<string, string> = {
  sun: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  copy: 'M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  reset: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  sparkles:
    'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM18 15l.9 2.1 2.1.9-2.1.9L18 21l-.9-2.1-2.1-.9 2.1-.9z',
}

function icon(name: keyof typeof ICONS | string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', 'icon')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', ICONS[name] ?? '')
  svg.appendChild(p)
  return svg
}

function label(text: string): HTMLElement {
  return el('label', { class: 'ui-label' }, text)
}

function textInput(
  value: string,
  onInput: (v: string) => void,
  placeholder = '',
): HTMLInputElement {
  const i = el('input', { class: 'ui-input', type: 'text' }) as HTMLInputElement
  i.value = value
  i.placeholder = placeholder
  i.addEventListener('input', () => {
    onInput(i.value)
    schedulePreview()
  })
  return i
}

function textArea(
  value: string,
  onInput: (v: string) => void,
  rows = 6,
): HTMLTextAreaElement {
  const t = el('textarea', { class: 'ui-input', rows: String(rows) }) as HTMLTextAreaElement
  t.value = value
  t.addEventListener('input', () => {
    onInput(t.value)
    schedulePreview()
  })
  return t
}

function selectInput<T extends string>(
  value: T,
  options: Array<[T, string]>,
  onChange: (v: T) => void,
): HTMLSelectElement {
  const s = el('select', { class: 'ui-input' }) as HTMLSelectElement
  for (const [val, txt] of options) {
    const o = el('option', { value: val }, txt) as HTMLOptionElement
    if (val === value) o.selected = true
    s.appendChild(o)
  }
  s.addEventListener('change', () => onChange(s.value as T))
  return s
}

function checkInput(
  checked: boolean,
  text: string,
  onChange: (v: boolean) => void,
): HTMLElement {
  const cb = el('input', { type: 'checkbox' }) as HTMLInputElement
  cb.checked = checked
  cb.style.accentColor = 'var(--accent)'
  cb.addEventListener('change', () => {
    onChange(cb.checked)
    schedulePreview()
  })
  return el(
    'label',
    {
      class: 'flex items-center gap-2 text-xs cursor-pointer ui-subtle select-none',
    },
    cb,
    el('span', {}, text),
  )
}

function button(
  content: string | Node,
  cls: string,
  onClick: () => void,
  titles?: string,
): HTMLButtonElement {
  const b = el('button', { class: cls, type: 'button' }) as HTMLButtonElement
  if (typeof content === 'string') b.appendChild(document.createTextNode(content))
  else b.appendChild(content)
  if (titles) {
    b.title = titles
    b.setAttribute('aria-label', titles)
  }
  b.addEventListener('click', onClick)
  return b
}

function grid2(...nodes: HTMLElement[]): HTMLElement {
  const g = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3' })
  nodes.forEach((n) => g.appendChild(n))
  return g
}

function card(title: string, sub: string, ...body: HTMLElement[]): HTMLElement {
  const c = el('div', { class: 'ui-card' })
  const h = el('div', { class: 'ui-card-head' })
  h.appendChild(el('div', { class: 'ui-card-title' }, title))
  if (sub) h.appendChild(el('div', { class: 'ui-card-sub' }, sub))
  c.appendChild(h)
  const b = el('div', { class: 'ui-card-body' })
  body.forEach((n) => b.appendChild(n))
  c.appendChild(b)
  return c
}

function sectionHead(text: string, hint: string): HTMLElement {
  const w = el('div', { class: 'mb-1' })
  w.appendChild(el('h2', { class: 'ui-title text-base' }, text))
  w.appendChild(el('p', { class: 'ui-muted text-xs mt-0.5' }, hint))
  return w
}

function field(labelText: string, control: HTMLElement): HTMLElement {
  return el('div', {}, label(labelText), control)
}

function listEditor(
  items: Array<{ id: string; text: string }>,
  onChange: (items: Array<{ id: string; text: string }>) => void,
  placeholder = 'Escreva um ponto…',
): HTMLElement {
  const wrap = el('div', { class: 'space-y-2' })
  items.forEach((item, idx) => {
    const row = el('div', { class: 'flex items-start gap-2' })
    row.appendChild(
      el(
        'span',
        { class: 'mt-2 text-xs ui-muted font-mono w-4 shrink-0' },
        '•',
      ),
    )
    const ta = el('textarea', { class: 'ui-input', rows: '2' }) as HTMLTextAreaElement
    ta.value = item.text
    ta.placeholder = placeholder
    ta.addEventListener('input', () => {
      item.text = ta.value
      schedulePreview()
    })
    row.appendChild(ta)
    row.appendChild(
      button(
        icon('x'),
        'ui-btn ui-btn-danger ui-btn-icon mt-0.5 shrink-0',
        () => {
          items.splice(idx, 1)
          onChange(items)
          render()
        },
        'Remover',
      ),
    )
    wrap.appendChild(row)
  })
  wrap.appendChild(
    button('+ Adicionar tópico', 'ui-btn-dashed', () => {
      items.push(emptyListItem())
      onChange(items)
      render()
    }),
  )
  return wrap
}

/* ================================================================== */
/* Pré-visualização + autosave                                         */
/* ================================================================== */

let previewTimer: number | undefined
let saveTimer: number | undefined
let collab: CollabState | null = null
let collabIgnore = false
let collabTimer: number | undefined

function broadcastDoc(): void {
  if (!collab || collabIgnore) return
  window.clearTimeout(collabTimer)
  collabTimer = window.setTimeout(() => {
    try {
      syncToYdoc(collab!.doc, doc)
    } catch {
      /* ignore */
    }
  }, 60)
}

function startCollab(room: string): void {
  stopCollab()
  collab = initCollab(room)
  collabIgnore = false

  try {
    observeYdoc(collab.doc, (remote: any) => {
      collabIgnore = true
      try {
        Object.assign(doc, JSON.parse(JSON.stringify(remote)))
        render()
        updatePreview()
      } finally {
        collabIgnore = false
      }
      updateCollabUI()
    })
  } catch {}

  try {
    syncToYdoc(collab.doc, doc)
  } catch {}
  updateCollabUI()
  if (collab) {
    collab.awareness.on('change', updateCollabUI)
  }
}

function stopCollab(): void {
  if (!collab) return
  try {
    collab.awareness.off('change', updateCollabUI)
  } catch {}
  destroyCollab(collab)
  collab = null
  updateCollabUI()
}

function updateCollabUI(): void {
  const status = document.getElementById('collab-status')
  const peers = document.getElementById('collab-peers')
  if (status) {
    if (collab) {
      status.textContent = `Sala: ${collab.room}`
      status.classList.remove('hidden')
    } else {
      status.classList.add('hidden')
    }
  }
  if (peers && collab) {
    try {
      const states = Array.from(collab.awareness.getStates().values())
      const users = states.map((s: any) => s?.user).filter(Boolean)
      peers.textContent = `${users.length} online`
      peers.classList.remove('hidden')
    } catch {
      peers.classList.add('hidden')
    }
  } else if (peers) {
    peers.classList.add('hidden')
  }
}

function schedulePreview(): void {
  window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(updatePreview, 80)
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveDoc(doc)
    broadcastDoc()
  }, 150)
}

function updatePreview(): void {
  const md = effectiveMarkdown(doc)
  const html = marked.parse(md) as string
  const target = document.getElementById('md-preview')
  if (target) target.innerHTML = '<div class="prose">' + html + '</div>'

  const raw = document.getElementById('md-raw') as HTMLTextAreaElement | null
  if (raw && document.activeElement !== raw) {
    if (raw.value !== md) raw.value = md
  }

  const counter = document.getElementById('md-count')
  if (counter) {
    const words = md.trim().split(/\s+/).filter(Boolean).length
    counter.textContent = `${words} palavras · ${md.length} caracteres`
  }
  syncManualUI()
}

/** Atualiza os indicadores de modo manual sem redesenhar a aplicação. */
function syncManualUI(): void {
  const on = doc.manualMd.trim().length > 0
  document.getElementById('manual-banner')?.classList.toggle('hidden', !on)
  document.getElementById('manual-badge')?.classList.toggle('hidden', !on)
}

async function copyMarkdown(): Promise<void> {
  const md = effectiveMarkdown(doc)
  try {
    await navigator.clipboard.writeText(md)
  } catch {
    const ta = el('textarea') as HTMLTextAreaElement
    ta.value = md
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  const b = document.getElementById('btn-copy')
  if (b) {
    const original = b.innerHTML
    b.textContent = '✓'
    window.setTimeout(() => {
      b.innerHTML = original
    }, 1200)
  }
}

/* ================================================================== */
/* Definições (modal)                                                  */
/* ================================================================== */

function segmented<T extends string | number>(
  value: T,
  options: Array<[T, string]>,
  onChange: (v: T) => void,
): HTMLElement {
  const wrap = el('div', { class: 'ui-seg' })
  for (const [val, txt] of options) {
    const b = button(
      txt,
      val === value ? 'active' : '',
      () => {
        onChange(val)
        persistSettings()
        renderSettings()
        applySettings(settings)
      },
    )
    wrap.appendChild(b)
  }
  return wrap
}

function persistSettings(): void {
  saveSettings(settings)
  applySettings(settings)
}

function settingsRow(title: string, hint: string, control: HTMLElement): HTMLElement {
  const r = el('div', { class: 'space-y-1.5' })
  r.appendChild(el('div', { class: 'ui-label mb-0' }, title))
  r.appendChild(control)
  if (hint) r.appendChild(el('div', { class: 'text-[11px] ui-muted' }, hint))
  return r
}

let overlay: HTMLElement | null = null

function openSettings(): void {
  if (overlay) return
  overlay = el('div', { class: 'ui-overlay' })
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings()
  })
  document.body.appendChild(overlay)
  renderSettings()
}

function closeSettings(): void {
  overlay?.remove()
  overlay = null
}

function renderSettings(): void {
  if (!overlay) return
  overlay.innerHTML = ''

  const modal = el('div', { class: 'ui-modal' })

  const head = el(
    'div',
    {
      class:
        'flex items-center justify-between px-5 py-4 border-b',
      style: 'border-color: var(--border)',
    },
    el('div', {},
      el('div', { class: 'ui-title text-sm' }, 'Aparência'),
      el('div', { class: 'ui-muted text-xs mt-0.5' }, 'Personalize a interface e a pré-visualização'),
    ),
    button(icon('x'), 'ui-btn ui-btn-ghost ui-btn-icon', closeSettings, 'Fechar'),
  )
  modal.appendChild(head)

  const body = el('div', { class: 'p-5 space-y-5' })

  // Tema
  const themeControl = el('div', { class: 'ui-seg' })
  ;(
    [
      ['light', 'Claro'],
      ['dark', 'Escuro'],
      ['system', 'Sistema'],
    ] as Array<[ThemeMode, string]>
  ).forEach(([mode, txt]) => {
    themeControl.appendChild(
      button(txt, settings.theme === mode ? 'active' : '', () => {
        settings = { ...settings, theme: mode }
        persistSettings()
        renderSettings()
        render()
      }),
    )
  })
  body.appendChild(
    settingsRow('Tema', `Aplicado: ${resolveTheme(settings.theme) === 'dark' ? 'escuro' : 'claro'}`, themeControl),
  )

  // Cor de destaque
  const swatches = el('div', { class: 'ui-swatches' })
  ACCENTS.forEach((a) => {
    const b = el('button', {
      class: `ui-swatch${a.value === settings.accent ? ' active' : ''}`,
      type: 'button',
      title: a.name,
      'aria-label': a.name,
    }) as HTMLButtonElement
    b.style.background = a.value
    b.addEventListener('click', () => {
      settings = { ...settings, accent: a.value }
      persistSettings()
      renderSettings()
    })
    swatches.appendChild(b)
  })
  body.appendChild(
    settingsRow(
      'Cor de destaque',
      ACCENTS.find((a) => a.value === settings.accent)?.name ?? 'Personalizada',
      swatches,
    ),
  )

  // Tipografia
  body.appendChild(
    settingsRow(
      'Tipografia da pré-visualização',
      'Serifada aproxima-se da apresentação impressa.',
      segmented<'sans' | 'serif'>(
        settings.previewFont,
        [
          ['sans', 'Sem serifa'],
          ['serif', 'Com serifa'],
        ],
        (v) => (settings = { ...settings, previewFont: v }),
      ),
    ),
  )

  // Escala
  body.appendChild(
    settingsRow(
      'Tamanho do texto',
      '',
      segmented<number>(
        settings.previewScale,
        [
          [0.9, 'Pequeno'],
          [1, 'Normal'],
          [1.12, 'Grande'],
        ],
        (v) => (settings = { ...settings, previewScale: v }),
      ),
    ),
  )

  // Largura
  body.appendChild(
    settingsRow(
      'Largura da leitura',
      '',
      segmented<number>(
        settings.previewWidth,
        [
          [42, 'Estreita'],
          [48, 'Normal'],
          [60, 'Larga'],
        ],
        (v) => (settings = { ...settings, previewWidth: v }),
      ),
    ),
  )

  // Ações
  const actions = el('div', { class: 'flex flex-wrap items-center justify-between gap-2 pt-1' })
  actions.appendChild(
    button(
      'Limpar documento',
      'ui-btn ui-btn-danger',
      () => {
        if (!window.confirm('Apagar todos os dados do relatório? Esta ação não pode ser desfeita.')) return
        clearDoc()
        window.location.reload()
      },
    ),
  )
  actions.appendChild(
    button(
      'Restaurar padrão',
      'ui-btn',
      () => {
        settings = { ...DEFAULT_SETTINGS }
        persistSettings()
        renderSettings()
        render()
      },
    ),
  )
  body.appendChild(actions)

  modal.appendChild(body)
  overlay.appendChild(modal)
}

/* ================================================================== */
/* Imagens — seletores e colocação                                     */
/* ================================================================== */

function placementOptions(): Array<[string, string]> {
  const opts: Array<[string, string]> = [
    ['resumo', 'No Resumo Executivo'],
    ['objetivo', 'No Objetivo'],
    ['ambito', 'No Âmbito e Metodologia'],
    ['achados', 'Nos Achados e Resultados'],
    ['conclusao', 'Na Conclusão'],
    ['recomendacoes', 'Nas Recomendações'],
    ['referencias', 'Nas Referências'],
  ]
  for (const s of doc.sections) {
    if (s.enabled && s.title.trim()) {
      opts.push([`sec:${s.id}`, `Na secção "${s.title.trim()}"`])
    }
  }
  for (const a of doc.annexes.items) {
    if (a.title.trim()) opts.push([`anx:${a.id}`, `No anexo "${a.title.trim()}"`])
  }
  return opts
}

function imagePreview(assetId: string): HTMLElement {
  const asset = doc.images.find((i) => i.id === assetId)
  if (!asset) {
    return el(
      'div',
      {
        class:
          'rounded-lg border border-dashed h-20 grid place-items-center text-[11px] ui-muted',
        style: 'border-color: var(--border-strong)',
      },
      'Sem imagem',
    )
  }
  const img = el('img', {
    class: 'rounded-lg border object-contain max-h-24 w-full',
    style: 'border-color: var(--border); background: var(--surface-3)',
  }) as HTMLImageElement
  img.src = asset.dataUrl
  img.alt = asset.filename
  return img
}

function imagePicker(
  assetId: string,
  onSet: (id: string) => void,
  hint: string,
): HTMLElement {
  const wrap = el('div', { class: 'space-y-2' })
  wrap.appendChild(imagePreview(assetId))

  const row = el('div', { class: 'flex items-center gap-2' })
  const fileInput = el('input', {
    type: 'file',
    accept: 'image/*',
    class: 'hidden',
  }) as HTMLInputElement

  const status = el('span', { class: 'text-[11px] ui-muted truncate flex-1' }, hint)

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    status.textContent = 'A processar…'
    try {
      const asset = await fileToAsset(file)
      doc.images.push(asset)
      onSet(asset.id)
      schedulePreview()
      render()
    } catch (err) {
      status.textContent =
        err instanceof Error ? err.message : 'Falha ao carregar a imagem.'
    } finally {
      fileInput.value = ''
    }
  })

  row.appendChild(
    button('Escolher imagem', 'ui-btn', () => fileInput.click()),
  )
  if (assetId) {
    row.appendChild(
      button(
        'Remover',
        'ui-btn ui-btn-danger',
        () => {
          onSet('')
          schedulePreview()
          render()
        },
      ),
    )
  }
  row.appendChild(fileInput)
  wrap.appendChild(row)
  wrap.appendChild(status)
  return wrap
}

/* ================================================================== */
/* Exportação (modal)                                                  */
/* ================================================================== */

let exportOverlay: HTMLElement | null = null

function openExport(): void {
  if (exportOverlay) return
  exportOverlay = el('div', { class: 'ui-overlay' })
  exportOverlay.addEventListener('click', (e) => {
    if (e.target === exportOverlay) closeExport()
  })
  document.body.appendChild(exportOverlay)
  renderExport()
}

function closeExport(): void {
  exportOverlay?.remove()
  exportOverlay = null
}

function renderExport(): void {
  if (!exportOverlay) return
  exportOverlay.innerHTML = ''

  const modal = el('div', { class: 'ui-modal' })

  modal.appendChild(
    el(
      'div',
      {
        class: 'flex items-center justify-between px-5 py-4 border-b',
        style: 'border-color: var(--border)',
      },
      el('div', {},
        el('div', { class: 'ui-title text-sm' }, 'Exportar relatório'),
        el('div', { class: 'ui-muted text-xs mt-0.5' }, 'Escolha o formato de saída'),
      ),
      button(icon('x'), 'ui-btn ui-btn-ghost ui-btn-icon', closeExport, 'Fechar'),
    ),
  )

  const body = el('div', { class: 'p-5 space-y-2.5' })

  const option = (
    title: string,
    desc: string,
    badge: string,
    onClick: () => void,
  ) => {
    const row = el('button', {
      class: 'ui-card w-full text-left p-3 flex items-center gap-3 cursor-pointer',
      type: 'button',
    }) as HTMLButtonElement
    row.addEventListener('click', onClick)
    row.appendChild(
      el(
        'div',
        {
          class:
            'h-9 w-9 rounded-lg grid place-items-center shrink-0 text-[10px] font-bold',
          style: 'background: var(--accent-soft); color: var(--accent)',
        },
        badge,
      ),
    )
    row.appendChild(
      el(
        'div',
        { class: 'min-w-0 flex-1' },
        el('div', { class: 'ui-card-title' }, title),
        el('div', { class: 'ui-card-sub' }, desc),
      ),
    )
    return row
  }

  body.appendChild(
    option('Markdown (.md)', 'Ficheiro único, imagens embutidas em base64.', 'MD', () => {
      exportMarkdown(doc)
      closeExport()
    }),
  )

  body.appendChild(
    option(
      'Pacote ZIP (.zip)',
      'Relatório .md + pasta "imagens". Ideal para GitHub e Obsidian.',
      'ZIP',
      () => {
        void exportZip(doc)
        closeExport()
      },
    ),
  )

  body.appendChild(
    option('Página HTML (.html)', 'Autónoma, com imagens. Abre em qualquer navegador.', 'HTML', () => {
      exportHtml(doc)
      closeExport()
    }),
  )

  body.appendChild(
    option('PDF / Impressão', 'Abre a pré-visualização formatada para imprimir em A4.', 'PDF', () => {
      printDocument(doc)
      closeExport()
    }),
  )

  body.appendChild(
    el(
      'p',
      { class: 'text-[11px] ui-muted pt-2 leading-relaxed' },
      'Para converter em PDF: escolha "PDF / Impressão" e selecione "Guardar como PDF" na janela de impressão.',
    ),
  )

  modal.appendChild(body)
  exportOverlay.appendChild(modal)
}

/* ================================================================== */
/* Geração com IA (modal)                                              */
/* ================================================================== */

let aiOverlay: HTMLElement | null = null

const AI_TEMPLATES: Array<[string, string]> = [
  [
    'Auditoria de segurança',
    'Relatório de auditoria à segurança de uma plataforma web. Avaliar cabeçalhos HTTP, HTTPS/HSTS, autenticação, gestão de sessões, exposição de informação e configuração de servidores. Público: Direção Técnica e equipa de desenvolvimento. Incluir achados classificados por severidade, evidências, impacto e correção recomendada.',
  ],
  [
    'Relatório de projeto',
    'Relatório final de projeto de desenvolvimento de software. Descrever objetivos, âmbito, metodologia ágil adotada, entregas por fase, indicadores de desempenho, riscos materializados e lições aprendidas. Público: patrocinador e partes interessadas.',
  ],
  [
    'Análise de incidente',
    'Relatório pós-incidente de indisponibilidade de serviço. Descrever cronologia, causa raiz, impacto nos utilizadores, ações de contenção, correções aplicadas e medidas preventivas. Público: Direção de Operações.',
  ],
  [
    'Avaliação de desempenho',
    'Relatório de avaliação de desempenho de sistema. Medir tempos de resposta, taxa de erro, disponibilidade e capacidade. Apresentar metodologia de medição, resultados e recomendações de otimização. Público: equipa de engenharia.',
  ],
]

function openAI(): void {
  if (aiOverlay) return
  aiOverlay = el('div', { class: 'ui-overlay' })
  aiOverlay.addEventListener('click', (e) => {
    if (e.target === aiOverlay) closeAI()
  })
  document.body.appendChild(aiOverlay)
  renderAI()
}

function closeAI(): void {
  aiOverlay?.remove()
  aiOverlay = null
}

function renderAI(): void {
  if (!aiOverlay) return
  aiOverlay.innerHTML = ''

  const modal = el('div', { class: 'ui-modal', style: 'max-width: 720px' })

  /* Cabeçalho */
  modal.appendChild(
    el(
      'div',
      {
        class: 'flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0',
        style: 'border-color: var(--border)',
      },
      el(
        'div',
        {},
        el(
          'div',
          { class: 'flex items-center gap-2' },
          el(
            'div',
            {
              class: 'h-7 w-7 rounded-lg grid place-items-center shrink-0',
              style: 'background: var(--accent-soft); color: var(--accent)',
            },
            icon('sparkles'),
          ),
          el('div', { class: 'ui-title text-sm' }, 'Gerar relatório com IA'),
        ),
        el(
          'div',
          { class: 'ui-muted text-xs mt-1' },
          'Descreva o guião. A IA monta capa, secções, achados e referências no formato formal.',
        ),
      ),
      button(icon('x'), 'ui-btn ui-btn-ghost ui-btn-icon', closeAI, 'Fechar'),
    ),
  )

  const body = el('div', { class: 'p-5 space-y-4 overflow-y-auto' })

  /* ---------------- Briefing ---------------- */
  const briefCard = el('div', { class: 'ui-card' })
  briefCard.appendChild(
    el(
      'div',
      { class: 'ui-card-head' },
      el('div', { class: 'ui-card-title' }, 'Guião / Briefing'),
      el('div', { class: 'ui-card-sub' }, 'Quanto mais específico, melhor o resultado'),
    ),
  )
  const briefBody = el('div', { class: 'ui-card-body space-y-3' })

  const chips = el('div', { class: 'flex flex-wrap gap-1.5' })
  const briefTa = el('textarea', {
    class: 'ui-input',
    rows: '7',
    placeholder:
      'Ex.: Relatório de auditoria à segurança da plataforma X. Objetivo: avaliar HTTPS, HSTS e cabeçalhos. Público: Direção Técnica. Incluir achados com severidade e recomendações.',
  }) as HTMLTextAreaElement
  briefTa.style.resize = 'vertical'

  for (const [name, text] of AI_TEMPLATES) {
    chips.appendChild(
      button(`+ ${name}`, 'ui-btn text-[11px]', () => {
        briefTa.value = text
        briefTa.focus()
      }),
    )
  }

  const typeInput = el('input', {
    class: 'ui-input',
    type: 'text',
    placeholder: 'Relatório de auditoria',
  }) as HTMLInputElement
  const audienceInput = el('input', {
    class: 'ui-input',
    type: 'text',
    placeholder: 'Direção Técnica',
  }) as HTMLInputElement

  const toneSelect = el('select', { class: 'ui-input' }) as HTMLSelectElement
  for (const [val, txt] of [
    ['formal', 'Formal'],
    ['muito-formal', 'Muito formal / institucional'],
  ]) {
    const o = el('option', { value: val }, txt) as HTMLOptionElement
    toneSelect.appendChild(o)
  }

  briefBody.appendChild(field('Descrição do relatório', briefTa))
  briefBody.appendChild(
    el(
      'div',
      { class: 'flex flex-wrap items-center gap-1.5' },
      el('span', { class: 'text-[11px] ui-muted mr-1' }, 'Modelos:'),
      chips,
    ),
  )

  const findCB = checkInput(true, 'Achados com severidade', () => {})
  const recCB = checkInput(true, 'Recomendações', () => {})
  const refCB = checkInput(true, 'Referências APA', () => {})
  const checks = el('div', { class: 'flex flex-wrap gap-x-5 gap-y-2' })
  checks.appendChild(findCB)
  checks.appendChild(recCB)
  checks.appendChild(refCB)

  briefBody.appendChild(grid2(field('Tipo de relatório', typeInput), field('Público-alvo', audienceInput)))
  briefBody.appendChild(field('Tom', toneSelect))
  briefBody.appendChild(checks)
  briefCard.appendChild(briefBody)
  body.appendChild(briefCard)

  /* ---------------- Configuração ---------------- */
  const cfgCard = el('div', { class: 'ui-card' })
  cfgCard.appendChild(
    el(
      'div',
      { class: 'ui-card-head' },
      el('div', { class: 'ui-card-title' }, 'Ligação ao modelo'),
      el(
        'div',
        { class: 'ui-card-sub' },
        'Compatível com OpenRouter, OpenAI, Groq, Together e Ollama local',
      ),
    ),
  )
  const cfgBody = el('div', { class: 'ui-card-body space-y-3' })

  const baseUrlInput = el('input', {
    class: 'ui-input',
    type: 'text',
    placeholder: 'https://openrouter.ai/api/v1',
  }) as HTMLInputElement
  baseUrlInput.value = aiConfig.baseUrl

  const modelInput = el('input', {
    class: 'ui-input',
    type: 'text',
    placeholder: 'google/gemini-2.5-flash',
  }) as HTMLInputElement
  modelInput.value = aiConfig.model

  const keyInput = el('input', {
    class: 'ui-input',
    type: 'password',
    placeholder: 'sk-or-v1-…',
    autocomplete: 'off',
  }) as HTMLInputElement
  keyInput.value = aiConfig.apiKey

  const persist = () => {
    aiConfig = {
      ...aiConfig,
      baseUrl: baseUrlInput.value.trim() || DEFAULT_CONFIG.baseUrl,
      model: modelInput.value.trim() || DEFAULT_CONFIG.model,
      apiKey: keyInput.value.trim(),
    }
    saveAIConfig(aiConfig)
  }
  baseUrlInput.addEventListener('change', persist)
  modelInput.addEventListener('change', persist)
  keyInput.addEventListener('change', persist)

  cfgBody.appendChild(grid2(field('URL base', baseUrlInput), field('Modelo', modelInput)))
  cfgBody.appendChild(field('Chave da API', keyInput))
  cfgBody.appendChild(
    el(
      'div',
      { class: 'flex flex-wrap items-center gap-2' },
      el(
        'a',
        {
          href: 'https://openrouter.ai/keys',
          target: '_blank',
          rel: 'noopener',
          class: 'ui-btn text-[11px]',
        },
        'Obter chave gratuita',
      ),
      el(
        'span',
        { class: 'text-[11px] ui-muted' },
        'A chave fica apenas neste navegador (localStorage).',
      ),
    ),
  )
  cfgCard.appendChild(cfgBody)
  body.appendChild(cfgCard)

  /* ---------------- Ação ---------------- */
  const status = el('div', { class: 'text-xs ui-muted min-h-[1.25rem]' })

  const genBtn = button('Gerar relatório', 'ui-btn ui-btn-primary w-full', () => {
    void runGeneration()
  })

  async function runGeneration(): Promise<void> {
    if (!briefTa.value.trim()) {
      status.textContent = 'Descreva o relatório antes de gerar.'
      briefTa.focus()
      return
    }
    persist()
    if (!aiConfig.apiKey.trim()) {
      status.textContent = 'Falta a chave da API. Preencha acima e tente novamente.'
      keyInput.focus()
      return
    }

    genBtn.disabled = true
    genBtn.textContent = 'A gerar… (pode levar 20–60 s)'
    status.textContent = 'A IA está a escrever o relatório completo.'

    try {
      const data = await generateWithAI(
        {
          briefing: briefTa.value.trim(),
          reportType: typeInput.value.trim(),
          audience: audienceInput.value.trim(),
          tone: toneSelect.value as 'formal' | 'muito-formal',
          includeFindings: (findCB.querySelector('input') as HTMLInputElement).checked,
          includeRecommendations: (recCB.querySelector('input') as HTMLInputElement).checked,
          includeReferences: (refCB.querySelector('input') as HTMLInputElement).checked,
          language: 'pt',
        },
        aiConfig,
      )

      applyAIData(data)
      saveDoc(doc)
      broadcastDoc()
      closeAI()
      activeTab = 0
      render()
      updatePreview()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido.'
      status.textContent = msg
    } finally {
      genBtn.disabled = false
      genBtn.textContent = 'Gerar relatório'
    }
  }

  body.appendChild(genBtn)
  body.appendChild(status)
  modal.appendChild(body)
  aiOverlay.appendChild(modal)
}

/** Converte o JSON devolvido pela IA no modelo interno. */
function applyAIData(data: Record<string, any>): void {
  const list = (arr: unknown): Array<{ id: string; text: string }> =>
    Array.isArray(arr)
      ? arr
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((text) => ({ id: uid('li'), text: text.trim() }))
      : []

  if (data.cover && typeof data.cover === 'object') {
    for (const [key, value] of Object.entries(data.cover)) {
      if (key in doc.cover && typeof value === 'string' && value.trim()) {
        ;(doc.cover as unknown as Record<string, string>)[key] = value.trim()
      }
    }
  }

  if (typeof data.executiveSummary === 'string' && data.executiveSummary.trim()) {
    doc.executiveSummary.enabled = true
    doc.executiveSummary.text = data.executiveSummary.trim()
  }

  const objective = list(data.objective)
  if (objective.length) {
    doc.objective.enabled = true
    doc.objective.items = objective
  }

  const scope = list(data.scope)
  if (scope.length) {
    doc.scope.enabled = true
    doc.scope.items = scope
  }

  const methodology = list(data.methodology)
  if (methodology.length) {
    doc.scope.methodology.enabled = true
    doc.scope.methodology.items = methodology
  }

  const notDone = list(data.notDone)
  if (notDone.length) doc.scope.notDone = notDone

  const recommendations = list(data.recommendations)
  if (recommendations.length) {
    doc.recommendations.enabled = true
    doc.recommendations.items = recommendations
  }

  if (typeof data.conclusion === 'string' && data.conclusion.trim()) {
    doc.conclusion.enabled = true
    doc.conclusion.text = data.conclusion.trim()
  }

  if (Array.isArray(data.findings) && data.findings.length) {
    doc.findings.enabled = true
    doc.findings.items = data.findings.map((f: Record<string, any>) => {
      const sev = String(f.severity || '').toLowerCase()
      const severity: Severity =
        sev === 'critica' || sev === 'crítica'
          ? 'critica'
          : sev === 'alta'
            ? 'alta'
            : sev === 'baixa'
              ? 'baixa'
              : sev === 'informativa'
                ? 'informativa'
                : 'media'
      return {
        id: uid('f'),
        code: String(f.code || ''),
        severity,
        title: String(f.title || ''),
        reference: String(f.reference || ''),
        status: String(f.status || 'Aberto'),
        evidence: String(f.evidence || ''),
        analysis: String(f.analysis || ''),
        impact: String(f.impact || ''),
        correction: String(f.correction || ''),
      }
    })
  }

  if (Array.isArray(data.references) && data.references.length) {
    doc.references.enabled = true
    doc.references.items = data.references.map((r: Record<string, any>) => {
      const type = String(r.type || 'website') as RefType
      return {
        id: uid('r'),
        type: type in REF_TYPES ? type : 'website',
        authors: String(r.authors || ''),
        corporate: Boolean(r.corporate),
        year: String(r.year || ''),
        title: String(r.title || ''),
        source: String(r.source || ''),
        volume: String(r.volume || ''),
        issue: String(r.issue || ''),
        pages: String(r.pages || ''),
        publisher: String(r.publisher || ''),
        edition: String(r.edition || ''),
        editors: String(r.editors || ''),
        url: String(r.url || ''),
        doi: String(r.doi || ''),
        accessed: String(r.accessed || ''),
      }
    })
  }

  if (Array.isArray(data.annexes) && data.annexes.length) {
    doc.annexes.enabled = true
    doc.annexes.items = data.annexes.map((a: Record<string, any>) => ({
      id: uid('an'),
      title: String(a.title || ''),
      body: String(a.body || ''),
    }))
  }

  if (Array.isArray(data.sections) && data.sections.length) {
    doc.sections = data.sections
      .filter((s: Record<string, any>) => s && (s.title || s.body))
      .map((s: Record<string, any>) => ({
        id: uid('s'),
        enabled: true,
        title: String(s.title || ''),
        body: String(s.body || ''),
      }))
  }

  doc.manualMd = ''
}

/* ================================================================== */
/* Render principal                                                    */
/* ================================================================== */

const root = document.getElementById('app')!

function themeToggleButton(): HTMLButtonElement {
  const isDark = resolveTheme(settings.theme) === 'dark'
  return button(
    icon(isDark ? 'sun' : 'moon'),
    'ui-btn ui-btn-ghost ui-btn-icon',
    () => {
      settings = { ...settings, theme: isDark ? 'light' : 'dark' }
      persistSettings()
      render()
    },
    isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro',
  )
}

function render(): void {
  root.innerHTML = ''

  /* ---------------- Header ---------------- */
  const header = el('header', {
    class: 'ui-header h-14 flex items-center px-4 justify-between gap-3 sticky top-0 z-20',
  })

  header.appendChild(
    el(
      'div',
      { class: 'flex items-center gap-2.5 min-w-0' },
      el(
        'div',
        {
          class:
            'ui-brand-mark h-8 w-8 rounded-lg grid place-items-center text-[11px] font-bold shrink-0',
        },
        'RM',
      ),
      el(
        'div',
        { class: 'min-w-0 hidden sm:block' },
        el(
          'div',
          { class: 'ui-title text-sm truncate' },
          'Gerador de Relatórios · Markdown Formal',
        ),
        el(
          'div',
          { class: 'ui-muted text-[11px] truncate' },
          'Estrutura institucional · Referências e anexos em APA',
        ),
      ),
    ),
  )

  const actions = el('div', { class: 'flex items-center gap-1.5 shrink-0' })
  const collabStatus = el(
    'span',
    { id: 'collab-status', class: 'ui-muted text-[11px] hidden px-2' },
    '',
  )
  const collabPeers = el(
    'span',
    { id: 'collab-peers', class: 'ui-muted text-[11px] hidden' },
    '',
  )
  actions.appendChild(collabStatus)
  actions.appendChild(collabPeers)
  actions.appendChild(
    button(
      collab ? 'Sair' : 'Colaborar',
      collab ? 'ui-btn' : 'ui-btn',
      () => {
        if (collab) {
          stopCollab()
          const url = new URL(window.location.href)
          url.searchParams.delete('sala')
          history.replaceState({}, '', url.toString())
          render()
          return
        }
        const choice = window.confirm(
          'OK = Criar sala (copia link)\nCancelar = Entrar com código/URL',
        )
        if (choice) {
          const room = `relatorio-${Math.random().toString(36).slice(2, 10)}`
          startCollab(room)
          const url = new URL(window.location.href)
          url.searchParams.set('sala', room)
          history.replaceState({}, '', url.toString())
          try {
            navigator.clipboard.writeText(url.toString())
            alert('Link copiado!\n\n' + url.toString())
          } catch {
            prompt('Copie este link:', url.toString())
          }
        } else {
          const code = window.prompt('Cole o código da sala ou o link:')
          if (!code) return
          let room = code.trim()
          try {
            const u = new URL(room)
            room = u.searchParams.get('sala') || u.hash.replace('#', '') || room
          } catch {}
          if (!room) return
          startCollab(room)
          const url2 = new URL(window.location.href)
          url2.searchParams.set('sala', room)
          history.replaceState({}, '', url2.toString())
        }
        render()
      },
      collab ? 'Sair da colaboração' : 'Criar ou entrar em sala',
    ),
  )
  actions.appendChild(
    button(
      el(
        'span',
        { class: 'flex items-center gap-1.5' },
        icon('sparkles'),
        el('span', { class: 'hidden md:inline' }, 'IA'),
      ),
      'ui-btn',
      openAI,
      'Gerar relatório com IA',
    ),
  )
  actions.appendChild(themeToggleButton())
  actions.appendChild(
    button(icon('settings'), 'ui-btn ui-btn-ghost ui-btn-icon', openSettings, 'Aparência'),
  )
  actions.appendChild(
    button('Copiar', 'ui-btn hidden sm:inline-flex', copyMarkdown),
  )
  actions.appendChild(
    button('Exportar', 'ui-btn ui-btn-primary', openExport),
  )
  header.appendChild(actions)
  root.appendChild(header)

  /* ---------------- Layout ---------------- */
  const main = el('main', {
    class:
      'grid grid-cols-1 xl:grid-cols-[440px_1fr] h-[calc(100vh-3.5rem)] overflow-hidden',
  })

  const formPane = el('aside', { class: 'ui-sidebar overflow-y-auto scroll-thin' })
  const formWrap = el('div', { class: 'p-3 space-y-3 pb-10' })

  const tabBar = el('div', { class: 'ui-tabs sticky top-0 z-10' })
  TABS.forEach((t, i) => {
    tabBar.appendChild(
      button(t, `ui-tab${i === activeTab ? ' active' : ''}`, () => {
        activeTab = i
        render()
      }),
    )
  })
  formWrap.appendChild(tabBar)

  const manualBanner = el('div', {
    id: 'manual-banner',
    class: 'ui-card p-3 flex items-start gap-2.5',
    style: 'border-color: var(--accent)',
  })
  manualBanner.appendChild(
    el(
      'div',
      {
        class: 'h-6 w-6 rounded-md grid place-items-center shrink-0 text-[10px] font-bold',
        style: 'background: var(--accent-soft); color: var(--accent)',
      },
      'MD',
    ),
  )
  manualBanner.appendChild(
    el(
      'div',
      { class: 'flex-1 min-w-0' },
      el('div', { class: 'text-xs font-semibold ui-title' }, 'Modo manual ativo'),
      el(
        'div',
        { class: 'text-[11px] ui-muted mt-0.5' },
        'O documento vem do markdown editado. Alterações no formulário só entram ao recompor.',
      ),
    ),
  )
  manualBanner.appendChild(
    button('Recompor', 'ui-btn shrink-0', () => {
      doc.manualMd = ''
      render()
    }),
  )
  manualBanner.classList.toggle('hidden', !doc.manualMd.trim())
  formWrap.appendChild(manualBanner)

  const c = doc.cover

  /* ---------- 0: Capa ---------- */
  if (activeTab === 0) {
    formWrap.appendChild(
      sectionHead('Capa do Relatório', 'Cabeçalho institucional do documento.'),
    )
    formWrap.appendChild(
      card(
        'Identificação',
        'Informação apresentada no topo do relatório.',
        field('Título do relatório', textInput(c.title, (v) => (c.title = v))),
        field('Subtítulo / Linha de apoio', textInput(c.subtitle, (v) => (c.subtitle = v))),
        grid2(
          field('Relatório nº', textInput(c.reportNumber, (v) => (c.reportNumber = v))),
          field('Versão', textInput(c.version, (v) => (c.version = v))),
        ),
        grid2(
          field('Referência', textInput(c.reference, (v) => (c.reference = v))),
          field('Classificação', textInput(c.classification, (v) => (c.classification = v))),
        ),
      ),
    )
    formWrap.appendChild(
      card(
        'Autoria e Aprovação',
        'Quem elabora, revê, aprova e recebe.',
        grid2(
          field('Elaborado por', textInput(c.author, (v) => (c.author = v))),
          field('Revisto por', textInput(c.reviewer, (v) => (c.reviewer = v))),
        ),
        grid2(
          field('Aprovado por', textInput(c.approver, (v) => (c.approver = v))),
          field('Destinatário', textInput(c.recipient, (v) => (c.recipient = v))),
        ),
        field('Entidade / Instituição', textInput(c.entity, (v) => (c.entity = v))),
      ),
    )
    formWrap.appendChild(
      card(
        'Data e Local',
        'Informação de emissão do documento.',
        grid2(
          field('Local', textInput(c.location, (v) => (c.location = v))),
          field('Data', textInput(c.date, (v) => (c.date = v))),
        ),
        el('div', { class: 'pt-1 border-t', style: 'border-color: var(--border)' }),
        checkInput(doc.apa, 'Aplicar padrão APA (referências e anexos)', (v) => {
          doc.apa = v
          render()
        }),
      ),
    )
  }

  /* ---------- 1: Resumo ---------- */
  if (activeTab === 1) {
    formWrap.appendChild(
      sectionHead(
        'Resumo Executivo',
        'Síntese concisa: contexto, principais resultados e recomendação principal.',
      ),
    )
    formWrap.appendChild(
      card(
        'Texto do Resumo',
        'Markdown permitido: **negrito**, listas, tabelas e blocos de código.',
        field(
          'Conteúdo',
          textArea(doc.executiveSummary.text, (v) => (doc.executiveSummary.text = v), 14),
        ),
      ),
    )
  }

  /* ---------- 2: Objetivo ---------- */
  if (activeTab === 2) {
    formWrap.appendChild(
      sectionHead('Objetivo', 'Apresentado sob a forma de tópicos objetivos.'),
    )
    formWrap.appendChild(
      card(
        'Objetivos',
        'Um tópico por objetivo, na ordem de importância.',
        listEditor(doc.objective.items, (v) => (doc.objective.items = v), 'Objetivo…'),
      ),
    )
  }

  /* ---------- 3: Âmbito ---------- */
  if (activeTab === 3) {
    formWrap.appendChild(
      sectionHead('Âmbito', 'Delimitação do trabalho e limitações assumidas.'),
    )
    formWrap.appendChild(
      card(
        'Âmbito de Aplicação',
        'O que o relatório abrange.',
        listEditor(doc.scope.items, (v) => (doc.scope.items = v), 'Âmbito…'),
      ),
    )
    formWrap.appendChild(
      card(
        'Limitações',
        'Atividades não executadas — apresentadas automaticamente em tabela.',
        listEditor(
          doc.scope.notDone,
          (v) => (doc.scope.notDone = v),
          'Atividade não executada…',
        ),
      ),
    )
  }

  /* ---------- 4: Metodologia ---------- */
  if (activeTab === 4) {
    formWrap.appendChild(
      sectionHead('Metodologia', 'Secção autónoma, apresentada sob a forma de tópicos.'),
    )
    formWrap.appendChild(
      card(
        'Procedimentos Adotados',
        'Técnicas, ferramentas e critérios utilizados.',
        listEditor(
          doc.scope.methodology.items,
          (v) => (doc.scope.methodology.items = v),
          'Procedimento…',
        ),
      ),
    )
  }

  /* ---------- 5: Secções ---------- */
  if (activeTab === 5) {
    formWrap.appendChild(
      sectionHead(
        'Desenvolvimento / Análises',
        'Secções adicionais, numeradas automaticamente.',
      ),
    )
    doc.sections.forEach((s, idx) => {
      formWrap.appendChild(
        card(
          s.title || `Secção ${idx + 1}`,
          'Conteúdo livre em Markdown.',
          grid2(
            field('Título', textInput(s.title, (v) => (s.title = v))),
            el(
              'div',
              { class: 'flex items-end justify-between gap-2' },
              checkInput(s.enabled, 'Incluir', (v) => {
                s.enabled = v
                render()
              }),
              button('Remover', 'ui-btn ui-btn-danger', () => {
                doc.sections.splice(idx, 1)
                render()
              }),
            ),
          ),
          field('Conteúdo', textArea(s.body, (v) => (s.body = v), 12)),
        ),
      )
    })
    formWrap.appendChild(
      button('+ Adicionar secção', 'ui-btn-dashed', () => {
        doc.sections.push(emptySection())
        render()
      }),
    )
  }

  /* ---------- 6: Achados ---------- */
  if (activeTab === 6) {
    formWrap.appendChild(
      sectionHead('Achados e Resultados', 'Estrutura formal por achado.'),
    )
    formWrap.appendChild(
      card(
        'Configuração',
        'Ativar ou desativar a secção de achados.',
        checkInput(
          doc.findings.enabled,
          'Incluir secção "Achados e Resultados"',
          (v) => {
            doc.findings.enabled = v
            render()
          },
        ),
        field(
          'Introdução à secção (opcional)',
          textArea(doc.findings.intro, (v) => (doc.findings.intro = v), 4),
        ),
      ),
    )
    if (doc.findings.enabled) {
      doc.findings.items.forEach((f, idx) => {
        formWrap.appendChild(
          card(
            f.title || `Achado ${idx + 1}`,
            'Evidência → Análise → Impacto → Correção.',
            grid2(
              field('Código', textInput(f.code, (v) => (f.code = v))),
              field('Título', textInput(f.title, (v) => (f.title = v))),
            ),
            grid2(
              field(
                'Referência (CWE / CVSS / ID)',
                textInput(f.reference, (v) => (f.reference = v)),
              ),
              field('Estado', textInput(f.status, (v) => (f.status = v))),
            ),
            field(
              'Severidade',
              selectInput<Severity>(
                f.severity,
                (Object.keys(SEVERITIES) as Severity[]).map((k) => [
                  k,
                  SEVERITIES[k].label,
                ]),
                (v) => {
                  f.severity = v
                  schedulePreview()
                },
              ),
            ),
            field('Evidência', textArea(f.evidence, (v) => (f.evidence = v), 6)),
            field('Análise', textArea(f.analysis, (v) => (f.analysis = v), 6)),
            field('Impacto', textArea(f.impact, (v) => (f.impact = v), 6)),
            field('Correção', textArea(f.correction, (v) => (f.correction = v), 6)),
            el(
              'div',
              { class: 'flex justify-end' },
              button('Remover achado', 'ui-btn ui-btn-danger', () => {
                doc.findings.items.splice(idx, 1)
                render()
              }),
            ),
          ),
        )
      })
      formWrap.appendChild(
        button('+ Adicionar achado', 'ui-btn-dashed', () => {
          doc.findings.items.push(emptyFinding())
          render()
        }),
      )
    }
  }

  /* ---------- 7: Conclusão ---------- */
  if (activeTab === 7) {
    formWrap.appendChild(
      sectionHead('Conclusão', 'Encerramento formal com síntese dos resultados.'),
    )
    formWrap.appendChild(
      card(
        'Conclusão',
        'Texto corrido em linguagem formal.',
        field('Conteúdo', textArea(doc.conclusion.text, (v) => (doc.conclusion.text = v), 12)),
      ),
    )
  }

  /* ---------- 8: Recomendações ---------- */
  if (activeTab === 8) {
    formWrap.appendChild(
      sectionHead('Recomendações', 'Medidas propostas, em lista numerada.'),
    )
    formWrap.appendChild(
      card(
        'Medidas Recomendadas',
        'Um tópico por medida; numeradas automaticamente.',
        listEditor(
          doc.recommendations.items,
          (v) => (doc.recommendations.items = v),
          'Recomendação…',
        ),
      ),
    )
  }

  /* ---------- 9: Referências ---------- */
  if (activeTab === 9) {
    formWrap.appendChild(
      sectionHead(
        'Referências Bibliográficas',
        doc.apa
          ? 'Padrão APA (7.ª ed.). Preencha os campos e a referência é montada automaticamente.'
          : 'Lista numerada simples. Ative o padrão APA na aba Capa.',
      ),
    )
    formWrap.appendChild(
      card(
        'Formato',
        'Apresentação das referências e dos anexos.',
        checkInput(doc.apa, 'Padrão APA (7.ª edição)', (v) => {
          doc.apa = v
          render()
        }),
        field(
          'Rótulo dos anexos',
          selectInput<'appendix' | 'anexo'>(
            doc.annexStyle,
            [
              ['appendix', 'Appendix A, Appendix B… (APA)'],
              ['anexo', 'Anexo A, Anexo B…'],
            ],
            (v) => {
              doc.annexStyle = v
              render()
            },
          ),
        ),
      ),
    )

    doc.references.items.forEach((r, idx) => {
      const cite = inTextCitation(r)
      const head = el('div', { class: 'ui-card' })
      const h = el(
        'div',
        { class: 'ui-card-head flex items-center justify-between gap-2' },
      )
      h.appendChild(
        el(
          'div',
          { class: 'min-w-0' },
          el('div', { class: 'ui-card-title truncate' }, r.title || `Referência ${idx + 1}`),
          el(
            'div',
            { class: cite ? 'ui-card-sub font-mono truncate' : 'ui-card-sub' },
            cite ? `citação no texto: ${cite}` : 'sem citação no texto',
          ),
        ),
      )
      h.appendChild(
        button(icon('x'), 'ui-btn ui-btn-danger ui-btn-icon shrink-0', () => {
          doc.references.items.splice(idx, 1)
          render()
        }, 'Remover'),
      )
      head.appendChild(h)

      const b = el('div', { class: 'ui-card-body' })
      b.appendChild(
        field(
          'Tipo de fonte',
          selectInput<RefType>(
            r.type,
            (Object.keys(REF_TYPES) as RefType[]).map((k) => [k, REF_TYPES[k]]),
            (v) => {
              r.type = v
              render()
            },
          ),
        ),
      )
      b.appendChild(field('Autor(es)', textInput(r.authors, (v) => (r.authors = v))))
      b.appendChild(
        checkInput(
          r.corporate,
          'Autor(es) é uma instituição / organização',
          (v) => {
            r.corporate = v
            schedulePreview()
          },
        ),
      )
      b.appendChild(
        grid2(
          field('Ano', textInput(r.year, (v) => (r.year = v))),
          field('Edição', textInput(r.edition, (v) => (r.edition = v))),
        ),
      )
      b.appendChild(field('Título', textInput(r.title, (v) => (r.title = v))))
      b.appendChild(
        grid2(
          field(
            r.type === 'artigo' ? 'Nome da Revista' : 'Fonte / Publicação',
            textInput(r.source, (v) => (r.source = v)),
          ),
          field(
            r.type === 'livro' || r.type === 'artigo'
              ? 'Editora'
              : 'Editora / Instituição',
            textInput(r.publisher, (v) => (r.publisher = v)),
          ),
        ),
      )
      if (r.type === 'artigo' || r.type === 'capitulo') {
        b.appendChild(
          grid2(
            field('Volume', textInput(r.volume, (v) => (r.volume = v))),
            field('Número', textInput(r.issue, (v) => (r.issue = v))),
          ),
        )
      }
      if (r.type === 'artigo' || r.type === 'capitulo' || r.type === 'tese') {
        b.appendChild(field('Páginas', textInput(r.pages, (v) => (r.pages = v))))
      }
      if (r.type === 'capitulo') {
        b.appendChild(field('Editores (do livro)', textInput(r.editors, (v) => (r.editors = v))))
      }
      b.appendChild(
        grid2(
          field('DOI', textInput(r.doi, (v) => (r.doi = v))),
          field('URL', textInput(r.url, (v) => (r.url = v))),
        ),
      )
      if (r.type === 'website' || r.type === 'webinar') {
        b.appendChild(
          field('Data de consulta', textInput(r.accessed, (v) => (r.accessed = v))),
        )
      }
      head.appendChild(b)
      formWrap.appendChild(head)
    })

    formWrap.appendChild(
      button('+ Adicionar referência', 'ui-btn-dashed', () => {
        doc.references.items.push(emptyReference())
        render()
      }),
    )
  }

  /* ---------- 10: Anexos ---------- */
  if (activeTab === 10) {
    formWrap.appendChild(
      sectionHead(
        'Anexos',
        doc.apa
          ? 'Formato APA: rótulo (Appendix A), título em negrito e conteúdo.'
          : 'Formato clássico: "Anexo A — Título".',
      ),
    )
    doc.annexes.items.forEach((a, idx) => {
      formWrap.appendChild(
        card(
          a.title || `Anexo ${idx + 1}`,
          'Cada anexo tem título e descrição.',
          field('Título', textInput(a.title, (v) => (a.title = v))),
          field('Descrição / Conteúdo', textArea(a.body, (v) => (a.body = v), 8)),
          el(
            'div',
            { class: 'flex justify-end' },
            button('Remover anexo', 'ui-btn ui-btn-danger', () => {
              doc.annexes.items.splice(idx, 1)
              render()
            }),
          ),
        ),
      )
    })
    formWrap.appendChild(
      button('+ Adicionar anexo', 'ui-btn-dashed', () => {
        doc.annexes.items.push({ id: uid('an'), title: '', body: '' })
        render()
      }),
    )
  }

  /* ---------- 11: Imagens ---------- */
  if (activeTab === 11) {
    formWrap.appendChild(
      sectionHead(
        'Imagens',
        'Logotipo, imagem de capa e figuras numeradas com legenda APA.',
      ),
    )

    formWrap.appendChild(
      card(
        'Logotipo',
        'Aparece no topo da capa. PNG com transparência é preservado.',
        imagePicker(
          c.logoId,
          (id) => (c.logoId = id),
          c.logoId ? 'Logotipo definido' : 'Nenhum logotipo',
        ),
      ),
    )

    formWrap.appendChild(
      card(
        'Imagem de Capa',
        'Banner de largura total, apresentado abaixo do cabeçalho.',
        imagePicker(
          c.bannerId,
          (id) => (c.bannerId = id),
          c.bannerId ? 'Imagem de capa definida' : 'Nenhuma imagem de capa',
        ),
      ),
    )

    doc.figures.forEach((f, idx) => {
      const asset = doc.images.find((i) => i.id === f.assetId)
      formWrap.appendChild(
        card(
          f.caption || `Figura ${idx + 1}`,
          'Numerada automaticamente pela ordem de aparecimento.',
          imagePicker(
            f.assetId,
            (id) => {
              f.assetId = id
              render()
            },
            asset ? asset.filename : 'Sem ficheiro — use um URL abaixo',
          ),
          field(
            'Ou URL da imagem',
            textInput(f.url, (v) => (f.url = v), 'https://…'),
          ),
          field(
            'Legenda',
            textInput(f.caption, (v) => (f.caption = v), 'Ex.: Distribuição por severidade'),
          ),
          field(
            'Nota (opcional)',
            textInput(f.note, (v) => (f.note = v), 'Ex.: Fonte: elaboração própria.'),
          ),
          field(
            'Onde inserir',
            selectInput<string>(
              f.placement,
              placementOptions(),
              (v) => {
                f.placement = v
                schedulePreview()
              },
            ),
          ),
          el(
            'div',
            { class: 'flex justify-end' },
            button('Remover figura', 'ui-btn ui-btn-danger', () => {
              doc.figures.splice(idx, 1)
              render()
            }),
          ),
        ),
      )
    })

    formWrap.appendChild(
      button('+ Adicionar figura', 'ui-btn-dashed', () => {
        const first = placementOptions()[0]?.[0] ?? 'achados'
        doc.figures.push({
          id: uid('fig'),
          assetId: '',
          url: '',
          caption: '',
          note: '',
          placement: first,
        })
        render()
      }),
    )
  }

  formPane.appendChild(formWrap)
  main.appendChild(formPane)

  /* ---------------- Pré-visualização ---------------- */
  const prevPane = el('section', { class: 'h-full flex flex-col ui-panel overflow-hidden' })

  const prevHead = el('div', {
    class: 'h-11 border-b flex items-center justify-between px-4 gap-2',
    style: 'border-color: var(--border)',
  })
  const headLeft = el('div', { class: 'flex items-center gap-3 min-w-0' })
  headLeft.appendChild(el('span', { class: 'ui-title text-sm' }, 'Pré-visualização'))
  const manualBadge = el(
    'span',
    {
      id: 'manual-badge',
      class:
        'text-[10px] font-semibold rounded px-1.5 py-0.5 uppercase tracking-wide',
      style: 'background: var(--accent-soft); color: var(--accent)',
    },
    'manual',
  )
  manualBadge.classList.toggle('hidden', !doc.manualMd.trim())
  headLeft.appendChild(manualBadge)
  headLeft.appendChild(el('span', { id: 'md-count', class: 'ui-muted text-[11px]' }))
  prevHead.appendChild(headLeft)

  const headRight = el('div', { class: 'flex items-center gap-1 shrink-0' })
  const viewSeg = el('div', { class: 'ui-seg' })
  const btnRender = button('Renderizado', 'active', () => {
    btnRender.classList.add('active')
    btnRaw.classList.remove('active')
    previewWrap.classList.remove('hidden')
    rawWrap.classList.add('hidden')
  })
  const btnRaw = button('Markdown', '', () => {
    btnRaw.classList.add('active')
    btnRender.classList.remove('active')
    rawWrap.classList.remove('hidden')
    previewWrap.classList.add('hidden')
  })
  viewSeg.appendChild(btnRender)
  viewSeg.appendChild(btnRaw)
  headRight.appendChild(viewSeg)
  const copyBtn = button(icon('copy'), 'ui-btn ui-btn-icon', copyMarkdown, 'Copiar Markdown')
  copyBtn.id = 'btn-copy'
  headRight.appendChild(copyBtn)
  prevHead.appendChild(headRight)
  prevPane.appendChild(prevHead)

  const previewWrap = el('div', { class: 'flex-1 overflow-y-auto scroll-thin p-6' })
  const previewInner = el('div', { class: 'mx-auto' })
  previewInner.style.maxWidth = 'var(--preview-width)'
  const mdPreview = el('div', { id: 'md-preview' })
  previewInner.appendChild(mdPreview)
  previewWrap.appendChild(previewInner)
  prevPane.appendChild(previewWrap)

  const rawWrap = el('div', { class: 'hidden flex-1 overflow-hidden flex flex-col' })

  const rawBar = el('div', {
    class:
      'flex items-center justify-between gap-2 px-4 py-1.5 border-b text-[11px] shrink-0',
    style: 'border-color: var(--border)',
  })
  rawBar.appendChild(
    el(
      'span',
      { class: 'ui-muted' },
      'Editável. Ao escrever, o documento passa a vir daqui.',
    ),
  )
  rawBar.appendChild(
    button('Recompor do formulário', 'ui-btn', () => {
      doc.manualMd = ''
      render()
    }),
  )
  rawWrap.appendChild(rawBar)

  const rawArea = el('textarea', {
    id: 'md-raw',
    class: 'ui-input w-full h-full font-mono text-xs resize-none flex-1',
    spellcheck: 'false',
    style:
      'border: 0; border-radius: 0; box-shadow: none; padding: 1rem 1.25rem; line-height: 1.65;',
  }) as HTMLTextAreaElement
  rawArea.style.fontFamily = 'var(--font-mono)'
  rawArea.addEventListener('input', () => {
    doc.manualMd = rawArea.value
    schedulePreview()
    syncManualUI()
    broadcastDoc()
  })
  rawWrap.appendChild(rawArea)
  prevPane.appendChild(rawWrap)

  main.appendChild(prevPane)
  root.appendChild(main)

  updatePreview()
}

/* ================================================================== */
/* Arranque                                                            */
/* ================================================================== */

render()

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSettings()
    closeExport()
  }
})
