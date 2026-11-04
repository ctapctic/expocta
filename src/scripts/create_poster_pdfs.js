const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');

// Crear PDFs placeholder simples (con contenido mínimo PDF válido)
function createMinimalPDF(title, stand) {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 100 >>
stream
BT
/F1 24 Tf
50 750 Td
(${title}) Tj
0 -40 Td
/F1 16 Tf
(Stand: ${stand}) Tj
0 -30 Td
(Poster técnico del proyecto) Tj
0 -30 Td
(Expotecnia EFTP 2026) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000215 00000 n 
0000000328 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
400
%%EOF`;
  return content;
}

const posters = [
  { filename: 'poster-iot.pdf', title: 'Sistema de Monitoreo Agro-IoT', stand: 'STAND-101' },
  { filename: 'poster-robot.pdf', title: 'Brazo Robótico Didáctico', stand: 'STAND-102' },
  { filename: 'poster-pwa.pdf', title: 'Plataforma PWA Telemedicina', stand: 'STAND-103' }
];

posters.forEach(p => {
  const filePath = path.join(uploadsDir, p.filename);
  fs.writeFileSync(filePath, createMinimalPDF(p.title, p.stand));
  console.log(`✅ Creado: ${p.filename}`);
});

console.log('\\nTodos los PDFs de posters creados en public/uploads/');