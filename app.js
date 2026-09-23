// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE (SEGURIDAD)
// ==========================================
// REEMPLAZA LOS VALORES CON TUS LLAVES DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDHoRCZZ25LR06O06IF8OwMh-q_az15lkQ",
  authDomain: "foliar-7358a.firebaseapp.com",
  projectId: "foliar-7358a",
  storageBucket: "foliar-7358a.firebasestorage.app",
  messagingSenderId: "663236664000",
  appId: "1:663236664000:web:5348752418a6a8dff42b25",
  measurementId: "G-E4GQKV7WD7"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// 1.5 CONFIGURACIÓN DE CLOUDINARY (DISCO DURO)
// ==========================================
// REEMPLAZA EL VALOR CON TU CLOUD NAME
const CLOUDINARY_CLOUD_NAME = "bnhuypdl"; 
const CLOUDINARY_PRESET = "foliar_drive";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

// ==========================================
// 2. LÓGICA DE USUARIOS Y RESPALDO EN LA NUBE
// ==========================================
let usuarioActual = null;

auth.onAuthStateChanged(user => {
  const btnLogin = document.getElementById('btn-login');
  const infoUsuario = document.getElementById('info-usuario');
  const nombreUsuario = document.getElementById('nombre-usuario');

  if (user) {
    usuarioActual = user;
    btnLogin.style.display = 'none';
    infoUsuario.style.display = 'flex';
    nombreUsuario.textContent = `Hola, ${user.displayName.split(' ')[0]}`;
  } else {
    usuarioActual = null;
    btnLogin.style.display = 'inline-block';
    infoUsuario.style.display = 'none';
  }
});

document.getElementById('btn-login').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(error => {
    console.error("Error al iniciar sesión:", error);
    alert("No se pudo iniciar sesión con Google.");
  });
});

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut();
});

// Función para guardar en la nube automáticamente
async function respaldarEnFoliarDrive(blob, nombreArchivo, herramienta) {
    if (!usuarioActual) return;
    
    try {
        const formData = new FormData();
        formData.append("file", blob);
        formData.append("upload_preset", CLOUDINARY_PRESET);
        
        const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
        const data = await res.json();
        
        if (!data.secure_url) throw new Error("Fallo al obtener enlace seguro");

        await db.collection("usuarios").doc(usuarioActual.uid).collection("archivos").add({
            nombre: nombreArchivo,
            herramienta: herramienta,
            url: data.secure_url,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log("Archivo respaldado en Foliar Drive exitosamente.");
    } catch (error) {
        console.error("Error en respaldo en la nube:", error);
    }
}

// ==========================================
// ESCUCHA EN TIEMPO REAL DEL HISTORIAL
// ==========================================
let oyenteHistorial = null; // Variable para controlar la conexión en vivo

document.getElementById('btn-historial').addEventListener('click', () => {
    if (!usuarioActual) return;
    const modal = document.getElementById('modal-drive');
    const lista = document.getElementById('lista-archivos');
    modal.style.display = 'flex';
    lista.innerHTML = '<p style="text-align: center; color: var(--texto-secundario);"><i class="fa-solid fa-spinner fa-spin"></i> Sincronizando en vivo...</p>';
    
    // Si ya estábamos escuchando, cancelamos la conexión vieja
    if (oyenteHistorial) oyenteHistorial(); 
    
    // onSnapshot: Mantiene una conexión ABIERTA. Si un archivo llega, la lista se actualiza sola al instante.
    oyenteHistorial = db.collection("usuarios")
      .doc(usuarioActual.uid)
      .collection("archivos")
      .orderBy("fecha", "desc")
      .onSnapshot((snapshot) => {
        if (snapshot.empty) {
            lista.innerHTML = '<p style="text-align: center; color: var(--texto-secundario);">Tu disco está vacío. ¡Procesa tu primer PDF!</p>';
            return;
        }
        
        lista.innerHTML = ''; // Limpiamos la lista para dibujar la nueva versión
        snapshot.forEach(doc => {
            const archivo = doc.data();
            const fecha = archivo.fecha ? archivo.fecha.toDate().toLocaleDateString() : 'Reciente';
            
            // Inyectamos el nombre para que Cloudinary no se confunda (La corrección que hicimos antes)
            const nombreSinExtension = archivo.nombre.replace(/\.[^/.]+$/, "");
            const urlDescarga = archivo.url.replace('/upload/', '/upload/fl_attachment:' + encodeURIComponent(nombreSinExtension) + '/');
            
            lista.innerHTML += `
                <div style="background: var(--bg-principal); padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--borde); margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0; color: var(--texto-principal); font-size: 1rem;">${archivo.nombre}</h4>
                        <p style="margin: 5px 0 0; font-size: 0.85rem; color: var(--texto-secundario);">
                            <span style="background: var(--color-foco); color: white; padding: 2px 8px; border-radius: 10px; margin-right: 10px;">${archivo.herramienta}</span> 
                            ${fecha}
                        </p>
                    </div>
                    <a href="${urlDescarga}" class="btn-secundario" style="margin: 0; text-decoration: none;"><i class="fa-solid fa-download"></i> Descargar</a>
                </div>
            `;
        });
    }, (error) => {
        lista.innerHTML = '<p style="text-align: center; color: var(--color-ilovepdf);">Aún no tienes los permisos configurados en Firebase.</p>';
        console.error("Error en tiempo real:", error);
    });
});
    
    try {
        const snapshot = await db.collection("usuarios").doc(usuarioActual.uid).collection("archivos").orderBy("fecha", "desc").get();
        if (snapshot.empty) {
            lista.innerHTML = '<p style="text-align: center; color: var(--texto-secundario);">Tu disco está vacío. ¡Procesa tu primer PDF!</p>';
            return;
        }
        
        lista.innerHTML = '';
        snapshot.forEach(doc => {
            const archivo = doc.data();
            const fecha = archivo.fecha ? archivo.fecha.toDate().toLocaleDateString() : 'Reciente';
            
           // Corregido: Le quitamos la extensión al nombre para que Cloudinary no se confunda
            const nombreSinExtension = archivo.nombre.replace(/\.[^/.]+$/, "");
            const urlDescarga = archivo.url.replace('/upload/', '/upload/fl_attachment:' + encodeURIComponent(nombreSinExtension) + '/');
            
            lista.innerHTML += `
                <div style="background: var(--bg-principal); padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--borde);">
                    <div>
                        <h4 style="margin: 0; color: var(--texto-principal); font-size: 1rem;">${archivo.nombre}</h4>
                        <p style="margin: 5px 0 0; font-size: 0.85rem; color: var(--texto-secundario);">
                            <span style="background: var(--color-foco); color: white; padding: 2px 8px; border-radius: 10px; margin-right: 10px;">${archivo.herramienta}</span> 
                            ${fecha}
                        </p>
                    </div>
                    <a href="${urlDescarga}" class="btn-secundario" style="margin: 0; text-decoration: none;"><i class="fa-solid fa-download"></i> Descargar</a>
                </div>
            `;
        });
    } catch (error) {
        lista.innerHTML = '<p style="text-align: center; color: var(--color-ilovepdf);">Aún no tienes los permisos configurados en la base de datos de Firebase.</p>';
        console.error(error);
    }
});


// ==========================================
// 3. MÓDULO DE SEGURIDAD Y VALIDACIÓN
// ==========================================
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAX_FILE_SIZE = 150 * 1024 * 1024; 

function validarArchivoSeguro(archivo, mimePermitidos) {
    if (!archivo) throw new Error("No se ha seleccionado ningún archivo.");
    if (!mimePermitidos.includes(archivo.type)) {
        throw new Error(`Por seguridad, solo se permiten archivos de tipo: ${mimePermitidos.join(', ')}.`);
    }
    if (archivo.size > MAX_FILE_SIZE) {
        throw new Error("El archivo excede el tamaño máximo seguro permitido (150 MB).");
    }
    return true;
}

function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function limpiarRangoPaginas(texto) {
    return texto.replace(/[^0-9,\-]/g, '');
}

function manejarErrorControlado(e, botonId, textoBotonOriginal) {
    console.warn("Seguridad/Error controlado:", e.message || "Fallo en operación de memoria");
    alert(e.message || 'Error de procesamiento. Verifica que el documento no esté corrupto o encriptado.');
    if (botonId) {
        const btn = document.getElementById(botonId);
        btn.disabled = false;
        btn.innerHTML = textoBotonOriginal;
    }
}

// ---------- Navegación del Menú (SPA) ----------
function abrirHerramienta(idHerramienta) {
  document.getElementById('menu-principal').style.display = 'none';
  document.getElementById('espacio-trabajo').style.display = 'block';
  document.querySelectorAll('.tarjeta-herramienta').forEach(seccion => seccion.style.display = 'none');
  document.getElementById('herr-' + idHerramienta).style.display = 'block';
  window.scrollTo(0, 0);
}

function volverAlMenu() {
  document.getElementById('espacio-trabajo').style.display = 'none';
  document.getElementById('menu-principal').style.display = 'grid';
  document.querySelectorAll('.btn-gigante').forEach(label => {
    if(label.getAttribute('for') === 'archivosImagen') label.textContent = 'Elegir imágenes';
    else if(label.getAttribute('for') === 'archivosUnir') label.textContent = 'Elegir archivos PDF';
    else if(label.getAttribute('for') === 'archivoWord2Pdf') label.textContent = 'Elegir archivo Word';
    else label.textContent = 'Elegir archivo PDF';
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll('input[type="file"]').forEach(input => {
  input.addEventListener('change', function() {
    const label = this.previousElementSibling;
    if (label && label.classList.contains('btn-gigante')) {
      if (this.files && this.files.length > 1) label.textContent = this.files.length + ' archivos listos';
      else if (this.files && this.files.length === 1) label.textContent = escaparHTML(this.files[0].name);
      else label.textContent = 'Elegir archivo/s';
    }
  });
});

// ---------- Funciones compartidas ----------
function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = escaparHTML(nombre);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000); 
}

function descargar(bytes, nombre) {
  descargarBlob(new Blob([bytes], { type: 'application/pdf' }), nombre);
}

function parseRangos(texto, totalPaginas) {
  const indices = [];
  const textoLimpio = limpiarRangoPaginas(texto);
  textoLimpio.split(',').filter(Boolean).forEach(parte => {
    if (parte.includes('-')) {
      const [inicio, fin] = parte.split('-').map(n => parseInt(n, 10));
      if (!isNaN(inicio) && !isNaN(fin)) {
        for (let i = inicio; i <= fin; i++) indices.push(i - 1);
      }
    } else {
      if (!isNaN(parseInt(parte, 10))) indices.push(parseInt(parte, 10) - 1);
    }
  });
  return indices.filter(i => i >= 0 && i < totalPaginas);
}

function generarNombre(nombreOriginal, sufijo, extension = '.pdf') {
  const nombreSinExtension = nombreOriginal.replace(/\.[^/.]+$/, "");
  return `${nombreSinExtension}_${sufijo}${extension}`;
}

// ==========================================
// 4. LÓGICA DE HERRAMIENTAS
// ==========================================

// ---------- 1. Unir PDF (Respaldo en Nube Activado) ----------
document.getElementById('botonUnir').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivosUnir').files;
    if (files.length < 2) throw new Error('Elige al menos 2 archivos PDF.');
    for (const f of files) validarArchivoSeguro(f, ['application/pdf']);

    const pdfFinal = await PDFLib.PDFDocument.create();
    for (const archivo of files) {
      const bytes = await archivo.arrayBuffer();
      const pdfOrigen = await PDFLib.PDFDocument.load(bytes);
      const paginas = await pdfFinal.copyPages(pdfOrigen, pdfOrigen.getPageIndices());
      paginas.forEach(pagina => pdfFinal.addPage(pagina));
    }
    
    // Generar archivo final y nombre
    const bytesFinales = await pdfFinal.save();
    const nombreDescarga = generarNombre(files[0].name, 'unido');
    
    // Descargar en el navegador
    descargar(bytesFinales, nombreDescarga);
    
    // Respaldo automático en la nube (Foliar Drive)
    const blobFinal = new Blob([bytesFinales], { type: 'application/pdf' });
    respaldarEnFoliarDrive(blobFinal, nombreDescarga, "Unir PDF");
    
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 2. Dividir / Extraer páginas ----------
document.getElementById('botonDividir').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoDividir').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    
    const textoRaw = document.getElementById('rangoDividir').value;
    if (!textoRaw.trim()) throw new Error('Escribe al menos un número de página válido.');
    
    const comoZip = document.getElementById('zipDividir').checked;
    const bytes = await files[0].arrayBuffer();
    const pdfOrigen = await PDFLib.PDFDocument.load(bytes);
    
    const indices = parseRangos(textoRaw, pdfOrigen.getPageCount());
    if (!indices.length) throw new Error('El rango de páginas introducido no es válido o está fuera de límites.');

    if (comoZip) {
      const zip = new JSZip();
      for (const indice of indices) {
        const pdfPagina = await PDFLib.PDFDocument.create();
        const [pagina] = await pdfPagina.copyPages(pdfOrigen, [indice]);
        pdfPagina.addPage(pagina);
        zip.file(`pagina-${indice + 1}.pdf`, await pdfPagina.save());
      }
      descargarBlob(await zip.generateAsync({ type: 'blob' }), generarNombre(files[0].name, 'paginas', '.zip'));
    } else {
      const pdfFinal = await PDFLib.PDFDocument.create();
      const paginas = await pdfFinal.copyPages(pdfOrigen, indices);
      paginas.forEach(p => pdfFinal.addPage(p));
      
      const bytesFinales = await pdfFinal.save();
      const nombreDescarga = generarNombre(files[0].name, 'extraido');
      descargar(bytesFinales, nombreDescarga);
      respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Dividir PDF");
    }
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 3. Eliminar páginas (Visual) ----------
let paginasParaEliminar = new Set();
let archivoActualEliminar = null; 
let totalPaginasEliminar = 0;

document.getElementById('archivoEliminar').addEventListener('change', async (e) => {
  const contenedorPrevia = document.getElementById('vistaPreviaEliminar');
  const botonEliminar = document.getElementById('botonEliminar');
  paginasParaEliminar.clear();
  botonEliminar.style.display = 'none';
  
  try {
    if (!e.target.files.length) return;
    validarArchivoSeguro(e.target.files[0], ['application/pdf']);
    
    contenedorPrevia.innerHTML = '<p style="color:var(--texto-secundario);">Cargando visualización segura...</p>';
    archivoActualEliminar = e.target.files[0];
    const bytes = await archivoActualEliminar.arrayBuffer();
    const pdfLectura = await pdfjsLib.getDocument({ data: bytes }).promise;
    totalPaginasEliminar = pdfLectura.numPages;
    contenedorPrevia.innerHTML = ''; 
    
    for (let n = 1; n <= totalPaginasEliminar; n++) {
      const pagina = await pdfLectura.getPage(n);
      const viewport = pagina.getViewport({ scale: 0.8 }); 
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      
      const divContenedor = document.createElement('div');
      divContenedor.className = 'miniatura-contenedor';
      divContenedor.style.cursor = 'pointer';
      
      const divNumero = document.createElement('div');
      divNumero.className = 'numero-pagina';
      divNumero.textContent = `Página ${n}`;
      
      divContenedor.appendChild(canvas);
      divContenedor.appendChild(divNumero);
      
      divContenedor.addEventListener('click', () => {
        const indice = n - 1; 
        if (paginasParaEliminar.has(indice)) {
          paginasParaEliminar.delete(indice);
          divContenedor.classList.remove('para-eliminar');
        } else {
          paginasParaEliminar.add(indice);
          divContenedor.classList.add('para-eliminar');
        }
      });
      contenedorPrevia.appendChild(divContenedor);
    }
    botonEliminar.style.display = 'block';
  } catch (e) { contenedorPrevia.innerHTML = '<p style="color:var(--color-ilovepdf);">Error de lectura de archivo</p>'; manejarErrorControlado(e); }
});

document.getElementById('botonEliminar').addEventListener('click', async () => {
  try {
    if (!archivoActualEliminar) return;
    if (paginasParaEliminar.size === 0) throw new Error('Marca al menos una página.');
    if (paginasParaEliminar.size >= totalPaginasEliminar) throw new Error('Protección: No puedes eliminar todo el contenido del PDF.');

    const bytes = await archivoActualEliminar.arrayBuffer();
    const pdfOrigen = await PDFLib.PDFDocument.load(bytes);
    const indicesAConservar = pdfOrigen.getPageIndices().filter(i => !paginasParaEliminar.has(i));
    
    const pdfFinal = await PDFLib.PDFDocument.create();
    const paginas = await pdfFinal.copyPages(pdfOrigen, indicesAConservar);
    paginas.forEach(p => pdfFinal.addPage(p));
    
    const bytesFinales = await pdfFinal.save();
    const nombreDescarga = generarNombre(archivoActualEliminar.name, 'limpio');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Eliminar Páginas");
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 4. Ordenar páginas (Visual) ----------
let ordenPaginasArray = [];
let archivoActualOrdenar = null; 

document.getElementById('archivoOrdenar').addEventListener('change', async (e) => {
  const contenedorPrevia = document.getElementById('vistaPreviaOrdenar');
  const botonOrdenar = document.getElementById('botonOrdenar');
  const instruccion = document.getElementById('instruccionOrdenar');
  botonOrdenar.style.display = 'none'; instruccion.style.display = 'none';
  ordenPaginasArray = [];
  
  try {
    if (!e.target.files.length) return;
    validarArchivoSeguro(e.target.files[0], ['application/pdf']);
    
    contenedorPrevia.innerHTML = '<p style="color:var(--texto-secundario);">Cargando entorno seguro...</p>';
    archivoActualOrdenar = e.target.files[0];
    const bytes = await archivoActualOrdenar.arrayBuffer();
    const pdfLectura = await pdfjsLib.getDocument({ data: bytes }).promise;
    contenedorPrevia.innerHTML = ''; 
    
    for (let n = 1; n <= pdfLectura.numPages; n++) {
      ordenPaginasArray.push(n - 1); 
      const pagina = await pdfLectura.getPage(n);
      const viewport = pagina.getViewport({ scale: 0.8 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      
      const divContenedor = document.createElement('div');
      divContenedor.className = 'miniatura-contenedor';
      divContenedor.draggable = true; 
      divContenedor.dataset.indiceOriginal = n - 1; 
      
      const divNumero = document.createElement('div');
      divNumero.className = 'numero-pagina';
      divNumero.textContent = `Página ${n}`; 
      
      divContenedor.appendChild(canvas);
      divContenedor.appendChild(divNumero);
      
      divContenedor.addEventListener('dragstart', () => divContenedor.classList.add('arrastrando'));
      divContenedor.addEventListener('dragend', () => {
        divContenedor.classList.remove('arrastrando');
        const elementos = contenedorPrevia.querySelectorAll('.miniatura-contenedor');
        ordenPaginasArray = Array.from(elementos).map(el => parseInt(el.dataset.indiceOriginal));
      });
      
      divContenedor.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        const arrastrado = document.querySelector('.arrastrando');
        if (arrastrado !== divContenedor) {
          const rect = divContenedor.getBoundingClientRect();
          if (ev.clientX > (rect.left + rect.width / 2)) divContenedor.after(arrastrado);
          else divContenedor.before(arrastrado);
        }
      });
      contenedorPrevia.appendChild(divContenedor);
    }
    botonOrdenar.style.display = 'block'; instruccion.style.display = 'block';
  } catch (e) { contenedorPrevia.innerHTML = '<p style="color:var(--color-ilovepdf);">Error al cargar PDF</p>'; manejarErrorControlado(e); }
});

document.getElementById('botonOrdenar').addEventListener('click', async () => {
  try {
    if (!archivoActualOrdenar || !ordenPaginasArray.length) throw new Error('Sube un archivo primero.');
    const bytes = await archivoActualOrdenar.arrayBuffer();
    const pdfOrigen = await PDFLib.PDFDocument.load(bytes);
    const pdfFinal = await PDFLib.PDFDocument.create();
    const paginas = await pdfFinal.copyPages(pdfOrigen, ordenPaginasArray);
    paginas.forEach(p => pdfFinal.addPage(p));
    
    const bytesFinales = await pdfFinal.save();
    const nombreDescarga = generarNombre(archivoActualOrdenar.name, 'reordenado');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Ordenar PDF");
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 5. Comprimir PDF ----------
document.getElementById('calidadComprimir').addEventListener('input', e => document.getElementById('valorCalidad').textContent = e.target.value);
document.getElementById('botonComprimir').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoComprimir').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    let calidad = parseInt(document.getElementById('calidadComprimir').value, 10);
    if(isNaN(calidad) || calidad < 1 || calidad > 100) calidad = 70;
    calidad = calidad / 100;

    const bytes = await files[0].arrayBuffer();
    const pdfLectura = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pdfFinal = await PDFLib.PDFDocument.create();

    for (let n = 1; n <= pdfLectura.numPages; n++) {
      const pagina = await pdfLectura.getPage(n);
      const viewport = pagina.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', calidad);
      const bytesJpg = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
      const imagen = await pdfFinal.embedJpg(bytesJpg);
      const paginaFinal = pdfFinal.addPage([viewport.width, viewport.height]);
      paginaFinal.drawImage(imagen, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }
    
    const bytesFinales = await pdfFinal.save();
    const nombreDescarga = generarNombre(files[0].name, 'comprimido');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Comprimir PDF");
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 6. JPG/PNG a PDF ----------
document.getElementById('botonImagen').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivosImagen').files;
    if (files.length < 1) throw new Error('Selecciona al menos una imagen.');
    const pdf = await PDFLib.PDFDocument.create();
    for (const archivo of files) {
      validarArchivoSeguro(archivo, ['image/png', 'image/jpeg']);
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const esPng = archivo.type === 'image/png';
      const imagen = esPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const pagina = pdf.addPage([imagen.width, imagen.height]);
      pagina.drawImage(imagen, { x: 0, y: 0, width: imagen.width, height: imagen.height });
    }
    
    const bytesFinales = await pdf.save();
    const nombreDescarga = generarNombre(files[0].name, 'convertido');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "JPG a PDF");
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 7. PDF a JPG ----------
document.getElementById('botonPdf2Jpg').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoPdf2Jpg').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    const bytes = await files[0].arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const zip = new JSZip();

    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const viewport = pagina.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (pdf.numPages === 1) { 
        descargarBlob(blob, generarNombre(files[0].name, 'img', '.jpg')); 
        return; 
      }
      zip.file(`pagina-${n}.jpg`, blob);
    }
    descargarBlob(await zip.generateAsync({ type: 'blob' }), generarNombre(files[0].name, 'imagenes', '.zip'));
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 12. PDF a Word ----------
document.getElementById('botonPdf2Word').addEventListener('click', async () => {
  const btnId = 'botonPdf2Word';
  const textoOriginal = document.getElementById(btnId).innerHTML;
  try {
    const files = document.getElementById('archivoPdf2Word').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    document.getElementById(btnId).textContent = 'Procesando bloque de texto...';
    document.getElementById(btnId).disabled = true;

    const bytes = await files[0].arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let textoCompletoHTML = "";

    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const contenido = await pagina.getTextContent();
      const textoRaw = contenido.items.map(item => item.str).join(' ');
      const textoSeguro = escaparHTML(textoRaw);
      textoCompletoHTML += `<p>${textoSeguro}</p><br/>`;
    }
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Doc Seguro</title></head>
      <body>${textoCompletoHTML}</body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    descargarBlob(blob, generarNombre(files[0].name, 'texto', '.doc'));

    document.getElementById(btnId).innerHTML = textoOriginal;
    document.getElementById(btnId).disabled = false;
  } catch (e) { manejarErrorControlado(e, btnId, textoOriginal); }
});

// ---------- 13. Word a PDF ----------
document.getElementById('botonWord2Pdf').addEventListener('click', async () => {
  const btnId = 'botonWord2Pdf';
  const textoOriginal = document.getElementById(btnId).innerHTML;
  try {
    const files = document.getElementById('archivoWord2Pdf').files;
    validarArchivoSeguro(files[0], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']);
    document.getElementById(btnId).textContent = 'Convirtiendo formato seguro...';
    document.getElementById(btnId).disabled = true;

    const arrayBuffer = await files[0].arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    const contenedorTemporal = document.createElement('div');
    contenedorTemporal.innerHTML = result.value;
    contenedorTemporal.style.padding = '30px';
    contenedorTemporal.style.fontFamily = 'Helvetica, Arial, sans-serif';
    contenedorTemporal.style.fontSize = '14px';
    contenedorTemporal.style.color = '#000';

    const opcionesPDF = {
      margin: 15, filename: generarNombre(files[0].name, 'oficial', '.pdf'),
      image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await html2pdf().set(opcionesPDF).from(contenedorTemporal).save();
    document.getElementById(btnId).innerHTML = textoOriginal;
    document.getElementById(btnId).disabled = false;
  } catch (e) { manejarErrorControlado(e, btnId, textoOriginal); }
});

// ---------- 8. Rotar PDF ----------
document.getElementById('botonRotar').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoRotar').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    const bytes = await files[0].arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    pdf.getPages().forEach(pagina => {
      const anguloActual = pagina.getRotation().angle;
      pagina.setRotation(PDFLib.degrees(anguloActual + 90));
    });
    
    const bytesFinales = await pdf.save();
    const nombreDescarga = generarNombre(files[0].name, 'rotado');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Rotar PDF");
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 9. Marca de agua ----------
document.getElementById('botonMarca').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoMarca').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    const textoSeguro = escaparHTML(document.getElementById('textoMarca').value || 'CONFIDENCIAL');
    
    const bytes = await files[0].arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    const fuente = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const tamano = 48;
    const anchoTexto = fuente.widthOfTextAtSize(textoSeguro, tamano);
    
    pdf.getPages().forEach(pagina => {
      const { width, height } = pagina.getSize();
      pagina.drawText(textoSeguro, {
        x: width / 2 - anchoTexto / 2, y: height / 2, size: tamano, font: fuente,
        color: PDFLib.rgb(0.7, 0.1, 0.1), opacity: 0.25, rotate: PDFLib.degrees(45),
      });
    });
    
    const bytesFinales = await pdf.save();
    const nombreDescarga = generarNombre(files[0].name, 'protegido');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Marca de Agua");
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 10. Números de página ----------
document.getElementById('botonNumeros').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoNumeros').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    const bytes = await files[0].arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    const fuente = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    pdf.getPages().forEach((pagina, indice) => {
      const numero = String(indice + 1);
      const { width } = pagina.getSize();
      const anchoTexto = fuente.widthOfTextAtSize(numero, 10);
      pagina.drawText(numero, {
        x: width / 2 - anchoTexto / 2, y: 20, size: 10, font: fuente, color: PDFLib.rgb(0.1, 0.1, 0.1),
      });
    });
    
    const bytesFinales = await pdf.save();
    const nombreDescarga = generarNombre(files[0].name, 'numerado');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Numerar Páginas");
  } catch (e) { manejarErrorControlado(e); }
});

// ---------- 11. Recortar PDF ----------
document.getElementById('margenRecortar').addEventListener('input', e => document.getElementById('valorMargen').textContent = e.target.value);
document.getElementById('botonRecortar').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoRecortar').files;
    validarArchivoSeguro(files[0], ['application/pdf']);
    let margen = parseInt(document.getElementById('margenRecortar').value, 10);
    if(isNaN(margen) || margen < 0 || margen > 40) margen = 10;
    margen = margen / 100;
    
    const bytes = await files[0].arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    pdf.getPages().forEach(pagina => {
      const { width, height } = pagina.getSize();
      pagina.setCropBox(width * margen, height * margen, width * (1 - margen * 2), height * (1 - margen * 2));
    });
    
    const bytesFinales = await pdf.save();
    const nombreDescarga = generarNombre(files[0].name, 'recortado');
    descargar(bytesFinales, nombreDescarga);
    respaldarEnFoliarDrive(new Blob([bytesFinales], { type: 'application/pdf' }), nombreDescarga, "Recortar PDF");
  } catch (e) { manejarErrorControlado(e); }
});