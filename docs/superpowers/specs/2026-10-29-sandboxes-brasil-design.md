# Sandboxes Brasil — Design

**Data:** 2026-10-29
**Autor:** Júlio Diógenes (com Claude)
**Status:** aguardando revisão

## 1. Contexto e objetivo

O projeto atual (`dnascimentooficial.github.io/sandboxes-municipais-brasil/`) é um `index.html` único, com dados fixos no código, que mapeia 25 sandboxes regulatórios **municipais** (8 ativos, 16 regulamentados, 1 em instituição), com filtros por região e status. A base está parada desde maio de 2026 e os cards são estáticos.

O objetivo é transformá-lo em **Sandboxes Brasil**, um observatório público, dentro de `dnascimento.com.br/sandboxes/`, que:

1. cobre sandboxes **federais, estaduais e municipais**;
2. permite abrir cada sandbox e ver detalhes: foto, descrição, soluções testadas e seu status, editais, documentação, histórico;
3. permite **comparar até 3 sandboxes** lado a lado;
4. é **verificado toda semana** por uma rotina automática, que propõe mudanças por Pull Request para aprovação humana.

**Público:** gestores públicos, empreendedores, pesquisadores e quem acompanha regulação experimental no Brasil.

**Sucesso:** um panorama atual e confiável, com fonte para cada afirmação, que uma pessoa de fora usa sem ajuda, e que se mantém atualizado com um clique de aprovação por semana.

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Esferas | Federal + estadual + municipal |
| Arquitetura | Página única estática + dados em JS + detalhe em gaveta (abordagem B), sem framework |
| Layout | Mesmo padrão e tokens do Radar IA Governos (`dnascimento.com.br/radariagovernos/`), com acento mais suave |
| Atualização | Rotina semanal propõe, Júlio aprova via PR. Nada vai ao ar sem aprovação |
| Robô | Claude Code Routine (nuvem), sem chave de API própria |
| Hospedagem | Hostinger, `public_html/sandboxes`, deploy via Git da Hostinger (webhook) |
| Exportação | Fora do escopo |

## 3. Modelo de dados

A unidade passa a ser o **sandbox** (não o município). Cada sandbox é um arquivo `data/sandboxes/<id>.json`.

### 3.1 Campos

| Campo | Tipo | Obrig. | Observação |
|---|---|---|---|
| `id` | string kebab-case | sim | único; ex. `gramado-turismo` |
| `nome` | string | sim | |
| `esfera` | `municipal` \| `estadual` \| `federal` | sim | |
| `jurisdicao` | objeto | sim | municipal: `{municipio, uf, regiao}`; estadual: `{uf, regiao}`; federal: `{orgao}` (sigla em `data/orgaos.json`) |
| `status` | `ativo` \| `regulamentado` \| `em_instituicao` \| `encerrado` | sim | ver regra 3.2 |
| `temas` | string[] | sim (pode ser vazio) | ids de `data/temas.json`; vazio é exibido como "sem eixo definido" |
| `resumo` | string ≤ 140 caracteres | sim | linha do card |
| `descricao` | string (2–4 parágrafos) | sim | gaveta |
| `desde` | `AAAA` ou `AAAA-MM-DD` | sim | |
| `gestor` | string | não | órgão ou secretaria responsável |
| `ingresso` | `edital` \| `fluxo_continuo` \| `convite` \| `nao_informado` | sim | |
| `prazo_teste_meses` | número \| null | não | null → "não informado" |
| `elegibilidade` | string | não | quem pode participar |
| `flexibilizacoes` | string[] | não | o que pode ser dispensado durante o teste |
| `documentos` | `{tipo, titulo, numero?, data?, url, principal?}`[] | sim (≥1) | `tipo`: lei, decreto, portaria, resolucao, edital, relatorio, outro. Exatamente um `principal: true` |
| `solucoes` | `{nome, proponente?, descricao, status, inicio?, fim?, fonte}`[] | não | `status`: `em_teste` \| `concluida` \| `selecionada` \| `encerrada` |
| `editais` | `{titulo, status, abertura?, encerramento?, url}`[] | não | `status`: `aberto` \| `encerrado` |
| `imagem` | `{arquivo, credito, licenca, origem}` \| null | não | para federais, marca do órgão ou ilustração temática |
| `fontes` | `{url, titulo, acessado_em}`[] | sim (≥1) | |
| `verificado_em` | `AAAA-MM-DD` | sim | |
| `historico` | `{data, descricao, fonte?}`[] | sim (pode ser vazio) | mudanças relevantes, mais recente primeiro |
| `recem_adicionado` | boolean | não | selo "Recém adicionado" |

### 3.2 Regras de consistência (aplicadas pelo validador)

- `ativo` exige pelo menos uma solução `em_teste` ou `concluida` com `fonte`. Isso preserva o critério atual ("execução documentada").
- `regulamentado` exige um documento `principal` do tipo lei, decreto, portaria ou resolucao.
- `em_instituicao` aceita documento principal do tipo `outro` (ex.: projeto de lei, consulta pública).
- `encerrado` exige uma entrada no `historico` com `fonte`.
- `imagem`, quando presente, exige `credito` e `licenca`.
- Todo `id` é único; todo tema e órgão referenciado existe.

### 3.3 Arquivos auxiliares

- `data/temas.json`: `{id, nome, icone, cor}` (lista controlada; ex.: turismo, financas, energia, mobilidade, saude, dados, cidades, ambiente, seguros, telecom, saude-vigilancia, aviacao).
- `data/orgaos.json`: `{sigla, nome, url}` para os federais.
- `data/verificacao.json`: `{ultima_execucao, resultado_por_id: {id: {verificado_em, mudou: bool, avisos: []}}}`.
- `data/sandboxes.js`: **gerado** por `scripts/build-dados.mjs`; expõe `window.SANDBOX_DADOS = {meta, temas, orgaos, sandboxes}`, com `meta.atualizacaoBase` = maior `verificado_em`.

## 4. Interface

Uma única página `index.html` no mesmo padrão do Radar IA Governos: `assets/app.css`, `assets/app.js`, `assets/brasil-mapa.js` e `data/sandboxes.js`, com cache-busting `?v=<build>`.

### 4.1 Identidade

- Tokens do Radar: `--paper #f4f1ec`, `--surface #fffdfa`, `--ink #111112`, `--muted #6e6962`, `--line #e4ded5`, `--radius 22px`, mesmas sombras e easing, fonte Helvetica Neue.
- Acento mais suave que o do Radar: ponto de partida `--accent #3f8f80`, `--accent-soft #eaf4f1` (ajuste final em comparação visual lado a lado).
- Cores de status em tons pastel: ativo = verde-sálvia; regulamentado = azul-acinzentado; em instituição = âmbar claro; encerrado = cinza quente. O status também aparece em texto, nunca só pela cor.

### 4.2 Aba "Panorama" (padrão)

1. Cabeçalho fixo: botão Filtros, marca "Sandboxes Brasil", abas **Panorama | Comparar**, busca global.
2. Hero: rótulo "Observatório de regulação experimental", título, subtítulo, selo "Base verificada em DD/MM/AAAA".
3. Cartão "Conhece um sandbox que não está aqui?" → formulário de indicação (mesmo mecanismo do Radar).
4. Números: total, ativos, regulamentados, em instituição, encerrados, cada um com a divisão por esfera.
5. Barra de status clicável (filtra a lista).
6. Grade de temas com contagem (clicável).
7. Mapa do Brasil por UF (estaduais e municipais) + bloco "Âmbito nacional" com os federais por órgão.
8. Lista de cards. Filtros: esfera, status, região, UF, tema, órgão. Ordenação: nome, status, ano. Contador "mostrando X de Y".
   - Card: jurisdição/órgão, status, selo "Recém adicionado", nome, resumo, temas, nº de soluções testadas, botão "Comparar".

**Busca global:** procura em nome, município, UF, órgão, temas, resumo e **títulos e números de documentos** (ex.: "Decreto 50.697" encontra o Rio de Janeiro).

### 4.3 Gaveta de detalhe

Abre por clique no card e pelo hash `#sandbox=<id>`. Tem navegação ↑/↓ entre os resultados filtrados, "Copiar link", "Comparar" e fecha com Esc.

Conteúdo, nesta ordem:
- foto com legenda (crédito · licença · origem);
- nome, jurisdição, status, desde;
- descrição;
- funcionamento (gestor, ingresso, prazo, elegibilidade, flexibilizações);
- soluções testadas (nome, proponente, status, período, fonte);
- editais;
- documentação publicada;
- linha do tempo (`historico`);
- links de confirmação (`fontes`);
- rodapé "Verificado em … · ID …".

Campos ausentes aparecem como "não informado".

### 4.4 Aba "Comparar"

- Hash `#comparar=<id1>,<id2>,<id3>`, que é compartilhável.
- Três campos de busca com autocomplete (nome, cidade, UF, órgão, tema). O terceiro só aparece após o segundo ("+ adicionar"). Cada coluna tem "×" para remover.
- Botão "Comparar" do card/gaveta leva o sandbox para o primeiro campo livre. Com 3 escolhidos, pede qual substituir.
- Tabela com uma coluna por sandbox, linhas agrupadas:
  - **Identificação:** foto, esfera, jurisdição/órgão, status, desde.
  - **Escopo:** temas (ou "sem eixo definido"), resumo.
  - **Funcionamento:** gestor, ingresso, prazo máximo de teste, elegibilidade, flexibilizações.
  - **Execução:** nº de soluções por status, editais abertos/encerrados.
  - **Documentação publicada:** lista completa com tipo, número, data, link.
  - **Confiabilidade:** verificado em, nº de fontes.
- Linhas com valores iguais em todas as colunas ficam atenuadas; linhas que diferem ficam destacadas.
- Celular: colunas viram cartões com rolagem horizontal e grupos fixos à esquerda.
- Sem exportação.

### 4.5 Acessibilidade e responsividade

Navegação por teclado em cards, gaveta, autocomplete e abas; foco preso na gaveta; `aria-live` no contador de resultados; contraste AA nos selos pastel; layout funcional a partir de 360 px.

## 5. Repositório

O repositório `dnascimentooficial/sandboxes-municipais-brasil` é renomeado para `sandboxes-brasil` (o GitHub redireciona o nome antigo).

```
index.html
assets/app.css · assets/app.js · assets/brasil-mapa.js
data/sandboxes/<id>.json      fonte da verdade
data/temas.json · data/orgaos.json · data/verificacao.json
data/sandboxes.js             gerado
img/<id>.(jpg|webp|svg)
scripts/build-dados.mjs       gera data/sandboxes.js
scripts/validar.mjs           valida esquema e regras 3.2
scripts/testes/               testes do validador e da lógica de filtro/busca/comparação
rotina/INSTRUCOES.md          regras do robô
rotina/consultas.md           buscas de descoberta (editável)
.github/workflows/validar.yml
.htaccess                     bloqueia rotina/, scripts/, docs/, data/sandboxes/
docs/superpowers/specs/
```

`app.js` é dividido em ES modules nativos (`<script type="module">`, sem bundler) por responsabilidade (filtros/busca, panorama, gaveta, comparação, roteamento por hash), sem framework. As funções puras de filtro, busca e comparação ficam separadas do DOM para poderem ser testadas.

O `index.html` antigo da raiz é substituído pelo novo. O arquivo duplicado `sandboxes_municipais_apple.html` é removido.

## 6. Carga inicial de dados

Faz parte deste projeto, antes de ligar a rotina:

1. **Migrar os 25 municipais atuais** para o novo formato, reverificando cada um (status, documentos, fontes). Os 5 registros sem fonte ("Decreto s/n" ou sem link) precisam ganhar fonte ou ser rebaixados ou removidos, com nota no histórico.
2. **Adicionar municipais faltantes**, incluindo **Gramado (sandbox de turismo)**, e o que a pesquisa encontrar desde maio/2026.
3. **Levantar estaduais.**
4. **Levantar federais.** Candidatos a verificar: BCB, CVM, SUSEP, ANEEL, ANPD, ANATEL, ANVISA, ANAC, ANP, ANTT, ANS, além de iniciativas de linhas específicas de outros órgãos. Só entra o que tiver ato normativo ou programa oficial com fonte.
5. Para cada sandbox: preencher funcionamento, documentos, soluções e editais quando houver fonte; buscar imagem no Wikimedia Commons (municípios/estados) ou a marca oficial (órgãos).

A carga inicial é entregue como um PR revisado pelo Júlio, igual aos semanais.

## 7. Rotina semanal

**Agendamento:** Claude Code Routine na nuvem, segunda-feira às 06:00 (America/Sao_Paulo), com acesso de escrita ao repositório.

**Passos:**
1. Para cada sandbox, ler fontes e buscar novidades: mudança de status, documento novo, edital aberto/encerrado, solução selecionada/concluída, relatório de resultados.
2. Descobrir sandboxes novos com as buscas de `rotina/consultas.md` (Diários Oficiais, gov.br, sites de reguladores, TCU coLAB-i, ENAP, imprensa especializada) e as indicações recebidas pelo formulário.
3. Checar links; tentar localizar URL nova antes de dar uma fonte como perdida.
4. Editar JSONs, adicionar `historico`, atualizar `verificado_em` e `data/verificacao.json`, buscar imagem para os novos.
5. Rodar `build-dados.mjs` e `validar.mjs`; só abrir PR se a validação passar.
6. Abrir PR "Atualização semanal — AAAA-MM-DD" com:
   - tabela por mudança: sandbox, campo, antes, depois, fonte, confiança (alta/média/baixa);
   - seção "Para você decidir" com casos ambíguos, que **não** entram nos dados;
   - avisos de link quebrado.

**Regras fixas (`rotina/INSTRUCOES.md`):**
- Status só muda com fonte oficial (Diário Oficial, site do órgão, documento assinado). Imprensa sugere a mudança, mas não justifica.
- O robô nunca apaga um sandbox; propõe `encerrado` com fonte.
- O robô nunca inventa: o que não achar fica ausente ou "não informado".
- O robô não altera `assets/`, `index.html` nem `scripts/`; só `data/` (incluindo `data/verificacao.json` e o `data/sandboxes.js` regenerado) e `img/`.

**Semana sem mudanças:** o PR abre do mesmo jeito, só com `data/verificacao.json` atualizado e o texto "nenhuma mudança encontrada".

**Volume:** a meta é verificar todos os sandboxes toda semana. Se a execução não comportar, ativar rodízio quinzenal da verificação (metade da base por semana); a descoberta continua semanal.

## 8. Validação no PR

`.github/workflows/validar.yml` roda em todo PR para `main`:
- `scripts/validar.mjs`: esquema e regras da seção 3.2. Falha reprova o PR.
- Confere se `data/sandboxes.js` corresponde aos JSONs, regenerando e comparando. Divergência reprova.
- Checagem de links (HEAD/GET com timeout): falha gera **aviso**, não reprovação.
- Testes em `scripts/testes/`.

Sem dependências pesadas: Node 20+, validação escrita à mão ou com uma única biblioteca de JSON Schema.

## 9. Publicação

- Hostinger hPanel → Git: repositório `sandboxes-brasil`, branch `main`, pasta `public_html/sandboxes`, deploy automático por webhook. Nenhuma credencial FTP no GitHub.
- `main` está sempre publicável: nada é gerado no servidor.
- `.htaccess` bloqueia o acesso web a `rotina/`, `scripts/`, `docs/`, `data/sandboxes/` e `.github/`.
- **URL antiga:** o GitHub Pages passa a servir só uma página de redirecionamento (`meta refresh` + `canonical`) para `https://dnascimento.com.br/sandboxes/`. Como Pages e Hostinger leem o mesmo repositório, o redirecionamento fica num branch `gh-pages` dedicado, e o Pages é configurado para usá-lo.
- **Integração com o site:** card em `/projetos/`, entrada no `sitemap.xml`, Open Graph próprio (imagem 1200×630 em `og/`), rodapé com assinatura igual ao Radar. Essas mudanças ficam no repositório ou na pasta do site principal, fora deste repositório.

## 10. Formulário de indicação

Reaproveita o mesmo mecanismo de envio do Radar IA Governos (a ser identificado na implementação lendo o código do Radar). Campos: nome do sandbox, jurisdição/órgão, link da fonte, contato opcional. As indicações recebidas entram na rotina seguinte como candidatas a verificar.

## 11. Testes

- **Validador:** fixtures válidas e inválidas cobrindo cada regra da seção 3.2.
- **Lógica pura:** filtros, busca (incluindo documentos), contagens por status/esfera, montagem da tabela comparativa e detecção de linhas iguais/diferentes.
- **Navegador:** desktop e 375 px; abrir gaveta por clique e por hash; ↑/↓; copiar link; comparar 2 e 3 sandboxes; link `#comparar=` colado em aba nova; teclado e Esc.

## 12. Fora do escopo (v1)

Exportação (CSV/PDF), login, comentários, página dedicada de busca de documentos, publicação automática sem revisão, sandboxes internacionais.

## 13. Riscos

- **Qualidade da pesquisa automática:** mitigada pela revisão humana obrigatória, pelas regras de fonte oficial e pela seção "Para você decidir".
- **Duração da rotina:** mitigada pelo rodízio (seção 7).
- **Imagens sem licença clara:** usar só Wikimedia Commons com licença livre ou marca oficial do órgão; sem imagem válida, usar ilustração temática neutra.
- **Mecanismo do formulário do Radar desconhecido:** se depender de algo específico do Radar (ex.: endpoint PHP dedicado), replicar para `/sandboxes/` ou criar um equivalente mínimo.
