import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");

// We are looking for an array of objects that describe items.
// Such objects usually have a 'name' or 'name:' property, 'points', 'id'.
let jsonStrMatch = data.match(/\[\{.*?"name".*?\}\]/);
if (!jsonStrMatch) {
    // If it's an unquoted property name like {name:"...", points:...}
    let objMatches = data.match(/\{(?:[^{}]*?)name:\s*['"](.*?)['"](.*?)\}/g);
    if(objMatches && objMatches.length > 5) {
        console.log("Found raw object matches, count:", objMatches.length);
        console.log(objMatches.slice(0, 10));
    }
} else {
    console.log("Found JSON string of length", jsonStrMatch[0].length);
}
