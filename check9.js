import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");

let queries = data.match(/SELECT.*?FROM/gi) || [];
console.log(`Found ${queries.length} SELECT queries.`);

let matches = data.match(/`SELECT.*?`/gs) || [];
console.log(`Found ${matches.length} template literal SELECT queries.`);

matches.forEach((m, i) => {
    console.log(`\n--- Query ${i} ---`);
    console.log(m.substring(0, 500));
});
