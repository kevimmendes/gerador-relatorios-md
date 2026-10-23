# Gerador de Relatórios em Markdown

Aplicação web que gera relatórios formais em Markdown, com estrutura institucional
e referências/anexos no **padrão APA (7.ª edição)**.

## Como executar

```bash
npm install
npm run dev
```

Abrir: http://localhost:5173

Para gerar versão de produção:

```bash
npm run build
npm run preview
```

## Estrutura do relatório gerado

1. **Capa** — título, subtítulo, nº do relatório, versão, referência, entidade,
   destinatário, elaborado/revisto/aprovado por, classificação, local e data.
2. **Sumário** — gerado automaticamente com links para cada secção.
3. **Resumo Executivo** — texto livre em Markdown.
4. **Objetivo** — lista de tópicos.
5. **Âmbito e Metodologia** — âmbito em tópicos, metodologia em tópicos
   (secção autónoma) e limitações em tabela.
6. **Secções adicionais** — quantas forem necessárias, numeradas automaticamente.
7. **Achados e Resultados** — blocos formais com Evidência → Análise → Impacto → Correção.
8. **Conclusão** — texto corrido.
9. **Recomendações** — lista numerada.
10. **Referências** — APA 7.ª edição, ordenadas alfabeticamente, com citação no texto.
11. **Anexos** — formato APA (`Appendix A`, título em negrito, conteúdo) ou `Anexo A`.

## Referências APA — campos suportados

| Tipo | Campos usados |
|---|---|
| Livro | Autor, Ano, Título, Edição, Editora |
| Artigo de revista | Autor, Ano, Título, Revista, Volume, Número, Páginas, DOI |
| Website | Autor, Ano, Título, Site, Data de consulta, URL |
| Relatório | Autor, Ano, Título, Editora/Instituição |
| Capítulo de livro | Autor, Ano, Título, Editores, Livro, Páginas, Editora |
| Dissertação/Tese | Autor, Ano, Título, Grau, Instituição |
| Norma/Legislação | Autor, Ano, Título, Editora, Referência |
| Webinar/Vídeo | Autor, Ano, Título, Site, Data de consulta, URL |

Exemplo de saída:

```
Silva, J., & Costa, M. (2020). A methodology for security header analysis.
*Journal of Information Security*, 12(3), 45-67. https://doi.org/10.1000/jis.2020.123
```

Ao marcar **“Autor(es) é uma instituição”**, o nome é transcrito por extenso
(`OWASP Foundation`, e não `Foundation, O.`), conforme APA 7.

## Funcionalidades

- Pré-visualização em tempo real (renderizada e Markdown bruto editável)
- Modo manual: ao editar o Markdown, ele passa a ser a fonte do documento
- Geração completa a partir de um guião com IA (OpenRouter, OpenAI, Groq, Ollama)
- Colaboração em tempo real por sala (Yjs + WebRTC), com presença online
- Download do ficheiro `.md`, pacote `.zip`, página `.html` e impressão em PDF
- Cópia do Markdown para a área de transferência
- Numeração automática de secções e anexos (A, B, C…)
- Sumário com âncoras compatíveis com GitHub/Obsidian

## IA

O botão **IA** abre um assistente que recebe um guião em linguagem natural e
devolve capa, resumo, objetivo, âmbito, metodologia, secções, achados,
referências APA e anexos já preenchidos.

A chave da API é guardada apenas no `localStorage` do navegador. Qualquer
endpoint compatível com a API de *chat completions* funciona; por omissão
usa OpenRouter.

## Stack

- Vite 8 + TypeScript
- Tailwind CSS 4
- marked (renderização do preview)
