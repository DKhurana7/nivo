// Small, valid selectable-text PDF; no external provider or customer information.
export function quotationPdf(blank = false) {
  const cells = [
    [40, 750, 'Description'],
    [280, 750, 'Unit'],
    [330, 750, 'Rate'],
    [400, 750, 'Amount'],
    [480, 750, 'Brand'],
    [40, 720, 'Copper cable 2.5 sq mm'],
    [280, 720, 'coil'],
    [330, 720, '1180'],
    [400, 720, '11800'],
    [480, 720, 'Brand A'],
  ];
  const content = blank
    ? ''
    : cells.map(([x, y, text]) => `BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
