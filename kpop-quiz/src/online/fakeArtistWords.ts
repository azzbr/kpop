// Secret words for Fake Artist. Everyone but the fake artist sees the word; the fake only sees
// the category, so each category is a fair clue and every word is quick to draw together, one
// stroke at a time. Each category has 12+ words so the fake's 6-word guess has same-category
// decoys. G-rated, lower case, no repeats (see fakeArtistWords.test.ts).

export interface FakeCategory { category: string; words: string[] }

export const FAKE_ARTIST_CATEGORIES: FakeCategory[] = [
  { category: 'Animals', words: ['cat', 'dog', 'elephant', 'giraffe', 'snail', 'rabbit', 'pig', 'duck', 'owl', 'turtle', 'lion', 'mouse', 'zebra'] },
  { category: 'Sea Life', words: ['fish', 'shark', 'octopus', 'whale', 'crab', 'starfish', 'jellyfish', 'seahorse', 'dolphin', 'lobster', 'shell', 'penguin'] },
  { category: 'Food & Treats', words: ['pizza', 'ice cream', 'cupcake', 'doughnut', 'burger', 'hot dog', 'lollipop', 'sandwich', 'pancake', 'cookie', 'popcorn', 'taco', 'cheese'] },
  { category: 'Fruit & Veg', words: ['apple', 'banana', 'carrot', 'pear', 'cherry', 'pineapple', 'watermelon', 'grapes', 'strawberry', 'broccoli', 'lemon', 'mushroom'] },
  { category: 'Around the House', words: ['chair', 'lamp', 'bed', 'clock', 'cup', 'teapot', 'umbrella', 'key', 'door', 'window', 'bathtub', 'toothbrush', 'sofa'] },
  { category: 'Nature & Weather', words: ['sun', 'moon', 'cloud', 'rainbow', 'tree', 'flower', 'mountain', 'volcano', 'snowman', 'lightning', 'cactus', 'leaf', 'island'] },
  { category: 'Things That Go', words: ['car', 'bus', 'train', 'plane', 'boat', 'rocket', 'bicycle', 'tractor', 'helicopter', 'submarine', 'scooter', 'hot air balloon'] },
  { category: 'Fairy Tales & Fantasy', words: ['dragon', 'castle', 'crown', 'unicorn', 'mermaid', 'wizard', 'fairy', 'robot', 'alien', 'treasure chest', 'magic wand', 'princess'] },
  { category: 'Sports & Games', words: ['football', 'basketball', 'tennis racket', 'kite', 'trophy', 'medal', 'skateboard', 'bowling', 'swing', 'slide', 'skipping rope', 'dice'] },
  { category: 'Music', words: ['guitar', 'drum', 'piano', 'trumpet', 'violin', 'microphone', 'headphones', 'music note', 'harp', 'bell', 'maracas', 'xylophone'] },
  { category: 'Clothes', words: ['hat', 'shoe', 'sock', 'glasses', 'scarf', 'gloves', 'dress', 'shirt', 'boot', 'raincoat', 'bow tie', 'trousers'] },
  { category: 'Places', words: ['school', 'beach', 'farm', 'lighthouse', 'tent', 'igloo', 'bridge', 'windmill', 'playground', 'house', 'pyramid', 'treehouse'] },
];

export const FAKE_ARTIST_WORDS: string[] = FAKE_ARTIST_CATEGORIES.flatMap(c => c.words);
