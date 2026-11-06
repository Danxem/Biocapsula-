
// ==========================================
// CONFIGURACIÓN DE LA BIOCÁPSULA
// ==========================================

// true = Simulación
// false = Conexión real con el ESP32
const MODO_SIMULACION = true;

// Dirección del ESP32
const ESP32_URL = 'http://192.168.1.X/datos';

// Servidor seguro para enviar mensajes a Telegram
// Se configurará cuando preparemos el servidor
const TELEGRAM_ENDPOINT = "https://biocapsula-alertas.dcastanon80.workers.dev/";

// Límites ambientales
const TEMPERATURA_MINIMA = 21;
const TEMPERATURA_MAXIMA = 27;
const HUMEDAD_DESEADA = 95;

// Referencias para las gráficas
const TEMPERATURA_SETPOINT = 24;
const HUMEDAD_MINIMA_GRAFICA = 85;
const HUMEDAD_SETPOINT_GRAFICA = 90;
const HUMEDAD_MAXIMA_GRAFICA = 95;
const CO2_MAXIMO_SENSOR = 5000;

// Variables de monitoreo
let ultimaTemperatura = null;
let ultimaHoraTemperatura = null;
let ultimoTiempoLectura = Date.now();
let alertaDesconexionEnviada = false;

// Control para evitar alertas repetidas
let alertasActivas = {
    temperaturaBaja: false,
    temperaturaAlta: false,
    humedadBaja: false,
    humedadAlta: false,
    cambioRepentino: false
};

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
            throw new Error("No se pudo enviar la alerta");
        }

        console.log("Alerta enviada correctamente a Telegram.");

    } catch (error) {
        console.error("Error al enviar alerta:", error);
    }
}

// ==========================================
// ESTRUCTURA DE LA GRÁFICA
// ==========================================

let historialTiempos = [];
let datosTemperatura = [];
let datosHumedad = [];
let datosPresion = [];
let datosNivelAgua = [];
let datosHumedadSustrato = [];
let datosCO2 = [];

// Instancias independientes de las seis gráficas
let graficas = {
    temperatura: null,
    humedad: null,
    co2: null,
    sustrato: null,
    presion: null,
    nivelAgua: null
};

// ==========================================
// INICIO DEL SISTEMA
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    actualizarDatos();

    // Actualizar datos cada 60 segundos
    setInterval(actualizarDatos, 60000);

    // Revisar conexión cada 30 segundos
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
        humedad: Number((94 + Math.random() * 2).toFixed(1)),
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
            throw new Error("Respuesta no válida del ESP32");
        }

        const datos = await respuesta.json();

        procesarDatos(datos, false);

    } catch (error) {

        console.error("No se pudo conectar al ESP32:", error);

        const estadoSistema = document.querySelector('.alert-text');

        if (estadoSistema) {
            estadoSistema.innerHTML =
                "⚠️ ESP32 fuera de línea | Verificando conexión...";

            estadoSistema.style.color = "#f59e0b";
        }
    }
}

// ==========================================
// PROCESAMIENTO DE DATOS
// ==========================================

function procesarDatos(datos, esSimulacion) {

    const ahora = Date.now();

    ultimoTiempoLectura = ahora;
    alertaDesconexionEnviada = false;

    const tempActual = Number(datos.temperatura);
    const humedadActual = Number(datos.humedad);

    // ======================================
    // SISTEMA DE ALERTAS
    // Solo se activa con el ESP32 real
    // ======================================

    if (!esSimulacion) {

        verificarTemperatura(tempActual, ahora);

        verificarHumedad(humedadActual);
    }

    // ======================================
    // ACTUALIZAR TARJETAS DEL HTML
    // ======================================

    const elementoSensor =
        document.querySelector('.card-value-large');

    const estadoSistema =
        document.querySelector('.alert-text');

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
    // REGISTRO DEL HISTORIAL
    // ======================================

    const horaActual = new Date().toLocaleTimeString();

    if (historialTiempos.length >= 20) {

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

    actualizarGraficas();
    actualizarEstadosGraficas(datos);
}

// ==========================================
// VERIFICACIÓN DE TEMPERATURA
// ==========================================

function verificarTemperatura(tempActual, ahora) {

    if (!Number.isFinite(tempActual)) return;

    // Temperatura inferior a 21 °C
    if (tempActual < TEMPERATURA_MINIMA) {

        if (!alertasActivas.temperaturaBaja) {

            enviarAlertaTelegram(
                `🥶 ALERTA BIOCÁPSULA\n` +
                `Temperatura demasiado baja.\n` +
                `Temperatura actual: ${tempActual} °C\n` +
                `Mínimo permitido: ${TEMPERATURA_MINIMA} °C`
            );

            alertasActivas.temperaturaBaja = true;
        }

    } else {
        alertasActivas.temperaturaBaja = false;
    }

    // Temperatura superior a 27 °C
    if (tempActual > TEMPERATURA_MAXIMA) {

        if (!alertasActivas.temperaturaAlta) {

            enviarAlertaTelegram(
                `🔥 ALERTA BIOCÁPSULA\n` +
                `Temperatura demasiado alta.\n` +
                `Temperatura actual: ${tempActual} °C\n` +
                `Máximo permitido: ${TEMPERATURA_MAXIMA} °C`
            );

            alertasActivas.temperaturaAlta = true;
        }

    } else {
        alertasActivas.temperaturaAlta = false;
    }

    // ======================================
    // CAMBIO REPENTINO DE TEMPERATURA
    // ======================================

    if (ultimaTemperatura !== null && ultimaHoraTemperatura !== null) {

        const diferenciaTemp = tempActual - ultimaTemperatura;

        const minutosTranscurridos =
            (ahora - ultimaHoraTemperatura) / 60000;

        if (diferenciaTemp >= 3.0 && minutosTranscurridos <= 2) {

            if (!alertasActivas.cambioRepentino) {

                enviarAlertaTelegram(
                    `🚨 ALERTA BIOCÁPSULA\n` +
                    `Incremento repentino de temperatura.\n` +
                    `Aumento: +${diferenciaTemp.toFixed(1)} °C\n` +
                    `Temperatura actual: ${tempActual} °C`
                );

                alertasActivas.cambioRepentino = true;
            }

        } else {
            alertasActivas.cambioRepentino = false;
        }
    }

    ultimaTemperatura = tempActual;
    ultimaHoraTemperatura = ahora;
}

// ==========================================
// VERIFICACIÓN DE HUMEDAD AMBIENTAL
// ==========================================

function verificarHumedad(humedadActual) {

    if (!Number.isFinite(humedadActual)) return;

    // Humedad inferior a 95 %
    if (humedadActual < HUMEDAD_DESEADA) {

        if (!alertasActivas.humedadBaja) {

            enviarAlertaTelegram(
                `💧 ALERTA BIOCÁPSULA\n` +
                `Humedad ambiental inferior a la deseada.\n` +
                `Humedad actual: ${humedadActual} %\n` +
                `Humedad deseada: ${HUMEDAD_DESEADA} %`
            );

            alertasActivas.humedadBaja = true;
        }

    } else {
        alertasActivas.humedadBaja = false;
    }

    // Humedad superior a 95 %
    if (humedadActual > HUMEDAD_DESEADA) {

        if (!alertasActivas.humedadAlta) {

            enviarAlertaTelegram(
                `💦 ALERTA BIOCÁPSULA\n` +
                `Humedad ambiental superior a la deseada.\n` +
                `Humedad actual: ${humedadActual} %\n` +
                `Humedad deseada: ${HUMEDAD_DESEADA} %`
            );

            alertasActivas.humedadAlta = true;
        }

    } else {
        alertasActivas.humedadAlta = false;
    }
}

// ==========================================
// DETECCIÓN DE PÉRDIDA DE CONEXIÓN
// ==========================================

function verificarDesconexion() {

    if (MODO_SIMULACION) return;

    const tiempoSinDatosSegundos =
        (Date.now() - ultimoTiempoLectura) / 1000;

    if (tiempoSinDatosSegundos > 60 && !alertaDesconexionEnviada) {

        enviarAlertaTelegram(
            `⚠️ ALERTA BIOCÁPSULA\n` +
            `Se ha perdido la conexión con el ESP32.\n` +
            `No se han recibido datos en más de 1 minuto.`
        );

        alertaDesconexionEnviada = true;
    }
}

// ==========================================
// CREAR GRÁFICA
// ==========================================

// Crear una gráfica individual
function crearGraficaIndividual(id, nombre, color, datos, unidad, opciones = {}) {

    const contexto = document.getElementById(id).getContext('2d');

    const conjuntos = [{
        label: nombre,
        data: datos,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        tension: 0.3,
        fill: false
    }];

    // Agregar líneas de referencia cuando existan
    if (opciones.minimo !== undefined) {
        conjuntos.push({
            label: 'Mínimo',
            data: Array(historialTiempos.length).fill(opciones.minimo),
            borderColor: 'red',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0
        });
    }

    if (opciones.setpoint !== undefined) {
        conjuntos.push({
            label: 'Setpoint',
            data: Array(historialTiempos.length).fill(opciones.setpoint),
            borderColor: 'green',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0
        });
    }

    if (opciones.maximo !== undefined) {
        conjuntos.push({
            label: 'Máximo',
            data: Array(historialTiempos.length).fill(opciones.maximo),
            borderColor: 'red',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0
        });
    }

    return new Chart(contexto, {
        type: 'line',
        data: {
            labels: historialTiempos,
            datasets: conjuntos
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#ffffff'
                    }
                },
                y: {
                    beginAtZero: opciones.minCero || false,
                    min: opciones.min,
                    max: opciones.max,
                    title: {
                        display: true,
                        text: unidad,
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                }
            }
        }
    });
}


// Crear las seis gráficas
function crearGraficas() {

    if (graficas.temperatura) return;

    graficas.temperatura = crearGraficaIndividual(
        'graficaTemperatura',
        'Temperatura',
        '#38bdf8',
        datosTemperatura,
        'Temperatura (°C)',
        {
            minimo: TEMPERATURA_MINIMA,
            setpoint: TEMPERATURA_SETPOINT,
            maximo: TEMPERATURA_MAXIMA
        }
    );

    graficas.humedad = crearGraficaIndividual(
        'graficaHumedad',
        'Humedad',
        '#38bdf8',
        datosHumedad,
        'Humedad (%)',
        {
            minimo: HUMEDAD_MINIMA_GRAFICA,
            setpoint: HUMEDAD_SETPOINT_GRAFICA,
            maximo: HUMEDAD_MAXIMA_GRAFICA
        }
    );

    graficas.co2 = crearGraficaIndividual(
        'graficaCO2',
        'CO₂',
        '#38bdf8',
        datosCO2,
        'CO₂ (ppm)',
        {
            min: 0,
            max: CO2_MAXIMO_SENSOR
        }
    );

    graficas.sustrato = crearGraficaIndividual(
        'graficaSustrato',
        'Humedad del sustrato',
        '#38bdf8',
        datosHumedadSustrato,
        'Humedad (%)',
        {
            min: 0,
            max: 100
        }
    );

    graficas.presion = crearGraficaIndividual(
        'graficaPresion',
        'Presión',
        '#38bdf8',
        datosPresion,
        'Presión'
    );

    graficas.nivelAgua = crearGraficaIndividual(
        'graficaNivelAgua',
        'Nivel de agua',
        '#38bdf8',
        datosNivelAgua,
        'Nivel (%)',
        {
            min: 0,
            max: 100
        }
    );
}


// Actualizar las gráficas con los nuevos datos
function actualizarGraficas() {

    Object.values(graficas).forEach(grafica => {

        if (grafica) {
            grafica.data.labels = historialTiempos;

            grafica.data.datasets[0].data =
                grafica === graficas.temperatura ? datosTemperatura :
                grafica === graficas.humedad ? datosHumedad :
                grafica === graficas.co2 ? datosCO2 :
                grafica === graficas.sustrato ? datosHumedadSustrato :
                grafica === graficas.presion ? datosPresion :
                datosNivelAgua;

            // Mantener actualizadas las líneas de referencia
            if (grafica === graficas.temperatura) {
                grafica.data.datasets[1].data =
                    Array(historialTiempos.length).fill(TEMPERATURA_MINIMA);

                grafica.data.datasets[2].data =
                    Array(historialTiempos.length).fill(TEMPERATURA_SETPOINT);

                grafica.data.datasets[3].data =
                    Array(historialTiempos.length).fill(TEMPERATURA_MAXIMA);
            }

            if (grafica === graficas.humedad) {
                grafica.data.datasets[1].data =
                    Array(historialTiempos.length).fill(HUMEDAD_MINIMA_GRAFICA);

                grafica.data.datasets[2].data =
                    Array(historialTiempos.length).fill(HUMEDAD_SETPOINT_GRAFICA);

                grafica.data.datasets[3].data =
                    Array(historialTiempos.length).fill(HUMEDAD_MAXIMA_GRAFICA);
            }

            grafica.update();
        }
    });
}


// Actualizar los indicadores de estado
function actualizarEstadosGraficas(datos) {

    const temperatura = Number(datos.temperatura);
    const humedad = Number(datos.humedad);
    const co2 = Number(datos.co2);

    const estadoTemperatura = document.getElementById('estadoTemperatura');
    const estadoHumedad = document.getElementById('estadoHumedad');
    const estadoCO2 = document.getElementById('estadoCO2');

    if (estadoTemperatura) {

        if (temperatura < TEMPERATURA_MINIMA) {
            estadoTemperatura.textContent = 'Temperatura baja';
            estadoTemperatura.className = 'grafica-estado estado-bajo';
        }
        else if (temperatura > TEMPERATURA_MAXIMA) {
            estadoTemperatura.textContent = 'Temperatura alta';
            estadoTemperatura.className = 'grafica-estado estado-alto';
        }
        else {
            estadoTemperatura.textContent = 'Temperatura normal';
            estadoTemperatura.className = 'grafica-estado estado-normal';
        }
    }

    if (estadoHumedad) {

        if (humedad < HUMEDAD_MINIMA_GRAFICA) {
            estadoHumedad.textContent = 'Humedad baja';
            estadoHumedad.className = 'grafica-estado estado-bajo';
        }
        else if (humedad > HUMEDAD_MAXIMA_GRAFICA) {
            estadoHumedad.textContent = 'Humedad alta';
            estadoHumedad.className = 'grafica-estado estado-alto';
        }
        else {
            estadoHumedad.textContent = 'Humedad normal';
            estadoHumedad.className = 'grafica-estado estado-normal';
        }
    }

    if (estadoCO2) {

        if (co2 < 0 || co2 > CO2_MAXIMO_SENSOR) {
            estadoCO2.textContent = 'Fuera del rango del sensor';
            estadoCO2.className = 'grafica-estado estado-alto';
        }
        else {
            estadoCO2.textContent = 'Monitoreando CO₂';
            estadoCO2.className = 'grafica-estado estado-normal';
        }
    }
}

// ==========================================
// NAVEGACIÓN ENTRE SECCIONES
// ==========================================

function mostrarSeccion(event, seccion) {

    if (event) {
        event.preventDefault();
    }

    const inicio = document.getElementById('seccion-inicio');
    const seccionGraficas = document.getElementById('seccion-graficas');

    const btnInicio = document.getElementById('btn-inicio');
    const btnGraficas = document.getElementById('btn-graficas');

    if (seccion === 'inicio') {

        inicio.style.display = 'block';
        seccionGraficas.style.display = 'none';

        btnInicio.classList.add('active');
        btnGraficas.classList.remove('active');

    }

    else if (seccion === 'graficas') {

        inicio.style.display = 'none';
        seccionGraficas.style.display = 'block';

        btnGraficas.classList.add('active');
        btnInicio.classList.remove('active');

        crearGraficas();

        setTimeout(() => {

            Object.values(graficas).forEach(grafica => {

                if (grafica) {
                    grafica.resize();
                    grafica.update();
                }

            });

        }, 100);

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
