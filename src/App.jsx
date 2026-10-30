import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Printer, Plus, Trash2, Eye, Check, AlertCircle, RotateCcw } from 'lucide-react';

const sampleRows = [
  { 'Student Name': 'Aashima Aggarwal', 'Reg No': '2412128', Salutation: 'Ms.', Gender: 'Female', 'Father Name': 'Mohit Aggarwal', Address: 'B-22 Shakti Nagar Extension', City: 'North Delhi', State: 'Delhi', Pincode: '110052', 'Mobile No': '8448855545', 'Father Phone no:': '7827498781' },
  { 'Student Name': 'Aastha Arora', 'Reg No': '2412012', Salutation: 'Ms.', Gender: 'Female', 'Father Name': 'Sanjeev Arora', Address: 'B2/120 Upper Ground Floor', City: 'New Delhi', State: 'Delhi', Pincode: '110058', 'Mobile No': '8860521026', 'Father Phone no:': '9313707725' },
  { 'Student Name': 'Abhay Pratap Singh', 'Reg No': '2412158', Salutation: 'Mr.', Gender: 'Male', 'Father Name': 'Vijendra Singh', Address: 'Sample House, Sector 10', City: 'Noida', State: 'Uttar Pradesh', Pincode: '201301', 'Mobile No': '9876543210', 'Father Phone no:': '9876501234' }
];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const defaults = { pageSize: 'A4', orientation: 'portrait', customPageWidth: 210, customPageHeight: 297, labelWidth: 99.1, labelHeight: 33.9, columns: 2, rows: 8, gapX: 2, gapY: 0, padding: 3, fontSize: 11, lineGap: 1.5, alignment: 'center', vertical: 'center' };
const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const getValue = (record, heading) => { const key = Object.keys(record).find(item => norm(item) === norm(heading)); return key ? String(record[key] ?? '').trim() : ''; };

export default function App() {
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [lines, setLines] = useState([]);
  const [customLayout, setCustomLayout] = useState(false);
  const [settings, setSettings] = useState(defaults);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState({ type: 'info', text: 'Upload an Excel/CSV file or load sample data to begin.' });
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef(null);
  const enabledFields = fields.filter(field => field.enabled);
  const perPage = Math.max(1, Number(settings.columns) * Number(settings.rows));
  const pages = useMemo(() => { const out = []; for (let i = 0; i < records.length; i += perPage) out.push(records.slice(i, i + perPage)); return out; }, [records, perPage]);
  const pageMetrics = useMemo(() => {
    const presets = { A3: [297, 420], A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
    let [pageWidth, pageHeight] = settings.pageSize === 'Custom'
      ? [Number(settings.customPageWidth), Number(settings.customPageHeight)]
      : (presets[settings.pageSize] || presets.A4);
    if (settings.orientation === 'landscape' && pageHeight > pageWidth) [pageWidth, pageHeight] = [pageHeight, pageWidth];
    if (settings.orientation === 'portrait' && pageWidth > pageHeight) [pageWidth, pageHeight] = [pageHeight, pageWidth];

    const columns = Math.max(1, Math.round(Number(settings.columns) || 1));
    const rows = Math.max(1, Math.round(Number(settings.rows) || 1));
    const labelWidth = Number(settings.labelWidth);
    const labelHeight = Number(settings.labelHeight);
    const gapX = Number(settings.gapX);
    const gapY = Number(settings.gapY);
    const valid = [pageWidth, pageHeight, labelWidth, labelHeight, gapX, gapY].every(Number.isFinite)
      && pageWidth > 0 && pageHeight > 0 && labelWidth > 0 && labelHeight > 0 && gapX >= 0 && gapY >= 0;
    const printableWidth = pageWidth - 6;
    const printableHeight = pageHeight - 24;
    const gridWidth = columns * labelWidth + (columns - 1) * gapX;
    const gridHeight = rows * labelHeight + (rows - 1) * gapY;
    const fitsWidth = valid && gridWidth <= printableWidth;
    const fitsHeight = valid && gridHeight <= printableHeight;
    return { valid, fits: fitsWidth && fitsHeight, pageWidth, pageHeight, printableWidth, printableHeight, gridWidth, gridHeight, fitsWidth, fitsHeight };
  }, [settings]);
  const previewRecords = records.slice(0, showAll ? 48 : 8);
  const setSetting = (key, value) => setSettings(old => ({ ...old, [key]: value }));

  useEffect(() => {
    const presets = { A3: [297, 420], A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
    let [w, h] = settings.pageSize === 'Custom' ? [Number(settings.customPageWidth), Number(settings.customPageHeight)] : (presets[settings.pageSize] || presets.A4);
    if (settings.orientation === 'landscape' && h > w) [w, h] = [h, w];
    if (settings.orientation === 'portrait' && w > h) [w, h] = [h, w];
    let style = document.getElementById('label-page-rule');
    if (!style) { style = document.createElement('style'); style.id = 'label-page-rule'; document.head.appendChild(style); }
    style.textContent = '@media print { @page { size: ' + w + 'mm ' + h + 'mm; margin: 12mm 3mm; } }';
  }, [settings.pageSize, settings.orientation, settings.customPageWidth, settings.customPageHeight]);

  async function loadFile(file) {
    if (!file) return;
    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('File is larger than 20 MB. Please use a smaller spreadsheet.');
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(extension)) throw new Error('Unsupported file type. Upload an XLSX, XLS or CSV file.');
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellFormula: false, cellHTML: false });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error('No worksheet found.');
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      let headerIndex = 0, best = -1;
      matrix.slice(0, 15).forEach((row, i) => { const filled = row.filter(v => String(v).trim()).length; const score = filled + row.filter(v => typeof v === 'string' && String(v).trim()).length * 0.35; if (filled >= 2 && score > best) { best = score; headerIndex = i; } });
      const seen = new Set();
      const columnNames = (matrix[headerIndex] || []).map((value, i) => { const base = String(value ?? '').trim() || 'Column ' + (i + 1); let name = base, n = 2; while (seen.has(norm(name))) name = base + ' (' + n++ + ')'; seen.add(norm(name)); return name; });
      const data = matrix.slice(headerIndex + 1).filter(row => row.some(v => String(v ?? '').trim())).map(row => Object.fromEntries(columnNames.map((h, i) => [h, String(row[i] ?? '').trim()])));
      if (!data.length) throw new Error('No data rows found below the detected header row.');
      setRecords(data); setHeaders(columnNames); setFileName(file.name);
      setFields(columnNames.map((h, i) => ({ id: 'f' + i, label: h, enabled: i < 2, bold: i === 0, prefix: '', suffix: '' })));
      setLines(columnNames.slice(0, 2).map((h, i) => ({ id: 'l' + i, text: '{' + h + '}', bold: i === 0 })));
      setCustomLayout(false); setShowAll(false);
      setStatus({ type: 'success', text: data.length + ' records loaded. Choose the columns or build your own label lines.' });
    } catch (error) { setStatus({ type: 'error', text: error.message || 'Could not read this file.' }); }
  }

  function loadSample() {
    const cols = Object.keys(sampleRows[0]);
    setRecords(sampleRows); setHeaders(cols); setFileName('Sample student address data');
    setFields(cols.map((h, i) => ({ id: 'f' + i, label: h, enabled: i < 2, bold: i === 0, prefix: '', suffix: '' })));
    setLines([
      { id: 'l1', text: '{@Salutation} {@Student Name} {@relationship} {@Father Name}', bold: true },
      { id: 'l2', text: 'Address:- {@Address}, {@City}, {@State}, {@Pincode}', bold: false },
      { id: 'l3', text: 'Mo. {@Mobile No}, {@Father Phone no:}', bold: false }
    ]);
    setCustomLayout(false); setStatus({ type: 'success', text: 'Sample records loaded. Enable custom line layout to edit the three-line address label.' });
  }

  function renderLine(template, record) {
    const genderKey = headers.find(h => /gender|sex/.test(norm(h)));
    const gender = genderKey ? getValue(record, genderKey).toLowerCase() : '';
    const relationship = ['female', 'f', 'woman'].includes(gender) ? 'D/o' : ['male', 'm', 'man'].includes(gender) ? 'S/o' : '';
    return template.replace(/\{([^}]+)\}/g, (match, token) => norm(token) === 'relationship' ? relationship : getValue(record, token.trim()))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/,\s*,+/g, ', ')
      .replace(/(:-|[.:])\s*,\s*/g, '$1 ')
      .replace(/^\s*,\s*/g, '')
      .replace(/\s+,/g, ',')
      .replace(/,\s*$/g, '')
      .trim();
  }

  function addLine() { setLines(old => [...old, { id: 'l' + Date.now(), text: '', bold: false }]); }
  function updateLine(id, patch) { setLines(old => old.map(line => line.id === id ? { ...line, ...patch } : line)); }
  function moveLine(index, delta) { setLines(old => { const copy = [...old], target = index + delta; if (target < 0 || target >= copy.length) return old; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy; }); }
  function toggleField(id) { setFields(old => old.map(field => field.id === id ? { ...field, enabled: !field.enabled } : field)); }
  function renderLabel(record) {
    const output = customLayout
      ? lines.map(line => ({ id: line.id, text: renderLine(line.text, record), bold: line.bold })).filter(line => line.text)
      : enabledFields.map(field => ({ id: field.id, text: (field.prefix || '') + (getValue(record, field.label) || '') + (field.suffix || ''), bold: field.bold })).filter(line => line.text);
    return <div className="label">{output.map(line => <div className={'label-line' + (line.bold ? ' bold' : '')} key={line.id}>{line.text}</div>)}</div>;
  }
  function printLabels() {
    if (!records.length) { setStatus({ type: 'error', text: 'Upload data or load the sample before printing.' }); return; }
    if (customLayout ? !lines.some(line => line.text.trim()) : !enabledFields.length) { setStatus({ type: 'error', text: 'Select at least one field or enter a label line.' }); return; }
    if (!pageMetrics.valid) { setStatus({ type: 'error', text: 'Enter valid positive page and label dimensions, and non-negative gaps.' }); return; }
    if (!pageMetrics.fits) { setStatus({ type: 'error', text: 'The label grid (' + pageMetrics.gridWidth.toFixed(1) + ' × ' + pageMetrics.gridHeight.toFixed(1) + ' mm) exceeds the printable area (' + pageMetrics.printableWidth.toFixed(1) + ' × ' + pageMetrics.printableHeight.toFixed(1) + ' mm). Reduce the label size, rows, columns or gaps before printing.' }); return; }
    window.print();
  }
  function resetSettings() { setSettings(defaults); setStatus({ type: 'info', text: 'Page and label settings reset to defaults.' }); }

  const vars = {
    '--label-width': settings.labelWidth + 'mm', '--label-height': settings.labelHeight + 'mm', '--columns': settings.columns,
    '--gap-x': settings.gapX + 'mm', '--gap-y': settings.gapY + 'mm', '--label-padding': settings.padding + 'mm',
    '--font-size': settings.fontSize + 'pt', '--line-gap': settings.lineGap + 'mm', '--rows': settings.rows,
    '--h-align': settings.alignment === 'left' ? 'flex-start' : settings.alignment === 'right' ? 'flex-end' : 'center',
    '--text-align': settings.alignment, '--v-align': settings.vertical === 'top' ? 'flex-start' : settings.vertical === 'bottom' ? 'flex-end' : 'center'
  };

  return <main className="app" style={vars}>
    <header className="header"><div className="brand"><FileSpreadsheet size={23}/></div><div className="heading"><span className="eyebrow">PRINT DESIGN WORKSPACE</span><h1>Custom Labels Generator</h1><p>Turn any spreadsheet into print-ready labels.</p></div><div className="header-actions"><button className="button secondary" onClick={loadSample}>Load sample</button><button className="button primary" onClick={printLabels}><Printer size={16}/> Print labels</button></div></header>

    <section className="panel upload-panel"><div className="section-title"><span className="step">01</span><div><h2>Upload your Excel file</h2><p>Upload .xlsx, .xls or .csv. Column headings are detected automatically.</p></div></div>
      <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }} onClick={() => fileRef.current?.click()}><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; loadFile(file); }}/><Upload size={23}/><div><b>Choose an Excel file</b><span> or drag and drop it here<small>Supported formats: XLSX, XLS and CSV</small></span></div><button className="button outline" type="button">Browse files</button></div>
      {fileName && <div className="file-chip"><FileSpreadsheet size={15}/>{fileName}<b>{records.length} records</b></div>}
      <div className={'status ' + status.type}>{status.type === 'error' ? <AlertCircle size={15}/> : <Check size={15}/>} {status.text}</div>
    </section>

    <section className="panel designer-panel"><div className="section-title"><span className="step">02</span><div><h2>Custom label line designer</h2><p>Combine any Excel columns and fixed text into the exact lines you want.</p></div><label className="toggle"><input type="checkbox" checked={customLayout} onChange={e => setCustomLayout(e.target.checked)}/> Use custom line layout</label></div>
      {customLayout && <>{!headers.length ? <div className="empty">Upload a spreadsheet to use its columns in custom label lines.</div> : <div className="line-list">{lines.map((line, index) => <div className="line-row" key={line.id}><span className="line-no">{index + 1}</span><input className="line-input" value={line.text} placeholder="Example: {@Student Name} {@Father Name}" onChange={e => updateLine(line.id, { text: e.target.value })}/><select aria-label="Insert Excel column" defaultValue="" onChange={e => { if (e.target.value) { updateLine(line.id, { text: line.text + (line.text ? ' ' : '') + '{@' + e.target.value + '}' }); e.target.value = ''; } }}><option value="">Insert column…</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select><label className="bold-toggle"><input type="checkbox" checked={line.bold} onChange={e => updateLine(line.id, { bold: e.target.checked })}/> Bold</label><button className="icon-button" title="Move line up" disabled={index === 0} onClick={() => moveLine(index, -1)}>↑</button><button className="icon-button" title="Move line down" disabled={index === lines.length - 1} onClick={() => moveLine(index, 1)}>↓</button><button className="icon-button delete" title="Remove line" onClick={() => setLines(old => old.filter(item => item.id !== line.id))}><Trash2 size={14}/></button></div>)}</div>}
        <p className="hint">Use <code>{'{@Column Heading}'}</code> for Excel values and <code>{'{@relationship}'}</code> for D/o or S/o based on Gender. Add fixed text around placeholders. Empty values are omitted automatically.</p><button className="button add-line" onClick={addLine}><Plus size={15}/> Add label line</button></>}
    </section>

    <div className="columns-layout"><section className="panel fields-panel"><div className="section-title"><span className="step">03</span><div><h2>Choose label content</h2><p>Select fields for simple labels.</p></div><span className="selected-count">{enabledFields.length} selected</span></div>{!headers.length ? <div className="empty">Upload a spreadsheet to see its columns.</div> : <div className="field-list">{fields.map(field => <label className="field-item" key={field.id}><input type="checkbox" checked={field.enabled} onChange={() => toggleField(field.id)}/><span>{field.label}</span></label>)}</div>}</section>

    <section className="panel settings-panel"><div className="section-title"><span className="step">04</span><div><h2>Page and label layout</h2><p>Set paper, label dimensions and typography.</p></div></div><div className="settings-grid">
      <label>Page size<select value={settings.pageSize} onChange={e => setSetting('pageSize', e.target.value)}><option>A3</option><option>A4</option><option>A5</option><option>Letter</option><option>Legal</option><option value="Custom">Custom size</option></select></label>
      <label>Orientation<select value={settings.orientation} onChange={e => setSetting('orientation', e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
      {settings.pageSize === 'Custom' && <><label>Page width (mm)<input type="number" min="50" value={settings.customPageWidth} onChange={e => setSetting('customPageWidth', Number(e.target.value))}/></label><label>Page height (mm)<input type="number" min="50" value={settings.customPageHeight} onChange={e => setSetting('customPageHeight', Number(e.target.value))}/></label></>}
      <label>Label width (mm)<input type="number" min="10" step="0.1" value={settings.labelWidth} onChange={e => setSetting('labelWidth', Number(e.target.value))}/></label><label>Label height (mm)<input type="number" min="10" step="0.1" value={settings.labelHeight} onChange={e => setSetting('labelHeight', Number(e.target.value))}/></label>
      <label>Columns<input type="number" min="1" max="8" value={settings.columns} onChange={e => setSetting('columns', Math.min(8, Math.max(1, Math.round(Number(e.target.value) || 1))))}/></label><label>Rows per page<input type="number" min="1" max="30" value={settings.rows} onChange={e => setSetting('rows', Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1))))}/></label>
      <label>Horizontal gap (mm)<input type="number" min="0" step="0.5" value={settings.gapX} onChange={e => setSetting('gapX', Number(e.target.value))}/></label><label>Vertical gap (mm)<input type="number" min="0" step="0.5" value={settings.gapY} onChange={e => setSetting('gapY', Number(e.target.value))}/></label>
      <label>Font size (pt)<input type="number" min="5" max="36" value={settings.fontSize} onChange={e => setSetting('fontSize', Number(e.target.value))}/></label><label>Inner padding (mm)<input type="number" min="0" max="20" step="0.5" value={settings.padding} onChange={e => setSetting('padding', Number(e.target.value))}/></label>
      <label>Horizontal alignment<select value={settings.alignment} onChange={e => setSetting('alignment', e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Vertical alignment<select value={settings.vertical} onChange={e => setSetting('vertical', e.target.value)}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
    </div><div className={'layout-fit ' + (pageMetrics.fits ? 'fit-ok' : 'fit-warning')} role="status">
      {pageMetrics.valid
        ? (pageMetrics.fits
          ? 'Label grid fits the selected page: ' + pageMetrics.gridWidth.toFixed(1) + ' × ' + pageMetrics.gridHeight.toFixed(1) + ' mm.'
          : 'Label grid exceeds the printable page area (' + pageMetrics.printableWidth.toFixed(1) + ' × ' + pageMetrics.printableHeight.toFixed(1) + ' mm). Adjust rows, columns, label size or gaps.')
        : 'Enter valid page and label dimensions and non-negative gaps.'}
    </div><div className="settings-footer"><span><b>{perPage}</b> labels per page · <b>{pages.length}</b> page(s)</span><button className="text-button" onClick={resetSettings}><RotateCcw size={14}/> Reset settings</button></div></section></div>

    <section className="panel preview-panel"><div className="section-title"><span className="step">05</span><div><h2>Live label preview</h2><p>Preview updates as you change content and layout.</p></div><span className="live-tag"><Eye size={14}/> LIVE PREVIEW</span><button className="button primary print-button" onClick={printLabels}><Printer size={15}/> Print labels</button></div>
      {!records.length ? <div className="empty">Your labels will appear here after you upload a file.</div> : customLayout && !lines.some(line => line.text.trim()) ? <div className="empty">Add at least one custom line to preview.</div> : <><div className="preview-sheet"><div className="preview-grid">{previewRecords.map((record, index) => <React.Fragment key={index}>{renderLabel(record)}</React.Fragment>)}</div></div><div className="preview-footer">Showing {previewRecords.length} of {records.length} labels{records.length > 8 && <button className="text-button" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer' : 'Show more'}</button>}</div></>}
    </section>

    <footer>Custom Labels Generator · Excel-powered label printing</footer>
    <div className="print-document">{pages.map((page, index) => <div className="print-page" key={index}><div className="print-grid">{page.map((record, i) => <React.Fragment key={i}>{renderLabel(record)}</React.Fragment>)}{Array.from({ length: Math.max(0, perPage - page.length) }).map((_, i) => <div className="label blank" key={'blank' + i}/>)}</div></div>)}</div>
  </main>;
}
