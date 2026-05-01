import fs from "node:fs";
const data = fs.readFileSync("solver.js", "utf-8");

// Try to find large JSON-like arrays or objects
// Let's print out some string literals from the file to understand the domain
const stringLiterals = (data.match(/(?<=["'])([^"']{4,})(?=["'])/g) || []);
const uniqueStrings = [...new Set(stringLiterals)];
console.log("Found " + uniqueStrings.length + " unique strings");
console.log(uniqueStrings.slice(0, 50).join(", "));

// Let's see if we can find something like "item" or "cart" or "points"
console.log("-------");
const searchIndexItem = data.indexOf("points");
if (searchIndexItem > -1) {
  console.log("Points context:");
  console.log(data.substring(searchIndexItem - 50, searchIndexItem + 150));
}
