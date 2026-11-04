/**
 * EXPOTECNIA EFTP - GENERADOR DE POSTERS PDF (Un solo PDF por proyecto)
 * Diseño moderno con QR real del proyecto integrado.
 * Uso: node src/scripts/generate_poster.js [STAND-XXX]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { pool, query: dbQuery } = require('../config/db');
const { buildStandUrl } = require('../config/publicUrl');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
const publicDir = path.join(__dirname, '..', '..', 'public');

const C = {
  azulOscuro: '#0f172a',
  azulMedio: '#1e3a8a',
  azulClaro: '#3b82f6',
  celeste: '#e0f2fe',
  celesteMedio: '#7dd3fc',
  textoOscuro: '#1e293b',
  textoGris: '#64748b',
  blanco: '#ffffff',
  textoBlanco: '#f8fafc',
  textoBlancoSuave: '#cbd5e1',
  amber: '#f59e0b',
  emerald: '#10b981',
  rosa: '#ec4899',
  linea: '#e2e8f0',
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 36;

const TRL_STYLE = {
  1: { color: C.rosa, bg: '#fce7f3' },
  2: { color: C.rosa, bg: '#fce7f3' },
  3: { color: '#ea580c', bg: '#ffedd5' },
  4: { color: '#ea580c', bg: '#ffedd5' },
  5: { color: C.amber, bg: '#fef3c7' },
  6: { color: C.amber, bg: '#fef3c7' },
  7: { color: C.emerald, bg: '#d1fae5' },
  8: { color: C.emerald, bg: '#d1fae5' },
  9: { color: C.emerald, bg: '#d1fae5' },
};

function block(doc, x, y, w, h, color) {
  doc.rect(x, y, w, h).fill(color);
}

function roundedBlock(doc, x, y, w, h, r, color) {
  doc.roundedRect(x, y, w, h, r).fill(color);
}

function texto(doc, x, y, valor, opts = {}) {
  const {
    font = 'Helvetica', size = 9, color = C.textoOscuro, width,
    align = 'left', lineGap = 2, bold = false, italic = false,
  } = opts;
  const f = bold ? (italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : (italic ? 'Helvetica-Oblique' : font);
  doc.font(f).fontSize(size).fillColor(color);
  if (width) {
    doc.text(valor, x, y, { width, align, lineGap });
  } else {
    doc.text(valor, x, y, { align });
  }
  return doc.y;
}

function chip(doc, x, y, w, h, label, opts = {}) {
  const { fill = C.azulClaro, textColor = C.blanco, fontSize = 7.5 } = opts;
  roundedBlock(doc, x, y, w, h, h / 2, fill);
  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(textColor)
    .text(label, x, y + h / 2 - fontSize / 2.2, { width: w, align: 'center' });
}

function seccionTitulo(doc, x, y, label) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.azulMedio).text(label.toUpperCase(), x, y, { width: 200 });
  doc.rect(x, y + 14, 40, 2).fill(C.azulClaro);
  return y + 24;
}

function campo(doc, x, y, w, label, valor, opts = {}) {
  const { lblSz = 7, valSz = 9.5, valBold = true } = opts;
  doc.font('Helvetica').fontSize(lblSz).fillColor(C.textoGris).text(label.toUpperCase(), x, y, { width: w * 0.3 });
  doc.font(valBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(valSz).fillColor(C.textoOscuro)
    .text(valor, x + w * 0.34, y, { width: w * 0.64 });
}

function generarQR(textoQR) {
  return QRCode.toBuffer(textoQR, {
    width: 300, margin: 2, errorCorrectionLevel: 'H',
    color: { dark: C.azulOscuro, light: C.blanco },
  });
}

async function generatePoster(proyecto) {
  const qrUrl = proyecto.enlace_tecnico_url || buildStandUrl(proyecto.codigo_stand);
  const qrBuffer = await generarQR(qrUrl);

  const filename = `poster-${proyecto.codigo_stand.toLowerCase()}.pdf`;
  const filepath = path.join(uploadsDir, filename);

  const doc = new PDFDocument({
    size: 'A4', layout: 'portrait', margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: { Title: `Poster - ${proyecto.titulo}`, Author: 'Expotecnia EFTP', Subject: `Poster técnico - ${proyecto.codigo_stand}` },
  });

  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  const PW = doc.page.width;
  const PH = doc.page.height;
  const CW = PW - M * 2;

  /* ============ BLOQUE 1: HEADER ============ */
  const h1 = 170;
  block(doc, 0, 0, PW, h1, C.azulOscuro);
  block(doc, 0, 0, 8, h1, C.azulClaro); // acento izquierdo

  doc.save().opacity(0.05);
  for (let x = -80; x < PW + 80; x += 120) {
    for (let y = -80; y < h1 + 80; y += 120) {
      doc.circle(x, y, 45).fill(C.azulClaro);
    }
  }
  doc.restore();

  let hy = 26;

  // Badge Código Stand (izquierda)
  const bw = 110, bh = 30;
  roundedBlock(doc, M, hy, bw, bh, 15, C.azulMedio);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.blanco)
    .text(proyecto.codigo_stand, M, hy + 7, { width: bw, align: 'center' });

  // Badge TRL (derecha)
  const trlS = TRL_STYLE[proyecto.trl_nivel] || TRL_STYLE[5];
  const tw = 64;
  roundedBlock(doc, PW - M - tw, hy, tw, bh, 15, trlS.bg);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(trlS.color)
    .text(`TRL ${proyecto.trl_nivel}`, PW - M - tw, hy + 7, { width: tw, align: 'center' });

  hy += 42;

  // Título
  doc.font('Helvetica-Bold').fontSize(22).fillColor(C.blanco)
    .text(proyecto.titulo, M, hy, { width: CW - 200, lineGap: 4 });
  hy += doc.heightOfString(proyecto.titulo, { width: CW - 200, lineGap: 4 }) + 12;

  // Etiquetas Especialidad + Sector
  const tags = [proyecto.especialidad];
  if (proyecto.sector_aplicacion) tags.push(proyecto.sector_aplicacion);
  let tx = M;
  tags.forEach((tag, i) => {
    const tw2 = Math.min(160, doc.widthOfString(tag) + 24);
    const fondo = i === 0 ? C.azulMedio : C.celesteMedio;
    roundedBlock(doc, tx, hy, tw2, 22, 11, fondo);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.blanco)
      .text(tag, tx, hy + 5, { width: tw2, align: 'center' });
    tx += tw2 + 10;
  });

  // Imagen del proyecto (arriba a la derecha)
  if (proyecto.imagen_url) {
    const imgPath = path.join(publicDir, proyecto.imagen_url);
    if (fs.existsSync(imgPath)) {
      const iw = 150, ih = 95;
      const ix = PW - M - iw;
      const iy = h1 - ih - 16;
      roundedBlock(doc, ix - 4, iy - 4, iw + 8, ih + 8, 8, C.blanco);
      doc.save();
      doc.roundedRect(ix, iy, iw, ih, 6);
      doc.clip();
      doc.image(imgPath, ix, iy, { width: iw, height: ih });
      doc.restore();
    }
  }

  /* ============ BLOQUE 2: CUERPO ============ */
  const bodyY = h1 + 20;
  const gap = 18;
  const colW = (CW - gap) / 2;
  const leftX = M;
  const rightX = M + colW + gap;

  // Columna izquierda: Resumen, Tecnologías, Integrantes, Docente
  const colAltura = PH - h1 - 240; // deja espacio para footer y QR zona
  block(doc, leftX, bodyY, colW, colAltura, C.celeste);

  let ly = bodyY + 18;
  ly = seccionTitulo(doc, leftX, ly, 'Resumen Ejecutivo');
  ly = texto(doc, leftX, ly, proyecto.resumen_ejecutivo, {
    width: colW - 32, size: 8.8, color: C.textoOscuro, lineGap: 3, align: 'justify',
  }) + 16;

  ly = seccionTitulo(doc, leftX, ly, 'Tecnologías Usadas');
  const techs = (proyecto.tecnologias_usadas || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 9);
  techs.forEach((t, i) => {
    const tw = Math.min(130, doc.widthOfString(t) + 20);
    const txx = leftX + 16 + (i % 3) * (tw + 10);
    const tyy = ly + Math.floor(i / 3) * 22;
    roundedBlock(doc, txx, tyy, tw, 18, 9, C.blanco);
    texto(doc, txx, tyy, t, { width: tw, size: 7, color: C.azulMedio, align: 'center' });
  });
  ly += Math.ceil(techs.length / 3) * 22 + 16;

  ly = seccionTitulo(doc, leftX, ly, 'Integrantes');
  const integrs = (proyecto.integrantes || '').split(',').map(i => i.trim()).filter(Boolean).slice(0, 6);
  integrs.forEach((name, i) => {
    roundedBlock(doc, leftX + 16, ly + 4, 18, 18, 9, C.azulMedio);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.blanco)
      .text(name.charAt(0).toUpperCase(), leftX + 19, ly + 6, { width: 12, align: 'center' });
    texto(doc, leftX + 42, ly + 2, name, { width: colW - 64, size: 9, color: C.textoOscuro, ellipsis: true });
    ly += 24;
  });
  ly += 10;

  ly = seccionTitulo(doc, leftX, ly, 'Docente Tutor');
  texto(doc, leftX, ly, proyecto.docente_tutor, { width: colW - 32, size: 10, color: C.textoOscuro, bold: true });

  // Columna derecha: Ficha técnica, Evaluación, Recursos
  block(doc, rightX, bodyY, colW, colAltura, C.azulMedio);

  let ry = bodyY + 18;
  ry = seccionTitulo(doc, rightX, ry, 'Ficha Técnica');

  const ficha = [
    { label: 'Código de Stand', val: proyecto.codigo_stand },
    { label: 'Especialidad', val: proyecto.especialidad },
    { label: 'Sector de Aplicación', val: proyecto.sector_aplicacion || 'No especificado' },
    { label: 'Nivel TRL', val: `TRL ${proyecto.trl_nivel} / 9` },
    { label: 'Docente Tutor', val: proyecto.docente_tutor },
  ];

  ficha.forEach((f, i) => {
    const fy = ry + i * 40;
    roundedBlock(doc, rightX + 16, fy, colW - 32, 36, 8, C.azulOscuro);
    texto(doc, rightX + 28, fy + 5, f.label.toUpperCase(), { width: colW - 52, size: 7, color: C.textoBlancoSuave });
    texto(doc, rightX + 28, fy + 20, f.val, { width: colW - 52, size: 9.5, color: C.blanco, bold: true });
  });
  ry += ficha.length * 40 + 16;

  // Evaluación promedio
  ry = seccionTitulo(doc, rightX, ry, 'Evaluación');
  const avg = proyecto.promedio_general || 0;
  doc.font('Helvetica-Bold').fontSize(34).fillColor(C.amber).text(avg.toFixed(1), rightX + 16, ry, { width: 60, align: 'center' });
  texto(doc, rightX + 78, ry + 10, '/ 5.0', { size: 10, color: C.textoBlancoSuave });
  texto(doc, rightX + 16, ry + 54, `${proyecto.total_votos || 0} evaluación(es)`, {
    width: colW - 32, size: 8, color: C.textoBlancoSuave, align: 'center',
  });
  ry += 76;

  /* ============ BLOQUE 3: QR ZONA (ancho completo) ============ */
  const qrY = PH - 230;
  block(doc, M, qrY, CW, 150, C.blanco);
  roundedBlock(doc, M, qrY, CW, 150, 12, C.linea);

  // Título QR
  texto(doc, M + 20, qrY + 16, 'ACCESO RÁPIDO AL PROYECTO', { size: 11, color: C.azulMedio, bold: true });

  // QR imagen (izquierda del bloque)
  const qrSize = 104;
  const qrX = M + 20;
  const qrImgY = qrY + 44;
  doc.image(qrBuffer, qrX, qrImgY, { width: qrSize, height: qrSize });
  texto(doc, qrX, qrImgY + qrSize + 6, 'Escaneá para ver el stand', {
    width: qrSize, size: 7.5, color: C.textoGris, align: 'center',
  });

  // Texto del link (derecha del bloque)
  const linkX = qrX + qrSize + 30;
  texto(doc, linkX, qrImgY + 6, 'Enlace del proyecto:', { size: 9, color: C.textoGris, bold: true });
  texto(doc, linkX, qrImgY + 22, qrUrl, {
    width: CW - 20 - qrSize - 30, size: 8.5, color: C.azulClaro, bold: true,
    link: qrUrl, underline: true,
  });

  /* ============ FOOTER ============ */
  const footerY = PH - 70;
  block(doc, 0, footerY, PW, 70, C.azulOscuro);
  texto(doc, M, footerY + 12, 'EXPOTECNIA EFTP 2026', { size: 10, color: C.blanco, bold: true });
  texto(doc, M, footerY + 28, 'Plataforma de Innovación Tecnológica Educativa', {
    size: 7.5, color: C.textoBlancoSuave, width: 260,
  });
  texto(doc, PW - M - 200, footerY + 28, 'Generado automáticamente por Expotecnia EFTP', {
    size: 7, color: C.textoBlancoSuave, width: 200, align: 'right',
  });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      const sz = Math.round(fs.statSync(filepath).size / 1024);
      console.log(`✅ ${filename} (${sz} KB)`);
      resolve(filepath);
    });
    stream.on('error', reject);
  });
}

async function main() {
  const target = process.argv[2];
  try {
    console.log('📡 Conectado a MariaDB');

    let proyectos;
    if (target) {
      proyectos = await dbQuery('SELECT * FROM proyectos WHERE codigo_stand = ?', [target]);
    } else {
      proyectos = await dbQuery('SELECT * FROM proyectos ORDER BY codigo_stand');
    }

    console.log(`📋 Generando ${proyectos.length} poster(s) (1 PDF por proyecto)...\n`);

    for (const p of proyectos) {
      await generatePoster(p);
      await dbQuery(
        'UPDATE proyectos SET pdf_poster_url = ? WHERE codigo_stand = ?',
        [`/uploads/poster-${p.codigo_stand.toLowerCase()}.pdf`, p.codigo_stand]
      );
    }

    console.log('\n✅ Posters generados y BD actualizada');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch (_) {}
    process.exit();
  }
}

main();
