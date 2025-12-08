/**
 * GESTOR DE COMUNICACIÓN IOT (THINGSPEAK)
 * Maneja la conexión, creación de botones y renderizado de gráficos
 * para ambos canales (Ideal y Real).
 */

const TS_BASE_URL = 'https://api.thingspeak.com/channels/';

class ThingSpeakManager {
    constructor() {
        this.charts = {}; // Almacena instancias de Chart.js para poder destruirlas
    }

    // Inicializa un panel completo (Ideal o Real)
    initPanel(config, panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const btnArea = panel.querySelector('.field-buttons-area');
        const badge = panel.querySelector('.status-badge');

        // Fetch Metadata del Canal
        fetch(`${TS_BASE_URL}${config.ID}/feeds.json?api_key=${config.KEY}&results=0`)
            .then(res => res.json())
            .then(data => {
                const channel = data.channel;
                badge.innerText = 'Conectado';
                badge.className = 'status-badge connected'; // Clase CSS verde (definida en style.css)
                
                btnArea.innerHTML = ''; // Limpiar botones anteriores
                
                // Generar botones dinámicamente para fields 1 a 8
                let foundFields = false;
                for (let i = 1; i <= 8; i++) {
                    if (channel['field' + i]) {
                        foundFields = true;
                        this.createButton(btnArea, i, channel['field' + i], panelId, config);
                    }
                }

                // Fallback: Si no encuentra fields (canal nuevo vacío), forzar botones básicos
                if (!foundFields) {
                    this.createFallbackButtons(btnArea, panelId, config);
                }
            })
            .catch(err => {
                console.error("Error TS:", err);
                badge.innerText = 'Sin Conexión';
                badge.className = 'status-badge error'; // Clase CSS roja
                
                // Fallback en caso de error para que la UI no quede vacía
                btnArea.innerHTML = ''; 
                this.createFallbackButtons(btnArea, panelId, config);
            });
    }

    // Crea botones por defecto si la API falla o no tiene metadatos
    createFallbackButtons(container, panelId, config) {
        this.createButton(container, 1, "RPM Motor", panelId, config);
        this.createButton(container, 2, "Temperatura", panelId, config);
        this.createButton(container, 3, "Voltaje Control", panelId, config);
        this.createButton(container, 4, "Humedad Suelo", panelId, config);
    }

    createButton(container, fieldId, fieldName, panelId, config) {
        const btn = document.createElement('button');
        btn.className = 'btn-field';
        btn.innerText = `+ ${fieldName}`;
        // Al hacer clic, añade un gráfico a ESTE panel específico usando SU configuración
        btn.onclick = () => this.addChart(panelId, config, fieldId, fieldName);
        container.appendChild(btn);
    }

    addChart(panelId, config, fieldId, name) {
        const panel = document.getElementById(panelId);
        const stack = panel.querySelector('.charts-stack');
        
        // Crear ID único para el canvas
        const canvasId = `chart_${panelId}_${fieldId}_${Date.now()}`;
        
        // Crear Card HTML
        const card = document.createElement('div');
        card.className = 'chart-card'; // Estilo horizontal definido en CSS
        
        let desc = this.getDescription(name);

        card.innerHTML = `
            <button class="removeChartBtn">×</button>
            <div class="chart-info">
                <h4>${name}</h4>
                <p>${desc}</p>
                <p class="meta-tag" style="margin-top:5px; font-size:0.75rem; color:#888;">Field ${fieldId} • Actualización: 15s</p>
            </div>
            <div class="chart-wrapper">
                <canvas id="${canvasId}"></canvas>
            </div>
        `;
        
        // Lógica del botón cerrar
        card.querySelector('.removeChartBtn').onclick = () => {
            if (this.charts[canvasId]) {
                this.charts[canvasId].destroy(); // Destruir instancia de Chart.js para liberar memoria
                delete this.charts[canvasId];
            }
            card.remove(); // Eliminar del DOM
        };

        stack.appendChild(card);
        
        // Iniciar la carga de datos
        this.fetchAndRender(config, fieldId, canvasId);
    }

    fetchAndRender(config, fieldId, canvasId) {
        // Verificar si el canvas aún existe en el DOM antes de llamar
        if(!document.getElementById(canvasId)) return;

        fetch(`${TS_BASE_URL}${config.ID}/fields/${fieldId}.json?api_key=${config.KEY}&results=15`)
            .then(res => res.json())
            .then(data => {
                const labels = data.feeds.map(f => {
                    const d = new Date(f.created_at);
                    return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
                });
                const values = data.feeds.map(f => parseFloat(f['field' + fieldId]));
                
                this.renderChart(canvasId, labels, values);
            })
            .catch(err => console.error("Error fetching data:", err));
    }

    renderChart(canvasId, labels, data) {
        const ctxEl = document.getElementById(canvasId);
        if (!ctxEl) return; // Si el usuario cerró el gráfico mientras cargaba

        const ctx = ctxEl.getContext('2d');
        
        // Destruir anterior si existe
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    borderColor: '#667eea', // Color violeta del tema
                    backgroundColor: 'rgba(102,126,234,0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3, // Curvas suaves
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Importante para que respete el tamaño del contenedor CSS
                scales: { 
                    x: { display: false }, // Ocultar eje X para limpieza visual
                    y: { beginAtZero: false } 
                },
                plugins: { legend: { display: false } },
                animation: false // Desactivar animación para updates fluidos
            }
        });
    }

    getDescription(name) {
        const n = name.toLowerCase();
        if (n.includes("hum")) return "Variable controlada (%). Indica saturación del suelo.";
        if (n.includes("temp")) return "Variable monitoreada (°C). Estado térmico del motor.";
        if (n.includes("rpm") || n.includes("vel") || n.includes("revoluc")) return "Variable de estado (x1). Velocidad angular.";
        if (n.includes("volt") || n.includes("control") || n.includes("u")) return "Acción de control (u). Voltaje aplicado (0-5V).";
        return "Dato de telemetría en tiempo real.";
    }
}