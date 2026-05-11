import fs from "fs";
import xlsx from "xlsx";

const path = "./public/Basketball Thinmaiah Nov 29 2025.xlsx";
if (!fs.existsSync(path)) {
  console.error("File not found!");
  process.exit(1);
}

const workbook = xlsx.readFile(path);
console.log("Sheets:", workbook.SheetNames);

workbook.SheetNames.forEach((sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n--- Sheet: ${sheetName} ---`);
  console.log(JSON.stringify(json.slice(0, 10), null, 2));
});
