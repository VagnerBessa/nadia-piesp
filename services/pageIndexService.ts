import { PAGEINDEX_API_KEY, PAGEINDEX_DOC_ID } from '../config';

const API_BASE = 'https://api.pageindex.ai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices: Array<{
    message: { role: string; content: string };
  }>;
  citations?: Array<{ document: string; page: number }>;
}

/**
 * Consulta a publicação "Demografia Médica no Brasil 2025" via PageIndex Chat API.
 * Retorna resposta completa com citações de páginas.
 */
export async function queryPublication(question: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'api_key': PAGEINDEX_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: question,
          },
        ] as ChatMessage[],
        doc_id: PAGEINDEX_DOC_ID,
        enable_citations: true,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error('[PageIndex] API error:', res.status, res.statusText);
      return `Erro ao consultar a publicação (${res.status}). Tente novamente.`;
    }

    const data: ChatResponse = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Formatar citações como referências de página
    const citations = data.citations || [];
    const pages = [...new Set(citations.map(c => c.page))].sort((a, b) => a - b);
    const pagesRef = pages.length > 0 ? `\n\n[Referência: páginas ${pages.join(', ')} da publicação]` : '';

    return content + pagesRef;
  } catch (err) {
    console.error('[PageIndex] Fetch error:', err);
    return 'Não foi possível consultar a publicação no momento. Por favor, tente novamente.';
  }
}

/**
 * Busca conteúdo de páginas específicas da publicação.
 */
export async function getPageContent(pages: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/doc/${PAGEINDEX_DOC_ID}/?type=ocr&format=page`, {
      headers: { 'api_key': PAGEINDEX_API_KEY },
    });

    if (!res.ok) {
      return `Erro ao acessar páginas (${res.status}).`;
    }

    const data = await res.json();
    return JSON.stringify(data.result || data);
  } catch (err) {
    console.error('[PageIndex] Page fetch error:', err);
    return 'Não foi possível acessar as páginas da publicação.';
  }
}
