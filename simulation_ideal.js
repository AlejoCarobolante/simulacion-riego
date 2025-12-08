class IdealSimulation {
    constructor() {
        // --- PARÁMETROS FÍSICOS (IDEAL) ---
        this.alpha = 0.5;   
        this.beta = 20.0;   
        this.k1 = 0.05;     
        this.k2 = 0.03;     
        this.gamma = 0.05;  
        this.dt = 0.1;      

        // --- ESTADO ---
        this.x_rpm = 0;
        this.x_temp = 20.0;
        this.humidity = 50;

        // --- PROTECCIÓN TÉRMICA (Agregada para consistencia) ---
        this.isCooling = false;
        this.coolStartTime = 0;
        this.TEMP_CRITICA = 80;
        this.COOL_TIME = 3000;

        // --- DEMO ---
        this.demoActive = false;
        this.demoStartTime = 0;
        this.DEMO_DURATION = 12000;
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
        return "▶️ Iniciando secuencia ideal...";
    }

    stopDemo() {
        this.demoActive = false;
    }

    update(manualHumidity, protectionEnabled) {
        let currentHum = manualHumidity;
        let demoMessage = "";
        let demoFinished = false;

        // 1. Input Demo
        if (this.demoActive) {
            const elapsed = Date.now() - this.demoStartTime;
            let progress = elapsed / this.DEMO_DURATION;
            if (progress > 1) progress = 1;
            
            // Rampa Lineal Ideal
            currentHum = Math.round(progress * 100);

            if (currentHum < 10) demoMessage = "🌱 Inicio (0%)";
            else if (currentHum < 50) demoMessage = "💧 Riego Activo";
            else if (currentHum < 90) demoMessage = "🌊 Saturación";
            else demoMessage = "✨ Objetivo (100%)";

            if (elapsed > this.DEMO_DURATION + 1000) {
                demoFinished = true;
                this.stopDemo();
            }
            this.humidity = currentHum;
        } else {
            this.humidity = manualHumidity;
        }

        // 2. Protección Térmica (Lógica Prioritaria)
        // Si superamos 80 grados, CORTAMOS TODO.
        if (protectionEnabled && !this.isCooling && this.x_temp >= this.TEMP_CRITICA) {
            this.isCooling = true;
            this.coolStartTime = Date.now();
        }

        let u = 0;
        
        if (this.isCooling) {
            // MODO ENFRIAMIENTO: Ignoramos control
            u = 0; 
            
            // Física: Solo disipación, sin generación de calor
            // x2' = -gamma * (x2 - Tamb)
            let dx2 = -this.gamma * (this.x_temp - 20);
            this.x_temp += dx2 * this.dt;
            
            // x1' = -alpha * x1 (Frenado natural por fricción)
            let dx1 = -this.alpha * this.x_rpm;
            this.x_rpm += dx1 * this.dt;

            // Salir del modo enfriamiento
            if ((Date.now() - this.coolStartTime) > this.COOL_TIME) {
                this.isCooling = false;
            }
        } else {
            // MODO NORMAL: Control Activo
            let error = (100.0 - currentHum) / 100.0;
            u = 5.0 * error; 
            u = Math.max(0, Math.min(u, 5.0));

            // Ecuaciones Diferenciales
            let dx1 = -this.alpha * this.x_rpm + this.beta * u;
            let dx2 = (this.k1 - this.k2) * this.x_rpm - this.gamma * (this.x_temp - 20);

            this.x_rpm += dx1 * this.dt;
            this.x_temp += dx2 * this.dt;
        }

        // Límites Físicos
        if (this.x_rpm < 0) this.x_rpm = 0;
        if (this.x_temp < 20) this.x_temp = 20;

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