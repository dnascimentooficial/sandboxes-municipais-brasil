// Bloco "Âmbito nacional": acordeão com uma linha por órgão federal e, dentro, os sandboxes desse órgão.
// Conta a base inteira (não segue os filtros). htmlNacional é puro (testado em Node); desenharNacional liga os eventos.
//   - cabeçalho: <button aria-expanded aria-controls> com sigla, nome do órgão, contagem e indicador +/−;
//   - painel: um botão por sandbox (nome + selo de status) com data-abrir-sandbox=<id>, que abre a gaveta;
//   - todos fechados de início; vários podem ficar abertos; o estado sobrevive aos renders (desenhado uma vez).
import { escapar } from '../formatar.js';
import { seloStatus } from './cartoes.js';
import { plural } from './mapa.js';

const nSandboxes = (n) => plural(n, 'sandbox', 'sandboxes');
const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR');

// [{sigla, nome, itens:[sandbox]}] ordenado por quantidade (desc) e sigla.
export function gruposNacionais(sandboxes, orgaos) {
  const grupos = new Map();
  for (const s of sandboxes ?? []) {
    if (s?.esfera !== 'federal') continue;
    const sigla = s.jurisdicao?.orgao || '';
    if (!grupos.has(sigla)) grupos.set(sigla, []);
    grupos.get(sigla).push(s);
  }
  return [...grupos.entries()]
    .map(([sigla, itens]) => {
      const o = (orgaos ?? []).find((x) => x.sigla === sigla);
      return { sigla, nome: o?.nome || sigla || 'Órgão não informado', itens: [...itens].sort(porNome) };
    })
    .sort((a, b) => b.itens.length - a.itens.length || a.sigla.localeCompare(b.sigla, 'pt-BR'));
}

export function htmlNacional(sandboxes, orgaos) {
  const grupos = gruposNacionais(sandboxes, orgaos);
  if (!grupos.length) {
    return '<p class="nacional-vazio"><b>Nenhum sandbox federal mapeado ainda.</b>Os programas de agências e órgãos federais entram aqui assim que forem verificados.</p>';
  }
  const max = Math.max(...grupos.map((g) => g.itens.length));
  const linhas = grupos.map((g, i) => {
    const n = g.itens.length;
    const idPainel = `nac-painel-${i}`;
    const idCab = `nac-cab-${i}`;
    const itens = g.itens.map((s) => `<li><button type="button" class="nac-sb" data-abrir-sandbox="${escapar(s.id)}">
          <span class="nac-sb-nome">${escapar(s.nome || 'não informado')}</span>${seloStatus(s.status)}</button></li>`).join('');
    const filtrar = g.sigla
      ? `<button type="button" class="nac-filtrar" data-filtro="orgao" data-valor="${escapar(g.sigla)}" aria-pressed="false">Mostrar só ${escapar(g.sigla)} na lista</button>`
      : '';
    return `<li class="nac-item">
      <h3 class="nac-h"><button type="button" class="nac-cab" id="${idCab}" aria-expanded="false" aria-controls="${idPainel}">
        <span class="av" aria-hidden="true">${escapar(g.sigla || '?')}</span>
        <span class="meta"><span class="nm">${escapar(g.nome)}</span>
        <span class="bar" aria-hidden="true"><i style="width:${Math.round((n / max) * 100)}%"></i></span></span>
        <span class="n"><span aria-hidden="true">${n}</span><span class="sr-only">${escapar(nSandboxes(n))}</span></span>
        <span class="nac-ind" aria-hidden="true"></span>
      </button></h3>
      <div class="nac-painel" id="${idPainel}" aria-labelledby="${idCab}" hidden>
        <ul class="nac-lista">${itens}</ul>${filtrar}
      </div>
    </li>`;
  });
  return `<ul class="nac">${linhas.join('')}</ul>`;
}

// Abre/fecha um item do acordeão (exportado para teste com DOM falso, se preciso).
export function alternarItem(botao, painel) {
  const aberto = botao.getAttribute('aria-expanded') === 'true';
  botao.setAttribute('aria-expanded', String(!aberto));
  painel.hidden = aberto;
  return !aberto;
}

export function desenharNacional(raiz, sandboxes, orgaos, { aoAbrir } = {}) {
  raiz.innerHTML = htmlNacional(sandboxes, orgaos);
  // <button> nativo: Enter e Espaço já disparam click.
  raiz.addEventListener('click', (ev) => {
    const cab = ev.target.closest?.('.nac-cab');
    if (cab && raiz.contains(cab)) {
      const painel = raiz.querySelector(`#${cab.getAttribute('aria-controls')}`);
      if (painel) alternarItem(cab, painel);
      return;
    }
    const sb = ev.target.closest?.('[data-abrir-sandbox]');
    if (sb && raiz.contains(sb) && aoAbrir) aoAbrir(sb.dataset.abrirSandbox);
  });
}
