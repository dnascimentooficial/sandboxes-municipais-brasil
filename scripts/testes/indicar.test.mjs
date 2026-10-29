import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarIndicacao, mensagemFalha, urlOk, emailOk, MENSAGENS, LIMITES } from '../../assets/js/ui/indicar.js';

const base = { nome_sandbox: ' Sandbox X ', jurisdicao: 'Curitiba (PR)', fonte_url: 'https://www.curitiba.pr.gov.br/lei', consentimento: true, site: '' };

test('indicação mínima válida, com campos aparados', () => {
  const { dados, erros } = validarIndicacao(base);
  assert.deepEqual(erros, {});
  assert.equal(dados.nome_sandbox, 'Sandbox X');
  assert.equal(dados.contato_email, '');
  assert.equal(dados.consentimento, true);
});

test('obrigatórios, URL, e-mail, consentimento e tetos', () => {
  const { erros } = validarIndicacao({ fonte_url: 'javascript:alert(1)', contato_email: 'x@', observacao: 'a'.repeat(LIMITES.observacao + 1) });
  assert.deepEqual(Object.keys(erros).sort(), ['consentimento', 'contato_email', 'fonte_url', 'jurisdicao', 'nome_sandbox', 'observacao']);
  assert.equal(validarIndicacao({ ...base, fonte_url: 'ftp://x.org/a' }).erros.fonte_url, 'Use o endereço completo, começando com https://');
  assert.equal(validarIndicacao({ ...base, consentimento: 'on' }).erros.consentimento, 'É preciso aceitar para enviar.');
});

test('urlOk e emailOk', () => {
  assert.equal(urlOk('http://a.gov.br'), true);
  assert.equal(urlOk('https://localhost/x'), false);
  assert.equal(urlOk('https://a.org/' + 'x'.repeat(LIMITES.fonte_url)), false);
  assert.equal(emailOk('a@b.com.br'), true);
  assert.equal(emailOk('a b@c.com'), false);
});

test('mensagens por motivo, sem "experiência"', () => {
  for (const m of ['limite', 'token', 'invalido', 'indisponivel']) assert.equal(mensagemFalha(m), MENSAGENS[m]);
  assert.equal(mensagemFalha('xyz'), MENSAGENS.padrao);
  assert.equal(mensagemFalha(undefined), MENSAGENS.padrao);
  assert.equal(mensagemFalha('constructor'), MENSAGENS.padrao);
  assert.ok(Object.values(MENSAGENS).every((t) => !/experi[eê]ncia/i.test(t)));
});
