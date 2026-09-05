import { useCallback, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { EMPTY_CSV, processCSV, spreadDuplicateDates, type ProcessedCSV } from './dataProcessing.ts';
import { TimeSeriesChart } from './components/TimeSeriesChart.tsx';
import { HoverDetails } from './components/HoverDetails.tsx';
import { DataTable } from './components/DataTable.tsx';
import { getCSVData } from './data.ts';
import { type ChartOptions, getChartOptions } from './chartOptions.ts';

declare global {
  interface Window {
    __INITIAL_CSV__?: string;
    __CHART_OPTIONS__?: ChartOptions;
  }
}

function App() {
  // The four parts of a parsed CSV are always replaced together, so they are
  // one piece of state. Held apart, a render could catch new columns against
  // the previous rows.
  const [dataset, setDataset] = useState<ProcessedCSV>(EMPTY_CSV);
  const { data, formattedData, columns, columnStyles } = dataset;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartOptions = useMemo(() => getChartOptions(window), []);

  // The hover details doubles as the data table's header, and hands down the
  // column widths it measured so the two line up.
  const [columnWidths, setColumnWidths] = useState<number[] | null>(null);

  // Interaction State
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [isolatedSeries, setIsolatedSeries] = useState<string | null>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [spreadDates, setSpreadDates] = useState(true);

  // Every CSV arrives through here, however it was fetched, so that one CSV is
  // rejected and one view is reset the same way whether it came from the page
  // load or from the upload button.
  const loadCSV = useCallback(async (readCSV: () => Promise<string>) => {
    setLoading(true);
    setError(null);

    try {
      const result = processCSV(await readCSV());
      if (result.data.length === 0) throw new Error('No valid data found in CSV');

      setDataset(result);
      setIsolatedSeries(null);
      setHoveredDate(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetching the page's own CSV is the external system this effect exists to
  // read from, and `loadCSV` raises the loading flag before it awaits
  // anything. That is the render this is here to cause, not a cascade.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCSV(() => getCSVData(window, async () => {
      const response = await fetch('/data.csv');
      if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
      return response.text();
    }));
  }, [loadCSV]);

  // Apply date spreading
  const displayData = useMemo(() => {
    if (!spreadDates) return data;
    return spreadDuplicateDates(data);
  }, [data, spreadDates]);

  const displayFormattedData = useMemo(() => {
    if (!spreadDates) return formattedData;
    return formattedData.map((fd, i) => ({ ...fd, date: displayData[i].date }));
  }, [formattedData, displayData, spreadDates]);

  // Generate Colors
  const columnColors = useMemo(() => {
    const colors: Record<string, string> = {};
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    columns.forEach(col => {
      // Always advance the scale so styling one column does not recolor the rest.
      const generated = colorScale(col);
      colors[col] = columnStyles[col]?.color ?? generated;
    });
    return colors;
  }, [columns, columnStyles]);

  // Handlers
  const handleSelectSeries = (series: string) => {
    setIsolatedSeries(prev => prev === series ? null : series);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadCSV(() => file.text());
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div className="App">
      <div style={{
        position: isSticky ? 'sticky' : 'static',
        top: 0,
        zIndex: 100,
        backgroundColor: '#000000' // Ensure opacity
      }}>
        <TimeSeriesChart
          data={displayData}
          columns={columns}
          hoveredDate={hoveredDate}
          onHover={setHoveredDate}
          isolatedSeries={isolatedSeries}
          isSticky={isSticky}
          onToggleSticky={() => setIsSticky(!isSticky)}
          spreadDates={spreadDates}
          onToggleSpreadDates={() => setSpreadDates(!spreadDates)}
          columnColors={columnColors}
          onFileUpload={handleFileUpload}
          columnStyles={columnStyles}
          chartOptions={chartOptions}
        />
        <HoverDetails
          formattedData={displayFormattedData}
          hoveredDate={hoveredDate}
          columns={columns}
          columnColors={columnColors}
          isolatedSeries={isolatedSeries}
          onSelectSeries={handleSelectSeries}
          columnStyles={columnStyles}
          onColumnWidths={setColumnWidths}
        />
      </div>
      <div className="data-table-container">
        <DataTable
          formattedData={displayFormattedData}
          columns={columns}
          hoveredDate={hoveredDate}
          onHover={setHoveredDate}
          columnWidths={columnWidths}
        />
      </div>
    </div>
  );
}

export default App;
