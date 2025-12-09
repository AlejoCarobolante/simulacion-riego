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
let isPaused = true; 

// Configuración Visual
const RPM_GAUGE_MAX = 250; 

// ======================================================
// SISTEMA DE NAVEGACIÓN
// ======================================================
function hideAllViews() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    stopLoop();
    isPaused = false;
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

    fullReset(); 
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

    // Actualizar estado visual del botón de pausa
    updatePauseButton();

    const slider = document.getElementById('humSlider');
    const protToggle = document.getElementById('protToggle');
    const manualHum = parseInt(slider.value);
    
    // Calcular Física: Pasamos !isPaused para que la simulación sepa si avanzar el tiempo
    const state = activeSimulation.update(manualHum, protToggle.checked, !isPaused);

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
        isPaused = true; 
        document.getElementById('demoEndOverlay').style.display = 'flex';
        updatePauseButton();
    }

    // Valores
    document.getElementById('humVal').innerText = Math.round(state.hum) + "%";
    document.getElementById('voltVal').innerText = state.volt.toFixed(2) + " V";
    document.getElementById('rpmText').innerText = Math.round(state.rpm);
    document.getElementById('tempText').innerText = Math.round(state.temp) + "°C";

    // Escala Visual
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

    // Animación visual (Solo si no está pausado)
    if (!isPaused && state.rpm > 1) {
        rotation += state.rpm * 0.15;
        document.getElementById('fanBlade').style.transform = `rotate(${rotation}deg)`;
    }
}

function updatePauseButton() {
    const btn = document.getElementById('pauseBtn');
    if(isPaused) {
        btn.innerHTML = "<span>▶️</span> Reanudar";
        btn.style.background = "#2ecc71"; 
    } else {
        btn.innerHTML = "<span>⏸️</span> Pausa";
        btn.style.background = "#f1c40f"; 
    }
}

// ======================================================
// LISTENERS
// ======================================================

document.getElementById('demoBtn').addEventListener('click', () => {
    if(activeSimulation) {
        activeSimulation.startDemo();
        // PAUSA AUTOMÁTICA AL INICIAR DEMO
        isPaused = true; 
        updatePauseButton();
        uiUpdateLoop(); // Actualizar UI inmediatamente
    }
});

document.getElementById('pauseBtn').addEventListener('click', () => {
    isPaused = !isPaused;
    updatePauseButton();
});

document.getElementById('resetBtn').addEventListener('click', () => {
    fullReset();
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!activeSimulation) return;
    const csvContent = activeSimulation.getLogData();
    const blob = new Blob([csvContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const type = (activeSimulation instanceof IdealSimulation) ? 'IDEAL' : 'REAL';
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g,"-");
    a.download = `datos_${type}_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

document.getElementById('viewDataBtn').addEventListener('click', () => {
    document.getElementById('demoEndOverlay').style.display = 'none';
});

document.getElementById('exitDemoBtn').addEventListener('click', () => {
    fullReset();
});

document.getElementById('protToggle').addEventListener('change', (e) => {
    protectionEnabled = e.target.checked; // Esta variable debe ser global si se usa fuera
    // O mejor, el updateLoop ya lee el toggle directamente del DOM cada vez
    if (!e.target.checked) document.getElementById('safetyAlert').style.display = 'none'; 
});

function fullReset() {
    if(activeSimulation) {
        activeSimulation.reset();
        document.getElementById('humSlider').value = 50;
        
        // AL RESETEAR: PAUSAR
        isPaused = true;
        updatePauseButton();
        
        document.getElementById('demoEndOverlay').style.display = 'none';
        document.getElementById('demoStatus').style.display = 'none';
        document.getElementById('demoBtn').disabled = false;
        document.getElementById('humSlider').disabled = false;
        
        // Forzar actualización visual a ceros
        // Pasamos false para que no avance el tiempo, solo renderice el estado inicial
        activeSimulation.update(50, true, false); 
        
        // Limpieza visual extra
        document.getElementById('rpmText').innerText = "0";
        document.getElementById('rpmBar').style.width = "0%";
        document.getElementById('voltVal').innerText = "0.00 V";
    }
}

// ======================================================
// UTILIDADES GLOBALES (Fuera de fullReset)
// ======================================================

// 1. Copiar al Portapapeles
window.copyToClipboard = function(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Elemento con id '${elementId}' no encontrado.`);
        return;
    }
    
    const codeText = element.innerText;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeText).then(() => {
            alert("¡Código copiado al portapapeles! 📋");
        }).catch(err => {
            console.error('Error al copiar:', err);
            // Fallback manual si falla la API
            fallbackCopy(codeText);
        });
    } else {
        fallbackCopy(codeText);
    }
};

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert("¡Código copiado al portapapeles! 📋");
    } catch (err) {
        console.error('Fallback: Error al copiar', err);
    }
    document.body.removeChild(textArea);
}

// 2. Descargar archivo .m
window.downloadCode = function(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Elemento con id '${elementId}' no encontrado.`);
        return;
    }

    const codeText = element.innerText;
    const blob = new Blob([codeText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename; 
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};