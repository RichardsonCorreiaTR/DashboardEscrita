/**
 * regressao.js - Regressao linear por minimos quadrados (OLS)
 *
 * Aprende pesos reais dos sinais a partir de dados historicos.
 * Resolve y = b0 + b1*x1 + b2*x2 + ... via equacoes normais.
 */

const { round2 } = require('../estatisticas-ne');

function treinar(dados, lambda) {
  const n = dados.length;
  if (n < 4) return null;
  const p = dados[0].x.length;
  if (p === 0) return null;

  const X = dados.map(d => [1, ...d.x]);
  const y = dados.map(d => d.y);
  const cols = p + 1;
  const ridge = lambda || 0;

  const XtX = Array.from({ length: cols }, () => new Array(cols).fill(0));
  const Xty = new Array(cols).fill(0);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < cols; i++) {
      Xty[i] += X[k][i] * y[k];
      for (let j = i; j < cols; j++) {
        const v = X[k][i] * X[k][j];
        XtX[i][j] += v;
        if (i !== j) XtX[j][i] += v;
      }
    }
  }
  if (ridge > 0) for (let i = 1; i < cols; i++) XtX[i][i] += ridge;

  const coefs = resolver(XtX, Xty);
  if (!coefs) return null;

  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (let k = 0; k < n; k++) {
    let pred = 0;
    for (let i = 0; i < cols; i++) pred += coefs[i] * X[k][i];
    ssRes += (y[k] - pred) ** 2;
    ssTot += (y[k] - yMean) ** 2;
  }
  return { coefs, r2: ssTot > 0 ? round2(1 - ssRes / ssTot) : 0, n, ridge };
}

function prever(modelo, x) {
  if (!modelo) return null;
  let v = modelo.coefs[0];
  for (let i = 0; i < x.length; i++) v += modelo.coefs[i + 1] * (x[i] || 0);
  return v;
}

function resolver(A, b) {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxR = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxR][col])) maxR = r;
    }
    [aug[col], aug[maxR]] = [aug[maxR], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-10) return null;
    for (let r = col + 1; r < n; r++) {
      const f = aug[r][col] / aug[col][col];
      for (let j = col; j <= n; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j];
    x[i] /= aug[i][i];
  }
  return x;
}

module.exports = { treinar, prever };
