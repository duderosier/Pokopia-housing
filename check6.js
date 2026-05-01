import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");
let matches = data.match(/['"][^'"]*?\.sqlite3?['"]/g) || [];
matches = matches.concat(data.match(/['"][^'"]*?\.db['"]/g) || []);
matches = matches.concat(data.match(/fetch\(['"].*?['"]/g) || []);
console.log("DB Matches: ", matches);
