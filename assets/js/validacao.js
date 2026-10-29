// Validador puro da base de sandboxes. Sem imports de Node: roda no CI e no navegador.
import {
  ESFERAS, STATUS, INGRESSO, TIPOS_DOC, STATUS_SOLUCAO, STATUS_EDITAL, UF_REGIAO, REGIOES,
} from './esquema.js';

const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ANO = /^\d{4}$/;
const NORMATIVOS = ['lei', 'decreto', 'portaria', 'resolucao'];
const RE_IMAGEM = /^img\/[a-z0-9-]+\.(jpg|jpeg|png|webp|svg)$/;

const texto = (v) => typeof v === 'string' && v.trim() !== '';
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// URL absoluta http(s). Usa a API URL (existe no Node e no navegador).
export function urlHttp(v) {
  if (!texto(v) || !/^https?:\/\//i.test(v) || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname);
  } catch {
    return false;
  }
}

function dataValida(v) {
  if (typeof v !== 'string' || !RE_DATA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function validarSandbox(s, ctx, erro) {
  // `erro(msg)` já prefixa o id.
  const obrigTexto = (campo) => {
    if (!texto(s[campo])) erro(`campo obrigatório ausente ou vazio: ${campo}`);
  };
  const enumDe = (campo, valores, rotulo) => {
    if (!valores.includes(s[campo])) erro(`${rotulo} inválido: ${JSON.stringify(s[campo])}`);
  };

  obrigTexto('nome');
  obrigTexto('descricao');
  enumDe('esfera', ESFERAS, 'esfera');
  enumDe('status', STATUS, 'status');
  enumDe('ingresso', INGRESSO, 'ingresso');

  // jurisdição
  const j = s.jurisdicao;
  if (!objeto(j)) {
    erro('campo obrigatório ausente: jurisdicao');
  } else if (s.esfera === 'federal') {
    if (!texto(j.orgao)) erro('jurisdicao.orgao obrigatório para esfera federal');
    else if (!ctx.orgaos.has(j.orgao)) erro(`órgão desconhecido: ${j.orgao}`);
  } else if (s.esfera === 'municipal' || s.esfera === 'estadual') {
    if (s.esfera === 'municipal' && !texto(j.municipio)) {
      erro('jurisdicao.municipio obrigatório para esfera municipal');
    }
    if (!texto(j.uf)) {
      erro('jurisdicao.uf obrigatório');
    } else if (!Object.hasOwn(UF_REGIAO, j.uf)) {
      erro(`UF inválida: ${j.uf}`);
    } else if (!texto(j.regiao)) {
      erro('jurisdicao.regiao obrigatório');
    } else if (!REGIOES.includes(j.regiao) || j.regiao !== UF_REGIAO[j.uf]) {
      erro(`região não confere com a UF: ${j.regiao} (esperado ${UF_REGIAO[j.uf]})`);
    }
  }

  // temas
  if (!Array.isArray(s.temas)) {
    erro('campo obrigatório ausente: temas (array, pode ser vazio)');
  } else {
    for (const t of s.temas) if (!ctx.temas.has(t)) erro(`tema desconhecido: ${t}`);
  }

  // resumo
  if (!texto(s.resumo)) erro('resumo obrigatório');
  else if ([...s.resumo].length > 140) erro(`resumo excede 140 caracteres (${[...s.resumo].length})`);

  // desde / verificado_em
  if (!(typeof s.desde === 'string' && (RE_ANO.test(s.desde) || dataValida(s.desde)))) {
    erro(`data inválida em desde: ${JSON.stringify(s.desde)} (use AAAA ou AAAA-MM-DD)`);
  }
  if (!dataValida(s.verificado_em)) {
    erro(`data inválida em verificado_em: ${JSON.stringify(s.verificado_em)} (use AAAA-MM-DD)`);
  }

  // opcionais simples
  if (s.gestor !== undefined && !texto(s.gestor)) erro('gestor deve ser texto');
  if (s.elegibilidade !== undefined && !texto(s.elegibilidade)) erro('elegibilidade deve ser texto');
  if (s.prazo_teste_meses !== undefined && s.prazo_teste_meses !== null
      && !(typeof s.prazo_teste_meses === 'number' && s.prazo_teste_meses > 0)) {
    erro('prazo_teste_meses deve ser número positivo ou null');
  }
  if (s.flexibilizacoes !== undefined
      && !(Array.isArray(s.flexibilizacoes) && s.flexibilizacoes.every(texto))) {
    erro('flexibilizacoes deve ser lista de textos');
  }
  if (s.recem_adicionado !== undefined && typeof s.recem_adicionado !== 'boolean') {
    erro('recem_adicionado deve ser booleano');
  }

  // documentos
  const docs = Array.isArray(s.documentos) ? s.documentos : null;
  if (!docs || docs.length === 0) {
    erro('é preciso ao menos um documento');
  } else {
    docs.forEach((d, i) => {
      const p = `documentos[${i}]`;
      if (!objeto(d)) return erro(`${p} inválido`);
      if (!TIPOS_DOC.includes(d.tipo)) erro(`${p}.tipo inválido: ${JSON.stringify(d.tipo)}`);
      if (!texto(d.titulo)) erro(`${p}.titulo obrigatório`);
      if (!texto(d.url)) erro(`${p}.url obrigatório`);
      else if (!urlHttp(d.url)) erro(`${p}.url deve ser http(s): ${JSON.stringify(d.url)}`);
      if (d.data !== undefined && !dataValida(d.data)) erro(`data inválida em ${p}.data: ${JSON.stringify(d.data)}`);
    });
    const principais = docs.filter((d) => objeto(d) && d.principal === true);
    if (principais.length !== 1) {
      erro(`é preciso exatamente um documento principal (encontrados ${principais.length})`);
    } else if (s.status === 'regulamentado' && !NORMATIVOS.includes(principais[0].tipo)) {
      erro('regulamentado exige ato normativo como documento principal (lei, decreto, portaria ou resolucao)');
    }
  }

  // soluções
  const solucoes = s.solucoes === undefined ? [] : s.solucoes;
  if (!Array.isArray(solucoes)) {
    erro('solucoes deve ser lista');
  } else {
    solucoes.forEach((x, i) => {
      const p = `solucoes[${i}]`;
      if (!objeto(x)) return erro(`${p} inválido`);
      if (!texto(x.nome)) erro(`${p}.nome obrigatório`);
      if (!texto(x.descricao)) erro(`${p}.descricao obrigatório`);
      if (!STATUS_SOLUCAO.includes(x.status)) erro(`${p}.status inválido: ${JSON.stringify(x.status)}`);
      if (!texto(x.fonte)) erro(`${p}.fonte obrigatório`);
      else if (!urlHttp(x.fonte)) erro(`${p}.fonte deve ser http(s): ${JSON.stringify(x.fonte)}`);
      for (const c of ['inicio', 'fim']) {
        if (x[c] !== undefined && !dataValida(x[c])) erro(`data inválida em ${p}.${c}: ${JSON.stringify(x[c])}`);
      }
    });
    if (s.status === 'ativo') {
      const ok = solucoes.some((x) => objeto(x) && ['em_teste', 'concluida'].includes(x.status) && texto(x.fonte));
      if (!ok) erro('ativo exige solução documentada (status em_teste ou concluida, com fonte)');
    }
  }

  // editais
  if (s.editais !== undefined) {
    if (!Array.isArray(s.editais)) erro('editais deve ser lista');
    else {
      s.editais.forEach((e, i) => {
        const p = `editais[${i}]`;
        if (!objeto(e)) return erro(`${p} inválido`);
        if (!texto(e.titulo)) erro(`${p}.titulo obrigatório`);
        if (!texto(e.url)) erro(`${p}.url obrigatório`);
        else if (!urlHttp(e.url)) erro(`${p}.url deve ser http(s): ${JSON.stringify(e.url)}`);
        if (!STATUS_EDITAL.includes(e.status)) erro(`${p}.status inválido: ${JSON.stringify(e.status)}`);
        for (const c of ['abertura', 'encerramento']) {
          if (e[c] !== undefined && !dataValida(e[c])) erro(`data inválida em ${p}.${c}: ${JSON.stringify(e[c])}`);
        }
      });
    }
  }

  // imagem
  if (s.imagem !== undefined && s.imagem !== null) {
    const im = s.imagem;
    if (!objeto(im)) erro('imagem inválida');
    else {
      for (const c of ['arquivo', 'credito', 'licenca', 'origem']) {
        if (!texto(im[c])) erro(`imagem.${c} obrigatório`);
      }
      if (texto(im.arquivo) && !RE_IMAGEM.test(im.arquivo)) {
        erro(`imagem.arquivo inválido (use img/<nome-kebab>.jpg|jpeg|png|webp|svg): ${JSON.stringify(im.arquivo)}`);
      }
      if (texto(im.origem) && !urlHttp(im.origem)) erro(`imagem.origem deve ser http(s): ${JSON.stringify(im.origem)}`);
    }
  }

  // fontes
  if (!Array.isArray(s.fontes) || s.fontes.length === 0) {
    erro('é preciso ao menos uma fonte');
  } else {
    s.fontes.forEach((f, i) => {
      const p = `fontes[${i}]`;
      if (!objeto(f)) return erro(`${p} inválido`);
      if (!texto(f.url)) erro(`${p}.url obrigatório`);
      else if (!urlHttp(f.url)) erro(`${p}.url deve ser http(s): ${JSON.stringify(f.url)}`);
      if (!texto(f.titulo)) erro(`${p}.titulo obrigatório`);
      if (!dataValida(f.acessado_em)) erro(`data inválida em ${p}.acessado_em: ${JSON.stringify(f.acessado_em)}`);
    });
  }

  // histórico
  if (!Array.isArray(s.historico)) {
    erro('campo obrigatório ausente: historico (lista, pode ser vazia)');
  } else {
    s.historico.forEach((h, i) => {
      const p = `historico[${i}]`;
      if (!objeto(h)) return erro(`${p} inválido`);
      if (!dataValida(h.data)) erro(`data inválida em ${p}.data: ${JSON.stringify(h.data)}`);
      if (!texto(h.descricao)) erro(`${p}.descricao obrigatório`);
      if (h.fonte !== undefined && h.fonte !== null && !urlHttp(h.fonte)) erro(`${p}.fonte deve ser http(s): ${JSON.stringify(h.fonte)}`);
    });
    if (s.status === 'encerrado' && !s.historico.some((h) => objeto(h) && texto(h.fonte))) {
      erro('encerrado exige histórico com fonte');
    }
  }
}

export function validarBase({ temas, orgaos, sandboxes } = {}) {
  const erros = [];
  const base = (msg) => erros.push(`base: ${msg}`);

  if (!Array.isArray(temas)) base('temas deve ser uma lista');
  if (!Array.isArray(orgaos)) base('orgaos deve ser uma lista');
  if (!Array.isArray(sandboxes)) base('sandboxes deve ser uma lista');
  if (erros.length) return { erros };

  const idsTemas = new Set();
  for (const t of temas) {
    if (!objeto(t) || !texto(t.id)) base('tema sem id');
    else if (idsTemas.has(t.id)) base(`tema duplicado: ${t.id}`);
    else idsTemas.add(t.id);
  }
  const siglas = new Set();
  for (const o of orgaos) {
    if (!objeto(o) || !texto(o.sigla)) base('órgão sem sigla');
    else if (siglas.has(o.sigla)) base(`órgão duplicado: ${o.sigla}`);
    else siglas.add(o.sigla);
  }

  const ctx = { temas: idsTemas, orgaos: siglas };
  const vistos = new Set();
  sandboxes.forEach((s, i) => {
    if (!objeto(s)) return base(`sandboxes[${i}] não é um objeto`);
    const id = texto(s.id) ? s.id : `sandboxes[${i}]`;
    const erro = (msg) => erros.push(`${id}: ${msg}`);
    if (!texto(s.id)) erro('campo obrigatório ausente: id');
    else if (!RE_ID.test(s.id)) erro(`id inválido (use kebab-case): ${s.id}`);
    else if (vistos.has(s.id)) erro('id duplicado');
    vistos.add(s.id);
    validarSandbox(s, ctx, erro);
  });

  return { erros };
}
