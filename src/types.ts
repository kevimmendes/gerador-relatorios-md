/**
 * Modelo de dados do relatório.
 */

export type Severity = 'critica' | 'alta' | 'media' | 'baixa' | 'informativa'

export const SEVERITIES: Record<
  Severity,
  { label: string; badge: string; order: number }
> = {
  critica: { label: 'Crítica', badge: '🔴 CRÍTICA', order: 0 },
  alta: { label: 'Alta', badge: '🟠 ALTA', order: 1 },
  media: { label: 'Média', badge: '🟡 MÉDIA', order: 2 },
  baixa: { label: 'Baixa', badge: '🔵 BAIXA', order: 3 },
  informativa: { label: 'Informativa', badge: '⚪ INFORMATIVA', order: 4 },
}

/** Tipos de fonte suportados no padrão APA 7.ª edição. */
export type RefType =
  | 'livro'
  | 'artigo'
  | 'website'
  | 'relatorio'
  | 'capitulo'
  | 'tese'
  | 'norma'
  | 'webinar'

export const REF_TYPES: Record<RefType, string> = {
  livro: 'Livro',
  artigo: 'Artigo de revista',
  website: 'Website / Página eletrónica',
  relatorio: 'Relatório',
  capitulo: 'Capítulo de livro',
  tese: 'Dissertação / Tese',
  norma: 'Norma / Legislação',
  webinar: 'Webinar / Vídeo',
}

export interface Reference {
  id: string
  type: RefType
  authors: string
  corporate: boolean
  year: string
  title: string
  source: string
  volume: string
  issue: string
  pages: string
  publisher: string
  edition: string
  editors: string
  url: string
  doi: string
  accessed: string
}

export interface Cover {
  title: string
  subtitle: string
  reportNumber: string
  version: string
  reference: string
  entity: string
  recipient: string
  author: string
  reviewer: string
  approver: string
  classification: string
  location: string
  date: string
  logoId: string
  bannerId: string
}

export interface ImageAsset {
  id: string
  dataUrl: string
  filename: string
  width: number
  height: number
}

export interface Figure {
  id: string
  assetId: string
  url: string
  caption: string
  note: string
  placement: string
}

export interface Finding {
  id: string
  code: string
  severity: Severity
  title: string
  reference: string
  status: string
  evidence: string
  analysis: string
  impact: string
  correction: string
}

export interface ContentSection {
  id: string
  enabled: boolean
  title: string
  body: string
}

export interface ListItem {
  id: string
  text: string
}

export interface Annex {
  id: string
  title: string
  body: string
}

export interface ReportDoc {
  apa: boolean
  annexStyle: 'appendix' | 'anexo'
  /** Quando preenchido, substitui o markdown gerado pelo formulário. */
  manualMd: string
  cover: Cover
  images: ImageAsset[]
  figures: Figure[]
  executiveSummary: { enabled: boolean; text: string }
  objective: { enabled: boolean; items: ListItem[] }
  scope: {
    enabled: boolean
    items: ListItem[]
    methodology: { enabled: boolean; items: ListItem[] }
    notDone: ListItem[]
  }
  sections: ContentSection[]
  findings: {
    enabled: boolean
    intro: string
    items: Finding[]
  }
  conclusion: { enabled: boolean; text: string }
  recommendations: { enabled: boolean; items: ListItem[] }
  references: { enabled: boolean; items: Reference[] }
  annexes: { enabled: boolean; items: Annex[] }
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now()
    .toString(36)
    .slice(-4)}`
}

export function emptyFinding(): Finding {
  return {
    id: uid('f'),
    code: '',
    severity: 'media',
    title: '',
    reference: '',
    status: 'Aberto',
    evidence: '',
    analysis: '',
    impact: '',
    correction: '',
  }
}

export function emptySection(): ContentSection {
  return { id: uid('s'), enabled: true, title: '', body: '' }
}

export function emptyReference(): Reference {
  return {
    id: uid('r'),
    type: 'livro',
    authors: '',
    corporate: false,
    year: '',
    title: '',
    source: '',
    volume: '',
    issue: '',
    pages: '',
    publisher: '',
    edition: '',
    editors: '',
    url: '',
    doi: '',
    accessed: '',
  }
}

export function emptyListItem(text = ''): ListItem {
  return { id: uid('li'), text }
}

const MESES = [
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

export function defaultDoc(): ReportDoc {
  const today = new Date()
  const data = `${today.getDate()} de ${MESES[today.getMonth()]} de ${today.getFullYear()}`

  return {
    apa: true,
    annexStyle: 'appendix',
    manualMd: '',
    cover: {
      title: '',
      subtitle: '',
      reportNumber: '',
      version: '1.0',
      reference: '',
      entity: '',
      recipient: '',
      author: '',
      reviewer: '',
      approver: '',
      classification: 'Interno',
      location: '',
      date: data,
      logoId: '',
      bannerId: '',
    },
    images: [],
    figures: [],
    executiveSummary: { enabled: true, text: '' },
    objective: { enabled: true, items: [] },
    scope: {
      enabled: true,
      items: [],
      methodology: { enabled: true, items: [] },
      notDone: [],
    },
    sections: [],
    findings: { enabled: false, intro: '', items: [] },
    conclusion: { enabled: true, text: '' },
    recommendations: { enabled: true, items: [] },
    references: { enabled: true, items: [] },
    annexes: { enabled: true, items: [] },
  }
}
