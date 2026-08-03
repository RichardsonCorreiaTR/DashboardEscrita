#!/usr/bin/env node
/**
 * exportar-pacotes-mes.js - Exporta pacotes de TODOS os analistas (rotina mensal)
 *
 * Uso:
 *   node scripts/exportar-pacotes-mes.js              # usa cache existente
 *   node scripts/exportar-pacotes-mes.js --refresh    # atualiza cache via ODBC antes
 *
 * Saida: output/pacotes-analista/Metas-<slug>/ + manifesto JSON
 */
const fs = require('fs');
const path = require('path');
const { exportarPacote, listarAnalistas } = require('./lib/exportar-pacote-lib');

const ROOT = path.join(__dirname, '..');
const REF = process.env.PACOTES_REF || new Date().toISOString().slice(0, 7);
const REFRESH = process.argv.includes('--refresh');

async function atualizarCache() {
  const conexao = require(path.join(ROOT, 'src/core/conexao'));
  const cacheMetas = require(path.join(ROOT, 'src/core/cache-metas'));
  const loader = require(path.join(ROOT, 'src/indicadores/equipe/metas-loader'));
  const equipe = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'equipe.json'), 'utf8'));
  const metasJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'metas-equipe.json'), 'utf8'));
  const analistas = equipe.analistas.filter(a => a.papel === 'analista');
  await conexao.inicializar();
  cacheMetas.restaurar();
  console.log('[pacotes-mes] Atualizando cache ODBC (%d analistas)...', analistas.length);
  const dados = await loader.buscarDados(analistas);
  const result = analistas.map(a => loader.montarResposta(a, dados, metasJson));
  cacheMetas.salvarTodos(result);
  await conexao.fechar();
  console.log('[pacotes-mes] Cache atualizado.');
}

async function main() {
  const cfgPath = path.join(ROOT, 'config', 'pacotes-analista.json');
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
  const saidaBase = path.join(ROOT, cfg.saida_relativa || 'output/pacotes-analista');
  fs.mkdirSync(saidaBase, { recursive: true });

  if (REFRESH || (cfg.rotina_mensal && cfg.rotina_mensal.atualizar_cache_antes && process.argv.includes('--auto'))) {
    try { await atualizarCache(); }
    catch (err) {
      console.warn('[pacotes-mes] ODBC indisponivel, usando cache existente:', err.message);
    }
  }

  const lista = listarAnalistas(ROOT);
  const manifesto = {
    referencia: REF, gerado_em: new Date().toISOString(),
    total: lista.length, ok: [], falhas: []
  };

  lista.forEach(a => {
    const r = exportarPacote(ROOT, a.slug, { saidaBase, referencia: REF });
    if (r.ok) {
      manifesto.ok.push({ slug: r.slug, apelido: r.apelido, usuario: r.usuario, pasta: 'Metas-' + r.slug });
      console.log('OK', r.apelido);
    } else {
      manifesto.falhas.push({ slug: a.slug, apelido: a.apelido, erro: r.erro });
      console.warn('FALHA', a.apelido, '-', r.erro);
    }
  });

  const manPath = path.join(saidaBase, 'manifesto-' + REF + '.json');
  fs.writeFileSync(manPath, JSON.stringify(manifesto, null, 2));
  fs.writeFileSync(path.join(saidaBase, 'ULTIMO-MANIFESTO.txt'),
    'Referencia: ' + REF + '\r\nGerado: ' + manifesto.gerado_em + '\r\n' +
    'OK: ' + manifesto.ok.length + ' | Falhas: ' + manifesto.falhas.length + '\r\n' +
    'Manifesto: ' + path.basename(manPath) + '\r\n'
  );
  console.log('\n[pacotes-mes] Concluido:', manifesto.ok.length + '/' + lista.length);
  console.log('[pacotes-mes] Manifesto:', manPath);
  if (manifesto.falhas.length) process.exitCode = 1;
}

main().catch(err => { console.error(err.message); process.exit(1); });
