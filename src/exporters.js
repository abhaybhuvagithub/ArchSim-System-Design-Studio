// Renderers for the report model. jsPDF and docx are heavy, so both are
// pulled in with dynamic import() — they only reach the browser when someone
// actually clicks an export button.

const save = (blob, name) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'architecture'

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// jsPDF's built-in fonts are WinAnsi only, so arrows, emoji and the rupee sign
// would come out as mojibake. Transliterate what has an ASCII reading and drop
// the rest. Only the PDF path needs this — Word handles Unicode natively.
const PDF_SUBS = [
  [/[\u2192\u21d2\u27a1]/g, '->'], [/[\u2190\u21d0]/g, '<-'], [/[\u2194\u21d4]/g, '<->'],
  [/\u20b9/g, 'Rs '], [/\u2212/g, '-'], [/\u2248/g, '~'], [/\u00d7/g, 'x'],
  [/\u2265/g, '>='], [/\u2264/g, '<='], [/\u2260/g, '!='],
  [/[\u2018\u2019]/g, "'"], [/[\u201c\u201d]/g, '"'], [/\u2026/g, '...'],
  [/[\u2713\u2714]/g, 'Yes'], [/[\u2717\u2718]/g, 'No'],
  [/[\u2022\u25cf\u25aa]/g, '-'], [/[\u2014\u2013]/g, '-'],
]
const pdfSafe = v => {
  let s = String(v ?? '\u2014')
  for (const [re, to] of PDF_SUBS) s = s.replace(re, to)
  // strip anything else outside WinAnsi: emoji, variation selectors, symbols
  s = s.replace(/[^\u0000-\u00ff\u20ac\u0160\u0152\u017d\u0161\u0153\u017e\u0178\u0192]/g, '')
  return s.replace(/\s{2,}/g, ' ').trim() || '-'
}

// ---------------------------------------------------------------- PDF -----
export async function exportPdf(report, image) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 44                       // page margin
  const CW = W - M * 2               // content width
  const BOTTOM = H - 46              // last usable y

  // One cursor shared by the body and the table renderer, so page breaks
  // started inside a table still get a footer and the right page number.
  const p = {
    y: M,
    page: 1,
    footer() {
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(140)
      doc.text(pdfSafe(report.footer), M, H - 22, { maxWidth: CW - 30 })
      doc.text(String(this.page), W - M, H - 22, { align: 'right' })
    },
    break() { this.footer(); doc.addPage(); this.page++; this.y = M },
    room(h) { if (this.y + h > BOTTOM) this.break() },
  }

  // title block
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(29, 29, 31)
  const titleLines = doc.splitTextToSize(pdfSafe(report.title), CW)
  doc.text(titleLines, M, p.y + 18); p.y += 18 + (titleLines.length - 1) * 24
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(110)
  const subLines = doc.splitTextToSize(pdfSafe(report.subtitle), CW)
  doc.text(subLines, M, p.y + 18); p.y += 16 + subLines.length * 14
  doc.setDrawColor(210).setLineWidth(0.8).line(M, p.y, W - M, p.y); p.y += 22

  // the diagram
  if (image) {
    try {
      const props = doc.getImageProperties(image)
      const h = Math.min(300, (CW * props.height) / props.width)
      p.room(h + 30)
      // 'FAST' = FlateDecode; without it jsPDF embeds raw RGB and a single
      // screenshot balloons the file to several megabytes
      doc.addImage(image, 'PNG', M, p.y, CW, h, undefined, 'FAST')
      doc.setDrawColor(225).setLineWidth(0.5).rect(M, p.y, CW, h)
      p.y += h + 8
      doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(140)
      doc.text('The design as drawn on the ArchSim canvas.', M, p.y + 8)
      p.y += 24
    } catch { /* an unreadable canvas should never block the document */ }
  }

  for (const s of report.sections) {
    p.room(70)
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(29, 29, 31)
    doc.text(pdfSafe(s.title), M, p.y + 12); p.y += 24

    if (s.intro) {
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(90)
      const lines = doc.splitTextToSize(pdfSafe(s.intro), CW)
      p.room(lines.length * 12 + 10)
      doc.text(lines, M, p.y + 8); p.y += lines.length * 12 + 12
    }

    for (const para of s.paras || []) {
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(45)
      const lines = doc.splitTextToSize('-  ' + pdfSafe(para), CW - 8)
      p.room(lines.length * 12 + 10)
      doc.text(lines, M + 4, p.y + 8); p.y += lines.length * 12 + 8
    }

    for (const t of [s.table, s.after]) {
      if (t) { drawTable(doc, t, M, CW, p); p.y += 12 }
    }
    p.y += 8
  }

  p.footer()
  doc.save(`${slug(report.title)}-architecture.pdf`)
}

// A small table renderer — enough for report data, and no plugin dependency.
// Repeats the header row after every page break.
function drawTable(doc, table, M, CW, p) {
  const { cols, rows } = table
  // give the first column more room, then share the rest evenly
  const weights = cols.map((c, i) => (i === 0 ? 1.7 : 1))
  const sum = weights.reduce((a, b) => a + b, 0)
  const w = weights.map(x => (x / sum) * CW)
  const PAD = 4
  const LINE = 9.6

  // headers wrap rather than truncate, so a column called "Capacity/inst"
  // stays readable in a narrow column
  doc.setFont('helvetica', 'bold').setFontSize(8)
  const headCells = cols.map((c, i) => doc.splitTextToSize(pdfSafe(c), w[i] - PAD * 2))
  const headH = Math.max(18, Math.max(...headCells.map(c => c.length)) * LINE + 8)

  const header = () => {
    doc.setFillColor(245, 245, 247).rect(M, p.y, CW, headH, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(70)
    let x = M
    headCells.forEach((c, i) => { doc.text(c, x + PAD, p.y + 11); x += w[i] })
    p.y += headH
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(40)
  }

  p.room(headH + 28)
  header()

  for (const r of rows) {
    const cells = r.map((c, i) => doc.splitTextToSize(pdfSafe(c), w[i] - PAD * 2))
    const h = Math.max(16, Math.max(...cells.map(c => c.length)) * LINE + 7)
    if (p.y + h > doc.internal.pageSize.getHeight() - 46) { p.break(); header() }
    let x = M
    cells.forEach((c, i) => { doc.text(c, x + PAD, p.y + 10); x += w[i] })
    p.y += h
    doc.setDrawColor(232).setLineWidth(0.4).line(M, p.y, M + CW, p.y)
  }
}

// --------------------------------------------------------------- DOCX -----
export async function exportDocx(report, image) {
  const d = await import('docx')
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ImageRun, ShadingType } = d

  const HAIR = { style: BorderStyle.SINGLE, size: 2, color: 'E4E4E7' }
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

  const cell = (text, { bold = false, fill = null } = {}) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? '—'), bold, size: 16, font: 'Calibri' })] })],
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    borders: { top: HAIR, bottom: HAIR, left: noBorder, right: noBorder },
  })

  const table = t => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: t.cols.map(c => cell(c, { bold: true, fill: 'F5F5F7' })) }),
      ...t.rows.map(r => new TableRow({ children: r.map(v => cell(v)) })),
    ],
  })

  const body = [
    new Paragraph({ children: [new TextRun({ text: report.title, bold: true, size: 44, font: 'Calibri Light', color: '1D1D1F' })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: report.subtitle, size: 19, color: '6E6E73', font: 'Calibri' })] }),
  ]

  if (image) {
    try {
      const bytes = Uint8Array.from(atob(image.split(',')[1]), c => c.charCodeAt(0))
      body.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: bytes, type: 'png', transformation: { width: 620, height: 388 } })],
      }))
      body.push(new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [new TextRun({ text: 'The design as drawn on the ArchSim canvas.', italics: true, size: 16, color: '86868B', font: 'Calibri' })],
      }))
    } catch { /* image is a nice-to-have, never a blocker */ }
  }

  for (const s of report.sections) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 }, children: [new TextRun({ text: s.title, bold: true, size: 26, color: '1D1D1F', font: 'Calibri' })] }))
    if (s.intro) body.push(new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: s.intro, size: 19, color: '4A4A4F', font: 'Calibri' })] }))
    for (const p of s.paras || []) {
      body.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 90 }, children: [new TextRun({ text: p, size: 19, font: 'Calibri' })] }))
    }
    if (s.table) { body.push(table(s.table)); body.push(new Paragraph({ text: '', spacing: { after: 120 } })) }
    if (s.after) { body.push(table(s.after)); body.push(new Paragraph({ text: '', spacing: { after: 120 } })) }
  }

  body.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: report.footer, size: 16, color: '86868B', italics: true, font: 'Calibri' })] }))

  const blob = await Packer.toBlob(new Document({ sections: [{ children: body }] }))
  save(blob, `${slug(report.title)}-architecture.docx`)
}

// ---------------------------------------------------------------- DOC -----
// Word-flavoured HTML. Opens natively in Word, Pages and Google Docs, and
// needs no library at all — useful when someone wants to edit the wording.
export function exportDoc(report, image) {
  const table = t => t ? `
    <table cellspacing="0" cellpadding="6" border="1"
           style="border-collapse:collapse;width:100%;font-size:9.5pt;margin:8pt 0 14pt">
      <tr>${t.cols.map(c => `<th style="background:#f5f5f7;text-align:left;border:0.5pt solid #d2d2d7">${esc(c)}</th>`).join('')}</tr>
      ${t.rows.map(r => `<tr>${r.map(v => `<td style="border:0.5pt solid #e4e4e7;vertical-align:top">${esc(v ?? '—')}</td>`).join('')}</tr>`).join('')}
    </table>` : ''

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>${esc(report.title)}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
    <style>
      @page { size: A4; margin: 2cm; }
      body { font-family: Calibri, 'Segoe UI', sans-serif; color: #1d1d1f; font-size: 11pt; }
      h1 { font-size: 22pt; margin: 0 0 4pt; }
      h2 { font-size: 13pt; margin: 18pt 0 6pt; }
      .sub { color: #6e6e73; font-size: 10pt; margin: 0 0 14pt; }
      .intro { color: #4a4a4f; font-size: 10pt; margin: 0 0 8pt; }
      li { font-size: 10.5pt; margin-bottom: 4pt; }
      .cap { color: #86868b; font-size: 8.5pt; font-style: italic; text-align: center; }
      .foot { color: #86868b; font-size: 8.5pt; font-style: italic; margin-top: 22pt; }
    </style></head>
    <body>
      <h1>${esc(report.title)}</h1>
      <p class="sub">${esc(report.subtitle)}</p>
      ${image ? `<p style="text-align:center"><img src="${image}" style="width:640px"></p>
                 <p class="cap">The design as drawn on the ArchSim canvas.</p>` : ''}
      ${report.sections.map(s => `
        <h2>${esc(s.title)}</h2>
        ${s.intro ? `<p class="intro">${esc(s.intro)}</p>` : ''}
        ${s.paras?.length ? `<ul>${s.paras.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        ${table(s.table)}${table(s.after)}`).join('')}
      <p class="foot">${esc(report.footer)}</p>
    </body></html>`

  save(new Blob(['﻿' + html], { type: 'application/msword' }), `${slug(report.title)}-architecture.doc`)
}
