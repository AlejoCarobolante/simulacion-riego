/**
 * GESTOR DE COMUNICACIÓN IOT (THINGSPEAK)
 */

const TS_BASE_URL = 'https://api.thingspeak.com/channels/';

class ThingSpeakManager {
    constructor() {
        this.charts = {}; // Almacena instancias de Chart.js
    }

    // Inicializa un panel completo (Ideal o Real)
    initPanel(config, panelId) {
        const panel = document.getElementById(panelId);
        if(!panel) return;

        const btnArea = panel.querySelector('.field-buttons-area');
        const badge = panel.querySelector('.status-badge');

        // Fetch Metadata del Canal
        fetch(`${TS_BASE_URL}${config.ID}/feeds.json?api_key=${config.KEY}&results=0`)
            .then(res => res.json())
            .then(data => {
                const channel = data.channel;
                badge.innerText = 'Conectado';
                badge.className = 'status-badge connected'; // Añadir clase CSS verde
                
                btnArea.innerHTML = ''; // Limpiar
                
                // Generar botones dinámicamente para fields 1 a 8
                for(let i=1; i<=8; i++) {
                    if(channel['field'+i]) {
                        this.createButton(btnArea, i, channel['field'+i], panelId, config);
                    }
                }
            })
            .catch(err => {
                console.error("Error TS:", err);
                badge.innerText = 'Sin Conexión';
                badge.className = 'status-badge error';
            });
    }

    createButton(container, fieldId, fieldName, panelId, config) {
        const btn = document.createElement('button');
        btn.className = 'btn-field';
        btn.innerText = `+ ${fieldName}`;
        btn.onclick = () => this.addChart(panelId, config, fieldId, fieldName);
        container.appendChild(btn);
    }

    addChart(panelId, config, fieldId, name) {
        const panel = document.getElementById(panelId);
        const stack = panel.querySelector('.charts-stack');
        
        // Crear Card HTML
        const card = document.createElement('div');
        card.className = 'chart-card';
        const canvasId = `chart_${panelId}_${fieldId}_${Date.now()}`;
        
        let desc = this.getDescription(name);

        card.innerHTML = `
            <button class="removeChartBtn">×</button>
            <div class="chart-info">
                <h4>${name}</h4>
                <p>${desc}</p>
                <p class="meta-tag">Field ${fieldId}</p>
            </div>
            <div class="chart-wrapper">
                <canvas id="${canvasId}"></canvas>
            </div>
        `;
        
        // Botón cerrar
        card.querySelector('.removeChartBtn').onclick = () => {
            if(this.charts[canvasId]) this.charts[canvasId].destroy();
            card.remove();
        };

        stack.appendChild(card);
        this.fetchAndRender(config, fieldId, canvasId);
    }

    fetchAndRender(config, fieldId, canvasId) {
        fetch(`${TS_BASE_URL}${config.ID}/fields/${fieldId}.json?api_key=${config.KEY}&results=15`)
            .then(res => res.json())
            .then(data => {
                const labels = data.feeds.map(f => {
                    const d = new Date(f.created_at);
                    return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
                });
                const values = data.feeds.map(f => parseFloat(f['field'+fieldId]));
                
                this.renderChart(canvasId, labels, values);
            });
    }

    renderChart(canvasId, labels, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if(this.charts[canvasId]) this.charts[canvasId].destroy();

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102,126,234,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: {display: false} },
                plugins: { legend: {display: false} },
                animation: false
            }
        });
    }

    getDescription(name) {
        const n = name.toLowerCase();
        if(n.includes("hum")) return "Variable controlada (%)";
        if(n.includes("temp")) return "Variable monitoreada (°C)";
        if(n.includes("rpm") || n.includes("vel")) return "Variable de estado (x1)";
        if(n.includes("volt") || n.includes("señal")) return "Acción de control (u)";
        return "Dato de telemetría";
    }
}