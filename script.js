// ==========================================
// CONFIGURACIÓN DE LA BIOCÁPSULA
// ==========================================

// true = Simulación
// false = Conexión real con el ESP32
const MODO_SIMULACION = true;

// Dirección del ESP32 (cambiar cuando tengas el dispositivo)
const ESP32_URL = 'http://192.168.1.X/datos';

// Dirección de un futuro servidor seguro para Telegram.
// No colocar aquí el token del bot.
const TELEGRAM_ENDPOINT = "";

// Variables de monitoreo
let ultimaTemperatura = null;
let ultimaHoraTemperatura = Date.now();
let ultimoTiempoLectura = Date.now();
let alertaDesconexionEnviada = false;

// ==========================================
// ENVÍO DE ALERTAS A TELEGRAM
// ==========================================

async function enviarAlertaTelegram(mensaje) {
    if (!TELEGRAM_ENDPOINT) {
        console.warn("Telegram está pendiente de configurar mediante un servidor seguro.");
        return;
    }

    try {
        const respuesta = await fetch(TELEGRAM_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ mensaje: mensaje })
        });

        if (!respuesta.ok) {
            throw new Error("Error al enviar la alerta");
        }

        console.log("Alerta enviada correctamente.");
    } catch (error) {
        console.error("Error al enviar alerta:", error);
    }
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
    actualizarDatos();

    // Actualizar datos cada 60 segundos
    setInterval(actualizarDatos, 60000);

    // Revisar pérdida de conexión cada 30 segundos
    setInterval(verificarDesconexion, 30000);
});

// ==========================================
// SELECCIÓN DEL MODO DE FUNCIONAMIENTO
// ==========================================

function actualizarDatos() {

    if (MODO_SIMULACION) {
        simularDatos();
    } else {
        obtenerDatosESP32();
    }
}

// ==========================================
// GENERACIÓN DE DATOS SIMULADOS
// ==========================================

function simularDatos() {

    const datos = {
        temperatura: Number((24 + Math.random() * 3).toFixed(1)),
        humedad: Number((80 + Math.random() * 10).toFixed(1)),
        presion: Number((1010 + Math.random() * 8).toFixed(1)),
        co2: Math.floor(500 + Math.random() * 200),
        humedad_sustrato: Math.floor(60 + Math.random() * 15),
        nivel_agua: Math.floor(70 + Math.random() * 20)
    };

    procesarDatos(datos, true);
}

// ==========================================
// CONSULTA AL ESP32
// ==========================================

async function obtenerDatosESP32() {

    try {
        const respuesta = await fetch(ESP32_URL);

        if (!respuesta.ok) {
            throw new Error("No se recibió una respuesta válida del ESP32");
        }

        const datos = await respuesta.json();

        procesarDatos(datos, false);

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
// PROCESAMIENTO Y ACTUALIZACIÓN DE DATOS
// ==========================================

function procesarDatos(datos, esSimulacion) {

    const ahora = Date.now();

    ultimoTiempoLectura = ahora;
    alertaDesconexionEnviada = false;

    // ======================================
    // VERIFICACIÓN DE TEMPERATURA
    // Solo funciona con el ESP32 real
    // ======================================

    let tempActual = parseFloat(datos.temperatura);

    if (!esSimulacion && !isNaN(tempActual)) {

        if (ultimaTemperatura !== null) {

            const diferenciaTemp = tempActual - ultimaTemperatura;

            const minutosTranscurridos =
                (ahora - ultimaHoraTemperatura) / 60000;

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

    // ======================================
    // ACTUALIZAR TARJETAS DEL HTML
    // ======================================

    const elementoSensor = document.querySelector('.card-value-large');

    const estadoSistema = document.querySelector('.alert-text');

    if (elementoSensor) {

        elementoSensor.innerHTML =
            `${datos.temperatura} <span class="unit">°C</span> / ${datos.humedad}% <span class="unit">Humedad</span>`;
    }

    if (document.getElementById('presion')) {
        document.getElementById('presion').innerText = datos.presion;
    }

    if (document.getElementById('CO2')) {
        document.getElementById('CO2').innerText = datos.co2;
    }

    if (document.getElementById('sustrato')) {
        document.getElementById('sustrato').innerText = datos.humedad_sustrato;
    }

    if (document.getElementById('nivel_agua')) {
        document.getElementById('nivel_agua').innerText = datos.nivel_agua;
    }

    // ======================================
    // ESTADO DEL SISTEMA
    // ======================================

    if (estadoSistema) {

        if (esSimulacion) {
            estadoSistema.innerHTML =
                "🧪 Modo simulación activo | Datos ficticios";
            estadoSistema.style.color = "#3b82f6";
        } else {
            estadoSistema.innerHTML =
                "✅ ESP32 en línea | Transmitiendo datos";
            estadoSistema.style.color = "#22c55e";
        }
    }

    // ======================================
    // REGISTRAR HISTORIAL PARA GRÁFICA
    // ======================================

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

    datosTemperatura.push(Number(datos.temperatura) || 0);
    datosHumedad.push(Number(datos.humedad) || 0);
    datosPresion.push(Number(datos.presion) || 0);
    datosNivelAgua.push(Number(datos.nivel_agua) || 0);
    datosHumedadSustrato.push(Number(datos.humedad_sustrato) || 0);
    datosCO2.push(Number(datos.co2) || 0);

    if (miGrafica) {
        miGrafica.update();
    }
}

// ==========================================
// DETECCIÓN AUTOMÁTICA DE PÉRDIDA DE CONEXIÓN
// ==========================================

function verificarDesconexion() {

    // No revisar desconexiones cuando se utilizan datos simulados
    if (MODO_SIMULACION) {
        return;
    }

    const tiempoSinDatosSegundos =
        (Date.now() - ultimoTiempoLectura) / 1000;

    // Si pasan más de 60 segundos sin recibir respuesta
    if (tiempoSinDatosSegundos > 60 && !alertaDesconexionEnviada) {

        enviarAlertaTelegram(
            `⚠️ ¡ALERTA BIOCÁPSULA!\n` +
            `Se ha perdido la conexión con el ESP32. No se han recibido datos en más de 1 minuto.`
        );

        alertaDesconexionEnviada = true;
    }
}

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

    XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Historial Sensores"
    );

    XLSX.writeFile(
        libro,
        "Reporte_Biocapsula_Sensores.xlsx"
    );
}
// ==========================================
// NAVEGACIÓN ENTRE SECCIONES
// ==========================================

function mostrarSeccion(event, seccion) {

    event.preventDefault();

    const inicio = document.getElementById('seccion-inicio');
    const graficas = document.getElementById('seccion-graficas');

    const btnInicio = document.getElementById('btn-inicio');
    const btnGraficas = document.getElementById('btn-graficas');

    if (seccion === 'inicio') {

        inicio.style.display = 'block';
        graficas.style.display = 'none';

        btnInicio.classList.add('active');
        btnGraficas.classList.remove('active');

    } else if (seccion === 'graficas') {

        inicio.style.display = 'none';
        graficas.style.display = 'block';

        btnGraficas.classList.add('active');
        btnInicio.classList.remove('active');

        if (miGrafica) {
            miGrafica.resize();
            miGrafica.update();
        }
    }
}