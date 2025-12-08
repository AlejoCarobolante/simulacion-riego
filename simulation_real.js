class RealSimulation {
    constructor() {
        // --- PARÁMETROS REALES ---
        this.alpha = 0.5;   
        this.beta = 18.66;  
        this.k1 = 0.05;     
        this.k2 = 0.03;     
        this.gamma = 0.05;  
        this.dt = 0.1;      

        this.x_rpm = 0;
        this.x_temp = 20.0;
        this.humidity = 50;

        // Protección Térmica
        this.isCooling = false;
        this.coolStartTime = 0;
        this.TEMP_CRITICA = 80;
        this.COOL_TIME = 3000;

        // Demo
        this.demoActive = false;
        this.demoStartTime = 0;
        this.DEMO_DURATION = 15000;
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
        return "▶️ Ciclo Real: Cargando...";
    }

    stopDemo() {
        this.demoActive = false;
    }

    update(manualHumidity, protectionEnabled) {
        let currentHum = manualHumidity;
        let demoMessage = "";
        let demoFinished = false;

        // 1. Generador de Entrada
        if (this.demoActive) {
            const elapsed = Date.now() - this.demoStartTime;
            let progress = elapsed / this.DEMO_DURATION;
            if (progress > 1) progress = 1;

            // Curva no lineal para realismo
            currentHum = Math.round(Math.pow(progress, 0.8) * 100);

            if (currentHum < 10) demoMessage = "🌱 Inicio: Bomba a plena carga";
            else if (currentHum < 50) demoMessage = "⚡ Calentamiento por carga";
            else if (currentHum < 90) demoMessage = "💧 Saturando zona radicular";
            else demoMessage = "✅ Riego finalizado";

            if (elapsed > this.DEMO_DURATION + 1000) {
                demoFinished = true;
                this.stopDemo();
            }
            this.humidity = currentHum;
        } else {
            this.humidity = manualHumidity;
        }

        // 2. Lógica de Protección Térmica (PRIORIDAD ABSOLUTA)
        
        // Disparador
        if (protectionEnabled && !this.isCooling && this.x_temp >= this.TEMP_CRITICA) {
            this.isCooling = true;
            this.coolStartTime = Date.now();
        }

        let u = 0;

        if (this.isCooling) {
            // MODO EMERGENCIA: CORTAR TODO
            u = 0; 
            
            // Ecuación térmica SIN generación de calor (k1*x1 eliminado)
            // Solo actúa la disipación: x2' = -gamma * (x2 - Tamb)
            let dx2 = -this.gamma * (this.x_temp - 20);
            this.x_temp += dx2 * this.dt;
            
            // Freno de emergencia al motor (Fricción aumentada x5 para simular freno)
            // x1' = -5 * alpha * x1
            let dx1 = -5.0 * this.alpha * this.x_rpm;
            this.x_rpm += dx1 * this.dt;

            // Temporizador
            if ((Date.now() - this.coolStartTime) > this.COOL_TIME) {
                // Solo permitimos reiniciar si la temperatura bajó lo suficiente (Histeresis)
                if (this.x_temp < 60) { 
                    this.isCooling = false;
                }
            }
        } else {
            // MODO NORMAL
            let error = (100.0 - currentHum) / 100.0;
            u = 5.0 * error;
            u = Math.max(0, Math.min(u, 5.0));

            // Ecuaciones Completas
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