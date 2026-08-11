import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function extOf(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  return 'txt';
}

async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let currentY = null;
    let currentLine = '';
    const lines = [];
    content.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (currentY === null || Math.abs(y - currentY) > 2) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = item.str;
        currentY = y;
      } else {
        currentLine += item.str;
      }
    });
    if (currentLine.trim()) lines.push(currentLine.trim());
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n');
}

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractTxtText(file) {
  return await file.text();
}

/** Fayldan (pdf/docx/txt) matn ajratib oladi. */
export async function extractTextFromFile(file) {
  const ext = extOf(file);
  let text = '';
  if (ext === 'pdf') text = await extractPdfText(file);
  else if (ext === 'docx') text = await extractDocxText(file);
  else text = await extractTxtText(file);
  return { text: text.trim(), ext };
}
