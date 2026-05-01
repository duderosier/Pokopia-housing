import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");
let index = data.indexOf("kE()");
if (index > -1) {
    console.log(data.slice(Math.max(0, index-400), index+400));
}
