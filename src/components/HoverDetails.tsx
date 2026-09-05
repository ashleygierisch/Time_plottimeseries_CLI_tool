import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type ColumnStyles, type FormattedDataPoint, formatColumnName, isDateColumn, isSeriesColumn } from '../dataProcessing.ts';
import { apportionColumnWidths } from '../columnWidths.ts';
import { cellText, EMPTY_VALUE, renderCellValue } from './CellValue.tsx';

interface HoverDetailsProps {
  formattedData: FormattedDataPoint[];
  hoveredDate: Date | null;
  columns: string[];
  columnColors: Record<string, string>;
  isolatedSeries: string | null;
  onSelectSeries: (series: string) => void;
  columnStyles?: ColumnStyles;
  /**
   * Reports the pinned column widths, so the data table below can adopt the
   * same layout and read as the body under this header.
   */
  onColumnWidths?: (widths: number[] | null) => void;
}

// useLayoutEffect warns when rendered on the server (the CLI report is rendered
// with renderToStaticMarkup), so fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface Measurement {
  /** Identifies the content the widths were measured for. */
  key: string;
  /** Width of the containing element when the measurement was taken. */
  containerWidth: number;
  widths: number[];
}

export const HoverDetails: React.FC<HoverDetailsProps> = ({
  formattedData,
  hoveredDate,
  columns,
  columnColors,
  isolatedSeries,
  onSelectSeries,
  columnStyles = {},
  onColumnWidths,
}) => {
  const currentData = hoveredDate
    ? formattedData.find(d => d.date.getTime() === hoveredDate.getTime())
    : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  // The value row only ever shows the hovered row, so laying the table out from
  // the visible content makes every column resize as the pointer moves. Instead
  // pick, per column, the longest value in the whole data set (character count
  // is a good enough proxy for width, and the candidate itself is measured for
  // real below) and size the columns from that once.
  const widestValues = useMemo(() => {
    const widest: Record<string, string> = {};
    for (const col of columns) widest[col] = EMPTY_VALUE;
    for (const row of formattedData) {
      for (const col of columns) {
        const text = cellText(isDateColumn(col) ? row.formattedDate : row[col]);
        if (text.length > widest[col].length) widest[col] = text;
      }
    }
    return widest;
  }, [formattedData, columns]);

  const headerLabels = useMemo(
    () => columns.map(col => formatColumnName(col, columnStyles[col])),
    [columns, columnStyles],
  );

  // Anything that changes the widest content invalidates the measurement.
  const measureKey = useMemo(
    () => JSON.stringify(columns.map((col, i) => [headerLabels[i], widestValues[col]])),
    [columns, headerLabels, widestValues],
  );

  const columnWidths = measurement?.key === measureKey ? measurement.widths : null;

  // First pass: the browser lays the table out with the sizing row below, which
  // holds the widest content each column can ever show. Second pass (and every
  // render after it): those widths are pinned with `table-layout: fixed`, so
  // hovering a different date can no longer move a column.
  useIsomorphicLayoutEffect(() => {
    if (columnWidths) return;
    const container = containerRef.current;
    const headerRow = headerRowRef.current;
    if (!container || !headerRow) return;
    const widths = apportionColumnWidths(
      Array.from(headerRow.cells, cell => cell.getBoundingClientRect().width)
    );
    if (widths.length !== columns.length) return;
    // Rendered geometry cannot be known before a render, so measuring and
    // storing it is the point of this effect rather than an accident. The
    // `columnWidths` guard above keeps it to a single pass per measureKey.
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    setMeasurement({ key: measureKey, containerWidth: container.clientWidth, widths });
  }, [columnWidths, measureKey, columns.length]);

  useEffect(() => {
    onColumnWidths?.(columnWidths);
  }, [columnWidths, onColumnWidths]);

  // Pinned widths are only valid for the width they were measured at, so drop
  // them when the container resizes and let the effect above measure again.
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setMeasurement(prev => (prev && prev.containerWidth !== container.clientWidth ? null : prev));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="hover-details" style={{
      padding: '1rem',
      background: '#111111',
      borderBottom: '1px solid #333',
      overflowX: 'auto',
      color: '#ffffff'
    }}>
      <table className="data-table" style={{ fontSize: '0.9rem', tableLayout: columnWidths ? 'fixed' : 'auto' }}>
        {columnWidths && (
          <colgroup>
            {columns.map((col, i) => (
              <col key={col} style={{ width: `${columnWidths[i]}px` }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr ref={headerRowRef}>
            {columns.map((col, i) => {
              const isDate = isDateColumn(col);
              const isSeries = isSeriesColumn(col, columnStyles);
              return (
                <th
                  key={col}
                  style={{
                    padding: '8px',
                    textAlign: isDate ? 'left' : undefined,
                    cursor: isSeries ? 'pointer' : undefined,
                    opacity: isSeries && isolatedSeries && isolatedSeries !== col ? 0.5 : 1,
                    textDecoration: isSeries && isolatedSeries === col ? 'underline' : 'none',
                    borderBottom: '1px solid #555'
                  }}
                  onClick={() => isSeries && onSelectSeries(col)}
                >
                  {headerLabels[i]}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Zero-height sizing row: only rendered until the widths are pinned. */}
          {!columnWidths && (
            <tr aria-hidden="true">
              {columns.map((col, i) => (
                <td key={col} style={{ padding: '0 8px', height: 0, border: 0 }}>
                  <div style={{ height: 0, overflow: 'hidden', visibility: 'hidden', whiteSpace: 'nowrap' }}>
                    <div>{headerLabels[i]}</div>
                    <div style={{ fontWeight: 'bold' }}>{widestValues[col]}</div>
                  </div>
                </td>
              ))}
            </tr>
          )}
          {/* Row of Colors */}
          <tr>
            {columns.map(col => {
              const isSeries = isSeriesColumn(col, columnStyles);
              return (
                <td
                  key={col}
                  style={{ padding: '4px 8px' }}
                >
                  {isSeries && (
                    <div style={{
                      width: '100%',
                      height: '6px',
                      backgroundColor: columnColors[col],
                      opacity: isolatedSeries && isolatedSeries !== col ? 0.3 : 1
                    }}></div>
                  )}
                </td>
              );
            })}
          </tr>
          {/* Row of Values */}
          <tr>
            {columns.map(col => {
              const isDate = isDateColumn(col);
              const isSeries = isSeriesColumn(col, columnStyles);
              const cellValue = isDate ? currentData?.formattedDate : currentData?.[col];
              return (
                <td
                  key={col}
                  style={{
                    padding: '8px',
                    textAlign: isDate ? 'left' : undefined,
                    fontWeight: 'bold',
                    opacity: isSeries && isolatedSeries && isolatedSeries !== col ? 0.5 : 1
                  }}
                >
                  {renderCellValue(cellValue)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};
