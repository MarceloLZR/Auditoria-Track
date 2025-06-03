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
  
  // Crear tabla de tareas (código actualizado)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditor TEXT NOT NULL,
      categoria TEXT NOT NULL,
      subtarea TEXT NOT NULL,
      porcentaje INTEGER NOT NULL DEFAULT 0,
      comentario TEXT,
      fecha_estimada_fin DATE,
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

    // Agregar columna de fecha estimada si no existe
    if (!columnNames.includes('fecha_estimada_fin')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN fecha_estimada_fin DATE;`);
      console.log('Columna fecha_estimada_fin agregada exitosamente');
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
      INSERT INTO tasks (auditor, categoria, subtarea, porcentaje, comentario, fecha_estimada_fin, fecha_creacion, fecha_actualizacion)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);
    const result = stmt.run(
      task.auditor, 
      task.categoria, 
      task.subtarea, 
      task.porcentaje, 
      task.comentario,
      task.fecha_estimada_fin || null
    );
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
      SET porcentaje = ?, 
          comentario = ?, 
          fecha_actualizacion = datetime('now', 'localtime'),
          revision_jefe = NULL,
          fecha_revision = NULL,
          estado_revision = 'pendiente'
      WHERE id = ?
    `);
    const result = stmt.run(updates.porcentaje, updates.comentario, id);
    return { success: true, changes: result.changes };
  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    return { success: false, error: error.message };
  }
});



//  función get-stats en main.js versión mejorada:

ipcMain.handle('get-stats', () => {
  try {
    // Obtener todas las tareas con información completa
    const todasLasTareas = db.prepare(` 
      SELECT 
        *,
        julianday('now') - julianday(fecha_creacion) as dias_transcurridos,
        CASE 
          WHEN fecha_estimada_fin IS NOT NULL 
          THEN julianday(fecha_estimada_fin) - julianday(fecha_creacion)
          ELSE NULL
        END as dias_totales_planeados,
        CASE 
          WHEN fecha_estimada_fin IS NOT NULL AND fecha_estimada_fin < date('now') AND porcentaje < 100
          THEN 1 ELSE 0
        END as es_vencida,
        CASE 
          WHEN fecha_estimada_fin IS NOT NULL 
          THEN CASE
            WHEN julianday(fecha_estimada_fin) - julianday(fecha_creacion) > 0
            THEN (julianday('now') - julianday(fecha_creacion)) / (julianday(fecha_estimada_fin) - julianday(fecha_creacion)) * 100
            ELSE 100
          END
          ELSE NULL
        END as progreso_esperado_tiempo
      FROM tasks
    `).all();

    // Calcular estadísticas avanzadas por auditor
    const auditoresUnicos = [...new Set(todasLasTareas.map(t => t.auditor))];
    
    const auditorStats = auditoresUnicos.map(auditor => {
      const tareasAuditor = todasLasTareas.filter(t => t.auditor === auditor);
      const totalTareas = tareasAuditor.length;
      const tareasCompletadas = tareasAuditor.filter(t => t.porcentaje === 100).length;
      const tareasConFecha = tareasAuditor.filter(t => t.fecha_estimada_fin !== null);
      const tareasVencidas = tareasAuditor.filter(t => t.es_vencida === 1).length;
      
      // 1. Progreso Real Promedio
      const progresoRealPromedio = totalTareas > 0 
        ? tareasAuditor.reduce((sum, t) => sum + t.porcentaje, 0) / totalTareas 
        : 0;

      // 2. Índice de Rendimiento Ponderado (IRP)
      let indiceRendimientoPonderado = 100; // Default si no hay tareas con fecha
      if (tareasConFecha.length > 0) {
        const sumaRendimientos = tareasConFecha.reduce((sum, tarea) => {
          const progresoEsperado = Math.max(1, tarea.progreso_esperado_tiempo || 1);
          const rendimiento = (tarea.porcentaje / progresoEsperado) * 100;
          return sum + Math.min(200, rendimiento); // Cap al 200% para evitar valores extremos
        }, 0);
        indiceRendimientoPonderado = sumaRendimientos / tareasConFecha.length;
      }

      // 3. Índice de Cumplimiento de Plazos (ICP)
      const indiceCumplimientoPlazos = tareasConFecha.length > 0
        ? ((tareasConFecha.length - tareasVencidas) / tareasConFecha.length) * 100
        : 100;

      // 4. Índice de Productividad (IP)
      const diasPromedioPorTarea = totalTareas > 0
        ? tareasAuditor.reduce((sum, t) => sum + t.dias_transcurridos, 0) / totalTareas
        : 1;
      const indiceProductividad = diasPromedioPorTarea > 0 
        ? (tareasCompletadas / diasPromedioPorTarea) * 10 // Escalado para mejor visualización
        : 0;

      // 5. Puntuación Global del Auditor (PGA)
      const puntuacionGlobal = (
        (Math.min(150, indiceRendimientoPonderado) * 0.4) + // Cap IRP en 150% para el cálculo final
        (indiceCumplimientoPlazos * 0.3) + 
        (Math.min(100, indiceProductividad * 10) * 0.3) // Escalar y cap IP
      );

      // 6. Días promedio hasta completar tareas
      const tareasCompletadasConTiempo = tareasAuditor.filter(t => t.porcentaje === 100);
      const diasPromedioComplecion = tareasCompletadasConTiempo.length > 0
        ? tareasCompletadasConTiempo.reduce((sum, t) => sum + t.dias_transcurridos, 0) / tareasCompletadasConTiempo.length
        : 0;

      return {
        auditor,
        total_tareas: totalTareas,
        tareas_completadas: tareasCompletadas,
        tareas_con_fecha: tareasConFecha.length,
        tareas_vencidas: tareasVencidas,
        
        // Métricas básicas
        promedio_avance: Math.round(progresoRealPromedio * 100) / 100,
        porcentaje_completadas: totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0,
        
        // Métricas avanzadas
        indice_rendimiento_ponderado: Math.round(indiceRendimientoPonderado * 100) / 100,
        indice_cumplimiento_plazos: Math.round(indiceCumplimientoPlazos * 100) / 100,
        indice_productividad: Math.round(indiceProductividad * 100) / 100,
        puntuacion_global: Math.round(puntuacionGlobal * 100) / 100,
        dias_promedio_completar: Math.round(diasPromedioComplecion * 10) / 10,
        
        // Para clasificación de rendimiento
        nivel_rendimiento: puntuacionGlobal >= 85 ? 'Excelente' : 
                          puntuacionGlobal >= 70 ? 'Bueno' : 
                          puntuacionGlobal >= 50 ? 'Regular' : 'Necesita Mejora'
      };
    });

    // Estadísticas por categoría (mejoradas)
    const categoriasUnicas = [...new Set(todasLasTareas.map(t => t.categoria))];
    const categoriaStats = categoriasUnicas.map(categoria => {
      const tareasCategoria = todasLasTareas.filter(t => t.categoria === categoria);
      const tareasConFecha = tareasCategoria.filter(t => t.fecha_estimada_fin !== null);
      
      const progresoPromedio = tareasCategoria.length > 0
        ? tareasCategoria.reduce((sum, t) => sum + t.porcentaje, 0) / tareasCategoria.length
        : 0;

      const cumplimientoPlazos = tareasConFecha.length > 0
        ? ((tareasConFecha.length - tareasConFecha.filter(t => t.es_vencida === 1).length) / tareasConFecha.length) * 100
        : 100;

      return {
        categoria,
        total_tareas: tareasCategoria.length,
        promedio_avance: Math.round(progresoPromedio * 100) / 100,
        cumplimiento_plazos: Math.round(cumplimientoPlazos * 100) / 100,
        tareas_completadas: tareasCategoria.filter(t => t.porcentaje === 100).length
      };
    });

    // Estadísticas globales mejoradas
    const totalTareas = todasLasTareas.length;
    const tareasCompletadas = todasLasTareas.filter(t => t.porcentaje === 100).length;
    const tareasConFecha = todasLasTareas.filter(t => t.fecha_estimada_fin !== null).length;
    const tareasVencidas = todasLasTareas.filter(t => t.es_vencida === 1).length;
    const tareasProximasVencer = todasLasTareas.filter(t => 
      t.fecha_estimada_fin && 
      new Date(t.fecha_estimada_fin) >= new Date() && 
      new Date(t.fecha_estimada_fin) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
      t.porcentaje < 100
    ).length;

    const promedioAvanceGlobal = totalTareas > 0
      ? todasLasTareas.reduce((sum, t) => sum + t.porcentaje, 0) / totalTareas
      : 0;

    // Avance ponderado por tiempo mejorado
    const tareasConFechaValida = todasLasTareas.filter(t => 
      t.fecha_estimada_fin && t.progreso_esperado_tiempo !== null
    );
    
    let avancePonderadoTiempo = 0;
    if (tareasConFechaValida.length > 0) {
      const sumaEficiencias = tareasConFechaValida.reduce((sum, tarea) => {
        const progresoEsperado = Math.max(1, tarea.progreso_esperado_tiempo);
        const eficiencia = (tarea.porcentaje / progresoEsperado) * 100;
        return sum + Math.min(200, eficiencia); // Cap para evitar valores extremos
      }, 0);
      avancePonderadoTiempo = sumaEficiencias / tareasConFechaValida.length;
    }

    const globalStats = {
      total_tareas: totalTareas,
      promedio_avance_global: Math.round(promedioAvanceGlobal * 100) / 100,
      tareas_completadas: tareasCompletadas,
      tareas_con_fecha: tareasConFecha,
      tareas_vencidas: tareasVencidas,
      tareas_proximas_vencer: tareasProximasVencer,
      avance_ponderado_tiempo: Math.round(avancePonderadoTiempo * 100) / 100,
      porcentaje_completadas_global: totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0,
      cumplimiento_plazos_global: tareasConFecha > 0 ? Math.round(((tareasConFecha - tareasVencidas) / tareasConFecha) * 100) : 100
    };

    return {
      auditorStats: auditorStats.sort((a, b) => b.puntuacion_global - a.puntuacion_global),
      categoriaStats,
      globalStats
    };
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return { 
      auditorStats: [], 
      categoriaStats: [],
      globalStats: {
        total_tareas: 0,
        promedio_avance_global: 0,
        tareas_completadas: 0,
        tareas_con_fecha: 0,
        tareas_vencidas: 0,
        tareas_proximas_vencer: 0,
        avance_ponderado_tiempo: 0,
        porcentaje_completadas_global: 0,
        cumplimiento_plazos_global: 0
      }
    };
  }
});

// Agrega este nuevo IPC handler después de los existentes:
ipcMain.handle('update-revision', (event, id, revisionData) => {
  try {
    const stmt = db.prepare(`
      UPDATE tasks 
      SET revision_jefe = ?, fecha_revision = datetime('now', 'localtime'), estado_revision = ?, auditor_revisor = ?
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