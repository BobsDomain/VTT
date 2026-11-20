// The loading screen (#23): a small window that shows the moment the app starts, until the main window is ready.
const { BrowserWindow } = require('electron');
const path = require('path');

function openSplash(app, status) {
  const win = new BrowserWindow({ width: 420, height: 280, frame: false, resizable: false, movable: true, show: false, center: true, skipTaskbar: false, backgroundColor: '#121212',
    title: app, icon: path.join(__dirname, '..', '..', 'build', 'icon.png'), webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
  const shownAt = Date.now();
  win.loadFile(path.join(__dirname, 'splash.html'), { query: { app, status: status || 'Starting…', v: require('../../package.json').version } });
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
  return {
    status(text) { if (!win.isDestroyed()) win.webContents.executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(String(text))})`).catch(() => {}); },
    // close it, after at least a moment so it doesn't just flicker
    close(min = 700) { const wait = Math.max(0, min - (Date.now() - shownAt)); setTimeout(() => { if (!win.isDestroyed()) win.close(); }, wait); }
  };
}

// wait for the table page to say it has drawn its map (window.tabletopReady), or give up after a while
function whenTableReady(main, done, maxMs = 20000) {
  const t0 = Date.now();
  const poll = () => {
    if (main.isDestroyed()) return;
    main.webContents.executeJavaScript('!!window.tabletopReady').then((ok) => { if (ok || Date.now() - t0 > maxMs) done(); else setTimeout(poll, 200); }).catch(() => { if (Date.now() - t0 > maxMs) done(); else setTimeout(poll, 300); });
  };
  poll();
}
module.exports = { openSplash, whenTableReady };
