# Dados de Empreendedorismo

## Dataset

```text
empresas-sp-mar26-20260522
```

O dataset e servido pelo MCP remoto do Seade. O aplicativo mobile nao empacota a base em arquivos locais.

## Campos Relevantes

| Conceito | Campo |
|---|---|
| Unidade de contagem | `CNPJ` |
| Municipio | `Nome do municipio` |
| Regiao | `Regiao Administrativa` |
| Setor amplo | `Setor de atividade economica` |
| Segmento detalhado | `Atividade economica` |
| Abertura | `Data do inicio de atividade` |
| Fechamento | `Data do fechamento` |
| Empresa ativa | `Situacao cadastral = Ativa` |
| MEI | `Opcao MEI = Sim` |
| Porte | `Porte da empresa` |
| Sexo | `Sexo` |
| Natureza juridica | `Natureza juridica` |

## Regras Analiticas

- Perguntas sobre empresas abertas devem filtrar por `Data do inicio de atividade`.
- Perguntas sobre estoque ou total de empresas devem considerar empresas ativas, salvo se o usuario pedir outro recorte.
- MEI nao e porte; use sempre `Opcao MEI`.
- Inova Simples e natureza juridica: `Empresa Simples de Inovacao`.
- `Nao se aplica` em MEI indica registro fora do universo MEI.
- `Nao se aplica` em sexo nao autoriza inferir socios, controle societario ou genero de empreendedores.
- Analises de sexo/genero devem ser feitas apenas quando o usuario solicitar esse perfil.

## Saida Esperada

Respostas devem mostrar numeros formatados em portugues, explicitar periodo e filtro usado, e evitar indicadores que nao foram pedidos.
