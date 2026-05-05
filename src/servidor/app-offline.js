/**
 * app-offline.js - Servidor somente-cache (porta 4001)
 *
 * Serve o dashboard completo usando APENAS dados do cache em disco.
 * Zero conexao ODBC. Util para:
 * - Compartilhar dashboards sem acesso ao banco
 * - Consultar dados quando a VPN esta fora
 * - Acesso rapido somente-leitura ao ultimo snapshot
 *
 * Uso: node src/servidor/app-offline.js
 * Ou: npm run offline
 */

const express = require('express');
const path = require('path');

const rotasOffline = require('./rotas/offline');

const PORT_OFFLINE = process.env.PORT_OFFLINE || 4001;

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', rotasOffline);

app.listen(PORT_OFFLINE, () => {
  console.log('============================================');
  console.log('  MODO OFFLINE (somente cache)');
  console.log('  http://localhost:%d', PORT_OFFLINE);
  console.log('  Sem conexao ODBC - dados do ultimo cache');
  console.log('============================================');
});
