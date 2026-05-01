import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");

let stringLiterals = data.match(/(?<=["'`])([^"'`]*?SELECT[^"'`]*?)(?=["'`])/gi) || [];
console.log(`Found ${stringLiterals.length} SQL queries inside strings.`);

stringLiterals.forEach((m, i) => {
    console.log(`\n--- Query ${i} ---`);
    console.log(m.substring(0, 500));
});
