import * as d3 from 'd3';

export interface DataPoint {
  date: Date;
  [key: string]: Date | number | string;
}

export interface LinkData {
  linkText: string;
  url: URL;
}

export interface FormattedDataPoint {
  date: Date;
  formattedDate: string;
  [key: string]: string | Date | LinkData;
}

export type NumberFormatter = (val: number) => string;

export type ColumnFormatType = 'percent' | 'decimal' | 'integer' | 'currency';

export interface ColumnStyle {
  type?: ColumnFormatType;
  places?: number;
  currency?: string;
  color?: string;
  label?: string;
  plot?: boolean;
}

export type ColumnStyles = Record<string, ColumnStyle>;

const FORMAT_TYPES: Record<string, ColumnFormatType> = {
  percent: 'percent',
  percentage: 'percent',
  pct: 'percent',
  decimal: 'decimal',
  number: 'decimal',
  float: 'decimal',
  integer: 'integer',
  int: 'integer',
  currency: 'currency',
  money: 'currency',
};

export function formatDate(date: Date): string {
  // slice, not split('T')[0]: an ISO string is always 24 characters, so this
  // is the same answer without an index that could in principle miss.
  return date.toISOString().slice(0, 10);
}

/** Narrows a formatted cell value to the markdown-style link it may hold. */
export function isLinkData(val: unknown): val is LinkData {
  return typeof val === 'object' && val !== null && 'linkText' in val && 'url' in val;
}

/**
 * True for the column the x axis is drawn from. Which column that is, is a
 * property of its name and nothing else, so every reader has to agree on the
 * same rule -- including that the name is matched case-insensitively.
 */
export function isDateColumn(name: string): boolean {
  return name.toLowerCase() === 'date';
}

/** True when a column is a candidate for plotting, i.e. not the date and not opted out. */
export function isSeriesColumn(name: string, columnStyles: ColumnStyles = {}): boolean {
  return !isDateColumn(name) && columnStyles[name]?.plot !== false;
}

export function formatColumnName(name: string, style?: ColumnStyle): string {
  if (style?.label) return style.label;
  if (!name) return name;
  const withSpaces = name.replace(/_/g, ' ');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Splits a CSV header line into fields. Beyond standard double-quoting, commas
 * inside a `{...}` style spec do not separate fields, and a comma there can also
 * be escaped with a backslash.
 */
export function splitHeaderLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  let depth = 0;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (quoted) {
      if (char !== '"') {
        current += char;
      } else if (line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"' && current === '') {
      quoted = true;
    } else if (char === '\\' && depth > 0 && i + 1 < line.length) {
      i++;
      current += line[i];
    } else if (char === ',' && depth === 0) {
      fields.push(current);
      current = '';
    } else {
      if (char === '{') depth++;
      else if (char === '}' && depth > 0) depth--;
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

/** Splits a style spec body on commas, ignoring commas inside quoted values. */
function splitSpecEntries(spec: string): string[] {
  const entries: string[] = [];
  let current = '';
  let quote: string | null = null;

  for (const char of spec) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ',') {
      entries.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  entries.push(current);
  return entries;
}

/**
 * Parses the body of a column style spec, e.g. `type: decimal, places: 2`.
 * Unrecognized keys and values are ignored so a typo cannot break the plot.
 */
export function parseColumnStyle(spec: string): ColumnStyle {
  const style: ColumnStyle = {};

  splitSpecEntries(spec).forEach(entry => {
    const separator = entry.indexOf(':');
    if (separator === -1) return;

    const key = entry.slice(0, separator).trim().toLowerCase();
    const value = entry.slice(separator + 1).trim();
    if (!value) return;

    switch (key) {
      case 'type': {
        const type = FORMAT_TYPES[value.toLowerCase()];
        if (type) style.type = type;
        break;
      }
      case 'places':
      case 'decimals': {
        const places = Number(value);
        if (Number.isInteger(places) && places >= 0 && places <= 20) style.places = places;
        break;
      }
      case 'currency':
        // Intl throws on anything that is not a 3-letter code.
        if (/^[a-zA-Z]{3}$/.test(value)) style.currency = value.toUpperCase();
        break;
      case 'color':
        style.color = value;
        break;
      case 'label':
        style.label = value;
        break;
      case 'plot':
        style.plot = value.toLowerCase() !== 'false';
        break;
    }
  });

  return style;
}

/** Splits a header field into its column name and its optional `{...}` style spec. */
export function parseColumnHeader(header: string): { name: string; style: ColumnStyle } {
  const match = header.match(/^([^{]*)\{(.*)\}\s*$/s);
  if (!match) return { name: header, style: {} };
  const [, name = '', spec = ''] = match;
  return { name: name.trim(), style: parseColumnStyle(spec) };
}

function escapeCSVField(field: string): string {
  return /["\n,]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

/**
 * Pulls style specs off the header line, returning the CSV with plain column
 * names so it can be handed to a standard CSV parser.
 */
export function extractColumnStyles(csvString: string): {
  csv: string;
  columnStyles: ColumnStyles;
} {
  const newline = csvString.indexOf('\n');
  const header = newline === -1 ? csvString : csvString.slice(0, newline);

  if (!header.includes('{')) return { csv: csvString, columnStyles: {} };

  const carriageReturn = header.endsWith('\r');
  const rest = newline === -1 ? '' : csvString.slice(newline);
  const columnStyles: ColumnStyles = {};

  const names = splitHeaderLine(carriageReturn ? header.slice(0, -1) : header).map(field => {
    const { name, style } = parseColumnHeader(field);
    if (Object.keys(style).length > 0) columnStyles[name] = style;
    return escapeCSVField(name);
  });

  return { csv: names.join(',') + (carriageReturn ? '\r' : '') + rest, columnStyles };
}

export function parseCSV(csvString: string): {
  data: DataPoint[];
  columns: string[];
  columnStyles: ColumnStyles;
} {
  const { csv, columnStyles } = extractColumnStyles(csvString);

  // csvParseRows, not csvParse. csvParse compiles a row-to-object function with
  // `new Function`, assembling the source out of the column names -- which can
  // come from the `?csv=` parameter. That forces 'unsafe-eval' into the CSP,
  // which would undo the point of hashing the bundle. Rows are plain arrays, so
  // parsing them costs nothing but an index lookup.
  const rows = d3.csvParseRows(csv);

  const [columns, ...records] = rows;
  // A file with no header, or a header and nothing under it, has no data.
  if (columns === undefined || records.length === 0) {
    return { data: [], columns: [], columnStyles };
  }

  const dateIndex = columns.findIndex(isDateColumn);

  if (dateIndex === -1) return { data: [], columns, columnStyles };

  const data = records
    .map(record => {
      const rawDate = record[dateIndex];
      if (!rawDate) return null;
      const date = new Date(rawDate);
      if (isNaN(date.getTime())) return null;

      const point: DataPoint = { date };
      columns.forEach((col, i) => {
        if (isDateColumn(col)) {
          point[col] = date;
        } else {
          const rawValue = record[i] || '';
          const numValue = +rawValue;
          point[col] = isNaN(numValue) ? rawValue : numValue;
        }
      });
      return point;
    })
    .filter((d): d is DataPoint => d !== null);

  return { data, columns, columnStyles };
}

/** Builds a formatter from an explicit column style, or null if it says nothing about numbers. */
function styledFormatter(style: ColumnStyle | undefined): NumberFormatter | null {
  if (!style || (!style.type && style.places == null)) return null;

  switch (style.type) {
    case 'percent': {
      const places = style.places ?? 1;
      return (val: number) =>
        val.toLocaleString(undefined, {
          style: 'percent',
          minimumFractionDigits: places,
          maximumFractionDigits: places,
        });
    }
    case 'currency': {
      const places = style.places ?? 2;
      return (val: number) =>
        val.toLocaleString(undefined, {
          style: 'currency',
          currency: style.currency ?? 'USD',
          minimumFractionDigits: places,
          maximumFractionDigits: places,
        });
    }
    case 'integer':
      return (val: number) =>
        val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    default: {
      const places = style.places ?? 2;
      return (val: number) =>
        val.toLocaleString(undefined, {
          minimumFractionDigits: places,
          maximumFractionDigits: places,
        });
    }
  }
}

export function analyzeColumnFormatters(
  data: DataPoint[],
  columns: string[],
  columnStyles: ColumnStyles = {},
): Record<string, NumberFormatter> {
  const formatters: Record<string, NumberFormatter> = {};

  columns.forEach(col => {
    if (isDateColumn(col)) return;

    const styled = styledFormatter(columnStyles[col]);
    if (styled) {
      formatters[col] = styled;
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    let hasNumbers = false;

    data.forEach(row => {
      const val = row[col];
      if (typeof val === 'number') {
        hasNumbers = true;
        if (val < min) min = val;
        if (val > max) max = val;
      }
    });

    if (!hasNumbers) {
      formatters[col] = (val: number) =>
        val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return;
    }

    if (min >= -2 && max <= 2) {
      formatters[col] = (val: number) =>
        val.toLocaleString(undefined, {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
    } else if (min >= -10 && max <= 10) {
      formatters[col] = (val: number) =>
        val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    } else {
      formatters[col] = (val: number) =>
        val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
  });

  return formatters;
}

export function spreadDuplicateDates(data: DataPoint[]): DataPoint[] {
  const msPerDay = 24 * 60 * 60 * 1000;

  const groups = new Map<number, number[]>();
  data.forEach((d, i) => {
    const ts = d.date.getTime();
    groups.set(ts, [...(groups.get(ts) ?? []), i]);
  });

  return data.map((d, i) => {
    const group = groups.get(d.date.getTime())!;
    if (group.length <= 1) return d;
    const pos = group.indexOf(i);
    return { ...d, date: new Date(d.date.getTime() + Math.floor((pos * msPerDay) / group.length)) };
  });
}

/**
 * Everything a CSV yields. These four move together -- a set of columns only
 * describes the rows it was parsed alongside -- so they are one value rather
 * than four.
 */
export interface ProcessedCSV {
  data: DataPoint[];
  formattedData: FormattedDataPoint[];
  columns: string[];
  columnStyles: ColumnStyles;
}

/** A parsed nothing, for before the first CSV arrives. */
export const EMPTY_CSV: ProcessedCSV = {
  data: [],
  formattedData: [],
  columns: [],
  columnStyles: {},
};

export function processCSV(csvString: string): ProcessedCSV {
  const { data, columns, columnStyles } = parseCSV(csvString);

  if (data.length === 0) {
    return { data: [], formattedData: [], columns: [], columnStyles };
  }

  const formatters = analyzeColumnFormatters(data, columns, columnStyles);

  const formattedData = data.map(row => {
    const formatted: FormattedDataPoint = {
      date: row.date,
      formattedDate: formatDate(row.date),
    };
    columns.forEach(col => {
      let formattedVal: string | LinkData;
      if (isDateColumn(col)) {
        formattedVal = formatDate(row.date);
      } else {
        const val = row[col];
        if (typeof val === 'number' && formatters[col]) {
          formattedVal = formatters[col](val);
        } else if (typeof val === 'string') {
          const linkMatch = val.match(/^\[(.*?)\]\((.*?)\)$/);
          if (linkMatch) {
            const [, linkText = '', href = ''] = linkMatch;
            try {
              formattedVal = { linkText, url: new URL(href) };
            } catch {
              formattedVal = val;
            }
          } else {
            formattedVal = val;
          }
        } else {
          formattedVal = String(val);
        }
      }

      if (col !== 'date' && col !== 'formattedDate') {
        formatted[col] = formattedVal;
      }
    });
    return formatted;
  });

  return { data, formattedData, columns, columnStyles };
}
