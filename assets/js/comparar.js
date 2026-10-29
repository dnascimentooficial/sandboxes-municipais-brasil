// Lógica da aba Comparar: seleção de até 3 sandboxes e montagem da tabela.
// Os valores devolvidos são texto puro; quem renderiza deve escapar.
import { STATUS_SOLUCAO } from './esquema.js';
import { textoOuNaoInformado, dataBR, rotulo, temasTexto } from './formatar.js';

export const MAX_COMPARAR = 3;
const NAO_INFORMADO = 'não informado';

export function adicionarAoComparar(ids, id, max = MAX_COMPARAR) {
  if (ids.includes(id)) return { ids: [...ids], precisaSubstituir: false };
  if (ids.length >= max) return { ids: [...ids], precisaSubstituir: true };
  return { ids: [...ids, id], precisaSubstituir: false };
}

export function substituirNoComparar(ids, indice, id) {
  const novo = [...ids];
  novo[indice] = id;
  return novo;
}

export function removerDoComparar(ids, id) {
  return ids.filter((x) => x !== id);
}

function jurisdicao(s, orgaos) {
  const j = s.jurisdicao ?? {};
  if (s.esfera === 'municipal') {
    return j.municipio && j.uf ? `${j.municipio}/${j.uf}` : textoOuNaoInformado(j.municipio ?? j.uf);
  }
  if (s.esfera === 'federal') {
    if (!j.orgao) return NAO_INFORMADO;
    const o = (orgaos ?? []).find((x) => x.sigla === j.orgao);
    return o?.nome ? `${o.nome} (${j.orgao})` : j.orgao;
  }
  return textoOuNaoInformado(j.uf);
}

const PLURAL = { concluida: 'concluídas', selecionada: 'selecionadas', encerrada: 'encerradas' };

function solucoesTexto(lista) {
  const itens = Array.isArray(lista) ? lista : [];
  const partes = [];
  for (const st of STATUS_SOLUCAO) {
    const n = itens.filter((x) => x?.status === st).length;
    if (n === 0) continue;
    const nome = n === 1 || !PLURAL[st] ? rotulo('statusSolucao', st).toLowerCase() : PLURAL[st];
    partes.push(`${n} ${nome}`);
  }
  return partes.length ? partes.join(' · ') : 'nenhuma documentada';
}

function editaisTexto(lista) {
  const itens = Array.isArray(lista) ? lista : [];
  const ab = itens.filter((x) => x?.status === 'aberto').length;
  const en = itens.filter((x) => x?.status === 'encerrado').length;
  const partes = [];
  if (ab) partes.push(`${ab} ${ab === 1 ? 'aberto' : 'abertos'}`);
  if (en) partes.push(`${en} ${en === 1 ? 'encerrado' : 'encerrados'}`);
  return partes.length ? partes.join(' · ') : 'nenhum';
}

function prazoTexto(n) {
  if (typeof n !== 'number') return NAO_INFORMADO;
  return n === 1 ? '1 mês' : `${n} meses`;
}

function documentosJson(lista) {
  const docs = (Array.isArray(lista) ? lista : []).map((d) => {
    const o = {};
    for (const k of ['tipo', 'titulo', 'numero', 'data', 'url']) if (d?.[k] !== undefined) o[k] = d[k];
    return o;
  });
  return JSON.stringify(docs);
}

function fontesTexto(lista) {
  const n = Array.isArray(lista) ? lista.length : 0;
  return n === 1 ? '1 fonte' : `${n} fontes`;
}

export function montarComparacao(sandboxes, { temas, orgaos } = {}) {
  const def = (grupo, linhas) => ({
    titulo: grupo,
    linhas: linhas.map(([chave, rot, fn]) => {
      const valores = sandboxes.map((s) => fn(s));
      const iguais = valores.length >= 2 && valores.every((v) => v === valores[0]);
      return { chave, rotulo: rot, valores, iguais };
    }),
  });

  return {
    grupos: [
      def('Identificação', [
        ['esfera', 'Esfera', (s) => rotulo('esfera', s.esfera)],
        ['jurisdicao', 'Jurisdição / órgão', (s) => jurisdicao(s, orgaos)],
        ['status', 'Status', (s) => rotulo('status', s.status)],
        ['desde', 'Desde', (s) => dataBR(s.desde)],
      ]),
      def('Escopo', [
        ['temas', 'Eixos temáticos', (s) => temasTexto(s.temas, temas)],
        ['resumo', 'Resumo', (s) => textoOuNaoInformado(s.resumo)],
      ]),
      def('Funcionamento', [
        ['gestor', 'Gestor', (s) => textoOuNaoInformado(s.gestor)],
        ['ingresso', 'Forma de ingresso', (s) => rotulo('ingresso', s.ingresso)],
        ['prazo', 'Prazo máximo de teste', (s) => prazoTexto(s.prazo_teste_meses)],
        ['elegibilidade', 'Elegibilidade', (s) => textoOuNaoInformado(s.elegibilidade)],
        ['flexibilizacoes', 'Flexibilizações', (s) => textoOuNaoInformado(s.flexibilizacoes)],
      ]),
      def('Execução', [
        ['solucoes', 'Soluções por status', (s) => solucoesTexto(s.solucoes)],
        ['editais', 'Editais', (s) => editaisTexto(s.editais)],
      ]),
      def('Documentação publicada', [
        ['documentos', 'Documentos', (s) => documentosJson(s.documentos)],
      ]),
      def('Confiabilidade', [
        ['verificado_em', 'Verificado em', (s) => dataBR(s.verificado_em)],
        ['fontes', 'Fontes', (s) => fontesTexto(s.fontes)],
      ]),
    ],
  };
}
