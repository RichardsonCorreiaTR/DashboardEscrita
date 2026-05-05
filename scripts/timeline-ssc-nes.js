/**
 * timeline-ssc-nes.js
 *
 * Consulta SSCs vinculadas a NEs especificas e gera JSON com a
 * evolucao diaria acumulada (para visualizacao em canvas).
 *
 * Uso: node scripts/timeline-ssc-nes.js
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const OUTPUT = path.join(__dirname, '..', 'output', 'timeline-ssc-nes.json');

const NES = [
  { i_sai: 100471, i_psai: 128909, ssc_atual: 73 },
  { i_sai: 100322, i_psai: 128625, ssc_atual: 55 },
  { i_sai: 100324, i_psai: 128572, ssc_atual: 31 },
  { i_sai: 100192, i_psai: 128368, ssc_atual: 23 },
  { i_sai: 100140, i_psai: 128316, ssc_atual: 53 }
];

function sqlSSCsPorNE(i_psai) {
  return `
    SELECT ssc.i_ssc,
           CAST(ssc.entrada AS DATE) AS dia_entrada,
           ssc.i_ssc_situacoes,
           ssc.i_clientes
    FROM bethadba.forum_sa_psai fsp
    JOIN bethadba.ssc ssc ON ssc.i_forum_sa = fsp.i_forum_sa
    WHERE fsp.i_psai = ${i_psai}
    ORDER BY ssc.entrada`;
}

function sqlCadastroNE(psaiIds) {
  return `
    SELECT sp.i_psai, sp.i_sai, sp.CadastroPSAI, sp.gravidade_ne,
           sp.i_sai_situacoes
    FROM UP.SAI_PSAI sp
    WHERE sp.i_psai IN (${psaiIds.join(',')})
      AND sp.nomeArea = 'Escrita'
      AND sp.tipoSAI = 'NE'`;
}

function fmtDia(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function gerarDiasEntre(inicio, fim) {
  const dias = [];
  const cur = new Date(inicio);
  const end = new Date(fim);
  while (cur <= end) {
    dias.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

async function main() {
  console.log('=== Timeline SSC por NE ===\n');

  const psaiIds = NES.map(n => n.i_psai);
  console.log('[1/3] Buscando dados cadastrais das NEs...');
  const cadastros = await executar(sqlCadastroNE(psaiIds));
  const cadMap = {};
  for (const c of cadastros) cadMap[c.i_psai] = c;

  console.log('[2/3] Buscando SSCs por NE...');
  const resultado = [];

  for (const ne of NES) {
    console.log('  NE %d (PSAI %d)...', ne.i_sai, ne.i_psai);
    const rows = await executar(sqlSSCsPorNE(ne.i_psai));
    console.log('    -> %d SSCs encontradas', rows.length);

    const cad = cadMap[ne.i_psai] || {};
    const cadastro = fmtDia(cad.CadastroPSAI);
    const gravidade = (cad.gravidade_ne || '').trim();

    const porDia = {};
    const clientesPorDia = {};
    const todosClientes = new Set();
    let sscNaGeracaoSAI = 0;

    for (const r of rows) {
      const dia = fmtDia(r.dia_entrada);
      if (!dia) continue;
      porDia[dia] = (porDia[dia] || 0) + 1;
      if (!clientesPorDia[dia]) clientesPorDia[dia] = new Set();
      if (r.i_clientes) {
        clientesPorDia[dia].add(r.i_clientes);
        todosClientes.add(r.i_clientes);
      }
      if (cadastro && dia <= cadastro) sscNaGeracaoSAI++;
    }

    const diasOrdenados = Object.keys(porDia).sort();
    const primeiroDia = diasOrdenados[0] || cadastro;
    const hoje = new Date().toISOString().slice(0, 10);
    const todosDias = gerarDiasEntre(primeiroDia, hoje);

    let acumSSC = 0;
    const clientesAcum = new Set();
    const timeline = todosDias.map(dia => {
      acumSSC += (porDia[dia] || 0);
      const novosClientes = clientesPorDia[dia] || new Set();
      for (const c of novosClientes) clientesAcum.add(c);
      return {
        dia,
        novas: porDia[dia] || 0,
        acumulado: acumSSC,
        clientes_novos: novosClientes.size,
        clientes_acum: clientesAcum.size
      };
    });

    resultado.push({
      i_sai: ne.i_sai,
      i_psai: ne.i_psai,
      ssc_atual: ne.ssc_atual,
      cadastroPSAI: cadastro,
      gravidade,
      total_ssc: rows.length,
      total_clientes: todosClientes.size,
      ssc_na_geracao_sai: sscNaGeracaoSAI,
      primeiro_ssc: diasOrdenados[0] || null,
      ultimo_ssc: diasOrdenados[diasOrdenados.length - 1] || null,
      timeline
    });
  }

  console.log('\n[3/3] Salvando resultado...');
  const dir = path.dirname(OUTPUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(resultado, null, 2));
  console.log('  Salvo em: %s', OUTPUT);

  console.log('\nResumo:');
  for (const r of resultado) {
    console.log(
      '  SAI %d | %d SSCs | %d clientes | %d SSCs na geracao SAI | %s -> %s',
      r.i_sai, r.total_ssc, r.total_clientes,
      r.ssc_na_geracao_sai,
      r.primeiro_ssc || '(nenhuma)',
      r.ultimo_ssc || '-'
    );
  }

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
