import assert from 'node:assert';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { cellText, EMPTY_VALUE, renderCellValue } from './CellValue.tsx';

const link = { linkText: 'Docs', url: new URL('https://d3js.org/') };

function render(val: Parameters<typeof renderCellValue>[0]): string {
  return renderToStaticMarkup(<>{renderCellValue(val)}</>);
}

describe('cellText', () => {
  it('reads a link as its label, which is what the cell shows', () => {
    assert.strictEqual(cellText(link), 'Docs');
  });

  it('reads a date in the same form the report writes it', () => {
    assert.strictEqual(cellText(new Date('2023-01-01T00:00:00Z')), '2023-01-01T00:00:00.000Z');
  });

  it('stands in for a value the row does not have', () => {
    assert.strictEqual(cellText(undefined), EMPTY_VALUE);
  });

  it('passes a plain string through', () => {
    assert.strictEqual(cellText('45.50'), '45.50');
  });
});

describe('renderCellValue', () => {
  it('shows exactly the text cellText measured, so pinned widths fit', () => {
    for (const val of [link, new Date('2023-01-01T00:00:00Z'), '45.50', undefined]) {
      const text = renderToStaticMarkup(<>{cellText(val)}</>);
      assert.ok(
        render(val).includes(text),
        `rendered cell does not contain its measured text: ${cellText(val)}`,
      );
    }
  });

  it('renders a link, and opens it without handing over the opener', () => {
    const html = render(link);

    assert.match(html, /href="https:\/\/d3js\.org\/"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, />Docs<\/a>/);
  });

  it('renders anything else as text, with no markup of its own', () => {
    assert.strictEqual(render('45.50'), '45.50');
    assert.strictEqual(render(undefined), EMPTY_VALUE);
  });
});
