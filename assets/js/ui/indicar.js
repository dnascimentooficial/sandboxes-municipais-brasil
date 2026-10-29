// Modal "Indicar um sandbox". montarIndicacao(dialog) -> {abrir(), fechar()}.
//
// Protocolo do Radar IA Governos: GET api/indicar.php?token=1 -> {token}; POST JSON
// {token, nome_sandbox, jurisdicao, fonte_url, observacao?, contato_nome?, contato_email?, consentimento, site}
// -> {ok:true} | {ok:false, motivo:'limite'|'token'|'invalido'|'indisponivel'}. `site` é armadilha para robôs.
//
// O <dialog> é aberto com showModal() (o resto da página fica inerte); o Tab circula dentro dele,
// Esc e o clique no fundo fecham, e o foco volta para quem abriu. Nada do que o usuário digita
// volta para o HTML: mensagens entram por textContent.

export const LIMITES = {
  nome_sandbox: 200,
  jurisdicao: 200,
  fonte_url: 500,
  observacao: 2000,
  contato_nome: 200,
  contato_email: 254,
};

const OBRIGATORIOS = ['nome_sandbox', 'jurisdicao', 'fonte_url'];

export const SUCESSO = 'Indicação enviada! Ela será verificada antes de entrar na base.';

// Textos do Radar (trocando "experiência" por "sandbox" onde aparecia).
export const MENSAGENS = {
  limite: 'Recebemos muitas indicações da sua rede em pouco tempo. Tente novamente mais tarde.',
  token: 'A sessão do formulário expirou. Envie de novo.',
  invalido: 'Alguns campos precisam de ajuste. Revise os destacados.',
  indisponivel: 'O serviço de indicações está indisponível no momento. Tente mais tarde.',
  revisar: 'Revise os campos destacados em vermelho.',
  rede: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  padrao: 'Não foi possível enviar agora. Tente novamente em instantes.',
};

export function mensagemFalha(motivo) {
  return Object.hasOwn(MENSAGENS, motivo ?? '') ? MENSAGENS[motivo] : MENSAGENS.padrao;
}

export function urlOk(s) {
  if (typeof s !== 'string' || !s || s.length > LIMITES.fonte_url) return false;
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.indexOf('.') > 0;
  } catch {
    return false;
  }
}

export function emailOk(s) {
  return typeof s === 'string' && s.length <= LIMITES.contato_email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

// bruto: {campo: string, consentimento: boolean, site: string}. -> {dados, erros:{campo: mensagem}}
export function validarIndicacao(bruto = {}) {
  const dados = {};
  for (const c of Object.keys(LIMITES)) dados[c] = String(bruto[c] ?? '').trim();
  dados.consentimento = bruto.consentimento === true;
  dados.site = String(bruto.site ?? '');

  const erros = {};
  for (const c of Object.keys(LIMITES)) {
    if (OBRIGATORIOS.includes(c) && !dados[c]) erros[c] = 'Preencha este campo.';
    else if (dados[c].length > LIMITES[c]) erros[c] = `Use no máximo ${LIMITES[c]} caracteres.`;
  }
  if (!erros.fonte_url && !urlOk(dados.fonte_url)) erros.fonte_url = 'Use o endereço completo, começando com https://';
  if (!erros.contato_email && dados.contato_email && !emailOk(dados.contato_email)) erros.contato_email = 'E-mail inválido.';
  if (!dados.consentimento) erros.consentimento = 'É preciso aceitar para enviar.';
  return { dados, erros };
}

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function montarIndicacao(dialog) {
  if (!dialog) return { abrir() {}, fechar() {} };
  const doc = dialog.ownerDocument;
  const q = (sel) => dialog.querySelector(sel);
  const form = q('#ind-form');
  const ok = q('#ind-ok');
  const erroGeral = q('#ind-erro');
  const btn = q('#ind-enviar');
  const rotuloBtn = btn.textContent;

  const st = { token: '', pedido: null, enviando: false, foco: null };
  const api = (extra = '') => new URL(`api/indicar.php${extra}`, doc.location.href).toString();

  // Um pedido de token por vez: um segundo GET regeneraria a sessão e invalidaria o primeiro.
  function pegarToken() {
    if (!st.pedido) {
      const p = fetch(api('?token=1'), { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => r.json())
        .then((j) => (j && typeof j.token === 'string' ? j.token : ''))
        .catch(() => '');
      st.pedido = p;
      p.then((t) => {
        if (st.pedido === p) {
          st.token = t;
          st.pedido = null;
        }
      });
    }
    return st.pedido;
  }

  function mostrarErroGeral(msg) {
    erroGeral.textContent = msg || '';
    erroGeral.hidden = !msg;
  }

  function marcar(campo, msg) {
    const e = q(`#e-${campo}`);
    const ctl = form.elements[campo];
    if (e) {
      e.textContent = msg || '';
      e.hidden = !msg;
      e.closest('[data-campo]')?.classList.toggle('invalido', !!msg);
    }
    if (ctl) ctl.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function limparErros() {
    for (const c of [...Object.keys(LIMITES), 'consentimento']) marcar(c, '');
    mostrarErroGeral('');
  }

  function coletar() {
    const el = form.elements;
    const bruto = {};
    for (const c of Object.keys(LIMITES)) bruto[c] = el[c]?.value ?? '';
    bruto.consentimento = !!el.consentimento?.checked;
    bruto.site = el.site?.value ?? '';
    return bruto;
  }

  function mostrarFormulario() {
    form.hidden = false;
    ok.hidden = true;
  }

  function abrir() {
    if (dialog.open) return;
    st.foco = doc.activeElement;
    mostrarFormulario();
    limparErros();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    form.elements.nome_sandbox?.focus();
    if (!st.token) pegarToken();
  }

  function fechar() {
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      aoFechar();
    }
  }

  function aoFechar() {
    if (!ok.hidden) {
      form.reset();
      mostrarFormulario();
    }
    const alvo = st.foco;
    st.foco = null;
    if (alvo && doc.contains(alvo) && typeof alvo.focus === 'function') alvo.focus();
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (st.enviando) return;
    limparErros();
    const { dados, erros } = validarIndicacao(coletar());
    const campos = Object.keys(erros);
    if (campos.length) {
      for (const c of campos) marcar(c, erros[c]);
      mostrarErroGeral(MENSAGENS.revisar);
      form.elements[campos[0]]?.focus();
      return;
    }

    st.enviando = true;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    form.setAttribute('aria-busy', 'true');
    try {
      const token = st.token || (await pegarToken());
      if (!token) {
        mostrarErroGeral(MENSAGENS.indisponivel);
        return;
      }
      st.token = ''; // uso único: qualquer resposta consome o token
      const r = await fetch(api(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, ...dados }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && j.ok === true) {
        form.hidden = true;
        ok.hidden = false;
        q('#ind-ok-msg')?.focus();
        return;
      }
      mostrarErroGeral(mensagemFalha(j && j.motivo));
    } catch {
      mostrarErroGeral(MENSAGENS.rede);
    } finally {
      st.enviando = false;
      btn.disabled = false;
      btn.textContent = rotuloBtn;
      form.removeAttribute('aria-busy');
    }
  }

  form.addEventListener('submit', enviar);
  // Erro de um campo some assim que ele é corrigido.
  form.addEventListener('input', (ev) => {
    const nome = ev.target?.name;
    if (nome && ev.target.getAttribute('aria-invalid') === 'true') marcar(nome, '');
  });
  form.addEventListener('change', (ev) => {
    if (ev.target?.name === 'consentimento' && ev.target.checked) marcar('consentimento', '');
  });

  dialog.addEventListener('click', (ev) => {
    if (ev.target === dialog || ev.target.closest('[data-fechar-modal]')) fechar();
  });
  dialog.addEventListener('close', aoFechar);
  dialog.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab') return;
    const itens = [...dialog.querySelectorAll(FOCAVEIS)].filter((n) => n.getClientRects().length);
    if (!itens.length) return;
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    const ativo = doc.activeElement;
    if (ev.shiftKey && (ativo === primeiro || !dialog.contains(ativo))) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && (ativo === ultimo || !dialog.contains(ativo))) {
      ev.preventDefault();
      primeiro.focus();
    }
  });

  return { abrir, fechar };
}
