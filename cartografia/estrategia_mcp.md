# Estratégia MCP do Seade

**Data:** Abril de 2026
**Contexto:** Decisões arquiteturais sobre como estruturar os servidores MCP que expõem as bases do Seade para o ecossistema Nadia + Hermes.

---

## O princípio central

> **Dado vive no domínio que o produz. Perfil municipal é sempre síntese da inteligência.**

Esse princípio elimina redundância e define claramente a responsabilidade de cada camada do sistema.

---

## O que é um "perfil municipal"

O Seade produz dezenas de indicadores com recorte municipal: PIB, população, emprego formal, IPRS, IDH, produção agropecuária, investimentos. Todos são igualmente "municipais" — a diferença entre eles é metodológica (uns são medidos diretamente, outros calculados por fórmulas compostas), mas para o sistema de IA essa distinção não existe. São todos variáveis que descrevem um município.

**O perfil municipal não é uma base de dados.** É o resultado do que a IA produz quando alguém pergunta sobre um município. Não deve ser pré-calculado nem armazenado como produto do sistema de IA — cada indicador vive no domínio que o produz, e a síntese acontece no momento da consulta.

```
❌ Errado:  base_municipal.csv (PIB + IDH + emprego + investimentos juntos)
✅ Correto: Hermes chama economia-mcp + demografia-mcp + trabalho-mcp e sintetiza
```

A vantagem: quando o Seade atualiza os dados de emprego, o perfil de qualquer município já reflete isso automaticamente. Com uma base municipal separada, alguém precisaria regenerá-la manualmente.

---

## Estrutura de MCP servers: domínio, não tabela

O critério de agrupamento é o **domínio temático** — não o CSV, não a tabela, não o indicador individual. Bases do mesmo domínio são atualizadas no mesmo ciclo, consultadas em conjunto e pertencem à mesma equipe.

### `seade-economia-mcp`
**Dono:** Equipe de Contas Regionais e PIESP
**Ciclo:** Anual (PIESP, PIB) / Trimestral (produção)
**Bases:**
- PIESP — investimentos anunciados e confirmados
- PIB municipal — valor adicionado por município
- Produção industrial
- Produção agropecuária

**Tools:**
```
consultar_investimentos(municipio?, setor?, ano?, regiao?)
consultar_pib_municipal(municipio?, ano?)
consultar_producao_industrial(municipio?, setor?, ano?)
consultar_producao_agropecuaria(municipio?, produto?, ano?)
```

---

### `seade-trabalho-mcp`
**Dono:** Equipe de Mercado de Trabalho
**Ciclo:** Mensal (CAGED) / Trimestral (PNAD)
**Bases:**
- Emprego formal (CAGED)
- Desemprego (PNAD Contínua / pesquisa própria Seade)
- Massa salarial e rendimento médio

**Tools:**
```
consultar_emprego_formal(municipio?, setor?, ano?, mes?)
consultar_desemprego(regiao?, ano?, trimestre?)
consultar_rendimento(municipio?, setor?, ano?)
```

---

### `seade-demografia-mcp`
**Dono:** Equipe de Estatísticas Populacionais
**Ciclo:** Anual (estimativas) / Decenal (Censo)
**Bases:**
- População residente (estimativas intercensitárias)
- Migrações
- Domicílios e arranjos familiares
- Projeções populacionais

**Tools:**
```
consultar_populacao(municipio?, ano?, faixa_etaria?)
consultar_migracoes(municipio?, origem?, ano?)
consultar_domicilios(municipio?, tipo?, ano?)
consultar_projecao_populacional(municipio?, ano_horizonte?)
```

---

### `seade-indices-mcp`
**Dono:** Equipe de Índices e Indicadores Sintéticos
**Ciclo:** Variável por índice
**Bases:**
- IPRS — Índice Paulista de Responsabilidade Social
- IDH municipal (PNUD, incorporado pelo Seade)
- IVJ — Índice de Vulnerabilidade Juvenil
- Outros índices publicados pelo Seade

**Tools:**
```
consultar_iprs(municipio?, dimensao?, ano?)
consultar_idh(municipio?, componente?, ano?)
consultar_ivj(municipio?, ano?)
```

**Nota:** Os índices sintéticos são computados por metodologia própria do Seade — não pela IA. O MCP serve o resultado já calculado. A IA interpreta e contextualiza, nunca recalcula.

---

## O papel do Hermes diante de múltiplos MCPs

O Hermes conecta a todos os servidores simultaneamente. Para o analista que pergunta sobre Campinas via Telegram:

```
Hermes recebe: "Como está Campinas em termos de desenvolvimento?"

Hermes chama:
  economia-mcp  → PIB e investimentos de Campinas
  trabalho-mcp  → emprego formal em Campinas
  demografia-mcp → população e perfil etário
  indices-mcp   → IPRS e IDH de Campinas

Hermes sintetiza → resposta contextualizada com todos os dados
```

Isso é possível porque o Hermes raciocina sobre quais tools usar, chama em paralelo quando possível, e integra os resultados. Nenhuma base "municipal" precisou existir.

---

## O que o MCP municipal seria (e o que não seria)

Dado o princípio acima, um eventual `seade-municipal-mcp` **não armazenaria dados**. Existiria apenas para tools de orquestração que nenhum domínio único pode responder:

```
comparar_municipios(lista[], indicadores[])
→ chama múltiplos MCPs internamente, devolve tabela comparativa

ranking_municipios(indicador, ano, top_n)
→ agrega e ordena municípios de todos os domínios por qualquer métrica
```

Mesmo isso pode ser dispensável se o Hermes for configurado para fazer essa orquestração diretamente. A decisão de criar ou não esse servidor deve esperar até que a necessidade seja concreta — não antecipar.

---

## Governança: contrato entre times

O MCP é a fronteira entre quem produz o dado e quem o consome. O contrato entre os times é o **schema das tools**: nomes, parâmetros e formato de retorno.

| Responsabilidade | Time de dado (ex: Contas Regionais) | Time de plataforma (Nadia/Hermes) |
|---|---|---|
| Atualizar os dados | ✅ | ❌ |
| Manter o MCP server | ✅ | ❌ |
| Definir schema das tools | Conjunto | Conjunto |
| Consumir as tools | ❌ | ✅ |
| Evoluir Nadia e Hermes | ❌ | ✅ |

Uma vez que o schema é acordado, cada time evolui sua parte de forma independente. O time de dados pode migrar de CSV para SQL Server sem o time de plataforma saber — desde que as tools continuem retornando o mesmo formato.

---

## Sequência de implementação

```
Agora:     seade-economia-mcp   (PIESP já implementado ✓)
2ª fase:   seade-trabalho-mcp   (maior demanda cruzada com PIESP)
3ª fase:   seade-indices-mcp    (IPRS + IDH — alta visibilidade política)
4ª fase:   seade-demografia-mcp (complementa os demais)
Sob demanda: seade-municipal-mcp (só se orquestração manual se provar necessária)
```

A sequência segue a **demanda real de cruzamento**, não a ordem de importância das bases. O cruzamento mais pedido pelos analistas do Seade será o de investimentos com emprego — por isso trabalho vem em segundo.
