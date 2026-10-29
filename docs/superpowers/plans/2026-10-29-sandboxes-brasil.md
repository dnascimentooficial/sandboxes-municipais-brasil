# Sandboxes Brasil — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o mapa estático de sandboxes municipais num observatório federal/estadual/municipal com gaveta de detalhe, aba Comparar e rotina semanal que propõe atualizações por PR, publicado em `sandboxbrasil.dnascimento.com.br/`.

**Architecture:** Site estático sem framework. Cada sandbox é um JSON em `data/sandboxes/`. Um script Node junta tudo em `data/sandboxes.js` (`window.SANDBOX_DADOS`), lido por uma página única com ES modules nativos. As regras de dados ficam num validador puro, usado pela CI e pela rotina. A lógica de filtro, busca, rotas e comparação é pura (testável em Node), e a UI só renderiza.

**Tech Stack:** HTML/CSS/JS (ES modules, sem bundler), Node ≥ 20 com `node:test` (zero dependências npm), PHP na Hostinger (formulário), GitHub Actions, Claude Code Routine.

**Spec:** `docs/superpowers/specs/2026-10-29-sandboxes-brasil-design.md`

## Global Constraints

- Zero dependências npm em runtime e em testes: só `node:test`, `node:assert/strict`, `node:fs`, `node:crypto`. Node ≥ 20 (`"engines": {"node": ">=20"}`).
- Valores de enum exatamente como na spec: esfera `municipal|estadual|federal`; status `ativo|regulamentado|em_instituicao|encerrado`; ingresso `edital|fluxo_continuo|convite|nao_informado`; tipo de documento `lei|decreto|portaria|resolucao|edital|relatorio|outro`; status de solução `em_teste|concluida|selecionada|encerrada`; status de edital `aberto|encerrado`.
- Regiões: `Norte|Nordeste|Centro-Oeste|Sudeste|Sul`.
- Datas em `AAAA-MM-DD` (ou `AAAA` só em `desde`). Exibição em pt-BR `DD/MM/AAAA`.
- Campo ausente é exibido como **"não informado"**, nunca em branco. Temas vazios são exibidos como **"sem eixo definido"**.
- Todo texto vindo dos dados passa por `escapar()` antes de entrar em HTML (os dados são editados por um robô).
- Tokens visuais: `--paper #f4f1ec`, `--surface #fffdfa`, `--raised #ffffff`, `--ink #111112`, `--ink-2 #2b2925`, `--muted #6e6962`, `--faint #8a8177`, `--line #e4ded5`, `--line-soft #efe9e1`, `--accent #3f8f80`, `--accent-deep #2f6f63`, `--accent-soft #eaf4f1`, `--radius 22px`, `--ease cubic-bezier(.16,1,.3,1)`, fonte `"Helvetica Neue",Helvetica,Arial,sans-serif`. Sombras iguais às do Radar.
- Interface toda em português do Brasil.
- Hashes: `#sandbox=<id>` e `#comparar=<id1>,<id2>,<id3>`; máximo de 3 sandboxes na comparação.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push, renomear o repositório e mexer na Hostinger só com aprovação explícita do Júlio em cada ação.

## Review Focus

1. **Busca sem acento/caixa:** "sao jose", "SÃO JOSÉ" e "Sao Jose" encontram "São José dos Campos". O teste fica na Task 4.
2. **Hash com id desconhecido, repetido ou excesso:** `#sandbox=nao-existe` não abre nada nem quebra; `#comparar=a,a,b,c,d` vira `[a,b,c]`; ids inexistentes são descartados. Testes nas Tasks 5 e 6.
3. **Sandbox com campos opcionais ausentes ou listas vazias:** a gaveta e a comparação mostram "não informado" e "sem eixo definido", sem `undefined` na tela. Testes nas Tasks 5 e 6.
4. **Texto com HTML nos dados:** `<script>` ou `"` num `resumo` aparece literal, sem executar. O teste fica na Task 5 (`escapar`); a regra de uso está nas Tasks 7–10.
5. **Federais com filtro de região/UF:** com região ou UF selecionada, os federais saem da lista (não têm região) sem erro. Com só esfera/status/tema, eles entram normalmente. O teste fica na Task 4.

---

## Estrutura de arquivos

```
package.json                    scripts: test, validar, build, build:check
index.html                      shell da página (abas, seções, gaveta, modal)
assets/app.css                  tokens + componentes
assets/brasil-mapa.js           copiado do Radar (window.BRASIL_MAPA = {w,h,ufs:{UF:{d}}})
assets/js/app.js                bootstrap: lê dados, liga rotas e UIs
assets/js/esquema.js            enums, UF→região, rótulos (compartilhado browser/Node)
assets/js/validacao.js          validarBase() — puro
assets/js/filtros.js            normalizar, buscar, filtrar, ordenar, contar — puro
assets/js/rotas.js              lerHash, escreverHash — puro
assets/js/formatar.js           escapar, data, rótulos, naoInformado — puro
assets/js/comparar.js           adicionarAoComparar, montarComparacao — puro
assets/js/ui/panorama.js        hero, números, barra de status, temas, mapa, lista, filtros
assets/js/ui/gaveta.js          gaveta de detalhe
assets/js/ui/comparar.js        aba Comparar
assets/js/ui/indicar.js         modal "Indicar um sandbox"
api/indicar.php                 recebe indicações (protocolo do Radar)
data/sandboxes/<id>.json        fonte da verdade
data/temas.json · data/orgaos.json · data/verificacao.json
data/sandboxes.js               gerado
img/<id>.(jpg|webp|svg)
scripts/validar.mjs             CLI do validador
scripts/build-dados.mjs         gera data/sandboxes.js e carimba ?v= no index.html
scripts/checar-links.mjs        avisos de link quebrado
scripts/testes/*.test.mjs       testes node:test
scripts/testes/fixtures/        bases válidas e inválidas
rotina/INSTRUCOES.md · rotina/consultas.md
.github/workflows/validar.yml
.htaccess
```

O validador e os módulos puros ficam em `assets/js/` para que o navegador e o Node importem o mesmo arquivo. Isso refina a árvore da spec (§5), que mostrava um único `app.js`.

---

### Task 1: Esquema e validador

**Files:**
- Create: `package.json`, `assets/js/esquema.js`, `assets/js/validacao.js`, `scripts/validar.mjs`
- Create: `scripts/testes/validacao.test.mjs`, `scripts/testes/fixtures/valido/` (base mínima: `temas.json`, `orgaos.json`, `sandboxes/{municipal-ok,federal-ok}.json`)
- Delete: `sandboxes_municipais_apple.html` (idêntico ao `index.html`)

**Interfaces:**
- Produces:
  - `esquema.js`: `ESFERAS`, `STATUS`, `INGRESSO`, `TIPOS_DOC`, `STATUS_SOLUCAO`, `STATUS_EDITAL`, `REGIOES` (arrays de string); `UF_REGIAO` (objeto com as 27 UFs → região); `ROTULOS` (`{status:{ativo:'Ativo',regulamentado:'Regulamentado',em_instituicao:'Em instituição',encerrado:'Encerrado'}, esfera:{…}, ingresso:{edital:'Edital',fluxo_continuo:'Fluxo contínuo',convite:'Convite',nao_informado:'não informado'}, tipoDoc:{…}, statusSolucao:{em_teste:'Em teste',concluida:'Concluída',selecionada:'Selecionada',encerrada:'Encerrada'}}`).
  - `validacao.js`: `validarBase({temas, orgaos, sandboxes}) -> {erros: string[]}`. Cada erro começa com `"<id>: "` (ou `"base: "`).
  - `scripts/validar.mjs [dir=data]`: carrega a base de `dir` via `carregarBase` (Task 2; nesta task, uma leitura local equivalente), imprime os erros e sai com código 1 se houver algum.
  - `package.json`: `"type":"module"`, scripts `test` = `node --test scripts/testes/`, `validar` = `node scripts/validar.mjs data`.

- [ ] **Step 1: Escrever os testes do validador.** `validacao.test.mjs` carrega a fixture válida e, para cada caso, clona e quebra um campo:
  - fixture válida → `erros` vazio;
  - `id` repetido → erro contendo `"id duplicado"`;
  - `status:'pausado'` → `"status inválido"`;
  - `esfera:'municipal'` sem `jurisdicao.uf` → `"jurisdicao.uf"`; `uf:'XX'` → `"UF inválida"`; `regiao` diferente de `UF_REGIAO[uf]` → `"região não confere"`;
  - federal com `jurisdicao.orgao` fora de `orgaos.json` → `"órgão desconhecido"`;
  - tema inexistente → `"tema desconhecido"`;
  - `resumo` com 141 caracteres → `"resumo"`;
  - `fontes: []` → `"ao menos uma fonte"`; `documentos: []` → `"ao menos um documento"`;
  - zero ou dois documentos com `principal:true` → `"exatamente um documento principal"`;
  - `ativo` sem solução `em_teste|concluida` com `fonte` → `"ativo exige solução documentada"`;
  - `regulamentado` com principal `tipo:'outro'` → `"regulamentado exige ato normativo"`;
  - `em_instituicao` com principal `tipo:'outro'` → sem erro;
  - `encerrado` sem `historico` com `fonte` → `"encerrado exige histórico com fonte"`;
  - `imagem` sem `licenca` → `"imagem.licenca"`;
  - `verificado_em:'29/10/2026'` → `"data inválida"`; `desde:'2024'` → aceito.
- [ ] **Step 2:** `npm test` → FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar `esquema.js` e `validacao.js`** cobrindo a tabela §3.1 e as regras §3.2 da spec. Campos obrigatórios conforme a coluna "Obrig." da spec. Sem biblioteca de schema: checagens diretas por campo.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: esquema e validador de sandboxes`.

### Task 2: Build dos dados e carimbo de versão

**Files:**
- Create: `scripts/build-dados.mjs`, `scripts/testes/build.test.mjs`
- Modify: `package.json` (scripts `build` = `node scripts/build-dados.mjs`, `build:check` = `node scripts/build-dados.mjs --check`)

**Interfaces:**
- Consumes: `validarBase` (Task 1).
- Produces (exportados por `build-dados.mjs`):
  - `carregarBase(dir: string) -> {temas, orgaos, sandboxes}`, com sandboxes ordenados por `id`.
  - `gerarJs(base) -> string`: `"/* Gerado por scripts/build-dados.mjs — não editar. */\nwindow.SANDBOX_DADOS = " + JSON.stringify({meta, temas, orgaos, sandboxes}) + ";\n"`, com `meta = {titulo:'Sandboxes regulatórios no Brasil', atualizacaoBase: <maior verificado_em>, total: n}`. **Sem timestamp**, para ser determinístico.
  - `versao(conteudo: string) -> string`: primeiros 10 caracteres hex do sha256.
  - `carimbarIndex(html: string, versoes: {[caminho]: string}) -> string`: substitui `?v=…` nos `src`/`href` de `assets/app.css`, `assets/brasil-mapa.js`, `assets/js/app.js` e `data/sandboxes.js`.
  - CLI: valida (aborta se houver erros), escreve `data/sandboxes.js` e carimba `index.html`. Com `--check`, não escreve nada; sai com 1 e a mensagem `"data/sandboxes.js desatualizado — rode npm run build"` se o resultado diferir do que está no disco.

- [ ] **Step 1: Testes:** `gerarJs` da fixture válida, rodado duas vezes, gera strings idênticas; `meta.atualizacaoBase` é o maior `verificado_em`; `carimbarIndex('<script src="data/sandboxes.js?v=old">', {'data/sandboxes.js':'abc'})` contém `?v=abc`; `--check` numa cópia temporária com `sandboxes.js` alterado sai com 1.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar.** `scripts/validar.mjs` passa a usar `carregarBase`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat: build determinístico de data/sandboxes.js`.

### Task 3: Migração dos 25 municipais atuais

**Files:**
- Create: `data/temas.json`, `data/orgaos.json` (pode começar vazio `[]`), `data/verificacao.json`, `data/sandboxes/<id>.json` × 25, `img/<id>.*`, `data/sandboxes.js` (gerado)

**Interfaces:**
- Consumes: esquema (Task 1), build (Task 2).
- Produces: base real válida. Ids no formato `<municipio-slug>` (ex.: `curitiba`, `rio-de-janeiro`), com sufixo temático só quando houver dois sandboxes no mesmo município (ex.: `gramado-turismo`).

- [ ] **Step 1: Extrair** o array `DB` de `index.html` (linhas ~602–628: `{cidade, uf, reg, eixo, inst, st:'A'|'R'|'I', ano, novo, link}`) para uma planilha de trabalho em `$TMPDIR`. Mapeamento: `st` A→`ativo`, R→`regulamentado`, I→`em_instituicao`; `novo`→`recem_adicionado`; `link`→`fontes[0]`; `inst`→`documentos[0]` com `principal:true`; `eixo`→ `temas` (mapear para ids de `temas.json`) e base do `resumo`.
- [ ] **Step 2: `data/temas.json`** com pelo menos: `turismo, financas, energia, mobilidade, logistica, saude, dados, cidades, ambiente, seguros, telecom, aviacao, startups, gestao-publica, educacao`, cada um com `{id, nome, icone, cor}` em tons pastel.
- [ ] **Step 3: Reverificar cada município na web** (fonte oficial primeiro): status atual, número e data do ato, gestor, ingresso, prazo, elegibilidade, flexibilizações, soluções testadas com fonte, editais e descrição de 2 a 4 parágrafos. `ativo` só se houver solução documentada (regra §3.2). Os 5 sem fonte (Distrito Federal, Francisco Morato, Londrina, Macapá, Petrolina) ganham fonte oficial, ou mudam de status com nota no `historico`, ou são removidos, e a decisão vai na mensagem do commit.
- [ ] **Step 4: Imagens:** buscar uma foto por município no Wikimedia Commons com licença livre (CC BY, CC BY-SA, CC0 ou domínio público), reduzir para no máximo 1200 px de largura em `img/<id>.jpg` e preencher `imagem.{arquivo, credito, licenca, origem}`. Sem foto válida → `imagem: null`.
- [ ] **Step 5:** `npm run validar && npm run build` → sem erros; `data/sandboxes.js` gerado com `total: 25` (ou menos, se houve remoção justificada).
- [ ] **Step 6: Commit** `data: migra municipais para o novo formato e reverifica fontes`, listando no corpo as mudanças de status e as remoções.

### Task 4: Filtros, busca, ordenação e contagens

**Files:**
- Create: `assets/js/filtros.js`, `scripts/testes/filtros.test.mjs`

**Interfaces:**
- Consumes: `esquema.js`.
- Produces:
  - `normalizar(s: string) -> string`: minúsculas, sem acentos (NFD + remoção de diacríticos), espaços colapsados.
  - `buscar(sandboxes, termo: string) -> Sandbox[]`: todos os tokens do termo precisam aparecer no texto indexado (nome, município, UF, órgão, nomes dos temas, resumo, `titulo` e `numero` de cada documento). Termo vazio → lista inteira.
  - `filtrar(sandboxes, f: {esfera?, status?, regiao?, uf?, tema?, orgao?, termo?}, temas) -> Sandbox[]`: campos ausentes ou `''` não filtram. Com `regiao` ou `uf`, federais são excluídos.
  - `ordenar(lista, chave: 'nome'|'status'|'ano') -> Sandbox[]`: `nome` usa `localeCompare('pt-BR')`; `status` segue a ordem `ativo, regulamentado, em_instituicao, encerrado`, com desempate por nome; `ano` é decrescente por `desde`.
  - `contar(sandboxes) -> {total, porStatus:{[status]:n}, porEsfera:{[esfera]:n}, porStatusEsfera:{[status]:{[esfera]:n}}, porTema:{[tema]:n}, porUf:{[uf]:n}}`, com todos os enums presentes (zeros incluídos).
- [ ] **Step 1: Testes** (fixture inline com 5 sandboxes: 2 municipais SP/RS, 1 estadual PR, 2 federais):
  - `buscar(l,'sao jose')`, `buscar(l,'SÃO JOSÉ')` e `buscar(l,'Sao  Jose')` retornam o de "São José dos Campos";
  - `buscar(l,'50.697')` retorna o que tem o documento `numero:'50.697/2022'`;
  - `buscar(l,'bcb')` retorna o federal do BCB;
  - `filtrar(l,{regiao:'Sul'})` devolve só RS e PR, sem nenhum federal; `filtrar(l,{esfera:'federal'})` devolve 2;
  - `filtrar(l,{tema:'turismo', status:'ativo'})` faz a interseção;
  - `ordenar(l,'status')[0].status === 'ativo'`;
  - `contar(l).porStatusEsfera.encerrado.federal === 0` (chave presente).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: filtros, busca e contagens`.

### Task 5: Formatação, escape e rotas

**Files:**
- Create: `assets/js/formatar.js`, `assets/js/rotas.js`, `scripts/testes/formatar.test.mjs`, `scripts/testes/rotas.test.mjs`

**Interfaces:**
- Produces:
  - `escapar(v: any) -> string`: troca `& < > " '` por entidades; `null`/`undefined` viram `''`.
  - `valorOuNaoInformado(v) -> string`: `null`, `undefined`, `''` e `[]` viram `'não informado'`; arrays viram itens unidos por `' · '`. O resultado já sai escapado.
  - `dataBR(iso: string) -> string`: `'2026-10-29'` vira `'29/10/2026'`; `'2024'` continua `'2024'`; valor inválido vira `'não informado'`.
  - `rotulo(tipo: keyof ROTULOS, valor) -> string`.
  - `temasTexto(ids: string[], temas) -> string`: lista vazia vira `'sem eixo definido'`.
  - `lerHash(hash: string, idsValidos: Set<string>) -> {aba:'panorama'|'comparar', sandbox: string|null, comparar: string[]}`: descarta ids inválidos, remove duplicatas preservando a ordem e trunca em 3. `#comparar=` sem ids continua sendo `aba:'comparar'`.
  - `escreverHash(estado) -> string`: `{aba:'comparar', comparar:['a','b']}` vira `'#comparar=a,b'`; `{aba:'panorama', sandbox:'x'}` vira `'#sandbox=x'`; panorama sem sandbox vira `''`.
- [ ] **Step 1: Testes:**
  - `escapar('<script>alert("x")</script>')` não contém `<` nem `"`;
  - `valorOuNaoInformado([])` e `valorOuNaoInformado(undefined)` dão `'não informado'`;
  - `temasTexto([], temas)` dá `'sem eixo definido'`;
  - `dataBR('2026-10-29')` dá `'29/10/2026'`;
  - `lerHash('#sandbox=nao-existe', ids).sandbox === null`;
  - `lerHash('#comparar=a,a,b,zzz,c,d', ids{a,b,c,d}).comparar` deep-equals `['a','b','c']`;
  - ida e volta: `lerHash(escreverHash(e), ids)` equivale a `e`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: formatação segura e rotas por hash`.

### Task 6: Lógica da comparação

**Files:**
- Create: `assets/js/comparar.js`, `scripts/testes/comparar.test.mjs`

**Interfaces:**
- Consumes: `formatar.js`, `esquema.js`.
- Produces:
  - `adicionarAoComparar(ids: string[], id: string, max = 3) -> {ids: string[], precisaSubstituir: boolean}`: se o id já estiver na lista, nada muda; com a lista cheia, devolve `precisaSubstituir:true` e os mesmos ids.
  - `substituirNoComparar(ids, indice: number, id) -> string[]`; `removerDoComparar(ids, id) -> string[]`.
  - `montarComparacao(sandboxes: Sandbox[], {temas, orgaos}) -> {grupos: {titulo: string, linhas: {chave: string, rotulo: string, valores: string[], iguais: boolean}[]}[]}`. `valores` são strings **texto puro** (a UI escapa). Grupos e linhas, nesta ordem:
    - **Identificação:** esfera, jurisdição/órgão, status, desde;
    - **Escopo:** temas, resumo;
    - **Funcionamento:** gestor, ingresso, prazo máximo de teste (`"N meses"` ou `'não informado'`), elegibilidade, flexibilizações;
    - **Execução:** soluções por status (`"2 em teste · 1 concluída"` ou `'nenhuma documentada'`), editais (`"1 aberto · 2 encerrados"` ou `'nenhum'`);
    - **Documentação publicada:** uma linha `documentos` cujos valores são JSON das listas `{tipo, titulo, numero, data, url}` (a UI renderiza a lista);
    - **Confiabilidade:** verificado em, nº de fontes.
  - `iguais` é true só com 2 ou mais colunas e todos os valores idênticos.
- [ ] **Step 1: Testes:**
  - `adicionarAoComparar(['a','b','c'],'d')` dá `precisaSubstituir:true`; `adicionarAoComparar(['a'],'a').ids` dá `['a']`;
  - `montarComparacao` com dois sandboxes de mesmo `status` e `ingresso` diferente: a linha status tem `iguais:true` e a linha ingresso tem `iguais:false`;
  - sandbox sem `gestor`, `prazo_teste_meses` e `temas` dá `'não informado'`, `'não informado'` e `'sem eixo definido'`;
  - nenhum valor contém `'undefined'`;
  - uma única coluna dá todas as linhas com `iguais:false`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: montagem da tabela comparativa`.

### Task 7: Shell da página, estilos e aba Panorama

**Files:**
- Replace: `index.html`
- Create: `assets/app.css`, `assets/brasil-mapa.js` (cópia de `https://dnascimento.com.br/radariagovernos/assets/brasil-mapa.js`, que é do próprio Júlio), `assets/js/app.js`, `assets/js/ui/panorama.js`

**Interfaces:**
- Consumes: `window.SANDBOX_DADOS`, `window.BRASIL_MAPA`, Tasks 4–5.
- Produces:
  - `app.js` mantém um estado único `{filtros, termo, ordem, hash}` e expõe a funções de UI `estado()`, `atualizar(parcial)` e `irPara(hashEstado)`. Escuta `hashchange`.
  - `panorama.js`: `montarPanorama(raiz: HTMLElement, ctx) -> {render(estado)}`.

Referência visual: abrir `https://dnascimento.com.br/radariagovernos/` e reproduzir a mesma hierarquia (cabeçalho fixo com Filtros, marca, busca e anel; hero; cartão verde de indicação; cartões de números; barra de maturidade; grade de eixos; mapa; lista). Usar os tokens das Global Constraints.

- [ ] **Step 1:** `index.html` com `<title>Sandboxes Brasil — Regulação experimental no Brasil</title>`, Open Graph (`og:url https://sandboxbrasil.dnascimento.com.br/`, imagem `og/sandboxes.jpg`), abas `Panorama | Comparar` (`role="tablist"`), contêineres vazios para cada seção, a gaveta (`<aside id="gaveta" hidden>`) e o modal de indicação. Scripts: `assets/brasil-mapa.js?v=`, `data/sandboxes.js?v=`, `<script type="module" src="assets/js/app.js?v=">`. Rodar `npm run build` para carimbar.
- [ ] **Step 2:** `assets/app.css` com os tokens, os componentes (cartão, selo de status pastel com texto, chip de tema, barra, grade, gaveta lateral de 560 px que vira tela cheia abaixo de 768 px, modal) e o layout responsivo a partir de 360 px.
- [ ] **Step 3:** `panorama.js` renderiza:
  - hero com "Base verificada em `dataBR(meta.atualizacaoBase)`";
  - números de `contar()`: total, ativos, regulamentados, em instituição e encerrados, cada um com a linha "F · E · M" por esfera;
  - barra de status clicável (`atualizar({filtros:{status}})`);
  - grade de temas com contagem;
  - mapa com UFs coloridas por `porUf` e bloco "Âmbito nacional" agrupando os federais por órgão;
  - filtros de esfera, status, região, UF, tema, órgão e ordenação;
  - contador `aria-live="polite"` "mostrando X de Y";
  - cards com jurisdição/órgão, selo de status, selo "Recém adicionado", nome, resumo, temas, "N soluções testadas" e botões "Ver detalhes" e "Comparar".
  Todo texto de dado passa por `escapar`.
- [ ] **Step 4: Verificar no navegador:** servir com `python3 -m http.server 8080` (ou `npx serve`) via `preview_start` e abrir em desktop e a 375 px. Esperado: números batem com `contar()`; filtro de região "Sul" esconde os federais; busca "sao jose" encontra; nenhum erro no console.
- [ ] **Step 5: Commit** `feat: página Panorama no layout do Radar`.

### Task 8: Gaveta de detalhe

**Files:**
- Create: `assets/js/ui/gaveta.js`
- Modify: `assets/js/app.js` (liga `#sandbox=`)

**Interfaces:**
- Consumes: Tasks 5 e 7; `adicionarAoComparar` (Task 6).
- Produces: `montarGaveta(el, ctx) -> {abrir(id), fechar()}`. ↑/↓ navegam na lista **filtrada atual**, "Copiar link" usa `navigator.clipboard.writeText(location.href)` com fallback de seleção, e "Comparar" chama `irPara({aba:'comparar', comparar: novosIds})`.

- [ ] **Step 1:** Renderizar, nesta ordem (spec §4.3): foto com legenda "crédito · licença · origem" (sem imagem: faixa com a cor do primeiro tema), nome, jurisdição, status, desde, descrição, Funcionamento, Soluções testadas (status com rótulo), Editais, Documentação publicada, Linha do tempo (`historico`), Links de confirmação e rodapé "Verificado em … · ID …". Campos ausentes passam por `valorOuNaoInformado`.
- [ ] **Step 2:** Acessibilidade: `role="dialog" aria-modal="true"`, foco vai para o título ao abrir, foco preso dentro da gaveta, Esc fecha e devolve o foco ao card de origem.
- [ ] **Step 3: Verificar no navegador:** o clique no card abre e atualiza o hash; colar `#sandbox=curitiba` numa aba nova abre direto; `#sandbox=nao-existe` mostra o Panorama sem erro; ↑/↓ e Esc funcionam; um sandbox sem soluções mostra "nenhuma documentada"; a 375 px a gaveta ocupa a tela.
- [ ] **Step 4: Commit** `feat: gaveta de detalhe com link próprio`.

### Task 9: Aba Comparar

**Files:**
- Create: `assets/js/ui/comparar.js`
- Modify: `assets/js/app.js`

**Interfaces:**
- Consumes: `montarComparacao`, `adicionarAoComparar`, `substituirNoComparar`, `removerDoComparar` (Task 6); `buscar` (Task 4); rotas (Task 5).
- Produces: `montarComparar(el, ctx) -> {render(ids: string[])}`.

- [ ] **Step 1: Seleção.** Campos "Sandbox 1" e "Sandbox 2", e "+ adicionar" que revela o terceiro só depois do segundo. Autocomplete com `buscar()`, 8 sugestões no máximo, no padrão ARIA combobox (setas, Enter, Esc). Os já escolhidos não aparecem nas sugestões. "×" remove a coluna. Toda mudança passa por `irPara({aba:'comparar', comparar})`.
- [ ] **Step 2: Substituição.** Se o "Comparar" do card ou da gaveta chegar com 3 já escolhidos, mostrar o aviso "Escolha qual substituir" com os 3 nomes como botões.
- [ ] **Step 3: Tabela.** Uma coluna por sandbox, cabeçalho com foto, nome e selo, e grupos de `montarComparacao`. Linhas `iguais:true` ganham a classe `.linha-igual` (texto `--faint`); as diferentes ganham `.linha-difere` (fundo `--accent-soft`). A linha de documentos vira uma lista de links "tipo nº — título (data)". Estado vazio: "Escolha até 3 sandboxes para comparar lado a lado." Abaixo de 768 px: rolagem horizontal com a coluna de rótulos fixa (`position: sticky`).
- [ ] **Step 4: Verificar no navegador:**
  - `#comparar=curitiba,rio-de-janeiro` monta 2 colunas;
  - adicionar um terceiro pelo campo funciona;
  - "Comparar" num 4º pede substituição;
  - `#comparar=curitiba,curitiba,xyz` mostra só Curitiba;
  - linhas iguais ficam atenuadas;
  - a 375 px rola na horizontal com rótulos fixos.
- [ ] **Step 5: Commit** `feat: aba Comparar com até 3 sandboxes`.

### Task 10: Indicar um sandbox

**Files:**
- Create: `assets/js/ui/indicar.js`, `api/indicar.php`, `api/.htaccess`
- Create: `rotina/indicacoes.md` (vazio, com cabeçalho explicativo)

**Interfaces:**
- Protocolo igual ao do Radar (`radariagovernos/assets/app.js`, linhas ~825–1050):
  - `GET api/indicar.php?token=1` → `{token}`;
  - `POST api/indicar.php` com JSON `{token, nome_sandbox, jurisdicao, fonte_url, observacao?, contato_nome?, contato_email?, consentimento:true, site:''}` (`site` é honeypot) → `{ok:true}` ou `{ok:false, motivo:'limite'|'token'|'invalido'|'indisponivel'}`.

- [ ] **Step 1: `indicar.js`.** Modal acessível com os campos acima, textos de erro por `motivo` (copiar os do Radar trocando "experiência" por "sandbox") e mensagem de sucesso "Indicação enviada! Ela será verificada antes de entrar na base."
- [ ] **Step 2: `api/indicar.php`.**
  - Token de sessão PHP de uso único, válido por 30 min.
  - Limite de 5 envios por IP por hora, guardado em arquivo fora de `public_html` (caminho definido em `api/config.php`, que não é versionado: `config.example.php` vai no repo).
  - Valida `fonte_url` com `FILTER_VALIDATE_URL`.
  - Envia e-mail para `contato@dnascimento.com.br` com todos os campos.
  - Grava uma linha JSON **sem os dados de contato** (`data, nome_sandbox, jurisdicao, fonte_url, observacao`) em arquivo fora do `public_html`.
  - `api/.htaccess` libera só `indicar.php`.
- [ ] **Step 3: Repasse para a rotina.** Os dados de contato nunca vão para o repositório, que é público. Na revisão semanal, o Júlio copia as indicações que quiser verificar para `rotina/indicacoes.md` (uma por linha: nome, jurisdição, link). A rotina lê esse arquivo (Task 12) e o PR remove as linhas já tratadas.
- [ ] **Step 4: Verificar.** `php -l api/indicar.php` sem erros. No navegador, contra um servidor PHP local (`php -S localhost:8080`): obter o token, enviar e ver sucesso; reenviar o mesmo token → erro `token`; preencher o honeypot → `{ok:true}` sem e-mail.
- [ ] **Step 5: Commit** `feat: formulário de indicação`.

### Task 11: CI, checagem de links e .htaccess

**Files:**
- Create: `.github/workflows/validar.yml`, `scripts/checar-links.mjs`, `scripts/testes/links.test.mjs`, `.htaccess`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `checarLinks(urls: string[], {timeoutMs=10000, fetchFn=fetch}) -> Promise<{url, ok, status}[]>`: HEAD e, se vier 405/403, GET. Até 8 em paralelo.
  - CLI que imprime `::warning::` (formato do GitHub Actions) por link com falha e **sempre sai com 0**.

- [ ] **Step 1: Teste** com `fetchFn` falso: um 200, um 404 e um timeout dão `ok` true, false e false; o 405 no HEAD faz um GET.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: `validar.yml`.** Roda em `pull_request` para `main` e em `push` para `main`. Passos: `actions/checkout@v4`, `actions/setup-node@v4` com `node-version: 20`, `npm test`, `npm run validar`, `npm run build:check` e `node scripts/checar-links.mjs` (com `continue-on-error: true`).
- [ ] **Step 4: `.htaccess` na raiz.**
  - Nega acesso web a `rotina/`, `scripts/`, `docs/`, `.github/`, `data/sandboxes/`, `package.json` e `*.md`.
  - Mantém `data/sandboxes.js`, `data/temas.json`, `assets/`, `img/` e `api/indicar.php` acessíveis.
  - Define `Cache-Control: max-age=31536000, immutable` para `assets/` e `img/`, e `no-cache` para `index.html`.
- [ ] **Step 5: Verificar.** Rodar os comandos da CI localmente, todos verdes. Abrir um PR de teste com um JSON quebrado só depois da Task 15, quando o repositório já estiver no GitHub com a CI ativa.
- [ ] **Step 6: Commit** `ci: validação, build check e avisos de links`.

### Task 12: Instruções da rotina

**Files:**
- Create: `rotina/INSTRUCOES.md`, `rotina/consultas.md`

- [ ] **Step 1: `INSTRUCOES.md`** com os passos 1–6 e as regras fixas da spec §7, literalmente. Inclui também:
  - comandos obrigatórios antes do PR: `npm test && npm run validar && npm run build && npm run build:check`;
  - branch `rotina/AAAA-MM-DD` e título do PR "Atualização semanal — AAAA-MM-DD";
  - modelo do corpo do PR: a tabela `| Sandbox | Campo | Antes | Depois | Fonte | Confiança |` e as seções "Novos sandboxes", "Para você decidir", "Links quebrados", "Indicações tratadas";
  - limite de escrita: só `data/`, `img/` e `rotina/indicacoes.md`;
  - semana sem mudanças: só `data/verificacao.json`, com o texto "Nenhuma mudança encontrada.";
  - rodízio: se a execução não comportar a base inteira, verificar os ids de posição par nas semanas ISO pares e os de posição ímpar nas ímpares, registrando isso em `verificacao.json`.
- [ ] **Step 2: `consultas.md`.** Buscas de descoberta separadas por esfera: termos ("sandbox regulatório", "ambiente regulatório experimental", "LC 182/2021 art. 11"), fontes (DOU, diários oficiais estaduais e municipais, gov.br, sites dos reguladores, TCU coLAB-i, ENAP, imprensa especializada) e a lista de órgãos federais candidatos da spec §6.4.
- [ ] **Step 3: Teste a seco.** Seguir `INSTRUCOES.md` manualmente para 2 sandboxes (um ativo e um federal), sem abrir PR, e ajustar o texto onde a instrução tiver ficado ambígua.
- [ ] **Step 4: Commit** `docs: instruções e consultas da rotina semanal`.

### Task 13: Carga inicial — municipais novos (incl. Gramado) e estaduais

**Files:**
- Create: `data/sandboxes/<id>.json`, `img/<id>.*`; regenerar `data/sandboxes.js`

- [ ] **Step 1:** Seguir `rotina/consultas.md` para municipais e estaduais criados ou alterados desde maio/2026. **Gramado (sandbox de turismo) é obrigatório**: id `gramado-turismo`, tema `turismo`, com soluções testadas e o status de cada uma, todas com fonte.
- [ ] **Step 2:** Cada novo entra com `recem_adicionado: true`, `historico` ("incluído na base") e imagem conforme a Task 3, Step 4.
- [ ] **Step 3:** `npm run validar && npm run build` verdes.
- [ ] **Step 4: Commit** `data: novos municipais e sandboxes estaduais`, listando os incluídos e as fontes principais.

### Task 14: Carga inicial — federais

**Files:**
- Modify: `data/orgaos.json`
- Create: `data/sandboxes/<id>.json`, `img/<id>.*`

- [ ] **Step 1:** Para cada órgão candidato (BCB, CVM, SUSEP, ANEEL, ANPD, ANATEL, ANVISA, ANAC, ANP, ANTT, ANS, além de programas de linhas específicas encontrados), verificar se existe ato normativo ou programa oficial. Só entra o que tiver fonte. Ids `<sigla>-<programa>` (ex.: `cvm-sandbox`), e um arquivo por ciclo/programa quando forem regimes distintos.
- [ ] **Step 2:** `orgaos.json` com `{sigla, nome, url}` para cada órgão usado. Imagem = marca oficial do órgão (`img/<sigla>.svg`), com `licenca: 'marca oficial — uso informativo'`, ou `null`.
- [ ] **Step 3:** Preencher com prioridade os campos de comparação (gestor, ingresso, prazo, elegibilidade, flexibilizações, documentos), que são os mais úteis para o gestor público.
- [ ] **Step 4:** `npm run validar && npm run build` verdes; conferir no navegador o bloco "Âmbito nacional" e uma comparação municipal × federal.
- [ ] **Step 5: Commit** `data: sandboxes federais`.

### Task 15: Publicação e rotina agendada

Esta task tem ações externas. **Cada passo marcado (⚠) só acontece com aprovação explícita do Júlio naquele momento.**

- [ ] **Step 1: Revisão final.** Rodar `superpowers:requesting-code-review` na branch inteira e corrigir o que for apontado.
- [ ] **Step 2 (⚠):** Push da branch `redesign-sandboxes-brasil` e abertura do PR da carga inicial para `main`. O Júlio revisa os dados como revisará os semanais. A CI precisa passar. Depois do merge, abrir um PR de teste com JSON inválido para confirmar que a CI reprova, e fechá-lo.
- [ ] **Step 3 (⚠):** Renomear o repositório para `sandboxes-brasil` (`gh repo rename sandboxes-brasil`) e atualizar o `origin` local.
- [ ] **Step 4 (⚠):** Hostinger hPanel: criar o subdomínio `sandboxbrasil` (`sandboxbrasil.dnascimento.com.br`); em Git, repositório `https://github.com/dnascimentooficial/sandboxes-brasil`, branch `main`, diretório = pasta raiz do subdomínio (definida na criação), auto-deploy ligado (webhook no GitHub). Criar o `api/config.php` no servidor a partir do `config.example.php`. Este passo é feito pelo Júlio no painel, ou via ferramentas Hostinger, com aprovação.
- [ ] **Step 5: Verificar em produção.**
  - `https://sandboxbrasil.dnascimento.com.br/` carrega e os `?v=` batem com a `main`;
  - `https://sandboxbrasil.dnascimento.com.br/rotina/INSTRUCOES.md` e `https://sandboxbrasil.dnascimento.com.br/data/sandboxes/curitiba.json` dão 403;
  - `/robots.txt` e `/sitemap.xml` do subdomínio respondem 200;
  - `#sandbox=` e `#comparar=` funcionam;
  - uma indicação de teste chega por e-mail.
- [ ] **Step 6 (⚠):** Redirecionamento da URL antiga. Criar o branch órfão `gh-pages` contendo só um `index.html` com `<meta http-equiv="refresh" content="0; url=https://sandboxbrasil.dnascimento.com.br/">`, `<link rel="canonical" href="https://sandboxbrasil.dnascimento.com.br/">` e um link visível, e configurar o Pages para servir esse branch. Verificar que `dnascimentooficial.github.io/sandboxes-municipais-brasil/` (e o novo nome) redireciona.
- [ ] **Step 7 (⚠):** Site principal (fora deste repo): card em `/projetos/` do site principal apontando para `https://sandboxbrasil.dnascimento.com.br/` (o `sitemap.xml` e o `robots.txt` do subdomínio vivem neste repositório); imagem `og/sandboxes.jpg` 1200×630 neste repositório.
- [ ] **Step 8 (⚠):** Criar a Claude Code Routine com a skill `schedule`: toda segunda às 06:00 America/Sao_Paulo, no repositório `sandboxes-brasil`, com o prompt "Siga rotina/INSTRUCOES.md". Disparar uma execução manual e conferir o PR gerado (tabela, fontes, CI verde).
- [ ] **Step 9:** Atualizar o `README.md` do repositório: o que é, como rodar localmente (`npm test`, `npm run build`, servidor estático), como funciona a rotina e como aprovar o PR semanal.
- [ ] **Step 10: Commit** `docs: README` (por PR, como qualquer mudança na `main`).
