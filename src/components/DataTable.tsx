import React, { useRef } from 'react';
import type { FormattedDataPoint, LinkData } from '../dataProcessing';

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

const renderCellValue = (val: string | Date | LinkData) => {
  if (val && typeof val === 'object' && 'linkText' in val && 'url' in val) {
    return (
      <a 
        href={val.url.toString()} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ color: '#4da6ff', textDecoration: 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
      >
        {val.linkText}
      </a>
    );
  }
  return String(val);
};

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
                   const isDate = col.toLowerCase() === 'date';
                   const cellValue = isDate ? row.formattedDate : row[col];
                   return (
                     <td 
                       key={col} 
                       style={{ 
                         padding: '8px',
                         textAlign: isDate ? 'left' : undefined
                       }}
                     >
                      {renderCellValue(cellValue)}
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
