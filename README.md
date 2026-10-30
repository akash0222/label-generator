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
- Spreadsheet parser pinned to the patched SheetJS 0.20.3 distribution.

## Example address label

```text
{@Salutation} {@Student Name} {@relationship} {@Father Name}
Address:- {@Address}, {@City}, {@State}, {@Pincode}
Mo. {@Mobile No}, {@Father Phone no:}
```

The designer is generic. Users can combine any available columns and fixed text to create student labels, postal address labels, inventory labels, event badges, and more.

## Printing

Choose the same paper size and orientation in the browser print dialog. Set scale to 100% / Actual size and disable browser headers and footers. Test on plain paper before using label stock; printer margins and sheet tolerances may require small adjustments.