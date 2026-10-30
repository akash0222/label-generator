import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Printer, Plus, Trash2, Eye, Check, AlertCircle, RotateCcw } from 'lucide-react';

const sampleRows = [
  { 'Student Name': 'Aashima Aggarwal', 'Reg No': '2412128', Salutation: 'Ms.', Gender: 'Female', 'Father Name': 'Mohit Aggarwal', Address: 'B-22 Shakti Nagar Extension', City: 'North Delhi', State: 'Delhi', Pincode: '110052', 'Mobile No': '8448855545', 'Father Phone no:': '7827498781' },
  { 'Student Name': 'Aastha Arora', 'Reg No': '2412012', Salutation: 'Ms.', Gender: 'Female', 'Father Name': 'Sanjeev Arora', Address: 'B2/120 Upper Ground Floor', City: 'New Delhi', State: 'Delhi', Pincode: '110058', 'Mobile No': '8860521026', 'Father Phone no:': '9313707725' },
  { 'Student Name': 'Abhay Pratap Singh', 'Reg No': '2412158', Salutation: 'Mr.', Gender: 'Male', 'Father Name': 'Vijendra Singh', Address: 'Sample House, Sector 10', City: 'Noida', State: 'Uttar Pradesh', Pincode: '201301', 'Mobile No': '9876543210', 'Father Phone no:': '9876501234' }
];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const defaults = { pageSize: 'A4', orientation: 'portrait', customPageWidth: 210, customPageHeight: 297, labelWidth: 99.1, labelHeight: 33.9, columns: 2, rows: 8, gapX: 2, gapY: 0, padding: 3, fontSize: 11, lineGap: 1.5, alignment: 'center', vertical: 'center', printMarginTop: 12, printMarginSide: 3, printOffsetX: 0, printOffsetY: 0 };
const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const getValue = (record, heading) => { const key = Object.keys(record).find(item => norm(item) === norm(heading)); return key ? String(record[key] ?? '').trim() : ''; };


function QrCodeVisual({ value, foreground = '#111111', background = '#ffffff' }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setSrc(''); setError('');
    if (!value) return () => { active = false; };
    (async () => {
      try {
        const module = await import('qrcode');
        const QRCode = module.default || module;
        const dataUrl = await QRCode.toDataURL(value, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: foreground.length === 7 ? foreground + 'FF' : '#111111FF',
            light: background.length === 7 ? background + 'FF' : '#FFFFFFFF'
          }
        });
        if (active) setSrc(dataUrl);
      } catch (err) {
        if (active) setError(err.message || 'QR code could not be generated.');
      }
    })();
    return () => { active = false; };
  }, [value, foreground, background]);
  if (error) return <span className="code-error" title={error}>QR error</span>;
  return src ? <img className="generated-code qr-image" src={src} alt="QR code" draggable="false"/> : <span className="code-loading">QR…</span>;
}

function BarcodeVisual({ value, format = 'CODE128', foreground = '#111111', background = '#ffffff', displayValue = true }) {
  const svgRef = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    if (svgRef.current) svgRef.current.replaceChildren();
    if (!value || !svgRef.current) return () => { active = false; };
    (async () => {
      try {
        const module = await import('jsbarcode');
        const JsBarcode = module.default || module;
        if (!active || !svgRef.current) return;
        JsBarcode(svgRef.current, value, {
          format: format || 'CODE128',
          lineColor: foreground || '#111111',
          background: background === 'transparent' ? '#ffffff' : (background || '#ffffff'),
          width: 1.5,
          height: 48,
          displayValue,
          fontSize: 11,
          margin: 2
        });
      } catch (err) {
        if (active) setError(err.message || 'Barcode value or format is invalid.');
      }
    })();
    return () => { active = false; };
  }, [value, format, foreground, background, displayValue]);
  return <div className="barcode-visual">
    {error ? <span className="code-error" title={error}>Barcode error</span> : <svg ref={svgRef} className="generated-code barcode-svg" role="img" aria-label="Barcode"/>}
  </div>;
}

function normalizeSettings(value = {}) {
  const merged = { ...defaults, ...(value && typeof value === 'object' ? value : {}) };
  const ranges = {
    customPageWidth: [50, 2000], customPageHeight: [50, 2000],
    labelWidth: [5, 1000], labelHeight: [5, 1000],
    columns: [1, 8], rows: [1, 30], gapX: [0, 100], gapY: [0, 100],
    padding: [0, 20], fontSize: [5, 36], lineGap: [0, 20],
    printMarginTop: [0, 40], printMarginSide: [0, 40],
    printOffsetX: [-40, 40], printOffsetY: [-40, 40]
  };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const number = Number(merged[key]);
    merged[key] = Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : defaults[key];
  }
  if (!['A3', 'A4', 'A5', 'Letter', 'Legal', 'Custom'].includes(merged.pageSize)) merged.pageSize = defaults.pageSize;
  if (!['portrait', 'landscape'].includes(merged.orientation)) merged.orientation = defaults.orientation;
  if (!['left', 'center', 'right'].includes(merged.alignment)) merged.alignment = defaults.alignment;
  if (!['top', 'center', 'bottom'].includes(merged.vertical)) merged.vertical = defaults.vertical;
  merged.columns = Math.round(merged.columns);
  merged.rows = Math.round(merged.rows);
  return merged;
}

function readInitialProjectState() {
  const fallbackPage = { id: 'design-1', name: 'Design 1', visualElements: [], labelBackground: '', settings: defaults, visualLayout: true };
  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  let pages = [];
  let templates = [];
  let storedSettings = {};
  let activeId = '';
  try {
    const parsedPages = JSON.parse(localStorage.getItem('label-generator-design-pages-v1') || 'null');
    if (Array.isArray(parsedPages)) {
      pages = parsedPages.filter(page => page && typeof page === 'object').map((page, index) => ({
        ...page,
        id: String(page.id || 'design-' + (index + 1)),
        name: String(page.name || 'Design ' + (index + 1)),
        visualElements: Array.isArray(page.visualElements) ? page.visualElements.filter(Boolean).map((element, elementIndex) => ({
          ...element,
          id: String(element.id || 'design-element-' + index + '-' + elementIndex),
          type: String(element.type || 'text'),
          text: String(element.text ?? ''),
          x: numberOr(element.x, 3),
          y: numberOr(element.y, 3),
          width: Math.max(1, numberOr(element.width, 20)),
          height: Math.max(1, numberOr(element.height, 6))
        })) : [],
        labelBackground: typeof page.labelBackground === 'string' ? page.labelBackground : '',
        settings: page.settings && typeof page.settings === 'object' ? normalizeSettings(page.settings) : null,
        visualLayout: page.visualLayout == null ? Boolean(page.visualElements?.length) : Boolean(page.visualLayout)
      }));
    }
    const parsedTemplates = JSON.parse(localStorage.getItem('label-generator-templates-v1') || '[]');
    if (Array.isArray(parsedTemplates)) templates = parsedTemplates.filter(item => item && typeof item === 'object' && item.id && item.name);
    const parsedSettings = JSON.parse(localStorage.getItem('label-generator-settings-v1') || '{}');
    if (parsedSettings && typeof parsedSettings === 'object' && !Array.isArray(parsedSettings)) storedSettings = parsedSettings;
    activeId = localStorage.getItem('label-generator-active-design-page-v1') || '';
  } catch {
    // Browser storage can be blocked, malformed, or unavailable.
  }
  if (!pages.length) pages = [fallbackPage];
  const activePage = pages.find(page => page.id === activeId) || pages[0];
  return {
    pages,
    activePage,
    templates,
    settings: normalizeSettings(activePage.settings || storedSettings),
    visualElements: activePage.visualElements || [],
    labelBackground: activePage.labelBackground || '',
    visualLayout: Boolean(activePage.visualLayout),
    activeDesignPageId: activePage.id,
    designPageName: activePage.name || 'Design 1'
  };
}

export default function App() {
  const initialProjectRef = useRef(null);
  if (!initialProjectRef.current) initialProjectRef.current = readInitialProjectState();
  const initialProject = initialProjectRef.current;
  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fields, setFields] = useState([]);
  const [lines, setLines] = useState([]);
  const [customLayout, setCustomLayout] = useState(false);
  const [settings, setSettings] = useState(() => normalizeSettings(initialProject.settings));
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState({ type: 'info', text: 'Upload an Excel/CSV file or load sample data to begin.' });
  const [showAll, setShowAll] = useState(false);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [recordSearch, setRecordSearch] = useState('');
  const [recordPage, setRecordPage] = useState(0);
  const [printSelectionOnly, setPrintSelectionOnly] = useState(false);
  const [printTestMode, setPrintTestMode] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState(() => initialProject.templates);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [draggingLine, setDraggingLine] = useState(null);
  const [visualLayout, setVisualLayout] = useState(() => initialProject.visualLayout);
  const [visualElements, setVisualElements] = useState(() => initialProject.visualElements);
  const [selectedVisualId, setSelectedVisualId] = useState(() => initialProject.visualElements[0]?.id || '');
  const [visualDrag, setVisualDrag] = useState(null);
  const [newVisualField, setNewVisualField] = useState('');
  const [labelBackground, setLabelBackground] = useState(() => initialProject.labelBackground);
  const [designPages, setDesignPages] = useState(() => initialProject.pages);
  const [activeDesignPageId, setActiveDesignPageId] = useState(() => initialProject.activeDesignPageId);
  const [designPageName, setDesignPageName] = useState(() => initialProject.designPageName);
  const backgroundInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const fileRef = useRef(null);
  const workbookRef = useRef(null);
  const enabledFields = fields.filter(field => field.enabled);
  const perPage = Math.max(1, Math.round(Number(settings.columns) || 1) * Math.round(Number(settings.rows) || 1));
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
    const printMarginTop = Number(settings.printMarginTop);
    const printMarginSide = Number(settings.printMarginSide);
    const printOffsetX = Number(settings.printOffsetX);
    const printOffsetY = Number(settings.printOffsetY);
    const valid = [pageWidth, pageHeight, labelWidth, labelHeight, gapX, gapY, printMarginTop, printMarginSide, printOffsetX, printOffsetY].every(Number.isFinite)
      && pageWidth > 0 && pageHeight > 0 && labelWidth > 0 && labelHeight > 0
      && gapX >= 0 && gapY >= 0 && printMarginTop >= 0 && printMarginSide >= 0;
    const printableWidth = pageWidth - printMarginSide * 2;
    const printableHeight = pageHeight - printMarginTop * 2;
    const gridWidth = columns * labelWidth + (columns - 1) * gapX;
    const gridHeight = rows * labelHeight + (rows - 1) * gapY;
    const gridStartX = printMarginSide + (printableWidth - gridWidth) / 2 + printOffsetX;
    const gridStartY = printMarginTop + printOffsetY;
    const fitsWidth = valid && printableWidth > 0 && gridWidth <= printableWidth
      && gridStartX >= printMarginSide - 0.001 && gridStartX + gridWidth <= pageWidth - printMarginSide + 0.001;
    const fitsHeight = valid && printableHeight > 0 && gridHeight <= printableHeight
      && gridStartY >= printMarginTop - 0.001 && gridStartY + gridHeight <= pageHeight - printMarginTop + 0.001;
    return { valid, fits: fitsWidth && fitsHeight, pageWidth, pageHeight, printableWidth, printableHeight, gridWidth, gridHeight, gridStartX, gridStartY, printMarginTop, printMarginSide, printOffsetX, printOffsetY, fitsWidth, fitsHeight };
  }, [settings]);
  const previewRecords = records.slice(0, showAll ? 48 : 8);
  const hasLabelContent = visualLayout
    ? Boolean(labelBackground) || visualElements.some(element =>
      ['rectangle', 'circle', 'line'].includes(element.type)
      || (element.type === 'logo' && Boolean(element.imageSrc))
      || Boolean(String(element.text ?? '').trim()))
    : customLayout
      ? lines.some(line => String(line.text ?? '').trim())
      : enabledFields.length > 0;
  const setSetting = (key, value) => setSettings(old => normalizeSettings({ ...old, [key]: value }));
  const selectedRecords = useMemo(() => records.filter((_, index) => selectedIndexes.includes(index)), [records, selectedIndexes]);
  const printSource = printSelectionOnly ? selectedRecords : records;
  const printPages = useMemo(() => {
    const out = [];
    for (let i = 0; i < printSource.length; i += perPage) out.push(printSource.slice(i, i + perPage));
    return out;
  }, [printSource, perPage]);
  const matchingIndexes = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();
    return records.map((_, index) => index).filter(index => !query || Object.values(records[index]).join(' ').toLowerCase().includes(query));
  }, [records, recordSearch]);
  const pageSizeForRecords = 50;
  const recordPageCount = Math.max(1, Math.ceil(matchingIndexes.length / pageSizeForRecords));
  const visibleRecordIndexes = matchingIndexes.slice(recordPage * pageSizeForRecords, (recordPage + 1) * pageSizeForRecords);

  useEffect(() => {
    try { localStorage.setItem('label-generator-settings-v1', JSON.stringify(settings)); } catch { /* Storage may be disabled. */ }
  }, [settings]);
  useEffect(() => {
    try { localStorage.setItem('label-generator-templates-v1', JSON.stringify(savedTemplates)); } catch { /* Storage may be disabled. */ }
  }, [savedTemplates]);

  useEffect(() => {
    try {
      localStorage.setItem('label-generator-design-pages-v1', JSON.stringify(designPages));
      localStorage.setItem('label-generator-active-design-page-v1', activeDesignPageId);
    } catch {
      setStatus(old => ({ type: 'warning', text: 'This design could not be saved to browser storage. Export or save a template before closing the tab.' }));
    }
  }, [designPages, activeDesignPageId]);
  useEffect(() => {
    setDesignPages(old => old.map(page => page.id === activeDesignPageId
      ? { ...page, name: designPageName, visualElements, labelBackground, settings: normalizeSettings(settings), visualLayout }
      : page));
  }, [visualElements, labelBackground, settings, visualLayout, activeDesignPageId, designPageName]);

  useEffect(() => {
    const presets = { A3: [297, 420], A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
    let [w, h] = settings.pageSize === 'Custom' ? [Number(settings.customPageWidth), Number(settings.customPageHeight)] : (presets[settings.pageSize] || presets.A4);
    if (settings.orientation === 'landscape' && h > w) [w, h] = [h, w];
    if (settings.orientation === 'portrait' && w > h) [w, h] = [h, w];
    let style = document.getElementById('label-page-rule');
    if (!style) { style = document.createElement('style'); style.id = 'label-page-rule'; document.head.appendChild(style); }
    style.textContent = '@media print { @page { size: ' + w + 'mm ' + h + 'mm; margin: ' + Number(settings.printMarginTop || 0) + 'mm ' + Number(settings.printMarginSide || 0) + 'mm; } }';
  }, [settings.pageSize, settings.orientation, settings.customPageWidth, settings.customPageHeight, settings.printMarginTop, settings.printMarginSide]);

  function applyWorksheet(book, sheetName, sourceName, XLSX) {
    const sheet = book.Sheets[sheetName];
    if (!sheet) throw new Error('The selected worksheet could not be found.');
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    let headerIndex = 0, best = -1;
    matrix.slice(0, 20).forEach((row, i) => {
      const filled = row.filter(v => String(v).trim()).length;
      const score = filled + row.filter(v => typeof v === 'string' && String(v).trim()).length * 0.35;
      if (filled >= 2 && score > best) { best = score; headerIndex = i; }
    });
    const seen = new Set();
    const columnNames = (matrix[headerIndex] || []).map((value, i) => {
      const base = String(value ?? '').trim() || 'Column ' + (i + 1);
      let name = base, n = 2;
      while (seen.has(norm(name))) name = base + ' (' + n++ + ')';
      seen.add(norm(name));
      return name;
    });
    const data = matrix.slice(headerIndex + 1)
      .filter(row => row.some(v => String(v ?? '').trim()))
      .map(row => Object.fromEntries(columnNames.map((h, i) => [h, String(row[i] ?? '').trim()])));
    if (!data.length) throw new Error('No data rows found below the detected header row in "' + sheetName + '".');

    setRecords(data);
    setHeaders(columnNames);
    setFileName(sourceName);
    setSelectedSheet(sheetName);
    setSelectedIndexes(data.map((_, index) => index));
    setRecordSearch('');
    setRecordPage(0);
    setFields(columnNames.map((h, i) => ({ id: 'f' + i, label: h, enabled: i < 2, bold: i === 0, prefix: '', suffix: '' })));
    setLines(columnNames.slice(0, 2).map((h, i) => ({ id: 'l' + i, text: '{@' + h + '}', bold: i === 0 })));
    setCustomLayout(false);
    setShowAll(false);
    setPrintSelectionOnly(false);
    setStatus({ type: 'success', text: data.length + ' records loaded from worksheet "' + sheetName + '".' });
  }

  async function loadFile(file) {
    if (!file) return;
    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('File is larger than 20 MB. Please use a smaller spreadsheet.');
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(extension)) throw new Error('Unsupported file type. Upload an XLSX, XLS or CSV file.');
      const XLSX = await import('xlsx');
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellFormula: false, cellHTML: false });
      if (!book.SheetNames.length) throw new Error('No worksheets found.');
      workbookRef.current = book;
      setSheetNames(book.SheetNames);
      applyWorksheet(book, book.SheetNames[0], file.name, XLSX);
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Could not read this file.' });
    }
  }

  async function changeWorksheet(sheetName) {
    if (!workbookRef.current) return;
    try {
      const XLSX = await import('xlsx');
      applyWorksheet(workbookRef.current, sheetName, fileName, XLSX);
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Could not switch worksheets.' });
    }
  }

  function loadSample() {
    const cols = Object.keys(sampleRows[0]);
    workbookRef.current = null;
    setSheetNames([]); setSelectedSheet('');
    setRecords(sampleRows); setHeaders(cols); setFileName('Sample student address data');
    setSelectedIndexes(sampleRows.map((_, index) => index)); setRecordSearch(''); setRecordPage(0); setPrintSelectionOnly(false);
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
  function reorderLine(from, to) {
    if (from === null || from === to) return;
    setLines(old => { const copy = [...old]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item); return copy; });
  }
  function toggleField(id) { setFields(old => old.map(field => field.id === id ? { ...field, enabled: !field.enabled } : field)); }
  function getLabelLines(record) {
    if (visualLayout) {
      return visualElements
        .filter(element => ['text', 'qr', 'barcode'].includes(element.type))
        .map(element => ({
          id: element.id,
          text: renderLine(element.text || '', record),
          bold: Boolean(element.bold),
          fontSize: Number(element.fontSize) || Number(settings.fontSize),
          align: element.align || 'left'
        })).filter(line => line.text);
    }
    return customLayout
      ? lines.map(line => ({ id: line.id, text: renderLine(line.text, record), bold: line.bold })).filter(line => line.text)
      : enabledFields.map(field => ({ id: field.id, text: (field.prefix || '') + (getValue(record, field.label) || '') + (field.suffix || ''), bold: field.bold })).filter(line => line.text);
  }
  function createVisualElement(text, type = 'text') {
    const index = visualElements.length;
    const isCode = type === 'qr' || type === 'barcode';
    const isShape = ['rectangle','circle','line'].includes(type);
    const width = type === 'qr' ? 22 : type === 'barcode' ? 52 : type === 'circle' ? 12 : type === 'line' ? 32 : type === 'rectangle' ? 24 : type === 'logo' ? 18 : Math.max(10, Number(settings.labelWidth) - 6);
    const height = type === 'qr' || type === 'circle' ? 22 : type === 'barcode' ? 15 : type === 'line' ? 1 : type === 'rectangle' ? 14 : type === 'logo' ? 12 : 6;
    const element = {
      id: 've-' + Date.now() + '-' + index,
      type,
      text,
      x: 3,
      y: Math.min(3 + index * 7, Math.max(0, Number(settings.labelHeight) - height)),
      width: Math.min(width, Math.max(10, Number(settings.labelWidth) - 6)),
      height,
      fontSize: Number(settings.fontSize) || 11,
      fontFamily: 'Arial',
      color: '#111111',
      backgroundColor: isShape ? '#eaf0ff' : 'transparent',
      borderColor: '#333333',
      borderWidth: type === 'line' ? 0.4 : 0,
      borderRadius: type === 'circle' ? 50 : 0,
      bold: !isCode && !isShape && type !== 'logo',
      imageSrc: '',
      align: 'left',
      barcodeFormat: 'CODE128',
      displayValue: true
    };
    setVisualElements(old => [...old, element]);
    setSelectedVisualId(element.id);
    return element.id;
  }
  function enableVisualLayout(checked) {
    setVisualLayout(checked);
    if (checked && !visualElements.length) {
      const source = customLayout && lines.length ? lines : enabledFields;
      const next = source.map((item, index) => ({
        id: 've-' + Date.now() + '-' + index,
        type: 'text',
        text: customLayout ? item.text : '{@' + item.label + '}',
        x: 3,
        y: Math.min(3 + index * 7, Math.max(0, Number(settings.labelHeight) - 6)),
        width: Math.max(10, Number(settings.labelWidth) - 6),
        height: 6,
        fontSize: Number(settings.fontSize) || 11,
        fontFamily: 'Arial',
        color: '#111111',
        backgroundColor: 'transparent',
        borderColor: '#333333',
        borderWidth: 0,
        borderRadius: 0,
        bold: Boolean(item.bold),
        align: 'left',
        barcodeFormat: 'CODE128',
        displayValue: true
      }));
      setVisualElements(next);
      setSelectedVisualId(next[0]?.id || '');
    }
  }
  async function handleLabelBackground(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', text: 'Choose an image file for the label background.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus({ type: 'error', text: 'Background image must be 8 MB or smaller.' });
      return;
    }
    try {
      const source = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the image file.'));
        reader.readAsDataURL(file);
      });
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Unsupported or damaged image file.'));
        element.src = source;
      });
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setLabelBackground(canvas.toDataURL('image/jpeg', 0.82));
      setStatus({ type: 'success', text: 'Label background image added and optimized.' });
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Could not process the background image.' });
    }
  }
  function updateVisualElement(id, patch) {
    setVisualElements(old => old.map(element => element.id === id ? { ...element, ...patch } : element));
  }
  function removeVisualElement(id) {
    setVisualElements(old => old.filter(element => element.id !== id));
    if (selectedVisualId === id) setSelectedVisualId('');
  }
  function moveVisualElement(event, element) {
    if (!visualDrag || visualDrag.id !== element.id) return;
    const canvas = event.currentTarget.parentElement;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (event.clientX - visualDrag.startClientX) / rect.width * Number(settings.labelWidth);
    const dy = (event.clientY - visualDrag.startClientY) / rect.height * Number(settings.labelHeight);
    if (visualDrag.mode === 'resize') {
      const width = Math.max(5, Math.min(Number(settings.labelWidth) - Number(element.x), visualDrag.startWidth + dx));
      const height = Math.max(4, Math.min(Number(settings.labelHeight) - Number(element.y), visualDrag.startHeight + dy));
      updateVisualElement(element.id, { width: Math.round(width * 10) / 10, height: Math.round(height * 10) / 10 });
    } else {
      const x = Math.max(0, Math.min(Number(settings.labelWidth) - Number(element.width), visualDrag.startX + dx));
      const y = Math.max(0, Math.min(Number(settings.labelHeight) - Number(element.height), visualDrag.startY + dy));
      updateVisualElement(element.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
  }
  function saveCurrentDesignPage() {
    return designPages.map(page => page.id === activeDesignPageId ? { ...page, name:designPageName, visualElements, labelBackground, settings, visualLayout } : page);
  }
  function switchDesignPage(id) {
    if (id === activeDesignPageId) return;
    const pages = saveCurrentDesignPage();
    const target = pages.find(page => page.id === id);
    if (!target) return;
    setDesignPages(pages);
    setActiveDesignPageId(id); setDesignPageName(target.name);
    setVisualElements(target.visualElements || []); setLabelBackground(target.labelBackground || '');
    setSettings(normalizeSettings(target.settings)); setVisualLayout(Boolean(target.visualLayout));
    setSelectedVisualId(target.visualElements?.[0]?.id || ''); setVisualDrag(null);
  }
  function addDesignPage() {
    const pages = saveCurrentDesignPage(), id = 'design-' + Date.now();
    const page = { id, name:'Design ' + (pages.length+1), visualElements:[], labelBackground:'', settings:normalizeSettings(settings), visualLayout:true };
    setDesignPages([...pages,page]);
    setActiveDesignPageId(id); setDesignPageName(page.name);
    setVisualElements([]); setLabelBackground(''); setVisualLayout(true); setSelectedVisualId('');
    setStatus({type:'success',text:'New design page created.'});
  }
  function duplicateDesignPage() {
    const pages=saveCurrentDesignPage(), current=pages.find(page=>page.id===activeDesignPageId);
    if(!current) return;
    const id='design-'+Date.now();
    const copy={...current,id,name:current.name+' copy',visualElements:(current.visualElements || []).map((element,index)=>({...element,id:id+'-el-'+index}))};
    setDesignPages([...pages,copy]);
    setActiveDesignPageId(id); setDesignPageName(copy.name); setVisualElements(copy.visualElements);
    setLabelBackground(copy.labelBackground||''); setSettings(normalizeSettings(copy.settings));
    setVisualLayout(Boolean(copy.visualLayout)); setSelectedVisualId(copy.visualElements[0]?.id||'');
    setStatus({type:'success',text:'Design page duplicated.'});
  }
  function deleteDesignPage() {
    if(designPages.length<=1) return setStatus({type:'error',text:'At least one design page must remain.'});
    const pages=saveCurrentDesignPage(), index=pages.findIndex(page=>page.id===activeDesignPageId);
    const remaining=pages.filter(page=>page.id!==activeDesignPageId), target=remaining[Math.max(0,index-1)]||remaining[0];
    setDesignPages(remaining);
    setActiveDesignPageId(target.id); setDesignPageName(target.name); setVisualElements(target.visualElements||[]);
    setLabelBackground(target.labelBackground||''); setSettings(normalizeSettings(target.settings));
    setVisualLayout(Boolean(target.visualLayout)); setSelectedVisualId(target.visualElements?.[0]?.id||'');
  }
  function applyStarterTemplate(kind) {
    const width=Number(settings.labelWidth), height=Number(settings.labelHeight), full=Math.max(10,width-6);
    const text=(id,value,y,size,bold=false,w=full,x=3,h=6)=>({id,type:'text',text:value,x,y,width:w,height:h,fontSize:size,fontFamily:'Arial',color:'#111111',backgroundColor:'transparent',borderColor:'#333333',borderWidth:0,borderRadius:0,bold,align:'left'});
    const code=(id,type,value,x,y,w,h)=>({...text(id,value,y,8,false,w,x,h),type,backgroundColor:'#ffffff',barcodeFormat:'CODE128',displayValue:true});
    let elements=[];
    if(kind==='address') elements=[text('address-name','{@Salutation} {@Student Name} {@relationship} {@Father Name}',2,9,true,full,3,5),text('address-line','Address:- {@Address}, {@City}, {@State}, {@Pincode}',10,8,false,full,3,6),text('address-phone','Mo. {@Mobile No}, {@Father Phone no:}',21,8,false,full,3,5)];
    if(kind==='student') elements=[text('student-name','{@Student Name}',3,12,true,full-25,3,7),text('student-reg','Reg. No.: {@Reg No}',12,9,false,full-25,3,5),text('student-course','{@Program} | {@Batch}',20,8,false,full-25,3,5),code('student-qr','qr','{@Reg No}',Math.max(3,width-25),6,20,20)];
    if(kind==='inventory') elements=[text('inventory-name','{@Item Name}',2,10,true,full,3,6),text('inventory-sku','SKU: {@SKU}',10,8,false,full,3,5),code('inventory-barcode','barcode','{@SKU}',3,Math.max(3,height-14),Math.min(width-8,65),11)];
    if(kind==='shipping') elements=[text('shipping-name','To: {@Recipient Name}',2,9,true,full,3,5),text('shipping-address','{@Address}, {@City}, {@State}, {@Pincode}',9,8,false,full,3,7),text('shipping-phone','Phone: {@Mobile No}',19,8,false,full,3,5),code('shipping-barcode','barcode','{@Tracking No}',Math.max(3,width-38),Math.max(3,height-9),35,7)];
    setVisualElements(elements); setVisualLayout(true); setLabelBackground(''); setSelectedVisualId(elements[0]?.id||'');
    const name=({address:'Address label',student:'Student label',inventory:'Inventory label',shipping:'Shipping label'})[kind];
    setDesignPageName(name); setDesignPages(old=>old.map(page=>page.id===activeDesignPageId?{...page,name}:page));
    setStatus({type:'success',text:'Starter design applied. Update placeholders to match your worksheet columns.'});
  }
  async function handleLogoUpload(file, replaceId = '') {
    if(!file) return;
    if(!file.type.startsWith('image/')) return setStatus({type:'error',text:'Choose an image file for the logo.'});
    if(file.size>8*1024*1024) return setStatus({type:'error',text:'Logo image must be 8 MB or smaller.'});
    try {
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read logo image.'));reader.readAsDataURL(file);});
      const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Unsupported logo image.'));img.src=dataUrl;});
      const scale=Math.min(1,1000/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const optimized=canvas.toDataURL('image/png');
      if(replaceId) setVisualElements(old=>old.map(element=>element.id===replaceId?{...element,imageSrc:optimized,text:file.name}:element));
      else {const id=createVisualElement(file.name,'logo');setVisualElements(old=>old.map(element=>element.id===id?{...element,imageSrc:optimized}:element));}
      setVisualLayout(true); setStatus({type:'success',text:replaceId?'Logo replaced.':'Logo added. Drag and resize it on the label canvas.'});
    } catch(error) {setStatus({type:'error',text:error.message||'Could not process logo image.'});}
  }

  function renderLabel(record, editing = false) {
    if(visualLayout) return <div className="label visual-label">
      {labelBackground && <img className="label-background" src={labelBackground} alt="" draggable="false"/>}
      {visualElements.map(element=>{
        const isShape=['rectangle','circle','line'].includes(element.type);
        const text=element.type==='logo'?element.text:renderLine(element.text,record);
        if(!text&&!isShape) return null;
        const selected=editing&&selectedVisualId===element.id;
        const style={
          left:element.x+'mm',top:element.y+'mm',width:element.width+'mm',height:element.height+'mm',
          fontSize:(Number(element.fontSize)||11)+'pt',fontFamily:element.fontFamily||'Arial',
          fontWeight:element.bold?700:400,color:element.color||'#111111',
          backgroundColor:element.type==='line'?(element.color||'#111111'):(element.backgroundColor||'transparent'),
          borderColor:element.borderColor||'#333333',borderWidth:element.type==='line'?'0mm':Number(element.borderWidth||0)+'mm',
          borderStyle:'solid',borderRadius:element.type==='circle'?'50%':Number(element.borderRadius||0)+'mm',
          textAlign:element.align||'left',justifyContent:element.align==='center'?'center':element.align==='right'?'flex-end':'flex-start'
        };
        const startMove=event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setSelectedVisualId(element.id);setVisualDrag({id:element.id,mode:'move',startClientX:event.clientX,startClientY:event.clientY,startX:Number(element.x),startY:Number(element.y)});};
        const content=element.type==='qr'?<QrCodeVisual value={text} foreground={element.color} background={element.backgroundColor}/>
          :element.type==='barcode'?<BarcodeVisual value={text} format={element.barcodeFormat} foreground={element.color} background={element.backgroundColor} displayValue={element.displayValue!==false}/>
          :element.type==='logo'?<img className="logo-visual" src={element.imageSrc} alt="Label logo" draggable="false"/>
          :isShape?<span className={'shape-visual shape-'+element.type}/>
          :<span className="visual-text-content">{text}</span>;
        return <div key={element.id} className={'visual-element '+(element.type||'text')+(selected?' is-selected':'')} style={style}
          onPointerDown={editing?startMove:undefined}
          onPointerMove={editing?event=>moveVisualElement(event,element):undefined}
          onPointerUp={editing?()=>setVisualDrag(null):undefined}
          onPointerCancel={editing?()=>setVisualDrag(null):undefined}
          title={editing?'Drag to move. Use the bottom-right handle to resize.':undefined}>
          {content}
          {selected&&<span className="resize-handle" role="button" aria-label="Resize selected element" title="Drag to resize" onPointerDown={event=>{
            event.preventDefault();event.stopPropagation();event.currentTarget.parentElement.setPointerCapture(event.pointerId);
            setVisualDrag({id:element.id,mode:'resize',startClientX:event.clientX,startClientY:event.clientY,startX:Number(element.x),startY:Number(element.y),startWidth:Number(element.width),startHeight:Number(element.height)});
          }}/>}
        </div>;
      })}
    </div>;
    return <div className="label">{getLabelLines(record).map(line=><div className={'label-line'+(line.bold?' bold':'')} key={line.id}>{line.text}</div>)}</div>;
  }
  function validateForOutput(source) {
    if (!Array.isArray(source) || !source.length) { setStatus({ type: 'error', text: 'No records are selected for this action.' }); return false; }
    if (!Number.isInteger(perPage) || perPage < 1) { setStatus({ type: 'error', text: 'The rows and columns configuration is invalid. Reset the sheet layout and try again.' }); return false; }
    if (!hasLabelContent) { setStatus({ type: 'error', text: 'Add at least one visual element, select a field, or enter a label line.' }); return false; }
    if (!pageMetrics.valid) { setStatus({ type: 'error', text: 'Enter valid positive page and label dimensions, and non-negative gaps.' }); return false; }
    if (!pageMetrics.fits) { setStatus({ type: 'error', text: 'The label grid (' + pageMetrics.gridWidth.toFixed(1) + ' × ' + pageMetrics.gridHeight.toFixed(1) + ' mm) exceeds the printable area (' + pageMetrics.printableWidth.toFixed(1) + ' × ' + pageMetrics.printableHeight.toFixed(1) + ' mm). Reduce the label size, rows, columns or gaps before printing.' }); return false; }
    return true;
  }
  function printLabels(mode = 'all') {
    const source = mode === 'selected' ? selectedRecords : records;
    if (!validateForOutput(source)) return;
    setPrintSelectionOnly(mode === 'selected');
    window.setTimeout(() => window.print(), 80);
  }
  function printCalibrationTest() {
    if (!pageMetrics.valid || !pageMetrics.fits) {
      setStatus({ type: 'error', text: 'Adjust the paper, margins, label dimensions and offsets until the sheet fits before printing a calibration test.' });
      return;
    }
    setPrintTestMode(true);
    setStatus({ type: 'info', text: 'Calibration test ready. Print at 100% / Actual size with browser headers and footers disabled.' });
    window.setTimeout(() => {
      window.addEventListener('afterprint', () => setPrintTestMode(false), { once: true });
      window.print();
    }, 120);
  }
  async function exportExcel(mode = 'all') {
    const source = mode === 'selected' ? selectedRecords : records;
    if (!validateForOutput(source)) return;
    try {
      const XLSX = await import('xlsx');
      const rows = source.map((record, index) => {
        const output = { 'Record No.': index + 1 };
        const outputLines = getLabelLines(record);
        outputLines.forEach((line, lineIndex) => { output['Label Line ' + (lineIndex + 1)] = line.text; });
        output['Combined Label'] = outputLines.map(line => line.text).join('\n');
        return output;
      });
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Generated Labels');
      XLSX.writeFile(book, 'custom-labels' + (mode === 'selected' ? '-selected' : '') + '.xlsx');
      setStatus({ type: 'success', text: source.length + ' generated labels exported to Excel.' });
    } catch (error) { setStatus({ type: 'error', text: 'Excel export failed: ' + (error.message || 'Unknown error') }); }
  }
  async function exportPdf(mode = 'all') {
    const source = mode === 'selected' ? selectedRecords : records;
    if (!validateForOutput(source)) return;
    try {
      const { jsPDF } = await import('jspdf');
      const pageWidth = pageMetrics.pageWidth;
      const pageHeight = pageMetrics.pageHeight;
      const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';
      const doc = new jsPDF({ orientation, unit: 'mm', format: [pageWidth, pageHeight], compress: true });
      doc.setProperties({ title: 'Custom Labels', subject: 'Generated printable labels' });
      const columns = Math.max(1, Number(settings.columns));
      const labelWidth = Number(settings.labelWidth);
      const labelHeight = Number(settings.labelHeight);
      const gapX = Number(settings.gapX);
      const gapY = Number(settings.gapY);
      const padding = Number(settings.padding);
      const fontSize = Number(settings.fontSize);
      const lineGap = Number(settings.lineGap);
      const gridWidth = columns * labelWidth + (columns - 1) * gapX;
      const startX = pageMetrics.gridStartX;
      const startY = pageMetrics.gridStartY;
      const fontHeight = fontSize * 0.3528;
      const lineHeight = fontHeight * 1.25;
      const contentWidth = Math.max(5, labelWidth - 2 * padding);
      const pdfFont = family => /times/i.test(family || '') ? 'times' : /courier/i.test(family || '') ? 'courier' : 'helvetica';
      const hexColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#111111';
      const { default: JsBarcode } = await import('jsbarcode');
      const { default: QRCode } = await import('qrcode');

      for (let index = 0; index < source.length; index += 1) {
        const record = source[index];
        const pagePosition = index % perPage;
        if (index > 0 && pagePosition === 0) doc.addPage([pageWidth, pageHeight], orientation);
        const column = pagePosition % columns;
        const row = Math.floor(pagePosition / columns);
        const x = startX + column * (labelWidth + gapX);
        const y = startY + row * (labelHeight + gapY);

        if (visualLayout) {
          if (labelBackground) doc.addImage(labelBackground, 'JPEG', x, y, labelWidth, labelHeight);
          for (const element of visualElements) {
            const isShape=['rectangle','circle','line'].includes(element.type);
            const text=element.type==='logo'?element.text:renderLine(element.text,record);
            if(!text&&!isShape) continue;
            const ex=x+Number(element.x), ey=y+Number(element.y), ew=Number(element.width), eh=Number(element.height);
            if(isShape){
              const fill=element.backgroundColor&&element.backgroundColor!=='transparent';
              const stroke=Number(element.borderWidth)>0;
              if(element.type==='line'){
                doc.setDrawColor(hexColor(element.color||element.borderColor));
                doc.setLineWidth(Math.max(0.2,Number(element.borderWidth)||0.4));
                doc.line(ex,ey+eh/2,ex+ew,ey+eh/2);
              } else {
                if(fill) doc.setFillColor(hexColor(element.backgroundColor));
                doc.setDrawColor(hexColor(element.borderColor));
                doc.setLineWidth(Math.max(0.1,Number(element.borderWidth)||0.2));
                const mode=fill&&stroke?'FD':fill?'F':'S';
                if(element.type==='circle') doc.ellipse(ex+ew/2,ey+eh/2,ew/2,eh/2,mode);
                else doc.roundedRect(ex,ey,ew,eh,Number(element.borderRadius||0),Number(element.borderRadius||0),mode);
              }
              continue;
            }
            const fill = element.backgroundColor && element.backgroundColor !== 'transparent';
            const bordered = Number(element.borderWidth) > 0;
            if (fill || bordered) {
              if (fill) doc.setFillColor(hexColor(element.backgroundColor));
              if (bordered) {
                doc.setDrawColor(hexColor(element.borderColor));
                doc.setLineWidth(Number(element.borderWidth));
              }
              if (fill && bordered) doc.roundedRect(ex, ey, ew, eh, Number(element.borderRadius || 0), Number(element.borderRadius || 0), 'FD');
              else if (fill) doc.rect(ex, ey, ew, eh, 'F');
              else doc.roundedRect(ex, ey, ew, eh, Number(element.borderRadius || 0), Number(element.borderRadius || 0), 'S');
            }

            if(element.type==='logo'){
              if(element.imageSrc) doc.addImage(element.imageSrc,'PNG',ex,ey,ew,eh);
            } else             if (element.type === 'qr') {
              const dataUrl = await QRCode.toDataURL(text, {
                width: 360, margin: 1, errorCorrectionLevel: 'M',
                color: { dark: hexColor(element.color) + 'FF', light: (fill ? hexColor(element.backgroundColor) : '#FFFFFFFF') }
              });
              doc.addImage(dataUrl, 'PNG', ex, ey, ew, eh);
            } else if (element.type === 'barcode') {
              const canvas = document.createElement('canvas');
              JsBarcode(canvas, text, {
                format: element.barcodeFormat || 'CODE128',
                lineColor: hexColor(element.color),
                background: fill ? hexColor(element.backgroundColor) : '#ffffff',
                width: 2,
                height: Math.max(28, Math.round(eh * 3.78)),
                displayValue: element.displayValue !== false,
                fontSize: 12,
                margin: 2
              });
              doc.addImage(canvas.toDataURL('image/png'), 'PNG', ex, ey, ew, eh);
            } else {
              const family = pdfFont(element.fontFamily);
              const size = Number(element.fontSize) || fontSize;
              const align = element.align || 'left';
              const textX = align === 'left' ? ex + 0.5 : align === 'right' ? ex + ew - 0.5 : ex + ew / 2;
              const linesWrapped = doc.splitTextToSize(text, Math.max(2, ew - 1));
              doc.setFont(family, element.bold ? 'bold' : 'normal');
              doc.setFontSize(size);
              doc.setTextColor(hexColor(element.color));
              const lineHeightForElement = size * 0.3528 * 1.2;
              const maxLines = Math.max(1, Math.floor(Math.max(0, eh - 0.8) / lineHeightForElement));
              let baseline = ey + size * 0.3528 + 0.4;
              linesWrapped.slice(0, maxLines).forEach(part => { doc.text(part, textX, baseline, { align }); baseline += lineHeightForElement; });
            }
          }
        } else {
          const sourceLines = getLabelLines(record).map(line => ({ ...line, wrapped: doc.splitTextToSize(String(line.text), contentWidth) }));
          const availableHeight = Math.max(0, labelHeight - 2 * padding);
          let remainingHeight = availableHeight;
          const content = [];
          sourceLines.forEach(line => {
            const gap = content.length ? lineGap : 0;
            const linesThatFit = Math.max(0, Math.floor((remainingHeight - gap) / lineHeight));
            const wrapped = line.wrapped.slice(0, linesThatFit);
            if (wrapped.length) {
              content.push({ ...line, wrapped });
              remainingHeight -= gap + wrapped.length * lineHeight;
            }
          });
          const totalHeight = content.reduce((sum, line, index) => sum + line.wrapped.length * lineHeight + (index ? lineGap : 0), 0);
          let baseline = settings.vertical === 'top'
            ? y + padding + fontHeight
            : settings.vertical === 'bottom'
              ? y + labelHeight - padding - totalHeight + fontHeight
              : y + (labelHeight - totalHeight) / 2 + fontHeight;
          const align = settings.alignment;
          const textX = align === 'left' ? x + padding : align === 'right' ? x + labelWidth - padding : x + labelWidth / 2;
          content.forEach((line, lineIndex) => {
            doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
            doc.setFontSize(fontSize);
            line.wrapped.forEach(part => { doc.text(part, textX, baseline, { align }); baseline += lineHeight; });
            if (lineIndex < content.length - 1) baseline += lineGap;
          });
        }
      }
      doc.save('custom-labels' + (mode === 'selected' ? '-selected' : '') + '.pdf');
      setStatus({ type: 'success', text: source.length + ' labels exported to PDF.' });
    } catch (error) {
      setStatus({ type: 'error', text: 'PDF export failed: ' + (error.message || 'Unknown error') });
    }
  }
  function toggleRecord(index) {
    setSelectedIndexes(old => old.includes(index) ? old.filter(value => value !== index) : [...old, index].sort((a, b) => a - b));
  }
  function selectAllRecords() { setSelectedIndexes(records.map((_, index) => index)); }
  function clearSelectedRecords() { setSelectedIndexes([]); }
  function saveTemplate() {
    if (!headers.length) { setStatus({ type: 'error', text: 'Upload a spreadsheet before saving a label template.' }); return; }
    const name = templateName.trim();
    if (!name) { setStatus({ type: 'error', text: 'Enter a name for this template.' }); return; }
    const id = 'tpl-' + Date.now();
    const template = { id, name, customLayout, fields, lines, settings, visualLayout, visualElements, labelBackground, designPages: saveCurrentDesignPage(), activeDesignPageId, savedAt: new Date().toISOString() };
    setSavedTemplates(old => [template, ...old.filter(item => item.name.toLowerCase() !== name.toLowerCase())]);
    setSelectedTemplateId(id);
    setStatus({ type: 'success', text: 'Template "' + name + '" saved in this browser.' });
  }
  function loadTemplate() {
    const template = savedTemplates.find(item => item.id === selectedTemplateId);
    if (!template) { setStatus({ type: 'error', text: 'Choose a saved template first.' }); return; }
    if (!headers.length) { setStatus({ type: 'error', text: 'Upload a spreadsheet before applying a template.' }); return; }
    const mappedFields = headers.map((heading, index) => {
      const saved = (template.fields || []).find(field => norm(field.label) === norm(heading));
      return { id: 'f' + index, label: heading, enabled: saved?.enabled ?? false, bold: saved?.bold ?? false, prefix: saved?.prefix ?? '', suffix: saved?.suffix ?? '' };
    });
    setFields(mappedFields);
    setLines(template.lines || []);
    setCustomLayout(Boolean(template.customLayout));
    setVisualLayout(Boolean(template.visualLayout));
    setVisualElements(template.visualElements || []);
    setSelectedVisualId(template.visualElements?.[0]?.id || '');
    setLabelBackground(template.labelBackground || '');
    if(template.designPages?.length){
      const active=template.designPages.find(page=>page.id===template.activeDesignPageId)||template.designPages[0];
      setDesignPages(template.designPages);
      setActiveDesignPageId(active.id);setDesignPageName(active.name||'Design 1');
      setVisualElements(active.visualElements||[]);setLabelBackground(active.labelBackground||'');
      setSettings(normalizeSettings(active.settings || template.settings));setVisualLayout(Boolean(active.visualLayout));
    } else {
      setDesignPages([{id:'design-1',name:'Design 1',visualElements:template.visualElements||[],labelBackground:template.labelBackground||'',settings:{...defaults,...template.settings},visualLayout:Boolean(template.visualLayout)}]);
      setActiveDesignPageId('design-1');setDesignPageName('Design 1');
    }
    if (!template.designPages?.length) setSettings(normalizeSettings(template.settings));
    setTemplateName(template.name);
    setStatus({ type: 'success', text: 'Template "' + template.name + '" applied.' });
  }
  function deleteTemplate() {
    if (!selectedTemplateId) return;
    const template = savedTemplates.find(item => item.id === selectedTemplateId);
    setSavedTemplates(old => old.filter(item => item.id !== selectedTemplateId));
    setSelectedTemplateId('');
    setStatus({ type: 'info', text: 'Template "' + (template?.name || '') + '" deleted.' });
  }
  function resetSettings() { setSettings(normalizeSettings(defaults)); setStatus({ type: 'info', text: 'Page and label settings reset to defaults.' }); }

  const vars = {
    '--label-width': settings.labelWidth + 'mm', '--label-height': settings.labelHeight + 'mm', '--columns': settings.columns,
    '--gap-x': settings.gapX + 'mm', '--gap-y': settings.gapY + 'mm', '--label-padding': settings.padding + 'mm',
    '--font-size': settings.fontSize + 'pt', '--line-gap': settings.lineGap + 'mm', '--rows': settings.rows,
    '--h-align': settings.alignment === 'left' ? 'flex-start' : settings.alignment === 'right' ? 'flex-end' : 'center',
    '--text-align': settings.alignment, '--v-align': settings.vertical === 'top' ? 'flex-start' : settings.vertical === 'bottom' ? 'flex-end' : 'center',
    '--print-offset-x': Number(settings.printOffsetX || 0) + 'mm', '--print-offset-y': Number(settings.printOffsetY || 0) + 'mm'
  };

  return <main className="app" style={vars}>
    <header className="header"><div className="brand"><FileSpreadsheet size={23}/></div><div className="heading"><span className="eyebrow">PRINT DESIGN WORKSPACE</span><h1>Custom Labels Generator</h1><p>Turn any spreadsheet into print-ready labels.</p></div><div className="header-actions"><button className="button secondary" onClick={loadSample}>Load sample</button><button className="button outline" onClick={() => exportPdf('all')} disabled={!records.length}>Export PDF</button><button className="button outline" onClick={() => exportExcel('all')} disabled={!records.length}>Export Excel</button><button className="button primary" onClick={() => printLabels('all')}><Printer size={16}/> Print all</button></div></header>

    <nav className="workflow-nav" aria-label="Label production workflow">
      <button type="button" onClick={() => document.getElementById('step-data')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span>01</span><strong>Import data</strong><small>Excel / CSV</small></button>
      <button type="button" onClick={() => document.getElementById('step-design')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span>02</span><strong>Design label</strong><small>Canvas / fields</small></button>
      <button type="button" onClick={() => document.getElementById('step-print-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span>03</span><strong>Set up sheet</strong><small>Paper / alignment</small></button>
      <button type="button" onClick={() => document.getElementById('step-export')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span>04</span><strong>Print & export</strong><small>Records / PDF</small></button>
    </nav>

    <section id="step-data" className="panel upload-panel"><div className="section-title"><span className="step">01</span><div><h2>Upload your Excel file</h2><p>Upload .xlsx, .xls or .csv. Column headings are detected automatically.</p></div></div>
      <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }} onClick={() => fileRef.current?.click()}><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; loadFile(file); }}/><Upload size={23}/><div><b>Choose an Excel file</b><span> or drag and drop it here<small>Supported formats: XLSX, XLS and CSV</small></span></div><button className="button outline" type="button">Browse files</button></div>
      {fileName && <div className="file-chip"><FileSpreadsheet size={15}/>{fileName}<b>{records.length} records</b></div>}
      {sheetNames.length > 1 && <label className="worksheet-picker">Worksheet<select value={selectedSheet} onChange={e => changeWorksheet(e.target.value)}>{sheetNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
      <div className={'status ' + status.type}>{status.type === 'success' ? <Check size={15}/> : <AlertCircle size={15}/>} {status.text}</div>
    </section>

    <section id="step-design" className="panel designer-panel"><div className="section-title"><span className="step">02</span><div><h2>Custom label line designer</h2><p>Combine any Excel columns and fixed text into the exact lines you want.</p></div><label className="toggle"><input type="checkbox" checked={customLayout} onChange={e => setCustomLayout(e.target.checked)}/> Use custom line layout</label></div>
      <div className="template-toolbar">
        <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name (e.g. Student address)"/>
        <button className="button secondary" onClick={saveTemplate} disabled={!headers.length}>Save template</button>
        <select aria-label="Saved templates" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
          <option value="">Choose saved template…</option>
          {savedTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <button className="button outline" onClick={loadTemplate} disabled={!headers.length || !selectedTemplateId}>Apply</button>
        <button className="button danger-button" onClick={deleteTemplate} disabled={!selectedTemplateId}>Delete</button>
      </div>
      {customLayout && <>{!headers.length ? <div className="empty">Upload a spreadsheet to use its columns in custom label lines.</div> : <div className="line-list">{lines.map((line, index) => <div className="line-row" key={line.id} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); reorderLine(draggingLine, index); setDraggingLine(null); }}>
        <span className="line-no drag-handle" draggable title="Drag to reorder" onDragStart={e => { setDraggingLine(index); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); }} onDragEnd={() => setDraggingLine(null)}>{index + 1} ⠿</span>
        <input className="line-input" value={line.text} placeholder="Example: {@Student Name} {@Father Name}" onChange={e => updateLine(line.id, { text: e.target.value })}/>
        <select aria-label="Insert Excel column" defaultValue="" onChange={e => { if (e.target.value) { updateLine(line.id, { text: line.text + (line.text ? ' ' : '') + '{@' + e.target.value + '}' }); e.target.value = ''; } }}><option value="">Insert column…</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select>
        <label className="bold-toggle"><input type="checkbox" checked={line.bold} onChange={e => updateLine(line.id, { bold: e.target.checked })}/> Bold</label>
        <button className="icon-button" title="Move line up" disabled={index === 0} onClick={() => moveLine(index, -1)}>↑</button>
        <button className="icon-button" title="Move line down" disabled={index === lines.length - 1} onClick={() => moveLine(index, 1)}>↓</button>
        <button className="icon-button delete" title="Remove line" onClick={() => setLines(old => old.filter(item => item.id !== line.id))}><Trash2 size={14}/></button>
      </div>)}</div>}
        <p className="hint">Use <code>{'{@Column Heading}'}</code> for Excel values and <code>{'{@relationship}'}</code> for D/o or S/o based on Gender. Add fixed text around placeholders. Empty values are omitted automatically. Drag the numbered handle to reorder lines.</p>
        <button className="button add-line" onClick={addLine}><Plus size={15}/> Add label line</button>
      </>}
      <div className="visual-toggle-row">
        <label className="toggle"><input type="checkbox" checked={visualLayout} onChange={e => enableVisualLayout(e.target.checked)}/> Use visual canvas designer</label>
        <span>Place each text element anywhere inside the label.</span>
      </div>
      <div className="design-pages-toolbar">
        <div className="design-pages-heading"><strong>Label design pages</strong><span>Keep different label layouts in one project.</span></div>
        <select value={activeDesignPageId} onChange={e=>switchDesignPage(e.target.value)} aria-label="Active design page">
          {designPages.map((page,index)=><option key={page.id} value={page.id}>{index+1}. {page.name}</option>)}
        </select>
        <input value={designPageName} onChange={e=>{setDesignPageName(e.target.value);setDesignPages(old=>old.map(page=>page.id===activeDesignPageId?{...page,name:e.target.value}:page));}} aria-label="Design page name" placeholder="Design page name"/>
        <button className="button outline" onClick={addDesignPage}><Plus size={14}/> Add page</button>
        <button className="button secondary" onClick={duplicateDesignPage}>Duplicate</button>
        <button className="button danger-button" onClick={deleteDesignPage} disabled={designPages.length<=1}>Delete</button>
      </div>
      <div className="starter-library">
        <div><strong>Ready-made templates</strong><span>Choose a starter layout and customize the fields.</span></div>
        <button className="button outline" onClick={()=>applyStarterTemplate('address')}>Address</button>
        <button className="button outline" onClick={()=>applyStarterTemplate('student')}>Student</button>
        <button className="button outline" onClick={()=>applyStarterTemplate('inventory')}>Inventory</button>
        <button className="button outline" onClick={()=>applyStarterTemplate('shipping')}>Shipping</button>
      </div>
      {visualLayout && <div className="visual-designer">
        <div className="visual-background-toolbar">
          <label>Label background image<input ref={backgroundInputRef} type="file" accept="image/*" onChange={e => { handleLabelBackground(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }}/></label>
          {labelBackground && <button className="button danger-button" onClick={() => setLabelBackground('')}>Remove background</button>}
          <span>Images are resized automatically for lighter templates.</span>
        </div>
        <div className="visual-editor-toolbar">
          <select value={newVisualField} onChange={e => setNewVisualField(e.target.value)}>
            <option value="">Choose Excel field…</option>
            {headers.map(header => <option key={header} value={header}>{header}</option>)}
          </select>
          <button className="button outline" disabled={!newVisualField} onClick={() => { createVisualElement('{@' + newVisualField + '}'); setNewVisualField(''); }}>Add field</button>
          <button className="button secondary" onClick={() => createVisualElement('Custom text', 'text')}>Add text</button>
          <button className="button outline" onClick={() => createVisualElement('{@Reg No}', 'qr')}>Add QR code</button>
          <button className="button outline" onClick={() => createVisualElement('{@Reg No}', 'barcode')}>Add barcode</button>
          <button className="button outline" onClick={() => createVisualElement('', 'rectangle')}>Rectangle</button>
          <button className="button outline" onClick={() => createVisualElement('', 'circle')}>Circle</button>
          <button className="button outline" onClick={() => createVisualElement('', 'line')}>Line</button>
          <label className="button outline logo-upload-button">Add logo<input ref={logoInputRef} type="file" accept="image/*" hidden onChange={e=>{handleLogoUpload(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/></label>
        </div>
        <div className="visual-editor-grid">
          <div className="visual-canvas-wrap">
            <div className="visual-canvas-caption">Drag elements to position them · drag the blue corner to resize</div>
            {renderLabel(records[0] || sampleRows[0], true)}
          </div>
          <div className="visual-properties">
            {!visualElements.length ? <div className="empty">Add a field or text element to begin designing.</div> : <>
              <label>Element
                <select value={selectedVisualId} onChange={e => setSelectedVisualId(e.target.value)}>
                  {visualElements.map((element, index) => <option key={element.id} value={element.id}>Element {index + 1}: {String(element.text ?? '').slice(0, 24) || element.type}</option>)}
                </select>
              </label>
              {(() => {
                const element = visualElements.find(item => item.id === selectedVisualId);
                if (!element) return <div className="empty">Select an element to edit its properties.</div>;
                return <>
                  {!['rectangle','circle','line','logo'].includes(element.type) && <label>Text / field placeholders
                    <input value={element.text} onChange={e => updateVisualElement(element.id, { text: e.target.value })}/>
                  </label>}
                  {element.type==='logo' && <label>Replace logo image<input type="file" accept="image/*" onChange={e=>{handleLogoUpload(e.currentTarget.files?.[0],element.id);e.currentTarget.value='';}}/></label>}
                  {element.type === 'text' && <div className="visual-style-grid">
                    <label>Font family<select value={element.fontFamily || 'Arial'} onChange={e => updateVisualElement(element.id, { fontFamily: e.target.value })}>
                      <option>Arial</option><option>Helvetica</option><option>Times New Roman</option><option>Georgia</option><option>Courier New</option><option>Verdana</option><option>Tahoma</option>
                    </select></label>
                    <label>Text color<input type="color" value={element.color || '#111111'} onChange={e => updateVisualElement(element.id, { color: e.target.value })}/></label>
                  </div>}
                  <div className="visual-style-grid">
                    <label>Background fill<input type="color" value={element.backgroundColor === 'transparent' ? '#ffffff' : (element.backgroundColor || '#ffffff')} onChange={e => updateVisualElement(element.id, { backgroundColor: e.target.value })}/></label>
                    <label><span>Transparent fill</span><input type="checkbox" checked={element.backgroundColor === 'transparent'} onChange={e => updateVisualElement(element.id, { backgroundColor: e.target.checked ? 'transparent' : '#ffffff' })}/></label>
                    <label>Border color<input type="color" value={element.borderColor || '#333333'} onChange={e => updateVisualElement(element.id, { borderColor: e.target.value })}/></label>
                    <label>Border width (mm)<input type="number" min="0" max="2" step="0.1" value={element.borderWidth ?? 0} onChange={e => updateVisualElement(element.id, { borderWidth: Math.max(0, Math.min(2, Number(e.target.value) || 0)) })}/></label>
                    <label>Corner radius (mm)<input type="number" min="0" max="10" step="0.5" value={element.borderRadius ?? 0} onChange={e => updateVisualElement(element.id, { borderRadius: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })}/></label>
                  </div>
                  {element.type === 'barcode' && <div className="visual-style-grid">
                    <label>Barcode format<select value={element.barcodeFormat || 'CODE128'} onChange={e => updateVisualElement(element.id, { barcodeFormat: e.target.value })}>
                      <option value="CODE128">Code 128</option><option value="CODE39">Code 39</option><option value="EAN13">EAN-13</option><option value="EAN8">EAN-8</option><option value="UPC">UPC-A</option><option value="ITF">ITF</option>
                    </select></label>
                    <label><span>Show encoded value</span><input type="checkbox" checked={element.displayValue !== false} onChange={e => updateVisualElement(element.id, { displayValue: e.target.checked })}/></label>
                  </div>}
                  <div className="visual-number-grid">
                    <label>X position (mm)<input type="number" step="0.5" min="0" max={settings.labelWidth} value={element.x} onChange={e => updateVisualElement(element.id, { x: Math.max(0, Math.min(Number(settings.labelWidth) - Number(element.width), Number(e.target.value))) })}/></label>
                    <label>Y position (mm)<input type="number" step="0.5" min="0" max={settings.labelHeight} value={element.y} onChange={e => updateVisualElement(element.id, { y: Math.max(0, Math.min(Number(settings.labelHeight) - Number(element.height), Number(e.target.value))) })}/></label>
                    <label>Width (mm)<input type="number" step="0.5" min="2" max={settings.labelWidth} value={element.width} onChange={e => updateVisualElement(element.id, { width: Math.max(2, Math.min(Number(settings.labelWidth) - Number(element.x), Number(e.target.value))) })}/></label>
                    <label>Height (mm)<input type="number" step="0.5" min="2" max={settings.labelHeight} value={element.height} onChange={e => updateVisualElement(element.id, { height: Math.max(2, Math.min(Number(settings.labelHeight) - Number(element.y), Number(e.target.value))) })}/></label>
                    <label>Font size (pt)<input type="number" min="5" max="36" value={element.fontSize} onChange={e => updateVisualElement(element.id, { fontSize: Math.max(5, Math.min(36, Number(e.target.value))) })}/></label>
                    <label>Alignment<select value={element.align} onChange={e => updateVisualElement(element.id, { align: e.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                  </div>
                  {element.type === 'text' && <label className="bold-toggle visual-bold"><input type="checkbox" checked={Boolean(element.bold)} onChange={e => updateVisualElement(element.id, { bold: e.target.checked })}/> Bold text</label>}
                  <button className="button danger-button" onClick={() => removeVisualElement(element.id)}><Trash2 size={14}/> Remove element</button>
                </>;
              })()}
            </>}
          </div>
        </div>
      </div>}
    </section>

    <div className="columns-layout"><section className="panel fields-panel"><div className="section-title"><span className="step">03</span><div><h2>Choose label content</h2><p>Select fields for simple labels.</p></div><span className="selected-count">{enabledFields.length} selected</span></div>{!headers.length ? <div className="empty">Upload a spreadsheet to see its columns.</div> : <div className="field-list">{fields.map(field => <label className="field-item" key={field.id}><input type="checkbox" checked={field.enabled} onChange={() => toggleField(field.id)}/><span>{field.label}</span></label>)}</div>}</section>

    <section id="step-print-layout" className="panel settings-panel"><div className="section-title"><span className="step">04</span><div><h2>Page and label layout</h2><p>Set paper, label dimensions and typography.</p></div></div><div className="settings-grid">
      <label>Page size<select value={settings.pageSize} onChange={e => setSetting('pageSize', e.target.value)}><option>A3</option><option>A4</option><option>A5</option><option>Letter</option><option>Legal</option><option value="Custom">Custom size</option></select></label>
      <label>Orientation<select value={settings.orientation} onChange={e => setSetting('orientation', e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
      {settings.pageSize === 'Custom' && <><label>Page width (mm)<input type="number" min="50" value={settings.customPageWidth} onChange={e => setSetting('customPageWidth', Number(e.target.value))}/></label><label>Page height (mm)<input type="number" min="50" value={settings.customPageHeight} onChange={e => setSetting('customPageHeight', Number(e.target.value))}/></label></>}
      <label>Label width (mm)<input type="number" min="10" step="0.1" value={settings.labelWidth} onChange={e => setSetting('labelWidth', Number(e.target.value))}/></label><label>Label height (mm)<input type="number" min="10" step="0.1" value={settings.labelHeight} onChange={e => setSetting('labelHeight', Number(e.target.value))}/></label>
      <label>Columns<input type="number" min="1" max="8" value={settings.columns} onChange={e => setSetting('columns', Math.min(8, Math.max(1, Math.round(Number(e.target.value) || 1))))}/></label><label>Rows per page<input type="number" min="1" max="30" value={settings.rows} onChange={e => setSetting('rows', Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1))))}/></label>
      <label>Horizontal gap (mm)<input type="number" min="0" step="0.5" value={settings.gapX} onChange={e => setSetting('gapX', Number(e.target.value))}/></label><label>Vertical gap (mm)<input type="number" min="0" step="0.5" value={settings.gapY} onChange={e => setSetting('gapY', Number(e.target.value))}/></label>
      <label>Font size (pt)<input type="number" min="5" max="36" value={settings.fontSize} onChange={e => setSetting('fontSize', Number(e.target.value))}/></label><label>Inner padding (mm)<input type="number" min="0" max="20" step="0.5" value={settings.padding} onChange={e => setSetting('padding', Number(e.target.value))}/></label>
      <label>Horizontal alignment<select value={settings.alignment} onChange={e => setSetting('alignment', e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Vertical alignment<select value={settings.vertical} onChange={e => setSetting('vertical', e.target.value)}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
    </div>
    <div className="print-calibration">
      <div className="print-calibration-heading"><strong>Print alignment & calibration</strong><span>Match your printer's printable area and compensate for small feed offsets. All measurements are in millimetres.</span></div>
      <div className="settings-grid calibration-grid">
        <label>Vertical page margin — top & bottom (mm)<input type="number" min="0" max="40" step="0.1" value={settings.printMarginTop} onChange={e => setSetting('printMarginTop', Math.max(0, Number(e.target.value) || 0))}/></label>
        <label>Horizontal page margin — left & right (mm)<input type="number" min="0" max="40" step="0.1" value={settings.printMarginSide} onChange={e => setSetting('printMarginSide', Math.max(0, Number(e.target.value) || 0))}/></label>
        <label>Horizontal offset X (mm)<input type="number" step="0.1" value={settings.printOffsetX} onChange={e => setSetting('printOffsetX', Number(e.target.value) || 0)}/></label>
        <label>Vertical offset Y (mm)<input type="number" step="0.1" value={settings.printOffsetY} onChange={e => setSetting('printOffsetY', Number(e.target.value) || 0)}/></label>
      </div>
      <div className="calibration-actions">
        <button className="button outline" onClick={printCalibrationTest}>Print alignment test</button>
        <button className="button secondary" onClick={() => { setSetting('printOffsetX', 0); setSetting('printOffsetY', 0); }}>Reset X/Y offsets</button>
      </div>
    </div>
    <div className={'layout-fit ' + (pageMetrics.fits ? 'fit-ok' : 'fit-warning')} role="status">
      {pageMetrics.valid
        ? (pageMetrics.fits
          ? 'Label grid fits the selected page: ' + pageMetrics.gridWidth.toFixed(1) + ' × ' + pageMetrics.gridHeight.toFixed(1) + ' mm.'
          : 'Label grid exceeds the printable page area (' + pageMetrics.printableWidth.toFixed(1) + ' × ' + pageMetrics.printableHeight.toFixed(1) + ' mm). Adjust rows, columns, label size or gaps.')
        : 'Enter valid page and label dimensions and non-negative gaps.'}
    </div><div className="settings-footer"><span><b>{perPage}</b> labels per page · <b>{pages.length}</b> page(s)</span><button className="text-button" onClick={resetSettings}><RotateCcw size={14}/> Reset settings</button></div></section></div>

    <section id="step-export" className="panel records-panel">
      <div className="section-title"><span className="step">05</span><div><h2>Select records to print</h2><p>Choose individual rows or print all records from the current worksheet.</p></div><span className="selected-count">{selectedIndexes.length} / {records.length} selected</span></div>
      <div className="record-toolbar">
        <input type="search" value={recordSearch} onChange={e => { setRecordSearch(e.target.value); setRecordPage(0); }} placeholder="Search names, registration numbers or any Excel value…"/>
        <button className="text-button" onClick={selectAllRecords} disabled={!records.length}>Select all</button>
        <button className="text-button" onClick={clearSelectedRecords} disabled={!selectedIndexes.length}>Clear selection</button>
      </div>
      {!records.length ? <div className="empty">Upload a worksheet to select its records.</div> : matchingIndexes.length === 0 ? <div className="empty">No records match your search.</div> : <div className="record-list">
        {visibleRecordIndexes.map(index => <label className="record-row" key={index}>
          <input type="checkbox" checked={selectedIndexes.includes(index)} onChange={() => toggleRecord(index)}/>
          <span><strong>{getValue(records[index], headers[0]) || 'Record ' + (index + 1)}</strong><small>{headers[1] ? headers[1] + ': ' + getValue(records[index], headers[1]) : 'Excel row ' + (index + 1)}</small></span>
          <em>#{index + 1}</em>
        </label>)}
      </div>}
      {matchingIndexes.length > pageSizeForRecords && <div className="record-pagination"><span>Page {recordPage + 1} of {recordPageCount} · {matchingIndexes.length} matching records</span><div><button className="text-button" disabled={recordPage === 0} onClick={() => setRecordPage(page => Math.max(0, page - 1))}>Previous</button><button className="text-button" disabled={recordPage + 1 >= recordPageCount} onClick={() => setRecordPage(page => Math.min(recordPageCount - 1, page + 1))}>Next</button></div></div>}
      <div className="record-actions">
        <button className="button primary" onClick={() => printLabels('selected')} disabled={!selectedIndexes.length}><Printer size={15}/> Print selected</button>
        <button className="button outline" onClick={() => exportPdf('selected')} disabled={!selectedIndexes.length}>PDF selected</button>
        <button className="button outline" onClick={() => exportExcel('selected')} disabled={!selectedIndexes.length}>Excel selected</button>
        <button className="button secondary" onClick={() => printLabels('all')} disabled={!records.length}>Print all</button>
      </div>
    </section>

    <section id="label-preview" className="panel preview-panel"><div className="section-title"><span className="step">06</span><div><h2>Live label preview</h2><p>Preview updates as you change content and layout, including visual element positions.</p></div><span className="live-tag"><Eye size={14}/> LIVE PREVIEW</span><button className="button outline print-button" onClick={() => exportPdf('all')}><FileSpreadsheet size={15}/> PDF</button><button className="button primary print-button" onClick={() => printLabels('all')}><Printer size={15}/> Print all</button></div>
      {!records.length ? <div className="empty">Your labels will appear here after you upload a file.</div> : !hasLabelContent ? <div className="empty">Add at least one field, text element, shape or image to preview.</div> : <><div className="preview-sheet"><div className="preview-grid">{previewRecords.map((record, index) => <React.Fragment key={index}>{renderLabel(record)}</React.Fragment>)}</div></div><div className="preview-footer">Showing {previewRecords.length} of {records.length} labels{records.length > 8 && <button className="text-button" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show fewer' : 'Show more'}</button>}</div></>}
    </section>

    <footer>Custom Labels Generator · Excel-powered label printing</footer>
    <div className="print-document">
      {printTestMode
        ? <div className="print-page"><div className="print-grid calibration-grid-output">{Array.from({ length: perPage }).map((_, index) => <div className="label calibration-label" key={index}><span>ALIGN {index + 1}</span><i aria-hidden="true"/></div>)}</div></div>
        : printPages.map((page, index) => <div className="print-page" key={index}><div className="print-grid">{page.map((record, i) => <React.Fragment key={i}>{renderLabel(record)}</React.Fragment>)}{Array.from({ length: Math.max(0, perPage - page.length) }).map((_, i) => <div className="label blank" key={'blank' + i}/>)}</div></div>)}
    </div>
  </main>;
}
