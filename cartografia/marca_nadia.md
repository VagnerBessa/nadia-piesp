# Nadia como Marca e Sistema Integrado

**Data:** Abril de 2026
**Contexto:** Discussão sobre a identidade do sistema de IA do Seade — se Nadia e Hermes são paralelos ou se Nadia é o ponto focal. Separado do documento técnico de ecossistema deliberadamente: essa é uma questão de estratégia de produto e comunicação organizacional, não de arquitetura.

---

## O problema cognitivo

Arquiteturas paralelas fazem sentido no papel. Na prática organizacional, criam fricção:

- Qual sistema devo usar?
- A Nadia e o Hermes me dão respostas diferentes?
- Se eu perguntar a mesma coisa nos dois, qual é "certo"?
- Quando o Hermes aprende algo, a Nadia sabe?

Essas perguntas não têm resposta técnica satisfatória para um técnico do Seade que não está imerso na arquitetura. Elas consomem energia cognitiva que deveria estar na análise dos dados.

A solução não é técnica. É de marca.

---

## A lição da Alexa

Em 2014, a Amazon lançou o Echo com a Alexa. Nos anos seguintes, a Alexa chegou ao Echo Dot, ao Fire TV, ao Echo Show com tela, a carros BMW, a termostatos, a óculos de sol. Cada dispositivo tem hardware diferente, capacidades diferentes, limitações diferentes. O Echo Show mostra vídeos; o Echo básico não. O Echo do carro não ouve música local. As respostas variam por contexto.

Mas o usuário nunca precisa saber disso. Ele diz "Alexa" e espera uma resposta. A marca absorve a complexidade técnica.

Internamente, a Amazon reconstruiu completamente os modelos de linguagem da Alexa pelo menos duas vezes. Adicionou LLMs generativos em 2023. Mudou a arquitetura de inferência. Ninguém percebeu, porque a Alexa continuou sendo a Alexa.

**A marca é mais durável que a tecnologia que a sustenta.**

O mesmo vale para o Seade. A tecnologia por baixo da Nadia pode mudar — Gemini pode ser substituído, Hermes pode evoluir, os MCP servers podem migrar para SQL Server. O que não deve mudar é a Nadia.

---

## Nadia como sistema de três canais

Em vez de "Nadia e Hermes são sistemas paralelos", a leitura correta é:

**Nadia é o sistema. Hermes é o motor de um dos canais.**

```
┌─────────────────────────────────────────────┐
│                  NADIA                      │
│         Sistema de IA do Seade              │
├─────────────┬───────────────┬───────────────┤
│  Nadia Web  │ Nadia Mobile  │   Nadia API   │
│             │               │               │
│  Browser    │ Telegram      │  MCP servers  │
│  Gemini     │ Slack         │  Para qualquer│
│  Dashboards │ WhatsApp      │  consumidor   │
│  Voz        │               │               │
│             │ Motor: Hermes │               │
└─────────────┴───────────────┴───────────────┘
```

Para o usuário do Seade, é sempre Nadia. Para o arquiteto, são três implementações com motores diferentes.

---

## O que define a identidade da Nadia (não é o modelo)

A Nadia não é o Gemini. Não é o Hermes. A identidade da Nadia é um conjunto de definições que podem ser portadas para qualquer motor:

**Persona:** analista de dados especializada no Estado de SP, profissional mas acessível, que não adivinha dados — consulta antes de responder.

**Escopo:** dados do Seade e do Estado de SP. Não responde sobre o que não tem acesso determinístico.

**Tom:** direto, analítico, sem jargão desnecessário. Não é um chatbot — é uma especialista.

**Acesso a dados:** via MCP servers, nunca por memória do modelo (evita alucinação).

Esse conjunto é portável. Quando o Hermes opera como canal da Nadia, ele recebe essas definições via system prompt e configuração. O motor é Hermes; a identidade é Nadia.

---

## A tensão honesta: o que muda entre canais

Unificar a marca não elimina diferenças reais de comportamento entre canais. Elas existem e o Seade precisa saber gerenciá-las:

| | Nadia Web | Nadia Mobile (Hermes) |
|---|---|---|
| Memória entre sessões | Nenhuma — cada sessão começa do zero | Persistente — lembra conversas anteriores |
| Interface | Gráficos, dashboards, tabelas | Texto, eventualmente imagens |
| Profundidade analítica | Alta — Data Lab, relatórios completos | Média — respostas concisas para mensageria |
| Aprende com o uso | Não | Sim — skills e padrões se acumulam |
| Disponibilidade | Requer browser | Qualquer dispositivo com Telegram/Slack |

Essas diferenças não são problemas — são características de canal, exatamente como a Alexa do Echo Show tem tela e a do Echo básico não. O usuário aprende a expectativa certa para cada canal.

A comunicação interna do Seade deve ser explícita sobre isso: *"A Nadia Mobile lembra o que você perguntou ontem. A Nadia Web começa cada conversa do zero."* Não é um bug — é o design do canal.

---

## O que o Hermes aprende quando opera como Nadia

Essa é a parte contraintuitiva que merece atenção.

Quando o Hermes está configurado como Nadia Mobile, o loop de aprendizagem dele não aprende a "ser outra coisa" — aprende a ser uma **Nadia melhor**. Especificamente:

- Quais perguntas os analistas do Seade fazem com mais frequência
- Quais combinações de dados são mais úteis para responder sobre investimentos + emprego
- O contexto de interesse de cada analista ("o João sempre pergunta sobre Campinas")
- Quais respostas geraram pedidos de aprofundamento (sinal de que foram incompletas)

Com o tempo, a Nadia Mobile se torna mais calibrada para o Seade do que qualquer IA genérica jamais seria. O Hermes não dilui a identidade da Nadia — ele a refina através do uso.

---

## Os MCP servers como infraestrutura agnóstica

Um detalhe importante: os MCP servers não são "da Nadia". São a **infraestrutura de dados do Seade**, expostos via protocolo aberto.

Isso significa que:
- Um analista pode conectar os MCPs ao Claude Desktop pessoal dele
- A equipe de TI pode usar os dados via scripts Python
- Um futuro sistema baseado em GPT ou outro modelo pode consumir os mesmos dados
- O Power BI pode se conectar via adapter MCP

Os MCP servers sobrevivem a qualquer decisão sobre qual IA usar. Se o Seade um dia decidir mudar de Gemini para outro modelo, os dados continuam acessíveis da mesma forma. Isso é intencional — dado não deve ter dependência de fornecedor de IA.

---

## Recomendação para comunicação interna

**Para usuários do Seade:** "Nadia é o sistema de IA do Seade para análise de dados. Você pode acessá-la pelo navegador (Nadia Web) ou pelo Telegram (Nadia Mobile). A versão mobile lembra conversas anteriores."

**Para a equipe técnica:** "Nadia Web usa Gemini + React. Nadia Mobile usa Hermes configurado com a persona Nadia. Os MCP servers são compartilhados e são a fonte de dados de ambos."

**Para a gestão:** "Nadia é o produto. A arquitetura interna pode evoluir sem que o produto mude de nome ou de propósito."

---

## O princípio de durabilidade

A decisão de nomear o sistema "Nadia" — e não "Gemini do Seade" ou "Hermes do Seade" — é estratégica. Vincula a marca ao Seade, não ao fornecedor de tecnologia.

Daqui a três anos, o Gemini pode ser substituído por algo melhor. O Hermes pode dar lugar a outro agente. Os MCP servers podem migrar para SQL Server. A Nadia continua sendo a Nadia — o sistema de IA do Seade que os técnicos aprenderam a usar, que a gestão aprovou, que os analistas confiam.

Essa durabilidade é construída hoje, na decisão de colocar a marca no centro.
