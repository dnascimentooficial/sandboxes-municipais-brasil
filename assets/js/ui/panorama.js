// Aba Panorama: hero, números, barra de status, eixos, mapa, filtros e lista de cards.
// montarPanorama(raiz, ctx) -> {render(estado)}. `raiz` é o document (ou um contêiner com os ids do index.html).
//
// Números, barra de status, eixos e mapa mostram a base inteira (contar() sobre todos os sandboxes) e só
// marcam o filtro ativo; a lista, o contador e o anel do cabeçalho mostram o recorte filtrado.
// Partes estáticas são desenhadas uma vez (preserva o foco); render() só atualiza estados e a lista.
import { ESFERAS, STATUS, REGIOES, UF_REGIAO } from '../esquema.js';
import { filtrar, ordenar, contar } from '../filtros.js';
import { escapar, rotulo, dataBR } from '../formatar.js';
import { UF_NOME, plural, desenharMapa, desenharRankingUf } from './mapa.js';
import { desenharNacional } from './nacional.js';
import { cartao, corSegura } from './cartoes.js';

const FILTROS_VAZIOS = { esfera: '', status: '', regiao: '', uf: '', tema: '', orgao: '' };
const ROTULO_FILTRO = { esfera: 'Esfera', status: 'Status', regiao: 'Região', uf: 'Estado', tema: 'Eixo', orgao: 'Órgão' };
const KPI_STATUS = { ativo: 'Ativos', regulamentado: 'Regulamentados', em_instituicao: 'Em instituição', encerrado: 'Encerrados' };
const DESC_STATUS = {
  ativo: 'Com solução em teste ou já testada, documentada.',
  regulamentado: 'Norma publicada, sem teste documentado.',
  em_instituicao: 'Em criação: projeto de lei, consulta ou chamada preparatória.',
  encerrado: 'Programa encerrado ou revogado.',
};
const ESFERA_ABREV = { federal: 'F', estadual: 'E', municipal: 'M' };
const nSandboxes = (n) => plural(n, 'sandbox', 'sandboxes');

function linhaEsferas(porEsfera) {
  const ordem = ['federal', 'estadual', 'municipal'];
  const visivel = ordem.map((e) => `<abbr title="${escapar(rotulo('esfera', e))}">${ESFERA_ABREV[e]}</abbr> <b>${porEsfera[e] ?? 0}</b>`).join(' · ');
  const falado = ordem.map((e) => `${rotulo('esfera', e)}: ${porEsfera[e] ?? 0}`).join(', ');
  return `<p class="kpi-sub"><span aria-hidden="true">${visivel}</span><span class="sr-only">${escapar(falado)}</span></p>`;
}

export function montarPanorama(raiz, ctx) {
  const $ = (id) => raiz.querySelector(`#${id}`);
  const { meta = {}, temas = [], orgaos = [], sandboxes = [] } = ctx.dados;
  const c = contar(sandboxes);
  const nomeTema = (id) => temas.find((t) => t.id === id)?.nome ?? id;

  // ---------- Hero e rodapé ----------
  const base = dataBR(meta.atualizacaoBase);
  $('hero-base').textContent = `Base verificada em ${base}`;
  $('rodape-meta').textContent = `${nSandboxes(c.total)} · base verificada em ${base}`;

  // ---------- Números ----------
  $('numeros').innerHTML = [
    `<div class="kpi hot"><span class="kpi-lbl">Sandboxes mapeados</span><span class="kpi-val">${c.total}</span>${linhaEsferas(c.porEsfera)}</div>`,
    ...STATUS.map((st) => `<div class="kpi"><span class="kpi-lbl"><span class="dot cor-${st}" aria-hidden="true"></span>${escapar(KPI_STATUS[st])}</span>
      <span class="kpi-val">${c.porStatus[st]}</span>${linhaEsferas(c.porStatusEsfera[st])}</div>`),
  ].join('');

  // ---------- Barra de status ----------
  const pct = (n) => (c.total ? (n / c.total) * 100 : 0);
  $('status-painel').innerHTML = `
    <div class="stack-bar" aria-hidden="true">${STATUS.map((st) => `<span class="cor-${st}" style="width:${pct(c.porStatus[st]).toFixed(2)}%"></span>`).join('')}</div>
    <div class="stage-list">${STATUS.map((st) => {
      const n = c.porStatus[st];
      return `<button type="button" class="stage-row" data-filtro="status" data-valor="${st}" aria-pressed="false"${n ? '' : ' disabled'}>
        <span class="badge st-${st}"><span class="bdot" aria-hidden="true"></span>${escapar(rotulo('status', st))}</span>
        <span class="desc">${escapar(DESC_STATUS[st])}</span>
        <span class="num">${n} <small>· ${Math.round(pct(n))}%</small></span>
        <span class="bar" aria-hidden="true"><i class="cor-${st}" style="width:${pct(n).toFixed(2)}%"></i></span>
      </button>`;
    }).join('')}</div>`;

  // ---------- Eixos ----------
  const maxTema = Math.max(1, ...temas.map((t) => c.porTema[t.id] ?? 0));
  const temasOrdenados = [...temas].sort((a, b) => (c.porTema[b.id] ?? 0) - (c.porTema[a.id] ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  $('temas-grade').innerHTML = temasOrdenados.filter((t) => c.porTema[t.id]).map((t) => {
    const n = c.porTema[t.id] ?? 0;
    const cor = corSegura(t.cor);
    return `<button type="button" class="eixo-tile" data-filtro="tema" data-valor="${escapar(t.id)}" aria-pressed="false"${cor ? ` style="background:${cor}"` : ''}>
      <span class="eixo-top"><span class="eixo-ico" aria-hidden="true">${escapar(t.icone ?? '')}</span><span class="eixo-name">${escapar(t.nome)}</span><b class="eixo-n" aria-label="${escapar(nSandboxes(n))}">${n}</b></span>
      <span class="eixo-bar" aria-hidden="true"><i style="width:${Math.round((n / maxTema) * 100)}%"></i></span>
    </button>`;
  }).join('');
  const semEixo = sandboxes.filter((s) => !s.temas?.length).length;
  const semSandbox = temasOrdenados.filter((t) => !c.porTema[t.id]).map((t) => t.nome);
  const notas = [];
  if (semEixo) notas.push(`${nSandboxes(semEixo)} sem eixo definido.`);
  if (semSandbox.length) notas.push(`Ainda sem sandbox: ${semSandbox.join(', ')}.`);
  $('temas-nota').hidden = notas.length === 0;
  $('temas-nota').textContent = notas.join(' ');

  // ---------- Mapa, âmbito nacional e ranking ----------
  desenharMapa($('mapa'), $('mapa-legenda'), c.porUf);
  desenharNacional($('nacional'), sandboxes, orgaos, { aoAbrir: (id) => ctx.abrirSandbox(id) });
  desenharRankingUf($('ranking-uf'), c.porUf);
  $('ranking-titulo').hidden = Object.keys(c.porUf).length === 0;

  // ---------- Painel de filtros ----------
  const chip = (chave, valor, texto, n) =>
    `<button type="button" class="chip" data-filtro="${chave}" data-valor="${escapar(valor)}" aria-pressed="false">${escapar(texto)}${n === undefined ? '' : ` <small>${n}</small>`}</button>`;
  const porRegiao = Object.fromEntries(REGIOES.map((r) => [r, sandboxes.filter((s) => s.jurisdicao?.regiao === r).length]));
  const ufsOrdenadas = Object.keys(UF_NOME).sort((a, b) => UF_NOME[a].localeCompare(UF_NOME[b], 'pt-BR'));
  const federais = sandboxes.filter((s) => s.esfera === 'federal');
  const orgaosUsados = [...new Set(federais.map((s) => s.jurisdicao?.orgao).filter(Boolean))].sort();
  const opcoesOrgao = orgaosUsados.length
    ? `<option value="">Todos os órgãos</option>${orgaosUsados.map((o) => {
      const nome = orgaos.find((x) => x.sigla === o)?.nome;
      const n = federais.filter((s) => s.jurisdicao?.orgao === o).length;
      return `<option value="${escapar(o)}">${escapar(nome ? `${o} — ${nome}` : o)} (${n})</option>`;
    }).join('')}`
    : '<option value="">Nenhum órgão federal mapeado</option>';

  $('filtros-corpo').innerHTML = `
    <div class="sb-section"><span class="sb-label" id="lbl-esfera">Esfera</span>
      <div class="btn-grid" role="group" aria-labelledby="lbl-esfera">${chip('esfera', '', 'Todas')}${ESFERAS.map((e) => chip('esfera', e, rotulo('esfera', e), c.porEsfera[e])).join('')}</div></div>
    <div class="sb-section"><span class="sb-label" id="lbl-status">Status</span>
      <div class="row-list" role="group" aria-labelledby="lbl-status">${STATUS.map((st) => `<button type="button" class="f-row" data-filtro="status" data-valor="${st}" aria-pressed="false"${c.porStatus[st] ? '' : ' disabled'}>
        <span class="dot cor-${st}" aria-hidden="true"></span><span class="name">${escapar(rotulo('status', st))}</span><span class="count">${c.porStatus[st]}</span></button>`).join('')}</div></div>
    <div class="sb-section"><span class="sb-label" id="lbl-regiao">Região</span>
      <div class="btn-grid" role="group" aria-labelledby="lbl-regiao">${chip('regiao', '', 'Todas')}${REGIOES.map((r) => chip('regiao', r, r, porRegiao[r])).join('')}</div>
      <p class="sb-hint">Filtrar por região ou estado deixa de fora os sandboxes federais.</p></div>
    <div class="sb-section"><label class="sb-label" for="f-uf">Estado</label>
      <select id="f-uf" class="sb-sel" data-filtro-sel="uf"><option value="">Todos os estados</option>${ufsOrdenadas.map((uf) => {
        const n = c.porUf[uf] ?? 0;
        return `<option value="${uf}"${n ? '' : ' disabled'}>${escapar(UF_NOME[uf])} (${n})</option>`;
      }).join('')}</select></div>
    <div class="sb-section"><span class="sb-label" id="lbl-tema">Eixo temático</span>
      <div class="row-list" role="group" aria-labelledby="lbl-tema">${temasOrdenados.map((t) => {
        const n = c.porTema[t.id] ?? 0;
        return `<button type="button" class="f-row" data-filtro="tema" data-valor="${escapar(t.id)}" aria-pressed="false"${n ? '' : ' disabled'}>
          <span class="ico" aria-hidden="true">${escapar(t.icone ?? '')}</span><span class="name">${escapar(t.nome)}</span><span class="count">${n}</span></button>`;
      }).join('')}</div></div>
    <div class="sb-section"><label class="sb-label" for="f-orgao">Órgão federal</label>
      <select id="f-orgao" class="sb-sel" data-filtro-sel="orgao"${orgaosUsados.length ? '' : ' disabled'}>${opcoesOrgao}</select></div>
    <div class="sb-foot"><button type="button" class="btn-clear" data-limpar>Limpar filtros</button></div>`;

  // ---------- Interação ----------
  function aplicarFiltro(chave, valor, alternar) {
    const atual = ctx.estado().filtros;
    const v = alternar && atual[chave] === valor ? '' : valor;
    const patch = { [chave]: v };
    if (chave === 'uf' && v) patch.regiao = '';
    if (chave === 'regiao' && v && atual.uf && UF_REGIAO[atual.uf] !== v) patch.uf = '';
    if (ctx.estado().aba !== 'panorama') ctx.irPara({ aba: 'panorama' });
    ctx.atualizar({ filtros: patch });
  }
  const busca = $('busca');
  function rolarParaLista() {
    const bloco = $('lista-bloco');
    if (!bloco) return;
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cab = $('hdr')?.offsetHeight ?? 0;
    const topo = bloco.getBoundingClientRect().top + window.scrollY - cab - 12;
    window.scrollTo({ top: Math.max(0, topo), behavior: reduzir ? 'auto' : 'smooth' });
  }
  function limpar() {
    busca.value = '';
    ctx.atualizar({ filtros: { ...FILTROS_VAZIOS }, termo: '' });
  }

  // Só o Panorama e o painel de filtros respondem a [data-filtro]: a gaveta e o Comparar ficam de fora.
  const areas = [$('view-panorama'), $('filtros')].filter(Boolean);
  const naArea = (el) => areas.some((a) => a.contains(el));
  raiz.addEventListener('click', (ev) => {
    if (!naArea(ev.target)) return;
    const alvo = ev.target.closest?.('[data-filtro]');
    if (alvo && !alvo.disabled) {
      aplicarFiltro(alvo.dataset.filtro, alvo.dataset.valor ?? '', true);
      // "Mostrar só X na lista" (Âmbito nacional): leva a lista à vista; o contador aria-live anuncia o recorte.
      if (alvo.matches('.nac-filtrar') && ctx.estado().filtros.orgao) rolarParaLista();
      return;
    }
    const rem = ev.target.closest?.('[data-remover-filtro]');
    if (rem) {
      const chave = rem.dataset.removerFiltro;
      if (chave === 'termo') { busca.value = ''; ctx.atualizar({ termo: '' }); } else ctx.atualizar({ filtros: { [chave]: '' } });
      return;
    }
    if (ev.target.closest?.('[data-limpar]')) return limpar();
  });
  raiz.addEventListener('change', (ev) => {
    if (!naArea(ev.target)) return;
    const sel = ev.target.closest?.('[data-filtro-sel]');
    if (sel) aplicarFiltro(sel.dataset.filtroSel, sel.value, false);
  });
  $('ordem').addEventListener('change', (ev) => ctx.atualizar({ ordem: ev.target.value }));
  busca.addEventListener('input', () => {
    if (ctx.estado().aba !== 'panorama') ctx.irPara({ aba: 'panorama' });
    ctx.atualizar({ termo: busca.value });
  });
  raiz.addEventListener('keydown', (ev) => {
    if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target;
    if (t.closest?.('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
    ev.preventDefault();
    busca.focus();
  });

  // Lista: card inteiro abre o detalhe; botões têm ações próprias.
  $('lista').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao]');
    if (b) {
      if (b.dataset.acao === 'comparar') ctx.pedirComparar(b.dataset.id);
      else ctx.abrirSandbox(b.dataset.id);
      return;
    }
    const card = ev.target.closest('.sb-card');
    if (card && !window.getSelection?.().toString()) ctx.abrirSandbox(card.dataset.id);
  });

  // Painel de filtros em tela estreita (gaveta à esquerda).
  const painel = $('filtros');
  const fundo = $('filtros-fundo');
  const btnAbrir = $('btn-abrir-filtros');
  // Aberto, vira diálogo modal: role/aria-modal no painel e o resto da página (#hdr, #main) fica inert.
  const foraDoPainel = [$('hdr'), $('main')].filter(Boolean);
  function painelAberto(aberto) {
    const estava = painel.classList.contains('aberto');
    painel.classList.toggle('aberto', aberto);
    fundo.hidden = !aberto;
    btnAbrir.setAttribute('aria-expanded', String(aberto));
    if (aberto) {
      painel.setAttribute('role', 'dialog');
      painel.setAttribute('aria-modal', 'true');
      painel.setAttribute('aria-label', 'Filtros');
    } else {
      painel.removeAttribute('role');
      painel.removeAttribute('aria-modal');
    }
    for (const n of foraDoPainel) n.inert = aberto;
    if (aberto) $('btn-fechar-filtros').focus();
    else if (estava && (painel.contains(document.activeElement) || document.activeElement === document.body)) btnAbrir.focus();
  }
  btnAbrir.addEventListener('click', () => painelAberto(true));
  $('btn-fechar-filtros').addEventListener('click', () => painelAberto(false));
  fundo.addEventListener('click', () => painelAberto(false));
  raiz.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && painel.classList.contains('aberto')) painelAberto(false);
  });
  // Tela alargou além do breakpoint com o painel aberto: ele volta a ser barra lateral, sem modal nem inert.
  window.matchMedia?.('(min-width: 1025px)').addEventListener?.('change', (mq) => {
    if (mq.matches && painel.classList.contains('aberto')) painelAberto(false);
  });

  // ---------- Render ----------
  const anelArco = $('anel-arco');
  let chaveLista = null;
  let contadorAtual = null;
  function render(e) {
    const f = e.filtros;
    // estados ativos
    for (const el of raiz.querySelectorAll('[data-filtro]')) {
      el.setAttribute('aria-pressed', String((f[el.dataset.filtro] ?? '') === (el.dataset.valor ?? '')));
    }
    for (const sel of raiz.querySelectorAll('[data-filtro-sel]')) sel.value = f[sel.dataset.filtroSel] ?? '';
    $('ordem').value = e.ordem;
    if (busca.value !== e.termo && document.activeElement !== busca) busca.value = e.termo;

    // filtros ativos
    const ativos = Object.entries(f).filter(([, v]) => v);
    const texto = { esfera: (v) => rotulo('esfera', v), status: (v) => rotulo('status', v), regiao: (v) => v,
      uf: (v) => UF_NOME[v] ?? v, tema: nomeTema, orgao: (v) => v };
    const pilulas = ativos.map(([k, v]) => {
      const t = `${ROTULO_FILTRO[k]}: ${texto[k](v)}`;
      return `<span class="af"><b>${escapar(ROTULO_FILTRO[k])}</b>${escapar(texto[k](v))}<button type="button" data-remover-filtro="${k}" aria-label="Remover filtro ${escapar(t)}">✕</button></span>`;
    });
    if (e.termo) pilulas.unshift(`<span class="af"><b>Busca</b>“${escapar(e.termo)}”<button type="button" data-remover-filtro="termo" aria-label="Limpar busca">✕</button></span>`);
    if (pilulas.length) pilulas.push('<button type="button" class="af-limpar" data-limpar>Limpar tudo</button>');
    $('filtros-ativos').innerHTML = pilulas.join('');
    const nAtivos = ativos.length + (e.termo ? 1 : 0);
    $('filtros-contagem').hidden = nAtivos === 0;
    $('filtros-contagem').textContent = String(nAtivos);

    // lista: só redesenha quando o recorte ou o Comparar mudam (abrir a gaveta não destrói o foco do card)
    const chave = JSON.stringify([f, e.termo, e.ordem, e.comparar]);
    if (chave === chaveLista) return;
    chaveLista = chave;
    const recorte = ordenar(filtrar(sandboxes, { ...f, termo: e.termo }, temas), e.ordem);
    const contador = `Mostrando <b>${recorte.length}</b> de ${nSandboxes(c.total)}`;
    if (contador !== contadorAtual) {
      contadorAtual = contador; // evita repetir o anúncio do aria-live
      $('contador').innerHTML = contador;
    }
    const noComparar = new Set(e.comparar);
    $('lista').innerHTML = recorte.map((s) => cartao(s, { temas, orgaos, noComparar: noComparar.has(s.id) })).join('');
    $('lista').hidden = recorte.length === 0;
    $('vazio').hidden = recorte.length !== 0;

    // anel do cabeçalho: ativos no recorte
    const ativosRecorte = recorte.filter((s) => s.status === 'ativo').length;
    const p = recorte.length ? ativosRecorte / recorte.length : 0;
    $('anel-num').textContent = String(ativosRecorte);
    $('anel-den').textContent = String(recorte.length);
    $('anel-pct').textContent = `${Math.round(p * 100)}%`;
    anelArco.style.strokeDashoffset = String(97.4 * (1 - p));
  }

  return { render };
}
