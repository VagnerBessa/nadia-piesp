# PIESP — Crise de Coleta e Oportunidade Metodológica

**Data:** Abril de 2026
**Contexto:** Discussão sobre os limites da metodologia atual da PIESP e o caminho para uma coleta híbrida com IA. Este documento é deliberadamente separado da arquitetura técnica porque a decisão é institucional antes de ser tecnológica.

---

## O problema real

A PIESP captura anúncios de investimento em jornais eletrônicos e, em seguida, técnicos ligam para as empresas para verificar e obter dados precisos. Essa verificação por telefone é o que transforma um anúncio de imprensa em dado de pesquisa — é o que dá à PIESP sua credibilidade como publicação científica do Seade.

O problema: as empresas estão cada vez mais avessas a responder. LGPD, desconfiança institucional, burocracia interna, fusões que tornam o interlocutor incerto — as taxas de resposta caem. A pesquisa fica mais cara para produzir e menos abrangente ao mesmo tempo.

---

## Por que a informação já existe, só não está estruturada

Há uma diferença importante entre o que as empresas **não querem falar ao telefone** e o que elas **já publicaram**. Investimentos relevantes são comunicados ao mercado:

- **Fatos Relevantes na B3** (empresas listadas são obrigadas a divulgar)
- **Press releases corporativos** (o anúncio já é para a imprensa)
- **Comunicados a credores** (para empresas com debêntures e bonds)
- **Licenças e aprovações ambientais** (publicadas em diários oficiais)
- **Editais e contratos públicos** (quando o investimento envolve concessão)

O que falta não é a informação — é a capacidade de coletá-la de forma estruturada em escala.

---

## A tendência nas agências estatísticas

O Seade não está sozinho nessa tensão. Agências estatísticas ao redor do mundo enfrentam a mesma crise dos surveys:

- **IBGE** explora registros administrativos (RAIS, CAGED, notas fiscais) para reduzir censos
- **Eurostat** tem programas ativos de uso de Big Data e web scraping para estatísticas econômicas
- **ONS** (Reino Unido) usa dados de transações bancárias para estimativas do PIB em tempo real
- **Statistics Canada** monitora preços via scraping de e-commerce

A direção é clara: surveys custosos com taxas de resposta declinantes cedem espaço para dados administrativos e web-coletados. A questão para o Seade não é *se* fazer essa transição, mas *como* fazê-la preservando o que diferencia a PIESP.

---

## O que diferencia a PIESP e não pode ser perdido

Antes de automatizar qualquer coisa, é necessário ser preciso sobre o que a PIESP oferece que fontes automáticas não oferecem:

**1. Geolocalização precisa do município**
Notícias dizem "região de Campinas" — a PIESP sabe que é Hortolândia. Essa precisão municipal vem da ligação.

**2. Tipo de investimento**
Implantação, ampliação ou modernização raramente está explícito no texto da notícia. O técnico pergunta.

**3. Valor confirmado vs. anunciado**
Empresas costumam anunciar valores maiores do que realmente investem. A PIESP captura o valor confirmado, não o anunciado para a imprensa.

**4. Data de início efetivo**
O anúncio é de hoje, mas o investimento começa daqui a dois anos. A PIESP registra o momento relevante.

Esses quatro atributos são o que transforma a PIESP em pesquisa. Dados web coletados automaticamente terão boa cobertura de empresa, setor e valor anunciado — mas incerteza nessas quatro dimensões.

---

## O modelo híbrido: curador, não coletor

A proposta não é eliminar o técnico. É mudar seu papel.

**Hoje:**
```
Técnico monitora jornais → encontra anúncio → liga para empresa → registra dado
```

**Com coleta automatizada:**
```
Nadia monitora fontes → extrai e estrutura → técnico revisa e valida → registra dado
```

O técnico migra de **coletor** para **curador**. O volume de ligações cai porque:
- Empresas listadas na B3: valor já é público (fato relevante)
- Grandes empresas com IR estruturado: dado frequentemente disponível
- Anúncios com valor explícito e município claro: validação possível sem ligação

A ligação fica reservada para os casos que realmente exigem verificação: valores não divulgados, municípios ambíguos, empresas novas sem histórico.

---

## As implicações metodológicas que o Seade precisa decidir

Essas não são decisões técnicas. São decisões institucionais que precisam de deliberação:

**1. Dois tipos de registro na mesma base?**
Entradas verificadas por ligação têm status diferente de entradas validadas por curadoria web. A base precisaria distinguir. As séries históricas continuariam comparáveis?

**2. Como documentar a mudança metodológica?**
Publicações científicas exigem transparência metodológica. Se a PIESP mudar sua forma de coleta, as notas metodológicas precisam refletir isso. Isso é positivo — mas requer trabalho institucional.

**3. O que fazer com valores "anunciados" vs. "confirmados"?**
Uma opção é publicar as duas colunas: valor anunciado (coletado automaticamente) e valor confirmado (verificado por ligação quando possível). Isso aumenta a cobertura sem sacrificar a precisão onde ela existe.

**4. Qual é o threshold para ligação obrigatória?**
Uma política possível: investimentos acima de R$ 500 milhões sempre têm ligação. Abaixo disso, curadoria web é suficiente. O limite é uma decisão de qualidade, não técnica.

---

## O que a IA não substitui

Seja qual for a decisão metodológica, há um limite claro para o que a automação faz:

- **Não substitui o julgamento editorial** sobre o que conta como investimento para fins da PIESP
- **Não resolve ambiguidades geográficas** sem alguma forma de verificação
- **Não acessa informações não publicadas** — o que a empresa nunca divulgou continuará inacessível
- **Não confere ao dado o status de pesquisa** — isso vem da instituição que publica, não da tecnologia que coleta

A Nadia Coletora é um instrumento. A PIESP continua sendo uma pesquisa do Seade.
