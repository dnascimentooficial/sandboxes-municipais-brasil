// Mapa do Brasil por UF (a partir de window.BRASIL_MAPA), bloco "Âmbito nacional" e ranking de estados.
// Cliques são tratados por quem monta: todo alvo clicável tem data-filtro/data-valor.
import { escapar } from '../formatar.js';
import { UF_REGIAO } from '../esquema.js';

export const UF_NOME = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco',
  PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia',
  RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins',
};

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const nSandboxes = (n) => plural(n, 'sandbox', 'sandboxes');

const NIVEIS = 4;
const nivel = (n, max) => (n > 0 && max > 0 ? Math.max(1, Math.min(NIVEIS, Math.ceil((n / max) * NIVEIS))) : 0);

function legenda(max) {
  const itens = ['<span class="lg"><i class="n0"></i>Nenhum</span>'];
  for (let k = 1; k <= NIVEIS; k++) {
    const de = Math.floor(((k - 1) * max) / NIVEIS) + 1;
    const ate = Math.floor((k * max) / NIVEIS);
    if (ate < de) continue;
    const txt = de === ate ? String(de) : `${de}–${ate}`;
    itens.push(`<span class="lg"><i class="n${k}"></i>${escapar(txt)}</span>`);
  }
  return itens.join('');
}

export function desenharMapa(raizMapa, raizLegenda, porUf) {
  const mapa = window.BRASIL_MAPA;
  if (!mapa?.ufs) {
    raizMapa.innerHTML = '<p class="nota">Mapa indisponível.</p>';
    raizLegenda.innerHTML = '';
    return;
  }
  const max = Math.max(0, ...Object.values(porUf));
  const caminhos = Object.entries(mapa.ufs).map(([uf, { d }]) => {
    const n = porUf[uf] ?? 0;
    const nome = UF_NOME[uf] ?? uf;
    const rotuloAcess = `${uf}: ${nSandboxes(n)}`;
    const comum = `class="uf n${nivel(n, max)}" d="${escapar(d)}" aria-label="${escapar(rotuloAcess)}"`;
    const titulo = `<title>${escapar(`${nome}: ${nSandboxes(n)}`)}</title>`;
    if (n === 0) return `<path ${comum} role="img">${titulo}</path>`;
    return `<path ${comum} role="button" tabindex="0" aria-pressed="false" data-filtro="uf" data-valor="${escapar(uf)}">${titulo}</path>`;
  });
  raizMapa.innerHTML = `<svg viewBox="0 0 ${Number(mapa.w) || 586} ${Number(mapa.h) || 601}" role="group" aria-label="Mapa do Brasil: sandboxes estaduais e municipais por UF">${caminhos.join('')}</svg>`;
  raizLegenda.innerHTML = legenda(max);

  // Teclado: Enter/Espaço nos estados clicáveis.
  raizMapa.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const alvo = ev.target.closest?.('[data-filtro]');
    if (!alvo) return;
    ev.preventDefault();
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

export function desenharNacional(raiz, sandboxes, orgaos) {
  const federais = sandboxes.filter((s) => s.esfera === 'federal');
  if (!federais.length) {
    raiz.innerHTML = `<p class="nacional-vazio"><b>Nenhum sandbox federal mapeado ainda.</b>Os programas de agências e órgãos federais entram aqui assim que forem verificados.</p>`;
    return;
  }
  const grupos = new Map();
  for (const s of federais) {
    const sigla = s.jurisdicao?.orgao || '';
    grupos.set(sigla, (grupos.get(sigla) ?? 0) + 1);
  }
  const max = Math.max(...grupos.values());
  const itens = [...grupos.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([sigla, n]) => {
      const o = (orgaos ?? []).find((x) => x.sigla === sigla);
      const nome = o?.nome || sigla || 'não informado';
      const alvo = sigla ? `data-filtro="orgao" data-valor="${escapar(sigla)}" aria-pressed="false"` : 'disabled';
      return `<li><button type="button" class="rank-item" ${alvo}>
        <span class="av" aria-hidden="true">${escapar((sigla || '?').slice(0, 5))}</span>
        <span class="meta"><span class="nm">${escapar(nome)}</span><span class="sub">${escapar(sigla || 'órgão não informado')}</span>
        <span class="bar"><i style="width:${Math.round((n / max) * 100)}%"></i></span></span>
        <span class="n" aria-label="${escapar(nSandboxes(n))}">${n}</span></button></li>`;
    });
  raiz.innerHTML = `<ol class="rank">${itens.join('')}</ol>`;
}

export function desenharRankingUf(raiz, porUf, limite = 8) {
  const lista = Object.entries(porUf).filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || (UF_NOME[a[0]] ?? a[0]).localeCompare(UF_NOME[b[0]] ?? b[0], 'pt-BR'));
  const max = lista.length ? lista[0][1] : 0;
  const resto = lista.length - limite;
  raiz.innerHTML = lista.slice(0, limite).map(([uf, n]) => `<li><button type="button" class="rank-item" data-filtro="uf" data-valor="${escapar(uf)}" aria-pressed="false">
      <span class="av" aria-hidden="true">${escapar(uf)}</span>
      <span class="meta"><span class="nm">${escapar(UF_NOME[uf] ?? uf)}</span><span class="sub">${escapar(UF_REGIAO[uf] ?? 'não informado')}</span>
      <span class="bar"><i style="width:${Math.round((n / max) * 100)}%"></i></span></span>
      <span class="n" aria-label="${escapar(nSandboxes(n))}">${n}</span></button></li>`).join('')
    + (resto > 0 ? `<li class="rank-mais">e mais ${plural(resto, 'estado', 'estados')} no mapa e no filtro Estado</li>` : '');
}
