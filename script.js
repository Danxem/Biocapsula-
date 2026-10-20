// ==========================================
// CONFIGURACIÓN DE TELEGRAM Y VARIABLES DE CONTROL
// ==========================================
const TELEGRAM_TOKEN = '8891713299:AAEE01uQ9bie6aaP37LHfXZcjs-LYQvVwWg';
const TELEGRAM_CHAT_ID = '8872216506';

// Variables de monitoreo
let ultimaTemperatura = null;
let ultimaHoraTemperatura = Date.now();
let ultimoTiempoLectura = Date.now();
let alertaDesconexionEnviada = false;

// Función para enviar alertas a Telegram
function enviarAlertaTelegram(mensaje) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(mensaje)}`;
    
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.ok) {
                console.log('✅ Alerta enviada a Telegram con éxito');
            } else {
                console.error('❌ Error Telegram:', data.description);
            }
        })
        .catch(err => console.error('❌ Error de red al contactar a Telegram:', err));
}

// ==========================================
// ESTRUCTURA DE LA GRÁFICA DE CHART.JS
// ==========================================
let historialTiempos = [];
let datosTemperatura = [];
let datosHumedad = [];
let datosPresion = [];
let datosNivelAgua = [];
let datosHumedadSustrato = [];
let datosCO2 = [];

let miGrafica;

document.addEventListener("DOMContentLoaded", () => {
    const canvasElement = document.getElementById('graficaSensores');
    if (canvasElement) {
        const ctx = canvasElement.getContext('2d');
        miGrafica = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historialTiempos,
                datasets: [
                    { label: 'Temperatura (°C)', data: datosTemperatura, borderColor: '#ef4444', tension: 0.1 },
                    { label: 'Humedad (%)', data: datosHumedad, borderColor: '#3b82f6', tension: 0.1 },
                    { label: 'Presión (hPa)', data: datosPresion, borderColor: '#8b5cf6', tension: 0.1 },
                    { label: 'Nivel Agua (%)', data: datosNivelAgua, borderColor: '#06b6d4', tension: 0.1 },
                    { label: 'Humedad Sustrato (%)', data: datosHumedadSustrato, borderColor: '#10b981', tension: 0.1 },
                    { label: 'CO2 (ppm)', data: datosCO2, borderColor: '#f59e0b', tension: 0.1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Primera lectura al cargar la página
    obtenerDatosESP32();
});

// ==========================================
// CONSULTA AL ESP32 Y MONITOREO DE TEMPERATURA
// ==========================================
async function obtenerDatosESP32() {
    try {
        let respuesta = await fetch('http://192.168.1.X/datos'); // Cambia por la IP de tu ESP32
        let datos = await respuesta.json();

        const ahora = Date.now();
        ultimoTiempoLectura = ahora;
        alertaDesconexionEnviada = false; // Resetear bandera de desconexión si volvió la señal

        // --- VERIFICACIÓN DE INCREMENTO REPENTINO DE TEMPERATURA ---
        let tempActual = parseFloat(datos.temperatura);
        if (!isNaN(tempActual)) {
            if (ultimaTemperatura !== null) {
                const diferenciaTemp = tempActual - ultimaTemperatura;
                const minutosTranscurridos = (ahora - ultimaHoraTemperatura) / 60000;

                // Si la temperatura sube 3°C o más en menos de 2 minutos
                if (diferenciaTemp >= 3.0 && minutosTranscurridos <= 2) {
                    enviarAlertaTelegram(
                        `🚨 ¡ALERTA BIOCÁPSULA!\n` +
                        `Incremento repentino de temperatura: +${diferenciaTemp.toFixed(1)}°C\n` +
                        `Temperatura actual: ${tempActual}°C`
                    );
                }
            }
            ultimaTemperatura = tempActual;
            ultimaHoraTemperatura = ahora;
        }

        // --- ACTUALIZAR TARJETAS EN EL HTML ---
        const elementoSensor = document.querySelector('.card-value-large');
        const estadoSistema = document.querySelector('.alert-text');

        if (elementoSensor) {
            elementoSensor.innerHTML = `${datos.temperatura} <span class="unit">°C</span> / ${datos.humedad}% <span class="unit">Humedad</span>`;
            
            if(document.getElementById('presion')) {
                document.getElementById('presion').innerText = datos.presion;
            }
            if(document.getElementById('CO2')) {
                document.getElementById('CO2').innerText = datos.co2;
            }
            if(document.getElementById('sustrato')) {
                document.getElementById('sustrato').innerText = datos.humedad_sustrato;
            }
            if(document.getElementById('nivel_agua')) {
                document.getElementById('nivel_agua').innerText = datos.nivel_agua;
            }
        }

        if (estadoSistema) {
            estadoSistema.innerHTML = "✅ ESP32 en línea | Transmitiendo datos en tiempo real";
            estadoSistema.style.color = "#22c55e";
        }

        // --- REGISTRAR HISTORIAL PARA LA GRÁFICA Y EXCEL ---
        let horaActual = new Date().toLocaleTimeString();
        
        if (historialTiempos.length > 20) {
            historialTiempos.shift();
            datosTemperatura.shift();
            datosHumedad.shift();
            datosPresion.shift();
            datosNivelAgua.shift();
            datosHumedadSustrato.shift();
            datosCO2.shift();
        }

        historialTiempos.push(horaActual);
        datosTemperatura.push(datos.temperatura || 0);
        datosHumedad.push(datos.humedad || 0);
        datosPresion.push(datos.presion || 0);
        datosNivelAgua.push(datos.nivel_agua || 0);
        datosHumedadSustrato.push(datos.humedad_sustrato || 0);
        datosCO2.push(datos.co2 || 0);

        if (miGrafica) {
            miGrafica.update();
        }

    } catch (error) {
        console.error("No se pudo conectar al ESP32:", error);
        const estadoSistema = document.querySelector('.alert-text');
        if (estadoSistema) {
            estadoSistema.innerHTML = "⚠️ ESP32 fuera de línea | Verificando conexión...";
            estadoSistema.style.color = "#f59e0b";
        }
    }
}

// ==========================================
// DETECCIÓN AUTOMÁTICA DE PÉRDIDA DE CONEXIÓN
// ==========================================
setInterval(() => {
    const tiempoSinDatosSegundos = (Date.now() - ultimoTiempoLectura) / 1000;

    // Si pasan más de 60 segundos sin recibir respuesta del ESP32
    if (tiempoSinDatosSegundos > 60 && !alertaDesconexionEnviada) {
        enviarAlertaTelegram(
            `⚠️ ¡ALERTA BIOCÁPSULA!\n` +
            `Se ha perdido la conexión con el ESP32. No se han recibido datos en más de 1 minuto.`
        );
        alertaDesconexionEnviada = true; // Para enviar una sola alerta mientras siga desconectado
    }
}, 30000);

// ==========================================
// EXPORTAR A EXCEL
// ==========================================
function descargarExcel() {
    if (historialTiempos.length === 0) {
        alert("No hay datos registrados todavía para exportar.");
        return;
    }

    let datosParaExcel = [];
    for (let i = 0; i < historialTiempos.length; i++) {
        datosParaExcel.push({
            "Hora": historialTiempos[i],
            "Temperatura (°C)": datosTemperatura[i],
            "Humedad (%)": datosHumedad[i],
            "Presión (hPa)": datosPresion[i],
            "Nivel de Agua (%)": datosNivelAgua[i],
            "Humedad Sustrato (%)": datosHumedadSustrato[i],
            "CO2 (ppm)": datosCO2[i]
        });
    }

    let hoja = XLSX.utils.json_to_sheet(datosParaExcel);
    let libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Historial Sensores");

    XLSX.writeFile(libro, "Reporte_Biocapsula_Sensores.xlsx");
}

// Consultar datos del ESP32 cada 60 segundos
setInterval(obtenerDatosESP32, 60000);