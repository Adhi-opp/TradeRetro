// playwright-qa.js
// Automated frontend verification for TradeRetro
// No code modifications to the application itself.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const baseUrl = 'http://localhost:5173'; // Vite dev server default
  const outputRoot = path.resolve(__dirname, '..', 'QA');
  const screenshotsDir = path.join(outputRoot, 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const consoleLogPath = path.join(outputRoot, 'console.log');
  const networkLogPath = path.join(outputRoot, 'network.log');
  const runtimeErrPath = path.join(outputRoot, 'runtime-errors.md');

  const consoleStream = fs.createWriteStream(consoleLogPath, { flags: 'w' });
  const networkStream = fs.createWriteStream(networkLogPath, { flags: 'w' });
  const runtimeErrStream = fs.createWriteStream(runtimeErrPath, { flags: 'w' });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleStream.write(`[${type}] ${text}\n`);
  });

  // Capture runtime errors (uncaught exceptions)
  page.on('pageerror', error => {
    runtimeErrStream.write(`- ${error.message}\n`);
  });

  // Capture network failures
  page.on('requestfailed', request => {
    const failure = request.failure();
    networkStream.write(`${request.method()} ${request.url()} - ${failure?.errorText || 'unknown'}\n`);
  });

  // List of pages to visit (paths and friendly names)
  const pages = [
    { path: '/', name: 'dashboard' },
    { path: '/strategy-builder', name: 'strategy-builder' },
    { path: '/historical-data', name: 'historical-data' },
    { path: '/settings', name: 'settings' },
    { path: '/walkforward', name: 'walkforward' },
    { path: '/parameter-sweep', name: 'parameter-sweep' },
    { path: '/cross-asset-monitor', name: 'cross-asset' },
    { path: '/data-quality-dashboard', name: 'data-quality-dashboard' },
    { path: '/ticker-input', name: 'ticker-input' },
    { path: '/execution-summary', name: 'execution-summary' },
    { path: '/trade-history', name: 'trade-history' }
  ];

  for (const p of pages) {
    try {
      await page.goto(`${baseUrl}${p.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000); // allow UI to settle
      const screenshotPath = path.join(screenshotsDir, `${p.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (e) {
      runtimeErrStream.write(`Failed to capture ${p.name}: ${e.message}\n`);
    }
  }

  // Attempt a simple backtest execution if UI provides a button with text "Run Backtest"
  try {
    await page.goto(`${baseUrl}/strategy-builder`, { waitUntil: 'networkidle' });
    const btn = await page.$('text="Run Backtest"');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(5000); // wait for results
      await page.screenshot({ path: path.join(screenshotsDir, 'backtest-result.png'), fullPage: true });
    } else {
      runtimeErrStream.write('Backtest button not found on Strategy Builder page.\n');
    }
  } catch (e) {
    runtimeErrStream.write(`Backtest execution error: ${e.message}\n`);
  }

  await browser.close();
  consoleStream.end();
  networkStream.end();
  runtimeErrStream.end();
}

main().catch(err => {
  console.error('Fatal error in QA script:', err);
  process.exit(1);
});
