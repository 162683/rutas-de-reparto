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
  repartidor.lugares.forEach(lugar => {
    geocodeDireccionLeaflet(lugar.direccion, (latlng) => {
      if (latlng) {
        const marker = L.marker(latlng, {
          title: `${lugar.direccion} - ${lugar.hora}`
        }).addTo(map);
        marker.bindPopup(`<b>${lugar.direccion}</b><br>Hora: ${lugar.hora}`);
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

// --- AUTODETECCIÓN Y ASIGNACIÓN DE USUARIO SEGÚN MODO (SOLO EMPRESA) ---
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
// ...existing code...
document.getElementById('repartidor-form').addEventListener('submit', function(e) {
  e.preventDefault();
  // Leer usuario, nombre, zona e información adicional del formulario
  let usuario = document.getElementById('usuario').value;
  let nombre = document.getElementById('nombre').value;
  let zona = document.getElementById('zona').value;
  let infoAdicional = document.getElementById('info-adicional').value; // <-- NUEVO
  let fechaRuta = document.getElementById('fecha-ruta').value; // NUEVO: Campo de fecha
  const direcciones = Array.from(document.getElementsByName('direccion[]')).map(input => input.value);
  const horas = Array.from(document.getElementsByName('hora[]')).map(input => input.value);
  const lugares = direcciones.map((direccion, i) => ({ direccion, hora: horas[i] }));
  if (!usuario || !nombre || !zona || !fechaRuta || lugares.length === 0 || lugares.some(l => !l.direccion || !l.hora)) { // NUEVO: Validar fechaRuta
    mostrarFeedback('Por favor, completa todos los campos antes de guardar.');
    return;
  }
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  // Buscar si ya existe un repartidor con ese usuario, nombre y zona
  const idx = repartidores.findIndex(r => r.usuario === usuario && r.nombre === nombre && r.zona === zona);
  if (idx !== -1) {
    repartidores[idx].lugares = lugares;
    repartidores[idx].usuario = usuario;
    repartidores[idx].nombre = nombre;
    repartidores[idx].zona = zona;
    repartidores[idx].infoAdicional = infoAdicional; // <-- NUEVO
    repartidores[idx].fechaRuta = fechaRuta; // NUEVO
    repartidores[idx].archivosEspecificos = repartidores[idx].archivosEspecificos || []; // Asegurar que exista
    mostrarFeedback('Datos del repartidor actualizados correctamente.');
  } else {
    repartidores.push({ usuario, nombre, zona, lugares, infoAdicional, fechaRuta, archivosEspecificos: [] }); // <-- NUEVO
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
      <label>Hora:</label>
      <input type="time" name="hora[]" required>
    </div>`;
  document.getElementById('fecha-ruta').value = ''; // Limpiar campo de fecha
  document.getElementById('repartidor-form').style.display = 'block';
});
// ...existing code...


function mostrarRepartidores() {
  // Asegurar que usuarioActual esté definido (persistencia tras recarga)
  if (!usuarioActual) {
    try {
      const userLS = JSON.parse(localStorage.getItem('usuarioActual'));
      if (userLS && userLS.usuario) {
        usuarioActual = userLS;
      }
    } catch(e) {}
  }
  const lista = document.getElementById('lista-repartidores');
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  // Normalizar usuario en todos los repartidores
  repartidores = repartidores.map(r => {
    if (r.usuario) r.usuario = String(r.usuario).trim().toLowerCase();
    return r;
  });
  // Normalizar usuarioActual
  let usuarioFiltro = usuarioActual && usuarioActual.usuario ? String(usuarioActual.usuario).trim().toLowerCase() : null;

  if (usuarioActual && usuarioActual.usuario === 'empresa') {
    if (repartidores.length === 0) {
      lista.innerHTML = '<p>No hay repartidores registrados.</p>';
      return;
    }
    let html = repartidores.map((r, idx) => {
      // Asegurar que el objeto repartidor tenga todas las propiedades necesarias
      if (!r.usuario) r.usuario = '';
      if (!r.nombre) r.nombre = '';
      if (!r.fechaRuta) r.fechaRuta = 'N/A'; // NUEVO: Mostrar fecha
      if (!r.zona) r.zona = '';
      if (!Array.isArray(r.lugares)) r.lugares = [];
      const total = r.lugares.length;
      const realizadas = r.lugares.filter(l => l.realizada).length;
      const pendientes = total - realizadas;
      const lugares = r.lugares;
      return `
      <div class="repartidor-card" data-repartidor-usuario="${r.usuario}" data-repartidor-fecha="${r.fechaRuta}" style="margin-bottom:22px;padding:14px 18px;border:1px solid #cce3ff;border-radius:8px;background:#f4faff;box-shadow:0 1px 6px #0002;">
        <div style="font-size:1.1em;font-weight:bold;color:#155ab6;margin-bottom:4px;">${r.nombre} <span style='font-size:0.95em;color:#555;'>(Usuario: ${r.usuario || ''})</span></div>
        <div style="margin-bottom:6px;"><strong>Zona:</strong> ${r.zona}</div>
        <div style="margin-bottom:6px;"><strong>Fecha Ruta:</strong> ${r.fechaRuta}</div>
        <div style="margin-bottom:6px;"><strong>Información adicional:</strong> ${r.infoAdicional || ''}</div>
        <div style="margin-bottom:8px;">
          <span style="background:#e3f0ff;color:#155ab6;padding:3px 10px;border-radius:12px;font-size:0.98em;margin-right:8px;">Total: ${total}</span>
          <span style="background:#d4edda;color:#256029;padding:3px 10px;border-radius:12px;font-size:0.98em;margin-right:8px;">✔ Realizadas: ${realizadas}</span>
          <span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:12px;font-size:0.98em;">⏳ Pendientes: ${pendientes}</span>
        </div>
        <div><strong>Entregas:</strong></div>
        <ul style="margin:0 0 0 12px;padding:0;list-style:disc;">
          ${lugares.map((l, i) => `
            <li style='margin-bottom:4px;display:flex;align-items:center;gap:8px;'>
              <input type='text' value='${l.direccion || ''}' id='dir-edit-${idx}-${i}' style='width:180px;margin-right:4px;'>
              <input type='time' value='${l.hora || ''}' id='hora-edit-${idx}-${i}' style='width:90px;margin-right:4px;'>
              <button onclick='window.guardarEdicionEntrega(${idx},${i})' title='Guardar cambios' style='background:#1a73e8;color:#fff;border:none;border-radius:4px;padding:2px 8px;'>💾</button>
              <button onclick='window.eliminarEntregaEmpresa(${idx},${i})' title='Eliminar entrega' style='background:#e53935;color:#fff;border:none;border-radius:4px;padding:2px 8px;'>🗑️</button>
              <button onclick="window.abrirNavegacionGoogleMaps && window.abrirNavegacionGoogleMaps('${(l.direccion || '').replace(/'/g, "\\'")}', '${l.hora}')" title="Navegar" style="background:#4caf50;color:#fff;border:none;border-radius:4px;padding:2px 8px;">🚗</button>
            </li>
          `).join('')}
        </ul>
        <div class="archivos-por-ruta-container" style="margin-top:10px; padding-top:10px; border-top:1px dashed #ccc;">
            <label for="archivo-ruta-${idx}" style="font-weight:bold; font-size:0.95em; display:block; margin-bottom:5px;">Subir archivo para esta ruta:</label>
            <input type="file" id="archivo-ruta-${idx}" class="input-archivo-ruta" data-repartidor-idx="${idx}" style="margin-bottom:8px; font-size:0.9em;">
            <div id="lista-archivos-ruta-${idx}" class="lista-archivos-especificos" style="font-size:0.9em; display:flex; flex-direction:column; gap:5px;">
                ${(r.archivosEspecificos || []).map((archivo, archivoIdx) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 5px; background-color: #e9ecef; border-radius:3px;">
                        <a href="${archivo.datosArchivo}" download="${archivo.nombreArchivo}" title="Descargar ${archivo.nombreArchivo}" style="color:#0056b3; text-decoration:none;">${archivo.nombreArchivo} (${archivo.tipoArchivo})</a>
                        <button onclick="eliminarArchivoEspecifico(${idx}, ${archivoIdx})" style="background:transparent; border:none; color:red; cursor:pointer; font-size:1.1em;" title="Eliminar archivo">🗑️</button>
                    </div>`).join('')}
            </div>
        </div>
      </div>
      `}).join('');
    lista.innerHTML = html;
    adjuntarEventListenersArchivosRuta(); // NUEVO: Adjuntar listeners a los nuevos inputs
    return;
  }

  // Si es repartidor logueado
  if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    const misRepartos = repartidores
      .map((r, idx) => ({...r, _idx: idx}))
      .filter(r => r.usuario === usuarioFiltro);
    if (misRepartos.length === 0) {
      lista.innerHTML = '<p>No tienes rutas asignadas.</p>';
      return;
    }
    lista.innerHTML = misRepartos.map((r, idx) =>
      `<div class="repartidor-card">
        <strong>Usuario:</strong> ${r.usuario || ''}<br>
        <strong>Nombre:</strong> ${r.nombre}<br>
        <strong>Zona:</strong> ${r.zona}<br>
        <strong>Fecha Ruta:</strong> ${r.fechaRuta || 'N/A'}<br>
        <strong>Información adicional:</strong> ${r.infoAdicional || ''}<br>
        <strong>Entrega:</strong>
        <ul style="margin:0;padding:0;list-style:none;">
          ${(Array.isArray(r.lugares) ? r.lugares : []).map((l, i) =>
            l.realizada
              ? `<li style='margin-bottom:8px;display:flex;align-items:center;gap:10px;background:#e8f5e9;padding:7px 10px;border-radius:6px;'><span style='color:#43a047;font-weight:bold;font-size:1.1em;'>✔ Realizada</span> <span style='color:#333;'>${l.direccion} - ${l.hora}</span></li>`
              : `<li style='margin-bottom:8px;display:flex;align-items:center;gap:10px;background:#f8fbff;padding:7px 10px;border-radius:6px;'>\n                <button style="padding:2px 10px;border-radius:4px;background:#2196f3;color:#fff;border:none;font-size:0.97em;" onclick="mostrarRuta(${r._idx},${i});return false;">Ver ruta en la web</button>\n                <button style="padding:2px 10px;border-radius:4px;background:#4caf50;color:#fff;border:none;font-size:0.97em;" onclick="abrirNavegacionGoogleMaps('${(l.direccion || '').replace(/'/g, "\\'")}')">Google Maps</button>\n                <button style="padding:2px 10px;border-radius:4px;background:#43a047;color:#fff;border:none;font-size:0.97em;" onclick="eliminarEntrega(${r._idx},${i});return false;">Marcar como realizada</button>\n                <span style='color:#333;'>${l.direccion} - ${l.hora}</span>\n              </li>`
          ).join('')}
        </ul>
      </div>`
    ).join('');
    // Mostrar marcadores de este repartidor
    if (misRepartos.length > 0) {
      mostrarMarcadoresRepartidor(misRepartos[0], 0);
    }
    return;
  }

  // Si no hay usuario logueado y es móvil, no mostrar nada (ni mensaje de login ni panel de administración)
  if (esMovil()) {
    lista.innerHTML = '';
    return;
  }

  // Si no hay usuario logueado y es PC, mostrar mensaje de login
  lista.innerHTML = '<p>Debes iniciar sesión para ver tus rutas.</p>';
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

    const colores = ['blue', 'red', 'green', 'purple', 'orange', 'darkred', 'cadetblue', 'darkgreen'];
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

                    const marker = L.marker(latlng, {
                        title: `${repartidor.nombre}: ${lugar.direccion} - ${lugar.hora}`
                    }).addTo(map);
                    marker.bindPopup(`<b>${repartidor.nombre}</b><br>${lugar.direccion}<br>Hora: ${lugar.hora}<br>Fecha: ${repartidor.fechaRuta}`).addTo(featuresLayerEmpresa);
                    // No agregar a `marcadores` globales si es para la capa de empresa

                    // Si hay más de un punto para este repartidor, dibujar polilínea
                    if (puntosRutaActual.length > 1) {
                        // Para simplificar, conectamos secuencialmente. OSRM sería para rutas optimizadas.
                        const polyline = L.polyline(puntosRutaActual.slice(-2), { // Conecta los dos últimos puntos
                            color: colores[colorIdx % colores.length],
                            weight: 3,
                            opacity: 0.7
                         }).addTo(featuresLayerEmpresa);
                        // No agregar a `leafletRutas` globales si es para la capa de empresa
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
  usuarios.splice(idx, 1);
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
  window._editUsuarioIdx = null;
  renderPanelUsuarios();
};
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
  const file = e.target.files[0];
  if (!file) {
    mostrarFeedback('No se seleccionó ningún archivo válido.');
    this.value = '';
    this._subiendo = false;
    return;
  }
  if (file.type === "" && file.size === 0) {
    mostrarFeedback('No se puede subir una carpeta. Selecciona un archivo válido.');
    this.value = '';
    this._subiendo = false;
    return;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  // Evitar múltiples subidas por un solo cambio
  if (this._subiendo) return;
  this._subiendo = true;
  const finalizar = () => { this.value = ''; this._subiendo = false; };
  if (["xlsx","xls","csv"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Suponiendo que la primera fila es encabezado: Usuario, Contraseña, Nombre, Zona, Dirección, Hora
      // NUEVO: Añadimos FechaRuta al formato esperado del Excel
      let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
      let usuariosExcel = JSON.parse(localStorage.getItem('usuarios') || '[]');
      for (let i = 1; i < json.length; i++) {
        const [usuario, password, nombre, zona, direccion, hora, fechaRuta = new Date().toISOString().split('T')[0]] = json[i]; // FechaRuta opcional, default hoy
        if (!nombre || !direccion || !usuario) continue;
        // Buscar si ya existe el repartidor por nombre y zona
        let repIdx = repartidores.findIndex(r => r.nombre === nombre && r.zona === zona);
        if (repIdx !== -1) {
          // Si existe, agregar la entrega a su lista (evitar duplicados exactos)
          if (!repartidores[repIdx].lugares.some(l => l.direccion === direccion && l.hora === hora)) {
            repartidores[repIdx].lugares.push({ direccion, hora });
          }
        } else {
          // Si no existe, crear nuevo repartidor
          repartidores.push({ usuario, nombre, zona, fechaRuta, lugares: [{ direccion, hora }], archivosEspecificos: [] });
        }
        // Actualizar o agregar usuario
        let userIdx = usuariosExcel.findIndex(u => u.usuario === usuario && u.nombre === nombre && u.zona === zona);
        if (userIdx !== -1) {
          usuariosExcel[userIdx].password = password;
        } else {
          usuariosExcel.push({ usuario, password, nombre, zona });
        }
      }
      localStorage.setItem('repartidores', JSON.stringify(repartidores));
      localStorage.setItem('usuarios', JSON.stringify(usuariosExcel));
      mostrarRepartidores();
      limpiarMarcadores();
      // directionsRenderer.set('directions', null); // Esto es de Google Maps, no aplica a Leaflet directamente aquí
      document.getElementById('info-ruta').innerHTML = '';
      mostrarFeedback('Rutas y usuarios actualizados correctamente desde el archivo.');
      // mostrarTodasLasRutas(repartidores); // Esta función no está definida, se reemplaza por la lógica de filtros
      finalizar();
    };
    reader.readAsArrayBuffer(file);
  } else if (["json"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          localStorage.setItem('repartidores', JSON.stringify(data));
          mostrarRepartidores();
          limpiarMarcadores();
          // directionsRenderer.set('directions', null);
          document.getElementById('info-ruta').innerHTML = '';
          mostrarFeedback('Datos de repartidores cargados correctamente desde JSON.');
          // mostrarTodasLasRutas(data);
          finalizar();
        } else {
          mostrarFeedback('El archivo JSON no tiene el formato esperado.');
          finalizar();
        }
      } catch (err) {
        mostrarFeedback('Error al leer el archivo JSON.');
        finalizar();
      }
    };
    reader.readAsText(file);
  } else if (["txt"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = function(e) {
      // Espera formato: usuario;nombre;zona;fechaRuta;direccion;hora (uno por línea)
      const lines = e.target.result.split(/\r?\n/);
      const repartidores = [];
      for (let line of lines) {
        if (!line.trim()) continue;
        const [usuario, nombre, zona, fechaRuta, direccion, hora] = line.split(';');
        if (!nombre || !direccion) continue;
        let rep = repartidores.find(r => r.nombre === nombre && r.zona === zona);
        if (!rep) {
          rep = { usuario, nombre, zona, fechaRuta: fechaRuta || new Date().toISOString().split('T')[0], lugares: [], archivosEspecificos: [] };
          repartidores.push(rep);
        }
        rep.lugares.push({ direccion, hora });
      }
      localStorage.setItem('repartidores', JSON.stringify(repartidores));
      mostrarRepartidores();
      renderPanelUsuarios(); // Actualizar lista de usuarios si se cargaron nuevos
      limpiarMarcadores();
      // directionsRenderer.set('directions', null);
      document.getElementById('info-ruta').innerHTML = '';
      mostrarFeedback('Rutas cargadas correctamente desde TXT.');
      // mostrarTodasLasRutas(repartidores);
      finalizar();
    };
    reader.readAsText(file);
  } else if (["pdf","doc","docx","png","jpg","jpeg"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target.result) {
        mostrarFeedback('Error al leer el archivo. No se pudo subir.');
        this.value = '';
        this._subiendo = false;
        return;
      }
      let archivos = JSON.parse(localStorage.getItem('archivosVisuales') || '[]');
      let destinatario = 'todos';
      // Usar el selector de destinatario si existe y es empresa
      if (usuarioActual && usuarioActual.usuario !== 'empresa') {
        destinatario = usuarioActual.usuario;
      } else if (document.getElementById('destinatarioArchivo')) {
        destinatario = document.getElementById('destinatarioArchivo').value;
      } else if (usuarioActual && usuarioActual.usuario) {
        destinatario = usuarioActual.usuario;
      }
      archivos.push({
        nombre: file.name,
        tipo: ext,
        data: e.target.result,
        fecha: new Date().toISOString(),
        destinatario: destinatario
      });
      localStorage.setItem('archivosVisuales', JSON.stringify(archivos));
      mostrarFeedback('Archivo subido correctamente. Este tipo de archivo se almacena solo para consulta visual, no actualiza los datos de repartidores.');
      window.mostrarArchivosSubidos();
      mostrarRepartidores(); // Actualiza la interfaz tras subir archivo visual
      limpiarMarcadores();   // Limpia marcadores si es necesario
      finalizar();
    };
    reader.onerror = () => {
      mostrarFeedback('Error al leer el archivo. No se pudo subir.');
      finalizar();
    };
    reader.readAsDataURL(file);
  } else {
    mostrarFeedback('Archivo subido, pero solo los formatos Excel, CSV, JSON, TXT, PDF, Word e imagen actualizan o se almacen.');
    finalizar();
  }
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

// --- FORZAR usuario EN TODOS LOS REPARTIDORES AL GUARDAR Y CARGAR ---
function normalizarRepartidores() {
  let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
  repartidores = repartidores.map(r => {
    if (!r.usuario && r.nombre) {
      // Si no tiene usuario, intentar asignar por nombre (solo si hay coincidencia en usuarios)
      let usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
      let u = usuarios.find(u => u.nombre === r.nombre);
      if (u) r.usuario = u.usuario;
    }
    if (r.usuario) r.usuario = String(r.usuario).trim().toLowerCase();
    return r;
  });
  localStorage.setItem('repartidores', JSON.stringify(repartidores));
}
// Llamar al cargar y al guardar
normalizarRepartidores();

// --- ABRIR NAVEGACIÓN EN GOOGLE MAPS ---
window.abrirNavegacionGoogleMaps = function(direccion, hora) {
  if (!direccion) return;
  // Codificar la dirección para URL
  var url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(direccion);
  window.open(url, '_blank');
};

// --- AGREGAR BOTÓN Y FUNCIÓN PARA ELIMINAR ARCHIVOS VISUALES SUBIDOS ---
window.mostrarArchivosSubidos = function() {
  const cont = document.getElementById('archivos-subidos');
  if (!cont) return;
  let archivos = JSON.parse(localStorage.getItem('archivosVisuales') || '[]');
  let usuarioFiltro = usuarioActual && usuarioActual.usuario ? String(usuarioActual.usuario).trim().toLowerCase() : null;
  // Mostrar todos los archivos en modo empresa
  if (usuarioActual && usuarioActual.usuario === 'empresa') {
    // No filtrar, mostrar todos
  } else if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    archivos = archivos.filter(a => a.destinatario === usuarioFiltro || a.destinatario === 'todos');
  }
  if (!archivos.length) {
    cont.innerHTML = '<p style="color:#888;">No hay archivos subidos.</p>';
    return;
  }
  cont.innerHTML = archivos.map((a, idx) => {
    let btnBorrar = `<button onclick="borrarArchivoVisual(${idx})" style='display:block;margin:6px auto 0 auto;padding:2px 10px;background:#e53935;color:#fff;border:none;border-radius:4px;cursor:pointer;'>Eliminar</button>`;
    if (["png","jpg","jpeg"].includes(a.tipo)) {
      return `<div style='text-align:center;'><img src='${a.data}' alt='${a.nombre}' style='max-width:120px;max-height:120px;border-radius:8px;box-shadow:0 1px 6px #0002;'><br><small>${a.nombre}</small>${btnBorrar}</div>`;
    } else if (["pdf"].includes(a.tipo)) {
      return `<div style='text-align:center;'><a href='${a.data}' target='_blank' style='color:#1976d2;text-decoration:underline;'>${a.nombre}</a><br><small>PDF</small>${btnBorrar}</div>`;
    } else {
      return `<div style='text-align:center;'><a href='${a.data}' download='${a.nombre}' style='color:#1976d2;text-decoration:underline;'>${a.nombre}</a><br><small>${a.tipo.toUpperCase()}</small>${btnBorrar}</div>`;
    }
  }).join('');
};

window.borrarArchivoVisual = function(idx) {
  let archivos = JSON.parse(localStorage.getItem('archivosVisuales') || '[]');
  // Filtrar archivos según el usuario actual (empresa puede borrar todos, repartidor solo los suyos)
  if (usuarioActual && usuarioActual.usuario !== 'empresa') {
    let usuarioFiltro = String(usuarioActual.usuario).trim().toLowerCase();
    let archivosFiltrados = archivos.filter(a => a.destinatario === usuarioFiltro || a.destinatario === 'todos');
    let archivoAEliminar = archivosFiltrados[idx];
    // Buscar el índice real en el array original
    let realIdx = archivos.findIndex(a => a === archivoAEliminar);
    if (realIdx !== -1) archivos.splice(realIdx, 1);
  } else {
    archivos.splice(idx, 1);
  }
  localStorage.setItem('archivosVisuales', JSON.stringify(archivos));
  window.mostrarArchivosSubidos();
  mostrarFeedback('Archivo eliminado.');
};

// --- PROCESAR LOGIN DE REPARTIDOR (asegura guardar usuarioActual y mostrar rutas) ---
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
        usuarioActual = user;
        localStorage.setItem('usuarioActual', JSON.stringify(user));
        // Limpiar la vista antes de mostrar rutas
        document.querySelectorAll('.solo-empresa').forEach(el => el.style.display = 'none');
        const header = document.getElementById('header-principal');
        if (header) header.style.display = 'none';
        const tituloAdmin = document.getElementById('titulo-admin-panel');
        if (tituloAdmin) tituloAdmin.style.display = 'none';
        const footer = document.querySelector('footer');
        if (footer) footer.style.display = 'none';
        const lista = document.getElementById('lista-repartidores');
        if (lista) lista.innerHTML = '';
        const archivos = document.getElementById('archivos-subidos');
        if (archivos) archivos.innerHTML = '';
        const areaArchivos = document.getElementById('area-subida-archivos');
        if (areaArchivos) areaArchivos.style.display = 'none';
        const adminUsuarios = document.getElementById('admin-usuarios');
        if (adminUsuarios) adminUsuarios.style.display = 'none';
        // Forzar scroll al top
        window.scrollTo({ top: 0, behavior: 'auto' });
        // Mostrar solo lo de repartidor
        mostrarMapaTrasLoginRepartidor();
        setTimeout(() => { ajustarPanelesPorUsuario(); mostrarRepartidores(); }, 100);
        mostrarFeedback('¡Bienvenido, ' + user.nombre + '!');
      } else {
        mostrarFeedback('Usuario o contraseña incorrectos.');
      }
    });
  }
  ajustarPanelesPorUsuario();
  // Generar opciones de destinatario en el selector solo si es empresa
  if (usuarioActual && usuarioActual.usuario === 'empresa') {
    const selectDest = document.getElementById('destinatarioArchivo');
    if (selectDest) {
      // Limpiar opciones actuales
      selectDest.innerHTML = '<option value="todos">Todos los repartidores</option>';
      let usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
      usuarios.filter(u => u.usuario !== 'empresa').forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.usuario;
        opt.textContent = u.nombre + ' (' + u.usuario + ')';
        selectDest.appendChild(opt);
      });
    }

    // NUEVO: Lógica para los filtros del mapa de empresa
    const btnAplicarFiltros = document.getElementById('btn-aplicar-filtros-mapa');
    const btnMostrarTodas = document.getElementById('btn-mostrar-todas-rutas-mapa');
    const filtroFechaInput = document.getElementById('filtro-fecha-ruta');
    const filtroUsuarioSelect = document.getElementById('filtro-usuario-ruta');

    // Poblar select de usuarios para el filtro
    let usuariosParaFiltro = JSON.parse(localStorage.getItem('usuarios') || '[]');
    usuariosParaFiltro.filter(u => u.usuario !== 'empresa').forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.usuario;
        opt.textContent = u.nombre + ' (' + u.usuario + ')';
        filtroUsuarioSelect.appendChild(opt);
    });

    if (btnAplicarFiltros) {
        btnAplicarFiltros.addEventListener('click', () => {
            const fechaFiltro = filtroFechaInput.value;
            const usuarioFiltro = filtroUsuarioSelect.value;
            let repartidores = JSON.parse(localStorage.getItem('repartidores') || '[]');
            const filtrados = repartidores.filter(r => 
                ( (!fechaFiltro || r.fechaRuta === fechaFiltro) && 
                  (usuarioFiltro === 'todos' || r.usuario === usuarioFiltro) ));
            actualizarVistaMapaEmpresa(filtrados);
        });
    }
    if (btnMostrarTodas) {
        btnMostrarTodas.addEventListener('click', () => actualizarVistaMapaEmpresa(JSON.parse(localStorage.getItem('repartidores') || '[]')));
    }
  }
});

// Quitar logo y título de admin solo en modo repartidor (móvil/tablet) al cargar la página
function ocultarLogoYTituloRepartidor() {
  var esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 900;
  var header = document.getElementById('header-principal');
  var indicador = document.getElementById('indicador-modo-dispositivo');
  if (esMovil) {
    var logo = document.querySelector('img[alt="Logo empresa"]');
    if (logo) logo.style.display = 'none';
    var titulo = document.getElementById('titulo-admin-panel');
    if (titulo) titulo.style.display = 'none';
    // Ajustar margen superior del header para que el botón de contacto no quede oculto
    if (header && indicador) {
      var altoIndicador = indicador.offsetHeight || 40;
      header.style.marginTop = altoIndicador + 8 + 'px';
    }
  } else {
    var logo = document.querySelector('img[alt="Logo empresa"]');
    if (logo) logo.style.display = 'block';
    var titulo = document.getElementById('titulo-admin-panel');
    if (titulo) titulo.style.display = 'block';
    if (header) header.style.marginTop = '';
  }
}

document.addEventListener('DOMContentLoaded', ocultarLogoYTituloRepartidor);
window.addEventListener('resize', ocultarLogoYTituloRepartidor);

// --- SINCRONIZACIÓN AUTOMÁTICA ENTRE PESTAÑAS (EMPRESA/REPARTIDOR) ---
window.addEventListener('storage', function(e) {
  if (e.key === 'repartidores') {
    mostrarRepartidores();
    limpiarMarcadores();
  }
});

// Asegúrate de que este script se ejecute después de que el DOM esté cargado
// y después de que el div 'mapaRutas' exista.
document.addEventListener('DOMContentLoaded', function () {

  //   // 1. Inicializar el mapa
  //   // Reemplaza LATITUD_INICIAL, LONGITUD_INICIAL y ZOOM_INICIAL con valores adecuados
  //   // para centrar el mapa inicialmente (ej. tu ciudad/país)
  //   const LATITUD_INICIAL = 40.416775; // Ejemplo: Madrid
  //   const LONGITUD_INICIAL = -3.703790; // Ejemplo: Madrid
  //   const ZOOM_INICIAL = 6;

  // // Usar el ID 'map' del div HTML. Esta variable 'map' es local a este DOMContentLoaded.
  //   // Esto solo se ejecutará si el script llega hasta aquí y el DOM está listo.
  //   const map = L.map('map').setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);

  //   // Añade una capa de teselas (el fondo del mapa)
  //   // OpenStreetMap es una opción gratuita y popular.
  //   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  //       attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  //   }).addTo(map);

  //   // Capa para gestionar las polilíneas de las rutas y marcadores
  //   // Esto facilita limpiar las rutas anteriores antes de dibujar nuevas
  //   let featuresLayer = L.layerGroup().addTo(map);

  //  async function cargarYDibujarRutas(usuarioId, fecha) {
  //   featuresLayer.clearLayers();

  //   if (!usuarioId || !fecha) {
  //       console.log("Por favor, selecciona un usuario y una fecha para mostrar las rutas.");
  //       map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
  //       return;
  //   }

  //   try {
  //       const apiUrl = `/api/empresa/rutas?usuarioId=${encodeURIComponent(usuarioId)}&fecha=${encodeURIComponent(fecha)}`;
  //       const response = await fetch(apiUrl);

  //       if (!response.ok) {
  //           throw new Error(`Error al obtener las rutas: ${response.status} ${response.statusText}`);
  //       }

  //       const data = await response.json();

  //       if (data.rutas && data.rutas.length > 0) {
  //           const todasLasCoordenadasParaAjuste = [];

  //           data.rutas.forEach(ruta => {
  //               if (ruta.puntos && ruta.puntos.length > 1) {
  //                   const latLngs = ruta.puntos.map(punto => [punto[0], punto[1]]);
  //                   const polyline = L.polyline(latLngs, { color: 'blue', weight: 3 }).addTo(featuresLayer);

  //                   if (latLngs.length > 0) {
  //                       L.marker(latLngs[0])
  //                           .addTo(featuresLayer)
  //                           .bindPopup(`Inicio Ruta Repartidor: ${ruta.repartidorId || usuarioId}<br>Fecha: ${fecha}`);
  //                       L.marker(latLngs[latLngs.length - 1])
  //                           .addTo(featuresLayer)
  //                           .bindPopup(`Fin Ruta Repartidor: ${ruta.repartidorId || usuarioId}<br>Fecha: ${fecha}`);
  //                   }

  //                   latLngs.forEach(coord => todasLasCoordenadasParaAjuste.push(coord));
  //               }
  //           });

  //           if (todasLasCoordenadasParaAjuste.length > 0) {
  //               map.fitBounds(todasLasCoordenadasParaAjuste, { padding: [50, 50] });
  //           } else {
  //               map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
  //           }

  //       } else {
  //           console.log("No se encontraron rutas para los filtros seleccionados.");
  //           map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
  //       }

 // Esta lógica es específica para la vista de EMPRESA y su mapa.
    const esModoEmpresa = (usuarioActual && usuarioActual.usuario === 'empresa');

    if (esModoEmpresa) {
        const LATITUD_INICIAL = 40.416775; // Ejemplo: Madrid
        const LONGITUD_INICIAL = -3.703790; // Ejemplo: Madrid
        const ZOOM_INICIAL = 6;

        // Inicializa el mapa global `map` si aún no lo está.
        // En modo empresa, initMap() no se llama, por lo que `map` estaría indefinido.
        if (!map) { 
            map = L.map('map').setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
        } else {
            // Si el mapa ya existe (poco probable en modo empresa si initMap está condicionado),
            // simplemente ajusta la vista.
            map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
        }


//     } catch (error) {
//         console.error("Error al cargar o dibujar las rutas:", error);
//         alert(`Hubo un error al cargar las rutas: ${error.message}`);
//         map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
//     }
// }
// Inicializa o limpia la capa de features global para la empresa.
        if (featuresLayerEmpresa) {
            featuresLayerEmpresa.clearLayers();
        } else {
            featuresLayerEmpresa = L.layerGroup().addTo(map);
        }

        async function cargarYDibujarRutas(usuarioId, fecha) {
            if (!featuresLayerEmpresa) {
                console.error("featuresLayerEmpresa no está inicializada.");
                return;
            }
            featuresLayerEmpresa.clearLayers();

            if (!usuarioId || !fecha) {
                console.log("Por favor, selecciona un usuario y una fecha para mostrar las rutas.");
                if (map) map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
                return;
            }

            try {
                const apiUrl = `/api/empresa/rutas?usuarioId=${encodeURIComponent(usuarioId)}&fecha=${encodeURIComponent(fecha)}`;
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    // No lanzar error aquí permite que el código continúe y muestre el mensaje de alerta.
                    // El error ya se loguea en la consola.
                    console.error(`Error al obtener las rutas desde API: ${response.status} ${response.statusText}`);
                    alert(`No se pudo conectar con el servidor para obtener las rutas (Error: ${response.status}). Verifica que el backend esté funcionando.`);
                    if (map) map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
                    return; // Importante: salir aquí si la API falla y no hay fallback.
                }

                const data = await response.json();

                if (data.rutas && data.rutas.length > 0) {
                    const todasLasCoordenadasParaAjuste = [];

                    data.rutas.forEach(ruta => {
                        if (ruta.puntos && ruta.puntos.length > 1) {
                            const latLngs = ruta.puntos.map(punto => [punto[0], punto[1]]);
                            const polyline = L.polyline(latLngs, { color: 'blue', weight: 3 }).addTo(featuresLayerEmpresa);

                            if (latLngs.length > 0) {
                                L.marker(latLngs[0])
                                    .addTo(featuresLayerEmpresa)
                                    .bindPopup(`Inicio Ruta Repartidor: ${ruta.repartidorId || usuarioId}<br>Fecha: ${fecha}`);
                                L.marker(latLngs[latLngs.length - 1])
                                    .addTo(featuresLayerEmpresa)
                                    .bindPopup(`Fin Ruta Repartidor: ${ruta.repartidorId || usuarioId}<br>Fecha: ${fecha}`);
                            }
                            latLngs.forEach(coord => todasLasCoordenadasParaAjuste.push(coord));
                        }
                    });

                    if (todasLasCoordenadasParaAjuste.length > 0) {
                        if (map) map.fitBounds(todasLasCoordenadasParaAjuste, { padding: [50, 50] });
                    } else {
                        if (map) map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
                    }
                } else {
                    console.log("No se encontraron rutas para los filtros seleccionados desde la API.");
                    if (map) map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
                }
            } catch (error) { // Captura errores de red o de parseo de JSON
                console.error("Error al cargar o dibujar las rutas (catch):", error);
                alert(`Hubo un error al procesar la solicitud de rutas: ${error.message}. Revisa la consola para más detalles.`);
                if (map) map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
            }
        }
    // 3. Escuchar cambios en los filtros
    // Asegúrate de que los IDs 'filtroUsuario' y 'filtroFecha' coincidan con tu HTML
   const filtroUsuarioEl = document.getElementById('filtro-usuario-ruta'); // ID CORREGIDO
    const filtroFechaEl = document.getElementById('filtro-fecha-ruta');     // ID CORREGIDO

    function actualizarMapaConFiltros() {
        const usuarioSeleccionado = filtroUsuarioEl ? filtroUsuarioEl.value : null;
        const fechaSeleccionada = filtroFechaEl ? filtroFechaEl.value : null;
        
        // Solo cargar si ambos filtros tienen valor
        if (usuarioSeleccionado && fechaSeleccionada) {
            cargarYDibujarRutas(usuarioSeleccionado, fechaSeleccionada);
        } else {
            // Si falta algún filtro, limpiar el mapa y quizás mostrar un mensaje
           if (featuresLayerEmpresa) {
                featuresLayerEmpresa.clearLayers();
            }
            if (map) map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
            console.log("Selecciona un usuario y una fecha.");
        }
    }

    if (filtroUsuarioEl) {
        filtroUsuarioEl.addEventListener('change', actualizarMapaConFiltros);
    }
    if (filtroFechaEl) {
        filtroFechaEl.addEventListener('change', actualizarMapaConFiltros);
    }

    // Opcional: Carga inicial si los filtros ya tienen valores al cargar la página
    // Por ejemplo, si los filtros guardan su estado o tienen valores por defecto:
    // actualizarMapaConFiltros();
    // O simplemente muestra el mapa base sin rutas:
    // map.setView([LATITUD_INICIAL, LONGITUD_INICIAL], ZOOM_INICIAL);
    // Para este ejemplo, no se cargarán rutas hasta que se interactúe con los filtros.
   } // Cierre de if (esModoEmpresa)
});
