// ======================================================
// CONFIGURACIÓN IOT (TUS KEYS)
// ======================================================
const IDEAL_CONFIG = { ID: '3195521', KEY: 'OV9AFAEO7QJ1BVG6' }; 
const REAL_CONFIG  = { ID: '3195523', KEY: '051133SXBZUY8HGT' }; 

// ======================================================
// VARIABLES DE ESTADO
// ======================================================
let activeSimulation = null;
const iotManager = new ThingSpeakManager();

let loopInterval = null;
let rotation = 0;

// Configuración Visual
const RPM_GAUGE_MAX = 250; // La barra llega hasta 250 para mostrar que 200 es convergencia

// ======================================================
// SISTEMA DE NAVEGACIÓN
// ======================================================
function hideAllViews() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    stopLoop();
}

function goHome() {
    hideAllViews();
    document.getElementById('landing-page').classList.add('active');
}

function openSimulation(mode) {
    hideAllViews();
    document.getElementById('app-dashboard').classList.add('active');
    
    if (mode === 'real') {
        activeSimulation = new RealSimulation(); 
        setupUI('real');
    } else {
        activeSimulation = new IdealSimulation(); 
        setupUI('ideal');
    }

    activeSimulation.reset();
    startLoop();
}

function setupUI(mode) {
    const analysisSection = document.getElementById('realAnalysisSection');
    if (mode === 'real') {
        document.getElementById('simTitle').innerHTML = "<span>⚙️</span> Simulación Calibrada (Real)";
        document.getElementById('simSubtitle').innerText = "Parámetros ajustados al Motor 624 RPM (β = 18.66)";
        if(analysisSection) analysisSection.style.display = 'block';
    } else {
        document.getElementById('simTitle').innerHTML = "<span>📐</span> Simulación Teórica (Ideal)";
        document.getElementById('simSubtitle').innerText = "Parámetros de diseño ideal (β = 20.0)";
        if(analysisSection) analysisSection.style.display = 'none';
    }
}

function openView(viewId) {
    hideAllViews();
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'iot-dashboard') {
        iotManager.initPanel(IDEAL_CONFIG, 'iotPanelIdeal');
        iotManager.initPanel(REAL_CONFIG, 'iotPanelReal');
    }
}

// ======================================================
// BUCLE PRINCIPAL (UI LOOP)
// ======================================================
function startLoop() {
    if(loopInterval) clearInterval(loopInterval);
    loopInterval = setInterval(uiUpdateLoop, 100); 
}

function stopLoop() {
    if(loopInterval) clearInterval(loopInterval);
}

function uiUpdateLoop() {
    if(!activeSimulation) return;

    const slider = document.getElementById('humSlider');
    const protToggle = document.getElementById('protToggle');
    const manualHum = parseInt(slider.value);
    
    // Calcular Física
    const state = activeSimulation.update(manualHum, protToggle.checked);

    // Sincronizar UI (Demo)
    if (activeSimulation.demoActive) {
        slider.value = state.hum;
        document.getElementById('demoStatus').style.display = 'block';
        document.getElementById('demoMessage').innerText = state.demoMsg;
        document.getElementById('demoBtn').disabled = true;
        document.getElementById('humSlider').disabled = true;
    } else {
        document.getElementById('demoStatus').style.display = 'none';
        document.getElementById('demoBtn').disabled = false;
        document.getElementById('humSlider').disabled = false;
    }

    if (state.demoEnded) {
        document.getElementById('demoEndOverlay').style.display = 'flex';
    }

    // Valores
    document.getElementById('humVal').innerText = Math.round(state.hum) + "%";
    document.getElementById('voltVal').innerText = state.volt.toFixed(2) + " V";
    document.getElementById('rpmText').innerText = Math.round(state.rpm);
    document.getElementById('tempText').innerText = Math.round(state.temp) + "°C";

    // --- CORRECCIÓN: ESCALA VISUAL ---
    // Usamos RPM_GAUGE_MAX (250) para que la barra no se llene al 100% con 200 RPM
    const rpmPct = Math.min(100, (state.rpm / RPM_GAUGE_MAX) * 100);
    const tempPct = Math.min(100, ((state.temp - 20) / 80) * 100);

    document.getElementById('rpmBar').style.width = rpmPct + "%";
    document.getElementById('tempBar').style.width = tempPct + "%";

    // Colores
    const tBar = document.getElementById('tempBar');
    if(state.temp < 60) tBar.style.background = "#ffc107";
    else if(state.temp < 80) tBar.style.background = "#fd7e14";
    else tBar.style.background = "#dc3545";

    // Estados
    const alertBox = document.getElementById('safetyAlert');
    const mStatus = document.getElementById('motorStatus');
    const mText = document.getElementById('motorStatusText');

    if (state.isCooling) {
        alertBox.style.display = 'block';
        document.getElementById('cooldownTimer').innerText = state.coolTimeInfo + "s";
        mStatus.className = 'status-indicator status-cooling';
        mText.innerText = 'Enfriando';
        // Forzar barra roja en enfriamiento
        tBar.style.background = "#dc3545";
    } else {
        alertBox.style.display = 'none';
        if (state.rpm > 5) {
            mStatus.className = 'status-indicator status-running';
            mText.innerText = 'Activo';
        } else {
            mStatus.className = 'status-indicator';
            mText.innerText = 'Detenido';
            mStatus.style.background = '#6c757d';
        }
    }

    if (state.rpm > 1) {
        rotation += state.rpm * 0.15;
        document.getElementById('fanBlade').style.transform = `rotate(${rotation}deg)`;
    }
}

// ======================================================
// LISTENERS
// ======================================================
document.getElementById('demoBtn').addEventListener('click', () => {
    if(activeSimulation) activeSimulation.startDemo();
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if(activeSimulation) {
        activeSimulation.reset();
        document.getElementById('humSlider').value = 50;
        uiUpdateLoop(); 
    }
});

document.getElementById('exitDemoBtn').addEventListener('click', () => {
    document.getElementById('demoEndOverlay').style.display = 'none';
    if(activeSimulation) activeSimulation.stopDemo();
});