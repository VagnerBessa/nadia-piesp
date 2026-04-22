# Diário de Bordo — Reflexões e Filosofia de IA

Este documento serve para registrarmos conversas informais, alinhamentos arquiteturais de alto nível e debates filosóficos sobre o comportamento da inteligência artificial dentro da Fundação Seade e do sistema Nadia-PIESP.

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
