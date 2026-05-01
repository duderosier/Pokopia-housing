import Database from 'better-sqlite3';
const db = new Database('pokehousing.sqlite');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables: ", tables);

for (let table of tables) {
    const info = db.prepare(`PRAGMA table_info(${table.name})`).all();
    console.log(`\nTable ${table.name} schema:`, info.map(i => `${i.name} (${i.type})`));
    const count = db.prepare(`SELECT count(*) as c FROM ${table.name}`).get().c;
    console.log(`Count: ${count}`);
    if (count > 0 && count < 10) {
        console.log("Rows:", db.prepare(`SELECT * FROM ${table.name}`).all());
    } else if (count >= 10) {
        console.log("First 2 rows:", db.prepare(`SELECT * FROM ${table.name} LIMIT 2`).all());
    }
}
// We also want to know the main query from AE() earlier
const aeQuery = `SELECT i.category, i.flavor_text, i.tag,
             CASE WHEN COUNT(r.ingredient_id) > 0 THEN 1 ELSE 0 END AS is_craftable
      FROM items i
      LEFT JOIN item_recipe r ON r.item_id = i.id
      GROUP BY i.id
      LIMIT 5`;
console.log("\nAE query preview:");
console.log(db.prepare(aeQuery).all());

