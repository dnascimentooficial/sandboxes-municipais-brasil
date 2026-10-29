// Estado da interface <-> hash da URL. Ids inválidos são descartados.
const MAX_COMPARAR = 3;

function padrao() {
  return { aba: 'panorama', sandbox: null, comparar: [] };
}

function decodificar(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function lerHash(hash, idsValidos) {
  const estado = padrao();
  const bruto = typeof hash === 'string' ? hash.replace(/^#/, '') : '';
  if (!bruto) return estado;
  const params = new Map();
  for (const par of bruto.split('&')) {
    const i = par.indexOf('=');
    if (i < 0) continue;
    const chave = par.slice(0, i);
    if (!params.has(chave)) params.set(chave, par.slice(i + 1));
  }
  if (params.has('comparar')) {
    estado.aba = 'comparar';
    const vistos = new Set();
    for (const parte of params.get('comparar').split(',')) {
      const id = decodificar(parte);
      if (id === null || !idsValidos.has(id) || vistos.has(id)) continue;
      vistos.add(id);
      estado.comparar.push(id);
      if (estado.comparar.length === MAX_COMPARAR) break;
    }
  } else if (params.has('sandbox')) {
    const id = decodificar(params.get('sandbox'));
    if (id !== null && idsValidos.has(id)) estado.sandbox = id;
  }
  return estado;
}

export function escreverHash(estado) {
  if (estado?.aba === 'comparar') {
    return `#comparar=${(estado.comparar ?? []).map(encodeURIComponent).join(',')}`;
  }
  return estado?.sandbox ? `#sandbox=${encodeURIComponent(estado.sandbox)}` : '';
}
