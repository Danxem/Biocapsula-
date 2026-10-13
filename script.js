// Función que consulta al ESP32 cada 3 segundos
async function obtenerDatosESP32() {
    try {
        // ⚠️ AQUÍ CAMBIAS LA IP:
        // Borra 'http://192.168.1.X/datos' y pon la IP real que te dio el Monitor Serie de Arduino.
        // Ejemplo: 'http://192.168.1.50/datos'
        let respuesta = await fetch('http://192.168.1.X/datos');
        let datos = await respuesta.json();

        // Buscamos el elemento en el HTML donde se muestra la temperatura y humedad
        const elementoSensor = document.querySelector('.card-value-large');
        const estadoSistema = document.querySelector('.alert-text');

        if (elementoSensor) {
            // Actualizamos la pantalla con los datos reales del DHT22
            elementoSensor.innerHTML = `${datos.temperatura} <span class="unit">°C</span> / ${datos.humedad}% <span class="unit">Humedad</span>`;
        }

        if (estadoSistema) {
            estadoSistema.innerHTML = "✅ ESP32 en línea | Transmitiendo datos en tiempo real";
            estadoSistema.style.color = "#22c55e"; // Cambia el texto a verde de éxito
        }

    } catch (error) {
        console.error("No se pudo conectar al ESP32:", error);
        const estadoSistema = document.querySelector('.alert-text');
        if (estadoSistema) {
            estadoSistema.innerHTML = "⚠️ ESP32 fuera de línea | Verificando conexión...";
            estadoSistema.style.color = "#f59e0b"; // Alerta en amarillo/naranja
        }
    }
}

// Ejecutar la función cada 3 segundos de manera continua
setInterval(obtenerDatosESP32, 3000);