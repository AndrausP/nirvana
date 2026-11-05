// Gera build/icon.png (512x512) a partir do LOGO do app. Uso: npx electron build/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'icons.js'), 'utf8');
const svg = (src.match(/const LOGO = `([\s\S]*?)`;/) || [])[1];
if (!svg) { console.error('LOGO não encontrado'); process.exit(1); }
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, webPreferences: { offscreen: false } });
  const big = svg.replace(/width="34" height="34"/, 'width="360" height="360"');
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<body style="margin:0;width:512px;height:512px;display:grid;place-items:center;background:#07060d;border-radius:112px;overflow:hidden">${big}</body>`));
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'icon.png'), img.toPNG());
  console.log('icon.png ok', img.getSize());
  app.quit();
});
