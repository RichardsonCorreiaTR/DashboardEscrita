/**
 * app.js - Servidor Express do Dashboard Diretrizes
 *
 * Responsabilidades:
 * - Servir o dashboard SPA (arquivos estaticos)
 * - Expor API REST para indicadores, versao e historico
 * - Restaurar cache de disco na startup
 * - Iniciar agendador de snapshots do historico
 *
 * Porta: 4000 (configuravel via env PORT)
 */

const express = require('express');
const path = require('path');

const indicadores = require('../indicadores');
const conexao = require('../core/conexao');
const cache = require('../core/cache');
const cacheMetas = require('../core/cache-metas');
const agendador = require('../core/agendador');
const qe = require('../core/query-executor');

const rotasIndicadores = require('./rotas/indicadores');
const rotasHistorico = require('./rotas/historico');
const rotasEstudos = require('./rotas/estudos');
const rotasMetasEquipe = require('./rotas/metas-equipe');
const rotasLaboratorio = require('./rotas/laboratorio');
const rotasPropostaMetas = require('./rotas/proposta-metas');
const rotasDescartesTempo = require('./rotas/descartes-tempo');

const PORT = process.env.PORT || 4000;

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', rotasIndicadores);
app.use('/api', rotasHistorico);
app.use('/api', rotasEstudos);
app.use('/api', rotasMetasEquipe);
app.use('/api', rotasLaboratorio);
app.use('/api', rotasPropostaMetas);
app.use('/api', rotasDescartesTempo);

app.get('/api/saude', (req, res) => {
  res.json({
    status: 'ok',
    indicadores: indicadores.listar().length,
    cache: cache.estatisticas(),
    cache_disco: cache.ultimaAtualizacaoDisco(),
    timestamp: new Date().toISOString()
  });
});

async function iniciar() {
  try {
    // Restaurar cache de disco (antes de tudo)
    cache.restaurarDoDisco();
    cacheMetas.restaurar();

    try {
      await conexao.inicializar();
      console.log('[servidor] Conexao ODBC inicializada');
    } catch (errOdbc) {
      console.warn('[servidor] ODBC indisponivel: %s', errOdbc.message);
      console.warn('[servidor] Iniciando em modo cache/offline');
    }

    indicadores.inicializar();
    console.log('[servidor] Indicadores carregados: %d', indicadores.listar().length);

    // Iniciar agendador de snapshots (8h, 12h, 18h em dias uteis)
    agendador.iniciar(indicadores, qe);

    app.listen(PORT, () => {
      console.log('[servidor] Dashboard rodando em http://localhost:%d', PORT);
    });
  } catch (err) {
    console.error('[servidor] Erro ao iniciar:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n[servidor] Encerrando...');
  agendador.parar();
  await conexao.fechar();
  process.exit(0);
});

iniciar();
