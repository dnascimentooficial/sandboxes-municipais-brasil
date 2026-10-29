// Publicação: nada rastreado pelo Git sai pela web sem estar numa lista explícita de arquivos públicos
// ou coberto por uma regra de bloqueio do .htaccess. E o card escapa todo dado vindo da base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cartao } from '../../assets/js/ui/cartoes.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Público por decisão: arquivos exatos ou prefixos de pasta (terminados em /).
const PUBLICOS = [
  'index.html', '404.html', 'robots.txt', 'sitemap.xml', '.htaccess',
  'assets/', 'img/', 'og/',
  'data/sandboxes.js', 'data/temas.json', 'data/orgaos.json', 'data/verificacao.json',
  'api/indicar.php',
];
const publico = (p) => PUBLICOS.some((x) => (x.endsWith('/') ? p.startsWith(x) : p === x));

function arquivosRastreados() {
  const r = spawnSync('git', ['ls-files', '-z'], { cwd: raiz, encoding: 'utf8' });
  if (r.status === 0 && r.stdout) return r.stdout.split('\0').filter(Boolean);
  // Sem git (ex.: cópia exportada): varre a raiz, sem .git e node_modules.
  const saida = [];
  const andar = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n === '.git' || n === 'node_modules') continue;
      const c = join(dir, n);
      if (statSync(c).isDirectory()) andar(c);
      else saida.push(relative(raiz, c).split('\\').join('/'));
    }
  };
  andar(raiz);
  return saida;
}

// Regras de bloqueio do .htaccess da raiz: RewriteRule <regex> - [F...] e <FilesMatch "<regex>"> com "deny".
function regrasBloqueio() {
  const ht = readFileSync(join(raiz, '.htaccess'), 'utf8');
  const caminhos = [];
  for (const m of ht.matchAll(/^\s*RewriteRule\s+(\S+)\s+-\s+\[([^\]]*)\]/gm)) {
    const flags = m[2].split(',').map((f) => f.trim().toUpperCase());
    if (flags.includes('F')) caminhos.push(new RegExp(m[1], flags.includes('NC') ? 'i' : ''));
  }
  const nomes = [];
  for (const m of ht.matchAll(/<FilesMatch\s+"([^"]+)">([\s\S]*?)<\/FilesMatch>/g)) {
    if (/Require all denied|Deny from all/.test(m[2])) nomes.push(new RegExp(m[1]));
  }
  return { caminhos, nomes };
}

// api/.htaccess: nega tudo e libera só os <Files "x"> com "Require all granted".
function liberadosApi() {
  const ht = readFileSync(join(raiz, 'api', '.htaccess'), 'utf8');
  assert.match(ht, /^\s*Require all denied/m, 'api/.htaccess deve negar tudo por padrão');
  return [...ht.matchAll(/<Files\s+"([^"]+)">\s*Require all granted/g)].map((m) => m[1]);
}

test('M12a: todo arquivo rastreado é público por decisão ou bloqueado pelo .htaccess', () => {
  const { caminhos, nomes } = regrasBloqueio();
  assert.ok(caminhos.length > 0 && nomes.length > 0, 'regras de bloqueio não encontradas no .htaccess');
  const api = liberadosApi();
  const bloqueado = (p) => {
    if (caminhos.some((re) => re.test(p))) return true;
    if (nomes.some((re) => re.test(basename(p)))) return true;
    if (p.startsWith('api/') && !api.includes(p.slice(4))) return true;
    return false;
  };
  const expostos = arquivosRastreados().filter((p) => !publico(p) && !bloqueado(p));
  assert.deepEqual(expostos, [], `arquivos acessíveis sem estar na lista pública: ${expostos.join(', ')}`);
});

test('M12a: a lista pública não vaza o que deveria ser bloqueado', () => {
  const { caminhos } = regrasBloqueio();
  for (const p of ['data/sandboxes/curitiba.json', 'rotina/x.md', 'scripts/build-dados.mjs', 'docs/a.md', '.github/workflows/ci.yml']) {
    assert.ok(caminhos.some((re) => re.test(p)), `${p} deveria estar bloqueado`);
  }
  for (const p of ['data/sandboxes.js', 'data/temas.json', 'assets/js/app.js', 'og/sandboxes.jpg']) {
    assert.ok(!caminhos.some((re) => re.test(p)), `${p} não deveria estar bloqueado`);
  }
  assert.deepEqual(liberadosApi(), ['indicar.php']);
});

test('M12b: cartao() escapa nome, resumo, sigla e id maliciosos', () => {
  const mal = '"><img src=x onerror=alert(1)>';
  const html = cartao({
    id: `x" onmouseover="alert(1)`,
    nome: `<script>alert('n')</script>`,
    resumo: mal,
    esfera: 'federal',
    status: '<blink>',
    jurisdicao: { orgao: '<svg/onload=alert(2)>' },
    temas: ['<marquee>'],
  }, { temas: [{ id: '<marquee>', nome: '<u>tema</u>', icone: '<em>', cor: 'red;background:url(x)' }], orgaos: [], noComparar: true });
  for (const cru of ['<script', '<img', '<svg', '<u>', '<em>', '<blink>', '<marquee>', 'onmouseover="', 'url(x)']) {
    assert.ok(!html.includes(cru), `trecho sem escape: ${cru}`);
  }
  assert.ok(html.includes('&lt;script&gt;alert(&#39;n&#39;)&lt;/script&gt;'));
  assert.ok(html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;svg/onload=alert(2)&gt;'));
  assert.ok(html.includes('data-id="x&quot; onmouseover=&quot;alert(1)"'));
  // Atributos sempre entre aspas: nenhum valor de atributo começa sem aspas.
  // Dados escapados não contêm < nem >, então cada <tag ...> abaixo é marcação real do template.
  for (const tag of html.match(/<[a-z][^>]*>/g)) {
    assert.ok(!/=\s*[^"\s]/.test(tag.replace(/="[^"]*"/g, '=""')), `atributo sem aspas em ${tag}`);
  }
  assert.ok(!html.includes('aria-pressed'), 'o botão Comparar navega, não alterna');
  assert.match(html, /aria-label="Na comparação: &lt;script&gt;/);
});
