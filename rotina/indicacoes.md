# Indicações a verificar

Fila de sandboxes indicados pelo formulário "Indicar um sandbox" do site, aguardando verificação pela rotina.

**Como funciona**

- O formulário (`api/indicar.php`) manda um e-mail para o Júlio com todos os campos e grava, fora do `public_html`, um registro **sem dados de contato**.
- Na revisão semanal, o Júlio copia para cá as indicações que quer verificar, **uma por linha**, no formato:
  `- Nome do sandbox | Jurisdição ou órgão | https://link-da-fonte-oficial`
- **Nunca** copie nome, e-mail ou qualquer dado de contato de quem indicou: este repositório é público.
- A rotina lê este arquivo, pesquisa cada item e, no PR que inclui (ou descarta) o sandbox, remove a linha já tratada.

## Pendentes

