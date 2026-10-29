<?php
// Modelo de configuração do endpoint de indicação (api/indicar.php).
//
// Copie este arquivo para api/config.php NO SERVIDOR e preencha os valores.
// api/config.php não é versionado (está no .gitignore) e o api/.htaccess bloqueia o acesso a ele pela web.
// Sem api/config.php, ou com DATA_DIR inválido, o endpoint responde {"ok":false,"motivo":"indisponivel"}.

return [
    // Pasta FORA do public_html, gravável pelo PHP. Guarda:
    //   indicacoes.jsonl  uma linha JSON por indicação, SEM dados de contato;
    //   limite.json       contagem de envios por IP (IP guardado como hash, nunca em claro);
    //   ultimo-email.txt  só quando MAIL_DRY_RUN = true.
    // Se a pasta não existir, o endpoint tenta criá-la com permissão 0700.
    'DATA_DIR' => '/home/USUARIO/dados/sandboxes-indicar',

    // Destinatário e remetente do aviso por e-mail.
    'MAIL_TO' => 'contato@dnascimento.com.br',
    'MAIL_FROM' => 'no-reply@dnascimento.com.br',

    // Sal secreto para o hash dos IPs no limite de envios. Use pelo menos 32 caracteres aleatórios, por exemplo:
    //   php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    // Enquanto começar com "TROQUE", o endpoint fica indisponível.
    'IP_SALT' => 'TROQUE-POR-UM-VALOR-ALEATORIO-DE-64-CARACTERES-HEX',

    // true = não envia e-mail: grava a mensagem em DATA_DIR/ultimo-email.txt (para testes locais,
    // onde mail() costuma falhar). Em produção deixe false.
    'MAIL_DRY_RUN' => false,
];
