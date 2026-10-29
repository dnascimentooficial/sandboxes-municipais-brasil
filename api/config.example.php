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

    // ATENÇÃO: true = não envia e-mail e GRAVA em DATA_DIR/ultimo-email.txt a mensagem inteira, com
    // o contato de quem indicou (nome e e-mail). Só para testes locais, onde mail() costuma falhar.
    // Em produção DEVE ser false; sob HTTPS o endpoint recusa true (responde "indisponivel").
    'MAIL_DRY_RUN' => false,

    // CIDRs dos proxies/CDN à frente do PHP (ex.: ['203.0.113.0/24', '2001:db8::/32']). Vazio = só
    // REMOTE_ADDR conta. Se REMOTE_ADDR estiver nesta lista, o IP do cliente é lido de X-Forwarded-For,
    // da direita para a esquerda, pulando os proxies confiáveis. IPv6 é agrupado por prefixo /64.
    // PREENCHER SOMENTE DEPOIS da sonda de deploy (Task 15): confirme na Hostinger qual REMOTE_ADDR e
    // qual X-Forwarded-For o PHP realmente recebe. Uma faixa errada deixa qualquer um forjar o próprio IP
    // e burlar o limite de envios; uma faixa ausente faz todos os visitantes dividirem o IP do proxy.
    'TRUSTED_PROXIES' => [],
];
