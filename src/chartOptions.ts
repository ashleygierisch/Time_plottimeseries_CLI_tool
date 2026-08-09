/**
 * Chart-wide settings. Unlike column styles, these are not a property of the
 * data, so they come from the command line (injected as `window.__CHART_OPTIONS__`)
 * or from query parameters.
 */
export interface ChartOptions {
  yMax?: number;
  yMin?: number;
}

const PARAM_ALIASES: Record<keyof ChartOptions, string[]> = {
  yMax: ['yMax', 'y-max', 'ymax'],
  yMin: ['yMin', 'y-min', 'ymin'],
};

export function parseNumericOption(value: string | null | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export interface ChartOptionsSource {
  location: { href: string };
  __CHART_OPTIONS__?: ChartOptions;
}

export function getChartOptions(win: ChartOptionsSource): ChartOptions {
  const params = new URL(win.location.href).searchParams;
  const options: ChartOptions = { ...win.__CHART_OPTIONS__ };

  (Object.keys(PARAM_ALIASES) as (keyof ChartOptions)[]).forEach(key => {
    const alias = PARAM_ALIASES[key].find(name => params.has(name));
    const value = parseNumericOption(alias == null ? null : params.get(alias));
    if (value !== undefined) options[key] = value;
  });

  return options;
}
