/**
 * The phone cards of a data table (src/styles/tables.css, .cards-mobile) label each field with its cell's data-label.
 * Returns the labels that differ from their column header, as `header ≠ label` (empty when they all match), and
 * how many cells carry a label, so a test can also check that the card has fields at all.
 */
export function cardLabelMismatches(table: HTMLTableElement): {
  labelled: number;
  mismatches: string[];
} {
  const headers = Array.from(table.querySelectorAll('thead th')).map(
    (th) => th.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
  const mismatches: string[] = [];
  let labelled = 0;
  for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
    Array.from(row.children).forEach((cell, index) => {
      const label = cell.getAttribute('data-label');
      if (label === null) return;
      labelled += 1;
      if (label !== headers[index]) mismatches.push(`${headers[index]} ≠ ${label}`);
    });
  }
  return { labelled, mismatches };
}
