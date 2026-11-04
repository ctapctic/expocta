/**
 * EXPOTECNIA EFTP - GENERADOR DE BROCHURES PDF DE OFERTAS FORMATIVAS
 *
 * Uso:
 *   node src/scripts/generate_brochure.js              # todas las ofertas
 *   node src/scripts/generate_brochure.js OFERTA-TIC   # una oferta por código
 *   node src/scripts/generate_brochure.js 1            # una oferta por ID
 *
 * Genera un PDF A4 en public/uploads/brochure-<codigo>.pdf y actualiza
 * el campo brochure_pdf_url de la oferta en la base de datos.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const db = require('../config/db');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
const publicDir = path.join(__dirname, '..', '..', 'public');

const C = {
  navy: '#0f172a',
  navySoft: '#1e3a8a',
  azul: '#2563eb',
  celeste: '#38bdf8',
  celesteClaro: '#e0f2fe',
  celesteTexto: '#7dd3fc',
  texto: '#1e293b',
  textoSuave: '#475569',
  gris: '#64748b',
  linea: '#e2e8f0',
  blanco: '#ffffff',
  blancoSuave: '#cbd5e1',
  verde: '#10b981'
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGEN = 40;
const ANCHO = PAGE_W - MARGEN * 2;
const FOOTER_Y = 770;

function fechaLarga() {
  return new Date().toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' });
}

function tituloSeccion(doc, y, label) {
  if (y > FOOTER_Y - 80) {
    doc.addPage();
    y = 60;
  }
  doc.rect(MARGEN, y + 1, 4, 14).fill(C.celeste);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(C.navySoft)
    .text(label.toUpperCase(), MARGEN + 12, y, { width: ANCHO - 12 });
  return y + 22;
}

function parrafo(doc, y, texto, opts = {}) {
  const { size = 10, color = C.textoSuave, lineGap = 3 } = opts;
  const textoLimpio = String(texto || '—').trim() || '—';
  const alto = doc.font('Helvetica').fontSize(size).heightOfString(textoLimpio, { width: ANCHO, lineGap });

  if (y + alto > FOOTER_Y - 20) {
    doc.addPage();
    y = 60;
  }

  doc.font('Helvetica').fontSize(size).fillColor(color)
    .text(textoLimpio, MARGEN, y, { width: ANCHO, lineGap });
  return doc.y;
}

function chip(doc, x, y, label, opts = {}) {
  const { fill = C.azul, textColor = C.blanco, size = 8 } = opts;
  doc.font('Helvetica-Bold').fontSize(size);
  const w = doc.widthOfString(label) + 22;
  const h = 20;
  doc.roundedRect(x, y, w, h, h / 2).fill(fill);
  doc.font('Helvetica-Bold').fontSize(size).fillColor(textColor)
    .text(label, x, y + h / 2 - size / 2 - 1, { width: w, align: 'center' });
  return w;
}

function dibujarLogo(doc, config) {
  const logoUrl = config.logo_institucion_url || '';
  if (!logoUrl.startsWith('/uploads/')) return;

  const logoPath = path.join(publicDir, logoUrl.replace(/^\//, ''));
  if (!fs.existsSync(logoPath)) return;

  const boxX = PAGE_W - MARGEN - 104;
  const boxY = 34;
  const boxW = 104;
  const boxH = 62;

  doc.roundedRect(boxX, boxY, boxW, boxH, 8).fill(C.blanco);
  try {
    doc.image(logoPath, boxX + 8, boxY + 8, {
      fit: [boxW - 16, boxH - 16],
      align: 'center',
      valign: 'center'
    });
  } catch (err) {
    // Si el logo no se puede incrustar, se continúa sin él.
  }
}

function dibujarFooter(doc, oferta, config) {
  doc.rect(0, FOOTER_Y, PAGE_W, PAGE_H - FOOTER_Y).fill(C.navy);

  const institucion = config.institucion_organizadora || 'Centro Tecnológico de Avanzada';
  const evento = config.nombre_evento || 'Expotecnia EFTP';
  const sede = config.sede || '';

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.blanco)
    .text(institucion, MARGEN, FOOTER_Y + 16, { width: ANCHO * 0.58, ellipsis: true });
  doc.font('Helvetica').fontSize(7.5).fillColor(C.blancoSuave)
    .text([evento, sede].filter(Boolean).join('  ·  '), MARGEN, FOOTER_Y + 30, { width: ANCHO * 0.58 });

  if (oferta.link_informacion_url) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.celesteTexto)
      .text('MÁS INFORMACIÓN', MARGEN + ANCHO * 0.6, FOOTER_Y + 16, { width: ANCHO * 0.4, align: 'right' });
    doc.font('Helvetica').fontSize(7).fillColor(C.blancoSuave)
      .text(oferta.link_informacion_url, MARGEN + ANCHO * 0.6, FOOTER_Y + 28, { width: ANCHO * 0.4, align: 'right', ellipsis: true });
  } else {
    doc.font('Helvetica').fontSize(7.5).fillColor(C.blancoSuave)
      .text('Consultá más carreras en la plataforma Expotecnia EFTP', MARGEN + ANCHO * 0.55, FOOTER_Y + 22, { width: ANCHO * 0.45, align: 'right' });
  }
}

async function generarBrochure(oferta, config) {
  let qrBuffer = null;
  if (oferta.link_informacion_url) {
    try {
      qrBuffer = await QRCode.toBuffer(oferta.link_informacion_url, {
        width: 200, margin: 1, errorCorrectionLevel: 'M',
        color: { dark: C.navy, light: C.blanco }
      });
    } catch (err) {
      // Si falla la generación del QR, se continúa sin él.
    }
  }

  return new Promise((resolve, reject) => {
    const nombreArchivo = `brochure-${String(oferta.codigo_oferta).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    const rutaArchivo = path.join(uploadsDir, nombreArchivo);

    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
      Title: `Brochure - ${oferta.nombre_carrera}`,
      Author: config.institucion_organizadora || 'Expotecnia EFTP',
      Subject: 'Oferta Formativa EFTP'
    }});
    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    /* ------------------------- Encabezado ------------------------- */
    const titulo = String(oferta.nombre_carrera || 'Oferta Formativa');
    doc.font('Helvetica-Bold').fontSize(24);
    const altoTitulo = doc.heightOfString(titulo, { width: 360, lineGap: 1 });
    const chipsY = 68 + altoTitulo + 20;
    const headerH = Math.max(196, chipsY + 52);

    doc.rect(0, 0, PAGE_W, headerH).fill(C.navy);
    doc.rect(0, headerH - 5, PAGE_W, 5).fill(C.celeste);

    dibujarLogo(doc, config);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.celesteTexto)
      .text('EXPOTECNIA EFTP  ·  OFERTA FORMATIVA', MARGEN, 40, { width: 340, characterSpacing: 0.6 });

    doc.font('Helvetica-Bold').fontSize(24).fillColor(C.blanco)
      .text(titulo, MARGEN, 62, { width: 360, lineGap: 1 });

    let chipX = MARGEN;
    chipX += chip(doc, chipX, chipsY, `Código: ${oferta.codigo_oferta}`, { fill: C.azul }) + 8;
    chipX += chip(doc, chipX, chipsY, oferta.modalidad || 'Presencial', { fill: C.verde }) + 8;
    chip(doc, chipX, chipsY, `${oferta.duracion_horas} horas`, { fill: C.celeste, textColor: C.navy });

    /* --------------------------- Cuerpo --------------------------- */
    let y = headerH + 30;

    y = tituloSeccion(doc, y, 'Perfil de egreso');
    y = parrafo(doc, y, oferta.perfil_egreso) + 24;

    y = tituloSeccion(doc, y, 'Requisitos de admisión');
    y = parrafo(doc, y, oferta.requisitos_admision) + 24;

    /* --------------------- Cómo solicitar info -------------------- */
    y = tituloSeccion(doc, y, '¿Cómo solicitar información?');

    const pasos = [
      ['1', 'Ingresá a la plataforma Expotecnia EFTP.'],
      ['2', 'Ubicá esta carrera en la sección Oferta Formativa.'],
      ['3', 'Completá tus datos de contacto y enviá la solicitud.']
    ];
    const altoCaja = pasos.length * 26 + 20;
    if (y + altoCaja > FOOTER_Y - 20) {
      doc.addPage();
      y = 60;
    }
    doc.roundedRect(MARGEN, y, ANCHO, altoCaja, 10).fill('#f1f5f9');

    let pasoY = y + 12;
    for (const [num, textoPaso] of pasos) {
      doc.circle(MARGEN + 18, pasoY + 7, 8).fill(C.azul);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.blanco)
        .text(num, MARGEN + 14, pasoY + 3.5, { width: 8, align: 'center' });
      doc.font('Helvetica').fontSize(9.5).fillColor(C.texto)
        .text(textoPaso, MARGEN + 34, pasoY + 1, { width: ANCHO - 48 });
      pasoY += 26;
    }
    y += altoCaja + 22;

    /* -------------------------- Link info ------------------------- */
    if (oferta.link_informacion_url) {
      const qrSize = 74;
      const boxH = qrSize + 16;
      if (y + boxH > FOOTER_Y - 20) {
        doc.addPage();
        y = 60;
      }
      doc.roundedRect(MARGEN, y, ANCHO, boxH, 10).fill(C.celesteClaro);

      const textX = MARGEN + 14;
      const textW = ANCHO - qrSize - 36;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navySoft)
        .text('Más información', textX, y + 14, { width: textW });
      doc.font('Helvetica').fontSize(8.5).fillColor(C.azul)
        .text(oferta.link_informacion_url, textX, y + 30, {
          width: textW, link: oferta.link_informacion_url, underline: true
        });
      doc.font('Helvetica').fontSize(7.5).fillColor(C.textoSuave)
        .text('Escaneá el código QR para acceder directamente.', textX, y + 48, { width: textW });

      if (qrBuffer) {
        const qrX = MARGEN + ANCHO - qrSize - 10;
        const qrY = y + (boxH - qrSize) / 2;
        doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6).fill(C.blanco);
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      }

      y += boxH + 22;
    }

    dibujarFooter(doc, oferta, config);

    doc.end();

    stream.on('finish', () => resolve({ rutaArchivo, nombreArchivo }));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

async function main() {
  const identificador = process.argv[2];

  try {
    let ofertas;
    if (identificador) {
      ofertas = await db.query(
        'SELECT * FROM oferta_formativa WHERE id = ? OR codigo_oferta = ?',
        [identificador, identificador]
      );
    } else {
      ofertas = await db.query('SELECT * FROM oferta_formativa ORDER BY nombre_carrera ASC');
    }

    if (!ofertas || ofertas.length === 0) {
      console.log('⚠️  No se encontraron ofertas para generar el brochure.');
      process.exitCode = 1;
      return;
    }

    const configRows = await db.query('SELECT clave, valor FROM configuracion_evento');
    const config = {};
    for (const fila of configRows) config[fila.clave] = fila.valor;

    console.log(`🎓 Generando ${ofertas.length} brochure(s)...\n`);

    for (const oferta of ofertas) {
      const { rutaArchivo, nombreArchivo } = await generarBrochure(oferta, config);
      const url = `/uploads/${nombreArchivo}`;
      await db.query('UPDATE oferta_formativa SET brochure_pdf_url = ? WHERE id = ?', [url, oferta.id]);
      console.log(`✅ ${oferta.codigo_oferta} — ${oferta.nombre_carrera}`);
      console.log(`   ${rutaArchivo}`);
      console.log(`   URL: ${url}\n`);
    }

    console.log(`📅 Generado el ${fechaLarga()}`);
    console.log('✅ Brochures generados y base de datos actualizada.');
  } catch (err) {
    console.error('❌ Error generando brochures:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

main();
