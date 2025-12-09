
clearvars; close all; clc;

a = 0.5;        % amortiguamiento RPM (1/s)
b = 18.66;       % ganancia por volt (RPM/V)
c = 0.02;       % generaci n de calor por RPM ( C/(RPM s))
d = 0.05;       % disipaci n t rmica (1/s)
T_amb = 20.0;   % temperatura ambiente ( C)

A = [-a, 0;
      c, -d];
B = [b; 0];

f = [0; d*T_amb];

disp("Matrices del modelo:");
A, B

%  lectura del txt
usar_datos_reales = true;
archivo = 'datos_real.txt';

if usar_datos_reales
    fid = fopen(archivo, 'r');
    if fid < 0, error('No se pudo abrir el txt'); end

    humedad_real = [];
    volt_real = [];
    rpm_real = [];
    temp_real = [];

    while ~feof(fid)
        linea = fgetl(fid);
        if ~ischar(linea), break; end

        tok_h = regexp(linea, 'Hum:\s*(\d+)%', 'tokens');
        tok_u = regexp(linea, 'u:\s*([\d\.]+)V', 'tokens');
        tok_r = regexp(linea, 'RPM:\s*(\d+)', 'tokens');
        tok_t = regexp(linea, 'Temp:\s*(\d+)C', 'tokens');

        if ~isempty(tok_h)
            humedad_real(end+1) = str2double(tok_h{1}{1});
            volt_real(end+1)    = str2double(tok_u{1}{1});
            rpm_real(end+1)     = str2double(tok_r{1}{1});
            temp_real(end+1)    = str2double(tok_t{1}{1});
        end
    end

    fclose(fid);

    fprintf('\nArchivo cargado correctamente.\n');
    fprintf('Total de muestras: %d\n', length(humedad_real));
end

%  puntos de equilibrio

u0 = 0;
u3 = 3; 
u5 = 5;

xeq0 = -A \ (B*u0 + f);   % equilibrio con u = 0
xeq3 = -A \ (B*u3 + f);   % equilibrio con u = 3V 
xeq5 = -A \ (B*u5 + f);   % equilibrio con u = 5V

disp("Equilibrio u = 0 V:");
xeq0
disp("Equilibrio u = 3 V:"); 
xeq3
disp("Equilibrio u = 5 V:");
xeq5

%  calculos plano de fase
% Malla
rpm_max = max(220, xeq5(1) * 1.2);
temp_max = max(T_amb + 60, xeq5(2) * 1.2);

rpm_vals  = linspace(0, rpm_max, 28);
temp_vals = linspace(max(5, T_amb-10), temp_max, 28);
[R, TT] = meshgrid(rpm_vals, temp_vals);

Xmat = [R(:)'; TT(:)'];

% Campo para u = 0
F0 = A * Xmat + B*u0 + f;
U0 = reshape(F0(1,:), size(R));
V0 = reshape(F0(2,:), size(R));

% Campo para u = 3  
F3 = A * Xmat + B*u3 + f;
U3 = reshape(F3(1,:), size(R));
V3 = reshape(F3(2,:), size(R));

% Campo para u = 5
F5 = A * Xmat + B*u5 + f;
U5 = reshape(F5(1,:), size(R));
V5 = reshape(F5(2,:), size(R));

%% TRAYECTORIAS SIMULADAS (ODE45)
tspan = [0 200];
ICs = [0  T_amb;
       20 T_amb+5;
       80 T_amb+15;
       150 T_amb+20]';

rhs0 = @(t,x) A*x + B*u0 + f;
rhs3 = @(t,x) A*x + B*u3 + f; 
rhs5 = @(t,x) A*x + B*u5 + f;

Traj0 = cell(1,size(ICs,2));
Traj3 = cell(1,size(ICs,2)); 
Traj5 = cell(1,size(ICs,2));

for k=1:size(ICs,2)
    [~, X0] = ode45(rhs0, tspan, ICs(:,k));
    [~, X3] = ode45(rhs3, tspan, ICs(:,k)); 
    [~, X5] = ode45(rhs5, tspan, ICs(:,k));
    
    Traj0{k} = X0;
    Traj3{k} = X3; 
    Traj5{k} = X5;
end

%  gr fico plano de fase
figure('Position',[50 100 1400 480]); % Hice la figura un poco m s ancha

% u = 0V
subplot(1,3,1); %esta es la posici n del gr fico en el subplot
quiver(R,TT,U0,V0,'k'); hold on;
for k=1:numel(Traj0)
    plot(Traj0{k}(:,1),Traj0{k}(:,2),'b','LineWidth',1.5);
end
plot(xeq0(1), xeq0(2), 'go','MarkerFaceColor','g','MarkerSize',8);
title("Campo de Fase   u = 0 V");
xlabel("RPM"); ylabel("Temperatura ( C)");
grid on;

% u = 3V 
subplot(1,3,2); % Posici n 2 (al medio)
quiver(R,TT,U3,V3,'k'); hold on;
for k=1:numel(Traj3)
    plot(Traj3{k}(:,1),Traj3{k}(:,2),'m','LineWidth',1.5); 
end
plot(xeq3(1), xeq3(2), 'mo','MarkerFaceColor','m','MarkerSize',8);
title("Campo de Fase   u = 3 V");
xlabel("RPM"); ylabel("Temperatura ( C)");
grid on;

% u = 5V 
subplot(1,3,3);
quiver(R,TT,U5,V5,'k'); hold on;
for k=1:numel(Traj5)
    plot(Traj5{k}(:,1),Traj5{k}(:,2),'r','LineWidth',1.5);
end
plot(xeq5(1), xeq5(2), 'ro','MarkerFaceColor','r','MarkerSize',8);
title("Campo de Fase   u = 5 V");
xlabel("RPM"); ylabel("Temperatura ( C)");
grid on;

subtitle('Planos de Fase del Modelo en Espacio de Estados');

%  envio a thingspeak
enviarThingSpeak = true; 
WRITE_API_KEY = 'RM41BR6RWPCTHQM5';

if enviarThingSpeak
    if isempty(humedad_real)
        error('No hay datos cargados.');
    end

    fprintf("\nEnviando %d muestras a ThingSpeak...\n", length(humedad_real));

    for k = 1:length(humedad_real)
        
        hum = humedad_real(k);
        u   = volt_real(k);
        rpm = rpm_real(k);
        temp = temp_real(k);

        url = sprintf("https://api.thingspeak.com/update?api_key=%s&field1=%.2f&field2=%.2f&field3=%.2f&field4=%d", ...
                      WRITE_API_KEY, rpm, temp, u, hum);

        try
            webread(url);
            fprintf("OK [%d/%d]  RPM %.1f | Temp %.1f | u %.2fV | Hum %d%%\n", ...
                    k, length(humedad_real), rpm, temp, u, hum);
        catch
            warning("Fallo en env o.");
        end

        pause(16); 
    end

    fprintf("\n*** Env o finalizado ***\n");
end
    