pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ---------- Navegación del Menú (SPA) ----------
function abrirHerramienta(idHerramienta) {
  document.getElementById('menu-principal').style.display = 'none';
  document.getElementById('espacio-trabajo').style.display = 'block';
  
  const todasLasHerramientas = document.querySelectorAll('.tarjeta-herramienta');
  todasLasHerramientas.forEach(seccion => {
    seccion.style.display = 'none';
  });
  
  document.getElementById('herr-' + idHerramienta).style.display = 'block';
  window.scrollTo(0, 0);
}

function volverAlMenu() {
  document.getElementById('espacio-trabajo').style.display = 'none';
  document.getElementById('menu-principal').style.display = 'grid';
  
  document.querySelectorAll('.btn-gigante').forEach(label => {
    if(label.getAttribute('for') === 'archivosImagen') label.textContent = 'Seleccionar imágenes';
    else if(label.getAttribute('for') === 'archivosUnir') label.textContent = 'Seleccionar archivos PDF';
    else label.textContent = 'Seleccionar archivo PDF';
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll('input[type="file"]').forEach(input => {
  input.addEventListener('change', function() {
    const label = this.previousElementSibling;
    if (label && label.classList.contains('btn-gigante')) {
      if (this.files && this.files.length > 1) {
        label.textContent = this.files.length + ' archivos seleccionados';
      } else if (this.files && this.files.length === 1) {
        label.textContent = this.files[0].name;
      } else {
        label.textContent = 'Seleccionar archivo PDF';
      }
    }
  });
});

// ---------- Funciones compartidas ----------
function descargarBlob(blob, nombre) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nombre;
  link.click();
}

function descargar(bytes, nombre) {
  descargarBlob(new Blob([bytes], { type: 'application/pdf' }), nombre);
}

function parseRangos(texto, totalPaginas) {
  const indices = [];
  texto.split(',').map(p => p.trim()).filter(Boolean).forEach(parte => {
    if (parte.includes('-')) {
      const [inicio, fin] = parte.split('-').map(n => parseInt(n.trim(), 10));
      for (let i = inicio; i <= fin; i++) indices.push(i - 1);
    } else {
      indices.push(parseInt(parte, 10) - 1);
    }
  });
  return indices.filter(i => i >= 0 && i < totalPaginas);
}

// *** NUEVA FUNCIÓN: Genera nombres dinámicos ***
function generarNombre(nombreOriginal, sufijo, extension = '.pdf') {
  // Quita la extensión (.pdf, .jpg, etc.) del final del nombre original
  const nombreSinExtension = nombreOriginal.replace(/\.[^/.]+$/, "");
  return `${nombreSinExtension} ${sufijo}${extension}`;
}

// ---------- 1. Unir PDF ----------
document.getElementById('botonUnir').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivosUnir').files;
    if (files.length < 2) { alert('Elige al menos 2 archivos PDF'); return; }
    const pdfFinal = await PDFLib.PDFDocument.create();
    for (const archivo of files) {
      const bytes = await archivo.arrayBuffer();
      const pdfOrigen = await PDFLib.PDFDocument.load(bytes);
      const paginas = await pdfFinal.copyPages(pdfOrigen, pdfOrigen.getPageIndices());
      paginas.forEach(pagina => pdfFinal.addPage(pagina));
    }
    const nombreDescarga = generarNombre(files[0].name, 'unido');
    descargar(await pdfFinal.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error. Verifica que sean PDFs válidos.'); }
});

// ---------- 2. Dividir / Extraer páginas ----------
document.getElementById('botonDividir').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoDividir').files;
    const texto = document.getElementById('rangoDividir').value;
    const comoZip = document.getElementById('zipDividir').checked;
    if (files.length < 1) { alert('Elige un archivo PDF'); return; }
    if (!texto.trim()) { alert('Escribe al menos un número de página'); return; }

    const bytes = await files[0].arrayBuffer();
    const pdfOrigen = await PDFLib.PDFDocument.load(bytes);
    const indices = parseRangos(texto, pdfOrigen.getPageCount());
    if (!indices.length) { alert('Ningún número de página es válido'); return; }

    if (comoZip) {
      const zip = new JSZip();
      for (const indice of indices) {
        const pdfPagina = await PDFLib.PDFDocument.create();
        const [pagina] = await pdfPagina.copyPages(pdfOrigen, [indice]);
        pdfPagina.addPage(pagina);
        zip.file(`pagina-${indice + 1}.pdf`, await pdfPagina.save());
      }
      const nombreDescarga = generarNombre(files[0].name, 'paginas', '.zip');
      descargarBlob(await zip.generateAsync({ type: 'blob' }), nombreDescarga);
    } else {
      const pdfFinal = await PDFLib.PDFDocument.create();
      const paginas = await pdfFinal.copyPages(pdfOrigen, indices);
      paginas.forEach(p => pdfFinal.addPage(p));
      const nombreDescarga = generarNombre(files[0].name, 'extraido');
      descargar(await pdfFinal.save(), nombreDescarga);
    }
  } catch (e) { console.error(e); alert('Ocurrió un error. Verifica que sea un PDF válido.'); }
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
    if (!e.target.files.length) { contenedorPrevia.innerHTML = ''; return; }
    contenedorPrevia.innerHTML = '<p style="color:var(--texto-secundario);">Cargando miniaturas...</p>';
    
    archivoActualEliminar = e.target.files[0];
    const bytesParaMiniaturas = await archivoActualEliminar.arrayBuffer();
    const pdfLectura = await pdfjsLib.getDocument({ data: bytesParaMiniaturas }).promise;
    totalPaginasEliminar = pdfLectura.numPages;
    contenedorPrevia.innerHTML = ''; 
    
    for (let n = 1; n <= totalPaginasEliminar; n++) {
      const pagina = await pdfLectura.getPage(n);
      const viewport = pagina.getViewport({ scale: 0.4 }); 
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      
      const divContenedor = document.createElement('div');
      divContenedor.className = 'miniatura-contenedor';
      divContenedor.style.cursor = 'pointer';
      
      const divNumero = document.createElement('div');
      divNumero.className = 'numero-pagina';
      divNumero.textContent = n;
      
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
  } catch (err) { console.error(err); contenedorPrevia.innerHTML = '<p style="color:var(--color-ilovepdf);">Error al cargar PDF</p>'; }
});

document.getElementById('botonEliminar').addEventListener('click', async () => {
  try {
    if (!archivoActualEliminar) return;
    if (paginasParaEliminar.size === 0) { alert('Marca al menos una página para eliminar.'); return; }
    if (paginasParaEliminar.size >= totalPaginasEliminar) { alert('No puedes eliminar todo el PDF.'); return; }

    const bytesFrescos = await archivoActualEliminar.arrayBuffer();
    const pdfOrigen = await PDFLib.PDFDocument.load(bytesFrescos);
    const indicesAConservar = pdfOrigen.getPageIndices().filter(i => !paginasParaEliminar.has(i));
    const pdfFinal = await PDFLib.PDFDocument.create();
    const paginas = await pdfFinal.copyPages(pdfOrigen, indicesAConservar);
    paginas.forEach(p => pdfFinal.addPage(p));
    
    const nombreDescarga = generarNombre(archivoActualEliminar.name, 'paginas eliminadas');
    descargar(await pdfFinal.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Error al procesar el documento final.'); }
});

// ---------- 4. Ordenar páginas (Visual) ----------
let ordenPaginasArray = [];
let archivoActualOrdenar = null; 

document.getElementById('archivoOrdenar').addEventListener('change', async (e) => {
  const contenedorPrevia = document.getElementById('vistaPreviaOrdenar');
  const botonOrdenar = document.getElementById('botonOrdenar');
  const instruccion = document.getElementById('instruccionOrdenar');
  botonOrdenar.style.display = 'none';
  instruccion.style.display = 'none';
  ordenPaginasArray = [];
  
  try {
    if (!e.target.files.length) { contenedorPrevia.innerHTML = ''; return; }
    contenedorPrevia.innerHTML = '<p style="color:var(--texto-secundario);">Cargando miniaturas...</p>';
    
    archivoActualOrdenar = e.target.files[0];
    const bytesParaMiniaturas = await archivoActualOrdenar.arrayBuffer();
    
    const pdfLectura = await pdfjsLib.getDocument({ data: bytesParaMiniaturas }).promise;
    const totalPaginas = pdfLectura.numPages;
    contenedorPrevia.innerHTML = ''; 
    
    for (let n = 1; n <= totalPaginas; n++) {
      ordenPaginasArray.push(n - 1); 
      const pagina = await pdfLectura.getPage(n);
      const viewport = pagina.getViewport({ scale: 0.4 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      
      const divContenedor = document.createElement('div');
      divContenedor.className = 'miniatura-contenedor';
      divContenedor.draggable = true; 
      divContenedor.dataset.indiceOriginal = n - 1; 
      
      const divNumero = document.createElement('div');
      divNumero.className = 'numero-pagina';
      divNumero.textContent = n; 
      
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
          const mitadX = rect.left + rect.width / 2;
          if (ev.clientX > mitadX) divContenedor.after(arrastrado);
          else divContenedor.before(arrastrado);
        }
      });

      contenedorPrevia.appendChild(divContenedor);
    }
    botonOrdenar.style.display = 'block';
    instruccion.style.display = 'block';
  } catch (err) { console.error(err); contenedorPrevia.innerHTML = '<p style="color:var(--color-ilovepdf);">Error al cargar PDF</p>'; }
});

document.getElementById('botonOrdenar').addEventListener('click', async () => {
  try {
    if (!archivoActualOrdenar || !ordenPaginasArray.length) return;
    
    const bytesFrescos = await archivoActualOrdenar.arrayBuffer();
    const pdfOrigen = await PDFLib.PDFDocument.load(bytesFrescos);
    const pdfFinal = await PDFLib.PDFDocument.create();
    
    const paginas = await pdfFinal.copyPages(pdfOrigen, ordenPaginasArray);
    paginas.forEach(p => pdfFinal.addPage(p));
    
    const nombreDescarga = generarNombre(archivoActualOrdenar.name, 'ordenado');
    descargar(await pdfFinal.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Error al reordenar el documento final.'); }
});

// ---------- 5. Comprimir PDF ----------
document.getElementById('calidadComprimir').addEventListener('input', e => {
  document.getElementById('valorCalidad').textContent = e.target.value;
});
document.getElementById('botonComprimir').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoComprimir').files;
    if (files.length < 1) { alert('Elige un archivo PDF'); return; }
    const calidad = parseInt(document.getElementById('calidadComprimir').value, 10) / 100;

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
    const nombreDescarga = generarNombre(files[0].name, 'comprimido');
    descargar(await pdfFinal.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error al comprimir'); }
});

// ---------- 6. JPG/PNG a PDF ----------
document.getElementById('botonImagen').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivosImagen').files;
    if (files.length < 1) { alert('Elige al menos una imagen'); return; }
    const pdf = await PDFLib.PDFDocument.create();
    for (const archivo of files) {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const esPng = archivo.type === 'image/png';
      const imagen = esPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const pagina = pdf.addPage([imagen.width, imagen.height]);
      pagina.drawImage(imagen, { x: 0, y: 0, width: imagen.width, height: imagen.height });
    }
    const nombreDescarga = generarNombre(files[0].name, 'convertido');
    descargar(await pdf.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error. Verifica que sean JPG o PNG válidos.'); }
});

// ---------- 7. PDF a JPG ----------
document.getElementById('botonPdf2Jpg').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoPdf2Jpg').files;
    if (files.length < 1) { alert('Elige un archivo PDF'); return; }
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
        const nombreDescarga = generarNombre(files[0].name, 'convertido', '.jpg');
        descargarBlob(blob, nombreDescarga); 
        return; 
      }
      zip.file(`pagina-${n}.jpg`, blob);
    }
    const nombreDescarga = generarNombre(files[0].name, 'imagenes', '.zip');
    descargarBlob(await zip.generateAsync({ type: 'blob' }), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error. Verifica que sea un PDF válido.'); }
});

// ---------- 8. Rotar PDF ----------
document.getElementById('botonRotar').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoRotar').files;
    if (files.length < 1) { alert('Elige un archivo PDF'); return; }
    const bytes = await files[0].arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    pdf.getPages().forEach(pagina => {
      const anguloActual = pagina.getRotation().angle;
      pagina.setRotation(PDFLib.degrees(anguloActual + 90));
    });
    const nombreDescarga = generarNombre(files[0].name, 'rotado');
    descargar(await pdf.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error al rotar'); }
});

// ---------- 9. Marca de agua ----------
document.getElementById('botonMarca').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoMarca').files;
    const texto = document.getElementById('textoMarca').value || 'CONFIDENCIAL';
    if (files.length < 1) { alert('Elige un archivo PDF'); return; }
    const bytes = await files[0].arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    const fuente = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const tamano = 48;
    const anchoTexto = fuente.widthOfTextAtSize(texto, tamano);
    pdf.getPages().forEach(pagina => {
      const { width, height } = pagina.getSize();
      pagina.drawText(texto, {
        x: width / 2 - anchoTexto / 2, y: height / 2, size: tamano, font: fuente,
        color: PDFLib.rgb(0.7, 0.1, 0.1), opacity: 0.25, rotate: PDFLib.degrees(45),
      });
    });
    const nombreDescarga = generarNombre(files[0].name, 'marca de agua');
    descargar(await pdf.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error al marcar'); }
});

// ---------- 10. Números de página ----------
document.getElementById('botonNumeros').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoNumeros').files;
    if (files.length < 1) { alert('Elige un archivo PDF'); return; }
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
    const nombreDescarga = generarNombre(files[0].name, 'numerado');
    descargar(await pdf.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error al numerar'); }
});

// ---------- 11. Recortar PDF ----------
document.getElementById('margenRecortar').addEventListener('input', e => {
  document.getElementById('valorMargen').textContent = e.target.value;
});
document.getElementById('botonRecortar').addEventListener('click', async () => {
  try {
    const files = document.getElementById('archivoRecortar').files;
    if (files.length < 1) { alert('Elige un archivo PDF'); return; }
    const margen = parseInt(document.getElementById('margenRecortar').value, 10) / 100;
    const bytes = await files[0].arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(bytes);
    pdf.getPages().forEach(pagina => {
      const { width, height } = pagina.getSize();
      pagina.setCropBox(width * margen, height * margen, width * (1 - margen * 2), height * (1 - margen * 2));
    });
    const nombreDescarga = generarNombre(files[0].name, 'recortado');
    descargar(await pdf.save(), nombreDescarga);
  } catch (e) { console.error(e); alert('Ocurrió un error al recortar'); }
});