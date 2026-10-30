# Custom Labels Generator

A React + Vite application that turns Excel/CSV data into configurable printable labels. It supports both simple labels (selected columns as separate lines) and fully custom multi-line layouts built from any spreadsheet columns.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Use

1. Upload `.xlsx`, `.xls`, or `.csv`.
2. Choose label fields, or enable **Use custom line layout** to compose each printed line using fixed text and column placeholders such as `{Student Name}`.
3. Use `{Column Heading}` to insert a value from Excel. Use `{@relationship}` to automatically print `D/o` or `S/o` based on the Gender column, when present.
4. Reorder, bold, add, or remove custom lines.
5. Configure page size (A3, A4, A5, Letter, Legal, or custom width/height), orientation, label dimensions, rows, columns, gaps, alignment, font size, and padding.
6. Preview and print.

## Example custom label

```text
{Salutation} {Contact: Full Name} {@relationship} {Father Name}
Address:- {Address}, {City}, {State}, {Pincode}
Mo. {Mobile No}, {Father Phone no:}
```

The custom line designer is generic: users can create any layout for student labels, address labels, inventory labels, event badges, or other spreadsheet-based labels. The address example is not a separate mode.

## Printing note

Use the browser print dialog with scale set to 100% / Actual size and disable browser headers and footers. Test on plain paper before using label stock; printer margins and label-sheet tolerances may require adjustments.