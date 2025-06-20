// // --- script.js ---
// // Toda la lógica JS extraída de index.html

// // --- RECARGA AUTOMÁTICA AL CAMBIAR DE MODO (PC/MÓVIL) ---
// (function(){
//   let ultimoEsMovil = (function() {
//     // Detección por user agent o por tamaño de pantalla (menos de 900px de ancho)
//     const userAgentMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
//     const pantallaPequena = window.innerWidth < 900;
//     return userAgentMovil || pantallaPequena;
//   })();
//   window.addEventListener('resize', function() {
//     const actualEsMovil = (function() {
//       const userAgentMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
//       const pantallaPequena = window.innerWidth < 900;
//       return userAgentMovil || pantallaPequena;
//     })();
//     if (actualEsMovil !== ultimoEsMovil) {
//       // Si pasamos de móvil a PC, eliminar usuarioActual para forzar modo empresa
//       if (!actualEsMovil && ultimoEsMovil) {
//         localStorage.removeItem('usuarioActual');
//       }
//       location.reload();
//     }
//     ultimoEsMovil = actualEsMovil;
//   });
// })();

(function(){
  let ultimoEsMovil = (function() {
    const userAgentMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const pantallaPequena = window.innerWidth < 900;
    return userAgentMovil || pantallaPequena;
  })();
  console.log('Inicialmente es móvil:', ultimoEsMovil);
  
  window.addEventListener('resize', function() {
    const actualEsMovil = (function() {
      const userAgentMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const pantallaPequena = window.innerWidth < 900;
      return userAgentMovil || pantallaPequena;
    })();
    console.log('Actual es móvil:', actualEsMovil);
    
    if (actualEsMovil !== ultimoEsMovil) {
      console.log('Cambio de modo detectado');
      if (!actualEsMovil && ultimoEsMovil) {
        localStorage.removeItem('usuarioActual');
        console.log('usuarioActual eliminado');
      }
      location.reload();
    }
    ultimoEsMovil = actualEsMovil;
  });
})();

// --- FIN RECARGA AUTOMÁTICA ---

// --- INICIO LEAFLET ---
let map;
let marcadores = [];
let leafletRutas = [];
let featuresLayerEmpresa; // Capa dedicada para las rutas y marcadores del mapa de empresa

function initMap() {
  // Inicializar el mapa con Leaflet
  map = L.map('map').setView([-34.397, 150.644], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  // Inicializar capa de empresa si no existe
  if (!featuresLayerEmpresa) {
    featuresLayerEmpresa = L.layerGroup().addTo(map);
  }
}

function limpiarMarcadores() {
if (map) { // Solo si el mapa está inicializado
    marcadores.forEach(m => map.removeLayer(m));
    marcadores = [];
    leafletRutas.forEach(r => map.removeLayer(r));
    leafletRutas = [];
  }
}

function mostrarMarcadoresRepartidor(repartidor, colorIdx) {
  limpiarMarcadores();
  if (!repartidor || !repartidor.lugares || !repartidor.lugares.length) return;
  // Corregido: definir colorPorUsuario para el contexto del repartidor
  let colorPorUsuario = {};
  colorPorUsuario[repartidor.usuario] = 'blue';
  repartidor.lugares.forEach(lugar => {
    geocodeDireccionLeaflet(lugar.direccion, (latlng) => {
      if (latlng) {
        // Usar icono de color personalizado para el marcador
        const iconoColor = L.icon({
          iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${colorPorUsuario[repartidor.usuario] || 'blue'}.png`,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          shadowSize: [41, 41]
        });
        const marker = L.marker(latlng, {
          title: `${lugar.direccion} - ${lugar.hora}`,
          icon: iconoColor
        }).addTo(map);
        marker.bindPopup(`<b>${lugar.direccion}</b><br>Hora: ${lugar.hora}${lugar.incidencia ? '<br><span style=\'color:#e53935;\'>Incidencia: ' + lugar.incidencia + '</span>' : ''}`);
        marcadores.push(marker);
        map.setView(latlng, 13);
      }
    });
  });
}

function geocodeDireccionLeaflet(direccion, callback) {
  // Usar Nominatim para geocodificar
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        callback({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        callback(null);
      }
    })
    .catch(() => callback(null));
}

window.mostrarRuta = function(idx, lugarIdx) {
  console.log("Mostrando ruta para:", idx, lugarIdx);
  const repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  const repartidor = repartidores[idx];
  const lugar = repartidor.lugares[lugarIdx];

  // Validar si la ruta ya está marcada como realizada o tiene incidencia
  if (lugar.realizada || lugar.incidencia) {
    alert('Esta ruta ya está marcada como realizada o tiene una incidencia y no puede ser gestionada.');
    // Eliminar botones de interacción
    const botones = document.querySelectorAll(`[data-ruta-id="${idx}-${lugarIdx}"]`);
    botones.forEach(boton => boton.style.display = 'none');
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      const origen = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      calcularRutaLeaflet(origen, lugar.direccion);
    }, function() {
      calcularRutaLeaflet({ lat: -34.6037, lng: -58.3816 }, lugar.direccion);
    });
  } else {
    calcularRutaLeaflet({ lat: -34.6037, lng: -58.3816 }, lugar.direccion);
  }
};


function calcularRutaLeaflet(origen, destinoDireccion) {
  // Geocodificar destino
  geocodeDireccionLeaflet(destinoDireccion, (destino) => {
    if (!destino) {
      document.getElementById('info-ruta').innerHTML = '';
      alert('No se pudo geolocalizar el destino');
      return;
    }
    // Llamar a OSRM para ruta
    const url = `https://router.project-osrm.org/route/v1/driving/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          // Dibujar ruta
          limpiarMarcadores();
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const polyline = L.polyline(coords, { color: 'blue', weight: 5 }).addTo(map);
          leafletRutas.push(polyline);
          // Añadir marcadores de inicio y fin
          const markerA = L.marker([origen.lat, origen.lng], { title: 'Origen' }).addTo(map);
          const markerB = L.marker([destino.lat, destino.lng], { title: 'Destino' }).addTo(map);
          marcadores.push(markerA, markerB);
          map.fitBounds(polyline.getBounds());
          // Mostrar distancia y tiempo
          const distancia = (route.distance / 1000).toFixed(2) + ' km';
          const duracion = Math.round(route.duration / 60) + ' min';
          document.getElementById('info-ruta').innerHTML = `<strong>Distancia:</strong> ${distancia} <br> <strong>Tiempo estimado:</strong> ${duracion}`;
        } else {
          document.getElementById('info-ruta').innerHTML = '';
          alert('No se pudo calcular la ruta');
        }
      })
      .catch(() => {
        document.getElementById('info-ruta').innerHTML = '';
        alert('No se pudo calcular la ruta');
      });
  });
}
// --- FIN LEAFLET ---

// --- AUTENTICACIÓN SIMPLE (activada) ---
let usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
if (!usuarios.length) {
  usuarios = [
    // Ejemplo: puedes editar o cargar desde Excel
    { usuario: 'repartidor1', password: '1234', nombre: 'Juan', zona: 'Norte' },
    { usuario: 'repartidor2', password: 'abcd', nombre: 'Ana', zona: 'Sur' },
    { usuario: 'empresa', password: 'admin', nombre: 'Empresa', zona: 'Todas' }
  ];
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
}

// --- DETECCIÓN DE DISPOSITIVO ---
function esMovil() {
  // Detección por user agent o por tamaño de pantalla (menos de 900px de ancho)
  const userAgentMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const pantallaPequena = window.innerWidth < 900;
  return userAgentMovil || pantallaPequena;
}
// --- FIN DETECCIÓN ---

// --- FUNCIÓN mostrarLogin: muestra el formulario de login de repartidor y oculta el de empresa ---
function mostrarLogin() {
  // Mostrar el formulario de login de repartidor y ocultar el de empresa
  const loginRepartidor = document.getElementById('login-repartidor');
  const loginEmpresa = document.getElementById('repartidor-form');
  if (loginRepartidor) loginRepartidor.style.display = 'flex'; // Modal centrado
  if (loginEmpresa) loginEmpresa.style.display = 'none';
  // Ocultar paneles solo-empresa
  document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'none');
  // Ocultar el mapa hasta que el repartidor haga login
  const mapa = document.getElementById('map');
  if (mapa) mapa.style.display = 'none';
  // Ocultar header y título admin-panel en login repartidor
  const header = document.getElementById('header-principal');
  if (header) header.style.display = 'none';
  const tituloAdmin = document.getElementById('titulo-admin-panel');
  if (tituloAdmin) tituloAdmin.style.display = 'none';
  // Ocultar el footer en login repartidor
  const footer = document.querySelector('footer');
  if (footer) footer.style.display = 'none';
  // Ocultar lista de repartidores y archivos subidos (y su contenedor)
  const lista = document.getElementById('lista-repartidores');
  if (lista) lista.innerHTML = '';
  const archivos = document.getElementById('archivos-subidos');
  if (archivos) archivos.style.display = 'none';
  // Ocultar área de subida de archivos
  const areaArchivos = document.getElementById('area-subida-archivos');
  if (areaArchivos) areaArchivos.style.display = 'none';
  // Ocultar panel de administración de usuarios
  const adminUsuarios = document.getElementById('admin-usuarios');
  if (adminUsuarios) adminUsuarios.style.display = 'none';
  // Mostrar el botón de contacto SIEMPRE en modo repartidor (login y tras login)
  const btnContacto = document.getElementById('btn-contacto');
  if (btnContacto) btnContacto.style.display = esMovil() ? 'block' : 'block';
  // Forzar scroll al top
  window.scrollTo({ top: 0, behavior: 'auto' });
  // Añadir clase al body para login repartidor (para aislamiento visual y CSS)
  document.body.classList.add('login-repartidor-activo');
  // Mostrar el indicador de modo aunque estemos en login
  if (typeof window.mostrarIndicadorModo === 'function') {
    window.mostrarIndicadorModo();
  }
}
// --- FIN mostrarLogin ---

// --- MOSTRAR MAPA TRAS LOGIN REPARTIDOR ---
function mostrarMapaTrasLoginRepartidor() {
  // Limpiar la vista de empresa antes de mostrar elementos de repartidor
  document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'none');
  const formAdmin = document.getElementById('repartidor-form');
  if (formAdmin) formAdmin.style.display = 'none';
  const adminUsuarios = document.getElementById('admin-usuarios');
  if (adminUsuarios) adminUsuarios.style.display = 'none';
  const areaArchivos = document.getElementById('area-subida-archivos');
  if (areaArchivos) areaArchivos.style.display = 'none';
  // Mostrar mapa
  const mapa = document.getElementById('map');
  if (mapa) mapa.style.display = 'block';
  // Mostrar header solo si es empresa
  const header = document.getElementById('header-principal');
  if (header) header.style.display = (usuarioActual && usuarioActual.usuario === 'empresa') ? 'block' : 'none';
  // Mostrar título admin solo si es empresa
  const tituloAdmin = document.getElementById('titulo-admin-panel');
  if (tituloAdmin) tituloAdmin.style.display = (usuarioActual && usuarioActual.usuario === 'empresa') ? 'block' : 'none';
  // Mostrar el footer solo si es empresa
  const footer = document.querySelector('footer');
  if (footer) footer.style.display = (usuarioActual && usuarioActual.usuario === 'empresa') ? 'block' : 'none';
  // Ocultar el modal de login
  const loginRepartidor = document.getElementById('login-repartidor');
  if (loginRepartidor) loginRepartidor.style.display = 'none';
  // Mostrar área de archivos subidos solo si es repartidor
  if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    const archivos = document.getElementById('archivos-subidos');
    if (archivos) archivos.style.display = 'block';
    // Mostrar el botón de contacto SIEMPRE en modo repartidor
    const btnContacto = document.getElementById('btn-contacto');
    if (btnContacto) btnContacto.style.display = 'block';
    // Mostrar el título de rutas de reparto si existe
    const tituloRutas = document.getElementById('titulo-rutas-reparto');
    if (tituloRutas) tituloRutas.style.display = 'block';
    // NUEVO: Mostrar rutas del repartidor en el mapa
    let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
    let miRepartidor = repartidores.find(r => r.usuario === usuarioActual.usuario);
    if (miRepartidor) mostrarMarcadoresRepartidor(miRepartidor, 0);
  }
  // Corregir error: solo llamar si existe la función
  if (typeof window.mostrarAreaSubidaArchivos === 'function') {
    window.mostrarAreaSubidaArchivos();
  }
  iniciarActualizacionAutomatica();
  // Forzar scroll al top
  window.scrollTo({ top: 0, behavior: 'auto' });
  // Quitar clase de aislamiento visual del login
  document.body.classList.remove('login-repartidor-activo');
}
// --- FIN ---

// --- OCULTAR PANEL DE ADMINISTRACIÓN Y TÍTULO PARA REPARTIDOR ---
function ajustarPanelesPorUsuario() {
  if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    // Ocultar formulario y título de administración
    const formAdmin = document.getElementById('repartidor-form');
    if (formAdmin) formAdmin.style.display = 'none';
    const tituloAdmin = document.getElementById('titulo-admin-panel');
    if (tituloAdmin) tituloAdmin.style.display = 'none';
  } else {
    // Mostrar para empresa
    const formAdmin = document.getElementById('repartidor-form');
    if (formAdmin) formAdmin.style.display = 'block';
    const tituloAdmin = document.getElementById('titulo-admin-panel');
    if (tituloAdmin) tituloAdmin.style.display = 'block';
  }
  // Asegurar que el panel de administración de usuarios solo se muestre para empresa
  const adminUsuarios = document.getElementById('admin-usuarios');
  if (adminUsuarios) {
    if (usuarioActual && usuarioActual.usuario === 'empresa') {
      adminUsuarios.style.display = 'block';
    } else {
      adminUsuarios.style.display = 'none';
    }
  }
}
// Llamar tras login y tras recarga

// --- INDICADOR DE MODO DETECTADO (asegurar que siempre se muestre) ---
(function(){
  function mostrarIndicadorModo() {
    let div = document.getElementById('indicador-modo-dispositivo');
    if (!div) {
      div = document.createElement('div');
      div.id = 'indicador-modo-dispositivo';
      div.style = 'position:fixed;top:0;left:0;width:100vw;z-index:99999;padding:7px 0;text-align:center;font-size:1.1em;font-weight:bold;pointer-events:none;opacity:0.85;';
      document.body.appendChild(div);
    }
    const userAgentMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const pantallaPequena = window.innerWidth < 900;
    let modo = (userAgentMovil || pantallaPequena) ? 'MÓVIL/REPARTIDOR' : 'EMPRESA (PC)';
    let detalle = `UserAgent: ${userAgentMovil ? 'Móvil' : 'PC'} | Ancho: ${window.innerWidth}px`;
    div.innerHTML = `<span style='color:${modo.includes('MÓVIL') ? '#388e3c' : '#1976d2'};'>Modo detectado: ${modo}</span> <span style='color:#888;font-size:0.95em;margin-left:12px;'>${detalle}</span>`;
    div.style.background = modo.includes('MÓVIL') ? '#e8f5e9' : '#e3f0ff';
  }
  window.addEventListener('resize', mostrarIndicadorModo);
  document.addEventListener('DOMContentLoaded', mostrarIndicadorModo);
  // Llamar inmediatamente para asegurar que se muestre aunque el DOM no esté listo
  setTimeout(mostrarIndicadorModo, 0);
})();
// --- FIN INDICADOR DE MODO ---

// --- AUTODETECCIÓN Y ASIGNACIÓN DE USUARIO SEGUN MODO (SOLO EMPRESA) ---
let usuarioActual = null;
if (!esMovil()) {
  // En PC, siempre forzar modo empresa
  usuarioActual = { usuario: 'empresa', nombre: 'Empresa', zona: 'Todas' };
  if (localStorage.getItem('usuarioActual')) {
    localStorage.removeItem('usuarioActual');
  }
  sessionStorage.removeItem('recargadoMovil');
  // Ocultar el mapa y el botón de contacto en modo empresa
  const loginRepartidor = document.getElementById('login-repartidor');
  const loginEmpresa = document.getElementById('repartidor-form');
  if (loginRepartidor) loginRepartidor.style.display = 'none';
  if (loginEmpresa) loginEmpresa.style.display = 'block';
  document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'block');
  // Ocultar el mapa
  const mapa = document.getElementById('map');
  if (mapa) mapa.style.display = 'block'; // <-- ASEGURAR QUE EL MAPA SEA VISIBLE EN MODO EMPRESA
  // Ocultar el botón de contacto
  const btnContacto = document.getElementById('btn-contacto');
  if (btnContacto) btnContacto.style.display = 'none';
  // Mostrar el indicador de modo siempre
  if (typeof window.mostrarIndicadorModo === 'function') window.mostrarIndicadorModo();
}

// Mostrar/ocultar formulario de administración según usuario
if (usuarioActual && usuarioActual.usuario !== 'empresa') {
  document.getElementById('repartidor-form').style.display = 'none';
} else {
  document.getElementById('repartidor-form').style.display = 'block';
}
document.getElementById('repartidor-form').addEventListener('submit', function(e) {
  e.preventDefault();
  // Leer usuario, nombre, zona e información adicional del formulario
  let usuario = document.getElementById('usuario').value;
  let nombre = document.getElementById('nombre').value;
  let apellidos = document.getElementById('apellido').value; // NUEVO
  let zona = document.getElementById('zona').value;
  let infoAdicional = document.getElementById('info-adicional').value; // <-- NUEVO
  let fechaRuta = document.getElementById('fecha-ruta').value; // NUEVO: Campo de fecha
  const direcciones = Array.from(document.getElementsByName('direccion[]')).map(input => input.value);
  const horas = Array.from(document.getElementsByName('hora[]')).map(input => input.value);
  const incidencias = Array.from(document.getElementsByName('incidencia[]')).map(input => input.value);
  const lugares = direcciones.map((direccion, i) => ({ direccion, hora: horas[i], incidencia: incidencias[i] }));
  if (!usuario || !nombre || !apellidos || !zona || !fechaRuta || lugares.length === 0 || lugares.some(l => !l.direccion || !l.hora)) { // NUEVO: Validar apellidos
    mostrarFeedback('Por favor, completa todos los campos antes de guardar.');
    return;
  }
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  // Buscar si ya existe un repartidor con ese usuario, nombre, apellidos y zona
  const idx = repartidores.findIndex(r => r.usuario === usuario && r.nombre === nombre && r.apellidos === apellidos && r.zona === zona);
  if (idx !== -1) {
    repartidores[idx].lugares = lugares;
    repartidores[idx].usuario = usuario;
    repartidores[idx].nombre = nombre;
    repartidores[idx].apellidos = apellidos; // NUEVO
    repartidores[idx].zona = zona;
    repartidores[idx].infoAdicional = infoAdicional; // <-- NUEVO
    repartidores[idx].fechaRuta = fechaRuta; // NUEVO
    repartidores[idx].archivosEspecificos = repartidores[idx].archivosEspecificos || []; // Asegurar que exista
    mostrarFeedback('Datos del repartidor actualizados correctamente.');
  } else {
    repartidores.push({ usuario, nombre, apellidos, zona, lugares, infoAdicional, fechaRuta, archivosEspecificos: [] }); // <-- NUEVO
    mostrarFeedback('Repartidor añadido correctamente.');
  }
  localStorage.setItem('repartidores', JSON.stringify(repartidores));
  mostrarRepartidores();
  // Mostrar marcadores del repartidor actualizado o añadido
  if (!usuarioActual) {
    if (idx !== -1) {
      mostrarMarcadoresRepartidor(repartidores[idx], idx);
    } else {
      mostrarMarcadoresRepartidor(repartidores[repartidores.length - 1], repartidores.length - 1);
    }
  }
  this.reset();
  // Dejar solo un lugar vacío
  document.getElementById('lugares-container').innerHTML = `<h4>Lugares de entrega</h4>
    <div class="lugar-entrega">
      <label>Dirección:</label>
      <input type="text" name="direccion[]" required>
      <label>Incidencia:</label>
      <input type="text" name="incidencia[]" placeholder="Describe incidencia si existe">
      <label>Hora:</label>
      <input type="time" name="hora[]" required>
    </div>`;
  document.getElementById('fecha-ruta').value = ''; // Limpiar campo de fecha
  document.getElementById('repartidor-form').style.display = 'block';
});


function mostrarRepartidores() {
  const lista = document.getElementById('lista-repartidores');
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');

  if (!usuarioActual || usuarioActual.usuario === 'empresa') {
    lista.innerHTML = '';
    return;
  }

  const misRepartos = repartidores
    .map((r, idx) => ({ ...r, _idx: idx }))
    .filter(r => r.usuario === usuarioActual.usuario);

  if (misRepartos.length === 0) {
    lista.innerHTML = '<p>No tienes rutas asignadas.</p>';
    return;
  }

  lista.innerHTML = misRepartos.map((r, idx) => {
    const entregas = r.lugares.map((l, i) => {
      let estado = 'pendiente';
      if (l.incidencia && l.incidencia.trim() !== '') {
        estado = 'incidencia';
      } else if (l.realizada) {
        estado = 'realizada';
      }
      const mostrarBotonGoogleMaps = !(l.realizada || l.incidencia);
      const botones = l.realizada || l.incidencia
        ? ''
        : `<button style='padding:2px 10px;border-radius:4px;background:#2196f3;color:#fff;border:none;font-size:0.97em;' onclick='mostrarRuta(${r._idx},${i});return false;'>Ver ruta en la web</button>
           <button style='padding:2px 10px;border-radius:4px;background:#43a047;color:#fff;border:none;font-size:0.97em;' onclick='eliminarEntrega(${r._idx},${i});return false;'>Marcar como realizada</button>
           <button style='padding:2px 10px;border-radius:4px;background:#e53935;color:#fff;border:none;font-size:0.97em;' onclick='marcarIncidenciaRepartidor(${r._idx},${i}, this)'>${l.incidencia ? 'Incidencia marcada' : 'Marcar incidencia'}</button>`;

      const imagenes = l.archivos ? l.archivos.map((archivo, archivoIdx) =>
        `<span style='display:inline-flex;align-items:center;gap:4px;margin:2px 0;'>
          <a href="${archivo.datosArchivo}" download="${archivo.nombreArchivo}" style="color:#0056b3;">${archivo.nombreArchivo}</a>
          <button onclick="window.visualizarArchivoEntrega(${r._idx},${i},${archivoIdx})" style="background:#1976d2;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Ver</button>
          <button onclick="window.eliminarArchivoModal(${r._idx},${i},${archivoIdx})" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Eliminar</button>
        </span>`
      ).join('') : '';

      const botonCamara = `<button style='padding:2px 10px;border-radius:4px;background:#ff9800;color:#fff;border:none;font-size:0.97em;' onclick='accederCamara(${r._idx},${i});return false;'>Abrir cámara</button>`;

      const botonGoogleMaps = mostrarBotonGoogleMaps ? `<button style='padding:2px 10px;border-radius:4px;background:#1976d2;color:#fff;border:none;border-radius:4px;font-size:0.97em;' onclick='abrirNavegacionGoogleMaps("${l.direccion.replace(/'/g, "\\'")}")'>Ver en Google Maps</button>` : '';

      return `<li class='tarjeta-entrega tarjeta-${estado}' style='list-style:none;display:flex;flex-direction:column;gap:6px;'>
                <strong>${l.direccion}</strong> (${l.hora})
                <p>Incidencia: ${l.incidencia || 'Ninguna'}</p>
                ${botones}
                ${botonGoogleMaps}
                ${imagenes}
                ${botonCamara}
              </li>`;
    }).join('');

    return `<div style='margin-bottom:20px;'>
              <h3>${r.nombre} (${r.zona})</h3>
              <p>Fecha de ruta: ${r.fechaRuta}</p>
              <p>Información adicional: ${r.infoAdicional || 'Ninguna'}</p>
              <ul style='padding:0;'>${entregas}</ul>
            </div>`;
  }).join('');
}

function accederCamara(repartidorIdx, lugarIdx) {
  alert('Accediendo a la cámara del móvil...');
  // Aquí puedes implementar lógica adicional para abrir la cámara
}

// NUEVO: Adjuntar event listeners a los inputs de archivo por ruta
function adjuntarEventListenersArchivosRuta() {
    document.querySelectorAll('.input-archivo-ruta').forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const repartidorIdx = parseInt(e.target.dataset.repartidorIdx, 10);
            if (!file || isNaN(repartidorIdx)) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
                if (repartidores[repartidorIdx]) {
                    if (!repartidores[repartidorIdx].archivosEspecificos) {
                        repartidores[repartidorIdx].archivosEspecificos = [];
                    }
                    repartidores[repartidorIdx].archivosEspecificos.push({
                        nombreArchivo: file.name,
                        tipoArchivo: file.type || file.name.split('.').pop(),
                        datosArchivo: event.target.result
                    });
                    localStorage.setItem('repartidores', JSON.stringify(repartidores));
                    mostrarRepartidores(); // Re-renderizar para mostrar el archivo subido
                    mostrarFeedback('Archivo asociado a la ruta correctamente.');
                }
            };
            reader.readAsDataURL(file);
            e.target.value = ''; // Limpiar el input para permitir subir el mismo archivo de nuevo
        });
    });
}

// NUEVO: Eliminar archivo específico de una ruta
window.eliminarArchivoEspecifico = function(repartidorIdx, archivoIdx) {
    if (!confirm('¿Seguro que quieres eliminar este archivo de la ruta?')) return;
    let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
    if (repartidores[repartidorIdx] && repartidores[repartidorIdx].archivosEspecificos && repartidores[repartidorIdx].archivosEspecificos[archivoIdx]) {
        repartidores[repartidorIdx].archivosEspecificos.splice(archivoIdx, 1);
        localStorage.setItem('repartidores', JSON.stringify(repartidores));
        mostrarRepartidores(); // Re-renderizar
        mostrarFeedback('Archivo eliminado de la ruta.');
    }
};

// --- FUNCIÓN PARA ELIMINAR ARCHIVOS ---
function eliminarArchivo(idx) {
  let archivosSubidos = JSON.parse(localStorage.getItem('archivosSubidos') || '[]');
  archivosSubidos.splice(idx, 1);
  localStorage.setItem('archivosSubidos', JSON.stringify(archivosSubidos));
  alert('Archivo eliminado correctamente.');
}

// NUEVO: Lógica para el mapa de empresa con filtros
function actualizarVistaMapaEmpresa(repartidoresFiltrados) {
       if (!map || !featuresLayerEmpresa) {
        console.warn("Mapa de empresa o capa de features no inicializada para actualizarVistaMapaEmpresa");
        mostrarFeedback("El mapa no está listo. Intenta recargar.");
        return;
    }
    featuresLayerEmpresa.clearLayers(); // Limpia la capa dedicada de empresa

    if (!repartidoresFiltrados || repartidoresFiltrados.length === 0) {
        // map.setView([-34.397, 150.644], 5); // Vista por defecto si no hay rutas
        mostrarFeedback("No hay rutas para mostrar con los filtros seleccionados.");
        return;
    }

    const colores = ['blue', 'red', 'green', 'purple', 'orange', 'darkred', 'cadetblue', 'darkgreen', 'magenta', 'teal', 'brown', 'gold'];
    // Asignar color único por repartidor
    let colorPorUsuario = {};
    let usuariosUnicos = Array.from(new Set(repartidoresFiltrados.map(r => r.usuario)));
    usuariosUnicos.forEach((usuario, idx) => {
      colorPorUsuario[usuario] = colores[idx % colores.length];
    });
    let colorIdx = 0;
    const todosLosPuntos = [];

    repartidoresFiltrados.forEach(repartidor => {
        if (!repartidor.lugares || repartidor.lugares.length === 0) return;

        const puntosRutaActual = [];
        repartidor.lugares.forEach(lugar => {
            geocodeDireccionLeaflet(lugar.direccion, (latlng) => {
                if (latlng) {
                    todosLosPuntos.push(latlng);
                    puntosRutaActual.push(latlng);

                    // Usar icono de color personalizado para el marcador
                    const iconoColor = L.icon({
                        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${colorPorUsuario[repartidor.usuario] || 'blue'}.png`,
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                        shadowSize: [41, 41]
                    });
                    const marker = L.marker(latlng, {
                        title: `${repartidor.nombre} ${repartidor.apellidos || ''}: ${lugar.direccion} - ${lugar.hora}`,
                        icon: iconoColor
                    }).addTo(map);
                    marker.bindPopup(`<b style='color:${colorPorUsuario[repartidor.usuario]};'>${repartidor.nombre} ${repartidor.apellidos || ''}</b><br>${lugar.direccion}<br>Hora: ${lugar.hora}<br>Fecha: ${repartidor.fechaRuta}${lugar.incidencia ? '<br><span style=\'color:#e53935;\'>Incidencia: ' + lugar.incidencia + '</span>' : ''}`).addTo(featuresLayerEmpresa);

                    // Si hay más de un punto para este repartidor, dibujar polilínea
                    if (puntosRutaActual.length > 1) {
                        const polyline = L.polyline(puntosRutaActual.slice(-2), {
                            color: colorPorUsuario[repartidor.usuario],
                            weight: 3,
                            opacity: 0.7
                         }).addTo(featuresLayerEmpresa);
                    }
                }
            });
        });
        colorIdx++;
    });

    // Esperar un poco para que la geocodificación asíncrona termine antes de ajustar el zoom
    setTimeout(() => {
        if (todosLosPuntos.length > 0) {
            const bounds = L.latLngBounds(todosLosPuntos);
            if (bounds.isValid()) {
                 map.fitBounds(bounds, { padding: [50, 50] });
            } else if (todosLosPuntos.length === 1) {
                map.setView(todosLosPuntos[0], 13);
            }
        } else {
             // map.setView([-34.397, 150.644], 5); // Vista por defecto si no hay puntos
        }
    }, 1500); // Ajustar este tiempo si es necesario
}
// Intentar usar la ubicación actual del usuario
window.mostrarRuta = function(idx, lugarIdx) {
  const repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  const repartidor = repartidores[idx];
  const lugar = repartidor.lugares[lugarIdx];

  // Validar si la ruta ya está marcada como realizada o tiene incidencia
  if (lugar.realizada || lugar.incidencia) {
    alert('Esta ruta ya está marcada como realizada o tiene una incidencia y no puede ser gestionada.');
    // Eliminar botones de interacción
    const botones = document.querySelectorAll(`[data-ruta-id="${idx}-${lugarIdx}"]`);
    botones.forEach(boton => boton.style.display = 'none');
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      const origen = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      calcularRuta(origen, lugar.direccion);
    }, function() {
      // Si falla, usar el centro por defecto
      calcularRuta({ lat: -34.6037, lng: -58.3816 }, lugar.direccion);
    });
  } else {
    calcularRuta({ lat: -34.6037, lng: -58.3816 }, lugar.direccion);
  }
};

// La función calcularRuta original usa Google Maps Directions Service.
// La adaptaremos para Leaflet con OSRM como ya se hace en calcularRutaLeaflet.
// Esta función se usa para el repartidor individual.
// function calcularRuta(origen, destino) { // Esta es la de Google Maps, la comentamos o eliminamos si no se usa
//   directionsRenderer.set('directions', null); // Limpiar ruta anterior
//   directionsService.route({
//     origin: origen,
//     destination: destino,
//     travelMode: 'DRIVING'
//   }, function(response, status) {
//     if (status === 'OK') {
//       directionsRenderer.setDirections(response);
//       // Mostrar distancia y tiempo
//       const leg = response.routes[0].legs[0];
//       document.getElementById('info-ruta').innerHTML =
//         `<strong>Distancia:</strong> ${leg.distance.text} <br> <strong>Tiempo estimado:</strong> ${leg.duration.text}`;
//     } else {
//       document.getElementById('info-ruta').innerHTML = '';
//       alert('No se pudo calcular la ruta: ' + status);
//     }
//   });
// }

window.borrarRutas = function() {
  if (confirm('¿Seguro que quieres borrar TODAS las rutas, repartidores y sus archivos asociados? Esta acción no se puede deshacer.')) {
    localStorage.removeItem('repartidores');
    mostrarRepartidores();
    limpiarMarcadores();
    // Elimina la referencia a directionsRenderer, solo limpia el info-ruta
    var infoRuta = document.getElementById('info-ruta');
    if (infoRuta) infoRuta.innerHTML = '';
  }
}

// function limpiarMarcadores() {
//   marcadores.forEach(m => map.removeLayer(m)); // Adaptado para Leaflet
//   marcadores = [];
//   leafletRutas.forEach(r => map.removeLayer(r)); // Limpiar también las polilíneas de ruta
//   leafletRutas = [];
// }

// Eliminar una entrega individual (marcar como realizada si está en modo repartidor)
function eliminarEntrega(repartidorIdx, entregaIdx) {
  // Confirmación para repartidor
  if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    if (!confirm('¿Estás seguro de marcar esta entrega como realizada?')) return;
  }
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (!repartidores[repartidorIdx]) return;
  // Si es repartidor (usuarioActual definido), marcar como realizada
  if (usuarioActual) {
    if (!repartidores[repartidorIdx].lugares[entregaIdx].realizada) {
      repartidores[repartidorIdx].lugares[entregaIdx].realizada = true;
    }
  } else {
    // Si es empresa, eliminar la entrega
    repartidores[repartidorIdx].lugares.splice(entregaIdx, 1);
    if (repartidores[repartidorIdx] && repartidores[repartidorIdx].lugares.length === 0) {
      repartidores.splice(repartidorIdx, 1);
    }
  }
  localStorage.setItem('repartidores', JSON.stringify(repartidores));
  mostrarRepartidores(); // <-- Corregido aquí
  limpiarMarcadores();
  if (repartidores[repartidorIdx]) {
    mostrarMarcadoresRepartidor(repartidores[repartidorIdx], repartidorIdx);
  }
}
window.eliminarEntrega = eliminarEntrega;

// Permite a la empresa eliminar una entrega específica de un repartidor
window.eliminarEntregaEmpresa = function(repartidorIdx, entregaIdx) {
  if (!confirm('¿Seguro que quieres eliminar esta entrega/ruta?')) return;
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (!repartidores[repartidorIdx]) return;
  repartidores[repartidorIdx].lugares.splice(entregaIdx, 1);
  // Si el repartidor se queda sin entregas, eliminarlo
  if (repartidores[repartidorIdx].lugares.length === 0) {
    repartidores.splice(repartidorIdx, 1);
  }
  localStorage.setItem('repartidores', JSON.stringify(repartidores));
  mostrarRepartidores();
  limpiarMarcadores();
};

// Permite a la empresa guardar la edición de dirección y hora de una entrega
window.guardarEdicionEntrega = function(repartidorIdx, entregaIdx) {
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (!repartidores[repartidorIdx] || !repartidores[repartidorIdx].lugares[entregaIdx]) return;
  const dirInput = document.getElementById('dir-edit-' + repartidorIdx + '-' + entregaIdx);
  const horaInput = document.getElementById('hora-edit-' + repartidorIdx + '-' + entregaIdx);
  if (!dirInput || !horaInput) return;
  repartidores[repartidorIdx].lugares[entregaIdx].direccion = dirInput.value;
  repartidores[repartidorIdx].lugares[entregaIdx].hora = horaInput.value;
  localStorage.setItem('repartidores', JSON.stringify(repartidores));
  mostrarRepartidores();
  mostrarFeedback('Entrega actualizada correctamente.');
};

// --- PANEL DE ADMINISTRACIÓN DE USUARIOS ---
function renderPanelUsuarios() {
  const cont = document.getElementById('admin-usuarios');
  if (!cont) return;
  // Solo visible para la empresa
  if (!usuarioActual || usuarioActual.usuario !== 'empresa') {
    cont.innerHTML = '<p style="color:#888;">Solo la empresa puede administrar usuarios.</p>';
    return;
  }
  let usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
  let editIdx = typeof window._editUsuarioIdx === 'number' ? window._editUsuarioIdx : null;
  let formHtml = `<form id="form-usuario-admin" style="margin-bottom:18px;">
    <input type="hidden" id="edit-usuario-idx" value="${editIdx !== null ? editIdx : ''}">
    <label>Usuario:</label>
    <input type="text" id="usuario-admin" required value="${editIdx !== null ? usuarios[editIdx].usuario : ''}">
    <label>Contraseña:</label>
    <input type="text" id="password-admin" required value="${editIdx !== null ? usuarios[editIdx].password : ''}">
    <label>Nombre:</label>
    <input type="text" id="nombre-admin" required value="${editIdx !== null ? usuarios[editIdx].nombre : ''}">
    <button type="submit" id="btn-guardar-usuario" style="display:inline-block;margin-right:8px;">${editIdx !== null ? 'Guardar cambios' : 'Crear usuario'}</button>
    ${editIdx !== null ? '<button type="button" id="cancelar-edicion-usuario">Cancelar</button>' : ''}
  </form>`;
  let listaHtml = '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
  listaHtml += '<tr style="background:#f3f6fa;"><th>Usuario</th><th>Nombre</th><th>Acciones</th></tr>';
  usuarios.forEach((u, idx) => {
    // Si el usuario es "empresa", nunca mostrar eliminar, ni siquiera tras editar
    const esEmpresa = u.usuario === 'empresa';
    listaHtml += `<tr style="border-bottom:1px solid #e0e0e0;">
      <td>${u.usuario}</td>
      <td>${u.nombre}</td>
      <td>
        <button onclick="editarUsuario(${idx})" style="background:#1a73e8;color:#fff;border:none;border-radius:4px;padding:2px 8px;margin-right:4px;">Editar</button>
        ${esEmpresa ? '<span style="color:#888;font-size:0.95em;">No se puede eliminar</span>' : `<button onclick="eliminarUsuario(${idx})" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Eliminar</button>`}
      </td>
    </tr>`;
  });
  listaHtml += '</table>';
  cont.innerHTML = formHtml + listaHtml;
  // Eventos del formulario
  document.getElementById('form-usuario-admin').onsubmit = function(e) {
    e.preventDefault();
    let idx = document.getElementById('edit-usuario-idx').value;
    let usuario = document.getElementById('usuario-admin').value.trim();
    let password = document.getElementById('password-admin').value.trim();
    let nombre = document.getElementById('nombre-admin').value.trim();
    if (!usuario || !password || !nombre) {
      alert('Completa todos los campos');
      return;
    }
    // Si el usuario editado es "empresa", forzar que el usuario siga siendo 'empresa'
    if (idx !== '' && usuarios[idx].usuario === 'empresa') {
      usuario = 'empresa';
    }
    if (idx !== '') {
      usuarios[idx] = { usuario, password, nombre };
      window._editUsuarioIdx = null;
    } else {
      if (usuarios.some(u => u.usuario === usuario)) {
        alert('El usuario ya existe');
        return;
      }
      usuarios.push({ usuario, password, nombre });
    }
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    renderPanelUsuarios();
  };
  if (document.getElementById('cancelar-edicion-usuario')) {
    document.getElementById('cancelar-edicion-usuario').onclick = function() {
      window._editUsuarioIdx = null;
      renderPanelUsuarios();
    };
  }
}
window.editarUsuario = function(idx) {
  window._editUsuarioIdx = idx;
  renderPanelUsuarios();
};
window.eliminarUsuario = function(idx) {
  if (!confirm('¿Seguro que quieres eliminar este usuario?')) return;
  let usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
  if (usuarios[idx] && usuarios[idx].usuario !== 'empresa') {
    usuarios.splice(idx, 1);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
  }
  renderPanelUsuarios();
};

// --- INICIALIZAR usuarioActual DESDE localStorage ANTES DE DOMContentLoaded ---
if (!window.usuarioActual) {
  try {
    const userLS = JSON.parse(localStorage.getItem('usuarioActual'));
    if (userLS && userLS.usuario) {
      window.usuarioActual = userLS;
    }
  } catch(e) {
    window.usuarioActual = null;
  }
}

// Asegurar que usuarioActual esté inicializado correctamente al cargar la página
if (!window.usuarioActual) {
  try {
    const userLS = JSON.parse(localStorage.getItem('usuarioActual'));
    if (userLS && userLS.usuario) {
      window.usuarioActual = userLS;
    }
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', function() {
  renderPanelUsuarios();
});

// Mostrar repartidores al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  // Solo inicializar el mapa del repartidor si no estamos en modo empresa.
  // El mapa de la empresa se inicializa en el DOMContentLoaded al final del script.
  if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    initMap();
  } else if (usuarioActual && usuarioActual.usuario === 'empresa') {
    initMap(); // <-- Inicializar el mapa también para la empresa
    const mapaDiv = document.getElementById('map');
    if (mapaDiv) mapaDiv.style.display = 'block'; // Asegurar visibilidad para el mapa de empresa
  }
  ajustarPanelesPorUsuario();
  mostrarRepartidores();
  if (!document.getElementById('info-ruta')) {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'info-ruta';
    infoDiv.style = 'margin:10px 0; font-size:1.1em; color:#333;';
    document.getElementById('map').insertAdjacentElement('beforebegin', infoDiv);
  }
  // Generar QR en negro puro sobre fondo blanco para máxima escaneabilidad
  if (document.getElementById('qrcode')) {
    document.getElementById('qrcode').innerHTML = '';
    new QRCode(document.getElementById('qrcode'), {
      text: window.location.href, // Usar la URL actual para el QR
      width: 200,
      height: 200,
      colorDark: "#000000", // negro puro
      colorLight: "#ffffff", // blanco puro
      correctLevel: QRCode.CorrectLevel.H
    });
  }
  // Botón de llamada directa
  const btnContacto = document.getElementById('btn-contacto');
  if(btnContacto) {
    btnContacto.onclick = function() {
      window.location.href = 'tel:+34123456789'; // Cambia el número por el de la empresa
    };
  }
  // Drag & drop para Excel
  const dropExcel = document.getElementById('drop-excel');
  const inputExcel = document.getElementById('archivoExcel');
  if(dropExcel && inputExcel) {
    // Al hacer clic en el área, abre el selector
    dropExcel.onclick = () => inputExcel.click();
    // Efecto visual al arrastrar
    ['dragenter','dragover'].forEach(evt => dropExcel.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropExcel.style.background = '#e3f0ff';
      dropExcel.style.borderColor = '#155ab6';
    }));
    ['dragleave','drop'].forEach(evt => dropExcel.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropExcel.style.background = '#f8fbff';
      dropExcel.style.borderColor = '#1a73e8';
    }));
    // Al soltar archivo
    dropExcel.addEventListener('drop', e => {
      if(e.dataTransfer.files && e.dataTransfer.files.length) {
        inputExcel.files = e.dataTransfer.files;
        inputExcel.dispatchEvent(new Event('change'));
      }
    });
  }
  // Mostrar archivos subidos al cargar la página
  if (typeof window.mostrarArchivosSubidos === 'function') {
    window.mostrarArchivosSubidos();
  }
});

document.getElementById('archivoExcel').addEventListener('change', function(e) {
  subirArchivo(this);
});

// --- FEEDBACK SIMPLE ---
function mostrarFeedback(msg) {
  let fb = document.getElementById('feedback-msg');
  if (!fb) {
    fb = document.createElement('div');
    fb.id = 'feedback-msg';
    fb.style = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#1a73e8;color:#fff;padding:12px 28px;border-radius:8px;z-index:9999;font-size:1.1em;box-shadow:0 2px 12px #0003;transition:opacity 0.3s;opacity:0.97;';
    document.body.appendChild(fb);
  }
  fb.innerText = msg;
  fb.style.display = 'block';
  setTimeout(() => { fb.style.display = 'none'; }, 2600);
}

// --- ACTUALIZACIÓN AUTOMÁTICA DE DATOS PARA REPARTIDOR (POLLING) ---
let intervaloActualizacion = null;
function iniciarActualizacionAutomatica() {
  if (intervaloActualizacion) clearInterval(intervaloActualizacion);
  // Solo para repartidor logueado
  if (usuarioActual && usuarioActual.usuario && usuarioActual.usuario !== 'empresa') {
    intervaloActualizacion = setInterval(() => {
      mostrarRepartidores();
      if (typeof window.mostrarArchivosSubidos === 'function') window.mostrarArchivosSubidos();
    }, 10000); // cada 10 segundos
  }
}
function detenerActualizacionAutomatica() {
  if (intervaloActualizacion) clearInterval(intervaloActualizacion);
}

// Llamar tras login repartidor
function mostrarMapaTrasLoginRepartidor() {
  // Limpiar la vista de empresa antes de mostrar elementos de repartidor
  document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'none');
  const formAdmin = document.getElementById('repartidor-form');
  if (formAdmin) formAdmin.style.display = 'none';
  const adminUsuarios = document.getElementById('admin-usuarios');
  if (adminUsuarios) adminUsuarios.style.display = 'none';
  const areaArchivos = document.getElementById('area-subida-archivos');
  if (areaArchivos) areaArchivos.style.display = 'none';
  // Mostrar mapa
  const mapa = document.getElementById('map');
  if (mapa) mapa.style.display = 'block';
  // Mostrar header solo si es empresa
  const header = document.getElementById('header-principal');
  if (header) header.style.display = (usuarioActual && usuarioActual.usuario === 'empresa') ? 'block' : 'none';
  // Mostrar título admin solo si es empresa
  const tituloAdmin = document.getElementById('titulo-admin-panel');
  if (tituloAdmin) tituloAdmin.style.display = (usuarioActual && usuarioActual.usuario === 'empresa') ? 'block' : 'none';
  // Mostrar el footer solo si es empresa
  const footer = document.querySelector('footer');
  if (footer) footer.style.display = (usuarioActual && usuarioActual.usuario === 'empresa') ? 'block' : 'none';
  // Ocultar el modal de login
  const loginRepartidor = document.getElementById('login-repartidor');
  if (loginRepartidor) loginRepartidor.style.display = 'none';
  // Mostrar área de archivos subidos solo si es repartidor
  if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    const archivos = document.getElementById('archivos-subidos');
    if (archivos) archivos.style.display = 'block';
    // Mostrar el botón de contacto SIEMPRE en modo repartidor
    const btnContacto = document.getElementById('btn-contacto');
    if (btnContacto) btnContacto.style.display = 'block';
    // Mostrar el título de rutas de reparto si existe
    const tituloRutas = document.getElementById('titulo-rutas-reparto');
    if (tituloRutas) tituloRutas.style.display = 'block';
    // NUEVO: Mostrar rutas del repartidor en el mapa
    let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
    let miRepartidor = repartidores.find(r => r.usuario === usuarioActual.usuario);
    if (miRepartidor) mostrarMarcadoresRepartidor(miRepartidor, 0);
  }
  // Corregir error: solo llamar si existe la función
  if (typeof window.mostrarAreaSubidaArchivos === 'function') {
    window.mostrarAreaSubidaArchivos();
  }
  iniciarActualizacionAutomatica();
  // Forzar scroll al top
  window.scrollTo({ top: 0, behavior: 'auto' });
  // Quitar clase de aislamiento visual del login
  document.body.classList.remove('login-repartidor-activo');
}
// --- FIN ---

// --- MANTENER SESIÓN DE REPARTIDOR ENTRE RECARGAS (robusto y sin recargar) ---
(function() {
  try {
    const userLS = JSON.parse(localStorage.getItem('usuarioActual'));
    if (userLS && userLS.usuario && userLS.usuario !== 'empresa') {
      usuarioActual = userLS;
      mostrarMapaTrasLoginRepartidor();
      setTimeout(() => { ajustarPanelesPorUsuario(); mostrarRepartidores(); }, 100);
      return;
    }
  } catch(e) {}
  if (esMovil() && (!usuarioActual || usuarioActual.usuario !== 'empresa')) {
    mostrarLogin();
    if (typeof window.mostrarIndicadorModo === 'function') window.mostrarIndicadorModo();
  }
})();

// --- FORZAR VISTA EMPRESA O REPARTIDOR SEGÚN LOGIN ---
function forzarVistaPorUsuario() {
  const usuarioLS = localStorage.getItem('usuarioActual');
  let usuario = null;
  try {
    usuario = usuarioLS ? JSON.parse(usuarioLS) : null;
  } catch(e) {}
  if (usuario && usuario.usuario && usuario.usuario !== 'empresa') {
    // Vista repartidor
    document.getElementById('login-repartidor').style.display = 'none';
    document.getElementById('repartidor-form').style.display = 'none';
    document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'none');
    document.getElementById('map').style.display = 'block';
    const btnContacto = document.getElementById('btn-contacto');
    if (btnContacto) btnContacto.style.display = 'block';
    mostrarRepartidores();
  } else if (window.esMovil && esMovil()) {
    // Móvil sin login: solo login repartidor
    document.getElementById('login-repartidor').style.display = 'flex';
    document.getElementById('repartidor-form').style.display = 'none';
    document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'none');
    document.getElementById('map').style.display = 'none';
    const btnContacto = document.getElementById('btn-contacto');
    if (btnContacto) btnContacto.style.display = 'block';
  } else {
    // Vista empresa (PC o sin login en PC)
    document.getElementById('login-repartidor').style.display = 'none';
    document.getElementById('repartidor-form').style.display = 'block';
    document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'block');
    document.getElementById('map').style.display = 'block';
    const btnContacto = document.getElementById('btn-contacto');
    if (btnContacto) btnContacto.style.display = 'none';
    mostrarRepartidores();
  }
}
window.addEventListener('DOMContentLoaded', forzarVistaPorUsuario);
window.addEventListener('resize', forzarVistaPorUsuario);

// --- MODAL RUTAS EMPRESA ---
document.getElementById('abrir-modal-rutas').addEventListener('click', function() {
  const modal = document.getElementById('modal-rutas-empresa');
  const cont = document.getElementById('contenido-modal-rutas');
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (!repartidores.length) {
    cont.innerHTML = '<p style="text-align:center;color:#888;">No hay rutas creadas.</p>';
  } else {
    // Antes de asignar cont.innerHTML, limpia listeners antiguos del modal
    cont.innerHTML = '';
    cont.innerHTML = repartidores.map((r, idx) => {
      const total = r.lugares ? r.lugares.length : 0;
      const realizadas = r.lugares ? r.lugares.filter(l => l.realizada).length : 0;
      const pendientes = total - realizadas;
      const incidencias = r.lugares ? r.lugares.filter(l => l.incidencia && l.incidencia.trim() !== '').length : 0;
      const entregas = (Array.isArray(r.lugares) ? r.lugares.map((l, i) => {
        let estado = 'pendiente';
        if (l.incidencia && l.incidencia.trim() !== '') {
          estado = 'incidencia';
        } else if (l.realizada) {
          estado = 'realizada';
        }
        return `<li class='tarjeta-entrega tarjeta-${estado}' style='list-style:none;display:flex;align-items:center;gap:8px;margin-bottom:12px;'>
          <input type='text' value='${l.direccion || ''}' id='dir-edit-modal-${idx}-${i}' style='width:180px;margin-right:4px;'>
          <input type='time' value='${l.hora || ''}' id='hora-edit-modal-${idx}-${i}' style='width:90px;margin-right:4px;'>
          <button onclick='window.guardarEdicionEntregaModal(${idx},${i})' title='Guardar cambios' style='background:#1a73e8;color:#fff;border:none;border-radius:4px;padding:2px 8px;'>💾</button>
          <button onclick="window.abrirNavegacionGoogleMaps && window.abrirNavegacionGoogleMaps('${(l.direccion || '').replace(/'/g, "\\'")}', '${l.hora}')" title="Navegar" style="background:#4caf50;color:#fff;border:none;border-radius:4px;padding:2px 8px;">🚗</button>
          <button onclick="window.eliminarRutaCompletaEmpresaModal(${idx})" title="Borrar ruta completa" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:2px 8px;margin-left:2px;">🗑️</button>
          <input type='file' class='input-archivo-modal' data-repartidor-idx='${idx}' data-lugar-idx='${i}' style='font-size:0.7em;margin-left:6px;'>
          <div class='archivos-modal-lista' style='display:flex;flex-direction:column;gap:3px;margin-left:8px;'>
            ${(l.archivos||[]).map((archivo, archivoIdx) =>
              `<span style='display:flex;align-items:center;gap:4px;'>
                <a href="${archivo.datosArchivo}" download="${archivo.nombreArchivo}" style="color:#0056b3;">${archivo.nombreArchivo}</a>
                <button onclick="window.visualizarArchivoEntrega(${idx},${i},${archivoIdx})" style="background:#1976d2;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Ver</button>
                <button onclick="window.eliminarArchivoModal(${idx},${i},${archivoIdx})" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Eliminar</button>
              </span>`
            ).join('')}
          </div>
        </li>`;
      }).join('') : '');
      // Mostrar archivos generales de la ruta (archivosEspecificos)
      let archivosRuta = (r.archivosEspecificos && r.archivosEspecificos.length)
        ? `<div style='margin:8px 0 8px 0;'><strong>Archivos de la ruta:</strong><ul style='margin:0 0 0 10px;padding:0;'>${r.archivosEspecificos.map((archivo, archivoIdx) =>
            `<li style='margin-bottom:4px;display:flex;align-items:center;gap:6px;'>
              <a href="${archivo.datosArchivo}" download="${archivo.nombreArchivo}" style="color:#0056b3;">${archivo.nombreArchivo}</a>
              <button onclick="window.visualizarArchivoRuta(${idx},${archivoIdx})" style="background:#1976d2;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Ver</button>
              <button onclick="window.eliminarArchivoEspecifico(${idx},${archivoIdx})" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Eliminar</button>
            </li>`
        ).join('')}</ul></div>`
        : '';
      return `
      <div style='border-bottom:1px solid #eee;padding:10px 0;'>
        <strong>Usuario:</strong> ${r.usuario || ''}<br>
        <strong>Nombre:</strong> ${r.nombre} ${r.apellidos || ''}<br>
        <strong>Zona:</strong> ${r.zona}<br>
        <strong>Fecha Ruta:</strong> ${r.fechaRuta || 'N/A'}<br>
        <strong>Información adicional:</strong> ${r.infoAdicional || ''}<br>
        ${archivosRuta}
        <div style='margin:8px 0;'>
          <span style="background:#e3f0ff;color:#155ab6;padding:3px 10px;border-radius:12px;font-size:0.98em;margin-right:8px;">Total: ${total}</span>
          <span style="background:#d4edda;color:#256029;padding:3px 10px;border-radius:12px;font-size:0.98em;margin-right:8px;">✔ Realizadas: ${realizadas}</span>
          <span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:12px;font-size:0.98em;margin-right:8px;">⏳ Pendientes: ${pendientes}</span>
          <span style="background:#f8d7da;color:#721c24;padding:3px 10px;border-radius:12px;font-size:0.98em;">Incidencia: ${incidencias}</span>
        </div>
        <div><strong>Entregas:</strong></div>
        <ul style='margin:0;padding:0 0 0 10px;'>${entregas}</ul>
      </div>`;
    }).join('');
  }
  // Abrir modal
  modal.style.display = 'block';
  // Añadir listeners a los inputs de archivo del modal
  setTimeout(() => {
    document.querySelectorAll('.input-archivo-modal').forEach(input => {
      input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const repartidorIdx = parseInt(e.target.dataset.repartidorIdx, 10);
        const lugarIdx = parseInt(e.target.dataset.lugarIdx, 10);
        if (!file || isNaN(repartidorIdx) || isNaN(lugarIdx)) return;
        const reader = new FileReader();
        reader.onload = function(event) {
          let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
          if (repartidores[repartidorIdx] && repartidores[repartidorIdx].lugares[lugarIdx]) {
            if (!repartidores[repartidorIdx].lugares[lugarIdx].archivos) {
              repartidores[repartidorIdx].lugares[lugarIdx].archivos = [];
            }
            repartidores[repartidorIdx].lugares[lugarIdx].archivos.push({
              nombreArchivo: file.name,
              tipoArchivo: file.type || file.name.split('.').pop(),
              datosArchivo: event.target.result
            });
            localStorage.setItem('repartidores', JSON.stringify(repartidores));
            document.getElementById('abrir-modal-rutas').click(); // Refrescar modal
            mostrarFeedback('Archivo subido y sincronizado.');
          }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      });
    });
  }, 100);
  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener('click', function cerrarModal(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
      window.removeEventListener('click', cerrarModal);
    }
  });
});

// Cerrar el modal al presionar ESC
document.addEventListener('keydown', function(event) {
  const modal = document.getElementById('modal-rutas-empresa');
  if (modal.style.display === 'block' && event.key === 'Escape') {
    modal.style.display = 'none';
  }
});

// --- LOGIN REPARTIDOR ---
document.addEventListener('DOMContentLoaded', function() {
  const formLogin = document.getElementById('form-login-repartidor');
  if (formLogin) {
    formLogin.addEventListener('submit', function(e) {
      e.preventDefault();
      const usuarioInput = document.getElementById('login-usuario').value.trim().toLowerCase();
      const passwordInput = document.getElementById('login-password').value;
      let usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
      const user = usuarios.find(u => u.usuario.trim().toLowerCase() === usuarioInput && u.password === passwordInput);
      if (user && user.usuario !== 'empresa') {
        localStorage.setItem('usuarioActual', JSON.stringify(user));
        location.reload(); // Forzar recarga para que la vista cambie correctamente
      } else {
        mostrarFeedback('Usuario o contraseña incorrectos.');
      }
    });
  }
});

// --- FUNCION GLOBAL PARA ABRIR GOOGLE MAPS ---
window.abrirNavegacionGoogleMaps = function(direccion) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
  window.open(url, '_blank');
};

// --- MARCAR INCIDENCIA DESDE REPARTIDOR ---
window.marcarIncidenciaRepartidor = function(repartidorIdx, lugarIdx, btn) {
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (repartidores[repartidorIdx] && repartidores[repartidorIdx].lugares[lugarIdx]) {
    repartidores[repartidorIdx].lugares[lugarIdx].incidencia = 'Incidencia';
    localStorage.setItem('repartidores', JSON.stringify(repartidores));
    mostrarRepartidores();
    mostrarFeedback('Incidencia marcada y sincronizada con la empresa.');
  }
};

// --- FUNCIONES DE EDICIÓN Y ARCHIVOS EN MODAL ---
window.guardarEdicionEntregaModal = function(repartidorIdx, lugarIdx) {
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  const dirInput = document.getElementById('dir-edit-modal-' + repartidorIdx + '-' + lugarIdx);
  const horaInput = document.getElementById('hora-edit-modal-' + repartidorIdx + '-' + lugarIdx);
  if (repartidores[repartidorIdx] && repartidores[repartidorIdx].lugares[lugarIdx]) {
    repartidores[repartidorIdx].lugares[lugarIdx].direccion = dirInput.value;
    repartidores[repartidorIdx].lugares[lugarIdx].hora = horaInput.value;
    localStorage.setItem('repartidores', JSON.stringify(repartidores));
    mostrarFeedback('Entrega actualizada correctamente.');
    document.getElementById('abrir-modal-rutas').click(); // Refrescar modal
  }
};
window.eliminarEntregaEmpresaModal = function(repartidorIdx, lugarIdx) {
  if (!confirm('¿Seguro que quieres eliminar esta entrega?')) return;

  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (repartidores[repartidorIdx] && repartidores[repartidorIdx].lugares[lugarIdx]) {
    repartidores[repartidorIdx].lugares.splice(lugarIdx, 1);
    localStorage.setItem('repartidores', JSON.stringify(repartidores));
    mostrarFeedback('Entrega eliminada.');
    refrescarModalRutas();
  }
};
window.eliminarArchivoModal = function(repartidorIdx, lugarIdx, archivoIdx) {
  if (!confirm('¿Seguro que quieres eliminar este archivo?')) return;
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (repartidores[repartidorIdx] && repartidores[repartidorIdx].lugares[lugarIdx] && repartidores[repartidorIdx].lugares[lugarIdx].archivos) {
    repartidores[repartidorIdx].lugares[lugarIdx].archivos.splice(archivoIdx, 1);
    localStorage.setItem('repartidores', JSON.stringify(repartidores));
    mostrarFeedback('Archivo eliminado correctamente.');
    if (typeof usuarioActual !== 'undefined' && usuarioActual && usuarioActual.usuario === 'empresa') {
      refrescarModalRutas();
    } else {
      if (typeof mostrarRepartidores === 'function') mostrarRepartidores();
    }
  } else {
    mostrarFeedback('Error al eliminar el archivo.');
  }
};
window.eliminarRutaCompletaEmpresaModal = function(repartidorIdx) {
  if (!confirm('¿Seguro que quieres eliminar TODA la ruta de este repartidor? Se eliminarán todas sus entregas y archivos.')) return;

  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  if (repartidores[repartidorIdx]) {
    repartidores.splice(repartidorIdx, 1);
    localStorage.setItem('repartidores', JSON.stringify(repartidores));
    mostrarFeedback('Ruta completa eliminada correctamente.');
    refrescarModalRutas();
  } else {
    mostrarFeedback('Error al eliminar la ruta completa.');
  }
};
function refrescarModalRutas() {
  const botonAbrirModal = document.getElementById('abrir-modal-rutas');
  if (botonAbrirModal) {
    botonAbrirModal.click();
  } else {
    console.error('No se encontró el botón para abrir el modal de rutas.');
  }
}

// Mostrar archivos subidos en el panel visual (empresa y repartidor)
window.mostrarArchivosSubidos = function() {
  const cont = document.getElementById('archivos-subidos');
  if (!cont) return;
  let archivos = JSON.parse(localStorage.getItem('archivosSubidos') || '[]');
  if (!archivos.length) {
    cont.innerHTML = '<span style="color:#888;">No hay archivos subidos.</span>';
    return;
  }
  cont.innerHTML = archivos.map((archivo, idx) => {
    let esImagen = archivo.tipoArchivo && archivo.tipoArchivo.startsWith('image/');
    let vista = esImagen
      ? `<img src="${archivo.datosArchivo}" alt="${archivo.nombreArchivo}" style="max-width:90px;max-height:90px;display:block;margin-bottom:4px;">`
      : `<span style='font-size:2em;'>📄</span>`;
    return `<div style="border:1px solid #ddd;padding:10px 8px;border-radius:8px;display:flex;flex-direction:column;align-items:center;min-width:110px;max-width:120px;">
      ${vista}
      <span style="font-size:0.95em;margin-bottom:6px;text-align:center;word-break:break-all;">${archivo.nombreArchivo}</span>
      <div style="display:flex;gap:6px;">
        <button onclick="window.visualizarArchivoSubido(${idx})" style="background:#1976d2;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Ver</button>
        <button onclick="window.eliminarArchivoSubido(${idx})" style="background:#e53935;color:#fff;border:none;border-radius:4px;padding:2px 8px;">Eliminar</button>
      </div>
    </div>`;
  }).join('');
};

window.visualizarArchivoSubido = function(idx) {
  let archivos = JSON.parse(localStorage.getItem('archivosSubidos') || '[]');
  if (!archivos[idx]) return;
  const archivo = archivos[idx];
  if (archivo.tipoArchivo && archivo.tipoArchivo.startsWith('image/')) {
    window.open(archivo.datosArchivo, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = archivo.datosArchivo;
    link.download = archivo.nombreArchivo;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

window.eliminarArchivoSubido = function(idx) {
  let archivos = JSON.parse(localStorage.getItem('archivosSubidos') || '[]');
  if (!archivos[idx]) return;
  if (!confirm('¿Seguro que quieres eliminar este archivo?')) return;
  archivos.splice(idx, 1);
  localStorage.setItem('archivosSubidos', JSON.stringify(archivos));
  window.mostrarArchivosSubidos();
  mostrarFeedback('Archivo eliminado correctamente.');
};

document.getElementById('archivoExcel').addEventListener('change', function(e) {
  const input = this;
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    let archivos = JSON.parse(localStorage.getItem('archivosSubidos') || '[]');
    archivos.push({
      nombreArchivo: file.name,
      tipoArchivo: file.type || file.name.split('.').pop(),
      datosArchivo: event.target.result
    });
    localStorage.setItem('archivosSubidos', JSON.stringify(archivos));
    window.mostrarArchivosSubidos();
    mostrarFeedback('Archivo subido correctamente.');
  };
  reader.readAsDataURL(file);
  input.value = '';
});

// Filtros mapa empresa
const btnFiltrar = document.getElementById('btn-aplicar-filtros-mapa');
const btnTodas = document.getElementById('btn-mostrar-todas-rutas-mapa');
if (btnFiltrar) {
  btnFiltrar.addEventListener('click', function() {
    const fecha = document.getElementById('filtro-fecha-ruta').value;
    const usuario = document.getElementById('filtro-usuario-ruta').value;
    let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
    let filtrados = repartidores.filter(r => {
      let ok = true;
      if (fecha) ok = ok && r.fechaRuta === fecha;
      if (usuario && usuario !== 'todos') ok = ok && r.usuario === usuario;
      return ok;
    });
    actualizarVistaMapaEmpresa(filtrados);
  });
}
if (btnTodas) {
  btnTodas.addEventListener('click', function() {
    let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
    actualizarVistaMapaEmpresa(repartidores);
  });
}
// Rellenar select de repartidores únicos
const selectUsuario = document.getElementById('filtro-usuario-ruta');
if (selectUsuario) {
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  let usuariosUnicos = Array.from(new Set(repartidores.map(r => r.usuario)));
  selectUsuario.innerHTML = '<option value="todos">Todos los repartidores</option>' + usuariosUnicos.map(u => `<option value="${u}">${u}</option>`).join('');
}
