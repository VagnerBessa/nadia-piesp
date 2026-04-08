# Skill: Design de Dashboards — Data Lab

Esta skill define as regras visuais e de composição que a Nadia deve seguir ao gerar dashboards no Data Lab. Ela controla **como** os dados são apresentados, não **o que** analisar.

---

## Catálogo de componentes disponíveis

Você pode usar qualquer combinação dos seguintes tipos de seção:

**1. `kpi-cards`** — cards de métricas principais
```json
{ "tipo": "kpi-cards", "cards": [
    { "label": "texto", "valor": "texto", "detalhe": "opcional", "tendencia": "up|down|neutral" }
]}
```
Use `tendencia: "up"` para crescimento, `"down"` para queda. Omita se não aplicável.

**2. `chart`** — gráficos visuais
```json
{ "tipo": "chart", "chart": { "type": "TIPO", "title": "texto", "data": [{"name":"","value":0}] }}
```

**3. `bar-list`** — ranking textual com barra proporcional (sem eixos, mais limpo que chart)
```json
{ "tipo": "bar-list", "titulo": "opcional", "items": [
    { "name": "texto", "value": 1500, "label": "R$ 1,5 bi" }
]}
```

**4. `tabela`** — tabela detalhada de projetos
```json
{ "tipo": "tabela", "titulo": "opcional", "colunas": ["Col1","Col2"], "linhas": [["val","val"]] }
```

**5. `texto`** — análise narrativa interpretativa
```json
{ "tipo": "texto", "conteudo": "parágrafos separados por \n\n" }
```

---

## Regras de seleção de tipo de gráfico

| Tipo | Usar quando | Não usar quando |
|---|---|---|
| `pie` | Distribuição proporcional entre ≤ 5 categorias | Mais de 5 categorias — agrupe o excedente em "Outros" |
| `line` | Evolução temporal com 3 ou mais pontos | Menos de 3 pontos — use `bar` |
| `area` | Evolução temporal com 5 ou mais anos | Menos de 5 anos — use `line` ou `bar` |
| `bar` | Comparação com nomes curtos (setores, anos, tipos) | Nomes longos (mais de 12 caracteres) |
| `bar-horizontal` | Nomes com mais de 12 caracteres (empresas, municípios) | — |
| `bar-list` | Rankings com mais de 8 itens | — |
| `composed` | Volume absoluto + tendência simultaneamente | Sem o campo `linha` nos dados |

Para `composed`, inclua o campo `"linha": número` nos itens de data para a linha sobreposta.

---

## Ordem das seções (impacto decrescente)

1. **`kpi-cards`** — sempre primeiro. Visão imediata dos números chave.
2. **Visual mais relevante para a pergunta** — segundo lugar.
3. **Visuais de contexto** (distribuição, comparação) — no meio.
4. **`tabela`** — penúltimo. Detalhamento para quem quer aprofundar.
5. **`texto`** — sempre por último. Interpretação após ver os dados.

---

## Regras de não-redundância

- Não mostre o mesmo dado em dois gráficos diferentes (ex: `bar` setorial **e** `pie` setorial).
- Se já existe um `bar-list` de municípios, não crie também um `bar` de municípios.
- KPI cards não devem repetir números já evidentes no gráfico imediatamente abaixo.

---

## Regras para dados escassos

- Dimensão com apenas 1 valor único → inclua no `kpi-cards` ou no `texto`, não em gráfico.
- Série temporal com 1 ou 2 anos → não gere chart temporal. Use `kpi-cards` para o período.
- Se uma distribuição tiver um único item com 100% → não gere `pie`. Coloque no `kpi-cards`.
