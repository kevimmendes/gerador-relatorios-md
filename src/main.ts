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

/* ================================================================== */
/* Estado                                                              */
/* ================================================================== */

const doc: ReportDoc = defaultDoc()
let activeTab = 0

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
]

/* ================================================================== */
/* Utilitários de UI                                                   */
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

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

function label(text: string): HTMLElement {
  return el('label', { class: 'block text-xs font-medium text-slate-600 mb-1' }, text)
}

function textInput(value: string, onInput: (v: string) => void): HTMLInputElement {
  const i = el('input', { class: INPUT_CLS, type: 'text' }) as HTMLInputElement
  i.value = value
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
  const t = el('textarea', { class: INPUT_CLS, rows: String(rows) }) as HTMLTextAreaElement
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
  const s = el('select', { class: INPUT_CLS }) as HTMLSelectElement
  for (const [val, txt] of options) {
    const o = el('option', { value: val }, txt) as HTMLOptionElement
    if (val === value) o.selected = true
    s.appendChild(o)
  }
  s.addEventListener('change', () => {
    onChange(s.value as T)
    schedulePreview()
  })
  return s
}

function checkInput(
  checked: boolean,
  text: string,
  onChange: (v: boolean) => void,
): HTMLElement {
  const cb = el('input', { type: 'checkbox' }) as HTMLInputElement
  cb.checked = checked
  cb.addEventListener('change', () => {
    onChange(cb.checked)
    schedulePreview()
  })
  return el(
    'label',
    { class: 'flex items-center gap-2 text-xs text-slate-600 cursor-pointer' },
    cb,
    el('span', {}, text),
  )
}

function button(
  text: string,
  cls: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = el('button', { class: cls, type: 'button' }, text) as HTMLButtonElement
  b.addEventListener('click', onClick)
  return b
}

function grid2(...nodes: HTMLElement[]): HTMLElement {
  const g = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3' })
  nodes.forEach((n) => g.appendChild(n))
  return g
}

function card(title: string, sub: string, ...body: HTMLElement[]): HTMLElement {
  const c = el('div', { class: 'rounded-xl border border-slate-200 bg-white shadow-sm' })
  const h = el('div', { class: 'px-4 py-3 border-b border-slate-100' })
  h.appendChild(el('h3', { class: 'text-sm font-semibold text-slate-900' }, title))
  if (sub) h.appendChild(el('p', { class: 'text-xs text-slate-500 mt-0.5' }, sub))
  c.appendChild(h)
  const b = el('div', { class: 'p-4 space-y-3' })
  body.forEach((n) => b.appendChild(n))
  c.appendChild(b)
  return c
}

function sectionHead(text: string, hint: string): HTMLElement {
  const w = el('div', { class: 'mb-1' })
  w.appendChild(el('h2', { class: 'text-base font-semibold text-slate-900' }, text))
  w.appendChild(el('p', { class: 'text-xs text-slate-500 mt-0.5' }, hint))
  return w
}

function field(labelText: string, control: HTMLElement): HTMLElement {
  return el('div', {}, label(labelText), control)
}

/** Editor de lista de tópicos (usado em objetivo, âmbito, metodologia, etc.). */
function listEditor(
  items: Array<{ id: string; text: string }>,
  onChange: (items: Array<{ id: string; text: string }>) => void,
  placeholder = 'Escreva um ponto…',
): HTMLElement {
  const wrap = el('div', { class: 'space-y-2' })

  items.forEach((item, idx) => {
    const row = el('div', { class: 'flex items-start gap-2' })
    row.appendChild(
      el('span', { class: 'mt-2 text-xs text-slate-400 font-mono w-4 shrink-0' }, '•'),
    )
    const ta = el('textarea', {
      class: INPUT_CLS,
      rows: '2',
    }) as HTMLTextAreaElement
    ta.value = item.text
    ta.placeholder = placeholder
    ta.addEventListener('input', () => {
      item.text = ta.value
      schedulePreview()
    })
    row.appendChild(ta)
    row.appendChild(
      button(
        '✕',
        'mt-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0',
        () => {
          items.splice(idx, 1)
          onChange(items)
          render()
        },
      ),
    )
    wrap.appendChild(row)
  })

  wrap.appendChild(
    button(
      '+ Adicionar tópico',
      'rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50',
      () => {
        items.push(emptyListItem())
        onChange(items)
        render()
      },
    ),
  )
  return wrap
}

/* ================================================================== */
/* Pré-visualização                                                    */
/* ================================================================== */

let previewTimer: number | undefined

function schedulePreview(): void {
  window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(updatePreview, 120)
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

function download(): void {
  const md = buildMarkdown(doc)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = el('a') as HTMLAnchorElement
  const name = (doc.cover.title || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
  a.href = url
  a.download = name ? `${name}.md` : 'relatorio.md'
  a.click()
  URL.revokeObjectURL(url)
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
    b.textContent = 'Copiado ✓'
    window.setTimeout(() => (b.textContent = 'Copiar Markdown'), 1400)
  }
}

/* ================================================================== */
/* Render principal                                                    */
/* ================================================================== */

const root = document.getElementById('app')!

function render(): void {
  root.innerHTML = ''

  /* ---------------- Header ---------------- */
  const header = el(
    'header',
    {
      class:
        'h-14 border-b border-slate-200 bg-white flex items-center px-4 justify-between gap-3 sticky top-0 z-20',
    },
  )
  header.appendChild(
    el(
      'div',
      { class: 'flex items-center gap-2.5 min-w-0' },
      el(
        'div',
        {
          class:
            'h-8 w-8 rounded-lg bg-slate-900 text-white grid place-items-center text-[11px] font-bold shrink-0',
        },
        'RM',
      ),
      el(
        'div',
        { class: 'min-w-0' },
        el(
          'div',
          { class: 'text-sm font-semibold text-slate-900 truncate' },
          'Gerador de Relatórios · Markdown Formal',
        ),
        el(
          'div',
          { class: 'text-[11px] text-slate-500 truncate' },
          'Capa · Sumário · Objetivo · Âmbito · Metodologia · Achados · Referências APA · Anexos APA',
        ),
      ),
    ),
  )

  const actions = el('div', { class: 'flex items-center gap-1.5 shrink-0' })
  actions.appendChild(
    button(
      'Copiar Markdown',
      'rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50',
      copyMarkdown,
    ),
  )
  actions.appendChild(
    button(
      'Baixar .MD',
      'rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-800',
      download,
    ),
  )
  header.appendChild(actions)
  root.appendChild(header)

  /* ---------------- Layout ---------------- */
  const main = el('main', {
    class:
      'grid grid-cols-1 xl:grid-cols-[440px_1fr] h-[calc(100vh-56px)] overflow-hidden',
  })

  /* ===== Coluna esquerda: formulário ===== */
  const formPane = el('aside', {
    class:
      'border-r border-slate-200 bg-slate-50/80 overflow-y-auto scroll-thin',
  })
  const formWrap = el('div', { class: 'p-3 space-y-3 pb-10' })

  /* Abas */
  const tabBar = el('div', {
    class: 'flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 sticky top-0 z-10',
  })
  TABS.forEach((t, i) => {
    tabBar.appendChild(
      button(
        t,
        i === activeTab
          ? 'rounded-lg px-2 py-1 text-xs font-semibold bg-slate-900 text-white'
          : 'rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100',
        () => {
          activeTab = i
          render()
        },
      ),
    )
  })
  formWrap.appendChild(tabBar)

  const c = doc.cover

  /* ---------- Aba 0: Capa ---------- */
  if (activeTab === 0) {
    formWrap.appendChild(
      sectionHead('Capa do Relatório', 'Cabeçalho institucional do documento.'),
    )
    formWrap.appendChild(
      card(
        'Identificação',
        'Informação apresentada no topo do relatório.',
        field(
          'Título do relatório',
          textInput(c.title, (v) => (c.title = v)),
        ),
        field(
          'Subtítulo / Linha de apoio',
          textInput(c.subtitle, (v) => (c.subtitle = v)),
        ),
        grid2(
          field('Relatório nº', textInput(c.reportNumber, (v) => (c.reportNumber = v))),
          field('Versão', textInput(c.version, (v) => (c.version = v))),
        ),
        grid2(
          field('Referência', textInput(c.reference, (v) => (c.reference = v))),
          field(
            'Classificação',
            textInput(c.classification, (v) => (c.classification = v)),
          ),
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
        el('div', { class: 'pt-1 border-t border-slate-100' }),
        checkInput(
          doc.apa,
          'Aplicar padrão APA (referências e anexos)',
          (v) => {
            doc.apa = v
            render()
          },
        ),
      ),
    )
  }

  /* ---------- Aba 1: Resumo Executivo ---------- */
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

  /* ---------- Aba 2: Objetivo ---------- */
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

  /* ---------- Aba 3: Âmbito ---------- */
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
        'Atividades que não foram executadas — são apresentadas automaticamente em tabela.',
        listEditor(
          doc.scope.notDone,
          (v) => (doc.scope.notDone = v),
          'Atividade não executada…',
        ),
      ),
    )
  }

  /* ---------- Aba 4: Metodologia ---------- */
  if (activeTab === 4) {
    formWrap.appendChild(
      sectionHead(
        'Metodologia',
        'Secção autónoma, apresentada sob a forma de tópicos.',
      ),
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

  /* ---------- Aba 5: Secções ---------- */
  if (activeTab === 5) {
    formWrap.appendChild(
      sectionHead(
        'Desenvolvimento / Análises',
        'Secções adicionais do relatório, numeradas automaticamente.',
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
              button(
                'Remover',
                'rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50',
                () => {
                  doc.sections.splice(idx, 1)
                  render()
                },
              ),
            ),
          ),
          field(
            'Conteúdo',
            textArea(s.body, (v) => (s.body = v), 12),
          ),
        ),
      )
    })
    formWrap.appendChild(
      button(
        '+ Adicionar secção',
        'w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50',
        () => {
          doc.sections.push(emptySection())
          render()
        },
      ),
    )
  }

  /* ---------- Aba 6: Achados ---------- */
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
                  render()
                },
              ),
            ),
            field(
              'Evidência',
              textArea(f.evidence, (v) => (f.evidence = v), 6),
            ),
            field('Análise', textArea(f.analysis, (v) => (f.analysis = v), 6)),
            field('Impacto', textArea(f.impact, (v) => (f.impact = v), 6)),
            field(
              'Correção',
              textArea(f.correction, (v) => (f.correction = v), 6),
            ),
            el(
              'div',
              { class: 'flex justify-end' },
              button(
                'Remover achado',
                'rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50',
                () => {
                  doc.findings.items.splice(idx, 1)
                  render()
                },
              ),
            ),
          ),
        )
      })
      formWrap.appendChild(
        button(
          '+ Adicionar achado',
          'w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50',
          () => {
            doc.findings.items.push(emptyFinding())
            render()
          },
        ),
      )
    }
  }

  /* ---------- Aba 7: Conclusão ---------- */
  if (activeTab === 7) {
    formWrap.appendChild(
      sectionHead('Conclusão', 'Encerramento formal com síntese dos resultados.'),
    )
    formWrap.appendChild(
      card(
        'Conclusão',
        'Texto corrido em linguagem formal.',
        field(
          'Conteúdo',
          textArea(doc.conclusion.text, (v) => (doc.conclusion.text = v), 12),
        ),
      ),
    )
  }

  /* ---------- Aba 8: Recomendações ---------- */
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

  /* ---------- Aba 9: Referências ---------- */
  if (activeTab === 9) {
    formWrap.appendChild(
      sectionHead(
        'Referências Bibliográficas',
        doc.apa
          ? 'Padrão APA (7.ª edição): preencha os campos e a referência é montada automaticamente.'
          : 'Lista numerada simples. Ative o padrão APA na aba Capa.',
      ),
    )
    formWrap.appendChild(
      card(
        'Formato',
        'Define a apresentação das referências e dos anexos.',
        checkInput(
          doc.apa,
          'Padrão APA (7.ª edição) — referências e anexos',
          (v) => {
            doc.apa = v
            render()
          },
        ),
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
      const head = el('div', {
        class:
          'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden',
      })
      const h = el('div', { class: 'px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2' })
      h.appendChild(
        el(
          'div',
          { class: 'min-w-0' },
          el(
            'div',
            { class: 'text-sm font-semibold text-slate-900 truncate' },
            r.title || `Referência ${idx + 1}`,
          ),
          cite
            ? el(
                'div',
                { class: 'text-[11px] text-slate-500 font-mono truncate' },
                `citação no texto: ${cite}`,
              )
            : el('div', { class: 'text-[11px] text-slate-400' }, 'sem citação no texto'),
        ),
      )
      h.appendChild(
        button(
          'Remover',
          'rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 shrink-0',
          () => {
            doc.references.items.splice(idx, 1)
            render()
          },
        ),
      )
      head.appendChild(h)

      const b = el('div', { class: 'p-4 space-y-3' })
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
      b.appendChild(
        field(
          'Autor(es)',
          textInput(r.authors, (v) => (r.authors = v)),
        ),
      )
      b.appendChild(
        checkInput(
          r.corporate,
          'Autor(es) é uma instituição / organização (transcrever por extenso)',
          (v) => {
            r.corporate = v
            render()
          },
        ),
      )
      b.appendChild(
        el(
          'p',
          { class: 'text-[11px] text-slate-500 -mt-2' },
          'Um autor por linha, ou separados por ";". Use "Apelido, Nome" para uma saída correta em APA.',
        ),
      )
      b.appendChild(
        grid2(
          field('Ano', textInput(r.year, (v) => (r.year = v))),
          field('Edição', textInput(r.edition, (v) => (r.edition = v))),
        ),
      )
      b.appendChild(
        field('Título', textInput(r.title, (v) => (r.title = v))),
      )
      b.appendChild(
        grid2(
          field(
            r.type === 'artigo' ? 'Nome da Revista' : 'Fonte / Publicação',
            textInput(r.source, (v) => (r.source = v)),
          ),
          field(
            r.type === 'livro' || r.type === 'artigo' ? 'Editora' : 'Editora / Instituição',
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
        b.appendChild(
          field('Páginas', textInput(r.pages, (v) => (r.pages = v))),
        )
      }
      if (r.type === 'capitulo') {
        b.appendChild(
          field('Editores (do livro)', textInput(r.editors, (v) => (r.editors = v))),
        )
      }
      b.appendChild(
        grid2(
          field('DOI', textInput(r.doi, (v) => (r.doi = v))),
          field('URL', textInput(r.url, (v) => (r.url = v))),
        ),
      )
      if (r.type === 'website' || r.type === 'webinar') {
        b.appendChild(
          field(
            'Data de consulta',
            textInput(r.accessed, (v) => (r.accessed = v)),
          ),
        )
      }
      head.appendChild(b)
      formWrap.appendChild(head)
    })

    formWrap.appendChild(
      button(
        '+ Adicionar referência',
        'w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50',
        () => {
          doc.references.items.push(emptyReference())
          render()
        },
      ),
    )
  }

  /* ---------- Aba 10: Anexos ---------- */
  if (activeTab === 10) {
    formWrap.appendChild(
      sectionHead(
        'Anexos',
        doc.apa
          ? 'Formato APA: rótulo (Appendix A), título em negrito na linha seguinte e conteúdo.'
          : 'Formato clássico: "Anexo A — Título".',
      ),
    )
    doc.annexes.items.forEach((a, idx) => {
      formWrap.appendChild(
        card(
          a.title || `Anexo ${idx + 1}`,
          'Cada anexo tem título e descrição.',
          field('Título', textInput(a.title, (v) => (a.title = v))),
          field(
            'Descrição / Conteúdo',
            textArea(a.body, (v) => (a.body = v), 8),
          ),
          el(
            'div',
            { class: 'flex justify-end' },
            button(
              'Remover anexo',
              'rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50',
              () => {
                doc.annexes.items.splice(idx, 1)
                render()
              },
            ),
          ),
        ),
      )
    })
    formWrap.appendChild(
      button(
        '+ Adicionar anexo',
        'w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50',
        () => {
          doc.annexes.items.push({ id: uid('an'), title: '', body: '' })
          render()
        },
      ),
    )
  }

  formPane.appendChild(formWrap)
  main.appendChild(formPane)

  /* ===== Coluna direita: pré-visualização ===== */
  const prevPane = el('section', {
    class: 'h-full flex flex-col bg-white overflow-hidden',
  })

  const prevHead = el('div', {
    class: 'h-11 border-b border-slate-200 flex items-center justify-between px-4 gap-2',
  })
  const headLeft = el('div', { class: 'flex items-center gap-3 min-w-0' })
  headLeft.appendChild(
    el('span', { class: 'text-sm font-semibold text-slate-900' }, 'Pré-visualização'),
  )
  headLeft.appendChild(
    el('span', { id: 'md-count', class: 'text-[11px] text-slate-500' }),
  )
  prevHead.appendChild(headLeft)

  const headRight = el('div', { class: 'flex items-center gap-1 shrink-0' })
  const viewToggle = el('div', {
    class: 'flex rounded-lg border border-slate-200 overflow-hidden',
  })
  const btnRender = button(
    'Renderizado',
    'px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-900',
    () => {
      btnRender.className =
        'px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-900'
      btnRaw.className =
        'px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50'
      previewWrap.classList.remove('hidden')
      rawWrap.classList.add('hidden')
    },
  )
  const btnRaw = button(
    'Markdown bruto',
    'px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50',
    () => {
      btnRaw.className =
        'px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-900'
      btnRender.className =
        'px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50'
      rawWrap.classList.remove('hidden')
      previewWrap.classList.add('hidden')
    },
  )
  viewToggle.appendChild(btnRender)
  viewToggle.appendChild(btnRaw)
  headRight.appendChild(viewToggle)
  headRight.appendChild(
    button(
      'Copiar',
      'rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50',
      copyMarkdown,
    ),
  )
  const copyBtn = headRight.lastElementChild as HTMLButtonElement
  copyBtn.id = 'btn-copy'
  prevHead.appendChild(headRight)
  prevPane.appendChild(prevHead)

  const previewWrap = el('div', {
    class: 'flex-1 overflow-y-auto scroll-thin p-6',
  })
  const previewInner = el('div', {
    class: 'max-w-3xl mx-auto',
  })
  const mdPreview = el('div', { id: 'md-preview' })
  previewInner.appendChild(mdPreview)
  previewWrap.appendChild(previewInner)
  prevPane.appendChild(previewWrap)

  const rawWrap = el('div', {
    class: 'hidden flex-1 overflow-hidden p-4',
  })
  const rawArea = el('textarea', {
    id: 'md-raw',
    class: 'w-full h-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700 resize-none focus:outline-none',
    readonly: 'readonly',
  }) as HTMLTextAreaElement
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
