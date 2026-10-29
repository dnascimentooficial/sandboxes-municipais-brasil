import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checarLinks, coletarUrls, classificar } from '../checar-links.mjs';

const resp = (status) => ({ status, ok: status >= 200 && status < 400 });

test('200, 404 e timeout dão ok true, false, false', async () => {
  const fetchFn = async (url, opts) => {
    if (url.endsWith('/ok')) return resp(200);
    if (url.endsWith('/404')) return resp(404);
    // simula timeout: só rejeita quando o sinal aborta
    return new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('abortado'))));
  };
  const r = await checarLinks(['https://a.test/ok', 'https://a.test/404', 'https://a.test/lento'], { fetchFn, timeoutMs: 20 });
  assert.deepEqual(r.map((x) => x.ok), [true, false, false]);
  assert.equal(r[0].status, 200);
  assert.equal(r[1].status, 404);
  assert.equal(r[2].status, 0);
});

test('405 no HEAD faz um GET', async () => {
  const chamadas = [];
  const fetchFn = async (url, opts) => {
    chamadas.push(opts.method);
    return resp(opts.method === 'HEAD' ? 405 : 200);
  };
  const [r] = await checarLinks(['https://a.test/x'], { fetchFn });
  assert.deepEqual(chamadas, ['HEAD', 'GET']);
  assert.equal(r.ok, true);
});

test('403 no HEAD também tenta GET; GET 403 permanece falha', async () => {
  const chamadas = [];
  const fetchFn = async (url, opts) => { chamadas.push(opts.method); return resp(403); };
  const [r] = await checarLinks(['https://a.test/x'], { fetchFn });
  assert.deepEqual(chamadas, ['HEAD', 'GET']);
  assert.deepEqual([r.ok, r.status], [false, 403]);
});

test('no máximo 8 requisições em paralelo', async () => {
  let ativas = 0, pico = 0;
  const fetchFn = async () => {
    pico = Math.max(pico, ++ativas);
    await new Promise((r) => setTimeout(r, 5));
    ativas--;
    return resp(200);
  };
  const urls = Array.from({ length: 30 }, (_, i) => `https://a.test/${i}`);
  const r = await checarLinks(urls, { fetchFn });
  assert.equal(r.length, 30);
  assert.ok(pico <= 8 && pico > 1, `pico ${pico}`);
  assert.deepEqual(r.map((x) => x.url), urls);
});

test('coletarUrls reúne todos os campos de URL, sem duplicar e ignorando não-http', () => {
  const s = {
    documentos: [{ url: 'https://d.test/1' }],
    fontes: [{ url: 'https://f.test/1' }, { url: 'https://d.test/1' }],
    solucoes: [{ fonte: 'https://s.test/1' }, { fonte: 'Resolução 12' }, {}],
    editais: [{ url: 'https://e.test/1' }],
    historico: [{ fonte: 'https://h.test/1' }],
    imagem: { origem: 'https://i.test/1' },
  };
  assert.deepEqual(
    coletarUrls([s, { fontes: [{ url: 'https://f.test/1' }] }]).sort(),
    ['https://d.test/1', 'https://e.test/1', 'https://f.test/1', 'https://h.test/1', 'https://i.test/1', 'https://s.test/1'],
  );
});

test('classificar separa hosts anti-bot (aviso manual) dos demais', () => {
  assert.equal(classificar({ url: 'https://www.leismunicipais.com.br/a', ok: false, status: 403 }), 'notice');
  assert.equal(classificar({ url: 'https://leis.org/x', ok: false, status: 503 }), 'notice');
  assert.equal(classificar({ url: 'https://www2.aneel.gov.br/x', ok: false, status: 403 }), 'notice');
  assert.equal(classificar({ url: 'https://x.gov.br/x', ok: false, status: 404 }), 'warning');
  assert.equal(classificar({ url: 'https://x.gov.br/x', ok: true, status: 200 }), null);
});
