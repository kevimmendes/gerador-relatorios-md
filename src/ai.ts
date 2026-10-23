/**
 * Geração de relatório com IA via API gratuita.
 * Usa a API de modelos gratuitos (OpenRouter) ou permite chave própria.
 * Funciona direto no browser.
 */

export interface AIGenOptions {
  briefing: string
  reportType: string
  audience: string
  tone: 'formal' | 'muito-formal'
  includeFindings: boolean
  includeRecommendations: boolean
  includeReferences: boolean
  language: 'pt'
}

export interface AIConfig {
  provider: 'openrouter' | 'openai-compatible'
  baseUrl: string
  apiKey: string
  model: string
}

const CONFIG_KEY = 'relatorio.ai.config.v1'

export const DEFAULT_CONFIG: AIConfig = {
  provider: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'google/gemini-2.5-flash-preview-05-20',
}

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw) as Partial<AIConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveAIConfig(c: AIConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  } catch {}
}

const SYSTEM_PROMPT = `Você é um redator especialista em relatórios institucionais e técnicos em português de Portugal.

Sua única tarefa é criar um relatório COMPLETO e PRONTO para uso, no formato Markdown estrito.

REGRAS OBRIGATÓRIAS:
- Escrita em português formal, objetivo, conciso e impessoal.
- Use apenas a estrutura solicitada.
- Não invente dados numérico complexos sem base no briefing.
- Formate tudo em Markdown válido.
- Use tabelas sempre que fizer sentido (capa, limitações).
- Crie seções numeradas no texto, mas NÃO escreva "1.", "2." no título pois o sistema numera automaticamente.
- Para referências, use o padrão APA 7.ª edição.
- Para anexos, use formato "Appendix A", "Appendix B" se solicitado ou conforme padrão.
- O output deve ser JSON estrito com esta estrutura exatamente:

{
  "cover": {
    "title": "",
    "subtitle": "",
    "reportNumber": "",
    "version": "1.0",
    "reference": "",
    "entity": "",
    "recipient": "",
    "author": "",
    "reviewer": "",
    "approver": "",
    "classification": "Interno",
    "location": "",
    "date": ""
  },
  "executiveSummary": "",
  "objective": ["..."],
  "scope": ["..."],
  "methodology": ["..."],
  "notDone": ["..."],
  "sections": [{"title": "", "body": ""}],
  "findings": [{"code": "A-01", "severity": "alta", "title": "", "reference": "CWE-XXX", "status": "Aberto", "evidence": "", "analysis": "", "impact": "", "correction": ""}],
  "conclusion": "",
  "recommendations": ["..."],
  "references": [{"type": "website", "authors": "", "corporate": false, "year": "2026", "title": "", "source": "", "url": "", "accessed": ""}],
  "annexes": [{"title": "", "body": ""}]
}

Responda APENAS com o JSON válido, sem markdown, sem explicações, sem texto adicional.`

export async function generateWithAI(
  opts: AIGenOptions,
  config: AIConfig,
): Promise<any> {
  if (!config.apiKey.trim()) {
    throw new Error('Falta a chave da API. Configure em Aparência/IA.')
  }

  const userPrompt = `Gere um relatório com base neste briefing:

BRIEFING:
${opts.briefing}

PARÂMETROS:
- Tipo: ${opts.reportType || 'Relatório técnico'}
- Público-alvo: ${opts.audience || 'Não especificado'}
- Tom: ${opts.tone === 'muito-formal' ? 'Muito formal e institucional' : 'Formal'}
- Incluir achados: ${opts.includeFindings ? 'Sim' : 'Não'}
- Incluir recomendações: ${opts.includeRecommendations ? 'Sim' : 'Não'}
- Incluir referências bibliográficas: ${opts.includeReferences ? 'Sim' : 'Não'}
- Idioma: Português (Portugal)

Crie um relatório completo, coerente, pronto para entrega.`

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': location.origin,
      'X-Title': 'Gerador de Relatórios MD',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Erro API: ${res.status} - ${txt.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''

  // Remove markdown code block se houver
  let json = content.trim()
  if (json.startsWith('```')) {
    json = json.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
  }

  try {
    return JSON.parse(json)
  } catch {
    throw new Error('A IA retornou um JSON inválido. Tente novamente com um briefing mais claro.')
  }
}
