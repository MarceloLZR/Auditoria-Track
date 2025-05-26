const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

let mainWindow;
let db;

// ✅ Carpeta compartida (por ejemplo, C:/AuditoriaData)
const dataDir = '\\\\b200603sv214\\groupscentral$\\Map_W\\GGBP200_Auditoria_Compartido\\2025\\CODIGOS\\DB\\AuditoriaData';
//const dataDir = path.join('C:', 'AuditoriaData');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ✅ Ruta fija a la base de datos
const dbPath = path.join(dataDir, 'auditores.db');

// ✅ Si no existe, copiar desde resources (solo producción)
const sourceDbPath = path.join(process.resourcesPath, 'assets', 'auditores.db');
if (!fs.existsSync(dbPath)) {
  fs.copyFileSync(sourceDbPath, dbPath);
}

function initDatabase() {
  db = new Database(dbPath);
  
  // Crear tabla de tareas (código existente)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditor TEXT NOT NULL,
      categoria TEXT NOT NULL,
      subtarea TEXT NOT NULL,
      porcentaje INTEGER NOT NULL DEFAULT 0,
      comentario TEXT,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      revision_jefe TEXT,
      fecha_revision DATETIME,
      estado_revision TEXT DEFAULT 'pendiente',
      auditor_revisor TEXT DEFAULT 'Manuel Nuñez'
    )
  `);
  
  // Actualizar tabla existente si es necesario
  updateDatabase();
  
  console.log('Base de datos inicializada');
}

function updateDatabase() {
  try {
    // Verificar si las columnas ya existen
    const tableInfo = db.pragma('table_info(tasks)');
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('revision_jefe')) {
      db.exec(`
        ALTER TABLE tasks ADD COLUMN revision_jefe TEXT;
        ALTER TABLE tasks ADD COLUMN fecha_revision DATETIME;
        ALTER TABLE tasks ADD COLUMN estado_revision TEXT DEFAULT 'pendiente';
        ALTER TABLE tasks ADD COLUMN auditor_revisor TEXT DEFAULT 'Manuel Nuñez';
      `);
      console.log('Columnas de revisión agregadas exitosamente');
    }
  } catch (error) {
    console.error('Error al actualizar base de datos:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets', 'app_icon.ico')
  });

  mainWindow.loadFile('index.html');
  
  // Opcional: abrir DevTools en desarrollo
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});

// IPC handlers para comunicación con el frontend
ipcMain.handle('get-tasks', () => {
  try {
    const stmt = db.prepare('SELECT * FROM tasks ORDER BY fecha_actualizacion DESC');
    return stmt.all();
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    return [];
  }
});

ipcMain.handle('add-task', (event, task) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO tasks (auditor, categoria, subtarea, porcentaje, comentario)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(task.auditor, task.categoria, task.subtarea, task.porcentaje, task.comentario);
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('Error al agregar tarea:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-task', (event, id, updates) => {
  try {
    const stmt = db.prepare(`
      UPDATE tasks 
      SET porcentaje = ?, comentario = ?, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(updates.porcentaje, updates.comentario, id);
    return { success: true, changes: result.changes };
  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-task', (event, id) => {
  try {
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    return { success: true, changes: result.changes };
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-stats', () => {
  try {
    // Estadísticas por auditor
    const auditorStats = db.prepare(`
      SELECT 
        auditor,
        COUNT(*) as total_tareas,
        AVG(porcentaje) as promedio_avance,
        SUM(CASE WHEN porcentaje = 100 THEN 1 ELSE 0 END) as tareas_completadas
      FROM tasks 
      GROUP BY auditor
    `).all();

    // Estadísticas por categoría
    const categoriaStats = db.prepare(`
      SELECT 
        categoria,
        COUNT(*) as total_tareas,
        AVG(porcentaje) as promedio_avance
      FROM tasks 
      GROUP BY categoria
    `).all();

    return {
      auditorStats,
      categoriaStats
    };
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return { auditorStats: [], categoriaStats: [] };
  }
});

// Agrega este nuevo IPC handler después de los existentes:
ipcMain.handle('update-revision', (event, id, revisionData) => {
  try {
    const stmt = db.prepare(`
      UPDATE tasks 
      SET revision_jefe = ?, fecha_revision = CURRENT_TIMESTAMP, estado_revision = ?, auditor_revisor = ?
      WHERE id = ?
    `);
    const estado = revisionData.revision.trim() ? 'revisado' : 'pendiente';
    const result = stmt.run(revisionData.revision, estado, revisionData.auditorRevisor, id);
    return { success: true, changes: result.changes };
  } catch (error) {
    console.error('Error al actualizar revisión:', error);
    return { success: false, error: error.message };
  }
});