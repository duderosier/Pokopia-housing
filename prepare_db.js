import Database from 'better-sqlite3';
import fs from 'node:fs';

const db = new Database('pokehousing.sqlite');
const items = db.prepare("SELECT * FROM items").all();
const pokemon = db.prepare("SELECT * FROM pokemon").all();
const item_favorites = db.prepare("SELECT * FROM item_favorites").all();
const pokemon_favorites = db.prepare("SELECT * FROM pokemon_favorites").all();
const item_recipe = db.prepare("SELECT * FROM item_recipe").all();

const data = {
    items, pokemon, item_favorites, pokemon_favorites, item_recipe
};

fs.writeFileSync("db.json", JSON.stringify(data));
console.log("Wrote db.json, size:", fs.statSync("db.json").size);

const pokesWithFavs = pokemon.map(p => {
    return {
        ...p,
        favorites: pokemon_favorites.filter(pf => pf.pokemon_id === p.id).map(pf => pf.favorite_name)
    };
});
console.log("Sample Pokemon:", pokesWithFavs[0]);

const itemsWithFavs = items.map(i => {
    return {
        ...i,
        favorites: item_favorites.filter(itf => itf.item_id === i.id).map(itf => itf.favorite_name),
        ingredients: item_recipe.filter(r => r.item_id === i.id)
    };
});
console.log("Sample Item:", itemsWithFavs[0], itemsWithFavs[1]);
