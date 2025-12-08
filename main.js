// ======================================================
// CONFIGURACIÓN IOT (TUS KEYS)
// ======================================================
const IDEAL_CONFIG = { ID: '3195521', KEY: 'OV9AFAEO7QJ1BVG6' }; 
const REAL_CONFIG  = { ID: '3195523', KEY: '051133SXBZUY8HGT' }; 

// ======================================================
// VARIABLES DE ESTADO Y MÓDULOS
// ======================================================
let activeSimulation = null;        // Instancia de la simulación activa
const iotManager = new ThingSpeakManager(); // Instancia del gestor IoT

let loopInterval = null;
let rotation = 0;

// ======================================================
// SISTEMA DE NAVEGACIÓN
// ======================================================
function hideAllViews() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    stopLoop(); // Detener física al cambiar de pantalla
}

function goHome() {
    hideAllViews();
    document.getElementById('landing-page').classList.add('active');
}

function openSimulation(mode) {
    hideAllViews();
    document.getElementById('app-dashboard').classList.add('active');
    
    // Instanciar la clase correcta según el botón
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
        // Mostrar sección Python solo en Real (si existe en tu HTML)
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
    
    // Si entramos al dashboard IoT, iniciamos los paneles
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
    loopInterval = setInterval(uiUpdateLoop, 100); // 10 FPS de actualización UI
}

function stopLoop() {
    if(loopInterval) clearInterval(loopInterval);
}

function uiUpdateLoop() {
    if(!activeSimulation) return;

    // 1. Leer Inputs
    const slider = document.getElementById('humSlider');
    const protToggle = document.getElementById('protToggle');
    const manualHum = parseInt(slider.value);
    
    // 2. Calcular Física (Delegar a la clase)
    const state = activeSimulation.update(manualHum, protToggle.checked);

    // 3. Sincronizar UI con el Estado
    
    // Modo Demo: El slider se mueve solo
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

    // Overlay Fin de Demo
    if (state.demoEnded) {
        document.getElementById('demoEndOverlay').style.display = 'flex';
    }

    // Valores Numéricos
    document.getElementById('humVal').innerText = Math.round(state.hum) + "%";
    document.getElementById('voltVal').innerText = state.volt.toFixed(2) + " V";
    document.getElementById('rpmText').innerText = Math.round(state.rpm);
    document.getElementById('tempText').innerText = Math.round(state.temp) + "°C";

    // Barras de Progreso
    const rpmPct = (state.rpm / 200) * 100;
    const tempPct = Math.min(100, ((state.temp - 20) / 80) * 100);
    document.getElementById('rpmBar').style.width = rpmPct + "%";
    document.getElementById('tempBar').style.width = tempPct + "%";

    // Colores Dinámicos (Temperatura)
    const tBar = document.getElementById('tempBar');
    if(state.temp < 60) tBar.style.background = "linear-gradient(90deg, #ffc107, #ffca2c)";
    else if(state.temp < 80) tBar.style.background = "linear-gradient(90deg, #fd7e14, #ff922b)";
    else tBar.style.background = "linear-gradient(90deg, #dc3545, #ff1744)";

    // Estados del Motor
    const alertBox = document.getElementById('safetyAlert');
    const mStatus = document.getElementById('motorStatus');
    const mText = document.getElementById('motorStatusText');

    if (state.isCooling) {
        alertBox.style.display = 'block';
        document.getElementById('cooldownTimer').innerText = state.coolTimeInfo + "s";
        mStatus.className = 'status-indicator status-cooling';
        mText.innerText = 'Enfriando';
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

    // Animación del Ventilador
    if (state.rpm > 1) {
        rotation += state.rpm * 0.15;
        document.getElementById('fanBlade').style.transform = `rotate(${rotation}deg)`;
    }
}

// ======================================================
// EVENT LISTENERS
// ======================================================
document.getElementById('demoBtn').addEventListener('click', () => {
    if(activeSimulation) activeSimulation.startDemo();
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if(activeSimulation) {
        activeSimulation.reset();
        document.getElementById('humSlider').value = 50;
        // Forzar actualización inmediata para limpiar gráficos visuales
        uiUpdateLoop(); 
    }
});

document.getElementById('exitDemoBtn').addEventListener('click', () => {
    document.getElementById('demoEndOverlay').style.display = 'none';
    if(activeSimulation) activeSimulation.stopDemo();
});