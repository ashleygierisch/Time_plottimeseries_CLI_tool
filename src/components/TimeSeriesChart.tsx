import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { type ColumnStyles, type DataPoint, isSeriesColumn } from '../dataProcessing.ts';
import type { ChartOptions } from '../chartOptions.ts';
import { subdivideGridPositions } from '../gridLines.ts';

const CLIP_ID = 'plot-area-clip';
const GRADIENT_ID = 'plot-area-gradient';

/**
 * Target number of major grid lines per axis. The axes label the very same
 * ticks, which is what keeps labels, major lines and fine lines on one grid.
 */
const MAJOR_TICKS = 10;

/** Fine grid lines per major interval, engineering-paper style. */
const GRID_DIVISIONS = 5;

const GRID_COLOR = '#cfe0f0';

/** Rescaling and isolating a series, as clicking a header does. */
const UPDATE_MS = 750;

/** The marker stroke that draws each series in when it first appears. */
const DRAW_MS = 1500;

const MARGIN = { top: 20, right: 30, bottom: 30, left: 80 };

interface TimeSeriesChartProps {
  data: DataPoint[];
  columns: string[];
  hoveredDate: Date | null;
  onHover: (date: Date | null) => void;
  isolatedSeries: string | null;
  isSticky: boolean;
  onToggleSticky: () => void;
  spreadDates: boolean;
  onToggleSpreadDates: () => void;
  columnColors: Record<string, string>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  columnStyles?: ColumnStyles;
  chartOptions?: ChartOptions;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  columns,
  hoveredDate,
  onHover,
  isolatedSeries,
  isSticky,
  onToggleSticky,
  spreadDates,
  onToggleSpreadDates,
  columnColors,
  onFileUpload,
  columnStyles = {},
  chartOptions = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const plottableColumns = useMemo(() => {
    return columns.filter(col => {
      return isSeriesColumn(col, columnStyles) && data.some(row => typeof row[col] === 'number');
    });
  }, [columns, data, columnStyles]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const innerWidth = dimensions.width - MARGIN.left - MARGIN.right;
  const innerHeight = dimensions.height - MARGIN.top - MARGIN.bottom;

  // The scales are shared by the two effects below -- the one that draws the
  // plot and the one that moves the cursor rule across it -- so they are
  // computed once here rather than inside either.
  const x = useMemo(
    () => d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, innerWidth]),
    [data, innerWidth]
  );

  const y = useMemo(() => {
    let yMax: number;
    let yMin: number;
    if (isolatedSeries) {
      yMax = d3.max(data, d => d[isolatedSeries] as number) || 0;
      yMin = d3.min(data, d => d[isolatedSeries] as number) || 0;
    } else {
      yMax = d3.max(data, d => Math.max(...plottableColumns.map(c => d[c] as number))) || 0;
      yMin = d3.min(data, d => Math.min(...plottableColumns.map(c => d[c] as number))) || 0;
    }
    if (yMin > 0) {
      yMin = 0;
    }

    // Explicit chart settings win over the data-derived domain.
    if (chartOptions.yMax != null) yMax = chartOptions.yMax;
    if (chartOptions.yMin != null) yMin = chartOptions.yMin;

    return d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);
  }, [data, plottableColumns, isolatedSeries, chartOptions, innerHeight]);

  // Draws the plot. Deliberately does not depend on `hoveredDate`: moving the
  // pointer must not re-enter this, or every mouse move would restart the
  // 750ms transitions below and rebuild every path.
  useEffect(() => {
    if (!containerRef.current || !svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);

    const width = dimensions.width;
    const height = dimensions.height;
    if (width === 0 || height === 0) return;

    // 1. Setup Groups (Idempotent)
    let g = svg.select<SVGGElement>('g.main-group');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'main-group');
      const defs = svg.append('defs');

      // Plot backdrop: black at the baseline, lifting to a barely-there blue
      // toward the top of the plot area.
      const gradient = defs.append('linearGradient')
        .attr('id', GRADIENT_ID)
        .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
      gradient.append('stop').attr('offset', '0%').attr('stop-color', '#1b2029');
      gradient.append('stop').attr('offset', '55%').attr('stop-color', '#0b0d11');
      gradient.append('stop').attr('offset', '100%').attr('stop-color', '#000000');

      // Order matters for layering
      g.append('rect').attr('class', 'plot-background').attr('fill', `url(#${GRADIENT_ID})`);
      g.append('g').attr('class', 'grid-minor').style('opacity', 0.07);
      g.append('g').attr('class', 'grid-v').style('opacity', 0.16);
      g.append('g').attr('class', 'grid-h').style('opacity', 0.16);
      g.append('g').attr('class', 'axis-x').attr('transform', `translate(0,${innerHeight})`);
      g.append('g').attr('class', 'axis-y');
      // Clip the lines so an explicit y-min/y-max crops the series instead of
      // letting them draw over the axes.
      defs.append('clipPath').attr('id', CLIP_ID).append('rect');
      g.append('g').attr('class', 'lines-group').attr('clip-path', `url(#${CLIP_ID})`);
      g.append('line').attr('class', 'cursor-rule')
        .attr('stroke', 'white').attr('stroke-width', 1).attr('stroke-dasharray', '4 4').style('opacity', 0);
      g.append('rect').attr('class', 'hover-overlay')
        .attr('width', innerWidth).attr('height', innerHeight).attr('fill', 'transparent');
    }

    svg.attr('width', width).attr('height', height);
    g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Update axes positions if dimensions changed
    g.select<SVGGElement>('.axis-x').attr('transform', `translate(0,${innerHeight})`);
    g.select<SVGGElement>('.hover-overlay').attr('width', innerWidth).attr('height', innerHeight);
    g.select('.plot-background')
      .attr('x', 0).attr('y', 0).attr('width', innerWidth).attr('height', innerHeight);
    svg.select(`#${CLIP_ID} rect`)
      .attr('x', 0).attr('y', 0).attr('width', innerWidth).attr('height', innerHeight);

    // 2. Transitions
    // One transition shared by every update below, so they move together. The
    // cast widens the element type: `.transition(t)` is called on selections of
    // several different element types, and each wants a transition it can
    // accept.
    const t = svg.transition().duration(UPDATE_MS) as unknown as
      d3.Transition<d3.BaseType, unknown, null, undefined>;

    // Major grid lines, on the same tick values the axes label.
    const yTicks = y.ticks(MAJOR_TICKS);
    const xTicks = x.ticks(MAJOR_TICKS);

    g.select<SVGGElement>('.grid-h')
      .transition(t)
      .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-innerWidth).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())
      .selectAll('line').attr('stroke', GRID_COLOR);

    g.select<SVGGElement>('.grid-v')
      .attr('transform', `translate(0,${innerHeight})`)
      .transition(t)
      .call(d3.axisBottom(x).tickValues(xTicks).tickSize(-innerHeight).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())
      .selectAll('line').attr('stroke', GRID_COLOR);

    // Fine grid, subdividing the major intervals exactly so the two line up.
    const minorLines = [
      ...subdivideGridPositions(yTicks.map(y), GRID_DIVISIONS, [0, innerHeight])
        .map(pos => ({ x1: 0, x2: innerWidth, y1: pos, y2: pos })),
      ...subdivideGridPositions(xTicks.map(x), GRID_DIVISIONS, [0, innerWidth])
        .map(pos => ({ x1: pos, x2: pos, y1: 0, y2: innerHeight })),
    ];

    g.select('.grid-minor')
      .selectAll<SVGLineElement, typeof minorLines[number]>('line')
      .data(minorLines)
      .join('line')
      .attr('stroke', GRID_COLOR)
      .attr('shape-rendering', 'crispEdges')
      .attr('x1', d => d.x1).attr('x2', d => d.x2)
      .attr('y1', d => d.y1).attr('y2', d => d.y2);

    // Axes
    g.select<SVGGElement>('.axis-x').call(d3.axisBottom(x).tickValues(xTicks)); // X usually static unless data changes time range
    g.select<SVGGElement>('.axis-y').transition(t).call(d3.axisLeft(y).tickValues(yTicks));

    // 4. Lines
    const lineGenerator = d3.line<DataPoint>().x(d => x(d.date));

    // Line for dropping to zero
    const zeroLineGenerator = d3.line<DataPoint>().x(d => x(d.date)).y(y(0));

    const linesGroup = g.select('.lines-group');
    const lines = linesGroup.selectAll<SVGPathElement, string>('path.series-line')
      .data(plottableColumns, d => d);

    const pathFor = (col: string) => {
      if (isolatedSeries && isolatedSeries !== col) {
        return zeroLineGenerator(data) || '';
      }
      // Active line
      return lineGenerator.y(d => y(d[col] as number))(data) || '';
    };

    // Enter: draw the line in its final shape, then reveal it left to right by
    // walking a full-length dash gap off the end, like a marker stroke. The
    // transition is named so the shared `t` on updates never cancels it.
    lines.enter()
      .append('path')
      .attr('class', 'series-line')
      .attr('fill', 'none')
      .attr('stroke-width', 1.5)
      // null rather than undefined for a column with no assigned colour: d3
      // reads that as "remove the attribute" instead of writing "undefined".
      .attr('stroke', col => columnColors[col] ?? null)
      .attr('d', pathFor)
      .each(function () {
        const path = d3.select(this);
        const length = typeof this.getTotalLength === 'function' ? this.getTotalLength() : 0;
        if (!length) return;

        // Leaving the dash attributes behind would clip later updates, so drop
        // them however the reveal ends.
        const clearDash = () => {
          path.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
        };

        path
          .attr('stroke-dasharray', `${length} ${length}`)
          .attr('stroke-dashoffset', length)
          .transition('draw')
          .duration(DRAW_MS)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0)
          .on('end', clearDash)
          .on('interrupt', clearDash)
          .on('cancel', clearDash);
      });

    // Update
    lines
      .transition(t)
      .attr('stroke', col => columnColors[col] ?? null) // Ensure color updates if needed
      .attr('d', pathFor);

    // Exit
    lines.exit().remove();

    // 4. Interactions
    // Re-bound rather than added, so the handler closes over the current data
    // and scales instead of the ones it was first drawn with.
    g.select('.hover-overlay')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const date = x.invert(mx);
        const index = d3.bisector((d: DataPoint) => d.date).left(data, date);
        const d0 = data[index - 1];
        const d1 = data[index];
        let d = d0;
        if (d1 && d0) {
          d = (date.getTime() - d0.date.getTime() > d1.date.getTime() - date.getTime()) ? d1 : d0;
        } else if (d1) {
          d = d1;
        }
        if (d) onHover(d.date);
      });
  }, [data, plottableColumns, isolatedSeries, columnColors, onHover, dimensions, x, y, innerWidth, innerHeight]);

  // The cursor rule, on its own so a mouse move touches one line's geometry
  // rather than re-running the whole draw above.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const rule = d3.select(svg).select('.cursor-rule');
    if (rule.empty()) return;

    const xPos = hoveredDate == null ? null : x(hoveredDate);
    if (xPos == null || xPos < 0 || xPos > innerWidth) {
      rule.style('opacity', 0);
      return;
    }

    rule
      .attr('x1', xPos).attr('x2', xPos)
      .attr('y1', 0).attr('y2', innerHeight)
      .style('opacity', 1);
  }, [hoveredDate, x, innerWidth, innerHeight]);

  return (
    <div style={{
      position: 'relative', // Changed from internal stickiness
      zIndex: 90,
      background: '#000000', // Match body bg
      borderBottom: '1px solid #333',
      color: '#ffffff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem', gap: '1rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.8rem', cursor: 'pointer', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <input type="checkbox" checked={isSticky} onChange={onToggleSticky} /> Sticky Plot
        </label>
        <label style={{ fontSize: '0.8rem', cursor: 'pointer', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <input type="checkbox" checked={spreadDates} onChange={onToggleSpreadDates} /> Spread Duplicate Dates
        </label>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="upload-button"
        >
          Upload CSV
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".csv"
          onChange={onFileUpload}
        />
      </div>
      <div ref={containerRef} className="chart-container">
        <svg ref={svgRef} style={{ display: 'block' }}></svg>
      </div>
    </div>
  );
};
