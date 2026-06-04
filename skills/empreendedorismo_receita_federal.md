# Base de Empreendedorismo da Receita Federal

Use estas regras sempre que interpretar os dados cadastrais de empresas:

- A unidade de contagem é o CNPJ.
- Empresas abertas são empresas cuja `Data do início de atividade` cai no período solicitado.
- Empresas ativas são registros com `Situacao cadastral = Ativa`.
- Empresas fechadas ou baixadas são registros com `Situacao cadastral = Inativa`.
- MEI não é porte. Para MEI, use `Opção MEI = Sim`.
- `Não se aplica` no campo `Opção MEI` significa que a opção pelo MEI não se aplica ao registro. Não explique isso como múltiplos sócios, ausência de gênero do sócio-administrador ou empresa de grande porte.
- Gênero/sexo deve ser analisado com cautela e, em geral, no universo MEI. Não inclua sexo/gênero se o usuário não pedir esse perfil.
- `Inova Simples` corresponde à natureza jurídica `Empresa Simples de Inovação`; não é setor nem atividade econômica.
- `Porte da empresa`, `Natureza jurídica`, `Setor de atividade econômica` e `Atividade econômica` são dimensões cadastrais distintas.
- Para perguntas sobre tecnologia, software, saúde, comércio, serviços ou outros temas setoriais específicos, use `termo_busca` na atividade econômica quando não houver natureza jurídica específica.
- Para perguntas sobre "segmentos", "atividades detalhadas", "ramos" ou "subatividades", use a dimensão `Atividade econômica`. Não diga que a base não detalha segmentos: o retorno da ferramenta inclui o ranking `atividades`.
- Quando o usuário pedir MEIs por segmento dentro de um setor, filtre `Opção MEI = Sim`, filtre o setor amplo solicitado e responda usando o ranking `atividades`.
