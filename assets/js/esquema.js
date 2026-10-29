// Enums e rótulos compartilhados entre o validador, o build e a interface.
// Módulo ES puro: também é importado pelo navegador (sem imports de Node).

export const ESFERAS = ['municipal', 'estadual', 'federal'];
export const STATUS = ['ativo', 'regulamentado', 'em_instituicao', 'encerrado'];
export const INGRESSO = ['edital', 'fluxo_continuo', 'convite', 'nao_informado'];
export const TIPOS_DOC = ['lei', 'decreto', 'portaria', 'resolucao', 'edital', 'relatorio', 'outro'];
export const STATUS_SOLUCAO = ['em_teste', 'concluida', 'selecionada', 'encerrada'];
export const STATUS_EDITAL = ['aberto', 'encerrado'];
export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

export const UF_REGIAO = {
  AC: 'Norte', AM: 'Norte', AP: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste',
  PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MS: 'Centro-Oeste', MT: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
};

export const ROTULOS = {
  status: {
    ativo: 'Ativo',
    regulamentado: 'Regulamentado',
    em_instituicao: 'Em instituição',
    encerrado: 'Encerrado',
  },
  esfera: { municipal: 'Municipal', estadual: 'Estadual', federal: 'Federal' },
  ingresso: {
    edital: 'Edital',
    fluxo_continuo: 'Fluxo contínuo',
    convite: 'Convite',
    nao_informado: 'não informado',
  },
  tipoDoc: {
    lei: 'Lei',
    decreto: 'Decreto',
    portaria: 'Portaria',
    resolucao: 'Resolução',
    edital: 'Edital',
    relatorio: 'Relatório',
    outro: 'Outro',
  },
  statusSolucao: {
    em_teste: 'Em teste',
    concluida: 'Concluída',
    selecionada: 'Selecionada',
    encerrada: 'Encerrada',
  },
};
