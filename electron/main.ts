import { app, BrowserWindow, clipboard, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { loadSessionDetail } from '../src/backend/conversationParser';
import { searchSessions } from '../src/backend/search';
import { loadRecentSessions } from '../src/backend/sessionLoader';
import type { SearchOptions } from '../src/types';

function resolveIndexHtml(): string {
  const built = path.join(__dirname, '../src/index.html');
  if (fs.existsSync(built)) {
    return built;
  }
  return path.join(__dirname, '../../src/index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(resolveIndexHtml());
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('load-sessions', async () => {
  return await loadRecentSessions();
});

ipcMain.handle('load-session-detail', async (_event, filePath: string) => {
  return await loadSessionDetail(filePath);
});

ipcMain.handle('search-sessions', async (_event, options: SearchOptions) => {
  return await searchSessions(options);
});

ipcMain.handle('copy-text', async (_event, text: string) => {
  clipboard.writeText(text);
  return true;
});
