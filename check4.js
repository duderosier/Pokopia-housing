import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");
let keywords = ["category", "price", "points", "score", "size", "tags"];
for (let kw of keywords) {
    let index = data.indexOf(kw);
    if(index > -1) {
        console.log(`Keyword '${kw}' found at ${index}`);
        console.log(data.slice(Math.max(0, index-100), index+200));
        console.log('-----');
    }
}
