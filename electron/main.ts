// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Environment & Path Configurations ---
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// If packaged, dist-electron/main.js is running inside resources/app.asar/dist-electron/
// index.html is sitting right next door in resources/app.asar/dist/
const DIST_PATH = app.isPackaged 
  ? path.join(app.getAppPath(), 'dist') 
  : path.join(__dirname, '../dist');

// --- SQLite Database Safe Initialization ---
const dbPath = app.isPackaged 
  ? path.join(app.getPath('userData'), 'agency.db') 
  : path.join(process.cwd(), 'agency.db');

const db = new Database(dbPath);

// Ensure database tables exist with relational constraints
// Update this specific block inside electron/main.ts
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nationalId TEXT UNIQUE NOT NULL,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    licensePlate TEXT UNIQUE NOT NULL,
    make TEXT,
    model TEXT,
    year TEXT,
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'active',
    clientId INTEGER NOT NULL,
    vehicleId INTEGER,
    policyNumber TEXT UNIQUE NOT NULL,
    company TEXT,
    policyType TEXT,
    startDate TEXT,
    endDate TEXT,
    premium REAL,
    coverageDetails TEXT, -- ◄--- ADD THIS LINE HERE
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY(vehicleId) REFERENCES vehicles(id) ON DELETE SET NULL
  );
`);

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

  // Keep DevTools open in production so we can spot any unhandled errors
  //win.webContents.openDevTools();

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // Load the file using the clean, unified static build directory path
    win.loadFile(path.join(DIST_PATH, 'index.html'));
  }
}

// --- IPC Handlers connected to SQLite queries ---

ipcMain.handle('get-clients', async () => {
  try {
    const stmt = db.prepare('SELECT * FROM clients ORDER BY id DESC');
    return stmt.all();
  } catch (err) {
    console.error('Failed to fetch clients:', err);
    return [];
  }
});

ipcMain.handle('add-client', async (event, { name, nationalId, phone }) => {
  try {
    const stmt = db.prepare('INSERT INTO clients (name, nationalId, phone) VALUES (?, ?, ?)');
    stmt.run(name, nationalId, phone);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to add client:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-client-vehicles', async (event, clientId) => {
  try {
    const stmt = db.prepare('SELECT * FROM vehicles WHERE clientId = ?');
    return stmt.all(clientId);
  } catch (err) {
    console.error('Failed to fetch vehicles:', err);
    return [];
  }
});

ipcMain.handle('add-vehicle', async (event, { clientId, licensePlate, make, model, year }) => {
  try {
    const stmt = db.prepare('INSERT INTO vehicles (clientId, licensePlate, make, model, year) VALUES (?, ?, ?, ?, ?)');
    stmt.run(clientId, licensePlate, make, model, year);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-client-policies', async (event, clientId) => {
  try {
    const stmt = db.prepare('SELECT * FROM policies WHERE clientId = ?');
    return stmt.all(clientId);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('add-policy', async (event, { clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium, coverageDetails }) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO policies (clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium, coverageDetails) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Pass coverageDetails as the last argument matching the SQL placeholder
    stmt.run(clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium, coverageDetails);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to add policy:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-policy-status', async (event, policyId, newStatus) => {
  try {
    const stmt = db.prepare('UPDATE policies SET status = ? WHERE id = ?');
    stmt.run(newStatus, policyId);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to update policy status:', err);
    return { success: false, error: err.message };
  }
});

// --- Lifecycle Handlers ---

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});