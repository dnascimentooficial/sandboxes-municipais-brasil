// Aba Comparar (spec §4.4 e §4.5). montarComparar(el, ctx) -> {render(ids)}.
//
// Até 3 sandboxes lado a lado. Toda mudança passa por ctx.irPara({aba:'comparar', comparar}); o hash é a
// fonte da verdade. Os campos seguem o padrão ARIA 1.2 de combobox (lista de sugestões, ↑/↓/Enter/Esc).
// Quando ctx.estado().pendente vem preenchido (o "Comparar" chegou com 3 escolhidos), pergunta qual substituir.
import { MAX_COMPARAR, adicionarAoComparar, substituirNoComparar, removerDoComparar } from '../comparar.js';
import { escapar } from '../formatar.js';
import { faixaSemImagem } from './gaveta-conteudo.js';
import { VAZIO, sugestoes, opcoesSugestao, tabelaComparacao, avisoSubstituir } from './comparar-conteudo.js';

export function montarComparar(el, ctx) {
  const { temas = [], orgaos = [], sandboxes = [] } = ctx.dados;
  const porId = new Map(sandboxes.map((s) => [s.id, s]));

  el.innerHTML = `
    <p class="eyebrow">Comparar</p>
    <h1 class="block-title" id="cmp-titulo" tabindex="-1">Comparar sandboxes</h1>
    <p class="lede">Ponha até 3 sandboxes lado a lado. O endereço desta página guarda a escolha e pode ser compartilhado.</p>
    <div data-cmp-aviso></div>
    <div class="cmp-campos" data-cmp-campos></div>
    <p class="sr-only" data-cmp-status aria-live="polite"></p>
    <div class="cmp-resultado" data-cmp-tabela></div>`;
  const q = (sel) => el.querySelector(sel);
  const areaAviso = q('[data-cmp-aviso]');
  const areaCampos = q('[data-cmp-campos]');
  const areaTabela = q('[data-cmp-tabela]');
  const status = q('[data-cmp-status]');

  let ids = [];
  let chave = null;
  let terceiroAberto = false; // "+ adicionar" revela o 3º campo
  let focar = null; // o que focar depois do próximo desenho

  const ir = (novo) => ctx.irPara({ aba: 'comparar', comparar: novo });

  // ---------- Campos ----------
  function campoHtml(i) {
    const s = porId.get(ids[i]);
    const rot = `Sandbox ${i + 1}`;
    if (s) {
      return `<div class="cmp-slot cheio"><span class="cmp-slot-n">${rot}</span>
        <b>${escapar(s.nome)}</b>
        <button type="button" class="icon-btn" data-remover="${escapar(s.id)}" aria-label="Remover ${escapar(s.nome)} da comparação"><span aria-hidden="true">×</span></button></div>`;
    }
    return `<div class="cmp-slot">
      <label class="cmp-slot-n" for="cmp-campo-${i}">${rot}</label>
      <div class="cmp-combo">
        <input id="cmp-campo-${i}" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false"
          aria-controls="cmp-lista-${i}" autocomplete="off" spellcheck="false" data-campo="${i}"
          placeholder="Busque por nome, cidade, UF, órgão ou tema">
        <ul id="cmp-lista-${i}" role="listbox" aria-label="Sugestões para ${rot}" class="cmp-lista" hidden></ul>
        <p class="cmp-nada" hidden>Nenhum sandbox encontrado.</p>
      </div></div>`;
  }

  function desenharCampos() {
    const visiveis = ids.length >= 2 && (terceiroAberto || ids.length === MAX_COMPARAR) ? 3 : 2;
    let html = '';
    for (let i = 0; i < visiveis; i++) html += campoHtml(i);
    if (visiveis === 2 && ids.length === 2) {
      html += '<button type="button" class="btn-sm cmp-mais" data-adicionar>+ adicionar</button>';
    }
    areaCampos.innerHTML = html;
  }

  // ---------- Combobox ----------
  const combos = new WeakMap(); // input -> {lista, ativo}

  function estadoCombo(input) {
    if (!combos.has(input)) combos.set(input, { lista: [], ativo: -1 });
    return combos.get(input);
  }

  function listbox(input) {
    return input.parentElement.querySelector('[role="listbox"]');
  }

  function fechar(input) {
    const c = estadoCombo(input);
    c.ativo = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    listbox(input).hidden = true;
    input.parentElement.querySelector('.cmp-nada').hidden = true;
  }

  function abrir(input) {
    const c = estadoCombo(input);
    c.lista = sugestoes(sandboxes, input.value, temas, ids);
    c.ativo = -1;
    const lb = listbox(input);
    lb.innerHTML = opcoesSugestao(c.lista, { orgaos, prefixo: `cmp-op-${input.dataset.campo}` });
    const tem = c.lista.length > 0;
    lb.hidden = !tem;
    input.parentElement.querySelector('.cmp-nada').hidden = tem || !input.value.trim();
    input.setAttribute('aria-expanded', String(tem));
    input.removeAttribute('aria-activedescendant');
    status.textContent = tem ? `${c.lista.length} ${c.lista.length === 1 ? 'sugestão' : 'sugestões'}.` : 'Nenhum sandbox encontrado.';
  }

  function marcar(input, i) {
    const c = estadoCombo(input);
    const lb = listbox(input);
    c.ativo = i;
    lb.querySelectorAll('[role="option"]').forEach((op, k) => op.setAttribute('aria-selected', String(k === i)));
    const op = lb.querySelector(`#cmp-op-${input.dataset.campo}-${i}`);
    if (op) {
      input.setAttribute('aria-activedescendant', op.id);
      op.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function escolher(id) {
    const r = adicionarAoComparar(ids, id);
    if (r.precisaSubstituir) return;
    focar = 'proximo';
    ir(r.ids);
  }

  areaCampos.addEventListener('input', (ev) => {
    if (ev.target.matches('[role="combobox"]')) abrir(ev.target);
  });
  areaCampos.addEventListener('focusout', (ev) => {
    if (ev.target.matches('[role="combobox"]')) fechar(ev.target);
  });
  areaCampos.addEventListener('keydown', (ev) => {
    const input = ev.target;
    if (!input.matches('[role="combobox"]')) return;
    const c = estadoCombo(input);
    const aberto = input.getAttribute('aria-expanded') === 'true';
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!aberto) abrir(input);
      const n = c.lista.length;
      if (!n) return;
      const desce = ev.key === 'ArrowDown';
      const prox = c.ativo < 0 ? (desce ? 0 : n - 1) : (c.ativo + (desce ? 1 : -1) + n) % n;
      marcar(input, prox);
    } else if (ev.key === 'Enter') {
      if (aberto && c.ativo >= 0) {
        ev.preventDefault();
        escolher(c.lista[c.ativo].id);
      }
    } else if (ev.key === 'Escape') {
      if (aberto) {
        ev.preventDefault();
        fechar(input);
      } else if (input.value) {
        ev.preventDefault();
        input.value = '';
      }
    }
  });
  // Clique numa sugestão: pointerdown não tira o foco do campo; o click escolhe.
  areaCampos.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('[role="option"]')) ev.preventDefault();
  });
  areaCampos.addEventListener('click', (ev) => {
    const op = ev.target.closest('[role="option"]');
    if (op) escolher(op.dataset.id);
    else if (ev.target.matches('[role="combobox"]') && ev.target.getAttribute('aria-expanded') !== 'true') abrir(ev.target);
    else if (ev.target.closest('[data-adicionar]')) {
      terceiroAberto = true;
      desenharCampos();
      q('#cmp-campo-2')?.focus();
    }
  });

  // ---------- Remover / substituir ----------
  el.addEventListener('click', (ev) => {
    const rem = ev.target.closest('[data-remover]');
    if (rem) {
      focar = 'campo';
      ir(removerDoComparar(ids, rem.dataset.remover));
      return;
    }
    const sub = ev.target.closest('[data-substituir]');
    const pendente = ctx.estado().pendente;
    if (sub && pendente) {
      const novo = substituirNoComparar(ids, Number(sub.dataset.substituir), pendente);
      focar = 'titulo';
      ctx.atualizar({ pendente: null });
      ir(novo);
    } else if (ev.target.closest('[data-cancelar]')) {
      focar = 'titulo';
      ctx.atualizar({ pendente: null });
    }
  });

  // ---------- Desenho ----------
  function desenharTabela() {
    const escolhidos = ids.map((id) => porId.get(id)).filter(Boolean);
    if (!escolhidos.length) {
      areaTabela.innerHTML = `<p class="cmp-vazio empty">${escapar(VAZIO)}</p>`;
      return;
    }
    areaTabela.innerHTML = tabelaComparacao(escolhidos, { temas, orgaos });
    for (const img of areaTabela.querySelectorAll('.cmp-foto img')) {
      img.addEventListener('error', () => {
        const s = porId.get(img.closest('[data-id]')?.dataset.id);
        const fig = img.closest('.cmp-foto');
        if (fig && s) fig.outerHTML = `<div class="cmp-foto">${faixaSemImagem(s, temas)}</div>`;
      }, { once: true });
    }
  }

  function aplicarFoco() {
    const alvo = focar;
    focar = null;
    if (!alvo) return;
    let n = null;
    if (alvo === 'aviso') n = q('[data-substituir]');
    else if (alvo === 'proximo' || alvo === 'campo') n = q('[role="combobox"]') ?? q('[data-adicionar]') ?? q('#cmp-titulo');
    else n = q('#cmp-titulo');
    n?.focus({ preventScroll: alvo !== 'aviso' });
  }

  function render(novosIds = []) {
    const pendente = ctx.estado().pendente;
    const k = `${novosIds.join(',')}|${pendente ?? ''}`;
    if (k === chave) return;
    const tinhaAviso = Boolean(areaAviso.firstElementChild);
    chave = k;
    ids = [...novosIds];
    if (ids.length < 2) terceiroAberto = false;
    const escolhidos = ids.map((id) => porId.get(id)).filter(Boolean);
    const pend = pendente && ids.length >= MAX_COMPARAR ? porId.get(pendente) : null;
    areaAviso.innerHTML = pend ? avisoSubstituir(pend, escolhidos) : '';
    if (pend && !tinhaAviso && !focar) focar = 'aviso';
    desenharCampos();
    desenharTabela();
    aplicarFoco();
  }

  return { render };
}
