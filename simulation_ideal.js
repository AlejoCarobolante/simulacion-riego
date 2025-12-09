/**
 * SIMULACIÓN IDEAL (Modelo Matemático Teórico)
 * - Ganancia de diseño (Beta = 20.0)
 * - Protección Térmica Estándar
 * - Data Logger Optimizado (Muestreo cada 2s para coincidir con dinámica lenta)
 */

class IdealSimulation {
    constructor() {
        // --- 1. PARÁMETROS FÍSICOS (MATRICES A, B) ---
        // Ecuaciones: dx/dt = A*x + B*u
        this.alpha = 0.5;   // a (Fricción)
        this.beta = 20.0;   // b (Ganancia Teórica)
        this.k1 = 0.02;     // c (Generación de calor)
        this.gamma = 0.05;  // d (Disipación térmica)
        this.dt = 0.1;      // Paso de integración (100ms)

        // --- 2. VARIABLES DE ESTADO ---
        this.x_rpm = 0;     // x1
        this.x_temp = 20.0; // x2 (Inicial = T_amb)
        this.humidity = 50; // Entrada externa

        // --- 3. PROTECCIÓN TÉRMICA ---
        this.isCooling = false;
        this.coolStartSimTime = 0;
        this.TEMP_CRITICA = 80;
        this.COOL_TIME = 3000;

        // --- 4. CONFIGURACIÓN DEMO ---
        this.demoActive = false;
        this.currentTime = 0;       // Tiempo simulado acumulado (ms)
        this.DEMO_DURATION = 30000; // 30 segundos de ciclo

        // --- 5. DATA LOGGER (OPTIMIZADO) ---
        this.history = [];
        this.lastLogTime = 0;
        this.LOG_INTERVAL = 2000;   // Guardar cada 2 segundos (2000ms)
    }

    // Reinicia todo el sistema a condiciones iniciales
    reset() {
        this.x_rpm = 0;
        this.x_temp = 20.0;
        this.humidity = 50;
        this.isCooling = false;
        this.currentTime = 0;
        this.stopDemo();
        
        // Reiniciar Log
        this.history = [];
        this.lastLogTime = 0;
        this.logState(0, 0); // Guardar estado inicial (t=0)
    }

    startDemo() {
        this.demoActive = true;
        this.currentTime = 0;
        return "▶️ Iniciando secuencia ideal...";
    }

    stopDemo() {
        this.demoActive = false;
    }

    // Bucle Principal de Cálculo
    update(manualHumidity, protectionEnabled, isRunning) {
        let currentHum = manualHumidity;
        let demoMessage = "";
        let demoFinished = false;

        // Avanzar el reloj solo si no está en pausa
        if (isRunning) {
            this.currentTime += (this.dt * 1000);
        }

        // --- A. GENERADOR DE SEÑAL (DEMO) ---
        if (this.demoActive) {
            let progress = this.currentTime / this.DEMO_DURATION;
            if (progress > 1) progress = 1;
            
            // Perfil lineal ideal
            currentHum = Math.round(progress * 100);

            if (currentHum < 10) demoMessage = "🌱 Inicio (0%)";
            else if (currentHum < 50) demoMessage = "💧 Riego Activo";
            else if (currentHum < 90) demoMessage = "🌊 Saturación";
            else demoMessage = "✨ Objetivo (100%)";

            // Finalizar demo (+1s de margen)
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
            // MODO FALLO / ENFRIAMIENTO
            u = 0; // Corte de energía
            
            // Ecuación térmica: Solo disipación (-gamma * deltaT)
            dx2 = -this.gamma * (this.x_temp - 20);
            
            // Ecuación mecánica: Freno de emergencia (fricción aumentada x5)
            dx1 = -5.0 * this.alpha * this.x_rpm; 

            // Verificar si terminó el tiempo de enfriamiento
            if (isRunning && (this.currentTime - this.coolStartSimTime) > this.COOL_TIME) {
                // Histéresis: Solo reiniciar si la temperatura es segura (<60°C)
                if (this.x_temp < 60) this.isCooling = false;
            }
        } else {
            // MODO NORMAL
            // Ley de Control: u = Kp * error
            let error = (100.0 - currentHum) / 100.0;
            u = 5.0 * error; 
            u = Math.max(0, Math.min(u, 5.0)); // Saturación 0-5V

            // Ecuaciones Diferenciales (Modelo de Espacio de Estados)
            // dx1/dt = -a*x1 + b*u
            dx1 = -this.alpha * this.x_rpm + this.beta * u;
            
            // dx2/dt = c*x1 - d*(x2 - Tamb)
            dx2 = this.k1 * this.x_rpm - this.gamma * (this.x_temp - 20);
        }

        // --- C. INTEGRACIÓN NUMÉRICA (EULER) ---
        if (isRunning) {
            this.x_rpm += dx1 * this.dt;
            this.x_temp += dx2 * this.dt;

            // Restricciones físicas (no valores negativos)
            if (this.x_rpm < 0) this.x_rpm = 0;
            if (this.x_temp < 20) this.x_temp = 20;

            // --- D. LOGGING (OPTIMIZADO CADA 2 SEGUNDOS) ---
            if (this.currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
                this.logState(u, currentHum);
                this.lastLogTime = this.currentTime;
            }
        }

        // --- E. RETORNO DE TELEMETRÍA A LA UI ---
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

    // Método auxiliar para guardar un punto en el historial
    logState(u, hum) {
        this.history.push({
            t: (this.currentTime / 1000).toFixed(1),
            rpm: this.x_rpm.toFixed(2),
            temp: this.x_temp.toFixed(2),
            volt: typeof u === 'number' ? u.toFixed(2) : u,
            hum: hum
        });
    }

    // Método para exportar a CSV/TXT
    getLogData() {
        let txt = "Tiempo(s),RPM,Temperatura(C),Voltaje(V),Humedad(%)\n"; 
        this.history.forEach(row => {
            txt += `${row.t},${row.rpm},${row.temp},${row.volt},${row.hum}\n`;
        });
        return txt;
    }
}