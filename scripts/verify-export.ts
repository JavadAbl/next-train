/* Verify the exported xlsx: RTL view, frozen header, rows, amber mismatch fill, totals line. */
import ExcelJS from "exceljs";

async function check(file: string, expectRows: number, expectMismatch: number) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const view = ws.views[0] as { rightToLeft?: boolean; state?: string; ySplit?: number };
  const rows = [];
  ws.eachRow((row, n) => {
    if (n >= 4 && n <= 3 + expectRows) rows.push(row);
  });
  const mismatchRows = rows.filter((r) => (r.getCell(9).fill as { fgColor?: { argb?: string } } | undefined)?.fgColor?.argb === "FFFDE68A" || JSON.stringify((r.getCell(1).fill as { fgColor?: { argb?: string } })?.fgColor)?.includes("FDE68A"));
  const header = ws.getRow(3).getCell(9).value;
  const title = ws.getRow(1).getCell(1).value;
  const meta = String(ws.getRow(2).getCell(1).value);
  const lastRow = ws.getRow(4 + expectRows);
  const totals = lastRow.getCell(1).value;

  console.log(`=== ${file}`);
  console.log("sheet:", ws.name, "| rightToLeft:", view?.rightToLeft, "| state:", view?.state, "ySplit:", view?.ySplit);
  console.log("title:", title);
  console.log("meta:", meta);
  console.log("header[9] («تطبیق سریال»):", header);
  console.log("data rows:", rows.length, "(expect", expectRows + ")");
  console.log("mismatch-highlighted rows:", mismatchRows.length, "(expect", expectMismatch + ")");
  if (rows[0]) {
    const r = rows[0];
    console.log("first row:", [1, 2, 3, 5, 7, 8, 9, 10].map((c) => r.getCell(c).value).join(" | "));
  }
  if (expectMismatch > 0 && mismatchRows[0]) {
    const m = mismatchRows[0];
    console.log("mismatch row:", [2, 4, 7, 8, 9].map((c) => m.getCell(c).value).join(" | "), "| bold9:", (m.getCell(9).font as { bold?: boolean })?.bold);
  }
  console.log("totals line:", totals);
  console.log("autoFilter:", JSON.stringify(ws.autoFilter));
  const ok = view?.rightToLeft === true && rows.length === expectRows && mismatchRows.length === expectMismatch && !!totals;
  console.log("RESULT:", ok ? "PASS" : "FAIL");
  return ok;
}

const a = await check("/tmp/test-export.xlsx", 1, 1); // mismatch-only export
const b = await check("/tmp/test-export-all.xlsx", 14, 1); // full export (14 seed records)
process.exit(a && b ? 0 : 1);
