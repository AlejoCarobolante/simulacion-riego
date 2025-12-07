// ======================================================
// PARÁMETROS DEL MODELO (CALIBRADOS)
// ======================================================
const alpha = 0.5;
const beta = 18.66;  // Ajustado a la realidad del Motor 624 RPM
const k1 = 0.05;     // Coeficiente de generación de calor
const k2 = 0.03;     // Refrigeración por agua
const gamma = 0.05;  // Disipación al ambiente
const dt = 0.1;      // Paso de tiempo (100ms)

// ======================================================
// VARIABLES DE ESTADO Y CONFIGURACIÓN
// ======================================================
let x_rpm = 0;
let x_temp = 20;

// Configuración de Seguridad
const TEMP_AMB = 20;
const TEMP_CRITICA = 80;
const TEMP_REINICIO = 60;
const RPM_MAX = 200;
const TIEMPO_ESPERA = 3000;

// Estado del Sistema
let en_enfriamiento = false;
let tiempo_inicio_corte = 0;
let rotation = 0;
let demoRunning = false;
let demoStep = 0;
let protectionEnabled = true;
let simulationPaused = false; // Variable para congelar física al final de la demo

// ======================================================
// REFERENCIAS AL DOM (Interfaz)
// ======================================================
const slider = document.getElementById('humSlider');
const humVal = document.getElementById('humVal');
const voltVal = document.getElementById('voltVal');
const rpmBar = document.getElementById('rpmBar');
const tempBar = document.getElementById('tempBar');
const rpmText = document.getElementById('rpmText');
const tempText = document.getElementById('tempText');
const fanBlade = document.getElementById('fanBlade');
const safetyAlert = document.getElementById('safetyAlert');
const cooldownTimer = document.getElementById('cooldownTimer');
const demoBtn = document.getElementById('demoBtn');
const resetBtn = document.getElementById('resetBtn');
const demoStatus = document.getElementById('demoStatus');
const demoMessage = document.getElementById('demoMessage');
const motorStatus = document.getElementById('motorStatus');
const motorStatusText = document.getElementById('motorStatusText');
const protToggle = document.getElementById('protToggle');
const demoEndOverlay = document.getElementById('demoEndOverlay');
const exitDemoBtn = document.getElementById('exitDemoBtn');

// ======================================================
// EVENT LISTENERS
// ======================================================
demoBtn.addEventListener('click', startDemo);
resetBtn.addEventListener('click', resetSystem);
exitDemoBtn.addEventListener('click', exitFrozenDemo);

slider.addEventListener('input', () => {
    if (!demoRunning) updateSliderDisplay();
});

protToggle.addEventListener('change', (e) => {
    protectionEnabled = e.target.checked;
    if(!protectionEnabled) {
        // Si se desactiva la protección, salimos del modo enfriamiento
        en_enfriamiento = false;
        safetyAlert.style.display = 'none';
    }
});

// ======================================================
// LÓGICA DE DEMOSTRACIÓN
// ======================================================
const demoSequence = [
    { time: 0,    humedad: 0,  message: "🌱 Suelo seco (0%) - Máxima potencia" },
    { time: 3000, humedad: 25, message: "💧 Humedad subiendo (25%)" },
    { time: 7000, humedad: 50, message: "💧 Riego constante (50%)" },
    { time: 12000, humedad: 80, message: "✅ Casi listo (80%) - Bajando RPM" },
    { time: 16000, humedad: 100, message: "✨ Riego Completado (100%)" }
];

function startDemo() {
    if (demoRunning) return;
    
    demoRunning = true;
    demoStep = 0;
    simulationPaused = false; 
    demoBtn.disabled = true;
    demoBtn.innerHTML = '<span>⏸️</span> Demo en curso...';
    demoStatus.style.display = 'block';
    
    slider.disabled = true; // Solo deshabilitamos el slider
    
    resetSystem();
    runDemoSequence();
}

function runDemoSequence() {
    if (demoStep >= demoSequence.length) {
        freezeDemo(); 
        return;
    }

    const step = demoSequence[demoStep];
    
    setTimeout(() => {
        if (!demoRunning) return;
        
        slider.value = step.humedad;
        updateSliderDisplay();
        demoMessage.textContent = step.message;
        
        demoStep++;
        runDemoSequence();
    }, demoStep === 0 ? 0 : demoSequence[demoStep].time - demoSequence[demoStep - 1].time);
}

function freezeDemo() {
    simulationPaused = true; 
    demoEndOverlay.style.display = 'flex'; 
    demoStatus.style.display = 'none';
}

function exitFrozenDemo() {
    demoEndOverlay.style.display = 'none';
    demoRunning = false;
    simulationPaused = false; 
    
    demoBtn.disabled = false;
    demoBtn.innerHTML = '<span>▶️</span> Iniciar Demo';
    slider.disabled = false;
}

// ======================================================
// LÓGICA DE SIMULACIÓN (BUCLE PRINCIPAL)
// ======================================================
function resetSystem() {
    x_rpm = 0;
    x_temp = 20;
    en_enfriamiento = false;
    rotation = 0;
    slider.value = 50;
    protToggle.checked = true;
    protectionEnabled = true;
    
    simulationPaused = false;
    demoEndOverlay.style.display = 'none';
    
    updateSliderDisplay();
    updateUI();
}

function updateSliderDisplay() {
    const humedad = parseInt(slider.value);
    humVal.innerText = humedad + "%";
}

// Loop que corre cada 130ms (dt)
setInterval(() => {
    if (simulationPaused) return; 

    let humedad = parseInt(slider.value);
    humVal.innerText = humedad + "%";

    let u = 0;

    // Lógica de Protección Térmica
    if (protectionEnabled && !en_enfriamiento && x_temp >= TEMP_CRITICA) {
        en_enfriamiento = true;
        tiempo_inicio_corte = Date.now();
    }

    if (en_enfriamiento) {
        u = 0;
        safetyAlert.style.display = 'block';
        const tiempoPasado = Date.now() - tiempo_inicio_corte;
        const tiempoRestante = Math.max(0, Math.ceil((TIEMPO_ESPERA - tiempoPasado) / 1000));
        cooldownTimer.textContent = tiempoRestante + "s";

        // Física de enfriamiento
        let dx2 = -gamma * (x_temp - TEMP_AMB);
        x_temp += dx2 * dt;
        if (x_temp < TEMP_AMB) x_temp = TEMP_AMB;
        x_rpm = 0; 

        if (tiempoPasado > TIEMPO_ESPERA && x_temp < TEMP_REINICIO) {
            en_enfriamiento = false;
            safetyAlert.style.display = 'none';
        }
    } else {
        // Control Proporcional
        u = 5.0 * (1.0 - humedad / 100.0);
        u = Math.max(0, Math.min(u, 5.0)); 
        safetyAlert.style.display = 'none';

        // Ecuaciones de Estado
        let dx1 = -alpha * x_rpm + beta * u;
        let dx2 = (k1 - k2) * x_rpm - gamma * (x_temp - TEMP_AMB);

        x_rpm += dx1 * dt;
        x_temp += dx2 * dt;

        x_rpm = Math.max(0, Math.min(x_rpm, RPM_MAX));
        if (x_temp < TEMP_AMB) x_temp = TEMP_AMB;
    }

    voltVal.innerText = u.toFixed(2) + " V";
    updateUI();

}, 130); 

function updateUI() {
    let rpmPct = (x_rpm / RPM_MAX) * 100;
    // Si la protección está off, la barra puede superar el 100% visualmente
    let visualMaxTemp = protectionEnabled ? 100 : 250;
    let tempPct = Math.min(100, ((x_temp - 20) / (visualMaxTemp - 20)) * 100);
    
    rpmBar.style.width = rpmPct + "%";
    rpmText.innerText = Math.round(x_rpm) + " RPM";

    tempBar.style.width = tempPct + "%";
    tempText.innerText = Math.round(x_temp) + "°C";

    // Colores dinámicos
    if (x_temp < 60) tempBar.style.background = "linear-gradient(90deg, #ffc107, #ffca2c)";
    else if (x_temp < 80) tempBar.style.background = "linear-gradient(90deg, #fd7e14, #ff922b)";
    else tempBar.style.background = "linear-gradient(90deg, #dc3545, #ff1744)";

    // Estados visuales del motor
    if (en_enfriamiento) {
        motorStatus.className = 'status-indicator status-cooling';
        motorStatusText.textContent = 'Sistema en Enfriamiento';
    } else if (x_rpm > 10) {
        motorStatus.className = 'status-indicator status-running';
        motorStatusText.textContent = 'Motor Activo';
    } else {
        motorStatus.className = 'status-indicator';
        motorStatusText.textContent = 'Motor Detenido';
        motorStatus.style.background = '#6c757d';
    }

    if (x_rpm > 1) {
        rotation += x_rpm * 0.15;
        fanBlade.style.transform = `rotate(${rotation}deg)`;
    }
}

// ======================================================
// INTEGRACIÓN THINGSPEAK
// ======================================================
const THINGSPEAK_CHANNEL_ID = '3177048';
const THINGSPEAK_API_KEY = 'DAZRG8GSL10W5AYJ';
const THINGSPEAK_URL_BASE = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/fields/`;

function fetchThingSpeakData(field, chartId) {
    const url = `${THINGSPEAK_URL_BASE}${field}.json?api_key=${THINGSPEAK_API_KEY}&results=20`;
    fetch(url).then(res => res.json()).then(data => {
        const feeds = data.feeds || [];
        const labels = feeds.map(f => {
            const d = new Date(f.created_at);
            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        });
        const values = feeds.map(f => parseFloat(f['field' + field]) || 0);
        renderThingSpeakChart(labels, values, chartId, field);
    });
}

function renderThingSpeakChart(labels, values, chartId, field) {
    const ctx = document.getElementById(chartId).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Field ${field}`,
                data: values,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102,126,234,0.1)',
                fill: true,
                tension: 0.2,
                pointRadius: 2
            }]
        },
        options: {
            scales: { x: { display: true }, y: { display: true, title: { display: true, text: 'Valor' } } },
            plugins: { legend: { display: false } }
        }
    });
}

// Inicialización de gráficos
fetchThingSpeakData(4, 'thingspeakChart');
setInterval(() => fetchThingSpeakData(4, 'thingspeakChart'), 60000);

document.getElementById('addChartBtn').addEventListener('click', () => {
    let fieldId = prompt('Ingrese el ID del field (1-8):');
    fieldId = parseInt(fieldId);
    if (!fieldId || fieldId < 1 || fieldId > 8) { alert('ID inválido'); return; }
    const chartContainer = document.createElement('div');
    chartContainer.style.marginTop = '20px';
    chartContainer.style.position = 'relative';
    chartContainer.innerHTML = `
        <button class="removeChartBtn" style="position:absolute;top:5px;right:5px;padding:2px 8px;border-radius:6px;border:none;background:#dc3545;color:white;cursor:pointer;">🗑️</button>
        <div class="status-text"><span>Field ${fieldId} (ThingSpeak)</span></div>
        <canvas id="thingspeakChart${fieldId}" width="400" height="180"></canvas>
    `;
    document.getElementById('extraCharts').appendChild(chartContainer);
    fetchThingSpeakData(fieldId, `thingspeakChart${fieldId}`);
    chartContainer.querySelector('.removeChartBtn').addEventListener('click', () => chartContainer.remove());
});

// Inicialización
updateSliderDisplay();
updateUI();