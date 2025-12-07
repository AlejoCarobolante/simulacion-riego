// ======================================================
// CONFIGURACIÓN IOT (Solo Keys)
// ======================================================
const IDEAL_CONFIG = { ID: '3177048', KEY: 'DAZRG8GSL10W5AYJ' }; 
const REAL_CONFIG  = { ID: '3177048', KEY: 'DAZRG8GSL10W5AYJ' }; 

// ======================================================
// VARIABLES DE ESTADO UI
// ======================================================
let activeSimulation = null; // Instancia de la clase (Ideal o Real)
let loopInterval = null;
let rotation = 0;

// ======================================================
// SISTEMA DE NAVEGACIÓN Y CARGA
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
    
    // INSTANCIAR LA CLASE CORRESPONDIENTE (Aquí ocurre la magia)
    if (mode === 'real') {
        activeSimulation = new RealSimulation(); // Usa simulation_real.js
        setupUI('real');
    } else {
        activeSimulation = new IdealSimulation(); // Usa simulation_ideal.js
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
        // initIoTPage() viene de iot.js (si lo mantienes separado)
        if(typeof initIoTPage === 'function') initIoTPage();
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

    // 1. Leer Controles UI
    const slider = document.getElementById('humSlider');
    const protToggle = document.getElementById('protToggle');
    const manualHum = parseInt(slider.value);
    
    // 2. PEDIR A LA SIMULACIÓN QUE CALCULE EL SIGUIENTE PASO
    // (Le pasamos los inputs y ella nos devuelve el estado completo)
    const state = activeSimulation.update(manualHum, protToggle.checked);

    // 3. Actualizar la UI con la respuesta de la simulación
    
    // Sincronizar slider si estamos en demo
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

    // Fin de demo
    if (state.demoEnded) {
        document.getElementById('demoEndOverlay').style.display = 'flex';
    }

    // Textos y Barras
    document.getElementById('humVal').innerText = Math.round(state.hum) + "%";
    document.getElementById('voltVal').innerText = state.volt.toFixed(2) + " V";
    document.getElementById('rpmText').innerText = Math.round(state.rpm);
    document.getElementById('tempText').innerText = Math.round(state.temp) + "°C";

    const rpmPct = (state.rpm / 200) * 100;
    const tempPct = Math.min(100, ((state.temp - 20) / 80) * 100);
    document.getElementById('rpmBar').style.width = rpmPct + "%";
    document.getElementById('tempBar').style.width = tempPct + "%";

    // Colores Termómetro
    const tBar = document.getElementById('tempBar');
    if(state.temp < 60) tBar.style.background = "#ffc107";
    else if(state.temp < 80) tBar.style.background = "#fd7e14";
    else tBar.style.background = "#dc3545";

    // Estados y Alertas
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

    // Animación visual
    if (state.rpm > 1) {
        rotation += state.rpm * 0.1;
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
    }
});

document.getElementById('exitDemoBtn').addEventListener('click', () => {
    document.getElementById('demoEndOverlay').style.display = 'none';
    if(activeSimulation) activeSimulation.stopDemo();
});