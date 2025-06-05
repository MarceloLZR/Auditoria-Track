# Sistema de Seguimiento de Tareas - Auditores

## 📋 Descripción
Sistema de escritorio desarrollado con Electron para que 4 auditores registren y visualicen su progreso en tareas. Completamente local, sin necesidad de conexión a internet.

## ✨ Características
- 🖥️ **Aplicación de escritorio** con Electron
- 📊 **Dashboard visual** con gráficos interactivos
- 💾 **Base de datos local** SQLite
- 🚀 **Ejecutable portable** (.exe)
- 👥 **4 auditores** predefinidos
- 📁 **6 categorías** de tareas predefinidas
- 📈 **Seguimiento de progreso** en tiempo real

## 🛠️ Tecnologías Utilizadas
- **Frontend**: HTML5, CSS3, JavaScript ES6
- **Backend**: Node.js (integrado en Electron)
- **Base de datos**: SQLite con better-sqlite3
- **Gráficos**: Chart.js
- **Empaquetado**: electron-builder

## 📦 Instalación y Configuración

### Prerrequisitos
- Node.js (versión 16 o superior)
- npm o yarn

### Pasos de instalación

1. **Clonar o descargar los archivos del proyecto**
   ```bash
   # Crear directorio del proyecto
   mkdir auditores-progress-tracker
   cd auditores-progress-tracker
   ```

2. **Copiar todos los archivos del proyecto al directorio**
   - package.json
   - main.js
   - index.html
   - styles.css
   - renderer.js
   - README.md

3. **Instalar dependencias**
   ```bash
   npm install
   ```

4. **Crear carpeta de assets (opcional)**
   ```bash
   mkdir assets
   # Agregar icon.png y icon.ico para el icono de la aplicación
   ```

## 🚀 Uso

### Modo Desarrollo
```bash
npm start
```

### Compilar Ejecutable
```bash
npm run build
```
El ejecutable portable se generará en la carpeta `dist/`

## 📋 Funcionalidades

### 1. Registro de Tareas
- Selección de auditor (Auditor 1-4)
- Selección de categoría predefinida
- Nombre de subtarea personalizable
- Porcentaje de avance (0-100%)
- Comentarios opcionales

### 2. Categorías Predefinidas
1. Auditorías 
2. Auditoría continua
3. Seguimiento de observaciones internas
4. Seguimiento de observaciones regulatorias
5. Reportes SIRAI
6. Capacitaciones
7. Trabajos adicionales

### 3. Dashboard Visual
- Gráfico de dona: Progreso por auditor
- Gráfico de barras: Progreso por categoría
- Estadísticas generales
- Vista en tiempo real

### 4. Gestión de Tareas
- Lista completa de tareas
- Filtros por auditor y categoría
- Edición de progreso y comentarios
- Eliminación de tareas

## 🗄️ Base de Datos

La aplicación utiliza SQLite con el siguiente esquema:

```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auditor TEXT NOT NULL,
    categoria TEXT NOT NULL,
    subtarea TEXT NOT NULL,
    porcentaje INTEGER NOT NULL DEFAULT 0,
    comentario TEXT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

El archivo de base de datos se crea automáticamente en `data/auditores.db`

## 📁 Estructura del Proyecto
```
auditores-progress-tracker/
├── package.json          # Configuración del proyecto
├── main.js              # Proceso principal de Electron
├── index.html           # Interfaz principal
├── styles.css           # Estilos CSS
├── renderer.js          # Lógica del frontend
├── README.md            # Documentación
├── data/                # Carpeta de base de datos (se crea automáticamente)
│   └── auditores.db     # Base de datos SQLite
├── assets/              # Recursos (iconos, etc.)
└── dist/                # Ejecutables compilados
```

## 🔧 Configuración Avanzada

### Cambiar Auditores
Para modificar los nombres de los auditores, editar en `renderer.js`:
```javascript
const AUDITORES = ['Auditor 1', 'Auditor 2', 'Auditor 3', 'Auditor 4'];
```

### Agregar Categorías
Para modificar las categorías, editar en `renderer.js`:
```javascript
const CATEGORIAS = [
    'Nueva categoría',
    // ... otras categorías
];
```

### Personalizar Iconos
1. Agregar `icon.png` (256x256) en la carpeta `assets/`
2. Para Windows, agregar también `icon.ico`

## ⚠️ Consideraciones Importantes

### Uso Simultáneo
- **Evitar uso simultáneo** de múltiples usuarios para prevenir conflictos en SQLite
- Recomendado: Un usuario a la vez

### Respaldo de Datos
- La base de datos se encuentra en `data/auditores.db`
- Realizar respaldos periódicos de este archivo

### Requisitos del Sistema
- Windows 7 o superior
- 100 MB de espacio en disco
- No requiere conexión a internet

## 🐛 Solución de Problemas

### Error al iniciar
1. Verificar que Node.js esté instalado
2. Ejecutar `npm install` nuevamente
3. Verificar permisos de escritura en la carpeta

### Base de datos corrupta
1. Eliminar `data/auditores.db`
2. Reiniciar la aplicación (se creará nueva BD)

### Gráficos no se muestran
1. Verificar conexión a CDN de Chart.js
2. Usar versión offline si es necesario

## 📞 Soporte
Para reportar problemas o solicitar nuevas funcionalidades, documentar:
- Versión del sistema operativo
- Pasos para reproducir el problema
- Capturas de pantalla si es relevante

## 📝 Licencia
Este proyecto es de uso interno. Todos los derechos reservados.

---
**Versión**: 1.0.0  
**Última actualización**: Mayo 2025