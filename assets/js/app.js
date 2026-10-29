// Sandboxes Brasil — bootstrap, estado único e rotas por hash.
//
// Estado: {filtros:{esfera,status,regiao,uf,tema,orgao}, termo, ordem, aba, sandbox, comparar, pendente}
//   - aba, sandbox e comparar vêm do hash (#sandbox=<id> | #comparar=<id1>,<id2>,<id3>);
//   - pendente é só estado: id que pediu para entrar no Comparar quando já havia 3 (Task 9 pergunta qual substituir).
//
// As telas recebem um objeto `ctx` com:
//   ctx.dados                  window.SANDBOX_DADOS
//   ctx.estado()               cópia rasa do estado atual
//   ctx.atualizar(parcial)     mescla (filtros é mesclado chave a chave) e redesenha
//   ctx.irPara(hashEstado)     {aba?, sandbox?, comparar?} -> grava o hash e redesenha
//   ctx.pedirComparar(id)      leva o sandbox para o Comparar (ou marca `pendente` se já houver 3)
//   ctx.abrirSandbox(id)       grava #sandbox=<id>; a gaveta desenha a partir de estado.sandbox
//   ctx.abrirIndicacao()       abre o modal "Indicar um sandbox" (ui/indicar.js)
// As mesmas funções são exportadas para módulos futuros.
import { lerHash, escreverHash } from './rotas.js';
import { adicionarAoComparar } from './comparar.js';
import { montarPanorama } from './ui/panorama.js';
import { montarGaveta } from './ui/gaveta.js';
import { montarComparar } from './ui/comparar.js';
import { montarIndicacao } from './ui/indicar.js';

const dados = window.SANDBOX_DADOS ?? { meta: {}, temas: [], orgaos: [], sandboxes: [] };
const idsValidos = new Set(dados.sandboxes.map((s) => s.id));

const FILTROS_VAZIOS = { esfera: '', status: '', regiao: '', uf: '', tema: '', orgao: '' };

const st = {
  filtros: { ...FILTROS_VAZIOS },
  termo: '',
  ordem: 'nome',
  aba: 'panorama',
  sandbox: null,
  comparar: [],
  pendente: null,
};

export function estado() {
  return { ...st, filtros: { ...st.filtros }, comparar: [...st.comparar] };
}

export function atualizar(parcial = {}) {
  const { filtros, ...resto } = parcial;
  if (filtros) st.filtros = { ...st.filtros, ...filtros };
  Object.assign(st, resto);
  render();
}

function sincronizarHash() {
  const h = lerHash(location.hash, idsValidos);
  st.aba = h.aba;
  st.sandbox = h.sandbox;
  if (h.aba === 'comparar') {
    st.comparar = h.comparar;
    if (st.pendente && st.comparar.length < 3) st.pendente = null;
    // Hash com ids inválidos/repetidos (#comparar=a,a,xyz) é reescrito já normalizado.
    const limpo = escreverHash(h);
    if (limpo !== location.hash) history.replaceState(null, '', limpo);
  } else {
    st.pendente = null; // saiu do Comparar: o pedido de substituição perde o sentido
  }
}

export function irPara(hashEstado = {}) {
  const alvo = { aba: st.aba, sandbox: st.sandbox, comparar: st.comparar, ...hashEstado };
  if (alvo.aba === 'comparar') alvo.sandbox = null;
  const novo = escreverHash(alvo);
  if (novo === location.hash) {
    sincronizarHash();
    render();
  } else if (novo) {
    location.hash = novo; // dispara hashchange -> sincroniza e redesenha
  } else {
    history.pushState(null, '', location.pathname + location.search);
    sincronizarHash();
    render();
  }
}

export function pedirComparar(id) {
  if (!idsValidos.has(id)) return;
  const r = adicionarAoComparar(st.comparar, id);
  if (r.precisaSubstituir) {
    st.pendente = id;
    irPara({ aba: 'comparar', comparar: st.comparar });
  } else {
    st.pendente = null;
    irPara({ aba: 'comparar', comparar: r.ids });
  }
}

export function abrirSandbox(id) {
  if (idsValidos.has(id)) irPara({ aba: 'panorama', sandbox: id });
}

// Modal de indicação: foco, Esc, fundo e envio ficam em ui/indicar.js.
const indicacao = montarIndicacao(document.getElementById('modal-indicacao'));
export function abrirIndicacao() {
  indicacao.abrir();
}

const ctx = { dados, estado, atualizar, irPara, pedirComparar, abrirSandbox, abrirIndicacao };

// ---------- Telas ----------
const panorama = montarPanorama(document, ctx);

// Gaveta de detalhe: abre/fecha a partir de estado.sandbox (#sandbox=<id>).
const gaveta = montarGaveta(document.getElementById('gaveta'), ctx);

// Comparar: até 3 sandboxes lado a lado (#comparar=<id1>,<id2>,<id3>).
const comparar = montarComparar(document.getElementById('comparar'), ctx);

// ---------- Abas ----------
const abas = [...document.querySelectorAll('[role="tab"][data-aba]')];
const paineis = { panorama: document.getElementById('view-panorama'), comparar: document.getElementById('view-comparar') };
const contagemComparar = document.getElementById('tab-comparar-n');

function renderAbas(e) {
  for (const t of abas) {
    const ativa = t.dataset.aba === e.aba;
    t.setAttribute('aria-selected', String(ativa));
    t.tabIndex = ativa ? 0 : -1;
  }
  for (const [nome, el] of Object.entries(paineis)) el.hidden = nome !== e.aba;
  document.body.classList.toggle('aba-comparar', e.aba === 'comparar');
  contagemComparar.hidden = e.comparar.length === 0;
  contagemComparar.textContent = String(e.comparar.length);
}

function irParaAba(aba) {
  if (aba === 'comparar') irPara({ aba: 'comparar', comparar: st.comparar });
  else irPara({ aba: 'panorama', sandbox: null });
}

for (const t of abas) {
  t.addEventListener('click', () => irParaAba(t.dataset.aba));
  t.addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    ev.preventDefault();
    const i = abas.indexOf(t);
    const j = ev.key === 'Home' ? 0 : ev.key === 'End' ? abas.length - 1
      : (i + (ev.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length;
    abas[j].focus();
    irParaAba(abas[j].dataset.aba);
  });
}

// ---------- Indicação ----------
document.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-indicar]')) {
    ev.preventDefault();
    abrirIndicacao();
  }
});

// ---------- Ciclo ----------
let anterior = { aba: null };
function render() {
  const e = estado();
  renderAbas(e);
  if (e.aba === 'panorama') panorama.render(e);
  else comparar.render(e.comparar);
  gaveta.render(e);
  if (anterior.aba && anterior.aba !== e.aba) window.scrollTo({ top: 0 });
  anterior = e;
}

window.addEventListener('hashchange', () => {
  sincronizarHash();
  render();
});

sincronizarHash();
render();
