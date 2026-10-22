import './style.css'
import { marked } from 'marked'
import { buildMarkdown, inTextCitation } from './generator'
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
import { fileToAsset } from './images'
import {
  exportHtml,
  exportMarkdown,
  exportZip,
  printDocument,
} from './export'

/* ================================================================== */
/* Estado                                                              */
/* ================================================================== */

const doc: ReportDoc = mergeDoc(defaultDoc(), loadDocRaw())
let settings: Settings = loadSettings()
let activeTab = 0

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

function schedulePreview(): void {
  window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(updatePreview, 120)
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => saveDoc(doc), 600)
}

function updatePreview(): void {
  const md = buildMarkdown(doc)
  const html = marked.parse(md) as string
  const target = document.getElementById('md-preview')
  if (target) target.innerHTML = '<div class="prose">' + html + '</div>'
  const raw = document.getElementById('md-raw') as HTMLTextAreaElement | null
  if (raw) raw.value = md
  const counter = document.getElementById('md-count')
  if (counter) {
    const words = md.trim().split(/\s+/).filter(Boolean).length
    counter.textContent = `${words} palavras · ${md.length} caracteres`
  }
}

async function copyMarkdown(): Promise<void> {
  const md = buildMarkdown(doc)
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

  const rawWrap = el('div', { class: 'hidden flex-1 overflow-hidden p-4' })
  const rawArea = el('textarea', {
    id: 'md-raw',
    class: 'ui-input w-full h-full font-mono text-xs resize-none',
    readonly: 'readonly',
  }) as HTMLTextAreaElement
  rawArea.style.fontFamily = 'var(--font-mono)'
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
