# Bugs Abertos

---

## BUG-001 — Filtros de setor e região retornam 0 no Chat

**Data:** Abril de 2026. **Status: resolvido.**

**Sintoma:** O Chat retorna "Não foram encontrados projetos" para perguntas como "investimentos de comércio na Região Metropolitana de São Paulo", mesmo com dados confirmados na base. A aba Explorar funciona corretamente com os mesmos filtros. Ambos os filtros — setor e região — falham.

---

### Por que o Explorar funciona e o Chat não

`getMetadados()` (linha 393 de `piespDataService.ts`) trata setores e regiões de forma diferente:
- **Setores** (linha 410): `canonicalSetor(setor)` → dropdown mostra nomes canônicos em Unicode correto (`"Comércio"`, `"Indústria"`)
- **Regiões** (linha 411): `regioes.add(regiao)` → valor bruto do CSV, garbled (`"RA S\uFFFDo Paulo"`)

No Explorar, o `filtro.regiao` vem do dropdown — é o mesmo string garbled que está no CSV. Ambos os lados da comparação são idênticos → match imediato.

No Chat, o Gemini gera `"Região Metropolitana de São Paulo"` (Unicode correto). Esse valor é comparado contra `"RA S\uFFFDo Paulo"` (garbled do CSV) → sem match.

O filtro de setor também falha no Chat. Como removemos os logs antes de confirmar, não sabemos qual argumento o Gemini está passando: se usa `setor: "Comércio"` (canonical) ou `termo_busca: "comércio"` (texto livre).

---

### Por que a correção com `normAsciiOnly` não funcionou

`normAsciiOnly` foi adicionada a `regiaoMatchPorNome` como fallback. A hipótese era que remover todos os não-`[a-z]` de ambos os lados produziria strings idênticas. Estava errada.

`normAsciiOnly` é aplicada sobre o resultado de `norm()`, e `norm()` trata U+FFFD e ã de forma assimétrica:
- `norm("São Paulo")`: NFD decompõe `ã` → `a` + combining tilde → strip combining → `"sao paulo"` (`a` preservado)
- `norm("S\uFFFDo Paulo")`: U+FFFD não é diacrítico, não é tocado → `"s\uFFFDo paulo"` (sem `a`)

Após `stripPrefix` e `normAsciiOnly`:

| Origem | Após norm + stripPrefix | Após normAsciiOnly |
|---|---|---|
| `"RA S\uFFFDo Paulo"` (CSV garbled) | `"s\uFFFDo paulo"` | **`"sopaulo"`** |
| `"Região Metropolitana de São Paulo"` (Gemini) | `"sao paulo"` | **`"saopaulo"`** |

`"sopaulo" ≠ "saopaulo"` → ainda sem match. O `a` de `ã` é recuperado por `norm()` no caminho Unicode correto, mas não existe no caminho garbled.

O fallback por municípios (`resolverRegiaoEmMunicipios`) falha pelo mesmo motivo: o set `RMSP` contém `"sao paulo"` (com `a`), mas `norm("s\uFFFDo paulo")` produz `"s\uFFFDo paulo"` — não está no set.

---

### Falhas de método

1. **Depuramos sem visibilidade.** Removemos os logs antes de confirmar que o bug foi resolvido.
2. **Empilhamos correções sem isolar cada uma.** Nunca testamos setor isolado (sem região).
3. **Nunca validamos a hipótese com um teste simples.** Um `console.assert` teria revelado imediatamente que `normAsciiOnly(norm("S\uFFFDo Paulo"))` ≠ `normAsciiOnly(norm("São Paulo"))`.
4. **Confundimos "a análise faz sentido" com "o código vai funcionar".**

---

### Solução correta

**Caminho A — Corrigir o encoding do CSV na origem (recomendado):**

O CSV é Latin-1, o Vite importa como UTF-8. Converter antes do build:

```js
// scripts/convert-csvs.js
import { readFileSync, writeFileSync } from 'fs';
const buf = readFileSync('knowledge_base/piesp_confirmados_com_valor.csv');
const text = new TextDecoder('latin-1').decode(buf);
writeFileSync('knowledge_base/piesp_confirmados_com_valor.utf8.csv', text, 'utf-8');
```

Adicionar `"prebuild": "node scripts/convert-csvs.js"` ao `package.json`. Mudar os imports para `.utf8.csv`. Com isso, `regiaoMatchPorNome` funciona sem modificações.

**Caminho B — Duplo lookup em `municipioNaRegiao` (hack):**

Adicionar ao set `RMSP` as versões `normAsciiOnly` dos nomes garbled (ex: `"sopaulo"`) e checar ambas no lookup. Menor escopo, mas resolve só o fallback de município, não o match direto por nome de região.

O Caminho A é definitivo. O Caminho B é um paliativo.

**Nota:** quando Nadia ganhar backend (ver `docs/arquitetura-futura.md`), o CSV será lido com encoding correto no servidor — problema desaparece naturalmente.
