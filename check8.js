import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");
let index = data.indexOf("recommend");
while(index > -1) {
    console.log(data.slice(Math.max(0, index-200), index+200));
    index = data.indexOf("recommend", index + 10);
}
