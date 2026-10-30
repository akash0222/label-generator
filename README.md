# Custom Labels Generator

A React + Vite application that turns Excel/CSV data into configurable printable labels. Use simple selected-column labels or build a fully custom multi-line layout from any spreadsheet columns.

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Features

- Upload `.xlsx`, `.xls`, or `.csv` files (up to 20 MB) and automatically detect a header row.
- Select Excel columns for simple labels.
- Compose custom label lines from multiple Excel columns and fixed text.
- Reorder, bold, add, and remove custom lines.
- Use `{@relationship}` to print `D/o` or `S/o` based on the Gender column without printing Gender itself.
- Configure A3, A4, A5, Letter, Legal, or custom page width and height.
- Choose portrait or landscape orientation.
- Configure label dimensions, rows, columns, gaps, alignment, font size, and padding.
- Live preview, printable-area validation, and multi-page printing.
- Save and reuse named label templates in the browser.
- Export generated labels directly to PDF or Excel.
- Drag the line-number handle to reorder custom label lines.
- Optional visual canvas designer: add field/text elements, drag to position, resize with a corner handle, and adjust X/Y, width, height, font family, font size, weight, text color, fill, border and corner radius.
- Add QR codes and configurable barcodes (Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF) using Excel placeholders.
- Add an optimized image as a full-label background.
- Create, rename, switch, duplicate and delete multiple label design pages in one project.
- Add editable rectangle, circle and line shape elements.
- Upload separately positioned logo images as individual elements.
- Start with Address, Student, Inventory and Shipping ready-made layouts.
- Save visual layouts in reusable templates. Visual positioning, colors, borders, QR codes, barcodes, logos and background images are respected by print and PDF output. Named templates can store multiple design pages.
- Switch between worksheets in a multi-sheet workbook.
- Select individual records for printing and exports.
- Persist page and label settings between visits.
- Spreadsheet parser pinned to the patched SheetJS 0.20.3 distribution.

## Example address label

```text
{@Salutation} {@Student Name} {@relationship} {@Father Name}
Address:- {@Address}, {@City}, {@State}, {@Pincode}
Mo. {@Mobile No}, {@Father Phone no:}
```

The designer is generic. Users can combine any available columns and fixed text to create student labels, postal address labels, inventory labels, event badges, and more.

## Saved templates and browser settings

Templates and page/label settings are stored in the current browser using local storage. They are not synced across devices or browsers and are removed if the browser's site data is cleared.

## Exports

PDF export creates a downloadable PDF using the configured paper size, label dimensions, rows, columns, gaps, and alignment. Excel export creates a workbook with one row per generated label, its individual text lines, and a combined label text column.

## Printing

Choose the same paper size and orientation in the browser print dialog. Set scale to 100% / Actual size and disable browser headers and footers. Test on plain paper before using label stock; printer margins and sheet tolerances may require small adjustments.

## Automated regression tests

The project uses Playwright end-to-end tests for the core label-production workflow.

Install dependencies and the Chromium browser:

```bash
npm install
npx playwright install chromium
```

Run the desktop and mobile regression suites:

```bash
npm run test:e2e
```

Run with a visible browser:

```bash
npm run test:e2e:headed
```

The tests cover CSV import, sample data, label preview, saved templates, design-page operations, print-sheet calibration and fit validation, print queue calculations, PDF downloads, QR generation, and mobile layout. GitHub Actions runs the production build and regression suite on pushes to `main` and pull requests targeting `main`.
