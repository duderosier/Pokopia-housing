import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");
console.log("Length: " + data.length);
console.log("Start: " + data.substring(0, 100));
