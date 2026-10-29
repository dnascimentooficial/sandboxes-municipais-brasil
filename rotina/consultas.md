# Consultas de descoberta

Lista de buscas da rotina semanal (passo 3 de `rotina/INSTRUCOES.md`). O Júlio pode editar este arquivo; a rotina não pode.

## Como usar

1. **Núcleo:** roda toda semana.
2. **Bloco rotativo:** roda um por semana, pelo resto da divisão por 4 da `semana_iso` impressa no passo 1.5 das instruções (`semana_iso % 4`). Semana 44 → bloco 0; semana 45 → bloco 1; e assim por diante.
3. **Ano nas buscas:** acrescente o ano corrente (e, quando ajudar, o mês) para trazer o que é recente. Exemplo: `"sandbox regulatório" prefeitura decreto 2026`.
4. **Resultados:** a busca só serve para **descobrir**. Todo achado precisa ser confirmado na fonte oficial (o ato publicado ou a página do órgão ou da prefeitura) antes de entrar na base. Veja "Critério de entrada" nas instruções.
5. **Duplicata:** antes de tratar um achado como novo, procure em `data/sandboxes/` pelo município, órgão ou número do ato.
6. **No PR:** anote o número de buscas feitas e o bloco que rodou.
7. **Ausência:** não achar nada numa busca significa "não encontrado nestas buscas", não que o sandbox não exista.
8. **Domínios:** os domínios de diários e assembleias abaixo são indicativos. Se um `site:` não trouxer nada, busque pelo nome do diário ou da casa legislativa.

## Termos

Use estes termos combinados com esfera, lugar ou órgão:

- "sandbox regulatório"
- "ambiente regulatório experimental"
- "ambiente experimental de inovação"
- "regulação experimental"
- "bancos de testes regulatórios e tecnológicos"
- "LC 182/2021 art. 11"
- "Lei Complementar 182" "artigo 11"
- "marco legal das startups" sandbox
- "programa sandbox"
- "zona de desenvolvimento, inovação e tecnologia" (redação usada em Blumenau)
- "autorização temporária" sandbox

## Núcleo (toda semana)

**Termos gerais (últimas semanas):**
- `"sandbox regulatório" decreto <ano>`
- `"sandbox regulatório" lei municipal <ano>`
- `"ambiente regulatório experimental" <ano>`
- `prefeitura lança sandbox regulatório edital <ano>`
- `"sandbox regulatório" edital inscrições <ano>`
- `"sandbox regulatório" consulta pública <ano>`
- `agência "sandbox regulatório" resolução <ano>`

**Diário Oficial da União** (busca indexada; confirme no próprio `in.gov.br`):
- `site:in.gov.br "ambiente regulatório experimental"`
- `site:in.gov.br "sandbox regulatório"`

**Esfera federal:**
- `site:gov.br "sandbox regulatório" <ano>`
- `site:gov.br "ambiente regulatório experimental" edital`
- Brasil Participativo: `site:brasilparticipativo.presidencia.gov.br sandbox`

**Estudos e controle:**
- TCU / coLAB-i: `site:portal.tcu.gov.br sandbox regulatório`. A tabela de atos estaduais e municipais do estudo de 2023 está em https://portal.tcu.gov.br/data/files/4B/C2/6D/DB/56ABB810F80985A8E18818A8/231108_Sandbox.pdf.
- ENAP: `enap sandbox regulatório agências maturidade`. O estudo de maturidade aponta 64% das agências federais e 10% das estaduais com sandbox; a Revista do Serviço Público pode falhar por erro de SSL.
- CGU: `cgu auditoria sandbox regulatório agências`.

**Imprensa especializada** (só para descobrir; não justifica status):
- jurídica: JOTA, Conjur, Migalhas
- infraestrutura e transportes: Agência iNFRA, Atlas Público
- telecom: Teletime, Mobile Time, Tele.Síntese, DPL News
- finanças e seguros: Finsiders, Revista Apólice
- energia: Canal Energia, Cenário Energia, MegaWhat
- saúde: Futuro da Saúde
- aviação: Aeroin, MundoGEO
- gestão pública: GOV.UP, Abranet

Busca: `"sandbox regulatório" site:<domínio> <ano>`.

## Blocos rotativos

### Bloco 0 — Sul e Sudeste (SP, RJ, MG, ES, PR, SC, RS)

- `lei estadual institui "sandbox regulatório" <UF>` para cada UF do bloco.
- **Diários oficiais estaduais:** Imprensa Oficial SP (`doe.sp.gov.br`), IOERJ, Diário Oficial MG (`jornal.iof.mg.gov.br`), DIO-ES, DIOE-PR, DOE-SC, DOE-RS (Corag). Busca: `site:<domínio> "sandbox"`.
- **Assembleias:** `site:al.sp.gov.br sandbox`, `site:alerj.rj.gov.br sandbox`, `site:almg.gov.br sandbox`, `site:assembleia.pr.leg.br sandbox`, `site:alesc.sc.gov.br sandbox`, `site:al.rs.gov.br sandbox`.
- **Diários municipais consolidados:**
  - DOM-SC (`diariomunicipal.sc.gov.br`), muitos achados em municípios pequenos de SC;
  - AMP-PR (`diariomunicipal.com.br/amp`);
  - FAMURS (`diariomunicipal.com.br/famurs`);
  - AMM-MG (`diariomunicipal.com.br/amm-mg`).
- **Municípios grandes ainda sem achado** (repetir de vez em quando):
  - SP: Sorocaba, Santos, Ribeirão Preto, Jundiaí, Piracicaba, Bauru, Guarulhos, Osasco;
  - MG: Uberlândia, Juiz de Fora, Contagem;
  - PR e SC: Maringá, Cascavel, Ponta Grossa, Florianópolis, Chapecó, Itajaí;
  - RS: Caxias do Sul, Pelotas, Santa Maria, Novo Hamburgo.

  Busca: `"<município>" "sandbox regulatório"`.

### Bloco 1 — Nordeste (AL, BA, CE, MA, PB, PE, PI, RN, SE)

- `"sandbox regulatório" <estado> lei OR decreto <ano>`, para cada UF do bloco.
- **Diários oficiais estaduais:** `site:<domínio do DOE> "sandbox"`. **Diários municipais:** AMUPE (`diariomunicipal.com.br/amupe`), FAMUP (`diariomunicipal.com.br/famup`), APPM-PI, AMA-AL.
- **Assembleias:** Ceará (`al.ce.gov.br`, PLs em tramitação), Pernambuco (`alepe.pe.gov.br`), Bahia (`al.ba.gov.br`).
- **Capitais:** Fortaleza, Salvador, Natal, Aracaju, São Luís, João Pessoa. Busca: `"<capital>" "sandbox regulatório"`.

### Bloco 2 — Norte e Centro-Oeste (AC, AM, AP, PA, RO, RR, TO, DF, GO, MS, MT)

- `"sandbox regulatório" <estado> lei OR decreto <ano>`, para cada UF do bloco.
- **Diários oficiais:** DODF (`dodf.df.gov.br`), DOE-GO, DOE-MS, DIOE-MT, DOE-PA, DOE-AM, DOE-TO. Busca: `site:<domínio> "sandbox"`.
- **Assembleias:** Mato Grosso (`al.mt.gov.br`, PL em tramitação), Goiás (`al.go.leg.br`).
- **Capitais e polos:** Manaus, Belém, Porto Velho, Boa Vista, Rio Branco, Cuiabá, Campo Grande, Anápolis, Rio Verde. Busca: `"<município>" "sandbox regulatório"`.

### Bloco 3 — Federal ampliado, agências estaduais e pendências

**Órgãos federais candidatos** (spec §6.4, mais os achados de out/2026). Busca: `"<sigla>" "sandbox regulatório" OR "ambiente regulatório experimental" <ano>`.

| Órgão | Na base? | Página oficial do sandbox (ponto de partida) |
|---|---|---|
| BCB | sim | https://www.bcb.gov.br/estabilidadefinanceira/sandbox (não renderiza para robô; use os relatórios Cesb em PDF) |
| CVM | sim | https://www.gov.br/cvm/pt-br/assuntos/normas/sandbox-regulatorio |
| SUSEP | sim | https://www.gov.br/susep/pt-br/assuntos/sandbox-regulatorio |
| ANEEL | sim | https://www.gov.br/aneel/pt-br/empreendedores/sandboxes-tarifarios (`www2.aneel.gov.br` é anti-bot) |
| ANPD | sim | https://www.gov.br/anpd/pt-br/assuntos/projetos-acoes-iniciativas/sandbox |
| ANATEL | sim | https://www.gov.br/anatel/pt-br/regulado/agenda-regulatoria/sandbox-regulatorio |
| ANVISA | sim | https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/sandbox |
| ANAC | sim | busque "ambiente regulatório experimental" no gov.br/anac (Res. ANAC 775/2025) |
| ANP | sim | consultas públicas no gov.br/anp (CP 18/2026) |
| ANTT | sim | https://www.gov.br/antt/pt-br/acesso-a-informacao/acoes-e-programas/ambiente-regulatorio-experimental-sandbox-regulatorio |
| ANTAQ | sim | https://www.gov.br/antaq/pt-br/assuntos/sandbox-regulatorio-1 |
| ANS | sim | RN ANS 621/2024; notícias no gov.br/ans |
| INMETRO | sim | https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/analise-de-impacto-regulatorio/realizadas/2025/sandbox_em_metrologia_legal |
| MEC | sim | https://www.gov.br/mec/pt-br/acesso-a-informacao/participacao-social/editais-chamamento-publico/sandbox-ia-educacao |
| ANM | não | Tomada de Subsídios 4/2026 (só fontes secundárias até out/2026) |
| ANCINE | não | Notícia Regulatória nº 4-E/2025 só avalia o instrumento |
| ANA | não | só programas de governança, mediação e arbitragem |
| PREVIC | não | Agenda Regulatória 2026–27 sem menção |
| Receita Federal, MCTI, Ministério da Saúde, Ministério da Fazenda, CADE | não | nada até out/2026 |

**Agências reguladoras estaduais:** ARSESP (SP), ARSAE (MG), ADASA (DF), ARPE (PE), AGERBA (BA), ARSP (ES), ARESC (SC), Agepar (PR), Agenersa (RJ), AGEMS (MS), AGR (GO), Arce (CE). Busca: `"<sigla>" "sandbox regulatório"`.

**Pendências conhecidas** (candidatos sem ato oficial lido até out/2026). Confira se já há ficha e procure o ato:

| Candidato | O que falta |
|---|---|
| ANEEL — Energias da Floresta (REN 1.166/2026) | fonte oficial ANEEL (só agregadores) |
| ANVISA — cannabis medicinal (RDC 1.014/2026) | ementa no DOU |
| ANVISA — Edital 5/2026 (dispositivos médicos inovadores) | confirmar se é sandbox |
| ANM — Tomada de Subsídios 4/2026 | página da ANM ou do Brasil Participativo |
| ANTT — Sandbox Processo Competitivo; interoperabilidade do free flow | ato, participantes, descrição oficiais |
| ANP — delivery de combustível (GOfit) | ato formal de sandbox (hoje só "autorização limitada") |
| Minas Gerais — sandbox estadual de IA | se é PL ou lei (menção no Diário da ALMG de 13/05/2026) |
| João Pessoa/PB, Itabaiana/SE | ato municipal (só citados em justificativas legislativas) |
| Pelotas/RS, Caxias do Sul/RS | ato municipal |
| Bento Gonçalves/RS | sanção do PL 34/2022 |
| Itapeva/SP | andamento do PL 89/2025 |
| Gramado/RS — mobilidade aérea urbana | PL de táxis aéreos e vertiportos |
| Maceió/AL | resultado da consulta pública de 2026 para "implantação" do sandbox (já existe decreto de 2022) |
| São Paulo/SP | conteúdo do Decreto 64.915, de 26/01/2026 |

## Armadilhas conhecidas

- **Anti-bot:** `leismunicipais.com.br` (redireciona para `leis.org`), `leis.org` e `www2.aneel.gov.br` mostram CAPTCHA ou desafio do Cloudflare para robôs. Não tente contornar. Procure o mesmo ato em fonte **oficial** sem bloqueio: Diário Oficial do município ou do estado, SAPL ou site da câmara, site da prefeitura. Reproduções em agregadores **privados** (LegisWeb, Normas Brasil, Legismap) servem só como link de apoio e para campos que não são status, com confiança média. Nunca bastam para mudar status nem para registrar revogação; esses casos vão para "Para você decidir". Sem fonte oficial, registre "verificação manual necessária".
- **Páginas que não renderizam para robô:**
  - `bcb.gov.br/estabilidadefinanceira/sandbox` e os links `exibenormativo` do BCB, que são dinâmicos;
  - alguns PDFs grandes; baixe com `curl` e leia com `pdftotext`.
- **Sites oficiais que barram robôs (out/2026):**
  - `www.curitiba.pr.gov.br` e `www.cmc.pr.gov.br` devolvem 403 ao `curl` e ao WebFetch. Registre "verificação manual necessária".
  - `mid.curitiba.pr.gov.br` (PDFs da prefeitura) esgota o tempo no `curl`, mas abre pelo WebFetch: rode `pdftotext` no arquivo salvo.
- **ANPD:** o documento oficial do 3º relatório do sandbox (out/2026) já usa o nome "Agência Nacional de Proteção de Dados". Os relatórios ficam em `gov.br/anpd/pt-br/assuntos/projetos-acoes-iniciativas/sandbox`.
- **Bloqueios de imprensa:** `mattosfilho.com.br` e `futurodasaude.com.br` já devolveram 403. Procure outra fonte.
- **Falsos positivos:**
  - CPSI (LC 182/2021, arts. 13 a 15) é contratação de solução inovadora, não sandbox;
  - "plataforma", "hub", "hackathon" e "laboratório vivo" sem flexibilização de regra nem autorização temporária não são sandbox;
  - "marco legal de startups" municipal que só *prevê* sandbox não o institui.
- **Mesmo ato, vários sandboxes:** a Res. ANTT 5.999/2022 é o marco comum de vários projetos. Um ato novo pode ser um projeto novo dentro de um sandbox que já existe.
- **Edições:** SUSEP e BCB têm uma ficha por edição ou ciclo. Os demais órgãos acumulam editais na mesma ficha.
- **DF** é UF (esfera estadual, `jurisdicao: {uf: "DF", regiao: "Centro-Oeste"}`), não município.
- **Número em URL:** URLs oficiais às vezes trazem um número diferente do ato. A URL da Res. ANTAQ 131/2025, por exemplo, contém "130-2025". Confirme o número no texto.
- **Datas:** não infira dia ou mês que a fonte não dá. `desde` aceita só `AAAA`; o `historico` exige `AAAA-MM-DD`, então, sem a data exata, não crie a entrada.
