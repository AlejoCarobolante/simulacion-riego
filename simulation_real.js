class RealSimulation {
    constructor() {
        // --- 1. PARÁMETROS FÍSICOS (MODELO REAL CALIBRADO) ---
        // Basados en identificación de sistemas (Motor 624 RPM)
        this.alpha = 0.5;   
        this.beta = 18.66;  // Ganancia Ajustada (Eficiencia ~93%)
        
        this.k1 = 0.05;     
        this.k2 = 0.03;     
        this.gamma = 0.05;  
        this.dt = 0.1;      

        // --- 2. VARIABLES DE ESTADO ---
        this.x_rpm = 0;
        this.x_temp = 20.0;
        this.humidity = 50;

        // Estado de Protección Térmica (Exclusivo del Real)
        this.isCooling = false;
        this.coolStartTime = 0;
        this.TEMP_CRITICA = 80;
        this.COOL_TIME = 3000; // 3 seg de hiséresis

        // --- 3. CONFIGURACIÓN DE DEMO (ALGORÍTMICA) ---
        this.demoActive = false;
        this.demoStartTime = 0;
        this.DEMO_DURATION = 15000; // 15 seg (Más lento, simula carga real)
    }

    reset() {
        this.x_rpm = 0;
        this.x_temp = 20.0;
        this.humidity = 50;
        this.isCooling = false;
        this.stopDemo();
    }

    startDemo() {
        this.demoActive = true;
        this.demoStartTime = Date.now();
        return "▶️ Iniciando ciclo de riego real...";
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
            const elapsed = Date.now() - this.demoStartTime;
            
            // Simulación de saturación no-lineal (Suelo real)
            // Curva ligeramente convexa: H = (t / T)^0.8 * 100
            let progress = elapsed / this.DEMO_DURATION;
            if (progress > 1) progress = 1;

            currentHum = Math.round(Math.pow(progress, 0.8) * 100);

            // Mensajes de estado dinámicos
            if (currentHum < 10) demoMessage = "🌱 Inicio: Bomba a plena carga";
            else if (currentHum < 50) demoMessage = "⚡ Motor bajo carga (Calentamiento)";
            else if (currentHum < 90) demoMessage = "💧 Saturando zona radicular...";
            else demoMessage = "✅ Riego finalizado";

            // Finalizar demo
            if (elapsed > this.DEMO_DURATION + 1000) {
                demoFinished = true;
                this.stopDemo();
            }
            
            this.humidity = currentHum;
        } else {
            this.humidity = manualHumidity;
        }

        // B. LÓGICA DE PROTECCIÓN TÉRMICA (Solo en Real)
        let u = 0;

        // 1. Detección de Sobrecalentamiento
        if (protectionEnabled && !this.isCooling && this.x_temp >= this.TEMP_CRITICA) {
            this.isCooling = true;
            this.coolStartTime = Date.now();
        }

        // 2. Máquina de Estados (Normal vs Enfriamiento)
        if (this.isCooling) {
            u = 0; // Corte de seguridad por relé térmico
            
            // Física de enfriamiento (Solo disipación natural)
            // dx2/dt = -gamma * (x2 - Tamb)
            let dx2 = -this.gamma * (this.x_temp - 20);
            this.x_temp += dx2 * this.dt;
            
            // Fricción detiene el motor rápidamente
            this.x_rpm *= 0.8; // Decaimiento exponencial simple
            if(this.x_rpm < 1) this.x_rpm = 0;

            // Chequeo de tiempo de seguridad
            if ((Date.now() - this.coolStartTime) > this.COOL_TIME) {
                this.isCooling = false; // Reset del relé
            }
        } else {
            // --- FUNCIONAMIENTO NORMAL ---
            
            // Ley de Control
            let error = (100.0 - currentHum) / 100.0;
            u = 5.0 * error;
            u = Math.max(0, Math.min(u, 5.0));

            // Ecuaciones Diferenciales (Modelo Calibrado)
            // Usamos beta = 18.66 para reflejar la pérdida de eficiencia
            let dx1 = -this.alpha * this.x_rpm + this.beta * u;
            let dx2 = (this.k1 - this.k2) * this.x_rpm - this.gamma * (this.x_temp - 20);

            // Integración Euler
            this.x_rpm += dx1 * this.dt;
            this.x_temp += dx2 * this.dt;
        }

        // Restricciones Físicas
        if (this.x_rpm < 0) this.x_rpm = 0;
        if (this.x_temp < 20) this.x_temp = 20;

        // C. RETORNO DE TELEMETRÍA
        return {
            rpm: this.x_rpm,
            temp: this.x_temp,
            volt: u,
            hum: currentHum,
            demoMsg: demoMessage,
            demoEnded: demoFinished,
            isCooling: this.isCooling,
            coolTimeInfo: this.isCooling ? Math.ceil((this.COOL_TIME - (Date.now() - this.coolStartTime))/1000) : 0
        };
    }
}