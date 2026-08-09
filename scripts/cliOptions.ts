import type { ChartOptions } from '../src/chartOptions.ts';

export function usage(programName: string): string {
  return `Usage: ${programName} [options] [file.csv] > report.html

Reads the CSV from stdin when no file is given.

Options:
  --y-max <number>  Pin the top of the y scale
  --y-min <number>  Pin the bottom of the y scale
  -h, --help        Show this message`;
}

export interface CLIOptions {
  csvPath: string | null;
  chartOptions: ChartOptions;
  help: boolean;
  error: string | null;
}

interface Option {
  name: string;
  value: string | null;
}

function splitOption(arg: string): Option {
  const separator = arg.indexOf('=');
  if (separator === -1) return { name: arg, value: null };
  return { name: arg.slice(0, separator), value: arg.slice(separator + 1) };
}

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function invalid(name: string, value: string | null): string {
  return `${name} expects a number, got: ${value == null ? '(nothing)' : value}`;
}

export function parseArgs(args: string[]): CLIOptions {
  const chartOptions: ChartOptions = {};
  let csvPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg !== '-h' && !arg.startsWith('--')) {
      if (csvPath == null) csvPath = arg;
      continue;
    }

    const option = splitOption(arg);

    if (option.name === '-h' || option.name === '--help') {
      return { csvPath, chartOptions, help: true, error: null };
    }

    let value = option.value;
    if (value == null && i + 1 < args.length) {
      i++;
      value = args[i];
    }

    const parsed = parseNumber(value);

    if (option.name === '--y-max') {
      if (parsed == null) return { csvPath, chartOptions, help: false, error: invalid('--y-max', value) };
      chartOptions.yMax = parsed;
    } else if (option.name === '--y-min') {
      if (parsed == null) return { csvPath, chartOptions, help: false, error: invalid('--y-min', value) };
      chartOptions.yMin = parsed;
    } else {
      return { csvPath, chartOptions, help: false, error: `unknown option: ${option.name}` };
    }
  }

  return { csvPath, chartOptions, help: false, error: null };
}
