#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

const int SENSOR_PIN = A0;
const int BOMBA_PIN  = 9;   
const int LED_G      = 10;  
const int LED_B      = 6;   

const int HUMEDAD_MIN = 0;
const int HUMEDAD_MAX = 876;

const float alpha = 0.5;    // Fricción 
const float beta  = 18.66;   // Ganancia 
const float k1    = 0.05;   // Generación calor
const float k2    = 0.03;   // Refrigeración agua
const float gamma = 0.05;   // Disipación aire
const float dt    = 0.13;   // 130ms

//variables de estado
float x_rpm = 0.0;          
float x_temp = 20.0;        

// limites físicos de la bomba
const float RPM_MAX = 200.0;
const float TEMP_AMB = 20.0;     
const float TEMP_CRITICA = 80.0; // En esta temperatura corta
const float TEMP_REINICIO = 60.0; // con esta temperatura vuelve a arrancar 
const long TIEMPO_ESPERA = 3000; 

// variables de control del modo emergencia
bool en_enfriamiento = false;      
unsigned long tiempo_inicio_corte = 0; 

int humedad = 0;    
float u = 0.0;      

void setup() {
  lcd.begin(16, 2);
  Serial.begin(9600);

  pinMode(BOMBA_PIN, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);

  lcd.print("Sistema Riego");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando");
  delay(1000);
  lcd.clear();
}

void loop() {
  // 1. leer humedad
  humedad = leerHumedad();

  // 2. control sobre la humedad
  u = calcularControl(humedad);

  // 3. modelo matemático
  actualizarEstados(u);

  // 4. interfaz
  aplicarActuador(x_rpm);
  actualizarInterfaz(humedad, x_rpm, x_temp);

  delay(1000); 
}

//procedimientos

int leerHumedad() {
  int lectura = analogRead(SENSOR_PIN);
  lectura = constrain(lectura, HUMEDAD_MIN, HUMEDAD_MAX);
  return map(lectura, HUMEDAD_MIN, HUMEDAD_MAX, 0, 100);
}

float calcularControl(int hum) {
  if (en_enfriamiento) {
    return 0.0; 
  }
  
  // Control Normal
  float volt = 5.0 * (1.0 - (float)hum / 100.0);
  return constrain(volt, 0.0, 5.0);
}

void actualizarEstados(float u_in) {
  
  // caso 1 entramos al modo emergencia
  if (!en_enfriamiento && x_temp >= TEMP_CRITICA) {
    en_enfriamiento = true;           // se activa la bandera
    tiempo_inicio_corte = millis();   // se inicia un cronometro
  }

  // caso 2 modo de enfriamiento
  if (en_enfriamiento) {
    x_rpm = 0; // apagamos el motor a la fuerza
    
    // física de enfriamiento 
    float dx2 = -gamma * (x_temp - TEMP_AMB); 
    x_temp += dx2 * dt;
    if (x_temp < TEMP_AMB) x_temp = TEMP_AMB;

    // Deben cumplirse las dos condiciones para salir
    // 1. Que hayan pasado 3 segundos del corte
    // 2. Que la temperatura haya bajado a 60 
    if (millis() - tiempo_inicio_corte > TIEMPO_ESPERA && x_temp < TEMP_REINICIO) {
      en_enfriamiento = false; 
    }
    
    return;
  }

  //caso 3 funcionamiento normal
  float dx1 = -alpha * x_rpm + beta * u_in;
  float dx2 = (k1 - k2) * x_rpm - gamma * (x_temp - TEMP_AMB);

  x_rpm  += dx1 * dt;
  x_temp += dx2 * dt;

  x_rpm = constrain(x_rpm, 0.0, RPM_MAX);
  if (x_temp < TEMP_AMB) x_temp = TEMP_AMB; 
}

void aplicarActuador(float rpm) {
  int pwm = map((long)rpm, 0, (long)RPM_MAX, 0, 255);
  analogWrite(BOMBA_PIN, pwm);
}

void actualizarInterfaz(int hum, float rpm, float temp) {
    if (hum >= 100) {
      analogWrite(LED_G, 255); analogWrite(LED_B, 0);
    } else {
      int azul = map(hum, 0, 100, 0, 255);
      analogWrite(LED_G, 0); analogWrite(LED_B, azul);
    }

  // LCD
  lcd.clear();
  if (en_enfriamiento) {
    lcd.print("!ENFRIANDO! ");
    
    lcd.setCursor(0, 1);
    lcd.print("Espere... "); 
    lcd.print((int)temp);
    lcd.print("C");
  } else {

    lcd.setCursor(0, 0);
    lcd.print("H:"); lcd.print(hum); lcd.print("% V:"); lcd.print(u, 1);
    lcd.setCursor(0, 1);
    lcd.print("RPM:"); lcd.print((int)rpm); 
    lcd.print(" T:"); lcd.print((int)temp); lcd.print("C");
  }

Serial.print("Hum: ");
Serial.print(hum);
Serial.print("% | u: ");
Serial.print(u, 2);
Serial.print("V | RPM: ");
Serial.print((int)x_rpm);
Serial.print(" | Temp: ");
Serial.print((int)x_temp);
Serial.println("C");
}