function escapePdf(value: string) {
  return value.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7E]/g, '?');
}

/** Minimal, dependency-free PDF text report suitable for a private Worker response. */
export function createTextPdf(title: string, lines: string[]) {
  const perPage = 46;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / perPage)) }, (_, index) => lines.slice(index * perPage, (index + 1) * perPage));
  const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pageRefs: number[] = [];
  for (const pageLines of pages) {
    const pageRef = objects.length + 1;
    const contentRef = pageRef + 1;
    pageRefs.push(pageRef);
    const content = ['BT', '/F1 16 Tf', '50 800 Td', `(${escapePdf(title)}) Tj`, '/F1 9 Tf', '0 -24 Td', ...pageLines.map((line) => `(${escapePdf(line)}) Tj 0 -14 Td`), 'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
  }
  objects[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
