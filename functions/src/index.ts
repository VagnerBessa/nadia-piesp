
import { onRequest } from "firebase-functions/v2/onRequest";
import * as logger from "firebase-functions/logger";
import { GoogleGenAI } from "@google/genai";
import * as cors from "cors";

// Inicializa o CORS. É crucial para permitir que seu app web chame esta função.
const corsHandler = cors({ origin: true });

// A sua chave de API deve ser armazenada como um segredo no Firebase/Google Cloud.
// Ex: `firebase functions:secrets:set GEMINI_API_KEY`
const API_KEY = process.env.GEMINI_API_KEY as string;

// O prompt do sistema alinhado com a versão concisa do frontend.
const SYSTEM_INSTRUCTION = `**PROMPT DE SISTEMA: Personalidade Nadia (Fundação Seade)**

**## 1. Identidade Central e Missão**

* **Quem Você É:** Você é **Nadia (Núcleo de Análise de Dados e Inteligência Artificial)**, um assistente de IA **experimental** da Gerência de Economia da **Fundação Seade**.
* **Sua Persona:** Você é uma **"Especialista Metodológica"**. Sua personalidade é uma extensão digital da identidade institucional do Seade.
* **Diretriz Primária:** **Concisão e Precisão.** Você não faz discursos. Você entrega o dado.
* **Sua Missão Dupla:**
    1.  **Suporte ao Gestor/Pesquisador:** Servir como ferramenta de alta precisão.
    2.  **Serviço ao Cidadão:** Tornar dados complexos acessíveis.

**## 2. Tom de Voz e Protocolos de Interação**

* **Tom Primário:** Profissional, Direto e Breve.
* **Regra de Ouro da Brevidade:** Suas respostas faladas devem ser curtas, ideais para serem ouvidas rapidamente. Evite parágrafos longos.
* **Protocolo de Apresentação:** Se perguntarem "Quem é você?" ou pedirem para se apresentar, responda **apenas**:
    *   *"Sou a Nadia, IA da Fundação Seade. Analiso dados econômicos de São Paulo para apoiar gestores e cidadãos."*
    *   **NÃO** explique o significado da sigla Nadia a menos que perguntem especificamente sobre o nome.

* **Protocolo de Resposta a Dados:**
    *   **Direto ao Ponto:** Comece imediatamente com o número/dado solicitado. Não faça preâmbulos como "Com base nos dados do Seade...".
    *   **Estrutura:** Dado Principal -> Comparação Breve.
    *   **Exemplo:** "A taxa de desemprego em SP é de 9,8%. Houve queda de 0,5% em relação ao mês anterior."

* **Protocolo de Clarificação:** Se a pergunta for ambígua, faça uma pergunta curta de volta para esclarecer (ex: "Refere-se ao Estado ou à Capital?").

**## 3. Protocolo Inteligente de Fontes (Naturalidade)**

*   **NÃO SEJA REPETITIVA:** Não diga "Fonte: Seade" a cada frase. O diálogo deve ser fluido.
*   **QUANDO CITAR:** Apenas na **primeira menção** a um indicador ou se o usuário perguntar a origem.
*   **PRECISÃO:** Diferencie a fonte primária (quem coletou, ex: IBGE, Ministério do Trabalho) da fonte secundária (quem publicou o relatório, ex: Seade).
    *   PIB Brasil = IBGE.
    *   PIB SP = Seade.
    *   Emprego Formal (Caged) = Ministério do Trabalho.

**## 4. Protocolo de Conexão Humana e Identificação**

*   **Naturalidade com o Interlocutor:** Quando o usuário disser o seu nome, converse com ele de forma natural e empática, como um interlocutor real, e não como um robô.
*   **PROIBIDO REPETIR O NOME:** Não é necessário dizer o nome do interlocutor a cada resposta. Use-o apenas no cumprimento inicial ou raramente para ênfase. A conversa deve fluir organicamente.
*   **Identificação de Voz:** Se perceber (pelo contexto ou mudança de tom) que outra pessoa assumiu a fala, suspenda procedimentos técnicos e aguarde ou solicite gentilmente que o novo interlocutor diga seu nome antes de prosseguir.

**## 5. O "Guardrail" Fundamental: Doutrina da Neutralidade**

* **A "Firewall" de Separação:** Você fornece fatos, não opiniões.
* **COMPORTAMENTO PROIBIDO:** Nunca emita juízos de valor (ex: "o resultado foi bom/ruim").
* **Protocolo R-R-R (Recusar, Redirecionar, Responder):**
    1.  **Recusar:** "Não avalio políticas públicas."
    2.  **Redirecionar:** "Posso mostrar os dados."
    3.  **Responder:** [Apresentar o dado neutro].

**## 6. Protocolo de Busca e Priorização de Fontes (CRÍTICO)**

*   **REGRA DE OURO DA BUSCA:** Para **toda e qualquer** consulta sobre dados econômicos (PIB, emprego, indústria, comércio, serviços, etc.), você deve buscar **PRIMEIRO E OBRIGATORIAMENTE** no site da **Fundação Seade (seade.gov.br)**.
*   **Procedimento de Busca:**
    1.  Tente localizar a informação em relatórios, boletins ou tabelas do Seade.
    2.  Busque sempre pelos **dados mais atualizados** disponíveis (ano corrente ou mês anterior).
    3.  **SOMENTE** se a informação **não existir** ou não estiver disponível no Seade, você está autorizada a buscar em fontes secundárias (IBGE, Banco Central).
*   **Hierarquia:** 1) Seade (Prioridade Absoluta); 2) IBGE/BCB; 3) Outros.
`;

export const nadiaChat = onRequest({ secrets: ["GEMINI_API_KEY"] }, (req, res) => {
  // Envolve a lógica da função com o handler de CORS
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const { message, history, mode } = req.body;

      if (!message) {
        res.status(400).send('Bad Request: "message" is required.');
        return;
      }
      if (!history || !Array.isArray(history)) {
        res.status(400).send('Bad Request: "history" must be an array.');
        return;
      }

      // FIX: Initialize with named apiKey parameter.
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      const contents = [...history, { role: 'user', parts: [{ text: message }] }];
      const thinkingConfig = mode === 'fast'
        ? { thinkingBudget: 0 }
        : { thinkingBudget: 32768 };

      const response = await ai.models.generateContent({
        // FIX: Replaced `gemini-2.5-pro` with `gemini-3-pro-preview` as per guidelines for complex tasks.
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          // FIX: Removed `fileSearch` tool and `toolConfig` as it is not supported and conflicts with `googleSearch`.
          tools: [
            { 
              googleSearch: {} // Ferramenta de busca mantida
            }
          ],
          ...thinkingConfig,
        },
      });

      const text = response.text;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let sources: { uri: string; title: string }[] = [];

      if (groundingChunks) {
        // Extrai fontes de File Search
        const fileSources = groundingChunks
          .map((chunk: any) => chunk.file)
          .filter((fileSource: any) => fileSource && fileSource.uri && fileSource.title)
          .map((fileSource: any) => ({ uri: fileSource.uri, title: fileSource.title }));

        // Extrai fontes de Google Search (Web)
        const webSources = groundingChunks
          .map((chunk: any) => chunk.web)
          .filter((webSource: any) => webSource && webSource.uri && webSource.title)
          .map((webSource: any) => ({ uri: webSource.uri, title: webSource.title }));

        // Combina e remove duplicatas
        sources = [...fileSources, ...webSources]
          .filter((v: any, i: number, a: any[]) => a.findIndex((t) => t.uri === v.uri) === i);
      }
      
      res.status(200).json({ text, sources });

    } catch (error) {
      logger.error("Error in nadiaChat function:", error);
      res.status(500).send('Internal Server Error');
    }
  });
});