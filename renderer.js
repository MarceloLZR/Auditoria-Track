const { ipcRenderer } = require('electron');

// Variables globales
let tasks = [];
let auditorChart = null;
let categoriaChart = null;

// Categorías predefinidas
const CATEGORIAS = [
    'Auditorías y trabajos adicionales',
    'Auditoría continua', 
    'Seguimiento de observaciones internas',
    'Seguimiento de observaciones regulatorias',
    'Reportes SIRAI',
    'Capacitaciones'
];

const AUDITORES = ['Priscila Pajuelo', 'Monica Bilbao', 'Marcelo Nuñez', 'Lautaro Ballesteros'];

function actualizarSelectAuditores() {
    const selects = [
        document.getElementById('auditorFilter'),
        document.getElementById('auditor')
    ];

    selects.forEach(select => {
        if (!select) return;

        // Guarda la primera opción (ej. "Todos los auditores" o "Seleccionar auditor")
        const primerOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(primerOption);

        // Agrega los nombres reales
        AUDITORES.forEach(nombre => {
            const option = document.createElement('option');
            option.value = nombre;
            option.textContent = nombre;
            select.appendChild(option);
        });
    });
}


// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    actualizarSelectAuditores(); // 👈 AÑADE ESTA LÍNEA
    loadTasks();
    showTab('dashboard');
});

// Event Listeners
function initializeEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            showTab(tabName);
        });
    });

    // Formulario de nueva tarea
    document.getElementById('taskForm').addEventListener('submit', handleAddTask);
    document.getElementById('editForm').addEventListener('submit', handleEditTask);
    
    // Botones
    document.getElementById('refreshBtn').addEventListener('click', loadTasks);
    document.getElementById('addTaskBtn').addEventListener('click', () => showTab('add-task'));
    document.getElementById('cancelBtn').addEventListener('click', clearForm);

    // Sliders
    document.getElementById('porcentaje').addEventListener('input', function() {
        document.getElementById('porcentajeValue').textContent = this.value + '%';
    });
    
    document.getElementById('editPorcentaje').addEventListener('input', function() {
        document.getElementById('editPorcentajeValue').textContent = this.value + '%';
    });

    // Filtros
    document.getElementById('auditorFilter').addEventListener('change', filterTasks);
    document.getElementById('categoriaFilter').addEventListener('change', filterTasks);

    // Modal
    document.querySelector('.close').addEventListener('click', closeEditModal);
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('editModal')) {
            closeEditModal();
        }
    });
    
    // Formulario de revisión
    document.getElementById('revisionForm').addEventListener('submit', handleRevision);
    
    // Modal de revisión
    document.querySelector('.close-revision').addEventListener('click', closeRevisionModal);
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('revisionModal')) {
            closeRevisionModal();
        }
    });
}

// Gestión de tabs
function showTab(tabName) {
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Desactivar todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar contenido activo
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Cargar datos específicos del tab
    if (tabName === 'dashboard') {
        loadDashboard();
    } else if (tabName === 'tasks') {
        renderTasksTable();
    }
}

// Cargar tareas desde la base de datos
async function loadTasks() {
    try {
        tasks = await ipcRenderer.invoke('get-tasks');
        renderTasksTable();
        loadDashboard();
    } catch (error) {
        console.error('Error al cargar tareas:', error);
        showNotification('Error al cargar las tareas', 'error');
    }
}

// Manejar envío de nueva tarea
async function handleAddTask(event) {
    event.preventDefault();
    
    const formData = {
        auditor: document.getElementById('auditor').value,
        categoria: document.getElementById('categoria').value,
        subtarea: document.getElementById('subtarea').value,
        porcentaje: parseInt(document.getElementById('porcentaje').value),
        comentario: document.getElementById('comentario').value
    };

    // Validación
    if (!formData.auditor || !formData.categoria || !formData.subtarea) {
        showNotification('Por favor completa todos los campos obligatorios', 'error');
        return;
    }

    try {
        const result = await ipcRenderer.invoke('add-task', formData);
        if (result.success) {
            showNotification('Tarea agregada exitosamente', 'success');
            clearForm();
            loadTasks();
            showTab('tasks');
        } else {
            showNotification('Error al agregar la tarea: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error al agregar tarea:', error);
        showNotification('Error al agregar la tarea', 'error');
    }
}

// Manejar edición de tarea
async function handleEditTask(event) {
    event.preventDefault();
    
    const taskId = document.getElementById('editTaskId').value;
    const updates = {
        porcentaje: parseInt(document.getElementById('editPorcentaje').value),
        comentario: document.getElementById('editComentario').value
    };

    try {
        const result = await ipcRenderer.invoke('update-task', parseInt(taskId), updates);
        if (result.success) {
            showNotification('Tarea actualizada exitosamente', 'success');
            closeEditModal();
            loadTasks();
        } else {
            showNotification('Error al actualizar la tarea: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error al actualizar tarea:', error);
        showNotification('Error al actualizar la tarea', 'error');
    }
}

// Eliminar tarea
async function deleteTask(taskId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) {
        return;
    }

    try {
        const result = await ipcRenderer.invoke('delete-task', taskId);
        if (result.success) {
            showNotification('Tarea eliminada exitosamente', 'success');
            loadTasks();
        } else {
            showNotification('Error al eliminar la tarea: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error al eliminar tarea:', error);
        showNotification('Error al eliminar la tarea', 'error');
    }
}

// Renderizar tabla de tareas
function renderTasksTable() {
    const tbody = document.querySelector('#tasksTable tbody');
    const auditorFilter = document.getElementById('auditorFilter').value;
    const categoriaFilter = document.getElementById('categoriaFilter').value;
    
    let filteredTasks = tasks;
    
    if (auditorFilter) {
        filteredTasks = filteredTasks.filter(task => task.auditor === auditorFilter);
    }
    
    if (categoriaFilter) {
        filteredTasks = filteredTasks.filter(task => task.categoria === categoriaFilter);
    }
    
    tbody.innerHTML = '';
    
    filteredTasks.forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.auditor}</td>
            <td>${task.categoria}</td>
            <td>${task.subtarea}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${task.porcentaje}%"></div>
                    <div class="progress-text">${task.porcentaje}%</div>
                </div>
            </td>
            <td>${task.comentario || '-'}</td>
            <td>${formatDate(task.fecha_actualizacion)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-primary" onclick="editTask(${task.id})">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="deleteTask(${task.id})">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Cargar dashboard
async function loadDashboard() {
    try {
        const stats = await ipcRenderer.invoke('get-stats');
        renderCharts(stats);
        renderStats(stats);
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        showNotification('Error al cargar las estadísticas', 'error');
    }
}

// Renderizar gráficos
function renderCharts(stats) {
    renderAuditorChart(stats.auditorStats);
    renderCategoriaChart(stats.categoriaStats);
}

function renderAuditorChart(auditorStats) {
    const ctx = document.getElementById('auditorChart').getContext('2d');
    
    if (auditorChart) {
        auditorChart.destroy();
    }
    
    const data = {
        labels: auditorStats.map(stat => stat.auditor),
        datasets: [{
            label: 'Promedio de Avance (%)',
            data: auditorStats.map(stat => stat.promedio_avance || 0),
            backgroundColor: [
                'rgba(52, 152, 219, 0.8)',
                'rgba(46, 204, 113, 0.8)',
                'rgba(241, 196, 15, 0.8)',
                'rgba(231, 76, 60, 0.8)'
            ],
            borderColor: [
                'rgba(52, 152, 219, 1)',
                'rgba(46, 204, 113, 1)',
                'rgba(241, 196, 15, 1)',
                'rgba(231, 76, 60, 1)'
            ],
            borderWidth: 2
        }]
    };

    auditorChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + Math.round(context.parsed) + '%';
                        }
                    }
                }
            }
        }
    });
}

function renderCategoriaChart(categoriaStats) {
    const ctx = document.getElementById('categoriaChart').getContext('2d');
    
    if (categoriaChart) {
        categoriaChart.destroy();
    }
    
    const data = {
        labels: categoriaStats.map(stat => stat.categoria),
        datasets: [{
            label: 'Promedio de Avance (%)',
            data: categoriaStats.map(stat => stat.promedio_avance || 0),
            backgroundColor: 'rgba(52, 152, 219, 0.8)',
            borderColor: 'rgba(52, 152, 219, 1)',
            borderWidth: 2
        }]
    };

    categoriaChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Promedio: ' + Math.round(context.parsed.y) + '%';
                        }
                    }
                }
            }
        }
    });
}

// Renderizar estadísticas
function renderStats(stats) {
    const container = document.getElementById('statsContainer');
    container.innerHTML = '';
    
    // Estadísticas generales
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.porcentaje === 100).length;
    const averageProgress = totalTasks > 0 ? tasks.reduce((sum, task) => sum + task.porcentaje, 0) / totalTasks : 0;
    
    const statsHTML = `
        <div class="stat-item">
            <div class="stat-number">${totalTasks}</div>
            <div class="stat-label">Total de Tareas</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${completedTasks}</div>
            <div class="stat-label">Tareas Completadas</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${Math.round(averageProgress)}%</div>
            <div class="stat-label">Progreso Promedio</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${CATEGORIAS.length}</div>
            <div class="stat-label">Categorías Activas</div>
        </div>
    `;
    
    container.innerHTML = statsHTML;
}

// Funciones auxiliares
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function clearForm() {
    document.getElementById('taskForm').reset();
    document.getElementById('porcentajeValue').textContent = '0%';
}

function filterTasks() {
    renderTasksTable();
}

// Modal functions
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editPorcentaje').value = task.porcentaje;
    document.getElementById('editPorcentajeValue').textContent = task.porcentaje + '%';
    document.getElementById('editComentario').value = task.comentario || '';
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Notificaciones
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
    `;
    
    // Colores según el tipo
    switch(type) {
        case 'success':
            notification.style.background = '#27ae60';
            break;
        case 'error':
            notification.style.background = '#e74c3c';
            break;
        default:
            notification.style.background = '#3498db';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
// Función para manejar la revisión del jefe
async function handleRevision(event) {
    event.preventDefault();
    
    const taskId = document.getElementById('revisionTaskId').value;
    const revision = document.getElementById('revisionComentario').value;
    const auditorRevisor = document.getElementById('auditorRevisor').value.trim();

    if (!auditorRevisor) {
        showNotification('Por favor ingresa el nombre del auditor revisor', 'error');
        return;
    }

    const revisionData = {
        revision: revision,
        auditorRevisor: auditorRevisor
    };

    try {
        const result = await ipcRenderer.invoke('update-revision', parseInt(taskId), revisionData);
        if (result.success) {
            showNotification('Revisión guardada exitosamente', 'success');
            closeRevisionModal();
            loadTasks();
        } else {
            showNotification('Error al guardar la revisión: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error al guardar revisión:', error);
        showNotification('Error al guardar la revisión', 'error');
    }
}

// Función para abrir el modal de revisión
function openRevisionModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('revisionTaskId').value = task.id;
    document.getElementById('revisionAuditor').textContent = task.auditor;
    document.getElementById('revisionSubtarea').textContent = task.subtarea;
    document.getElementById('revisionProgreso').textContent = task.porcentaje + '%';
    document.getElementById('revisionComentario').value = task.revision_jefe || '';
    document.getElementById('auditorRevisor').value = task.auditor_revisor || 'Manuel Nuñez';
    
    document.getElementById('revisionModal').style.display = 'block';
}

// Función para cerrar el modal de revisión
function closeRevisionModal() {
    document.getElementById('revisionModal').style.display = 'none';
}

// Actualiza la función renderTasksTable para incluir la columna de revisión
function renderTasksTable() {
    const tbody = document.querySelector('#tasksTable tbody');
    const auditorFilter = document.getElementById('auditorFilter').value;
    const categoriaFilter = document.getElementById('categoriaFilter').value;
    
    let filteredTasks = tasks;
    
    if (auditorFilter) {
        filteredTasks = filteredTasks.filter(task => task.auditor === auditorFilter);
    }
    
    if (categoriaFilter) {
        filteredTasks = filteredTasks.filter(task => task.categoria === categoriaFilter);
    }
    
    tbody.innerHTML = '';
    
    filteredTasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Crear el contenido de la revisión
        const revisionContent = createRevisionContent(task);
        
        row.innerHTML = `
            <td>${task.auditor}</td>
            <td>${task.categoria}</td>
            <td>${task.subtarea}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${task.porcentaje}%"></div>
                    <div class="progress-text">${task.porcentaje}%</div>
                </div>
            </td>
            <td>${task.comentario || '-'}</td>
            <td>${formatDate(task.fecha_actualizacion)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-primary" onclick="editTask(${task.id})" title="Editar tarea">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="deleteTask(${task.id})" title="Eliminar tarea">🗑️</button>
                </div>
            </td>
            <td class="revision-cell">${revisionContent}</td>
        `;
        tbody.appendChild(row);
    });
}

// Función para crear el contenido de la revisión
function createRevisionContent(task) {
    const estado = task.estado_revision || 'pendiente';
    const revision = task.revision_jefe || '';
    const auditorRevisor = task.auditor_revisor || 'Manuel Nuñez';
    const fechaRevision = task.fecha_revision;
    
    let statusClass = estado === 'revisado' ? 'revisado' : 'pendiente';
    let statusIcon = estado === 'revisado' ? '✅' : '⏳';
    let statusText = estado === 'revisado' ? 'Revisado' : 'Pendiente';
    
    let preview = '';
    if (revision && revision.length > 0) {
        preview = `<div class="revision-preview">${revision.substring(0, 60)}${revision.length > 60 ? '...' : ''}</div>`;
    }
    
    let fechaInfo = '';
    if (fechaRevision) {
        fechaInfo = `<div class="revision-info">📅 ${formatDate(fechaRevision)}</div>`;
    }
    
    return `
        <div class="revision-content">
            <div class="revision-status ${statusClass}">
                <div class="revision-badge">
                    <span>${statusIcon}</span>
                    <span>${statusText}</span>
                </div>
                <small>por ${auditorRevisor}</small>
            </div>
            ${preview}
            ${fechaInfo}
            <button class="revision-button" onclick="openRevisionModal(${task.id})">
                📝 ${estado === 'revisado' ? 'Ver/Editar' : 'Revisar'}
            </button>
        </div>
    `;
}
// Agregar estilos de animación para notificaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);