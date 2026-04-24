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

### A Fricção de Vocabulário e o Risco de Alucinação (Semantic Translation)
**Data:** 16 de abril de 2026

Debatemos uma questão estrutural sobre como o Ecossistema Nadia traduz *queries* idiomáticas soltas dos cidadãos (ex: "faturamento do comércio") para o banco de dados determinístico (ex: cujo filtro paramétrico estrito exige a string `vendas_varejo`).

A conclusão foi contundente: **dar ao LLM a liberdade de redigir a query de banco de dados do zero (Text-to-SQL) é o caminho perfeito para a alucinação fatal de dados governamentais**. As *Tools* devem ser intransponíveis, restando ao LLM atuar puramente como o tradutor semântico na porta de entrada da requisição.

Sintetizamos que essa etapa de "Match Semântico" não reintroduz a alucinação, desde que aplique-se uma destas arquiteturas de entrada:

1. **Enums Tipados com Tool Descriptions**: Embutir no System Prompt do LLM os sinônimos da tabela (ex: *"Use o parâmetro 'vendas_varejo' quando o solicitante pedir 'faturamento' ou 'receita'"*). É de fácil adoção para filtros pequenos e não requer infraestrutura.
2. **Semantic Routing (Roteamento de Verossimilhança)**: Executar um passo autônomo com um modelo leve *apenas* para reescrever a intenção do usuário em linguagem de banco antes de repassar à Tool ("faturou" = "vendas"). Funciona excelentemente mas degrada a latência (prejudicando canais críticos como o de Voz).
3. **Vetorização Dinâmica (RAG Lexical)**: Fazer um match vetorial da palavra do cidadão contra um dicionário de dados local antes sequer da IA começar a invocar as *Tools*. Trata-se do padrão ouro *Enterprise*, imaculado para dicionários de metadados enormes (ex: a árvore CBO de profissões ou Classificação CNAE).

**A Recomendação Arquitetural do Módulo**
A abordagem recomendada para a engenharia atual do Seade (Fases 1/2) é um modelo **Híbrido**.
Aplica-se a **Alternativa 1 (Enums + Descriptions no JSON Schema da Tool)** de forma imediata para os filtros que já possuímos (como anos e macrossetores no Dashboard PIESP). Quando os MCP Servers avançarem para bases hiper-fragmentadas (como CAGED/PNAD), a **Alternativa 3 (RAG Lexical Dinâmico)** deverá obrigatoriamente ser construída, visto que injetar listas infinitas de sinônimos em Tools destruiria o Budget e a precisão do modelo Gemini.

---

### Migração DuckDB, Fragilidades do ESM e Refinamento de Filtros Temporais
**Data:** 24 de abril de 2026

Hoje avançamos em frentes críticas de infraestrutura e usabilidade, inaugurando a branch `feature/duckdb-migration`.

1. **A Transição para DuckDB e Parquet:**
   Iniciamos a migração da leitura bruta de CSVs em memória para um banco de dados analítico local embutido (DuckDB) consultando arquivos colunares (Parquet). O arquivo `knowledge_base/piesp.parquet` e o servidor `scripts/piesp-duckdb-mcp-server.mjs` marcam a evolução do sistema para lidar com metadados complexos e agregações ultrarrápidas, sem sobrecarregar a memória do navegador. A escolha de isolar isso numa branch (`feature/duckdb-migration`) foi vital para manter a estabilidade da produção enquanto homologamos o dual-server environment.

2. **A "Tela Branca da Morte" e a Rigidez do Vite (ESM):**
   A aplicação quebrou completamente ao trocarmos de branch devido à ausência do arquivo `config.ts` (ignorado via `.gitignore`). O aprendizado arquitetural aqui é que módulos ESM no Vite quebram o parsing *imediatamente* caso uma importação nomeada não exista (ex: faltava `OPENROUTER_API_KEY`). A tela fica em branco sem sequer montar o DOM do React. Em aplicações baseadas em chaves de IA variadas, o tratamento de variáveis de ambiente deve ser resiliente, preferencialmente usando `import.meta.env` com fallbacks amigáveis em vez de imports rígidos que cracham a thread principal.

3. **Ontologia Temporal: Ano de Anúncio vs. Período de Execução:**
   Detectamos uma alucinação de dados sutil: a Nadia estava confundindo o "ano em que o projeto foi registrado" com o "período de tempo em que ele será executado". Se o usuário pedia "investimentos entre 2026 e 2030", ela enviava o parâmetro `ano` padrão para o buscador.
   - *A Correção:* Alteramos a engenharia do `piespDataService.ts` e do Schema das Tools (`useChat.ts` / `useLiveConnection.ts`) para separar explicitamente `ano_inicio` e `ano_fim` extraídos da coluna `periodo` do banco. Ensinamos ao System Prompt a diferença semântica, forçando-o a ignorar o ano de anúncio quando a pergunta envolver "intervalos de execução".

78.

5. **O Sucesso da Arquitetura DuckDB-WASM:**
   A etapa final da migração comprovou que a adoção do DuckDB-WASM, compilado localmente via pacote NPM e carregando um `piesp.parquet` estático, fornece estabilidade ímpar contra erros de parse (frequentes com delimitadores como ponto e vírgula contidos no meio do corpo dos textos). O grande "pulo do gato" da UI foi garantir que todos os componentes (`DataLabView`, `ExplorarDadosView`, `PiespDashboardView`, `VoiceView` e `PerfilEmpresaView`) utilizassem os dados centralizados retornados do DuckDB-WASM e tratassem tudo com Promises assíncronas. Como o parquet tem pouco mais de 5 mil linhas, a execução do WASM em modo cliente permite cálculos pesados num piscar de olhos, sem qualquer custo de latência de servidor. O código tornou-se menor, mais limpo e seguro contra alucinações de schema.

6. **Acoplamento Fino entre IA e Mecanismos SQL (Sensibilidade a Acentos e Limites Estritos):**
   Descobrimos que a transição de PostgreSQL/Javascript `includes` para DuckDB introduzia uma restrição severa de idioma: o `LOWER()` do DuckDB não remove acentos naturalmente. Assim, buscas guiadas pela IA com os termos "saude" ou "saúde" poderiam se desencontrar da base.
   - *A Correção:* Transformamos as vogais acentuadas provenientes do input do usuário em wildcards puros do SQL (`_`) diretamente no middleware do Frontend antes da query, resolvendo o problema de forma agnóstica sem instalar extensões do DuckDB.
   - Além disso, constatamos novamente a *Síndrome da Subserviência* (Helpful Bias) da IA. Ao ser questionada sobre a "área da saúde", ela insistia em enquadrar a palavra no filtro restrito de `setor`, falhando ao tentar achar uma categoria exata. Alteramos o Prompt de Tool Calling para blindar o campo `setor` estritamente a 5 valores macro (ex: "Serviços"), instruindo a Nadia a canalizar nichos (como "Saúde" ou "Tecnologia") invariavelmente para o campo genérico de `termo_busca`, e alimentamos esse parâmetro com as colunas completas do CNAE em SQL (`CONCAT_WS`), resultando numa fluidez imaculada.
