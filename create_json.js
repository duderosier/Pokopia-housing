import Database from 'better-sqlite3';
import fs from 'node:fs';
// Create optimized json
const db = new Database('pokehousing.sqlite');
const items = db.prepare("SELECT * FROM items").all();
const pokemon = db.prepare("SELECT * FROM pokemon").all();
const item_favorites = db.prepare("SELECT * FROM item_favorites").all();
const pokemon_favorites = db.prepare("SELECT * FROM pokemon_favorites").all();
const item_recipe = db.prepare("SELECT * FROM item_recipe").all();

const pokesWithFavs = pokemon.map(p => {
    return {
        id: p.id,
        name: p.name,
        image_path: p.image_path,
        habitat: p.habitat,
        favorites: pokemon_favorites.filter(pf => pf.pokemon_id === p.id).map(pf => pf.favorite_name)
    };
});

const itemsWithFavs = items.map(i => {
    return {
        id: i.id,
        name: i.name,
        category: i.category,
        picture_path: i.picture_path,
        flavor_text: i.flavor_text,
        tag: i.tag,
        is_craftable: item_recipe.some(r => r.item_id === i.id),
        favorites: item_favorites.filter(itf => itf.item_id === i.id).map(itf => itf.favorite_name)
    };
});

const adjacencyRaw = db.prepare("SELECT pokemon_a, pokemon_b, score FROM adjacency").all();
const adjacency = adjacencyRaw.map(a => [a.pokemon_a, a.pokemon_b, a.score]);
const habitats = db.prepare("SELECT * FROM habitats").all();

if (!fs.existsSync("public")) fs.mkdirSync("public");
fs.writeFileSync("public/data.json", JSON.stringify({ pokemon: pokesWithFavs, items: itemsWithFavs, adjacency, habitats }));

