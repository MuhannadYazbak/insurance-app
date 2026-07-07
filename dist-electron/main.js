import { ipcMain, app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const dbPath = path.join(process.cwd(), "agency.db");
const db = new Database(dbPath);
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
    licensePlate TEXT UNIQUE NOT NULL, -- מספר רכב
    make TEXT,                         -- יצרן
    model TEXT,                        -- דגם
    year TEXT,                         -- שנת ייצור
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    vehicleId INTEGER,                  -- Optional: can link directly to a car
    policyNumber TEXT UNIQUE NOT NULL,  -- מספר פוליסה
    company TEXT,                       -- חברת ביטוח (הפניקס, מגדל, וכו')
    policyType TEXT,                    -- מקיף, חובה, צד ג
    startDate TEXT,
    endDate TEXT,
    premium REAL,                       -- עלות הפרמיה
    FOREIGN KEY(clientId) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY(vehicleId) REFERENCES vehicles(id) ON DELETE SET NULL
  );
`);
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, "index.html"));
  }
}
ipcMain.handle("get-clients", async () => {
  try {
    const stmt = db.prepare("SELECT * FROM clients ORDER BY id DESC");
    return stmt.all();
  } catch (err) {
    console.error("Failed to fetch clients:", err);
    return [];
  }
});
ipcMain.handle("add-client", async (event, { name, nationalId, phone }) => {
  try {
    const stmt = db.prepare("INSERT INTO clients (name, nationalId, phone) VALUES (?, ?, ?)");
    stmt.run(name, nationalId, phone);
    return { success: true };
  } catch (err) {
    console.error("Failed to add client:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("get-client-vehicles", async (event, clientId) => {
  try {
    const stmt = db.prepare("SELECT * FROM vehicles WHERE clientId = ?");
    return stmt.all(clientId);
  } catch (err) {
    console.error("Failed to fetch vehicles:", err);
    return [];
  }
});
ipcMain.handle("add-vehicle", async (event, { clientId, licensePlate, make, model, year }) => {
  try {
    const stmt = db.prepare("INSERT INTO vehicles (clientId, licensePlate, make, model, year) VALUES (?, ?, ?, ?, ?)");
    stmt.run(clientId, licensePlate, make, model, year);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle("get-client-policies", async (event, clientId) => {
  try {
    const stmt = db.prepare("SELECT * FROM policies WHERE clientId = ?");
    return stmt.all(clientId);
  } catch (err) {
    return [];
  }
});
ipcMain.handle("add-policy", async (event, { clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium }) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO policies (clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(clientId, vehicleId, policyNumber, company, policyType, startDate, endDate, premium);
    return { success: true };
  } catch (err) {
    console.error("Failed to add policy:", err);
    return { success: false, error: err.message };
  }
});
app.whenReady().then(createWindow);
