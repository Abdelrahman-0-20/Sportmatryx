/**
 * Client-side Excel → CSV conversion for the import panel.
 *
 * The server import route (/api/import) and the importCsv pipeline are
 * UNCHANGED: they keep accepting a plain CSV File. This module runs entirely
 * in the browser and hands the route a converted CSV file, so no backend
 * logic is touched (site-logic rule: add, don't modify).
 */

export function isExcelFileName(name: string): boolean {
  return /\.xlsx?$|\.xlsm$/i.test(name);
}

/**
 * Convert an uploaded Excel workbook to a CSV File in the browser.
 * Uses the first worksheet that contains any data.
 */
export async function excelFileToCsv(file: File): Promise<File> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((n) => {
      const ref = workbook.Sheets[n]?.["!ref"];
      return typeof ref === "string" && ref.length > 0;
    }) ?? workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Workbook has no readable sheet.");
  }
  const csv = XLSX.utils.sheet_to_csv(sheet, {
    FS: ",",
    blankrows: false,
  }).replace(/\r?\n$/, "");
  if (csv.trim().length === 0) {
    throw new Error("Sheet is empty.");
  }
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([csv], `${baseName}.csv`, { type: "text/csv" });
}
