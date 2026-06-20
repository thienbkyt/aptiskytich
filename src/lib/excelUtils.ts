/**
 * Read an Excel file from a FileReader result (ArrayBuffer) and return sheets as JSON arrays.
 */
export async function readExcelFile(buffer: ArrayBuffer): Promise<{ sheetNames: string[]; sheets: Record<string, Record<string, any>[]> }> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets: Record<string, Record<string, any>[]> = {};
  const sheetNames: string[] = [];

  workbook.eachSheet((worksheet) => {
    const name = worksheet.name;
    sheetNames.push(name);
    const rows: Record<string, any>[] = [];
    const headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value ?? "");
        });
        return;
      }
      const obj: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const key = headers[colNumber];
        if (key) obj[key] = cell.value;
      });
      if (Object.keys(obj).length > 0) rows.push(obj);
    });

    sheets[name] = rows;
  });

  return { sheetNames, sheets };
}

/**
 * Create and download an Excel workbook from sheet definitions.
 */
export async function createAndDownloadExcel(
  filename: string,
  sheetDefs: { name: string; cols: Record<string, any>[] }[]
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  for (const { name, cols } of sheetDefs) {
    if (cols.length === 0) continue;
    const worksheet = workbook.addWorksheet(name);
    const keys = Object.keys(cols[0]);
    worksheet.columns = keys.map((key) => ({ header: key, key, width: 30 }));
    for (const row of cols) {
      worksheet.addRow(row);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
