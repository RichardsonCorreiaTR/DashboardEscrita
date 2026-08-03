/**
 * atualizar-metas.js - Atualiza metas via ODBC (somente o colaborador do pacote)
 */
const fs = require('fs');
const path = require('path');
const cacheLocal = require('./cache-local');

function temOdbc(root) {
  return fs.existsSync(path.join(root, 'src/core/conexao.js'));
}

// O erro cru de require nao ajuda o analista; traduz para uma acao concreta
function traduzirErro(err) {
  const msg = err && err.message ? err.message : String(err);
  const mod = msg.match(/Cannot find module '([^']+)'/);
  if (mod) {
    return new Error('Pacote incompleto (falta ' + mod[1] + '). Peca ao coordenador o ZIP ' +
      'mais recente. Para conferir, rode: npm run verificar');
  }
  if (/data source name|DSN|IM002/i.test(msg)) {
    return new Error('Banco nao configurado neste computador (DSN ODBC). ' +
      'Rode: npm run verificar');
  }
  return err;
}

function lerColab(root, slug) {
  const equipe = JSON.parse(fs.readFileSync(path.join(root, 'config/equipe.json'), 'utf8'));
  return equipe.analistas.find(a => a.slug === slug && a.papel === 'analista');
}

function anoValido(q) {
  const ano = Number(q);
  return ano >= 2020 && ano <= 2030 ? ano : new Date().getFullYear();
}

async function atualizarResumo(root, slug, anoQuery) {
  if (!temOdbc(root)) throw new Error('Atualizacao ao vivo indisponivel neste pacote');
  const colab = lerColab(root, slug);
  if (!colab) throw new Error('Colaborador nao encontrado');
  const ano = anoValido(anoQuery);
  try {
    const loader = require(path.join(root, 'src/indicadores/equipe/metas-loader'));
    const conexao = require(path.join(root, 'src/core/conexao'));
    const metasJson = JSON.parse(fs.readFileSync(path.join(root, 'config/metas-equipe.json'), 'utf8'));
    loader.setAno(ano);
    await conexao.inicializar();
    const dados = await loader.buscarDadosAnalista(colab);
    const resp = loader.enriquecerSsMetas(loader.montarResposta(colab, dados, metasJson), colab);
    const ts = cacheLocal.salvar(root, slug, resp);
    return { ...resp, ano, _fonte: 'odbc', _atualizado_em: ts };
  } catch (err) {
    throw traduzirErro(err);
  }
}

async function atualizarDetalhe(root, slug, metaId, mes, anoQuery) {
  if (!temOdbc(root)) throw new Error('Atualizacao ao vivo indisponivel');
  const colab = lerColab(root, slug);
  if (!colab) throw new Error('Colaborador nao encontrado');
  const ano = anoValido(anoQuery);
  try {
    const loader = require(path.join(root, 'src/indicadores/equipe/metas-loader'));
    const conexao = require(path.join(root, 'src/core/conexao'));
    loader.setAno(ano);
    await conexao.inicializar();
    const registros = await loader.buscarDetalhe(colab, metaId, mes);
    cacheLocal.salvarDetalhe(root, slug, metaId, mes, registros);
    return { registros, mes, ano, _fonte: 'odbc' };
  } catch (err) {
    throw traduzirErro(err);
  }
}

module.exports = { temOdbc, atualizarResumo, atualizarDetalhe };
