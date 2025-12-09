class IdealSimulation {
    constructor() {
        this.alpha = 0.5; 
        this.beta = 20.0;
        this.k1 = 0.02; 
        this.gamma = 0.05;
        this.dt = 0.1;

        this.x_rpm = 0; this.x_temp = 20.0; this.humidity = 50;

        this.isCooling = false; this.coolStartSimTime = 0;
        this.TEMP_CRITICA = 80; this.COOL_TIME = 3000;

        this.demoActive = false; this.currentTime = 0;
        this.DEMO_DURATION = 30000;

        this.history = [];
        this.lastLogTime = 0;
        this.LOG_INTERVAL = 2000; // Guarda cada 2 segundos
    }

    reset() {
        this.x_rpm = 0; this.x_temp = 20.0; this.humidity = 50;
        this.isCooling = false; this.currentTime = 0;
        this.stopDemo();
        this.history = [];
        this.lastLogTime = 0;
        this.logState(0, 0);
    }

    startDemo() {
        this.demoActive = true; this.currentTime = 0;
        return "▶️ Iniciando secuencia ideal...";
    }

    stopDemo() { this.demoActive = false; }

    update(manualHumidity, protectionEnabled, isRunning) {
        let currentHum = manualHumidity;
        let demoMessage = "";
        let demoFinished = false;

        if (isRunning) this.currentTime += (this.dt * 1000);

        if (this.demoActive) {
            let progress = this.currentTime / this.DEMO_DURATION;
            if (progress > 1) progress = 1;
            currentHum = Math.round(progress * 100);

            if (currentHum < 10) demoMessage = "🌱 Inicio (0%)";
            else if (currentHum < 90) demoMessage = "🌊 Riego Activo";
            else demoMessage = "✨ Finalizado";

            if (this.currentTime > this.DEMO_DURATION + 1000) {
                demoFinished = true; this.stopDemo();
            }
            this.humidity = currentHum;
        } else {
            this.humidity = manualHumidity;
        }

        if (protectionEnabled && !this.isCooling && this.x_temp >= this.TEMP_CRITICA) {
            this.isCooling = true; this.coolStartSimTime = this.currentTime;
        }

        let u = 0; let dx1 = 0; let dx2 = 0;
        
        if (this.isCooling) {
            u = 0;
            dx2 = -this.gamma * (this.x_temp - 20);
            dx1 = -5.0 * this.alpha * this.x_rpm; 
            if (isRunning && (this.currentTime - this.coolStartSimTime) > this.COOL_TIME) {
                if (this.x_temp < 60) this.isCooling = false;
            }
        } else {
            let error = (100.0 - currentHum) / 100.0;
            u = 5.0 * error; u = Math.max(0, Math.min(u, 5.0));
            dx1 = -this.alpha * this.x_rpm + this.beta * u;
            dx2 = this.k1 * this.x_rpm - this.gamma * (this.x_temp - 20);
        }

        if (isRunning) {
            this.x_rpm += dx1 * this.dt;
            this.x_temp += dx2 * this.dt;
            if (this.x_rpm < 0) this.x_rpm = 0;
            if (this.x_temp < 20) this.x_temp = 20;

            if (this.currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
                this.logState(u, currentHum);
                this.lastLogTime = this.currentTime;
            }
        }

        return {
            rpm: this.x_rpm, temp: this.x_temp, volt: u, hum: currentHum,
            demoMsg: demoMessage, demoEnded: demoFinished, isCooling: this.isCooling,
            coolTimeInfo: this.isCooling ? Math.ceil((this.COOL_TIME - (this.currentTime - this.coolStartSimTime))/1000) : 0
        };
    }

    logState(u, hum) {
        this.history.push({
            rpm: this.x_rpm,
            temp: this.x_temp,
            volt: typeof u === 'number' ? u : parseFloat(u),
            hum: hum
        });
    }

    // --- CAMBIO CLAVE: Formato idéntico a Tinkercad ---
    getLogData() {
        let txt = ""; 
        this.history.forEach(row => {
            // Formato: Hum: 50% | u: 2.50V | RPM: 100 | Temp: 40C
            // Usamos Math.round en RPM y Temp porque tu código Matlab tiene regex (\d+) que solo lee enteros
            txt += `Hum: ${Math.round(row.hum)}% | u: ${row.volt.toFixed(2)}V | RPM: ${Math.round(row.rpm)} | Temp: ${Math.round(row.temp)}C\n`;
        });
        return txt;
    }
}