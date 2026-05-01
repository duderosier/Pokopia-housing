import Database from 'better-sqlite3';
const db = new Database('pokehousing.sqlite');
console.log(db.prepare("SELECT COUNT(*) FROM adjacency").get());
