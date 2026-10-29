<?php
// Sandboxes Brasil — recebe a indicação de um sandbox que ainda não está na base.
//
// Protocolo (o mesmo do Radar IA Governos):
//   GET  indicar.php?token=1  -> {"token":"..."}  (token de sessão, uso único, válido por 30 min)
//   POST indicar.php  JSON {token, nome_sandbox, jurisdicao, fonte_url, observacao?, contato_nome?,
//                           contato_email?, consentimento:true, site:''}
//        -> {"ok":true} | {"ok":false,"motivo":"limite"|"token"|"invalido"|"indisponivel"}
//
// `site` é armadilha para robôs: preenchido, a resposta é {"ok":true} e nada acontece.
// Os dados de contato vão só no corpo do e-mail para o Júlio; o registro em disco não os guarda.
// Configuração em api/config.php (não versionado; ver api/config.example.php).

declare(strict_types=1);

const TOKEN_VALIDADE = 1800;   // 30 min
const LIMITE_ENVIOS = 5;       // por IP...
const LIMITE_JANELA = 3600;    // ...por hora
const CORPO_MAX = 16384;       // bytes do JSON recebido

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Robots-Tag: noindex');

function responder(int $status, array $corpo): never
{
    http_response_code($status);
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function falhar(string $motivo): never
{
    $status = ['limite' => 429, 'token' => 400, 'invalido' => 400, 'indisponivel' => 503][$motivo] ?? 400;
    responder($status, ['ok' => false, 'motivo' => $motivo]);
}

// Remove CR/LF e demais caracteres de controle: para tudo que puder chegar a um cabeçalho.
function semQuebras(string $s): string
{
    return trim((string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $s));
}

function tamanho(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int) preg_match_all('/./su', $s);
}

// Texto do usuário: string UTF-8 válida, sem controles (exceto \n se $multilinha), aparado e com teto.
// Devolve null se inválido; '' se ausente/vazio.
function texto(array $d, string $campo, int $max, bool $multilinha = false): ?string
{
    if (!array_key_exists($campo, $d) || $d[$campo] === null) return '';
    if (!is_string($d[$campo]) || !preg_match('//u', $d[$campo])) return null;
    $s = str_replace(["\r\n", "\r"], "\n", $d[$campo]);
    $s = $multilinha
        ? (string) preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/', ' ', $s)
        : (string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $s);
    $s = trim($s);
    return tamanho($s) > $max ? null : $s;
}

function carregarConfig(): array
{
    $arq = __DIR__ . '/config.php';
    if (!is_file($arq)) falhar('indisponivel');
    $c = require $arq;
    if (!is_array($c)) falhar('indisponivel');

    $dir = $c['DATA_DIR'] ?? '';
    $sal = $c['IP_SALT'] ?? '';
    $para = semQuebras((string) ($c['MAIL_TO'] ?? ''));
    $de = semQuebras((string) ($c['MAIL_FROM'] ?? ''));
    if (!is_string($dir) || $dir === '' || !is_string($sal) || strlen($sal) < 32 || str_starts_with($sal, 'TROQUE')
        || !filter_var($para, FILTER_VALIDATE_EMAIL) || !filter_var($de, FILTER_VALIDATE_EMAIL)) {
        falhar('indisponivel');
    }
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) falhar('indisponivel');
    $real = realpath($dir);
    if ($real === false || !is_writable($real)) falhar('indisponivel');
    // A pasta de dados não pode ficar dentro da raiz pública do site.
    $raiz = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($raiz !== false && $raiz !== '' && ($real === $raiz || str_starts_with($real . DIRECTORY_SEPARATOR, rtrim($raiz, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR))) {
        falhar('indisponivel');
    }

    return [
        'dir' => $real,
        'sal' => $sal,
        'para' => $para,
        'de' => $de,
        'simular' => ($c['MAIL_DRY_RUN'] ?? false) === true,
    ];
}

function iniciarSessao(): void
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    $caminho = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/'))), '/') . '/';
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    session_name('sbx_indicar');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $caminho,
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    if (!@session_start()) falhar('indisponivel');
}

// Conta o envio deste IP e diz se ainda está dentro do limite. O IP é guardado só como HMAC com sal.
function dentroDoLimite(array $cfg): bool
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $chave = hash_hmac('sha256', $ip, $cfg['sal']);
    $f = @fopen($cfg['dir'] . '/limite.json', 'c+');
    if ($f === false) falhar('indisponivel');
    try {
        if (!flock($f, LOCK_EX)) falhar('indisponivel');
        $bruto = stream_get_contents($f);
        $tabela = json_decode($bruto === false ? '' : $bruto, true);
        if (!is_array($tabela)) $tabela = [];
        $agora = time();
        foreach ($tabela as $k => $marcas) {
            $marcas = is_array($marcas) ? array_values(array_filter($marcas, fn($t) => is_int($t) && $t > $agora - LIMITE_JANELA)) : [];
            if ($marcas) $tabela[$k] = $marcas; else unset($tabela[$k]);
        }
        $marcas = $tabela[$chave] ?? [];
        $ok = count($marcas) < LIMITE_ENVIOS;
        if ($ok) {
            $marcas[] = $agora;
            $tabela[$chave] = $marcas;
        }
        ftruncate($f, 0);
        rewind($f);
        fwrite($f, json_encode($tabela, JSON_UNESCAPED_SLASHES));
        fflush($f);
        flock($f, LOCK_UN);
        return $ok;
    } finally {
        fclose($f);
    }
}

function validar(array $d): ?array
{
    $v = [
        'nome_sandbox' => texto($d, 'nome_sandbox', 200),
        'jurisdicao' => texto($d, 'jurisdicao', 200),
        'fonte_url' => texto($d, 'fonte_url', 500),
        'observacao' => texto($d, 'observacao', 2000, true),
        'contato_nome' => texto($d, 'contato_nome', 200),
        'contato_email' => texto($d, 'contato_email', 254),
    ];
    if (in_array(null, $v, true)) return null;
    if ($v['nome_sandbox'] === '' || $v['jurisdicao'] === '' || $v['fonte_url'] === '') return null;

    if (!filter_var($v['fonte_url'], FILTER_VALIDATE_URL)) return null;
    $esquema = strtolower((string) parse_url($v['fonte_url'], PHP_URL_SCHEME));
    $host = (string) parse_url($v['fonte_url'], PHP_URL_HOST);
    if (!in_array($esquema, ['http', 'https'], true) || $host === '') return null;

    if ($v['contato_email'] !== '' && !filter_var($v['contato_email'], FILTER_VALIDATE_EMAIL)) return null;
    if (($d['consentimento'] ?? null) !== true) return null;
    return $v;
}

function enviarEmail(array $cfg, array $v, string $quando): bool
{
    $linhas = [
        'Nova indicação de sandbox recebida pelo site Sandboxes Brasil.',
        '',
        'Data: ' . $quando,
        'Nome do sandbox: ' . $v['nome_sandbox'],
        'Jurisdição / órgão: ' . $v['jurisdicao'],
        'Fonte: ' . $v['fonte_url'],
        '',
        'Observação:',
        $v['observacao'] !== '' ? $v['observacao'] : '(nenhuma)',
        '',
        '--- Contato de quem indicou (NÃO publicar, NÃO copiar para o repositório) ---',
        'Nome: ' . ($v['contato_nome'] !== '' ? $v['contato_nome'] : '(não informado)'),
        'E-mail: ' . ($v['contato_email'] !== '' ? $v['contato_email'] : '(não informado)'),
        'Consentimento: sim',
        '',
        'Para verificar: copie nome, jurisdição e link para rotina/indicacoes.md (sem o contato).',
    ];
    $corpo = implode("\n", $linhas) . "\n";

    // Cabeçalhos só com valores fixos ou da configuração; o único dado do usuário é o Reply-To,
    // e só se for e-mail válido e sem quebras de linha.
    $assunto = '=?UTF-8?B?' . base64_encode('Nova indicação de sandbox — Sandboxes Brasil') . '?=';
    $cab = [
        'From' => 'Sandboxes Brasil <' . $cfg['de'] . '>',
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
        'X-Mailer' => 'sandboxes-brasil',
    ];
    $resp = $v['contato_email'];
    if ($resp !== '' && !preg_match('/[\r\n]/', $resp) && filter_var($resp, FILTER_VALIDATE_EMAIL)) {
        $cab['Reply-To'] = $resp;
    }

    if ($cfg['simular']) {
        $txt = "To: {$cfg['para']}\nSubject: {$assunto}\n";
        foreach ($cab as $k => $val) $txt .= "{$k}: {$val}\n";
        return file_put_contents($cfg['dir'] . '/ultimo-email.txt', $txt . "\n" . $corpo, LOCK_EX) !== false;
    }

    $param = preg_match('/^[A-Za-z0-9._%+@-]+$/', $cfg['de']) ? '-f' . $cfg['de'] : '';
    return @mail($cfg['para'], $assunto, $corpo, $cab, $param);
}

// ---------------------------------------------------------------------------

date_default_timezone_set('America/Sao_Paulo');
umask(0077); // arquivos de dados só para o dono
$cfg = carregarConfig();
$metodo = $_SERVER['REQUEST_METHOD'] ?? '';

if ($metodo === 'GET') {
    if (($_GET['token'] ?? '') !== '1') falhar('invalido');
    iniciarSessao();
    session_regenerate_id(true);
    $token = bin2hex(random_bytes(32));
    $_SESSION['ind_token'] = $token;
    $_SESSION['ind_token_em'] = time();
    responder(200, ['token' => $token]);
}

if ($metodo !== 'POST') {
    header('Allow: GET, POST');
    responder(405, ['ok' => false, 'motivo' => 'invalido']);
}

$bruto = file_get_contents('php://input', false, null, 0, CORPO_MAX + 1);
if ($bruto === false || strlen($bruto) > CORPO_MAX) falhar('invalido');
try {
    $d = json_decode($bruto, true, 8, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    falhar('invalido');
}
if (!is_array($d) || array_is_list($d)) falhar('invalido');

// 1) Token: uso único. É consumido antes de qualquer outra verificação.
iniciarSessao();
$esperado = $_SESSION['ind_token'] ?? null;
$emitido = $_SESSION['ind_token_em'] ?? 0;
unset($_SESSION['ind_token'], $_SESSION['ind_token_em']);
session_write_close();
$recebido = $d['token'] ?? null;
if (!is_string($esperado) || !is_string($recebido) || !is_int($emitido)
    || time() - $emitido > TOKEN_VALIDADE || !hash_equals($esperado, $recebido)) {
    falhar('token');
}

// 2) Limite por IP (conta todo envio com token válido, inclusive os de robô e os inválidos).
if (!dentroDoLimite($cfg)) falhar('limite');

// 3) Armadilha: robô preencheu o campo invisível. Finge sucesso e não faz nada.
$site = $d['site'] ?? '';
if (!is_string($site) || trim($site) !== '') responder(200, ['ok' => true]);

// 4) Validação.
$v = validar($d);
if ($v === null) falhar('invalido');

// 5) E-mail para o Júlio (com contato) e registro em disco (sem contato).
$quando = date('c');
if (!enviarEmail($cfg, $v, $quando)) falhar('indisponivel');

$registro = [
    'data' => $quando,
    'nome_sandbox' => $v['nome_sandbox'],
    'jurisdicao' => $v['jurisdicao'],
    'fonte_url' => $v['fonte_url'],
    'observacao' => $v['observacao'],
];
$linha = json_encode($registro, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
if (@file_put_contents($cfg['dir'] . '/indicacoes.jsonl', $linha, FILE_APPEND | LOCK_EX) === false) {
    // O e-mail já saiu: a indicação chegou. Só registra a falha no log do servidor.
    error_log('sandboxes-brasil/indicar: falha ao gravar indicacoes.jsonl');
}

responder(200, ['ok' => true]);
