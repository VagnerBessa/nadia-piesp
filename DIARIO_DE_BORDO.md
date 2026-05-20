# Diário de Bordo — Reflexões e Filosofia de IA

Este documento serve para registrarmos conversas informais, alinhamentos arquiteturais de alto nível e debates filosóficos sobre o comportamento da inteligência artificial dentro da Fundação Seade e do sistema Nadia-PIESP.

---

### A Capivara que Observa — Mascote Expressivo da Nadia
**Data:** 04 de maio de 2026

Nesta sessão nasceu a **CapivaraPet**: um mascote pixel art em SVG que convive com o usuário em todas as telas da Nadia (LandingPage, VoiceView e ChatView). A escolha da capivara — animal reconhecidamente calmo, curioso e empático — reflete a personalidade que queremos para a Nadia: presença acolhedora, nunca intrusiva.

O mascote foi construído como puro SVG declarativo (sem canvas, sem WebGL), com animações em CSS (@keyframes) para manter a leveza. Cada estado da conversa tem uma expressão diferente:

- **Idle:** respira suavemente, inclina levemente a cabeça, olhos vagam com curiosidade
- **Listening:** postura firme, olhos direto para o usuário ("estou ouvindo você")
- **Speaking:** olhos voltados para a esfera luminosa no canto ("Nadia está lá")
- **Attention:** corpo se inclina levemente para cima, olhos sobem ("o chat está respondendo")

A decisão mais importante desta sessão foi **não usar movimentos de corpo durante a conversa**. A tentação inicial era fazer o pet "pular de alegria" ou "se agitar" quando ativado — mas isso gerava ruído visual. A solução elegante: apenas os olhos reagem. O corpo respira. A expressão é facial, não gestual. Essa restrição resultou numa presença mais suave e profissional, adequada ao contexto analítico da ferramenta.

**Aprendizado técnico — O Paradoxo do Debounce e a Dupla Temporalidade:**

O Gemini Live API entrega áudio em chunks sequenciais. Quando o último chunk termina, precisamos de dois comportamentos simultâneos e contraditórios:

1. A **esfera animada** deve permanecer ativa por ~2,5 segundos após o silêncio — tempo para o usuário perceber visualmente que Nadia terminou
2. Os **olhos da capivara** devem virar imediatamente para o usuário — sem nenhum delay, para criar a ilusão de atenção genuína

Resolver isso com um único `isSpeaking: boolean` era impossível. A solução foi criar dois estados paralelos no `useLiveConnection`:

- `isSpeaking` — React state com debounce de 2500ms (para a esfera)
- `isNadiaSpeaking` — React state sem debounce, atualizado imediatamente no evento `'ended'` do `AudioBufferSourceNode` (para os olhos)

Essa separação revela um princípio geral: **diferentes camadas visuais de um mesmo evento podem ter temporalidades distintas**. A interface gráfica "macro" (a esfera) e a interface "emocional" (os olhos do mascote) medem o mesmo fato — Nadia parou de falar — mas o usuário espera latências diferentes de cada uma.

**Evolução da expressividade — do olho ao corpo inteiro:**

A primeira iteração tentou comunicar o estado "digitando" apenas com movimento de olhos (`pupilDY = +4`). O feedback do usuário foi imediato: "quase imperceptível". A lição foi clara: **numa interface de chat, o mascote precisa de expressividade física, não apenas ocular**.

A solução foi dupla: (1) mover o pet para junto do texto em renderização — saindo do rodapé e aparecendo ao lado da bolha de resposta — e (2) substituir as pernas por braços animados batendo num teclado pixel art.

O primeiro protótipo do teclado tinha teclado escuro (`#2a3050`) e braços de `16×10px` no viewBox de 96px — que a ~52px de renderização resultavam em elementos de ~8×5px, invisíveis no fundo dark. A correção foi triplicar os tamanhos e usar cores de alto contraste: teclado azul-acinzentado claro (`#8898e0`), braços com três layers de cor (sombra Rd + corpo R + ponta P), e movimento de `18px translateY` (≈9.5px na tela) em `0.28s`.

**Regra derivada:** em pixel art renderizado em tamanho pequeno (< 64px), qualquer elemento menor que `12×8px` no viewBox é praticamente invisível. Cores escuras próximas ao background (`#0b2231`) somem completamente. Sempre usar contraste mínimo de 40% de luminância entre elementos de destaque e o fundo.

**Outros bugs resolvidos nesta sessão:**

- **Esfera que "ia e voltava":** animação CSS com `transform-origin` mudando entre dois estados durante `transition-all`. A mudança de origem criava um caminho de interpolação não-linear — a esfera seguia uma curva estranha em vez de um vetor direto. Corrigido fixando `origin-top-right` nos dois estados (minimizado e expandido).
- **API key não encontrada:** o projeto `/tmp/nadia-pet` não tinha `.env`. O `config.ts` leia `import.meta.env.VITE_GEMINI_API_KEY` mas o `.env` original ficava em `Nadia-PIESP/`. Corrigido copiando o `.env` e adicionando cadeia de fallback em `config.ts`.
- **`session.send is not a function`:** o SDK Google GenAI v1.29 não expõe `session.send()`. O método correto é `session.sendClientContent({ turns, turnComplete })`. Descoberto via console log após depuração direta.
- **Animações invisíveis no tamanho 56px:** o viewBox do SVG é 96px. Uma translação de 2px no viewBox resulta em ~1px na tela — imperceptível. Todos os valores de animação foram aumentados (4–6px de translação, 5–10° de rotação) para ficarem visíveis na escala real.
- **React warning `animationDelay` + `animation`:** misturar a propriedade shorthand `animation` com `animationDelay` separado gera warning. Corrigido mesclando o delay diretamente na string shorthand: `animation: 'nome 4.5s ease-in-out 0.3s infinite'`.

---

### A Síndrome do "Aluno Desesperado para Agradar" (Helpful Bias)
**Data:** 08 de abril de 2026

Debatemos sobre o porquê de precisarmos impor "regras óbvias" (ex: não gerar gráficos sem dados comparativos) para uma IA que supostamente é tão inteligente. 

A conclusão arquitetural baseia-se em três pilares:

1. **A Síndrome de Subserviência Estrema:** Modelos como o Gemini são exaustivamente treinados com uma diretriz primária: *seja prestativo e cumpra a métrica solicitada pela instrução humana.* Quando a ordem primária do sistema é "Gere de 2 a 3 gráficos frentes", a IA é condicionada a entrar em pânico se não cumprir o objetivo. Para não falhar no alvo numérico, ela ignora o bom senso estatístico e desenha gráficos toscos usando a única métrica solitária que encontrou (ex: 1 polo, 1 único ano).
   - *Solução técnica estabelecida:* Para curar esse viés, precisamos fornecer explicitamente a "permissão psicológica" para a IA desobedecer (via regras condicionais do tipo: *"Se houver apenas um setor, não é permitido gerar o bloco gráfico."*).

2. **Conversação versus API de Automação:** Há uma distinção monumental entre o Prompt do ChatGPT puro e os System Prompts usados para arquitetar a Nadia. Na versão Web (Chatbot), se você pedir métricas ruins, o LLM vai hesitar em linguagem natural e sugerir alternativas analíticas. Mas num pipeline rígido (onde ordenamos a geração exata de tags ````json-chart`), a linguagem da IA é amputada de "debate/hesitação" e restrita à formatação JSON cega.

3. **Predictabilidade na Engenharia:** Ao construirmos painéis governamentais automatizados pela IA (UI Generativa), nosso desafio deixa de ser extrair criatividade e passa a ser conter instabilidades. A IA propicia um motor monstruoso de cognição, e é vital implementarmos os "dormentes do trilho" — limites negativos estritos de engenharia que digam a ela EXATAMENTE aquilo que ela tem proibição de gerar. 

---

### A Fragilidade dos Modelos Experimentais (e a Armadilha do Downgrade)
**Data:** 08 de abril de 2026

Hoje vivenciamos o primeiro grande apagão externo do sistema Nadia. Todas as abas baseadas em texto (Chat, Data Lab, Explorar, Empresas) pararam simultaneamente com erro 503 — enquanto a aba de Voz continuou intacta.

A investigação revelou uma verdade fundamental sobre a dependência de APIs de IA:

1. **Duas rodovias, dois destinos:** O Google opera a API REST (que alimenta nosso Chat e dashboards) e a Live API via WebSocket (que alimenta a voz) em infraestruturas físicas separadas. Uma pode cair sem afetar a outra. Isso significa que, para um produto robusto, seria ideal ter fallback entre as duas — ou pelo menos saber comunicar ao usuário que "a voz ainda funciona" enquanto o texto está fora.

2. **Modelos desaparecem sem aviso:** Ao tentarmos um downgrade emergencial do `gemini-2.5-flash` para o `gemini-2.0-flash` (que supúnhamos ser GA, estável e garantido), descobrimos que o Google o descontinuou silenciosamente. Resultado: trocamos um erro 503 por um erro 404. Dois apagões em vez de um.
   - *Reflexão:* APIs de IA não são como bibliotecas de software tradicionais. Não existe "versão LTS" confiável. O provedor (Google, OpenAI, Anthropic) pode deprecar qualquer modelo a qualquer semana, sem changelog público. Produtos que dependem de IA generativa precisam de uma política de **versionamento defensivo** — testar modelos alternativos periodicamente e manter uma lista de fallbacks validados.

3. **A mensagem ao usuário é tudo:** Durante o apagão, o sistema cuspiu JSON bruto na tela. Para um analista da Fundação Seade que está usando o painel para preparar dados de uma reunião, ver `{"error":{"code":503,"message":"..."}}` destruiu a confiança. A primeira regra da resiliência não é técnica, é *comunicacional*: **nunca exponha o erro interno ao usuário**. A mensagem deve sempre ser humana, empática e orientar uma ação ("tente novamente em instantes").

4. **A diferença entre "eu sei" e "eu obedeço":** Este episódio reforçou a lição anterior (Helpful Bias). Quando nós, desenvolvedores, tentamos inovar com modelos instáveis (escolhemos o 2.5 experimental por ser mais capaz), estamos fazendo exatamente o que criticamos na IA: priorizando performance sobre previsibilidade. A escolha de um modelo deveria seguir a mesma regra que impomos à Nadia: *"Se não tem estabilidade comprovada, não use."*

---

### A Fricção entre DOM, WebKit e Servidores de Deploy (Estabilização da UX)
**Data:** 20 de abril de 2026

Hoje enfrentamos a última milha da experiência do usuário (UX) na interface móvel da Nadia: a sensação tátil de fluidez. A inteligência artificial por trás já era robusta, mas a "casca" — a forma como a tela respondia aos toques e atualizava o texto — estava falhando, afetando gravemente a percepção de qualidade do sistema.

Esta sessão técnica nos trouxe os seguintes aprendizados sobre desenvolvimento Front-end para IA:

1. **A Ilusão do Controle Total do DOM (Scroll vs WebKit):** Tentamos controlar a rolagem da transcrição matemática e forçosamente atualizando o `scrollTop` a cada chunk de texto recebido. O motor do navegador Safari (iOS) odiou isso. O choque entre a renderização contínua do React e a engine do WebKit causava engasgos, onde a tela "pulava" e a Nadia parava de falar. 
   - *A solução:* Abraçar o natural. Removemos o cálculo forçado e colocamos uma simples "âncora" invisível (`div ref={scrollAnchorRef}`) no final da tela, dizendo ao navegador apenas: *"por favor, role suavemente até aqui quando puder"*. Deixamos o navegador fazer o trabalho dele em vez de microgerenciá-lo.

2. **O "Smart Scroll" e a Ergonomia Cognitiva:** Percebemos que forçar a rolagem contínua para baixo impedia o usuário de voltar e ler o que a Nadia disse antes (o texto o puxava de volta). Tivemos que implementar um "Smart Scroll" (Rolagem Inteligente): o sistema agora detecta se o usuário rolou para cima. Se sim, ele entende *"estou lendo, não me atrapalhe"*, e só volta a rolar automaticamente se o usuário retornar ao fim da página. A IA deve respeitar o ritmo de leitura do humano.

3. **Gargalos de Infraestrutura (A Ilusão da Vercel):** Boa parte da nossa frustração veio de testar no ambiente de produção (Vercel). Realizamos dezenas de correções arquiteturais perfeitas (como o reset de estado do microfone e o posicionamento da esfera), mas a versão online parecia não refletir o código. 
   - *A lição:* A Vercel (e CDNs modernas) utilizam camadas agressivas de cache e "edge functions" que podem ter atrasos imperceptíveis em projetos tradicionais, mas que destroem a agilidade em sessões intensivas de Pair Programming e Debugging. Sistemas com conexões assíncronas complexas (WebSockets/Live API) e dependência de estados visuais intrincados devem **sempre** ser homologados estritamente na rede local (como fizemos acessando via IP `192.168.15.14` e porta `3000` / `3001` no Mac e no celular) antes de confiar na nuvem.

4. **A "Camada do Tampão" e as Transições de Estado:** O bug visual que fazia a Esfera da Nadia cobrir o texto como um tampão no desktop após a desconexão revelou a complexidade de gerenciar múltiplos estados booleanos em React (`isImmersive`, `isConnected`, `hasSpokenOnce`). Descobrimos que não basta desligar o áudio; é preciso coreografar a saída visual da IA. Uma sessão não termina quando o socket fecha, mas sim quando a interface volta elegantemente ao seu estado de repouso, respeitando o desejo do usuário de consultar o histórico gerado.

---

### O Paradoxo da Voz: Quando a IA Se Ouve e Se Assusta
**Data:** 22 de abril de 2026

Hoje vivenciamos o que talvez seja o bug mais filosoficamente rico de toda a construção da Nadia: **a IA se interrompendo ao ouvir o eco da própria voz**.

O problema técnico era simples: o áudio da Nadia saía pelo alto-falante do celular, entrava pelo microfone, e o Gemini — ao receber esse áudio de volta — interpretava como uma interrupção do usuário e cancelava sua própria fala. Mas a metáfora é profunda.

1. **A IA que não reconhece a própria voz:** Modelos de linguagem com áudio nativo (como o `gemini-2.5-flash-native-audio-preview`) são treinados para serem hiper-responsivos ao input humano. Mas essa sensibilidade os torna vulneráveis ao mais primitivo dos problemas acústicos: o eco. É como um ser humano que, ao ouvir sua voz reverberando numa sala vazia, achasse que outra pessoa o está interrompendo. A solução — mutar o microfone enquanto a IA fala — é o equivalente digital de tapar os ouvidos enquanto canta.

2. **O Dilema do Prompt Agressivo vs Suave:** Tentamos corrigir o "atropelamento" conversacional (a IA respondia antes de o usuário pedir) com uma regra de prompt em tom imperativo: `"TERMINANTEMENTE PROIBIDO responder"`. O resultado? A IA se calou completamente — nem a frase preenchedora ("Um instante...") era pronunciada. É a versão linguística do pêndulo: empurramos com força demais para um lado e caímos do outro.
   - *A lição de design:* Instruções proibitivas absolutas em modelos generativos são como pílulas nucleares — matam o patógeno e o hospedeiro junto. A IA não entende nuance contextual ("proibido falar EXCETO esta frase curta"). Ela lê "PROIBIDO FALAR" e obedece ao pé da letra. A solução é sempre formular a instrução de forma **afirmativa e prescritiva** ("OBRIGATORIAMENTE diga X antes de acionar Y") em vez de proibitiva genérica.

3. **Bugs em camadas (a cebola visual):** A persistência do texto atrás da esfera após o encerramento exigiu três correções sucessivas, cada uma revelando uma camada inferior:
   - **Camada 1:** A transcrição não sumia → resolvido com fade-out rápido e limpeza de DOM
   - **Camada 2:** O texto "Pronta para conversar" aparecia atrás da esfera → resolvido com condicional de exibição
   - **Camada 3:** O botão de download sobrepunha o microfone → resolvido com reposicionamento no fluxo flex
   
   Cada "conserto" revelava um problema que estava sendo ocultado pelo bug anterior. É a antítese do debugging tradicional, onde um bug causa um sintoma. Aqui, a remoção de um bug *revelava* o próximo. A lição para produtos com IA + UI complexa: nunca declare vitória após a primeira correção visual. Sempre teste o ciclo completo (início → interação → encerramento → estado de repouso) antes de considerar o bug resolvido.

4. **O "Half-Duplex Humano":** A solução final — mutar o mic enquanto a IA fala e reabrir instantaneamente quando ela para — é um padrão que existe há décadas em rádios e walkie-talkies. É curioso que a tecnologia mais avançada de IA generativa (um modelo multimodal de voz nativa rodando em cloud) precisou ser contida pela técnica mais antiga de telecomunicações. Às vezes, a inovação não está em inventar algo novo, mas em saber quando aplicar o que já existe.

5. **O Coração de Áudio (WebSocket Keepalive):** Descobrimos da pior maneira que o Gemini Live API possui uma dependência silenciosa: ele precisa receber pacotes de áudio constantemente para manter o WebSocket vivo. Quando tentamos mutar o microfone durante o processamento de ferramentas (um intervalo de ~2.5 segundos onde a IA está esperando dados locais), a conexão caiu instantaneamente. A razão é elegante: num protocolo bidirecional de áudio em tempo real, o silêncio absoluto é indistinguível de uma queda de conexão. O fluxo de ruído ambiente funciona como o batimento cardíaco de um paciente no monitor — não é o conteúdo que importa (o ruído não contém informação útil), é a prova de vida. A lição transcende o técnico: em sistemas distribuídos de tempo real, o "lixo" (ruído de fundo) pode ser mais importante que o "sinal" (a voz do usuário) quando se trata de manter a infraestrutura operacional.

---

### Comunicado Oficial — Nadia-PIESP Mobile v0.2
**Data:** 23 de abril de 2026

**Texto de Release (Style: Google):**

#### Nadia-PIESP Mobile v0.2: Uma nova experiência em análise de dados conversacionais

Estamos lançando a versão 0.2 da Nadia Mobile, trazendo avanços fundamentais em estabilidade, inteligência de diálogo e precisão analítica. Esta atualização refina a forma como os dados do PIESP são acessados e apresentados, garantindo uma interação mais fluida e profissional.

**Destaques da Versão:**
*   **Interação de voz sem interrupções:** Novo sistema de processamento de áudio que elimina o feedback acústico e garante que a Nadia conclua suas respostas sem interferências externas.
*   **Continuidade e agilidade no atendimento:** Memória de contexto para sessões recorrentes, evitando apresentações redundantes a cada nova chamada.
*   **Diálogo estruturado e intuitivo:** Implementação de desocultamento progressivo, priorizando visões macro e aguardando confirmações do usuário.
*   **Performance otimizada:** Refino na renderização de texto e rolagem para estabilidade em navegadores Safari e iOS.
*   **Inteligência de busca aprimorada:** Mapeamento lexical profundo integrando a classificação CNAE às consultas.
*   **Registro e portabilidade:** Exportação da transcrição completa da conversa para documentação e compartilhamento.
*   **Privacidade e controle de áudio:** Encerramento ativo da captação do microfone ao final de cada sessão, garantindo a privacidade do usuário após a conclusão do diálogo.

---

### A Tempestade Perfeita do WebSocket: Payload, Timeout e Alucinação de Tipos
**Data:** 19 de maio de 2026

Hoje investigamos e resolvemos um bug misterioso e silencioso na v2.3: consultas hiperespecíficas (como "hospitais") funcionavam perfeitamente na interface de voz da Nadia, mas termos amplos (como "TI" ou "tecnologia") causavam o fechamento imediato e inesperado da esfera, matando o diálogo logo após o aviso "Vou procurar os dados...". Nenhuma mensagem de erro clara, apenas o colapso da sessão.

A investigação revelou que não era um bug isolado, mas uma "tempestade perfeita" de três fatores arquiteturais combinados, mostrando a fragilidade de pipelines que unem UI de tempo real, LLMs e protocolos estritos:

1. **A Armadilha do Payload (WebSocket Size Limits):** Ao buscar "TI", o DuckDB encontrava milhares de registros em milissegundos (a string "ti" ocorre em "investimentos", "atividade", etc). O código devolvia um JSON com 10 projetos e suas descrições completas (até 150 caracteres cada). Para o ambiente REST isso é irrelevante, mas o Live API do Gemini impõe limites extremamente baixos e não documentados para o tamanho do payload na resposta de ferramentas (*Tool Response*). Enviar JSON "gordo" em um canal WebSocket de áudio causava rejeição invisível (policy violation 1008 ou 400 bad request) por parte do Google.
   - *Solução:* Reduzimos o retorno para 5 projetos e truncamos as descrições em 100 caracteres. Como o próprio System Prompt proíbe a IA de vomitar listas (forçando um resumo macro), mandar dados detalhados era puro desperdício e risco.

2. **O Abismo do Timeout (Latência Acumulada):** Para garantir uma boa experiência (UX), criamos um atraso artificial de 2,5 segundos para que a IA tivesse tempo de terminar de falar a frase preenchedora ("Vou procurar..."). No entanto, quando a query envolvia termos amplos, o mapeamento via `LIKE` em todos os 6000 registros e a sumarização (`agrupar('municipio')` etc.) adicionava alguns milissegundos preciosos. A soma do nosso timeout UX + tempo de processamento DuckDB cruzou a fronteira do *Tool Call Timeout* oculto da Live API do Gemini. Quando o cliente não responde rápido o bastante a um pedido de ferramenta, o servidor aborta a conexão sem dó.
   - *Solução:* Reduzimos o *UX Hack Timeout* de 2500ms para 1200ms. Dá tempo suficiente para a transição vocal, preservando uma margem gigante antes do timeout da API.

3. **Alucinação de Tipos Sintáticos:** O terceiro fator era a própria natureza probabilística do Gemini. Embora o schema determinasse estritamente que `termo_busca` fosse `Type.STRING`, o modelo — ao ver a instrução "termos separados por vírgula" — ocasionalmente decidia ser prestativo e enviava um objeto `Array` JSON nativo `["TI", "tecnologia"]`. Isso fazia o nosso `.split(',')` lançar um `TypeError` que o bloco `catch` engolia e devolvia como erro genérico para a ferramenta, adicionando caos ao estado da conexão.
   - *Solução:* Defesa proativa no Typescript: `Array.isArray(filtro.termo_busca) ? ...join(',') : String(...)`. 

*A Lição:* Em interfaces conversacionais multimodais, os erros quase nunca são lineares. Eles ocorrem na intersecção entre o comportamento não-determinístico da IA (alucinação de tipo), a física das redes de tempo real (WebSocket payload e timeouts) e a engenharia da experiência do usuário (UX hacks de timing). Proteger o sistema exige programar assumindo que as três camadas tentarão se auto-sabotar simultaneamente.

### A Latência Acústica e a Palavra Engolida (UX Voice Delay)
**Data:** 19 de maio de 2026 (Continuação)

Após resolvermos o problema do WebSocket (ver tópico acima), nos deparamos com uma consequência colateral da nossa própria solução. Reduzimos o timeout de transição para 1.2 segundos, o que impediu as quedas do socket. No entanto, o prompt mandava a IA dizer: *"Vou pesquisar esses investimentos para você..."*. Falar isso exige 2.5 a 3 segundos. Resultado: aos 1.2 segundos, nós disparávamos a `sendToolResponse`, o que cortava instantaneamente o áudio da IA no meio da frase. Ela "engolia" as palavras e começava a vomitar o resultado final em cima do áudio inacabado.

**A Solução Híbrida:**
1. **Engenharia de Prompt (Extrema Brevidade):** Alteramos a instrução VITAL da ferramenta. Proibimos frases longas e ordenamos que a IA use APENAS: *"Buscando."* ou *"Só um segundo."* (uma ou duas palavras no máximo).
2. **Afinação de Timeouts:** Aumentamos o delay artificial de `1.2s` para `1.5s`. 
Assim, damos exatamente 1.5 segundos (uma janela de tempo curtíssima, mas segura para o WebSocket) e forçamos a IA a falar uma frase que cabe cirurgicamente dentro dessa janela. A UX fica fluida, ultra-responsiva, e o sistema de rede permanece vivo. Mais um exemplo de que o design conversacional não é apenas linguística, é engenharia de tempo real.

### A Divergência Arquitetural e o Backporting de UX
**Data:** 19 de maio de 2026 (Conclusão)

A necessidade de replicar essas correções de áudio e robustez para as branches antigas (`main`, `web/v3.0`, `web/v4.0`, `web/v4.1`) revelou o custo da divergência estrutural. Tentar um `cherry-pick` do commit falhou porque a branch `mobile/v2.3` (onde as correções originais nasceram) introduziu a `CapivaraPet` e o suporte a DuckDB, o que alterou profundamente arquivos cruciais como `ChatView.tsx` e `piespDataService.ts`.

**A Solução de Sincronização:**
Em vez de forçar um merge que traria código mobile para as versões web legadas, isolamos a "alma matemática" do patch:
1. **Payload e Otimização:** O corte cirúrgico no JSON (de 20/10 para 5 registros) e o limite de caracteres de descrição.
2. **UX de Áudio:** A injeção do delay de `1.5s` associado à mudança nos `systemInstructions` para frases curtas ("Só um segundo.", "Buscando.").

Aplicamos esse core logic através de um script automatizado que varreu, ajustou e fez commit em todas as quatro branches web sem poluir sua arquitetura base.
*Lição:* Ao manter múltiplas "linhagens" vivas (web vs mobile) com backends diferentes (CSV vs DuckDB), correções de infraestrutura (como falhas no WebSocket) devem ser portadas focando no *conceito funcional* (a lógica de negócio / UX timeout) em vez da *tentativa de mesclar diffs de código* cego via Git.

### O Fim do "Atropelo": Smart Wait Dinâmico
**Data:** 20 de maio de 2026

O *UX Hack* anterior que usava um delay fixo de 1500ms para aguardar a IA dizer "Buscando" provou-se ineficaz. Dependendo da latência da rede e do tempo de resposta da API do Gemini, o áudio da IA podia demorar mais de 500ms para *começar* a tocar no frontend. Como resultado, o `sendToolResponse` era acionado antes da fala terminar, cortando o áudio e engolindo as palavras. Além disso, se ela falasse uma frase um pouco mais longa, seria cortada do mesmo jeito.

**A Solução (Smart Wait):**
Em vez de um timer cego, implementamos uma trava dinâmica baseada no ciclo de vida real do áudio da IA (`isSpeakingRef`):
1. **Initial Grace Period:** Aguardamos até 600ms para ver se o estado de fala (`isSpeakingRef.current`) se torna `true`. Isso compensa o atraso entre o recebimento do `toolCall` e a chegada do primeiro chunk de áudio do `modelTurn`.
2. **Speaking Lock:** Se ela estiver falando, congelamos a execução do `sendToolResponse` até que `isSpeakingRef.current` seja `false` (o evento `ended` do `AudioBufferSourceNode` foi acionado).
3. **Safety Timeout:** Para garantir que não tomaremos um *timeout* do WebSocket da Google, impomos um limite duro de 2500ms para essa espera.

Isso garante que a IA *sempre* termina de falar antes da ferramenta responder, adaptando-se perfeitamente ao tamanho da frase e estabilizando a sensação estranha de "engolir palavras".
