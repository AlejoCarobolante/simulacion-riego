/**
 * SIMULACIÓN REAL (Modelo Físico Calibrado)
 * - Ganancia experimental (Beta = 18.66, Eficiencia ~93%)
 * - Histéresis Térmica y Curva de Carga No Lineal
 * - Data Logger Optimizado (Muestreo cada 2s para ThingSpeak)
 */

class RealSimulation {
    constructor() {
        // --- 1. PARÁMETROS FÍSICOS (MATRICES A, B) ---
        // Modelo Calibrado: Motor 624 RPM
        this.alpha = 0.5;   // a
        this.beta = 18.66;  // b (Menor ganancia que el ideal)
        this.k1 = 0.02;     // c (Generación calor)
        this.gamma = 0.05;  // d (Disipación)
        this.dt = 0.1;      // Paso de integración (100ms)

        // --- 2. VARIABLES DE ESTADO ---
        this.x_rpm = 0;     // x1
        this.x_temp = 20.0; // x2
        this.humidity = 50; // Entrada

        // --- 3. PROTECCIÓN TÉRMICA ---
        this.isCooling = false;
        this.coolStartSimTime = 0;
        this.TEMP_CRITICA = 80;
        this.COOL_TIME = 3000;

        // --- 4. CONFIGURACIÓN DEMO ---
        this.demoActive = false;
        this.currentTime = 0;       
        this.DEMO_DURATION = 30000; // 30 segundos (Ciclo más lento para realismo)

        // --- 5. DATA LOGGER (OPTIMIZADO) ---
        this.history = [];
        this.lastLogTime = 0;
        this.LOG_INTERVAL = 2000;   // Guardar cada 2 segundos
    }

    reset() {
        this.x_rpm = 0;
        this.x_temp = 20.0;
        this.humidity = 50;
        this.isCooling = false;
        this.currentTime = 0;
        this.stopDemo();
        
        // Reset Log
        this.history = [];
        this.lastLogTime = 0;
        this.logState(0, 0);
    }

    startDemo() {
        this.demoActive = true;
        this.currentTime = 0;
        return "▶️ Ciclo Real: Cargando...";
    }

    stopDemo() {
        this.demoActive = false;
    }

    update(manualHumidity, protectionEnabled, isRunning) {
        let currentHum = manualHumidity;
        let demoMessage = "";
        let demoFinished = false;

        // Avanzar reloj
        if (isRunning) {
            this.currentTime += (this.dt * 1000);
        }

        // --- A. GENERADOR DE SEÑAL (DEMO) ---
        if (this.demoActive) {
            let progress = this.currentTime / this.DEMO_DURATION;
            if (progress > 1) progress = 1;

            // Curva de carga no lineal (t^0.8) para simular suelo real
            currentHum = Math.round(Math.pow(progress, 0.8) * 100);

            if (currentHum < 10) demoMessage = "🌱 Inicio: Carga Máxima";
            else if (currentHum < 50) demoMessage = "⚡ Calentamiento...";
            else if (currentHum < 90) demoMessage = "💧 Saturando...";
            else demoMessage = "✅ Riego finalizado";

            if (this.currentTime > this.DEMO_DURATION + 1000) {
                demoFinished = true;
                this.stopDemo();
            }
            this.humidity = currentHum;
        } else {
            this.humidity = manualHumidity;
        }

        // --- B. LÓGICA DE PROTECCIÓN TÉRMICA ---
        if (protectionEnabled && !this.isCooling && this.x_temp >= this.TEMP_CRITICA) {
            this.isCooling = true;
            this.coolStartSimTime = this.currentTime;
        }

        let u = 0;
        let dx1 = 0;
        let dx2 = 0;

        if (this.isCooling) {
            u = 0; // Corte
            // Ecuación térmica: Solo disipación
            dx2 = -this.gamma * (this.x_temp - 20);
            // Freno mecánico de emergencia
            dx1 = -5.0 * this.alpha * this.x_rpm;

            if (isRunning && (this.currentTime - this.coolStartSimTime) > this.COOL_TIME) {
                // Histéresis: Solo reiniciar si la temperatura bajó
                if (this.x_temp < 60) this.isCooling = false;
            }
        } else {
            // Control Normal
            let error = (100.0 - currentHum) / 100.0;
            u = 5.0 * error;
            u = Math.max(0, Math.min(u, 5.0));

            // Ecuaciones Diferenciales
            dx1 = -this.alpha * this.x_rpm + this.beta * u;
            dx2 = this.k1 * this.x_rpm - this.gamma * (this.x_temp - 20);
        }

        // --- C. INTEGRACIÓN ---
        if (isRunning) {
            this.x_rpm += dx1 * this.dt;
            this.x_temp += dx2 * this.dt;

            if (this.x_rpm < 0) this.x_rpm = 0;
            if (this.x_temp < 20) this.x_temp = 20;

            // --- D. LOGGING (OPTIMIZADO CADA 2 SEGUNDOS) ---
            if (this.currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
                this.logState(u, currentHum);
                this.lastLogTime = this.currentTime;
            }
        }

        // --- E. RETORNO ---
        return {
            rpm: this.x_rpm,
            temp: this.x_temp,
            volt: u,
            hum: currentHum,
            demoMsg: demoMessage,
            demoEnded: demoFinished,
            isCooling: this.isCooling,
            coolTimeInfo: this.isCooling ? Math.ceil((this.COOL_TIME - (this.currentTime - this.coolStartSimTime))/1000) : 0
        };
    }

    logState(u, hum) {
        this.history.push({
            t: (this.currentTime / 1000).toFixed(1),
            rpm: this.x_rpm.toFixed(2),
            temp: this.x_temp.toFixed(2),
            volt: typeof u === 'number' ? u.toFixed(2) : u,
            hum: hum
        });
    }

    getLogData() {
        let txt = "Tiempo,RPM,Temperatura,Voltaje,Humedad\n"; 
        this.history.forEach(row => {
            txt += `${row.t},${row.rpm},${row.temp},${row.volt},${row.hum}\n`;
        });
        return txt;
    }
}