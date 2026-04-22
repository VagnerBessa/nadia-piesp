# CLAUDE.md — Contexto do Projeto

Lido automaticamente pelo Claude Code no início de cada sessão.
Para detalhes, ver `docs/`.

---

## Visão Geral

**Nadia-PIESP** — assistente de IA da Fundação Seade para análise de investimentos no Estado de São Paulo (PIESP).

- **Stack:** React 19 + TypeScript + Vite, Material-UI + Tailwind CSS
- **IA:** Google Gemini 2.5 Flash (chat e relatórios), Gemini Live API (voz)
- **Dados:** CSVs do PIESP em `knowledge_base/` (importados como `?raw` via Vite)
- **Sem backend** — app puramente frontend

---

## Regra de Ouro: Dados Tabulares vs Contexto Longo

| Tipo de conteúdo | Estratégia | Por quê |
|---|---|---|
| Texto narrativo (metodologia, regras) | Contexto longo (`systemInstruction`) | LLMs compreendem prosa com excelência |
| Dados tabulares / CSV | Function Calling (Tools) | LLMs falham em filtrar e agregar linhas numéricas densas |
| Dados pequenos (< 50 linhas) | Contexto longo | Volume insignificante |

---

## Deploy Vercel — Branch `feature/nadia-mobile` — 14/abr/2026

### URL de produção
**https://nadia-piesp-mobile.vercel.app**

Projeto Vercel: `vagner-bessas-projects/nadia-piesp-mobile`

### Como fazer redeploy
```bash
cd "/Users/vagnerbessa/Library/Mobile Documents/com~apple~CloudDocs/Seade/Piesp/Nadia-PIESP"
npx vercel --prod --yes
```

### Variáveis de ambiente no Vercel
Três variáveis configuradas em Production:
- `VITE_GEMINI_API_KEY` — chave do AI Studio (conta pessoal, não @seade.gov.br)
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_OPENROUTER_API_KEY`

Para atualizar uma variável:
```bash
npx vercel env rm NOME_DA_VAR production --yes
printf '%s' "NOVO_VALOR" | npx vercel env add NOME_DA_VAR production --yes
npx vercel --prod --yes
```

**Regra:** usar `printf '%s'` e não `echo` — o `echo` adiciona `\n` ao final, corrompendo o valor da chave.

---

### Problemas encontrados no deploy e soluções

#### Problema 1: `config.ts` no `.gitignore` impedia o build correto no Vercel

**Sintoma:** Chat e voz retornavam "Problema com a chave de API" mesmo com as variáveis configuradas no Vercel.

**Causa:** `config.ts` estava no `.gitignore`. O Vercel CLI usa o `.gitignore` como filtro de upload quando não existe `.vercelignore`. Sem o `config.ts`, o Vite não conseguia injetar as variáveis `VITE_*` corretamente.

**Solução:** Remover `config.ts` do `.gitignore` e commitá-lo. É seguro — o arquivo agora usa apenas `import.meta.env.VITE_*`, sem chaves hardcoded.

---

#### Problema 2: Chave de API bloqueada pelo Google ("API key was reported as leaked")

**Sintoma:** Curl direto à API retornava `403 — Your API key was reported as leaked`.

**Causa:** A chave original (`AIzaSyD_nULg...`) apareceu em texto plano nesta conversa quando o Claude leu o arquivo `.env`. O Google monitora repositórios e conversas públicas e revoga chaves expostas automaticamente.

**Solução:** Gerar nova chave e atualizar o Vercel. **Nunca ler o `.env` em voz alta nem compartilhar chaves no chat.**

---

#### Problema 3: Organização Seade no Google Cloud exige conta de serviço

**Sintoma:** A chave criada no Google Cloud Console (projeto Seade) tinha formato `AQ.Ab8RN...` em vez de `AIzaSy...`, e não funcionava como chave de API simples.

**Causa:** A organização Seade tem uma policy que obriga todas as chaves Gemini/Vertex a serem vinculadas a uma conta de serviço (`nadia-vercel@gen-lang-client-0635245579.iam.gserviceaccount.com`). Esse tipo de chave é OAuth2 e não pode ser usada diretamente em um app frontend estático.

**Solução:** Criar a chave pelo **Google AI Studio** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) com uma **conta Google pessoal** (não @seade.gov.br). Chaves do AI Studio têm o formato `AIzaSy...` e funcionam normalmente em frontends.

**Regra para o futuro:** Qualquer nova chave Gemini para deploy externo deve ser criada via AI Studio com conta pessoal, não pelo Console da organização Seade.

---

## Correções de Fluxo de Voz e UX Conversacional — 22/abr/2026

Sessão focada em resolver três categorias de problemas na experiência de voz da Nadia Mobile (`nadia-mobile/0.2`): truncamento de áudio por eco, prompt engineering para fluxo conversacional, e bugs visuais de transcrição/UI.

### 1. Truncamento de Voz por Echo Cancellation (Half-Duplex Fix)

**Problema:** A Nadia começava a responder, dizia "um instante", buscava os dados, mas a voz era cortada abruptamente no meio da resposta. O status ficava preso em "ouvindo" e a transcrição parava.

**Causa raiz:** O áudio da resposta da Nadia saía pelo alto-falante do celular e era captado pelo microfone do próprio dispositivo. O Gemini Live API possui um sistema de **Barge-in** (interrupção) muito sensível — ao "ouvir" qualquer som enquanto fala, ele envia um evento `interrupted: true` que cancela imediatamente o áudio em curso, achando que o usuário o interrompeu. O resultado era uma fala truncada e fragmentada.

**Solução:** Implementamos um **modo Half-Duplex (Walkie-Talkie)** no `useLiveConnection.ts`:
- Adicionado `isSpeakingRef = useRef<boolean>(false)` sincronizado com `setIsSpeaking`.
- No `onaudioprocess`, adicionada a guarda `if (isSpeakingRef.current) return;` — enquanto a IA estiver falando, o envio de dados do microfone para a API é completamente bloqueado.
- Quando a IA termina de falar, o microfone é religado automaticamente.

**Tentativa que deu errado:** Inicialmente, o `isSpeakingRef.current = false` estava **dentro** do `setTimeout(2500)` (o debounce visual que impede a animação de piscar). Isso significava que, após a IA parar de falar, o microfone ficava **mutado por 2.5 segundos extras**. O usuário respondia "Sim" imediatamente mas o áudio era descartado — o Gemini nunca recebia a resposta.

**Solução definitiva:** Separamos os dois comportamentos:
- `isSpeakingRef.current = false` → executa **instantaneamente** quando o último buffer de áudio termina de tocar (desmuta o mic)
- `setIsSpeaking(false)` → continua com debounce de 2.5s (apenas para a animação visual)

**Regra:** Em manipuladores de áudio com dependência temporal, sempre separar sinais de controle funcional (mic mute) de sinais visuais (animação). O visual pode ter debounce; o funcional deve ser imediato.

### 2. Prompt Engineering: Eliminação do "Atropelamento" e Restauração do Filler

**Problema 1 (Atropelamento):** Após responder com o resumo macro e perguntar "Deseja que eu detalhe?", a Nadia não esperava o "Sim" e disparava imediatamente a ferramenta de detalhamento, falando por cima de si mesma.

**Causa:** O modelo `gemini-2.5-flash-native-audio-preview` é extremamente proativo (temperature alta implícita). Ao terminar a pergunta de ancoragem, ele mesmo deduzia que o usuário "provavelmente quer saber mais" e disparava a tool call sem aguardar confirmação verbal.

**Solução:** Inserida regra severa na `SYSTEM_INSTRUCTION` (via `useLiveConnection.ts`):
```
ATENÇÃO: APÓS FAZER A PERGUNTA, VOCÊ DEVE PARAR DE FALAR IMEDIATAMENTE.
É ESTRITAMENTE PROIBIDO detalhar as empresas logo em seguida na mesma fala.
Espere o usuário responder "Sim".
NUNCA DISPARE A FERRAMENTA DE FALLBACK OU SECUNDÁRIA ANTES DE OUVIR O "SIM" DO USUÁRIO.
```

**Problema 2 (Filler silenciado):** A Nadia parou de dizer "Um instante, vou buscar os dados..." antes de acionar a ferramenta.

**Causa:** Na tentativa de blindar o prompt contra atropelamento, inserimos uma regra excessivamente agressiva: `"TERMINANTEMENTE PROIBIDO começar a responder a pergunta ou despejar conhecimento genérico"`. Isso "assustou" o modelo a ponto dele não dizer **absolutamente nada** antes da tool call — nem a frase preenchedora.

**Solução:** Removida a regra de "PROIBIÇÃO ABSOLUTA" e substituída por uma instrução mais suave e diretiva:
```
Se você precisar consultar a base de dados do PIESP, você OBRIGATORIAMENTE deve avisar
o usuário ANTES de chamar a ferramenta, usando uma frase preenchedora MUITO CURTA
(ex: "Um instante", "Vou buscar os dados..."). Fale apenas essa frase curta e acione a ferramenta.
```

**Lição aprendida:** Prompt engineering para modelos de voz nativa exige dosagem precisa. Instruções em tom de "PROIBIÇÃO ABSOLUTA" podem causar efeitos colaterais piores que o problema original — o modelo pode se calar completamente em vez de moderar. Preferir instruções **afirmativas e específicas** ("faça X") a proibições genéricas ("NUNCA faça Y").

### 3. Auto-scroll Travado no iOS Safari

**Problema:** A transcrição parava de rolar automaticamente após um determinado número de linhas. O texto continuava sendo gerado (o áudio seguia), mas o container não rolava — o usuário tinha que arrastar manualmente para ver o texto novo.

**Causa:** O `scrollIntoView({ behavior: 'auto', block: 'end' })` **não funciona de forma confiável** em containers com `position: absolute` no Safari/WebKit mobile. O motor do navegador ignora silenciosamente o pedido de scroll em certas geometrias de layout.

**Tentativa anterior (que funcionava parcialmente):** Na sessão de 20/abr, tínhamos substituído `scrollTop` forçado pelo `scrollIntoView` com elemento âncora. Isso melhorou o conflito com o WebKit para scrolls curtos, mas falhou em transcrições longas.

**Solução definitiva:** Revertemos para `el.scrollTop = el.scrollHeight` direto — a forma mais primitiva e segura de forçar scroll — mas mantendo o Smart Scroll (checagem `isNearBottom < 100px`). O `scrollIntoView` foi removido completamente.

**Regra:** Em iOS Safari com containers `position: absolute`, sempre usar `scrollTop = scrollHeight`. Nunca confiar em `scrollIntoView` para scroll automático contínuo.

### 4. Texto Persistente Após Encerramento da Conversa

**Problema:** Ao encerrar a conversa, a esfera voltava ao centro mas o texto da transcrição ficava visível atrás dela, criando uma sobreposição visual desagradável.

**Causa (camada 1 — Transcrição):** O container de transcrição tinha condição `(isConnected && !isImmersive) || (!isConnected && hasTranscript)` — a segunda parte mantinha o texto visível após desconexão. Além disso, a transição de fade era de 1000ms, deixando o texto parcialmente visível durante a animação.

**Solução (camada 1):** Revertido para `isConnected && !isImmersive` (oculta ao desconectar). Adicionada limpeza instantânea do DOM: `transcriptTextRef.current.textContent = ''` no `useEffect` de desconexão. Fade-out acelerado para 200ms (era 1000ms).

**Causa (camada 2 — Status "Pronta para conversar"):** Mesmo após ocultar a transcrição, o texto **"Pronta para conversar"** dos controles inferiores continuava visível atrás da esfera centralizada. A esfera não cobre 100% da viewport, então fragmentos do texto ("Pron..." e "...rsar") ficavam visíveis nas bordas.

**Solução (camada 2):** Condicional no status: quando `hasTranscript` é `true` e `!isConnected`, o status mostra string vazia em vez de "Pronta para conversar".

**Lição aprendida:** Bugs visuais de sobreposição em mobile têm múltiplas camadas. Resolver a camada óbvia (transcrição) pode revelar uma camada oculta (texto de status) que usa z-index diferente. Sempre testar com screenshot real do device.

### 5. Botão "Salvar Conversa" Sobreposto ao Botão de Voz

**Problema:** O botão "Salvar Conversa" usava `position: absolute; bottom-6; left-6` e ficava sobreposto ao botão de microfone no mobile.

**Solução:** Movido para dentro do fluxo flex dos controles inferiores, renderizado condicionalmente (`!isConnected && hasTranscript`) com animação `fade-in slide-in-from-bottom-4`. Agora aparece centralizado abaixo do botão de voz, sem sobreposição.


### 6. Status "Buscando informações..." Sumia Instantaneamente (toolProcessing Race Condition)

**Problema:** Ao acionar uma ferramenta, o status mostrava "Ouvindo você..." em vez de "Buscando informações...". A Nadia ficava muda e o indicador visual não refletia que uma consulta estava em andamento.

**Causa raiz:** O `toolProcessing` era gerenciado em dois locais desconectados:
- `VoiceView.tsx` setava `toolProcessing = true` via callback `onToolCall`
- Um `useEffect` resetava para `false` sempre que `isSpeaking` era `true`
- Mas `isSpeaking` **já era** `true` por causa do filler ("Vou pesquisar..."), então o estado era cancelado na mesma renderização

**Solução:** Migramos `toolProcessing` para dentro do hook `useLiveConnection.ts`:
- `toolProcessing = true` → quando o `message.toolCall` chega (antes de executar)
- `toolProcessing = false` → quando o primeiro buffer de áudio da **resposta** chega (a IA começou a falar os resultados)
- Removido o `useEffect` que limpava `toolProcessing` baseado em `isSpeaking`
- O hook agora exporta `toolProcessing` e o VoiceView consome diretamente

**Tentativa que deu errado (Mic Mute durante Tool Processing):** Tentamos também mutar o mic com `toolProcessingRef.current` (mesmo padrão do `isSpeakingRef`). Resultado: **a conexão WebSocket caía após ~2s**. O Gemini Live API exige **fluxo de áudio contínuo** (keepalive). Ao parar de enviar pacotes de áudio por 2.5s (o timeout do tool response), o servidor interpretava como queda de conexão e fechava o socket.

**Regra crítica descoberta:** O mic NUNCA deve ser completamente silenciado durante tool processing. O fluxo de áudio ambiente serve como **heartbeat** para o WebSocket. O mic só pode ser mutado quando há áudio fluindo na direção oposta (IA falando → `isSpeakingRef`), porque nesse caso o servidor sabe que a conexão está ativa.

| Cenário | Mic | Por quê |
|---|---|---|
| IA falando (filler/resposta) | 🔇 Mutado | Anti-echo — o servidor recebe áudio próprio e cancela por barge-in |
| Tool processing (silêncio) | 🔊 Aberto | Keepalive — o servidor precisa receber pacotes para manter o WebSocket |
| Despedida (`pendingDisconnect`) | 🔇 Mutado | Desconexão intencional — não importa se o socket cair |

### Arquivos Modificados
- `hooks/useLiveConnection.ts` — Half-duplex mic mute, prompt engineering, toolProcessing centralizado
- `components/VoiceView.tsx` — Auto-scroll iOS, cleanup de transcrição, reposição do botão download, ocultação de status text

### Commits (branch `nadia-mobile/0.2`)
1. `fix(voice): desativa barge-in mutando mic enquanto a IA fala`
2. `fix(voice): desmuta mic instantaneamente ao fim da fala da IA`
3. `fix(voice): corrige auto-scroll iOS, esconde texto ao desconectar, reposiciona botão download`
4. `fix(voice): limpa texto do DOM instantaneamente ao desconectar e acelera fade-out para 200ms`
5. `fix(voice): esconde texto 'Pronta para conversar' após sessão`
6. `fix(voice): migra toolProcessing para o hook e corrige status "Buscando informações..."`
7. `fix(voice): remove mic mute durante tool processing — Live API exige fluxo contínuo`

---

## Correções de Estabilidade — 20/abr/2026

Dois bugs identificados em revisão de código da `nadia-mobile/0.2` e corrigidos cirurgicamente, sem alterar nenhum comportamento funcional existente.

### 1. Stale Closure no `onclose` (`useLiveConnection.ts`)
**Problema:** O callback `onclose` capturava `isConnected` como `false` permanentemente (valor do momento da criação do closure), fazendo com que a mensagem de erro de desconexão inesperada nunca fosse exibida ao usuário.
**Solução:** Adicionado `isConnectedRef` sincronizado via `useEffect`. O `onclose` agora lê `isConnectedRef.current`, que sempre reflete o valor real do estado.
**Regra:** Todo callback de WebSocket/EventListener criado dentro de `startConversation` deve usar refs, não state diretamente.

### 2. Console.log em Produção no Loop de Áudio
**Problema:** O `onaudioprocess` logava a cada 100 pacotes e a cada 50 pacotes com áudio — poluindo o console em sessões reais.
**Solução:** Removidos os contadores `totalPackets`/`audioPacketCount` e seus `console.log`. Zero impacto funcional.

**Não alterado intencionalmente:** o `setTimeout(2500)` no `sendToolResponse` (documentado como correção ao bug de auto-interrupção da frase filler).

### 3. Fricção de DOM, WebKit e Estabilidade Visual de Voz (UX)
**Problema:** O scroll matemático da transcrição (`scrollTop`) conflitava agressivamente com o motor WebKit do iOS, gerando saltos e travando o pipeline da Live API. Além disso, no encerramento da conversa, a Esfera gigante sobrepunha o texto gerado e o botão "Salvar" não possuía boa visibilidade.
**Solução:** 
- A rolagem forçada foi substituída por um elemento **âncora invisível (`scrollIntoView`)**. Um algoritmo de *Smart Scroll* foi criado para pausar o auto-scroll automaticamente se o usuário rolar para cima para consultar o histórico.
- O bug visual de "tampão" da Esfera foi resolvido dissociando o CSS do estado de rede (`isConnected`); a posição agora respeita estritamente o `isImmersive`, permitindo a leitura pós-chamada com um clique. O botão "Salvar" foi promovido a um botão em pílula centralizado.
**Regra Crítica (Vercel):** Nunca diagnostique sessões interativas (WebSockets/Live API) na URL de produção durante Pair Programming. A latência de propagação de cache da Vercel e Edge Networks corrompe o diagnóstico, fazendo o dev pensar que o código atual quebrou. Homologação de Voice UX deve **sempre** ocorrer via IP na rede local.

---

## Otimização de Voice UX (Fase 2) — 19/abr/2026

Aprimoramentos de latência percebida e comportamento humano na interface de voz da Nadia (`nadia-mobile/0.2`).

### 1. UX Hack: Retardo do Tool Response (Anti-Self-Interrupt)
**Problema:** A Live API sofre de auto-interrupção se ferramentas locais forem demasiadamente rápidas. O modelo começava a dizer "Vou buscar os dados...", disparava a tool que terminava em milissegundos, recebia a resposta via `sendToolResponse` e, imediatamente, começava a falar a resposta em si, "engolindo" a frase filler.
**Solução:** No retorno das ferramentas em `useLiveConnection.ts`, foi injetado um `setTimeout` artificial de **2500ms** na devolução da promise para o `session.sendToolResponse`. Isso garante o tempo exato para o motor TTS (Text-to-Speech) finalizar a frase filler sem engasgos, conferindo extrema fluidez.

### 2. Regra de Continuidade (Memória Conversacional)
**Problema:** Ao realizar um drill-down investigativo (ex: "E quais as empresas disso?"), a Nadia repetia roboticamente o cabeçalho financeiro global respondido na frase anterior.
**Solução:** Inserida a instrução "Memória Conversacional (Não seja redundante)" no core do sistema (`prompts.ts` e `useLiveConnection.ts`). A IA é instruída a NÃO repetir valores macro já ditos e pular direto para os detalhes, com uma **exceção explícita** para o caso de o usuário verbalizar o pedido de repetição.

### 3. Blindagem Semântica nas Tools de Voz (Correção CNAE)
**Problema:** Apesar da solução "CNAE" de 14/abr, a UI de Voz continuava inventando macro-setores errados (ex: `setor: "saúde"`) causando um *empty set* e travando as buscas.
**Solução:** O prompt de descrição dos parâmetros `setor` e `termo_busca` em `useLiveConnection.ts` foi substituído pela mesma malha de ferro do `useChat.ts` (uma *hard-instruction* na declaração das Function Calls), obrigando o LLM a mapear demandas de subsetores para o campo `termo_busca` em branco.

---

## Otimização de Voice UX e Igualdade Semântica — 17/abr/2026

Implementação de paradigmas de VUI (Voice User Interface) para branch `nadia-mobile/0.2`:

### 1. Refinamento Acústico e Multimodal
- **Anti-Amnésia React**: Gravação do timestamp via `localStorage` para reconectar sessões e impedir que a IA se reapresente eternamente se a conexao falhar.
- **Multimodal e Micro-Latência**: IA forçada a enviar um áudio minúsculo de delay e calar a boca temporariamente via Prompt-Lock; um `setTimeout(1500)` artificial executa o feedback ciano na tela ("Buscando informações...") garantindo alívio visual.
- **Desocultamento Progressivo & Graceful Fallback**: A inteligência foi treinada a não "vomitar" projetos numericamente exaustivos. Entrega o valor macro seguido de pergunta-âncora. Em becos sem saída, sugere mudanças de escopo organicamente.

### 3. Handshake de Encerramento e Prosódia (Autonomous Disconnect)
A IA foi programada para assumir o controle do hardware nas despedidas ("Tchau", "É só isso").
- **Corte de Hook**: A API engatilha *stopConversation* após um delay militar de 4s, travando micro-ouvintes.
- **Prosódia Modelada**: A instrução força a IA a modular a voz em baixa velocidade (ritmo calmante e menos robótico) para realizar a despedida.
- **Anti-Alucinação**: Uma trava de segurança impede que o LLM engate outro raciocínio por baixo dos panos após invocar o fechamento.


### 2. Equalização Semântica (CNAE + Investidora)
A busca na base **Sem Valor** era capenga se comparada à busca **Com Valor**.
**Solução:** Todas as funções de indexação lexical em `piespDataService.ts` (Mobile) e `mcp-server/src/piespService.ts` (Servidor padrão do Chat) foram refatoradas para abraçar 100% da árvore `cnae` e, criticamente, mapear nomes descritos na coluna `investidora_s`. O sistema sabe o "nome verdadeiro da marca" através do parseamento `Empresa Alvo (Matriz Investidora)`.

---

## Correção: Busca por Atividade Econômica (CNAE) — 14/abr/2026

### Problema
Buscas por termos como "saúde", "hospital", "educação", "turismo" retornavam zero resultados mesmo existindo investimentos relacionados na base.

### Causa
O `termo_busca` em `consultarPiespData()` e `consultarAnunciosSemValor()` pesquisava apenas três campos: empresa + setor + descrição do investimento. Porém, o PIESP classifica atividades econômicas pelo código CNAE — e "Saúde", por exemplo, aparece no campo `cnae_inv_2_desc` como "Atividades de atenção à saúde humana", nunca na descrição textual do projeto.

### Estrutura do CSV (coluna CNAE)
| CSV | Coluna | Campo |
|---|---|---|
| `piesp_confirmados_com_valor.csv` | col[11] | `cnae_inv_2_desc` |
| `piesp_confirmados_com_valor.csv` | col[12] | `cnae_inv_5_cod_desc` |
| `piesp_confirmados_com_valor.csv` | col[13] | `cnae_empresa_5_cod_desc` |
| `piesp_confirmados_sem_valor.csv` | col[9] | `cnae_inv_2_desc` |
| `piesp_confirmados_sem_valor.csv` | col[10] | `cnae_inv_5_cod_desc` |
| `piesp_confirmados_sem_valor.csv` | col[11] | `cnae_empresa_5_cod_desc` |

### Solução
Adicionadas as colunas CNAE ao `textToSearch` em ambas as funções de consulta em `services/piespDataService.ts`. Buscas por "saúde", "hospital", "farmácia", "educação", "turismo", "energia" etc. agora retornam resultados corretos.

---

## Bugs Abertos

| ID | Descrição | Status |
|---|---|---|
| BUG-001 | Filtros de setor e região retornam 0 no Chat | Resolvido |

Ver detalhes completos em [`docs/bugs-abertos.md`](docs/bugs-abertos.md).

---

## Pendências

| ID | Descrição | Status |
|---|---|---|
| PEND-001 | Proteção da API key do Gemini | Decidir antes do deploy |
| PEND-002 | Cherry-pick das melhorias de voz de `nadia-mobile/0.2` para `main` | Pendente |

Ver detalhes e alternativas em [`docs/pendencias.md`](docs/pendencias.md).

### PEND-002: Sincronizar Voice UX entre `nadia-mobile/0.2` e `main`

**Contexto:** A branch `nadia-mobile/0.2` acumulou 20+ commits de melhorias de voz (Half-Duplex, prompt engineering, auto-scroll, cleanup visual) que não existem no `main`. O assistente de voz é o mesmo componente em ambos os apps, portanto devem compartilhar as mesmas funcionalidades.

**Por que NÃO fazer merge direto:**
- O merge arrastaria **271 arquivos** (`.agent/skills/`, screenshots, `.playwright-mcp/`, imagens de branding) irrelevantes para o `main`.
- `Header.tsx`, `LandingPage.tsx` e `App.tsx` têm navegação **mobile-only** (3 abas) que quebraria o layout do app completo (8+ abas).

**Estratégia recomendada — Cherry-pick seletivo:**

| Arquivo | Ação | Risco |
|---|---|---|
| `hooks/useLiveConnection.ts` | Cherry-pick integral | 🟢 Zero conflito (intocado no main) |
| `components/VoiceView.tsx` | Cherry-pick integral | 🟢 Zero conflito (intocado no main) |
| `utils/prompts.ts` | Cherry-pick integral | 🟢 Zero conflito (intocado no main) |
| `services/piespDataService.ts` | Cherry-pick integral | 🟢 Melhoria de CNAE/região, sem conflito |
| `hooks/useChat.ts` | Revisão manual | 🟡 Contexto de UI diferente |
| `components/ChatView.tsx` | Revisão manual | 🟡 Melhorias úteis mas layout diferente |
| `Header.tsx`, `LandingPage.tsx`, `App.tsx` | **Ignorar** | 🔴 Navegação incompatível |

**Melhorias de voz que serão portadas:**
1. Half-Duplex mic mute (anti echo cancellation)
2. Prompt engineering: filler suave + trava de progressive disclosure
3. Auto-scroll iOS Safari (`scrollTop` em vez de `scrollIntoView`)
4. Limpeza instantânea de transcrição ao desconectar
5. Botão "Salvar Conversa" no fluxo flex
6. Ocultação de status text pós-sessão

**Tempo estimado:** ~15-20 minutos.

---

## Arquitetura

Direções planejadas mas não implementadas:
- Backend mínimo (proteger API key + centralizar dados)
- MCP server como única fonte de verdade (eliminar duplicação `piespDataService` / `piespService`)
- Nadia Mobile (branch `mobile` — Chat + Voz, mobile-first)

Ver [`docs/arquitetura.md`](docs/arquitetura.md).

---

## Decisões Técnicas

Raciocínio por trás das escolhas — becos sem saída já explorados e trade-offs conscientes.

Ver [`docs/decisoes-tecnicas.md`](docs/decisoes-tecnicas.md).

---

## Arquitetura Atual

```
Browser
  ├── ChatView → useChat.ts → Gemini (function calling) → piespDataService.ts
  ├── VoiceView → useLiveConnection.ts → Gemini Live API (WebSocket)
  └── Outras views → Gemini (direto, sem function calling)

MCP Server (independente)
  └── piespService.ts (cópia de piespDataService) → Hermes / Claude Desktop
```

---

## Estrutura de Views

| View | Rota | Descrição |
|---|---|---|
| `LandingPage` | `home` | Página inicial |
| `VoiceView` | `voice` | Conversa por voz (Gemini Live API) |
| `ChatView` | `chat` | Chat texto com function calling |
| `PiespDashboardView` | `dashboards` | Dashboard com gráficos Recharts |
| `PerfilMunicipalView` | `municipal` | Mapa 3D + voz para municípios |
| `ExplorarDadosView` | `explorar` | Relatórios analíticos por filtro |
| `PerfilEmpresaView` | `perfil-empresa` | Dossiê de empresa com web search |
| `DataLabView` | `datalab` | Dashboards generativos com voz |
| `UploadView` | `upload` | Publicação de arquivos |

---

## Decisões Arquiteturais

### Function calling: PIESP vs Google Search (não podem ser combinados)
`piespTools` (function calling local) e `searchTools` (Google Search grounding) não podem ser usados na mesma chamada da Gemini API. `useChat.ts` detecta a skill e escolhe qual usar.

### CSV parseado em runtime
Importados como `?raw` e parseados no browser. Sem backend. O cache de `getDashboardData()` em `piespDashboardData.ts` é singleton para evitar reparsing.

### Separação de serviços de dados
- `piespDataService.ts` — filtragem por registro (function calling)
- `piespDashboardData.ts` — agregação completa para gráficos (cached)

### canonicalSetor()
O CSV está em Latin-1, lido pelo Vite como UTF-8. Acentos viram U+FFFD: `"Comércio"` → `"Com\uFFFDrcio"`. `canonicalSetor()` usa padrões ASCII que sobrevivem ao encoding corrompido para identificar setores. `linhaValida()` usa essa função para aceitar linhas de todos os setores.

### MCP Server (`mcp-server/`)
Servidor independente que expõe os dados PIESP via protocolo MCP para agentes externos (Hermes, Claude Desktop). Usa `fs.readFileSync` em vez de `?raw`. Transporte dual: stdio (Claude Desktop) e HTTP+SSE (Hermes).

---

## Features Implementadas

### Branch `claude/add-data-exploration-reports-5yplM`
- **ExplorarDadosView** — filtros → `filtrarParaRelatorio()` → relatório via Gemini
- **PerfilEmpresaView** — busca empresa → dados PIESP + Google Search grounding → dossiê com citações inline
- **EmbeddedChart** — gráficos Recharts embutidos na resposta da IA via blocos ` ```json-chart ` `
- **Sanitização UTF-8 nas citações** — `endIndex` da Grounding API é em bytes UTF-8, JS conta em chars UTF-16; corrigido via `TextEncoder/Decoder`

#### Aba "Explorar Dados" (`ExplorarDadosView.tsx`)

Filtros por setor, região, ano e tipo de investimento → relatório analítico gerado pela Nadia.

**Como funciona:**
1. Filtros populados via `getMetadados()` (listas únicas extraídas do CSV)
2. Preview em tempo real do número de projetos encontrados
3. Ao clicar "Gerar Relatório": `filtrarParaRelatorio()` localmente → dados serializados no prompt → Gemini gera o relatório → exibido via `MarkdownRenderer`
4. Chamada direta ao Gemini (sem function calling), pois os dados já foram filtrados localmente

**Funções novas em `piespDataService.ts`:**
- `filtrarParaRelatorio(filtro)` — filtro estendido (setor, região, ano, tipo) com agregações
- `getMetadados()` — listas únicas de setores, regiões, anos e tipos

#### Aba "Perfil de Empresa" (`PerfilEmpresaView.tsx`)

Dossiê completo combinando dados internos do PIESP com pesquisa na internet, incluindo desempenho financeiro.

**Como funciona:**
1. Campo de busca com autocomplete (empresas presentes no PIESP)
2. `buscarEmpresaNoPiesp()` localmente → prompt com dados PIESP → Gemini com `googleSearch`
3. Prompt instrui busca ativa de: perfil corporativo, **dados financeiros** (receita, EBITDA, lucro, dívida, market cap, rating de crédito), posição de mercado, fatos recentes
4. Citações inline extraídas de `groundingSupports` e injetadas via `injectInlineCitations()`
5. Renderizado pelo `DossieRenderer` (componente local): headers `##`/`###`, tabelas markdown, listas, badges de citação clicáveis com tooltip

**Funções novas em `piespDataService.ts`:**
- `getUniqueEmpresas()` — lista ordenada de empresas únicas para autocomplete
- `buscarEmpresaNoPiesp(nome)` — busca por nome (e investidora), sem limite de resultados

**Lição Aprendida (Síndrome do Aluno Desesperado vs Escassez de Dados):** Modelos de linguagem sofrem do viés de subserviência extrema ("helpful bias"). Se instruídos a gerar um dossiê corporativo com gráficos, o LLM gerará gráficos a qualquer custo, mesmo que a base contenha apenas 1 projeto em 1 único ano e em 1 município — resultando num layout estatisticamente ilógico. A solução definitiva não foi presumir "que o modelo sabe", mas forçar barreiras restritivas duras no prompt: proibir gráficos de linha se houver menos de 3 anos, ou gráficos de áreas únicas. As IAs devem ser engessadas em suas obrigações matemáticas estruturais para operarem previsivelmente como API.

#### Geração de Gráficos Nativos na Resposta da IA (Recharts)

Ensinamos a Nadia a inserir gráficos (Linha, Barra e Pizza) de maneira dinâmica no meio de seu texto final nas abas Explorar e Dossiê.
- Um novo componente (`EmbeddedChart.tsx`) com Recharts intercepta blocos markdown estruturados como \`\`\`json-chart\`\`\` e os substitui por UI visual sem rebarbas.
- Metadados cronológicos foram preparados pelo `piespDataService.ts` usando a nova função de agregação `agruparAno()`.
- **Lição Aprendida (Engenharia de Prompt):** A Inteligência Artificial é bastante focada no *mínimo esforço necessário*. Quando a instrução dizia "Se julgar visualmente útil, insira um gráfico", a IA formatava apenas 1 gráfico de barras com as Cidades e ignorava todo o resto. Para contornar, alteramos os prompts para uma **ordem estrita**, exigindo "pelo menos 2 a 3 gráficos de frentes diferentes", incluindo obrigações (`line` estritamente para evolução temporal, `bar` para volume comparativo, `pie` para proporção/market share).

#### Sanitização de UTF-8 no Sistema de Citações do Dossiê
- **O Bug:** Como a fonte bibliográfica (Google Grounding API) nos dossiês injetava a bolinha `[N]` no meio de palavras com acento (Ex: "Funda 8 ção").
- **Solução:** O `endIndex` retornado pela API baseia-se em **Bytes UTF-8**, enquanto o Javascript (TypeScript) lê os tamanhos de string em **Caracteres UTF-16**. A diferença na contagem fazia a citação retroceder cortando palavras. Corrigido ao envolver o texto via `TextEncoder / Decoder` atuando num Slice de uma matriz `Uint8Array`.

### Abril/2026 — Branch `claude/review-ag-ui-I7D3s`

#### Aba "Data Lab" (`DataLabView.tsx`)

Dashboard analítico gerado inteiramente pela Nadia a partir de linguagem natural — texto ou voz. Cada pergunta produz um layout único, adaptado ao tipo de análise pedida.

**Motivação:** As outras abas têm UI pré-definida pelo desenvolvedor. O Data Lab inverte isso: a Nadia decide o layout depois de entender o que o usuário precisa. Inspirado no conceito de UI Generativa (padrão AG-UI / Shadify), mas implementado sem backend, sem CopilotKit e sem shadcn/ui — apenas Gemini + Recharts + Tailwind, consistente com a stack existente.

**Como funciona (pipeline de 3 passos):**
1. **Extração de filtros** — chamada rápida ao Gemini (thinkingBudget: 0) para transformar linguagem natural em `{ municipio, setor, ano, regiao, termo_busca }`
2. **Consulta determinística** — `filtrarParaRelatorio(filtros)` no CSV local, retorna agregações completas
3. **Geração do dashboard** — chamada ao Gemini (thinkingBudget: 1024) com os dados + skill de design; retorna um bloco ` ```json-dashboard ` que o frontend renderiza

**Modo scratchpad:** cada nova análise substitui a anterior (não acumula). O JSON do dashboard é estado React (`useState`) — descartado a cada nova solicitação. O histórico das últimas 5 queries fica como chips para re-execução rápida.

**Input:** campo de texto + botão de microfone (`useSpeechRecognition`). Ao parar de falar, o envio é automático (mesmo padrão do `ChatView`).

**Arquivos criados:**
- `components/DataLabView.tsx` — view principal
- `components/DynamicDashboard.tsx` — renderizador do `json-dashboard`
- `skills/datalab_design.md` — skill de design (ver seção abaixo)

**Extensão em `piespDataService.ts`:**
`FiltroRelatorio` ganhou os campos `municipio` e `termo_busca`, que antes só existiam em `consultarPiespData`. Isso permite buscas geográficas por linguagem natural no Data Lab.

---

#### `DynamicDashboard.tsx` — Renderizador de Layout Generativo

Interpreta o JSON retornado pela Nadia e renderiza seções dinamicamente. Cada tipo de seção é um sub-componente independente:

| Tipo | Componente | Descrição |
|---|---|---|
| `kpi-cards` | `KpiCards` | Grid de cards com label, valor, detalhe e seta de tendência (↑↓) |
| `chart` | `EmbeddedChart` | Gráfico Recharts (ver tipos abaixo) |
| `bar-list` | `BarList` | Ranking proporcional customizado sem Recharts (mais limpo para listas longas) |
| `tabela` | `Tabela` | Tabela HTML com cabeçalho e linhas alternadas |
| `texto` | `TextoAnalise` | Texto analítico com borda lateral de destaque |

O campo `tendencia: "up" | "down" | "neutral"` nos KPI cards renderiza setas coloridas (emerald para alta, rose para queda).

**Parser:** `parseDashboard(text)` extrai o primeiro bloco ` ```json-dashboard ` da resposta e faz `JSON.parse`. Retorna `null` se inválido — o componente trata o caso de erro graciosamente.

---

#### `EmbeddedChart.tsx` — Tipos de Gráfico Expandidos

Além dos 3 tipos originais (`bar`, `line`, `pie`), foram adicionados:

| Tipo novo | Quando usar |
|---|---|
| `area` | Evolução temporal com volume — 5+ anos de dados; usa gradiente de preenchimento |
| `bar-horizontal` | Rankings com nomes longos (empresas, municípios >12 caracteres) |
| `composed` | Valor absoluto (barra) + tendência (linha) no mesmo gráfico; requer campo `linha` nos dados |

**Guardrail do pie chart (defesa dupla):**
- **No prompt (skill de design):** instrução explícita para nunca gerar mais de 5 fatias
- **No componente (`capPieData`):** função que ordena por valor e agrupa os itens excedentes em "Outros" — executa sempre, independente do que o modelo retornou

A defesa dupla existe porque modelos de linguagem não seguem instruções 100% das vezes. O componente age como rede de segurança determinística silenciosa.

---

#### Skill de Design (`skills/datalab_design.md`)

**Decisão arquitetural:** as regras de composição visual do Data Lab ficam em `skills/datalab_design.md`, importado como `?raw` e interpolado no `buildDashboardPrompt()` — mesmo padrão das outras skills do projeto.

**Por que separar do código TypeScript:**
- Regras de design são conteúdo editável, não lógica de programa
- Permite ajustar critérios (ex: limite do pie, threshold do area) sem tocar em `.tsx`
- Mantém consistência com a convenção `skills/*.md` já estabelecida

**Diferença em relação às outras skills:**
As skills em `skills/` são **lentes analíticas de domínio** (ativadas por palavras-chave via `skillDetector.ts`). A skill de design é **procedimental** — controla formato de saída, não conteúdo analítico. Por isso ela **não passa pelo `skillDetector.ts`** e é injetada diretamente no prompt do Data Lab.

**Conteúdo da skill de design:**
1. Catálogo completo de componentes com sintaxe JSON de exemplo
2. Tabela de seleção de tipo de gráfico (quando usar cada um)
3. Regras de ordenação de seções (kpi-cards → visual principal → contexto → tabela → texto)
4. Regras de não-redundância (proibido mostrar o mesmo dado em dois gráficos)
5. Regras para dados escassos (1 valor → kpi-card; 1-2 anos → sem chart temporal)

**Prompt adaptativo por tipo de análise:**
O `buildDashboardPrompt` detecta 5 tipos de análise e aplica layouts diferentes:
- **Comparação** (2+ entidades) → seções paralelas + `composed` ou `bar-horizontal`
- **Evolução temporal** → `area` obrigatório + kpi-cards com `tendencia`
- **Ranking / Top N** → `bar-list` como peça central + `pie` proporcional
- **Temático / Setorial** → `pie` geográfico + `bar` empresas + evolução temporal do setor
- **Análise geral** → mix completo

**Lição aprendida (confirmação do padrão anterior):** o prompt original usava "EXATAMENTE 4 KPIs + 3 gráficos" como instrução fixa. Substituído por regras adaptativas com mínimo absoluto de `1 kpi-cards + 2 visuais + 1 texto`. O modelo respeita mínimos mas também respeita os máximos implícitos quando as regras de não-redundância são explícitas.

**Nota sobre a criação da skill:** o `datalab_design.md` foi escrito manualmente nesta sessão. O projeto conta com a skill `skill-creator` (instalada via `npx skills add https://github.com/anthropics/skills --skill skill-creator`) que guia a criação iterativa de skills com loop de escrita → teste → avaliação → melhoria. Para revisões futuras da skill de design, recomenda-se usar o `/skill-creator` para estruturar o processo de iteração e avaliação.

---

## MCP Server PIESP — 10/abr/2026

Servidor MCP que expõe os dados da PIESP diretamente no Claude Desktop (e qualquer cliente MCP compatível), sem precisar abrir a Nadia.

### Localização

```
~/Documents/projetos/nadia-piesp/mcp-server/
  src/index.ts        — servidor MCP
  src/piespService.ts — camada de dados (porta do piespDataService.ts)
  dist/               — compilado (usado pelo Claude Desktop)
  knowledge_base/     — symlink → iCloud/Seade/Piesp/Nadia-PIESP/knowledge_base/
```

O symlink garante que qualquer atualização nos CSVs do iCloud é refletida automaticamente.

### Registro no Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "piesp": {
      "command": "node",
      "args": ["/Users/vagnerbessa/Documents/projetos/nadia-piesp/mcp-server/dist/index.js"]
    }
  }
}
```

### 5 tools disponíveis

| Tool | O que faz |
|---|---|
| `consultar_projetos_piesp` | Busca com valor — filtra por ano, município, região, termo |
| `consultar_anuncios_sem_valor` | Anúncios sem cifra |
| `filtrar_para_relatorio` | Agregações completas por setor, região, tipo e ano |
| `get_metadados` | Lista setores, regiões, anos e tipos válidos na base |
| `buscar_empresa` | Dossiê de empresa com totais por ano e município |

### Diferenças em relação ao piespDataService.ts da Nadia

- Leitura dos CSVs via `fs.readFileSync` (em vez de `import ?raw` do Vite)
- Suporte a modo HTTP+SSE além de stdio (ativar com `PORT=3456 node dist/index.js`)
- Filtro por `regiao` com `normalizarRegiao()` idêntico ao da Nadia

### Como usar

Basta fazer perguntas normais no Claude Desktop — as tools são acionadas automaticamente. Para confirmar que o servidor está ativo: **Settings → Developer** — o servidor `piesp` deve aparecer com status verde.

### Manutenção

Se os CSVs forem atualizados, não é preciso fazer nada — o symlink garante acesso imediato.
Se o código do `piespService.ts` for alterado, recompilar e reiniciar o serviço:
```bash
cd ~/Documents/projetos/nadia-piesp/mcp-server && npm run build
launchctl unload ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist
launchctl load ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist
```

### Modo HTTP+SSE (Hermes Agent e outros clientes de rede)

O servidor suporta dois modos de transporte:

| Modo | Como ativar | Usado por |
|---|---|---|
| stdio | padrão (`node dist/index.js`) | Claude Desktop |
| HTTP+SSE | `PORT=3456 node dist/index.js` | Hermes Agent, clientes de rede |

**Para o Hermes**, conectar em: `http://localhost:3456/sse`

Endpoints disponíveis no modo HTTP:
- `http://localhost:3456/sse` — conexão SSE (cliente conecta aqui)
- `http://localhost:3456/messages?sessionId=...` — mensagens MCP
- `http://localhost:3456/health` — health check

### launchd — servidor HTTP sempre ativo (10/abr/2026)

O servidor HTTP (porta 3456) roda como serviço de sistema via `launchd`, iniciando automaticamente com o Mac.

**Arquivo plist:** `~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist`

**Logs:**
```bash
tail -f ~/Documents/projetos/nadia-piesp/mcp-server/logs/server.log
tail -f ~/Documents/projetos/nadia-piesp/mcp-server/logs/server.error.log
```

**Comandos:**
```bash
# Status
launchctl list | grep nadia-piesp

# Parar
launchctl unload ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist

# Iniciar
launchctl load ~/Library/LaunchAgents/com.seade.nadia-piesp-mcp.plist
```

**Nota:** O Claude Desktop usa o servidor em modo stdio (entrada direta no config.json), independente do launchd. O launchd serve exclusivamente para o modo HTTP (Hermes e outros clientes de rede).

---

## Ferramentas de Desenvolvimento

| Skill | Comando | O que faz |
|---|---|---|
| skill-creator | `/skill-creator` | Cria e melhora skills com loop iterativo |
| find-skills | `/find-skills` | Descobre skills no ecossistema |
| frontend-design | automático | Design intencional e diferenciado |
| vercel-react-best-practices | automático | 69 regras de performance React |
| web-design-guidelines | automático | Auditoria de UI/acessibilidade |

---

## Convenções

- Novas views: prop `onNavigateHome: () => void`, header interno próprio, botão "Voltar"
- Navegação centralizada em `App.tsx` (state machine com `useState<View>`)
- `Header.tsx` recebe callbacks opcionais — adicionar prop ao interface ao incluir nova view
- Tailwind dark-first; paleta: `slate-*` fundos/texto, `rose-*` destaques/ações, `sky-*` links/citações
- **Skills de design:** ao receber pedidos de UI/design, **SEMPRE** consultar `skills/datalab_design.md` antes de codificar. A pasta `skills/` fica na raiz do projeto.

---

## Fallback OpenRouter em todas as views — 10/abr/2026

### Problema

O fallback para OpenRouter implementado em 09/abr estava conectado apenas no `useChat.ts`. As demais views (`ExplorarDadosView`, `PerfilEmpresaView`, `DataLabView`) chamavam `ai.models.generateContent()` diretamente e exibiam mensagem de erro ao receber 503 — sem tentar o fallback.

### Solução: `services/geminiService.ts`

Novo serviço centralizado com a função `generateWithFallback()`:

```ts
generateWithFallback({ prompt, systemInstruction?, thinkingBudget?, tools? })
  → { text, groundingChunks?, groundingSupports? }
```

**Fluxo interno:**
1. Tenta Gemini direto (`gemini-2.5-flash`)
2. Se Gemini falhar (qualquer erro) e `OPENROUTER_API_KEY` configurada → tenta OpenRouter (`google/gemini-2.0-flash-001`)
3. Se ambos falharem → relança o erro (tratado por cada view)

**Modelo de fallback confirmado:** `google/gemini-2.0-flash-001` (validado em 10/abr/2026). IDs anteriores tentados e rejeitados pelo OpenRouter: `google/gemini-2.5-flash-preview`, `google/gemini-2.5-flash-preview-05-20`. O fallback dispara em **qualquer** falha do Gemini (não apenas 503), garantindo maior cobertura.

**Views migradas:**
- `ExplorarDadosView` — substituiu `ai.models.generateContent()` por `generateWithFallback()`
- `DataLabView` — as duas chamadas (extração de filtros + geração de dashboard) foram substituídas
- `PerfilEmpresaView` — substituída; `tools: [{ googleSearch: {} }]` é passado normalmente; no fallback OpenRouter o dossiê é gerado sem citações inline (grounding não disponível fora do Gemini)

**Nota sobre `PerfilEmpresaView` no fallback:** `groundingChunks` e `groundingSupports` são retornados pelo `generateWithFallback` quando disponíveis (Gemini). No fallback OpenRouter, ambos são `undefined` — o dossiê aparece sem badges de citação, mas o texto analítico é preservado.

### Lazy loading de views — 10/abr/2026

`App.tsx` foi refatorado para usar `React.lazy()` + `Suspense` em todas as views. Cada view agora é um chunk JS separado carregado sob demanda.

**Impacto no bundle:**
- Antes: 5,48 MB em um único arquivo JS
- Depois: ~350 KB gzip no carregamento inicial; `piespDataService` (CSVs, 4 MB) só é baixado quando o usuário acessa uma view analítica

**Fallback visual:** spinner `rose-500` animado enquanto o chunk carrega (`ViewLoader` em `App.tsx`).

### Merge com branch claude/review-ag-ui-I7D3s — 14/abr/2026

**Problema pós-merge:** o remote havia adotado um script `scripts/convert-csvs.js` que converte os CSVs para UTF-8 e gera arquivos `*.utf8.csv`, com os imports apontando para esses arquivos. Como mantivemos o `package.json` local (sem o script de conversão), os arquivos `.utf8.csv` não existiam e o Vite quebrava na inicialização.

**Solução:** revertido os imports em `piespDataService.ts` para os arquivos originais:
```ts
import PIESP_DATA from '../knowledge_base/piesp_confirmados_com_valor.csv?raw';
import PIESP_SEM_VALOR_DATA from '../knowledge_base/piesp_confirmados_sem_valor.csv?raw';
```

**Regra:** não usar o script `convert-csvs.js` nem arquivos `.utf8.csv` neste projeto. Os CSVs originais funcionam corretamente com o `piespDataService.ts` atual, que já trata o encoding internamente via `canonicalSetor()` e normalização de strings.

---

## Resiliência de Infraestrutura — Lições de 08/abr/2026

### Problema: Erro 503 generalizado na API REST do Gemini

**Sintoma:** Todas as abas que usam `ai.models.generateContent()` (Chat, Data Lab, Explorar, Empresas) retornaram erro 503 ("high demand / UNAVAILABLE") simultaneamente, enquanto a aba de Voz (WebSocket) continuou funcionando normalmente.

**Causa raiz:** A API REST do modelo `gemini-2.5-flash` entrou em alta demanda/sobrecarga nos servidores do Google. A Live API (WebSocket) do modelo `gemini-2.5-flash-native-audio-preview` roda em infraestrutura separada e não foi afetada.

| Canal | Modelo | Protocolo | Infraestrutura |
|---|---|---|---|
| Voz (VoiceView) | `gemini-2.5-flash-native-audio-preview` | WebSocket (Live API) | Servidores dedicados a áudio |
| Chat / Data Lab / Explorar / Empresas | `gemini-2.5-flash` | REST (generateContent) | Pool compartilhado REST |

**Tentativa fracassada — Downgrade para `gemini-2.0-flash`:**
Ao tentar contornar o 503 trocando para `gemini-2.0-flash`, o Google retornou erro 404: *"This model is no longer available to new users."* O modelo 2.0 foi descontinuado sem aviso prévio neste período. **Lição:** nunca trocar para um modelo antigo sem antes verificar sua disponibilidade na documentação oficial do Google AI.

**Solução aplicada:**
1. Revertemos para `gemini-2.5-flash` (o único modelo funcional disponível)
2. Padronizamos mensagens de erro amigáveis em **todas as 4 abas** para nunca expor JSON cru ao usuário
3. Aguardamos a normalização dos servidores do Google (a instabilidade é temporária)

### Padrão de Tratamento de Erros (obrigatório em todas as views)

Toda chamada à API do Gemini via `generateContent()` deve ter um `catch` que **nunca** exponha a mensagem técnica ao usuário. A mensagem padrão é:

```
Nadia (servidores do Google Gemini) está enfrentando uma instabilidade/alta demanda momentânea. Por favor, aguarde alguns segundos e tente novamente.
```

**Arquivos onde o padrão foi aplicado:**
- `hooks/useChat.ts` — aba Chat
- `components/DataLabView.tsx` — aba Data Lab
- `components/ExplorarDadosView.tsx` — aba Explorar
- `components/PerfilEmpresaView.tsx` — aba Empresas

**Regra:** ao criar novas views com chamadas à API, copiar este padrão de tratamento de errro. Nunca usar `e.message` diretamente na UI.

### Modelo ativo e thinkingBudget

- **Modelo REST:** `gemini-2.5-flash` (todas as views de texto)
- **Modelo WebSocket:** `gemini-2.5-flash-native-audio-preview-12-2025` (VoiceView)
- **thinkingBudget:** Definido como `0` em todas as views para reduzir consumo de recursos e mitigar erros 503. O Chat no modo "Completo" usa `512` (reduzido de 2048 em 09/abr/2026 para mitigar quota e 503).

---

## Filtro de Ano no Dashboard — 09/abr/2026

### Funcionalidade

Chips de filtro por ano adicionados ao topo do painel de KPIs em `PiespDashboardView.tsx`. Ao selecionar um ano:
- KPIs (volume, projetos, empresas, municípios), setores, municípios, empresas, tipo e concentração filtram para aquele ano
- O gráfico "Volume por Ano" é substituído por "Volume por Mês — AAAA", mostrando a distribuição mensal do ano selecionado
- "Todos" restaura a visão histórica completa

O gráfico histórico de anos sempre usa `allData.porAno` (dados completos), nunca é afetado pelo filtro.

### Arquitetura

**`services/piespDashboardData.ts`:**
- `PiespRecord` ganhou o campo `mes` (col[2] do CSV)
- `DashboardData` ganhou `porMes?: AggItem[]`
- `MES_NAMES` mapeia número de mês para nome abreviado em pt-BR ("1" → "Jan" etc.)
- `_records` — cache de records brutos separado do cache agregado
- `getRecords()` — singleton dos records brutos (evita reparsing)
- `getAvailableYears()` — lista ordenada de anos únicos da base
- `agregarRecords(records)` — função interna que agrega qualquer subconjunto de records (refatoração do `getDashboardData`)
- `getDashboardDataByYear(ano)` — filtra records pelo ano e agrega, com cache por chave (`_cacheByYear`)
- `getDashboardData()` simplificado para delegar a `agregarRecords(getRecords())`

**`components/PiespDashboardView.tsx`:**
- `useState<string | null>` para o ano selecionado (null = "Todos")
- `data` = `getDashboardDataByYear(selectedYear)` ou `getDashboardData()` conforme seleção
- `allData` = dados completos, sempre passado para o gráfico de evolução histórica
- Chips de filtro com estilo ativo (`rose-500` para "Todos", `cyan-400` para anos)

---

## Alterações de UI — 08/abr/2026

### Dashboard (`PiespDashboardView`)
- Eixo Y do gráfico "Volume por Ano": adicionado `width={75}` ao `<YAxis>` para evitar word-wrap nos valores monetários formatados em pt-BR (ex: "R$ 135,0 bi" quebrava em 2 linhas)
- Gráfico de "Volume por Ano" convertido de `BarChart` para `AreaChart` (conforme regra da skill de design: evolução temporal com 5+ anos → area)

### Data Lab (`DataLabView`)
- Ícone do microfone substituído pelo componente `SoundWaveIcon` (mesmo ícone animado do Chat), garantindo identidade visual unificada

### Empresas (`PerfilEmpresaView`)
- Adicionadas regras anti-gráficos-mono-dados no prompt do dossiê: proibido gerar gráficos quando há apenas 1 município, 1 setor ou menos de 3 anos de dados.

---

## Refatoração: Sistema de Citações e Fontes — 08/abr/2026

Implementamos uma reconstrução completa do processamento de Grounding (pesquisa web) na aba de Empresas para resolver inconsistências críticas de UX e integridade de dados.

### Problemas Identificados
1.  **Índices Órfãos e Saltos Numéricos**: Frequentemente, as citações no texto começavam no número `[2]` ou pulavam índices (ex: `[1], [3]`), pois a API do Gemini incluía "chunks" de busca que não possuíam links reais ou eram inválidos, mas ainda ocupavam uma posição na contagem original.
2.  **Links de "Lixo" (Search Widgets)**: A API do GoogleSearch ocasionalmente retornava URIs que não eram artigos, mas sim widgets de busca (clima, horários do Google, sugestões de query), poluindo a seção de fontes com links inúteis.
3.  **Poluição Visual**: A lista de fontes era exibida em um bloco estático no final da página, disputando atenção com o texto principal do dossiê.
4.  **Falhas Silenciosas (White Screen)**: Em momentos de timeout do Gemini, o sistema injetava um texto de "fallback" genérico ("Não foi possível...") que mascarava a falha de rede e não renderizava a UI de fontes corretamente, deixando o usuário sem feedback visual de erro.

### Soluções Implementadas
-   **Filtro Genômico de Chunks**: O parser agora ignora qualquer link que aponte para `google.com/search`, links sem URI ou ocos. Isso garante que *apenas* fontes de informação reais cheguem ao usuário.
-   **Mapa de Re-indexação Sequencial (`indexMap`)**: Criamos uma lógica que mapeia os índices originais da API para uma nova sequência estritamente consecutiva (1, 2, 3...). Assim, mesmo que os chunks nº 1 e 2 sejam descartados por serem lixo, o chunk original nº 3 passará a ser exibido como `[1]` no texto e na lista.
-   **Módulo Accordion (Retrátil)**: Substituímos o rodapé fixo por um componente interativo estilo gaveta com ícones de identidade visual (Book/Chevron) e contadores de fontes verificadas.
-   **Transparência de Erro**: Removemos as strings de fallback silenciosas. Caso o Gemini retorne um dossiê vazio (timeout), o sistema agora dispara um erro explícito que aciona o banner vermelho de instabilidade, informando corretamente o estado da conexão.
-   **Tratamento UTF-8 Robusto**: O injetor de citações agora trabalha com arrays de bytes (`Uint8Array`) para garantir que os marcadores `[N]` sejam inseridos em posições exatas sem corromper caracteres acentuados típicos da língua portuguesa.

### Bug Fix: Animação do Accordion — 08/abr/2026

**Problema:** A animação do accordion de fontes usava a técnica CSS Grid (`grid-rows-[0fr]` → `grid-rows-[1fr]` via classes arbitrárias do Tailwind). Com o Tailwind carregado via CDN Play (`cdn.tailwindcss.com`), a transição de `grid-template-rows` não é processada de forma confiável — o browser colapsava ou expandia o painel sem animação, ou não respondia ao estado.

**Solução:** Substituído pelas classes Tailwind por `style` inline com `maxHeight` + `overflow: hidden`:
```tsx
style={{
  maxHeight: isSourcesOpen ? '2000px' : '0',
  overflow: 'hidden',
  transition: 'max-height 0.35s ease-in-out, opacity 0.3s ease-in-out',
  opacity: isSourcesOpen ? 1 : 0,
}}
```

**Regra:** Ao usar animações de colapso/expansão **neste projeto (Tailwind via CDN)**, sempre preferir `max-height` via inline style. Nunca usar `grid-rows-[0fr]`/`grid-rows-[1fr]` — essas classes arbitrárias dependem do JIT do Tailwind compilado, não do CDN Play.

---

## Melhorias de UX — Aba Empresas — 08/abr/2026

### Layout duas colunas com painel de fontes lateral

O layout da aba Empresas foi reestruturado: o dossiê ocupa a coluna principal (esquerda, `flex-1`) e o painel de "Referências e Fontes" fica em uma coluna lateral direita (`w-48`, `sticky top-4`). O painel usa `order` CSS para controle de posicionamento sem reorganizar o DOM.

O painel sticky tem scroll interno próprio (`max-h: 70vh, overflow-y: auto`) para não ultrapassar a viewport.

### Remoção do preâmbulo gerado pela IA

O Gemini frequentemente gera texto introdutório antes do primeiro `## ` do dossiê ("Estou elaborando...", "Aguarda um momento...", etc.). Esse texto é descartado via:
```ts
const primeiroH2 = textoCitado.indexOf('\n## ');
const textoLimpo = primeiroH2 > 0 ? textoCitado.slice(primeiroH2 + 1) : textoCitado;
```

### Citações dentro de itálico/negrito

O `parseInline` era não-recursivo: blocos `*itálico*` ou `**negrito**` que contivessem `[N]` engoliam a citação sem processá-la. Corrigido tornando os handlers recursivos:
```tsx
if (part.startsWith('*') && part.endsWith('*')) {
  return <em>{parseInline(part.slice(1, -1), keyPrefix)}</em>;
}
```

### Limite de citações por ponto de injeção

O grounding da API pode injetar 4+ citações no mesmo ponto (`[11][12][13][14]`). Limitado a 2 por ponto com `.slice(0, 2)` no `injectInlineCitations`.

### Remoção da aba "Publicar"

O botão "Publicar" foi removido do `Header.tsx` junto com o import de `CloudArrowUpIcon` e a prop `onNavigateToUpload`.

---

## Sistema de Agentes no Chat — 09/abr/2026

### Contexto

O usuário queria que a Nadia respondesse sob a ótica de "lentes analíticas" especializadas (skills) de forma explícita e controlada, sem depender da detecção automática por palavras-chave.

### Arquitetura Implementada

**Seleção manual de skill ("Agente")** antes ou durante a conversa no `ChatView`.

**Fluxo:**
1. Usuário abre o Chat → input centralizado (estado inicial, sem mensagens)
2. Usuário clica em "Agentes" → dropdown abre com 8 opções + "Geral"
3. Ao selecionar um agente, um badge aparece dentro da caixa de input
4. Cada mensagem enviada com agente ativo injeta a skill no `systemInstruction`
5. O agente pode ser trocado ou removido a qualquer momento — sem reiniciar o histórico

**Arquivos alterados:**
- `services/skillDetector.ts` — adicionadas `getSkillByName()` e `buildSystemInstructionWithSkillByName()` para injeção direta por nome (sem detecção por keywords)
- `hooks/useChat.ts` — aceita `{ selectedSkillName }` na inicialização; se fornecido, bypassa a auto-detecção
- `components/ChatView.tsx` — reescrito com novo layout e UI de seleção de agentes

### Agentes disponíveis (8)

| Nome interno | Label |
|---|---|
| `emprego_empregabilidade` | Emprego e Empregabilidade |
| `qualificacao_profissional` | Qualificação Profissional |
| `logistica_infraestrutura` | Logística e Infraestrutura |
| `inovacao_tecnologia` | Inovação e Tecnologia |
| `desenvolvimento_regional` | Desenvolvimento Regional |
| `cadeias_produtivas` | Cadeias Produtivas |
| `transicao_energetica` | Transição Energética |
| `comercio_exterior` | Comércio Exterior |

A `inteligencia_empresarial` foi excluída da lista de agentes manuais — ela usa Google Search (incompatível com piespTools) e é mais adequada para a aba Empresas.

### Layout do ChatView — dois estados (padrão Gemini)

| Estado | Condição | Layout |
|---|---|---|
| Inicial | `chatStarted === false` | Input centralizado em `pt-[12%]` da área de conteúdo |
| Chat | `chatStarted === true` | Mensagens (flex-grow) + input no rodapé (`pb-8`) |

`chatStarted` vira `true` no primeiro `sendMessage`.

### UI do seletor de Agentes

- Botão "Agentes" com chevron na barra inferior do input (mesmo padrão do "Ferramentas" no Gemini)
- Dropdown com `position: absolute`, abre **para baixo** no estado inicial, **para cima** (`bottom-full`) no estado de chat (sem espaço abaixo)
- "Geral" fixo no topo do dropdown; 8 agentes na lista abaixo com `max-h: 260px` e `overflow-y-auto`
- Ícones SVG inline por agente (sem emojis — produto analítico)
- Badge no input quando agente ativo: `rose-500/10` com botão `×` para remover

### Confirmação de skill no console

Ao enviar cada mensagem, o console exibe:
- `🎯 [Agente manual] Skill "nome" injetada. System instruction: N chars.`
- `🎯 [Agente auto] Skill "Label" detectada por keywords.`
- `ℹ️ [Sem agente] Nenhuma skill ativa.`

---

## Correção: Filtro por Região Administrativa no Chat — 09/abr/2026

### Problema

A tool `consultar_projetos_piesp` (function calling do Chat) só aceitava `municipio`, `ano` e `termo_busca`. Quando o usuário perguntava sobre "RA Santos" ou "Região Administrativa de Santos", o modelo não conseguia filtrar por região em uma única chamada. Como workaround, ele fazia múltiplas chamadas sequenciais (uma por município), resultando em:

1. Respostas "graduais" — modelo narrava cada passo ("Já consultei Guarujá, agora vou verificar Santos...")
2. Limite de `maxIterations = 3` cortava a resposta incompleta
3. "RA Santos" e "Região Administrativa de Santos" não eram reconhecidos como equivalentes

### Solução

**`services/piespDataService.ts`:**
- Adicionado campo `regiao?: string` à interface `FiltroPiesp`
- Adicionada função `normalizarRegiao()` que converte qualquer variante para forma canônica:
  - "Região Administrativa de Santos" → "ra santos"
  - "RA de Santos" → "ra santos"
  - "RA Santos" → "ra santos"
- Matching bidirecional: `regiaoNorm.includes(filtroNorm) || filtroNorm.includes(regiaoNorm)`
- Campo `regiao` retornado nos resultados (coluna 8 do CSV)

**`hooks/useChat.ts`:**
- Adicionado parâmetro `regiao` na declaração da tool `consultar_projetos_piesp`
- Descrição instrui explicitamente: *"NÃO tente município por município"* quando o usuário mencionar região
- `executarFerramenta` repassa `args.regiao` para `consultarPiespData`

**Resultado:** Uma única tool call com `regiao: "RA Santos"` retorna todos os projetos da região, eliminando as chamadas sequenciais e a resposta fragmentada.

---

## Resiliência de API — Chat — 09/abr/2026

### Problema

O error handler do `useChat.ts` tinha dois problemas críticos:

1. **Ternário inútil:** ambos os branches do `isSeverError ? ... : ...` retornavam a mesma string — qualquer erro (503, bug de código, 429, chave inválida) exibia a mesma mensagem genérica de "instabilidade"
2. **Sem retry:** um 503 momentâneo exigia que o usuário reenviasse a mensagem manualmente

### Soluções

**Error handler diferenciado** — cada categoria de erro tem mensagem própria:

| Erro | Mensagem |
|---|---|
| 429 / quota / rate limit | "Limite de requisições atingido (quota da API)" |
| 503 / unavailable / overloaded | "Servidores sobrecarregados — aguarde e tente novamente" |
| 500 | "Erro interno nos servidores do Google Gemini" |
| 401 / 403 / api_key | "Problema com a chave de API" |
| Outros | Exibe `e.message` real na UI + log detalhado no console |

**Retry automático com backoff** — função `withRetry()`:
- Tenta até 2x adicionais em caso de 503/UNAVAILABLE
- Delays: 2s na primeira re-tentativa, 4s na segunda
- Aplicada nas duas chamadas `generateContent` do loop de function calling
- Log no console: `⏳ Gemini 503 — tentativa 1/2. Aguardando 2000ms...`

**`thinkingBudget` reduzido:** modo "Completo" passou de `2048` → `512` tokens para reduzir pressão na quota e mitigar 503.

### Fallback de provedor: OpenRouter — 09/abr/2026

**Problema:** Quando o Gemini retorna 503 persistente (mesmo após os 2 retries do `withRetry`), o usuário via uma mensagem de erro e precisava tentar manualmente.

**Solução implementada:** Fallback automático e silencioso para o OpenRouter quando o Gemini falha com 503.

**Fluxo de resiliência em 3 camadas:**
1. Gemini direto (tentativa normal)
2. `withRetry` — 2 re-tentativas automáticas com backoff (2s / 4s)
3. OpenRouter — mesma query, mesma ferramenta, infraestrutura diferente

**Modelo de fallback:** `google/gemini-2.5-flash-preview` via OpenRouter — mesmo modelo do Gemini direto, roteado pela infraestrutura do OpenRouter (que tem SLA próprio e costuma estar disponível quando a API direta do Google está sobrecarregada).

**Arquivos criados/alterados:**
- `services/openrouterService.ts` — serviço completo com:
  - `geminiContentsToOAI()` — converte histórico Gemini → mensagens OpenAI
  - `geminiToolsToOAI()` — converte `functionDeclarations` → `tools[].function`
  - `convertGeminiParams()` — converte tipos (`Type.OBJECT` → `"object"`)
  - `callOpenRouter()` — POST para `https://openrouter.ai/api/v1/chat/completions` com loop de function calling no formato OpenAI
- `config.ts` — adicionado `OPENROUTER_API_KEY` (preencher com chave de openrouter.ai/keys)
- `hooks/useChat.ts` — variáveis `contents`, `systemInstructionWithSkill` e `ferramentasAtivas` hoistadas para fora do `try` (necessário para acessá-las no `catch`); fallback ativado no `catch` quando `is503 && OPENROUTER_API_KEY`

**Comportamento para o usuário:**
- Se OpenRouter responder com sucesso: resposta aparece normalmente, sem nenhum erro visível
- Se OpenRouter também falhar: exibe mensagem de erro padrão de 503
- Logs no console: `🔀 Gemini 503 persistente — ativando fallback OpenRouter...`

**Ativação:** preencher `OPENROUTER_API_KEY` em `config.ts`. Se vazio, o fallback é ignorado e o comportamento anterior (mensagem de erro) é mantido.

---

## Hermes + Telegram + MCP compatível — 10/abr/2026

### Problema 1: Hermes não conseguia usar o MCP HTTP+SSE legado

O servidor MCP já existente para PIESP rodava em:

- `GET /sse`
- `POST /messages?sessionId=...`
- `GET /health`

Esse desenho funciona para clientes legados baseados em `SSEServerTransport`, mas o Hermes v0.8.0, na configuração `mcp_servers.<name>.url`, usa **MCP Streamable HTTP**. Na prática:

- o Hermes conectava
- negociava protocolo
- e encerrava a sessão com `Session terminated`

Diagnóstico:

- `hermes mcp test piesp` falhava contra `http://localhost:3456/sse`
- o processo ativo na porta `3456` era outro projeto em `/Users/vagnerbessa/Documents/projetos/nadia-piesp/mcp-server/dist/index.js`
- esse processo expunha apenas `SSEServerTransport`, sem endpoint `/mcp`

### Solução 1: criar servidor MCP Streamable HTTP compatível

Foi criado um servidor novo e separado dentro deste repositório:

- `scripts/piesp-mcp-server.mjs`

Ele:

- usa `@modelcontextprotocol/sdk`
- registra 5 tools:
  - `consultar_projetos_piesp`
  - `consultar_anuncios_sem_valor`
  - `filtrar_para_relatorio`
  - `get_metadados`
  - `buscar_empresa`
- lê diretamente os CSVs da pasta `knowledge_base/`
- expõe:
  - `GET /health`
  - `POST/GET /mcp` via `StreamableHTTPServerTransport`

Escolha importante de implementação:

- modo **stateless** (`sessionIdGenerator: undefined`)
- `enableJsonResponse: true`

Isso simplifica o uso pelo Hermes e evita depender do fluxo legado `/sse` + `/messages`.

### Problema 2: conflito de porta com o MCP antigo

A porta `3456` já estava ocupada por um servidor antigo em outro diretório do usuário.

Se o novo servidor tentasse subir na mesma porta:

- havia conflito operacional
- e ficava ambíguo qual servidor o Hermes estava usando

### Solução 2: isolar o servidor compatível na porta 3457

O servidor novo foi publicado como serviço `launchd` do usuário em:

- `/Users/vagnerbessa/Library/LaunchAgents/ai.piesp.mcp.plist`

Configuração final:

- host: `127.0.0.1`
- porta: `3457`
- health: `http://127.0.0.1:3457/health`
- mcp: `http://127.0.0.1:3457/mcp`

Logs:

- `~/.hermes/logs/piesp-mcp.log`
- `~/.hermes/logs/piesp-mcp.error.log`

Script adicionado em `package.json`:

```json
"mcp": "node scripts/piesp-mcp-server.mjs"
```

### Problema 3: Hermes no Telegram falhava por crédito insuficiente no OpenRouter

No bot do Telegram, o erro observado foi:

- `HTTP 402`
- pedido grande demais para o saldo disponível do OpenRouter

Ou seja: o problema não era Telegram nem MCP; era o provedor principal do Hermes.

### Solução 3: migrar o Hermes para OpenAI Codex

O ambiente Hermes já estava autenticado em `OpenAI Codex`, então o provedor principal foi alterado para:

- provider: `openai-codex`
- model: `gpt-5.4-mini`
- api_mode: `codex_responses`
- base_url: `https://chatgpt.com/backend-api/codex`

Com isso:

- o bot deixou de depender do saldo do OpenRouter
- o MCP PIESP continuou ativo normalmente
- o gateway do Telegram voltou a responder sem o erro de crédito

### Configuração final usada pelo Hermes

Em `~/.hermes/config.yaml`:

```yaml
model:
  base_url: https://chatgpt.com/backend-api/codex
  api_mode: codex_responses
  provider: openai-codex
  default: gpt-5.4-mini

mcp_servers:
  piesp:
    url: http://127.0.0.1:3457/mcp
    enabled: true
    connect_timeout: 60
    timeout: 120
```

Validação final:

- `hermes mcp test piesp` → conectado com 5 tools descobertas
- `hermes gateway restart` → gateway voltou online
- bot do Telegram funcionando via `@Nadia_Seade_bot`

### Observação operacional

O comando `/start` não é um slash command nativo do Hermes. No Telegram, o Hermes responde com:

- `Unknown command /start`

Então o uso normal do bot deve ser:

- mandar uma mensagem comum, por exemplo `Olá Nadia`
- usar `/sethome` apenas se quiser marcar o chat como home channel
