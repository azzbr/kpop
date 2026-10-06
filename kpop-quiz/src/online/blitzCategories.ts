// Category Blitz content: one letter, five categories per round. The letters are the fair ones
// (plenty of answers in almost every category) — no Q, X, Z, U, V, Y, and only 2 food categories.

export interface BlitzCategory { id: string; name: string; emoji: string; food?: true }

export const BLITZ_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W'] as const;

export const BLITZ_CATEGORIES: BlitzCategory[] = [
  { id: 'animals', name: 'Animals', emoji: '🐾' },
  { id: 'fruit', name: 'Fruit', emoji: '🍎', food: true },
  { id: 'veg', name: 'Vegetables', emoji: '🥕', food: true },
  { id: 'countries', name: 'Countries', emoji: '🌍' },
  { id: 'cities', name: 'Cities', emoji: '🏙️' },
  { id: 'classroom', name: 'Things in a classroom', emoji: '✏️' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'colours', name: 'Colours', emoji: '🎨' },
  { id: 'games', name: 'Games', emoji: '🎲' },
  { id: 'powers', name: 'Superpowers', emoji: '🦸' },
  { id: 'jobs', name: 'Jobs', emoji: '👩‍🚒' },
  { id: 'fly', name: 'Things that fly', emoji: '🪁' },
  { id: 'ocean', name: 'Ocean creatures', emoji: '🐙' },
  { id: 'books', name: 'Book characters', emoji: '📚' },
  { id: 'cartoons', name: 'Cartoon characters', emoji: '📺' },
  { id: 'instruments', name: 'Instruments', emoji: '🎸' },
  { id: 'toybox', name: 'Things in a toy box', emoji: '🧸' },
  { id: 'birds', name: 'Birds', emoji: '🐦' },
  { id: 'bugs', name: 'Bugs & insects', emoji: '🐞' },
  { id: 'round', name: 'Things that are round', emoji: '⚪' },
  { id: 'kitchen', name: 'Kitchen things (not food)', emoji: '🍳' },
  { id: 'beach', name: 'Things at the beach', emoji: '🏖️' },
  { id: 'names', name: 'First names', emoji: '📛' },
  { id: 'wheels', name: 'Things with wheels', emoji: '🛞' },
  { id: 'cold', name: 'Things that are cold', emoji: '🧊' },
  { id: 'space', name: 'Things in space', emoji: '🪐' },
  { id: 'weather', name: 'Weather words', emoji: '⛅' },
  { id: 'clothes', name: 'Clothes', emoji: '👕' },
  { id: 'body', name: 'Body parts', emoji: '🖐️' },
  { id: 'garden', name: 'Things in a garden', emoji: '🌻' },
  { id: 'hobbies', name: 'Hobbies', emoji: '🧶' },
  { id: 'noise', name: 'Things that make noise', emoji: '🔔' },
  { id: 'furniture', name: 'Furniture', emoji: '🛋️' },
  { id: 'pets', name: 'Pets', emoji: '🐶' },
  { id: 'park', name: 'Things in a park', emoji: '🛝' },
  { id: 'town', name: 'Places in town', emoji: '🏪' },
  { id: 'soft', name: 'Things that are soft', emoji: '☁️' },
  { id: 'fairy', name: 'Fairy-tale things', emoji: '🧚' },
  { id: 'holiday', name: 'Things you pack for a holiday', emoji: '🧳' },
  { id: 'kind', name: 'Kind words', emoji: '💖' },
];
