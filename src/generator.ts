/**
 * Motor de geração do relatório em Markdown.
 * Produz um documento formal, estruturado e pronto para publicação.
 * Suporta o padrão APA (7.ª edição) nas referências e nos anexos.
 */
import type { ReportDoc, Finding, Severity, Reference, RefType } from './types'
import { SEVERITIES } from './types'

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function cell(value: string): string {
  const v = (value ?? '').trim()
  if (!v) return '—'
  return v.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function table(rows: Array<[string, string]>): string {
  const lines = ['| | |', '|---|---|']
  for (const [k, v] of rows) lines.push(`| **${cell(k)}** | ${cell(v)} |`)
  return lines.join('\n')
}

function hr(): string {
  return '\n---\n'
}

function body(text: string): string {
  return (text ?? '').trim()
}

function has(text: string): boolean {
  return body(text).length > 0
}

function severityBadge(s: Severity): string {
  return SEVERITIES[s]?.badge ?? SEVERITIES.media.badge
}

/** Converte "Apelido, Nome" / "Nome Apelido" em formato APA "Apelido, N." */
function formatAuthors(raw: string, corporate = false): string {
  const list = raw
    .split(/[;\n]/)
    .map((a) => a.trim())
    .filter(Boolean)
  if (!list.length) return ''

  // Autores institucionais são transcritos na íntegra, conforme APA 7.
  if (corporate) {
    if (list.length === 1) return list[0]
    if (list.length === 2) return `${list[0]}, & ${list[1]}`
    return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`
  }

  const one = (name: string): string => {
    if (name.includes(',')) {
      const [last, first] = name.split(',').map((s) => s.trim())
      const initials = first
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p.replace(/[^A-Za-zÀ-ÿ]/g, '').charAt(0).toUpperCase() + '.')
        .join(' ')
      return initials ? `${last}, ${initials}` : last
    }
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return name
    const last = parts[parts.length - 1]
    const initials = parts
      .slice(0, -1)
      .map((p) => p.replace(/[^A-Za-zÀ-ÿ]/g, '').charAt(0).toUpperCase() + '.')
      .join(' ')
    return `${last}, ${initials}`
  }

  const formatted = list.map(one)
  if (formatted.length === 1) return formatted[0]
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`
  return `${formatted.slice(0, -1).join(', ')}, & ${formatted[formatted.length - 1]}`
}

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Formata a data de acesso no estilo APA: "22 de outubro de 2026". */
function formatDatePt(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`
}

/* ------------------------------------------------------------------ */
/* APA — Referências bibliográficas                                    */
/* ------------------------------------------------------------------ */

function apaReference(r: Reference): string {
  const authors = formatAuthors(r.authors, r.corporate)
  const year = r.year.trim()
  const title = body(r.title)
  const source = body(r.source)
  const publisher = body(r.publisher)
  const url = body(r.url)
  const doi = body(r.doi)
  const pages = body(r.pages)
  const volume = body(r.volume)
  const issue = body(r.issue)
  const edition = body(r.edition)
  const editors = formatAuthors(r.editors, false)
  const accessed = body(r.accessed)

  const yearPart = year ? `(${year})` : '(s.d.)'
  const parts: string[] = []

  const head = authors ? `${authors} ${yearPart}.` : `${yearPart}.`
  parts.push(head)

  switch (r.type as RefType) {
    case 'livro': {
      parts.push(
        `${title}${edition ? ` (${edition}ª ed.)` : ''}.${
          publisher ? ` ${publisher}.` : ''
        }`,
      )
      break
    }
    case 'artigo': {
      const vol = volume ? `, ${volume}` : ''
      const num = issue ? `(${issue})` : ''
      const pg = pages ? `, ${pages}` : ''
      parts.push(`${title}.`)
      parts.push(
        `${source ? `*${source}*` : '*Periódico*'}${vol}${num}${pg}.`,
      )
      break
    }
    case 'website': {
      parts.push(`${title}.`)
      parts.push(
        `${source ? `*${source}*. ` : ''}${
          accessed ? `Consultado em ${formatDatePt(accessed)}. ` : ''
        }${url}`,
      )
      break
    }
    case 'relatorio': {
      parts.push(`*${title}*.`)
      if (publisher) parts.push(`${publisher}.`)
      break
    }
    case 'capitulo': {
      parts.push(`${title}.`)
      parts.push(
        `Em ${editors ? `${editors} (Ed.), ` : ''}${
          source ? `*${source}*` : '*obra em volume*'
        }${pages ? ` (pp. ${pages})` : ''}.${publisher ? ` ${publisher}.` : ''}`,
      )
      break
    }
    case 'tese': {
      parts.push(`*${title}* [Tese de ${source || 'pós-graduação'}].`)
      if (publisher) parts.push(`${publisher}.`)
      break
    }
    case 'norma': {
      parts.push(`*${title}*.`)
      parts.push(`${publisher ? `${publisher}. ` : ''}${source}.`)
      break
    }
    case 'webinar': {
      parts.push(`${title} [Webinar].`)
      parts.push(
        `${source ? `*${source}*. ` : ''}${
          accessed ? `Consultado em ${formatDatePt(accessed)}. ` : ''
        }${url}`,
      )
      break
    }
  }

  if (doi) parts.push(`https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, '')}`)
  else if (url && (r.type === 'artigo' || r.type === 'livro')) parts.push(url)

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** Citação no texto (APA): (Silva, 2020) */
export function inTextCitation(r: Reference): string {
  const first = r.authors
    .split(/[;\n]/)
    .map((a) => a.trim())
    .filter(Boolean)[0]
  if (!first) return ''
  const name = r.corporate
    ? first
    : first.includes(',')
      ? first.split(',')[0].trim()
      : first.split(/\s+/).filter(Boolean).slice(-1)[0]
  const year = r.year.trim() || 's.d.'
  return `(${name}, ${year})`
}

/* ------------------------------------------------------------------ */
/* Sumário (Table of Contents)                                         */
/* ------------------------------------------------------------------ */

interface TocEntry {
  level: 2 | 3
  text: string
  anchor: string
}

function buildToc(entries: TocEntry[]): string {
  if (entries.length === 0) return ''
  const lines = entries.map((e) => {
    const indent = e.level === 3 ? '  ' : ''
    return `${indent}- [${e.text}](#${e.anchor})`
  })
  return ['## Sumário', '', lines.join('\n')].join('\n')
}

/* ------------------------------------------------------------------ */
/* Blocos                                                              */
/* ------------------------------------------------------------------ */

function renderCover(doc: ReportDoc): string {
  const c = doc.cover
  const out: string[] = []
  out.push(`# ${body(c.title) || 'Relatório'}`)
  if (has(c.subtitle)) out.push('', `> ${body(c.subtitle)}`)
  out.push('')

  const rows: Array<[string, string]> = []
  if (has(c.reportNumber)) rows.push(['Relatório nº', c.reportNumber])
  if (has(c.reference)) rows.push(['Referência', c.reference])
  if (has(c.version)) rows.push(['Versão', c.version])
  if (has(c.entity)) rows.push(['Entidade', c.entity])
  if (has(c.recipient)) rows.push(['Destinatário', c.recipient])
  if (has(c.author)) rows.push(['Elaborado por', c.author])
  if (has(c.reviewer)) rows.push(['Revisto por', c.reviewer])
  if (has(c.approver)) rows.push(['Aprovado por', c.approver])
  if (has(c.classification)) rows.push(['Classificação', c.classification])
  if (has(c.location)) rows.push(['Local', c.location])
  if (has(c.date)) rows.push(['Data', c.date])

  if (rows.length) out.push(table(rows))
  return out.join('\n')
}

function renderFinding(f: Finding, index: number): string {
  const out: string[] = []
  const code = body(f.code) || `A-${String(index).padStart(2, '0')}`
  const title = body(f.title) || 'Achado sem título'

  out.push(`### ${code} ${severityBadge(f.severity)} — ${title}`)
  out.push('')

  const rows: Array<[string, string]> = []
  if (has(f.reference)) rows.push(['Referência', f.reference])
  rows.push(['Severidade', SEVERITIES[f.severity]?.label ?? f.severity])
  if (has(f.status)) rows.push(['Estado', f.status])
  if (rows.length) {
    out.push(table(rows))
    out.push('')
  }

  if (has(f.evidence)) {
    out.push('#### Evidência', '', body(f.evidence))
    out.push('')
  }
  if (has(f.analysis)) {
    out.push('#### Análise', '', body(f.analysis))
    out.push('')
  }
  if (has(f.impact)) {
    out.push('#### Impacto', '', body(f.impact))
    out.push('')
  }
  if (has(f.correction)) {
    out.push('#### Correção', '', body(f.correction))
    out.push('')
  }

  return out.join('\n')
}

function bulletList(items: Array<{ text: string }>): string {
  return items
    .filter((i) => has(i.text))
    .map((i) => `- ${body(i.text)}`)
    .join('\n')
}

/* ------------------------------------------------------------------ */
/* Gerador principal                                                   */
/* ------------------------------------------------------------------ */

export function buildMarkdown(doc: ReportDoc): string {
  const blocks: string[] = []
  const toc: TocEntry[] = []
  const apa = doc.apa
  let sectionNo = 0

  const pushSection = (title: string, content: string) => {
    sectionNo += 1
    const fullTitle = `${sectionNo}. ${title}`
    toc.push({ level: 2, text: fullTitle, anchor: slugify(fullTitle) })
    blocks.push(`## ${fullTitle}\n\n${content}`.trim())
  }

  /* ---------------- 1. Capa ---------------- */
  blocks.push(renderCover(doc))

  /* ---------------- Resumo Executivo ---------------- */
  if (doc.executiveSummary.enabled && has(doc.executiveSummary.text)) {
    pushSection('Resumo Executivo', body(doc.executiveSummary.text))
  }

  /* ---------------- Objetivo ---------------- */
  if (doc.objective.enabled) {
    const items = doc.objective.items.filter((i) => has(i.text))
    if (items.length) {
      pushSection('Objetivo', bulletList(items))
    }
  }

  /* ---------------- Âmbito e Metodologia ---------------- */
  if (doc.scope.enabled) {
    const inner: string[] = []
    let sub = 0
    const scopeItems = doc.scope.items.filter((i) => has(i.text))
    if (scopeItems.length) {
      sub += 1
      inner.push(`### ${sub}. Âmbito`, '', bulletList(scopeItems))
    }
    if (doc.scope.methodology.enabled) {
      const mItems = doc.scope.methodology.items.filter((i) => has(i.text))
      if (mItems.length) {
        sub += 1
        inner.push(`### ${sub}. Metodologia`, '', bulletList(mItems))
      }
    }
    const notDone = doc.scope.notDone.filter((i) => has(i.text))
    if (notDone.length > 0) {
      sub += 1
      inner.push(
        [
          `### ${sub}. Limitações do Âmbito`,
          '',
          'As seguintes ações não foram executadas no âmbito do presente trabalho:',
          '',
          ['| Ação | Estado |', '|---|---|']
            .concat(notDone.map((i) => `| ${cell(i.text)} | ❌ Não executada |`))
            .join('\n'),
        ].join('\n'),
      )
    }
    if (inner.length) {
      pushSection('Âmbito e Metodologia', inner.join('\n\n'))
    }
  }

  /* ---------------- Secções de conteúdo ---------------- */
  for (const s of doc.sections) {
    if (!s.enabled || !has(s.title)) continue
    pushSection(body(s.title), body(s.body))
  }

  /* ---------------- Achados / Resultados ---------------- */
  if (doc.findings.enabled && doc.findings.items.length > 0) {
    const inner: string[] = []
    if (has(doc.findings.intro)) inner.push(body(doc.findings.intro), '')
    inner.push(...doc.findings.items.map((f, i) => renderFinding(f, i + 1)))
    pushSection('Achados e Resultados', inner.join('\n'))
  }

  /* ---------------- Conclusão ---------------- */
  if (doc.conclusion.enabled && has(doc.conclusion.text)) {
    pushSection('Conclusão', body(doc.conclusion.text))
  }

  /* ---------------- Recomendações ---------------- */
  if (doc.recommendations.enabled) {
    const items = doc.recommendations.items.filter((i) => has(i.text))
    if (items.length) {
      const content = [
        'Com base nos resultados obtidos, recomenda-se a adoção das seguintes medidas:',
        '',
        ...items.map((i, idx) => `${idx + 1}. ${body(i.text)}`),
      ].join('\n')
      pushSection('Recomendações', content)
    }
  }

  /* ---------------- Referências (APA) ---------------- */
  const refs = doc.references.enabled
    ? doc.references.items.filter((r) => has(r.title) || has(r.authors))
    : []
  if (refs.length) {
    const title = apa ? 'Referências' : 'Referências Bibliográficas'
    const entries = refs
      .map((r) => apaReference(r))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt'))

    const content = apa
      ? [
          entries.join('\n\n'),
          '',
          '> Nota: as referências seguem o padrão APA (7.ª edição). As citações no texto devem ter a forma *(Autor, Ano)*.',
        ].join('\n')
      : entries.map((e, i) => `${i + 1}. ${e}`).join('\n\n')

    pushSection(title, content)
  }

  /* ---------------- Montagem final ---------------- */
  const tocBlock = buildToc(toc)
  const separator = '\n\n' + hr() + '\n\n'

  const header = blocks[0].trim()
  const rest = blocks.slice(1).map((b) => b.trim())
  const final = [header]
  if (tocBlock) final.push(tocBlock)
  const restJoined = rest.join(separator).trim()
  if (restJoined) final.push(restJoined)

  let md = final.join(separator)

  /* ---------------- Anexos (APA: Appendix A / Anexo A) ---------------- */
  const annexes = doc.annexes.enabled
    ? doc.annexes.items.filter((a) => has(a.title) || has(a.body))
    : []
  if (annexes.length) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const useAppendix = doc.apa || doc.annexStyle === 'appendix'
    const rendered = annexes.map((a, i) => {
      const letter = letters[i] ?? String(i + 1)
      const title = body(a.title) || 'Anexo'
      // APA: rótulo numa linha, título na linha seguinte em negrito, conteúdo abaixo.
      const label = useAppendix ? `Appendix ${letter}` : `Anexo ${letter}`
      return [
        `## ${label}`,
        '',
        `**${title}**`,
        '',
        body(a.body) || '—',
      ].join('\n')
    })
    md += separator + rendered.join(separator)
  }

  /* ---------------- Rodapé ---------------- */
  const c = doc.cover
  const stamp = [
    has(c.date) ? c.date : null,
    has(c.version) ? `Versão ${c.version}` : null,
    has(c.classification) ? `Classificação: ${c.classification}` : null,
  ].filter(Boolean)
  if (stamp.length) {
    md = md.replace(/\n{3,}/g, '\n\n').trim()
    md += '\n\n' + hr() + '\n\n' + `*Relatório gerado a ${stamp.join(' · ')}*`
  }

  return md.replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

export function slugOf(text: string): string {
  return slugify(text)
}
