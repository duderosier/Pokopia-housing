import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Home, CheckCircle2, Building, Trash2, ShieldAlert, Lock, Unlock, Save, Download, X, Loader2 } from 'lucide-react';

const PREFIX = 'https://matthewlincoln.net/pokopia-housing-solver/';

let data: any = null;
let pokemonData: any = {};
let itemsData: any = {};
let adj = new Map<number, Map<number, number>>();
let opposites: Record<string, string> = {};

const HABITAT_COLORS: Record<string, string> = {
  Dark: "bg-neutral-800 text-neutral-100 border-neutral-700",
  Bright: "bg-amber-100 text-amber-800 border-amber-200",
  Humid: "bg-blue-100 text-blue-800 border-blue-200",
  Dry: "bg-orange-100 text-orange-800 border-orange-200",
  Warm: "bg-red-100 text-red-800 border-red-200",
  Cool: "bg-cyan-100 text-cyan-800 border-cyan-200"
};

// --- TYPES ---

interface HouseAssignment {
  id: string; 
  size: 'small' | 'medium' | 'large';
  capacity: number;
  locked: boolean;
  pokemon: number[];
}

interface PlacedItem {
  houseId: string;
  itemId: number;
}

interface SavedQuery {
  id: string;
  name: string;
  timestamp: number;
  state: {
     selectedPokemonIds: number[];
     placedItems: PlacedItem[];
     smallCount: number;
     mediumCount: number;
     largeCount: number;
     lockedAssignments: Record<string, number[]>;
  };
}

export default function App() {
  const [loaded, setLoaded] = useState(data !== null);
  const [selectedPokemonIds, setSelectedPokemonIds] = useState<number[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [smallCount, setSmallCount] = useState(1);
  const [mediumCount, setMediumCount] = useState(3);
  const [largeCount, setLargeCount] = useState(2);
  const [lockedAssignments, setLockedAssignments] = useState<Record<string, number[]>>({});
  const [search, setSearch] = useState('');
  
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [queryName, setQueryName] = useState('');

  useEffect(() => {
    if (!loaded) {
      fetch('/data.json').then(res => res.json()).then(d => {
        data = d;
        pokemonData = Object.fromEntries(data.pokemon.map((p: any) => [p.id, p]));
        itemsData = Object.fromEntries(data.items.map((i: any) => [i.id, i]));
        data.adjacency.forEach((a: any) => {
          if (!adj.has(a.pokemon_a)) adj.set(a.pokemon_a, new Map());
          if (!adj.has(a.pokemon_b)) adj.set(a.pokemon_b, new Map());
          adj.get(a.pokemon_a)!.set(a.pokemon_b, a.score);
          adj.get(a.pokemon_b)!.set(a.pokemon_a, a.score);
        });
        data.habitats.forEach((h: any) => {
          opposites[h.habitat] = h.opposite;
        });
        setLoaded(true);
      });
    }
  }, [loaded]);

  useEffect(() => {
    try {
      if (!loaded) return;
      const saved = localStorage.getItem('pokopia_queries');
      if (saved) setSavedQueries(JSON.parse(saved));
    } catch {}
  }, [loaded]);

  const saveQuery = () => {
    const q: SavedQuery = {
      id: Date.now().toString(),
      name: queryName || `Query (${new Date().toLocaleDateString()})`,
      timestamp: Date.now(),
      state: {
        selectedPokemonIds, placedItems, smallCount, mediumCount, largeCount, lockedAssignments
      }
    };
    const next = [q, ...savedQueries];
    setSavedQueries(next);
    localStorage.setItem('pokopia_queries', JSON.stringify(next));
    setQueryName('');
  };

  const loadQuery = (q: SavedQuery) => {
    setSelectedPokemonIds(q.state.selectedPokemonIds);
    setPlacedItems(q.state.placedItems || []);
    setSmallCount(q.state.smallCount);
    setMediumCount(q.state.mediumCount);
    setLargeCount(q.state.largeCount);
    setLockedAssignments(q.state.lockedAssignments || {});
  };

  const deleteQuery = (id: string) => {
    const next = savedQueries.filter(q => q.id !== id);
    setSavedQueries(next);
    localStorage.setItem('pokopia_queries', JSON.stringify(next));
  };

  const toggleLock = (houseId: string, pokemon: number[]) => {
    setLockedAssignments(prev => {
      const copy = { ...prev };
      if (copy[houseId]) delete copy[houseId];
      else copy[houseId] = [...pokemon];
      return copy;
    });
  };

  // SOLVER
  const { houses: assignedHouses, unhoused } = useMemo(() => {
    const houses: HouseAssignment[] = [];
    for (let i = 0; i < largeCount; i++) houses.push({id: `L${i+1}`, size: 'large', capacity: 4, locked: false, pokemon: []});
    for (let i = 0; i < mediumCount; i++) houses.push({id: `M${i+1}`, size: 'medium', capacity: 2, locked: false, pokemon: []});
    for (let i = 0; i < smallCount; i++) houses.push({id: `S${i+1}`, size: 'small', capacity: 1, locked: false, pokemon: []});

    const unassignedIds = [...selectedPokemonIds];
    
    // Process locks
    for (const h of houses) {
       if (lockedAssignments[h.id]) {
          h.locked = true;
          h.pokemon = [...lockedAssignments[h.id]];
          h.pokemon.forEach(pid => {
             const idx = unassignedIds.indexOf(pid);
             if (idx !== -1) unassignedIds.splice(idx, 1);
          });
       }
    }

    let bestScore = -Infinity;
    let bestAssignment: HouseAssignment[] = [];
    let bestUnhoused: number[] = [];

    // Optimize unassigned pokemon into unlocked houses
    for (let iter = 0; iter < 100; iter++) {
      let unassigned = [...unassignedIds].sort(() => Math.random() - 0.5);
      let currentHouses = houses.map(h => ({
        ...h,
        pokemon: h.locked ? [...h.pokemon] : []
      }));
      
      let currentUnlocked = currentHouses.filter(h => !h.locked);
      currentUnlocked.sort((a,b) => b.capacity - a.capacity);
      
      for (const h of currentUnlocked) {
         for (let i = 0; i < h.capacity; i++) {
           if (unassigned.length === 0) break;
           
           let bestPok = -1;
           let bestAddScore = -Infinity;
           let bestPokIdx = -1;
           
           for (let pIdx = 0; pIdx < unassigned.length; pIdx++) {
              const pok = unassigned[pIdx];
              const pokHab = pokemonData[pok].habitat;
              const badHab = pokHab ? opposites[pokHab] : null;
              
              let conflict = false;
              if (badHab) {
                for (const existing of h.pokemon) {
                   if (pokemonData[existing].habitat === badHab) {
                      conflict = true;
                      break;
                   }
                }
              }
              if (conflict) continue;
              
              let addedScore = 0;
              for (const existing of h.pokemon) {
                 addedScore += adj.get(pok)?.get(existing) || 0;
              }
              
              if (addedScore > bestAddScore) {
                 bestAddScore = addedScore;
                 bestPok = pok;
                 bestPokIdx = pIdx;
              }
           }
           
           if (bestPok !== -1) {
              h.pokemon.push(bestPok);
              unassigned.splice(bestPokIdx, 1);
           } else {
              break; 
           }
         }
      }
      
      let currentScore = 0;
      let housedCount = 0;
      for (const h of currentHouses) {
        housedCount += h.pokemon.length;
        if (h.pokemon.length > 1) {
           for (let i = 0; i < h.pokemon.length; i++) {
             for (let j = i+1; j < h.pokemon.length; j++) {
                currentScore += adj.get(h.pokemon[i])?.get(h.pokemon[j]) || 0;
             }
           }
        }
      }
      
      const evalScore = housedCount * 10000 + currentScore;
      if (evalScore > bestScore) {
         bestScore = evalScore;
         bestAssignment = currentHouses;
         bestUnhoused = unassigned;
      }
    }

    if (bestAssignment.length === 0) {
      bestAssignment = houses;
      bestUnhoused = unassignedIds;
    }

    bestAssignment.sort((a, b) => {
       if (a.pokemon.length === 0 && b.pokemon.length > 0) return 1;
       if (a.pokemon.length > 0 && b.pokemon.length === 0) return -1;
       return b.capacity - a.capacity; /* Sort largest capacity first */
    });

    return { houses: bestAssignment, unhoused: bestUnhoused };
  }, [selectedPokemonIds, smallCount, mediumCount, largeCount, lockedAssignments]);

  const togglePokemon = (id: number) => {
    setSelectedPokemonIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const filteredPokemon = useMemo(() => {
    if (!loaded) return [];
    if (!search) return data.pokemon;
    return data.pokemon.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, loaded]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const lockedSmall = Object.keys(lockedAssignments).filter(id => id.startsWith('S')).length;
  const lockedMedium = Object.keys(lockedAssignments).filter(id => id.startsWith('M')).length;
  const lockedLarge = Object.keys(lockedAssignments).filter(id => id.startsWith('L')).length;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 flex items-center justify-center sm:justify-start gap-3">
            <Home className="w-10 h-10 text-indigo-600"/>
            Pokopia Housing Solver
          </h1>
          <p className="text-neutral-500 mt-3 max-w-2xl text-sm sm:text-base">
            Optimize your Pokopia roommate assignments by matching likeminded Pokémon together and finding the items that fulfill the most favorites in a household.
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* L: Sidebar Settings */}
          <div className="xl:col-span-1 space-y-6">
             <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
               <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
                 <Building className="w-5 h-5 text-indigo-500"/> Houses
               </h2>
               <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-neutral-700 mb-1 flex justify-between">
                      Small (1 slot)
                      {lockedSmall > 0 && <span className="text-indigo-600 text-[10px] uppercase font-bold flex items-center gap-1"><Lock className="w-3 h-3"/> {lockedSmall} locked</span>}
                   </label>
                   <input type="number" min={lockedSmall} value={smallCount} onChange={e => setSmallCount(Math.max(lockedSmall, parseInt(e.target.value) || 0))} className="w-full rounded-md border border-neutral-300 px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-neutral-700 mb-1 flex justify-between">
                      Medium (2 slots)
                      {lockedMedium > 0 && <span className="text-indigo-600 text-[10px] uppercase font-bold flex items-center gap-1"><Lock className="w-3 h-3"/> {lockedMedium} locked</span>}
                   </label>
                   <input type="number" min={lockedMedium} value={mediumCount} onChange={e => setMediumCount(Math.max(lockedMedium, parseInt(e.target.value) || 0))} className="w-full rounded-md border border-neutral-300 px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-neutral-700 mb-1 flex justify-between">
                      Large (4 slots)
                      {lockedLarge > 0 && <span className="text-indigo-600 text-[10px] uppercase font-bold flex items-center gap-1"><Lock className="w-3 h-3"/> {lockedLarge} locked</span>}
                   </label>
                   <input type="number" min={lockedLarge} value={largeCount} onChange={e => setLargeCount(Math.max(lockedLarge, parseInt(e.target.value) || 0))} className="w-full rounded-md border border-neutral-300 px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                 </div>
               </div>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col h-[50vh]">
              <div className="p-4 border-b border-neutral-100 bg-neutral-50/80">
                <h2 className="text-base font-bold flex items-center justify-between mb-3">
                  Select Pokémon
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-semibold">{selectedPokemonIds.length} Selected</span>
                </h2>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="overflow-y-auto p-2 flex-1">
                {filteredPokemon.map((p: any) => {
                  const isSelected = selectedPokemonIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePokemon(p.id)}
                      className={`w-full text-left px-3 py-2 my-0.5 flex items-center gap-3 rounded-md transition-colors ${
                        isSelected ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-neutral-50 border border-transparent'
                      }`}
                    >
                      <img src={`${PREFIX}${p.image_path}`} alt={p.name} className="w-8 h-8 object-contain" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-neutral-900 truncate">{p.name}</div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">{p.habitat}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
                <Save className="w-5 h-5 text-indigo-500"/> Saved Queries
              </h2>
              <div className="flex gap-2 mb-4">
                 <input 
                   type="text" 
                   placeholder="Query Name..." 
                   value={queryName}
                   onChange={e => setQueryName(e.target.value)}
                   className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                 />
                 <button onClick={saveQuery} disabled={selectedPokemonIds.length === 0} className="bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold">
                   Save
                 </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                 {savedQueries.map(q => (
                   <div key={q.id} className="flex items-center justify-between bg-neutral-50 border border-neutral-200 p-2 rounded-lg">
                      <div className="flex-1 min-w-0 overflow-hidden pr-2">
                         <div className="text-sm font-bold text-neutral-900 truncate">{q.name}</div>
                         <div className="text-[10px] text-neutral-500">{new Date(q.timestamp).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                         <button onClick={() => loadQuery(q)} title="Load details" className="p-1.5 bg-white border border-neutral-200 rounded text-indigo-600 hover:bg-indigo-50 transition">
                           <Download className="w-3.5 h-3.5" />
                         </button>
                         <button onClick={() => deleteQuery(q.id)} title="Delete" className="p-1.5 bg-white border border-neutral-200 rounded text-red-600 hover:bg-red-50 transition">
                           <X className="w-3.5 h-3.5" />
                         </button>
                      </div>
                   </div>
                 ))}
                 {savedQueries.length === 0 && <div className="text-sm text-neutral-500 text-center py-2">No saved queries.</div>}
              </div>
            </div>

          </div>

          {/* R: Results */}
          <div className="xl:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Housing Results</h2>
              {unhoused.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="font-semibold">{unhoused.length} unhoused</span>
                </div>
              )}
            </div>

            {unhoused.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
                 <h3 className="text-sm font-bold text-amber-800 mb-3">Unable to fit these Pokémon:</h3>
                 <div className="flex flex-wrap gap-2">
                   {unhoused.map(id => (
                     <div key={id} className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">
                        <img src={`${PREFIX}${pokemonData[id].image_path}`} alt={pokemonData[id].name} className="w-6 h-6 object-contain" />
                        <span className="text-sm font-medium text-amber-900">{pokemonData[id].name}</span>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {assignedHouses.map(house => (
                <HouseCard 
                  key={house.id} 
                  house={house} 
                  placedItems={placedItems}
                  setPlacedItems={setPlacedItems}
                  toggleLock={toggleLock}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HouseCardProps {
  house: HouseAssignment;
  placedItems: PlacedItem[];
  setPlacedItems: React.Dispatch<React.SetStateAction<PlacedItem[]>>;
  toggleLock: (hostId: string, pokemon: number[]) => void;
}

const HouseCard: React.FC<HouseCardProps> = ({ house, placedItems, setPlacedItems, toggleLock }) => {
  const [craftableOnly, setCraftableOnly] = useState(false);

  const pop = house.pokemon.map(id => pokemonData[id]);
  const housePlacedItems = placedItems.filter(p => p.houseId === house.id).map(p => itemsData[p.itemId]);

  const requiredFaves = new Map<string, number>();
  pop.forEach(p => {
    p.favorites.forEach((f: string) => {
      requiredFaves.set(f, (requiredFaves.get(f) || 0) + 1);
    });
  });

  const habCounts: Record<string, number> = {};
  pop.forEach(p => {
     if (p.habitat) habCounts[p.habitat] = (habCounts[p.habitat] || 0) + 1;
  });

  const fulfilledFaves = new Set<string>();
  housePlacedItems.forEach(item => {
    item.favorites.forEach((f: string) => fulfilledFaves.add(f));
  });

  const missingFaves = new Map<string, number>();
  for (const [f, count] of requiredFaves.entries()) {
    if (!fulfilledFaves.has(f)) {
       missingFaves.set(f, count);
    }
  }

  const recommendations = useMemo(() => {
    if (house.pokemon.length === 0) return [];
    
    const recs = data.items.map((item: any) => {
      if (housePlacedItems.some(p => p.id === item.id)) return null;
      if (craftableOnly && !item.is_craftable) return null;

      let pokemonNeeding = 0;
      for (const p of pop) {
        if (p.favorites.some((f: string) => item.favorites.includes(f) && missingFaves.has(f))) {
           pokemonNeeding++;
        }
      }

      let totalNeedsCovered = 0;
      const covers: string[] = [];
      item.favorites.forEach((f: string) => {
         if (missingFaves.has(f)) {
            totalNeedsCovered += missingFaves.get(f)!;
            covers.push(f);
         }
      });

      if (pokemonNeeding === 0) return null;
      return { item, pokemonNeeding, totalNeedsCovered, covers };
    }).filter(Boolean) as {item: any, pokemonNeeding: number, totalNeedsCovered: number, covers: string[]}[];

    recs.sort((a, b) => b.pokemonNeeding - a.pokemonNeeding || b.totalNeedsCovered - a.totalNeedsCovered);
    return recs.slice(0, 50);
  }, [missingFaves, housePlacedItems, craftableOnly, house.pokemon.length]);

  const toggleItem = (itemId: number) => {
    setPlacedItems((prev: PlacedItem[]) => {
      const exists = prev.find(p => p.houseId === house.id && p.itemId === itemId);
      if (exists) return prev.filter(p => !(p.houseId === house.id && p.itemId === itemId));
      return [...prev, {houseId: house.id, itemId}];
    });
  };

  const labelSize = house.size.charAt(0).toUpperCase() + house.size.slice(1);

  if (house.pokemon.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 border-dashed p-6 flex flex-col items-center justify-center text-neutral-400 min-h-[300px]">
        <Building className="w-8 h-8 mb-3 opacity-50" />
        <div className="font-semibold">{labelSize} House ({house.id})</div>
        <div className="text-sm">0 / {house.capacity} occupants</div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-colors flex flex-col overflow-hidden ${house.locked ? 'border-indigo-400 ring-1 ring-indigo-400/50' : 'border-neutral-200'}`}>
       <div className={`border-b p-4 flex justify-between items-start ${house.locked ? 'bg-indigo-50/50 border-indigo-100' : 'bg-neutral-100/50 border-neutral-200'}`}>
         <div className="pt-1">
           <div className="flex flex-col gap-1 mb-1">
             <h3 className="font-bold text-neutral-900">{labelSize} House ({house.id})</h3>
             {Object.keys(habCounts).length > 0 && (
               <div className="flex flex-wrap gap-1 mt-1">
                 {Object.entries(habCounts).map(([hab, count]) => (
                    <span key={hab} className={`text-[10px] px-1.5 py-0.5 rounded font-bold border uppercase tracking-wider ${HABITAT_COLORS[hab] || 'bg-neutral-100 border-neutral-200 text-neutral-700'}`}>
                       {hab} ×{count}
                    </span>
                 ))}
               </div>
             )}
           </div>
           <p className="text-xs text-neutral-500 font-medium mt-1">{house.pokemon.length} / {house.capacity} occupants</p>
         </div>
         <button 
           onClick={() => toggleLock(house.id, house.pokemon)} 
           title={house.locked ? "Unlock house assignments" : "Lock assignments so they won't change"}
           className={`p-2 rounded-lg transition-colors border ${house.locked ? 'bg-indigo-100 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-neutral-200 text-neutral-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'}`}>
            {house.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
         </button>
       </div>

       <div className="p-4 border-b border-neutral-100">
         <div className="flex flex-wrap gap-2">
           {pop.map(p => (
             <div key={p.id} className="bg-white border border-neutral-200 shadow-sm rounded-lg p-2 pr-4 flex items-center gap-3">
                <img src={`${PREFIX}${p.image_path}`} alt={p.name} className="w-10 h-10 object-contain drop-shadow-sm" />
                <div>
                  <div className="font-bold text-sm text-neutral-900">{p.name}</div>
                  <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">{p.habitat}</div>
                </div>
             </div>
           ))}
         </div>
       </div>

       <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
         <h4 className="text-xs uppercase font-bold text-neutral-500 mb-3 tracking-wider">House-wide Needs</h4>
         <div className="flex flex-wrap gap-1.5">
           {Array.from(requiredFaves.entries()).sort((a,b) => b[1] - a[1]).map(([fav, count]) => {
              const isFulfilled = fulfilledFaves.has(fav);
              return (
                <div key={fav} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                  isFulfilled 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-white border-neutral-200 text-neutral-600 shadow-sm'
                }`}>
                  {isFulfilled && <CheckCircle2 className="w-3 h-3" />}
                  {fav} <span className="opacity-60 font-black tracking-widest">×{count}</span>
                </div>
              );
           })}
         </div>
       </div>

       {housePlacedItems.length > 0 && (
         <div className="p-4 bg-indigo-50/30 border-b border-indigo-50">
           <h4 className="text-xs uppercase font-bold text-indigo-400 mb-3 tracking-wider">Placed Items</h4>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
             {housePlacedItems.map(item => (
               <div key={item.id} className="flex gap-3 items-center bg-white border border-indigo-100 p-2 rounded-lg shadow-sm">
                  <img src={`${PREFIX}${item.picture_path}`} alt={item.name} className="w-8 h-8 object-contain" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-indigo-900">{item.name}</div>
                  </div>
                  <button onClick={() => toggleItem(item.id)} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
               </div>
             ))}
           </div>
         </div>
       )}

       {missingFaves.size > 0 ? (
         <div className="p-4 flex-1">
           <div className="flex items-center justify-between mb-3">
             <h4 className="text-xs uppercase font-bold text-neutral-500 tracking-wider">Recommended Items</h4>
             <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600 cursor-pointer hover:text-neutral-900">
               <input type="checkbox" checked={craftableOnly} onChange={e => setCraftableOnly(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300" />
               Craftable Only
             </label>
           </div>
           
           <div className="space-y-2 max-h-96 overflow-y-auto pr-2 pb-2">
             {recommendations.length > 0 ? recommendations.map(rec => (
               <div key={rec.item.id} className="flex gap-3 items-start border border-neutral-100 p-3 rounded-lg hover:border-indigo-200 transition-colors bg-white group shadow-sm">
                 <img src={`${PREFIX}${rec.item.picture_path}`} alt={rec.item.name} className="w-10 h-10 object-contain" />
                 <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-start gap-2 mb-1.5">
                     <div className="text-sm font-bold text-neutral-900 truncate leading-tight">{rec.item.name}</div>
                     <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-indigo-600">Supports {rec.pokemonNeeding} Pokémon</div>
                        <div className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Covers {rec.totalNeedsCovered} needs</div>
                     </div>
                   </div>
                   <div className="flex flex-wrap gap-1">
                     {rec.covers.map((c: string) => (
                       <span key={c} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded">
                         {c}
                       </span>
                     ))}
                   </div>
                 </div>
                 <button onClick={() => toggleItem(rec.item.id)} title="Place in house" className="p-2 border border-neutral-200 rounded-lg text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors shrink-0">
                   <Plus className="w-4 h-4" />
                 </button>
               </div>
             )) : (
               <div className="text-center text-sm text-neutral-500 py-4 font-medium border border-dashed border-neutral-200 rounded-lg">No remaining recommendations match.</div>
             )}
           </div>
         </div>
       ) : (
         <div className="p-6 flex-1 flex flex-col items-center justify-center text-emerald-600 bg-emerald-50/30">
           <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
           <div className="font-bold text-sm text-center tracking-wide">All needs fulfilled!</div>
         </div>
       )}
    </div>
  );
};
