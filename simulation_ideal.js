class IdealSimulation {
    constructor() {
        // --- 1. PARÁMETROS FÍSICOS (MODELO IDEAL) ---
        // Definición de Matrices de Estado
        // x1' = -alpha*x1 + beta*u
        this.alpha = 0.5;   // Fricción
        this.beta = 20.0;   // Ganancia Teórica (Diseño)
        
        // x2' = k1*x1 - k2*x1 - gamma*(x2 - Tamb)
        this.k1 = 0.05;     // Gen. Calor
        this.k2 = 0.03;     // Refrig. Agua
        this.gamma = 0.05;  // Disipación
        this.dt = 0.1;      // Paso de integración (100ms)

        // --- 2. VARIABLES DE ESTADO ---
        this.x_rpm = 0;     // Estado x1
        this.x_temp = 20.0; // Estado x2
        this.humidity = 50; // Entrada (Perturbación/Sensor)

        // --- 3. CONFIGURACIÓN DE LA DEMO (ALGORÍTMICA) ---
        this.demoActive = false;
        this.demoStartTime = 0;
        this.DEMO_DURATION = 12000; // 12 segundos para ir de 0 a 100%
    }

    reset() {
        this.x_rpm = 0;
        this.x_temp = 20.0;
        this.humidity = 50;
        this.stopDemo();
    }

    startDemo() {
        this.demoActive = true;
        this.demoStartTime = Date.now();
        return "▶️ Iniciando secuencia de carga...";
    }

    stopDemo() {
        this.demoActive = false;
    }

    // --- 4. BUCLE DE CÁLCULO FÍSICO ---
    update(manualHumidity, protectionEnabled) {
        let currentHum = manualHumidity;
        let demoMessage = "";
        let demoFinished = false;

        // A. GENERACIÓN DE ENTRADA (Input Generator)
        if (this.demoActive) {
            // Calculamos el tiempo transcurrido
            const elapsed = Date.now() - this.demoStartTime;
            
            // FÓRMULA DE RAMPA: H(t) = (t / T_total) * 100
            // Esto simula físicamente la saturación progresiva del suelo
            let progress = elapsed / this.DEMO_DURATION;
            
            if (progress > 1) progress = 1; // Saturación al 100%

            currentHum = Math.round(progress * 100);

            // Generación dinámica de mensajes según el estado de la variable
            if (currentHum < 5) demoMessage = "🌱 Inicio: Suelo Seco (0%)";
            else if (currentHum < 40) demoMessage = "💧 Riego Inicial (Caudal Máximo)";
            else if (currentHum < 80) demoMessage = "🌊 Aumentando Saturación...";
            else if (currentHum < 100) demoMessage = "✅ Llegando a capacidad de campo";
            else demoMessage = "✨ Objetivo Alcanzado (100%)";

            // Finalizar si completamos el tiempo + 1 segundo de espera
            if (elapsed > this.DEMO_DURATION + 1000) {
                demoFinished = true;
                this.stopDemo();
            }
            
            this.humidity = currentHum; // Actualizar variable interna
        } else {
            this.humidity = manualHumidity;
        }

        // B. CONTROLADOR (Lazo Cerrado Proporcional)
        // u(t) = Kp * e(t)  donde e(t) = (Ref - Humedad)
        let error = (100.0 - currentHum) / 100.0;
        let u = 5.0 * error; 
        
        // Saturación del actuador (0V a 5V)
        u = Math.max(0, Math.min(u, 5.0));

        // C. SOLUCIÓN NUMÉRICA DE ECUACIONES (Método de Euler)
        
        // Ecuación 1: Mecánica (RPM)
        let dx1 = -this.alpha * this.x_rpm + this.beta * u;
        
        // Ecuación 2: Termodinámica (Temperatura)
        let dx2 = (this.k1 - this.k2) * this.x_rpm - this.gamma * (this.x_temp - 20);

        // Integración: x(k+1) = x(k) + dx * dt
        this.x_rpm += dx1 * this.dt;
        this.x_temp += dx2 * this.dt;

        // Restricciones Físicas (No existen RPM negativas ni Temp < Ambiente)
        if (this.x_rpm < 0) this.x_rpm = 0;
        if (this.x_temp < 20) this.x_temp = 20;

        // D. RETORNO DE TELEMETRÍA
        return {
            rpm: this.x_rpm,
            temp: this.x_temp,
            volt: u,
            hum: currentHum,
            demoMsg: demoMessage,
            demoEnded: demoFinished,
            isCooling: false // El modelo ideal no simula fallos térmicos
        };
    }
}