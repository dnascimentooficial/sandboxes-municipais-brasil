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

// Nunca mostrar erros ao cliente; falhas inesperadas viram {"ok":false,"motivo":"indisponivel"} (503).
ini_set('display_errors', '0');
ini_set('html_errors', '0');
ob_start();
$GLOBALS['sbx_respondeu'] = false;

function indisponivelInesperado(): void
{
    if ($GLOBALS['sbx_respondeu']) return;
    while (ob_get_level() > 0) @ob_end_clean();
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, max-age=0');
        header('HTTP/1.1 503 Service Unavailable', true, 503);
        echo '{"ok":false,"motivo":"indisponivel"}';
    }
}

set_exception_handler(function (Throwable $e): void {
    error_log('sandboxes-brasil/indicar: ' . get_class($e) . ' em ' . basename($e->getFile()) . ':' . $e->getLine());
    indisponivelInesperado();
    exit;
});

register_shutdown_function(function (): void {
    $e = error_get_last();
    if ($e !== null && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR], true)) {
        error_log('sandboxes-brasil/indicar: erro fatal em ' . basename($e['file']) . ':' . $e['line']);
        indisponivelInesperado();
    }
});

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Robots-Tag: noindex');

function responder(int $status, array $corpo): never
{
    $GLOBALS['sbx_respondeu'] = true;
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

// "a.b.c.d/n" ou "x::y/n" (sem "/n" = host) -> [binário da rede, bits] ou null se inválido.
function cidrParaFaixa(string $cidr): ?array
{
    $partes = explode('/', trim($cidr), 2);
    $bin = filter_var($partes[0], FILTER_VALIDATE_IP) !== false ? @inet_pton($partes[0]) : false;
    if ($bin === false) return null;
    $max = strlen($bin) * 8;
    if (count($partes) === 1) return [$bin, $max];
    if (!ctype_digit($partes[1]) || (int) $partes[1] > $max) return null;
    return [$bin, (int) $partes[1]];
}

function ipNaFaixa(string $ip, array $faixa): bool
{
    $bin = @inet_pton($ip);
    [$rede, $bits] = $faixa;
    if ($bin === false || strlen($bin) !== strlen($rede)) return false;
    $bytes = intdiv($bits, 8);
    if ($bytes > 0 && substr($bin, 0, $bytes) !== substr($rede, 0, $bytes)) return false;
    $resto = $bits % 8;
    if ($resto === 0) return true;
    $mascara = (0xFF << (8 - $resto)) & 0xFF;
    return (ord($bin[$bytes]) & $mascara) === (ord($rede[$bytes]) & $mascara);
}

function ipConfiavel(string $ip, array $proxies): bool
{
    foreach ($proxies as $cidr) {
        $faixa = cidrParaFaixa($cidr);
        if ($faixa !== null && ipNaFaixa($ip, $faixa)) return true;
    }
    return false;
}

// IP do cliente. X-Forwarded-For só vale quando REMOTE_ADDR é um proxy confiável; aí percorre-se a lista
// da DIREITA para a esquerda, pulando proxies confiáveis, e fica o primeiro IP válido não confiável.
function ipCliente(array $cfg): string
{
    $remoto = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($cfg['proxies'] === [] || !ipConfiavel($remoto, $cfg['proxies'])) return $remoto;
    $xff = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
    $lista = $xff === '' ? [] : array_reverse(explode(',', $xff));
    foreach ($lista as $item) {
        $ip = trim($item);
        if (filter_var($ip, FILTER_VALIDATE_IP) === false) continue;
        if (!ipConfiavel($ip, $cfg['proxies'])) return $ip;
    }
    return $remoto;
}

// Chave do limite: IPv4 inteiro; IPv6 agrupado pelo prefixo /64 (IPv4 mapeado em IPv6 vira IPv4).
function chaveIp(string $ip): string
{
    $bin = filter_var($ip, FILTER_VALIDATE_IP) !== false ? @inet_pton($ip) : false;
    if ($bin === false) return $ip;
    if (strlen($bin) === 16) {
        if (substr($bin, 0, 12) === str_repeat("\0", 10) . "\xff\xff") return inet_ntop(substr($bin, 12)) ?: $ip;
        return bin2hex(substr($bin, 0, 8)) . '/64';
    }
    return $ip;
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

    $proxies = $c['TRUSTED_PROXIES'] ?? [];
    if (!is_array($proxies)) falhar('indisponivel');
    foreach ($proxies as $cidr) {
        if (!is_string($cidr) || cidrParaFaixa($cidr) === null) falhar('indisponivel');
    }
    $simular = ($c['MAIL_DRY_RUN'] ?? false) === true;
    // MAIL_DRY_RUN grava dados de contato em disco: nunca sob HTTPS (produção).
    if ($simular && strtolower((string) ($_SERVER['HTTPS'] ?? '')) === 'on') falhar('indisponivel');

    return [
        'proxies' => array_values($proxies),
        'dir' => $real,
        'sal' => $sal,
        'para' => $para,
        'de' => $de,
        'simular' => $simular,
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
    $chave = hash_hmac('sha256', chaveIp(ipCliente($cfg)), $cfg['sal']);
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
    $corpo = chunk_split(base64_encode(implode("\n", $linhas) . "\n"));

    // Cabeçalhos só com valores fixos ou da configuração; o único dado do usuário é o Reply-To,
    // e só se for e-mail válido e sem quebras de linha.
    $assunto = '=?UTF-8?B?' . base64_encode('Nova indicação de sandbox — Sandboxes Brasil') . '?=';
    $cab = [
        'From' => 'Sandboxes Brasil <' . $cfg['de'] . '>',
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => 'base64',
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
    if (!session_regenerate_id(true)) falhar('indisponivel');
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
