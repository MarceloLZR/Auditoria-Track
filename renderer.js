const { ipcRenderer } = require('electron');

// Variables globales HOLA
let tasks = [];
let auditorChart = null;
let categoriaChart = null;

// Categorías predefinidas
const CATEGORIAS = [
    'Auditorías',
    'Auditoría continua', 
    'Seguimiento de observaciones internas',
    'Seguimiento de observaciones regulatorias',
    'Reportes SIRAI',
    'Capacitaciones',
    'Trabajos adicionales'
];

const AUDITORES = ['Priscila Pajuelo', 'Monica Bilbao', 'Marcelo Nuñez', 'Lautaro Ballesteros'];

const PERIODOS = [
    { value: 'Q1', label: 'Q1 (Nov-Ene)' },
    { value: 'Q2', label: 'Q2 (Feb-Abr)' },
    { value: 'Q3', label: 'Q3 (May-Jul)' },
    { value: 'Q4', label: 'Q4 (Ago-Oct)' }
];

let currentMessages = [];
let currentTaskId = null;
let currentUser = 'Manuel Nuñez'; // Usuario por defecto

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
    actualizarSelectAuditores(); 
    actualizarFiltros();// 👈 AÑADE ESTA LÍNEA
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
    document.getElementById('periodoFilter').addEventListener('change', filterTasks);

     // ✅ NUEVO: Event listeners para el chat
    document.getElementById('chatForm').addEventListener('submit', handleSendMessage);
    document.getElementById('currentUser').addEventListener('change', function() {
        currentUser = this.value;
        // ✅ ACTUALIZAR VISIBILIDAD DE BOTONES AL CAMBIAR USUARIO
        updateApprovalButtonsVisibility();
        if (currentTaskId) {
            markMessagesAsRead(currentTaskId);
        }
    });
    
    // Botones de estado
    document.getElementById('approveBtn').addEventListener('click', () => updateRevisionStatus('revisado'));
    document.getElementById('pendingBtn').addEventListener('click', () => updateRevisionStatus('pendiente'));
    
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
        periodo: document.getElementById('periodo').value, // ✅ NUEVO CAMPO
        porcentaje: parseInt(document.getElementById('porcentaje').value),
        comentario: document.getElementById('comentario').value,
        fecha_estimada_fin: document.getElementById('fechaEstimadaFin').value || null
    };

    // Validación
    if (!formData.auditor || !formData.categoria || !formData.subtarea || !formData.periodo) {
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
            showNotification('Tarea actualizada exitosamente. La revisión se ha reiniciado.', 'success');
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
    const periodoFilter = document.getElementById('periodoFilter').value; //  NUEVO FILTRO

    let filteredTasks = tasks;
    
    if (auditorFilter) {
        filteredTasks = filteredTasks.filter(task => task.auditor === auditorFilter);
    }
    
    if (categoriaFilter) {
        filteredTasks = filteredTasks.filter(task => task.categoria === categoriaFilter);
    }

    //  NUEVO FILTRO POR PERÍODO
    if (periodoFilter) {
        filteredTasks = filteredTasks.filter(task => task.periodo === periodoFilter);
    }
    
    // ✅ ORDENAMIENTO POR PRIORIDAD DE VENCIMIENTO
    filteredTasks.sort((a, b) => {
        const hoy = new Date();
        
        // Función para calcular la prioridad de una tarea
        function calcularPrioridad(task) {
            // 1. Tareas completadas van al final (prioridad más baja)
            if (task.porcentaje === 100) {
                return 1000; // Valor alto = baja prioridad
            }
            
            // 2. Tareas sin fecha van después de las vencidas pero antes que las completadas
            if (!task.fecha_estimada_fin) {
                return 900;
            }
            
            const fechaEstimada = new Date(task.fecha_estimada_fin);
            const diasRestantes = Math.ceil((fechaEstimada - hoy) / (1000 * 60 * 60 * 24));
            
            // 3. Tareas vencidas tienen máxima prioridad (ordenadas por cuánto tiempo están vencidas)
            if (diasRestantes < 0) {
                return Math.abs(diasRestantes); // Más vencida = menor número = mayor prioridad
            }
            
            // 4. Tareas próximas a vencer (0-7 días) - alta prioridad
            if (diasRestantes <= 7) {
                return 100 + diasRestantes; // Entre 100-107
            }
            
            // 5. Tareas con más tiempo - menor prioridad
            return 200 + diasRestantes;
        }
        
        const prioridadA = calcularPrioridad(a);
        const prioridadB = calcularPrioridad(b);
        
        // Si tienen la misma prioridad, ordenar por fecha de actualización (más reciente primero)
        if (prioridadA === prioridadB) {
            return new Date(b.fecha_actualizacion) - new Date(a.fecha_actualizacion);
        }
        
        return prioridadA - prioridadB; // Número menor = mayor prioridad = aparece primero
    });
    
    tbody.innerHTML = '';
    
    filteredTasks.forEach((task, index) => {
        const row = document.createElement('tr');
        
        // Agregar clase CSS según la prioridad para resaltar visualmente
        let rowClass = '';
        if (task.porcentaje === 100) {
            rowClass = 'task-completed';
        } else if (task.fecha_estimada_fin) {
            const hoy = new Date();
            const fechaEstimada = new Date(task.fecha_estimada_fin);
            const diasRestantes = Math.ceil((fechaEstimada - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes < 0) {
                rowClass = 'task-overdue';
            } else if (diasRestantes <= 2) {
                rowClass = 'task-urgent';
            } else if (diasRestantes <= 7) {
                rowClass = 'task-soon';
            }
        }
        
        if (rowClass) {
            row.className = rowClass;
        }
        
        // Crear el contenido de la revisión
        const revisionContent = createRevisionContent(task);
        
        // Calcular estado de la fecha
        const fechaEstimadaContent = createFechaEstimadaContent(task);
        
        //  AGREGAR COLUMNA DE PERÍODO
        row.innerHTML = `
            <td>${task.auditor}</td>
            <td>${task.categoria}</td>
            <td>${task.subtarea}</td>
            <td><span class="periodo-badge periodo-${task.periodo}">${task.periodo}</span></td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${task.porcentaje}%"></div>
                    <div class="progress-text">${task.porcentaje}%</div>
                </div>
            </td>
            <td>${task.comentario || '-'}</td>
            <td>${fechaEstimadaContent}</td>
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
// ===== FUNCIÓN NUEVA: Actualizar filtros con períodos =====
function actualizarFiltros() {
    // Actualizar filtro de períodos
    const periodoFilter = document.getElementById('periodoFilter');
    if (periodoFilter) {
        periodoFilter.innerHTML = '<option value="">Todos los períodos</option>';
        PERIODOS.forEach(periodo => {
            const option = document.createElement('option');
            option.value = periodo.value;
            option.textContent = periodo.label;
            periodoFilter.appendChild(option);
        });
    }

    // Actualizar select de período en formulario
    const periodoSelect = document.getElementById('periodo');
    if (periodoSelect) {
        periodoSelect.innerHTML = '<option value="">Seleccionar período</option>';
        PERIODOS.forEach(periodo => {
            const option = document.createElement('option');
            option.value = periodo.value;
            option.textContent = periodo.label;
            periodoSelect.appendChild(option);
        });
    }
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
    
    // Ordenar por puntuación global
    const sortedStats = [...auditorStats].sort((a, b) => b.puntuacion_global - a.puntuacion_global);
    
    const data = {
        labels: sortedStats.map(stat => stat.auditor),
        datasets: [
            {
                label: 'Puntuación Global',
                data: sortedStats.map(stat => stat.puntuacion_global),
                backgroundColor: sortedStats.map(stat => {
                    if (stat.puntuacion_global >= 85) return 'rgba(46, 204, 113, 0.8)'; // Verde - Excelente
                    if (stat.puntuacion_global >= 70) return 'rgba(52, 152, 219, 0.8)'; // Azul - Bueno
                    if (stat.puntuacion_global >= 50) return 'rgba(241, 196, 15, 0.8)'; // Amarillo - Regular
                    return 'rgba(231, 76, 60, 0.8)'; // Rojo - Necesita mejora
                }),
                borderColor: sortedStats.map(stat => {
                    if (stat.puntuacion_global >= 85) return 'rgba(46, 204, 113, 1)';
                    if (stat.puntuacion_global >= 70) return 'rgba(52, 152, 219, 1)';
                    if (stat.puntuacion_global >= 50) return 'rgba(241, 196, 15, 1)';
                    return 'rgba(231, 76, 60, 1)';
                }),
                borderWidth: 2
            },
            {
                label: 'Índice de Rendimiento',
                data: sortedStats.map(stat => Math.min(100, stat.indice_rendimiento_ponderado)),
                backgroundColor: 'rgba(155, 89, 182, 0.6)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 1
            },
            {
                label: 'Cumplimiento de Plazos',
                data: sortedStats.map(stat => stat.indice_cumplimiento_plazos),
                backgroundColor: 'rgba(26, 188, 156, 0.6)',
                borderColor: 'rgba(26, 188, 156, 1)',
                borderWidth: 1
            }
        ]
    };

    auditorChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Hace las barras horizontales
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Puntuación (%)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Auditores'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const auditor = sortedStats[context.dataIndex];
                            if (context.datasetIndex === 0) { // Solo mostrar en la primera serie
                                return [
                                    `Nivel: ${auditor.nivel_rendimiento}`,
                                    `Tareas: ${auditor.total_tareas} (${auditor.tareas_completadas} completadas)`,
                                    `Días prom. completar: ${auditor.dias_promedio_completar}`,
                                    `Tareas vencidas: ${auditor.tareas_vencidas}`
                                ];
                            }
                            return null;
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
        labels: categoriaStats.map(stat => stat.categoria.length > 20 ? 
            stat.categoria.substring(0, 20) + '...' : stat.categoria),
        datasets: [
            {
                label: 'Progreso Promedio (%)',
                data: categoriaStats.map(stat => stat.promedio_avance || 0),
                backgroundColor: 'rgba(52, 152, 219, 0.8)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            },
            {
                label: 'Cumplimiento de Plazos (%)',
                data: categoriaStats.map(stat => stat.cumplimiento_plazos || 0),
                backgroundColor: 'rgba(46, 204, 113, 0.8)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }
        ]
    };

    categoriaChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Porcentaje (%)'
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
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const categoria = categoriaStats[context.dataIndex];
                            return [
                                `Total tareas: ${categoria.total_tareas}`,
                                `Completadas: ${categoria.tareas_completadas}`
                            ];
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
    
    const globalStats = stats.globalStats || {};
    
    // Crear grid de estadísticas mejorado
    const statsHTML = `
        <div class="stat-item">
            <div class="stat-number">${globalStats.total_tareas}</div>
            <div class="stat-label">Total de Tareas</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${globalStats.tareas_completadas}</div>
            <div class="stat-label">Tareas Completadas</div>
            <div class="stat-detail">${globalStats.porcentaje_completadas_global}% del total</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${Math.round(globalStats.promedio_avance_global)}%</div>
            <div class="stat-label">Progreso Promedio</div>
        </div>
        <!--
        <div class="stat-item ${globalStats.avance_ponderado_tiempo < 80 ? 'stat-attention' : ''}">
            <div class="stat-number">${Math.round(globalStats.avance_ponderado_tiempo)}%</div>
            <div class="stat-label">Eficiencia Temporal</div>
            <div class="stat-detail">Avance vs. tiempo esperado</div>
        </div>
         -->
        <div class="stat-item ${globalStats.cumplimiento_plazos_global < 80 ? 'stat-warning' : ''}">
            <div class="stat-number">${globalStats.cumplimiento_plazos_global}%</div>
            <div class="stat-label">Cumplimiento de Plazos</div>
            <div class="stat-detail">${globalStats.tareas_con_fecha} tareas con fecha</div>
        </div>
        <div class="stat-item ${globalStats.tareas_vencidas > 0 ? 'stat-danger' : ''}">
            <div class="stat-number">${globalStats.tareas_vencidas}</div>
            <div class="stat-label">Tareas Vencidas</div>
            <div class="stat-detail">Requieren atención inmediata</div>
        </div>
        <div class="stat-item ${globalStats.tareas_proximas_vencer > 0 ? 'stat-warning' : ''}">
            <div class="stat-number">${globalStats.tareas_proximas_vencer}</div>
            <div class="stat-label">Próximas a Vencer</div>
            <div class="stat-detail">En los próximos 7 días</div>
        </div>
    `;
    
    container.innerHTML = statsHTML;
    
    // Agregar tabla de ranking de auditores
    renderAuditorRanking(stats.auditorStats);
}

function renderAuditorRanking(auditorStats) {
    const container = document.getElementById('statsContainer');
    
    // Crear tabla de ranking
    const rankingHTML = `
        <div class="ranking-section">
            <h4>🏆 Ranking de Rendimiento por Auditor</h4>
            <div class="ranking-table">
                <table class="ranking-table-inner">
                    <thead>
                        <tr>
                            <th>Pos.</th>
                            <th>Auditor</th>
                            <th>Puntuación Global</th>
                            <th>Rendimiento</th>
                            <th>Cumplimiento</th>
                            <th>Nivel</th>
                            <th>Tareas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${auditorStats.map((auditor, index) => `
                            <tr class="ranking-row ${auditor.puntuacion_global >= 85 ? 'excellent' : 
                                                    auditor.puntuacion_global >= 70 ? 'good' : 
                                                    auditor.puntuacion_global >= 50 ? 'regular' : 'needs-improvement'}">
                                <td class="rank-position">${index + 1}</td>
                                <td class="auditor-name">${auditor.auditor}</td>
                                <td class="score-cell">
                                    <div class="score-bar">
                                        <div class="score-fill" style="width: ${auditor.puntuacion_global}%"></div>
                                        <span class="score-text">${Math.round(auditor.puntuacion_global)}%</span>
                                    </div>
                                </td>
                                <td>${Math.round(auditor.indice_rendimiento_ponderado)}%</td>
                                <td>${Math.round(auditor.indice_cumplimiento_plazos)}%</td>
                                <td class="level-badge ${auditor.nivel_rendimiento.toLowerCase().replace(' ', '-')}">${auditor.nivel_rendimiento}</td>
                                <td>${auditor.tareas_completadas}/${auditor.total_tareas}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML += rankingHTML;
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
    document.getElementById('fechaEstimadaFin').value = '';
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

function resetHora(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function createFechaEstimadaContent(task) {
    if (!task.fecha_estimada_fin) {
        return '<span class="no-date">Sin fecha</span>';
    }

    const fechaEstimada = resetHora(new Date(task.fecha_estimada_fin));
    const hoy = resetHora(new Date());
    const fechaCreacion = resetHora(new Date(task.fecha_creacion));

    let diasRestantes = Math.ceil((fechaEstimada - hoy) / (1000 * 60 * 60 * 24));
    let progresoEsperado;

    if (fechaCreacion > fechaEstimada) {
        progresoEsperado = 100;
    } else {
        const diasTotales = Math.ceil((fechaEstimada - fechaCreacion) / (1000 * 60 * 60 * 24));
        let diasTranscurridos = Math.ceil((hoy - fechaCreacion) / (1000 * 60 * 60 * 24));
        if (diasTranscurridos >= 0 && diasTranscurridos <= diasTotales) {
            diasTranscurridos += 1; // Incluir el día actual como parte del progreso
        }

        progresoEsperado = diasTotales > 0 
            ? Math.min(100, Math.max(0, (diasTranscurridos / diasTotales) * 100))
            : 100;
    }

    let statusClass = '';
    let statusIcon = '';

    if (task.porcentaje === 100) {
        statusClass = 'fecha-completada'; // Verde
        statusIcon = '✅';
    } else if (diasRestantes < 0 || diasRestantes <= 2) {
        statusClass = 'fecha-vencida'; // Rojo
        statusIcon = '🔴';
    } else if (diasRestantes <= 7) {
        statusClass = 'fecha-proxima'; // Amarillo
        statusIcon = '🟡';
    } else {
        statusClass = 'fecha-normal'; // Azul
        statusIcon = '📅';
    }

    let fechaInfo = '';
    if (task.porcentaje < 100) {
        const diasMensaje = diasRestantes < 0
            ? `Retrasada por ${Math.abs(diasRestantes)} días`
            : `Quedan: ${diasRestantes} días`;

        fechaInfo = `
            <div class="fecha-info">
                <div><small>Esperado: ${Math.round(progresoEsperado)}%</small></div>
                <div><small>${diasMensaje}</small></div>
            </div>
        `;
    }

    return `
        <div class="fecha-estimada ${statusClass}">
            <div class="fecha-display">
                ${statusIcon} ${formatDate(task.fecha_estimada_fin)}
            </div>
            ${fechaInfo}
        </div>
    `;
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
// ===== REEMPLAZAR la función openRevisionModal =====
async function openRevisionModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    currentTaskId = taskId;
    
    // Llenar información de la tarea
    document.getElementById('revisionTaskId').value = task.id;
    document.getElementById('revisionAuditor').textContent = task.auditor;
    document.getElementById('revisionSubtarea').textContent = task.subtarea;
    document.getElementById('revisionProgreso').textContent = task.porcentaje + '%';
    
    // ✅ CONFIGURAR SELECTOR DE USUARIOS DINÁMICAMENTE
    setupUserSelector(task);
    
    // Actualizar barra de estado
    updateRevisionStatusBar(task);
    
    // Cargar mensajes
    await loadRevisionMessages(taskId);
    
    // Marcar mensajes como leídos
    await markMessagesAsRead(taskId);
    
    // Mostrar modal
    document.getElementById('revisionModal').style.display = 'block';
    
    // Scroll al final del chat
    scrollToBottom();
}

// Función para cerrar el modal de revisión
function closeRevisionModal() {
    document.getElementById('revisionModal').style.display = 'none';
}


// Función para crear el contenido de la revisión
// ===== REEMPLAZAR la función createRevisionContent =====
function createRevisionContent(task) {
    const estado = task.estado_revision || 'pendiente';
    const mensajesNoLeidos = task.mensajes_no_leidos || 0;
    const ultimoMensaje = task.ultimo_mensaje_fecha;
    const ultimoAutor = task.ultimo_mensaje_autor;
    
    let statusClass = estado === 'revisado' ? 'revisado' : 'pendiente';
    let statusIcon = estado === 'revisado' ? '✅' : '⏳';
    let statusText = estado === 'revisado' ? 'Revisado' : 'Pendiente';
    
    // Indicador de mensajes no leídos
    let unreadIndicator = '';
    if (mensajesNoLeidos > 0) {
        unreadIndicator = `<span class="unread-indicator">${mensajesNoLeidos}</span>`;
    }
    
    // Preview del último mensaje
    let lastMessagePreview = '';
    if (ultimoMensaje && ultimoAutor) {
        const fechaUltimo = new Date(ultimoMensaje);
        const ahora = new Date();
        const diferencia = ahora - fechaUltimo;
        const minutos = Math.floor(diferencia / 60000);
        
        let tiempoTexto = '';
        if (minutos < 1) {
            tiempoTexto = 'hace un momento';
        } else if (minutos < 60) {
            tiempoTexto = `hace ${minutos}m`;
        } else if (minutos < 1440) {
            tiempoTexto = `hace ${Math.floor(minutos/60)}h`;
        } else {
            tiempoTexto = formatDate(ultimoMensaje);
        }
        
        lastMessagePreview = `
            <div class="chat-preview">
                <strong>${ultimoAutor}:</strong> Último mensaje
                <br><small>${tiempoTexto}</small>
            </div>
        `;
    }
    
    // Clases para el botón según si hay mensajes no leídos
    let buttonClass = mensajesNoLeidos > 0 ? 'revision-button has-unread' : 'revision-button';
    
    return `
        <div class="revision-content">
            <div class="revision-status ${statusClass} ${mensajesNoLeidos > 0 ? 'has-unread' : ''}">
                <div class="revision-badge">
                    <span>${statusIcon}</span>
                    <span>${statusText}</span>
                    ${unreadIndicator}
                </div>
            </div>
            ${lastMessagePreview}
            <button class="${buttonClass}" onclick="openRevisionModal(${task.id})">
                💬 Chat ${mensajesNoLeidos > 0 ? `(${mensajesNoLeidos})` : ''}
            </button>
        </div>
    `;
}

// ✅ NUEVA FUNCIÓN: Configurar selector de usuarios dinámicamente


function setupUserSelector(task) {
    const userSelect = document.getElementById('currentUser');
    userSelect.innerHTML = '';
    
    // Siempre incluir al jefe
    const jefeOption = document.createElement('option');
    jefeOption.value = 'Manuel Nuñez';
    jefeOption.textContent = '👨‍💼 Manuel Nuñez (Jefe)';
    userSelect.appendChild(jefeOption);
    
    // Incluir al auditor responsable si no es el jefe
    if (task.auditor !== 'Manuel Nuñez') {
        const auditorOption = document.createElement('option');
        auditorOption.value = task.auditor;
        
        // Agregar emoji según el auditor
        let emoji = '👩‍💼';
        if (task.auditor === 'Marcelo Nuñez' || task.auditor === 'Lautaro Ballesteros') {
            emoji = '👨‍💼';
        }
        
        auditorOption.textContent = `${emoji} ${task.auditor}`;
        userSelect.appendChild(auditorOption);
    }
    
    // Establecer el usuario actual
    userSelect.value = currentUser;
    
    // ✅ MOSTRAR/OCULTAR BOTONES DE APROBACIÓN SEGÚN EL USUARIO
    updateApprovalButtonsVisibility();
}

// ✅ NUEVA FUNCIÓN: Mostrar/ocultar botones de aprobación
function updateApprovalButtonsVisibility() {
    const statusControls = document.querySelector('.status-controls');
    const approveBtn = document.getElementById('approveBtn');
    const pendingBtn = document.getElementById('pendingBtn');
    
    if (currentUser === 'Manuel Nuñez') {
        // Solo el jefe puede ver los botones
        statusControls.style.display = 'flex';
        approveBtn.style.display = 'inline-block';
        pendingBtn.style.display = 'inline-block';
    } else {
        // Los auditores no pueden ver los botones
        statusControls.style.display = 'none';
        approveBtn.style.display = 'none';
        pendingBtn.style.display = 'none';
    }
}

// ===== NUEVAS FUNCIONES PARA EL CHAT =====

// Cargar mensajes del chat
async function loadRevisionMessages(taskId) {
    try {
        currentMessages = await ipcRenderer.invoke('get-revision-messages', taskId);
        renderMessages();
    } catch (error) {
        console.error('Error al cargar mensajes:', error);
        showNotification('Error al cargar mensajes', 'error');
    }
}

// Renderizar mensajes en el chat
function renderMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    if (currentMessages.length === 0) {
        container.innerHTML = '<div class="empty-chat">💬 No hay mensajes aún. ¡Inicia la conversación!</div>';
        return;
    }
    
    currentMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        
        let messageClass = 'message';
        if (message.tipo === 'sistema') {
            messageClass += ' system';
        } else if (message.autor === currentUser) {
            messageClass += ' own';
        } else {
            messageClass += ' other';
            if (!message.leido) {
                messageClass += ' unread';
            }
        }
        
        messageDiv.className = messageClass;
        
        if (message.tipo === 'sistema') {
            // ✅ MENSAJES DEL SISTEMA MÁS COMPACTOS
            messageDiv.innerHTML = `
                <div class="message-content">${message.mensaje}</div>
                <div class="message-date" style="font-size: 0.7em; margin-top: 3px;">${formatDateTime(message.fecha)}</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-author">${message.autor}</span>
                    <span class="message-date">${formatDateTime(message.fecha)}</span>
                </div>
                <div class="message-content">${message.mensaje}</div>
            `;
        }
        
        container.appendChild(messageDiv);
    });
}

// Enviar nuevo mensaje
async function handleSendMessage(event) {
    event.preventDefault();
    
    const messageText = document.getElementById('newMessage').value.trim();
    if (!messageText) return;
    
    try {
        const result = await ipcRenderer.invoke('add-revision-message', currentTaskId, {
            autor: currentUser,
            mensaje: messageText
        });
        
        if (result.success) {
            document.getElementById('newMessage').value = '';
            await loadRevisionMessages(currentTaskId);
            scrollToBottom();
            
            // Recargar la tabla para actualizar los contadores
            await loadTasks();
            
            showNotification('Mensaje enviado', 'success');
        } else {
            showNotification('Error al enviar mensaje', 'error');
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        showNotification('Error al enviar mensaje', 'error');
    }
}

// Marcar mensajes como leídos
async function markMessagesAsRead(taskId) {
    try {
        await ipcRenderer.invoke('mark-messages-read', taskId, currentUser);
        await loadTasks(); // Actualizar la tabla
    } catch (error) {
        console.error('Error al marcar mensajes como leídos:', error);
    }
}

// Actualizar estado de revisión (aprobar/pendiente)
async function updateRevisionStatus(status) {
    // ✅ VERIFICAR QUE SOLO EL JEFE PUEDA CAMBIAR EL ESTADO
    if (currentUser !== 'Manuel Nuñez') {
        showNotification('Solo el jefe puede aprobar o marcar como pendiente las tareas', 'error');
        return;
    }
    
    try {
        // ✅ ENVIAR EL ESTADO CORRECTO
        const estadoParaEnviar = status === 'approve' ? 'revisado' : 'pendiente';
        
        const result = await ipcRenderer.invoke('update-revision-status', currentTaskId, estadoParaEnviar, currentUser);
        
        if (result.success) {
            // ✅ MENSAJE CORRECTO SEGÚN LA ACCIÓN
            const mensaje = status === 'approve' ? 'revisada' : 'marcada como pendiente';
            showNotification(`Tarea ${mensaje}`, 'success');
            
            // Recargar mensajes y datos
            await loadRevisionMessages(currentTaskId);
            await loadTasks();
            
            // Actualizar barra de estado
            const task = tasks.find(t => t.id === currentTaskId);
            if (task) {
                // Actualizar el estado local de la tarea
                task.estado_revision = estadoParaEnviar;
                task.auditor_revisor = currentUser;
                task.fecha_revision = new Date().toISOString();
                updateRevisionStatusBar(task);
            }
            
            scrollToBottom();
        } else {
            showNotification('Error al actualizar estado', 'error');
        }
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        showNotification('Error al actualizar estado', 'error');
    }
}

// Actualizar barra de estado de revisión
function updateRevisionStatusBar(task) {
    const statusBar = document.getElementById('revisionStatus');
    const estado = task.estado_revision || 'pendiente';
    
    let statusClass = estado === 'revisado' ? 'approved' : 'pending';
    let statusText = estado === 'revisado' ? 
        `✅ TAREA REVISADA por ${task.auditor_revisor || 'Manuel Nuñez'}` : 
        `⏳ TAREA PENDIENTE DE REVISIÓN`;
    
    if (task.fecha_revision) {
        statusText += ` - ${formatDateTime(task.fecha_revision)}`;
    }
    
    statusBar.className = `revision-status-bar ${statusClass}`;
    statusBar.textContent = statusText;
}

// Scroll al final del chat
function scrollToBottom() {
    setTimeout(() => {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ===== MODIFICAR la función closeRevisionModal =====
function closeRevisionModal() {
    document.getElementById('revisionModal').style.display = 'none';
    currentTaskId = null;
    currentMessages = [];
}

// ===== NUEVA FUNCIÓN: Formatear fecha y hora =====
function formatDateTime(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) {
        return 'hace un momento';
    } else if (diffMinutes < 60) {
        return `hace ${diffMinutes}m`;
    } else if (diffMinutes < 1440) {
        return `hace ${Math.floor(diffMinutes / 60)}h`;
    } else if (diffMinutes < 10080) {
        return `hace ${Math.floor(diffMinutes / 1440)}d`;
    } else {
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
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


// ✅ AGREGAR ESTOS EVENT LISTENERS AL FINAL DE renderer.js

// Event listeners para el modal de revisión
document.addEventListener('DOMContentLoaded', function() {
    // Cerrar modal de revisión
    const closeRevisionBtn = document.querySelector('.close-revision');
    if (closeRevisionBtn) {
        closeRevisionBtn.addEventListener('click', closeRevisionModal);
    }

    // Cerrar modal al hacer clic fuera de él
    window.addEventListener('click', function(event) {
        const revisionModal = document.getElementById('revisionModal');
        if (event.target === revisionModal) {
            closeRevisionModal();
        }
    });

    // Formulario de chat
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', handleSendMessage);
    }

    // Botones de aprobación/pendiente
    const approveBtn = document.getElementById('approveBtn');
    const pendingBtn = document.getElementById('pendingBtn');
    
    if (approveBtn) {
        approveBtn.addEventListener('click', () => updateRevisionStatus('approve'));
    }
    
    if (pendingBtn) {
        pendingBtn.addEventListener('click', () => updateRevisionStatus('pending'));
    }

    // Cambio de usuario
    const currentUserSelect = document.getElementById('currentUser');
    if (currentUserSelect) {
        currentUserSelect.addEventListener('change', function() {
            currentUser = this.value;
            updateApprovalButtonsVisibility();
        });
    }

    // ✅ TECLA ESC PARA CERRAR EL MODAL
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const revisionModal = document.getElementById('revisionModal');
            if (revisionModal && revisionModal.style.display === 'block') {
                closeRevisionModal();
            }
        }
    });

    // ✅ ENTER + CTRL PARA ENVIAR MENSAJE
    const newMessageTextarea = document.getElementById('newMessage');
    if (newMessageTextarea) {
        newMessageTextarea.addEventListener('keydown', function(event) {
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                const chatForm = document.getElementById('chatForm');
                if (chatForm) {
                    chatForm.dispatchEvent(new Event('submit'));
                }
            }
        });
    }
});