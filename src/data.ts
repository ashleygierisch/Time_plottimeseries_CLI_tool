export async function getCSVData(
  win: Window & { __INITIAL_CSV__?: string },
  loadDefault: () => Promise<string>,
): Promise<string> {
  const url = new URL(win.location.href);
  const csvParam = url.searchParams.get('csv');

  if (csvParam) {
    return csvParam;
  }

  if (win.__INITIAL_CSV__) {
    return win.__INITIAL_CSV__;
  }

  return loadDefault();
}
