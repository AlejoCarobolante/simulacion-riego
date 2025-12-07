import matplotlib.pyplot as plt
import numpy as np

# Datos
voltaje = np.linspace(0, 5, 100)
# Modelo teórico original: RPM = 40 * V
rpm_teorico = 40 * voltaje

# Configuraciones del motor Tinkercad (valores aproximados)
# Caso 1: Configuración 416 (Relación 1.36 : 1)
rpm_416 = rpm_teorico / 1.36

# Caso 2: Configuración 520 (Relación 1.08 : 1)
rpm_520 = rpm_teorico / 1.08

# Caso 3: Configuración 624 (Relación 1.07 : 1)
rpm_624 = rpm_teorico / 1.07

# Caso 4: Configuración 730 (Relación 1.267 : 1, más rápido que el teórico)
rpm_730 = rpm_teorico * 1.267

# Gráfico
plt.figure(figsize=(12, 7))

# Línea base teórica
plt.plot(voltaje, rpm_teorico, label='Modelo Teórico (Ideal)', color='black', linestyle='--', linewidth=2)

# Líneas reales para cada configuración
plt.plot(voltaje, rpm_416, label='Motor Config 416 (Real)', color='red', linewidth=2)
plt.plot(voltaje, rpm_520, label='Motor Config 520 (Real)', color='green', linewidth=2)
plt.plot(voltaje, rpm_624, label='Motor Config 624 (Real)', color='blue', linewidth=2)
plt.plot(voltaje, rpm_730, label='Motor Config 730 (Real)', color='purple', linewidth=2)

# Decoración
plt.title('Comparativa de Configuraciones de Motor vs. Modelo Teórico', fontsize=16)
plt.xlabel('Voltaje de Entrada (V)', fontsize=12)
plt.ylabel('Velocidad Angular (RPM)', fontsize=12)
plt.grid(True, which='both', linestyle='--', alpha=0.7)
plt.legend(fontsize=12)
plt.xlim(0, 5)
plt.ylim(0, 260) # Ajustado para que quepa la curva de 730

# Anotaciones
plt.annotate('Mayor discrepancia\n(Error ~36%)', xy=(4.8, rpm_416[-1]), xytext=(3.5, 120),
             arrowprops=dict(facecolor='red', shrink=0.05))

plt.annotate('Mejor ajuste\n(Error ~7-8%)', xy=(4.8, rpm_624[-1]), xytext=(3.5, 180),
             arrowprops=dict(facecolor='blue', shrink=0.05))

plt.savefig('comparativa_configuraciones_motor.png')
plt.show()