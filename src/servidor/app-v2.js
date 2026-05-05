/**
 * app-v2.js - Servidor v2 (UX redesign)
 *
 * Reutiliza 100% do backend (rotas, indicadores, core).
 * Serve frontend redesenhado de public-v2/.
 * Porta padrao: 5000 (env PORT_V2).
 *
 * O app.js (porta 4000) continua funcionando em paralelo.
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

const PORT_V2 = process.env.PORT_V2 || 5000;

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public-v2')));

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
    versao: 'v2',
    indicadores: indicadores.listar().length,
    cache: cache.estatisticas(),
    cache_disco: cache.ultimaAtualizacaoDisco(),
    timestamp: new Date().toISOString()
  });
});

async function iniciar() {
  try {
    cache.restaurarDoDisco();
    cacheMetas.restaurar();

    try {
      await conexao.inicializar();
      console.log('[v2] Conexao ODBC inicializada');
    } catch (errOdbc) {
      console.warn('[v2] ODBC indisponivel: %s', errOdbc.message);
      console.warn('[v2] Iniciando em modo cache/offline');
    }

    indicadores.inicializar();
    console.log('[v2] Indicadores carregados: %d', indicadores.listar().length);

    agendador.iniciar(indicadores, qe);

    app.listen(PORT_V2, () => {
      console.log('[v2] Dashboard v2 rodando em http://localhost:%d', PORT_V2);
    });
  } catch (err) {
    console.error('[v2] Erro ao iniciar:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n[v2] Encerrando...');
  agendador.parar();
  await conexao.fechar();
  process.exit(0);
});

iniciar();
