import React, { useRef } from 'react';
import { isDateColumn, type FormattedDataPoint } from '../dataProcessing.ts';
import { renderCellValue } from './CellValue.tsx';

interface DataTableProps {
  formattedData: FormattedDataPoint[];
  columns: string[];
  hoveredDate: Date | null;
  onHover: (date: Date | null) => void;
  /**
   * Column widths measured by the hover details, which labels these columns and
   * so has to line up with them. Without them the table lays itself out.
   */
  columnWidths?: number[] | null;
}

export const DataTable: React.FC<DataTableProps> = ({ formattedData, columns, hoveredDate, onHover, columnWidths }) => {
  const tableRef = useRef<HTMLTableElement>(null);

  // The hover details row is this table's header, so the two only read as one
  // table while they share a column layout.
  const pinnedWidths = columnWidths?.length === columns.length ? columnWidths : null;

  return (
    <table
      ref={tableRef}
      className="data-table"
      style={{ tableLayout: pinnedWidths ? 'fixed' : 'auto' }}
    >
      {pinnedWidths && (
        <colgroup>
          {columns.map((col, i) => (
            <col key={col} style={{ width: `${pinnedWidths[i]}px` }} />
          ))}
        </colgroup>
      )}
      <tbody>
        {formattedData.map((row, i) => {
          const isHighlighted = hoveredDate && row.date.getTime() === hoveredDate.getTime();
          return (
            <tr
              key={row.date.getTime()}
              style={{ backgroundColor: isHighlighted ? '#333' : (i % 2 === 0 ? '#0d0d0d' : '#000000') }}
              onMouseEnter={() => onHover(row.date)}
            >
              {columns.map(col => {
                const isDate = isDateColumn(col);
                return (
                  <td
                    key={col}
                    style={{
                      padding: '8px',
                      textAlign: isDate ? 'left' : undefined
                    }}
                  >
                    {renderCellValue(isDate ? row.formattedDate : row[col])}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
