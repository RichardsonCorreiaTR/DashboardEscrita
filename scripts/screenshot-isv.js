#!/usr/bin/env node
/**
 * Captura screenshot do ISV (Índice de Saúde da Versão) - Foco NE Bruta
 * para a versão especificada. Requer o servidor rodando em http://localhost:4000
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TARGET_VERSION = '10.6A-02';
const URL = 'http://localhost:4000/estudos.html?view=semanal-versao';
const OUTPUT_PATH = path.join(__dirname, '..', 'output', 'screenshot-isv-10.6A-02.png');

async function main() {
  console.log('[screenshot-isv] Iniciando...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('[screenshot-isv] Página carregada, aguardando 5s para dados...');
    await page.waitForTimeout(5000);

    // Esperar loading inicial desaparecer
    await page.waitForFunction(
      () => document.getElementById('loading')?.hidden === true,
      { timeout: 30000 }
    ).catch(() => console.warn('[screenshot-isv] Loading ainda visível após 30s, continuando...'));

    // Verificar se existe seletor de versão e selecionar 10.6A-02
    const versaoSelector = await page.$('#seletor-versao');
    if (versaoSelector) {
      const options = await page.$$eval('#seletor-versao option', opts =>
        opts.map(o => o.value)
      );
      if (options.includes(TARGET_VERSION)) {
        await page.select('#seletor-versao', TARGET_VERSION);
        console.log(`[screenshot-isv] Versão ${TARGET_VERSION} selecionada`);
        // Aguardar loading reaparecer e sumir novamente após troca de versão
        await page.waitForFunction(
          () => document.getElementById('loading')?.hidden === true,
          { timeout: 35000 }
        );
        await page.waitForTimeout(2000); // Charts
      } else {
        console.warn(`[screenshot-isv] Versão ${TARGET_VERSION} não encontrada. Opções:`, options);
      }
    }

    // Aguardar painel ISV aparecer
    await page.waitForSelector('#saude-container', { timeout: 10000 });
    await page.waitForTimeout(2000); // Charts podem demorar

    await page.screenshot({
      path: OUTPUT_PATH,
      fullPage: true,
      type: 'png'
    });

    console.log(`[screenshot-isv] Screenshot salvo em: ${OUTPUT_PATH}`);
  } catch (err) {
    console.error('[screenshot-isv] Erro:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
