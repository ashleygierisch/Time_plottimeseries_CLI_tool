import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { format } from 'prettier';
import { DataTable } from './DataTable.tsx';
import { processCSV } from '../dataProcessing.ts';
import { assertSnapshot } from '../testing/snapshot.ts';

const testFilePath = fileURLToPath(import.meta.url);

const sampleCsv = `date,pct_change,amount,category
2023-01-01,0.15,45.5,High
2023-01-02,-0.8,-99.25,Low
2023-01-03,0.02,0.75,Medium
2023-01-04,1.0,100,High
2023-01-05,-0.33,-5.5,Low
2023-01-06,0.5,0.05,Medium`;

async function renderDataTableToString(): Promise<string> {
  const { formattedData, columns } = processCSV(sampleCsv);
  const element = React.createElement(DataTable, {
    formattedData,
    columns,
    hoveredDate: null,
    onHover: () => { },
  });
  const html = renderToStaticMarkup(element);
  return format(html, { parser: 'html' });
}

test('DataTable renders correctly', async (t) => {
  const rendered = await renderDataTableToString();
  await assertSnapshot(t, rendered, { testFilePath, extension: '.html' });
});

test('DataTable renders correctly with styled columns', async (t) => {
  const csv = `date,ratio{type: percent\\, places: 2},revenue{type: currency, label: 'Net revenue'}
2023-01-01,0.15,45.5
2023-01-02,-0.8,-99.25`;
  // The styles reach the table through the formatted values, not the markup:
  // the header that used to carry the labels now lives in the hover details.
  const { formattedData, columns } = processCSV(csv);
  const element = React.createElement(DataTable, {
    formattedData,
    columns,
    hoveredDate: null,
    onHover: () => { },
  });
  const html = renderToStaticMarkup(element);
  const rendered = await format(html, { parser: 'html' });

  await assertSnapshot(t, rendered, { testFilePath, extension: '.html' });
});

test('DataTable renders correctly when date column is not the first column', async (t) => {
  const csv = `val1,date,val2\n10,2023-01-01,20`;
  const { formattedData, columns } = processCSV(csv);
  const element = React.createElement(DataTable, {
    formattedData,
    columns,
    hoveredDate: null,
    onHover: () => { },
  });
  const html = renderToStaticMarkup(element);
  const rendered = await format(html, { parser: 'html' });

  await assertSnapshot(t, rendered, { testFilePath, extension: '.html' });
});
