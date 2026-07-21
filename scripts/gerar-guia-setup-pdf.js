/**
 * Gera PDF do guia de setup para Mariana a partir de docs/guia-setup-mariana.html
 * Uso: node scripts/gerar-guia-setup-pdf.js
 * Fallback: Edge headless (--print-to-pdf) se Puppeteer falhar.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'docs', 'guia-setup-mariana.html');
const PDF = path.join(ROOT, 'output', 'guia-setup-dashboard-mariana.pdf');

function gerarViaEdge() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ];
  const edge = candidates.find(p => fs.existsSync(p));
  if (!edge) throw new Error('Microsoft Edge nao encontrado para gerar PDF');
  fs.mkdirSync(path.dirname(PDF), { recursive: true });
  const url = 'file:///' + HTML.replace(/\\/g, '/');
  execFileSync(edge, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    '--print-to-pdf=' + PDF, url
  ], { stdio: 'ignore' });
}

async function gerarViaPuppeteer() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 180000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(fs.readFileSync(HTML, 'utf8'), { waitUntil: 'networkidle0' });
  await page.pdf({
    path: PDF, format: 'A4', printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' }
  });
  await browser.close();
}

async function main() {
  if (!fs.existsSync(HTML)) throw new Error('HTML nao encontrado: ' + HTML);
  try {
    await gerarViaPuppeteer();
  } catch {
    gerarViaEdge();
  }
  console.log('PDF gerado:', PDF);
}

main().catch(err => { console.error(err); process.exit(1); });
