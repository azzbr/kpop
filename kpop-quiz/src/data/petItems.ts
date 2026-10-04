// Things to buy for Pet Pal with coins. Decor ids start with "pet_" and are saved in pet.decor;
// never rename an id. Treats are used up straight away (not saved).

export type PetSlot = 'wallpaper' | 'floor' | 'bed' | 'toy' | 'wall' | 'corner' | 'light';

export interface PetDecor {
  id: string;
  name: string;
  emoji: string;
  price: number;
  slot: PetSlot;
  /** Wallpaper only: the room's background (CSS). */
  bg?: string;
  /** Where it sits in the room, in % of the room box (not used for wallpaper/floor). */
  x?: number;
  y?: number;
}

export interface PetTreat { id: string; name: string; emoji: string; price: number; happiness: number }

export const PET_DECOR: PetDecor[] = [
  // Wallpapers (the newest one you pick is shown)
  { id: 'pet_wall_pink', name: 'Bubblegum Wallpaper', emoji: '🩷', price: 20, slot: 'wallpaper', bg: 'linear-gradient(#f9a8d4, #f472b6)' },
  { id: 'pet_wall_sky', name: 'Sky Wallpaper', emoji: '🩵', price: 20, slot: 'wallpaper', bg: 'linear-gradient(#bae6fd, #38bdf8)' },
  { id: 'pet_wall_mint', name: 'Mint Wallpaper', emoji: '💚', price: 20, slot: 'wallpaper', bg: 'linear-gradient(#bbf7d0, #4ade80)' },
  { id: 'pet_wall_stars', name: 'Starry Night', emoji: '🌌', price: 45, slot: 'wallpaper', bg: 'radial-gradient(circle at 30% 20%, #6366f1, #1e1b4b)' },
  { id: 'pet_wall_sunset', name: 'Sunset Wallpaper', emoji: '🌅', price: 35, slot: 'wallpaper', bg: 'linear-gradient(#fde68a, #fb923c, #db2777)' },
  // Floor
  { id: 'pet_rug', name: 'Cosy Rug', emoji: '🟣', price: 25, slot: 'floor' },
  // Furniture & toys
  { id: 'pet_bed', name: 'Comfy Bed', emoji: '🛏️', price: 40, slot: 'bed', x: 14, y: 72 },
  { id: 'pet_ball', name: 'Bouncy Ball', emoji: '⚽', price: 15, slot: 'toy', x: 78, y: 82 },
  { id: 'pet_teddy', name: 'Teddy Friend', emoji: '🧸', price: 30, slot: 'toy', x: 88, y: 66 },
  { id: 'pet_yarn', name: 'Yarn Ball', emoji: '🧶', price: 15, slot: 'toy', x: 64, y: 86 },
  { id: 'pet_plant', name: 'Happy Plant', emoji: '🪴', price: 25, slot: 'corner', x: 90, y: 40 },
  { id: 'pet_sunflower', name: 'Sunflower Pot', emoji: '🌻', price: 25, slot: 'corner', x: 8, y: 40 },
  { id: 'pet_lamp', name: 'Glow Lamp', emoji: '🪔', price: 30, slot: 'light', x: 30, y: 58 },
  { id: 'pet_lights', name: 'Fairy Lights', emoji: '✨', price: 35, slot: 'light', x: 50, y: 6 },
  { id: 'pet_frame', name: 'Rainbow Picture', emoji: '🌈', price: 25, slot: 'wall', x: 28, y: 20 },
  { id: 'pet_window', name: 'Sunny Window', emoji: '🪟', price: 30, slot: 'wall', x: 72, y: 20 },
];

export const PET_TREATS: PetTreat[] = [
  { id: 'treat_cookie', name: 'Cookie', emoji: '🍪', price: 5, happiness: 8 },
  { id: 'treat_berry', name: 'Strawberry', emoji: '🍓', price: 8, happiness: 12 },
  { id: 'treat_cake', name: 'Cupcake', emoji: '🧁', price: 15, happiness: 25 },
];

export const petDecorById = (id: string): PetDecor | undefined => PET_DECOR.find(d => d.id === id);
