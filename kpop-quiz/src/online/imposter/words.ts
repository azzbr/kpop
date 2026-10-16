// Imposter word lists — kid-friendly, easy to give a one-word clue for. No scary or violent words.
// 12 categories × 40 words (no word in two categories), 150 Undercover pairs, and the emoji
// grid for 😀 Emoji clues. Tests: imposterLogic.test.ts ("word lists").

export type ImposterCategory =
  | 'animals' | 'food' | 'places' | 'sports' | 'school' | 'jobs' | 'home' | 'fantasy'
  | 'space' | 'ocean' | 'toys' | 'weather';

export interface CategoryInfo { id: ImposterCategory; name: string; emoji: string }

export const IMPOSTER_CATEGORIES: CategoryInfo[] = [
  { id: 'animals', name: 'Animals', emoji: '🐼' },
  { id: 'food', name: 'Food', emoji: '🍕' },
  { id: 'places', name: 'Places', emoji: '🏝️' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'school', name: 'School', emoji: '🏫' },
  { id: 'jobs', name: 'Jobs', emoji: '👩‍🚒' },
  { id: 'home', name: 'Things at home', emoji: '🛋️' },
  { id: 'fantasy', name: 'Fantasy', emoji: '🦄' },
  { id: 'space', name: 'Space', emoji: '🚀' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊' },
  { id: 'toys', name: 'Toys', emoji: '🧸' },
  { id: 'weather', name: 'Weather', emoji: '⛅' },
];

export const IMPOSTER_WORDS: Record<ImposterCategory, string[]> = {
  animals: [
    'Elephant', 'Giraffe', 'Penguin', 'Kangaroo', 'Dolphin', 'Panda', 'Lion', 'Tiger', 'Zebra', 'Monkey',
    'Rabbit', 'Turtle', 'Owl', 'Parrot', 'Frog', 'Koala', 'Octopus', 'Horse', 'Cow', 'Pig',
    'Sheep', 'Duck', 'Chicken', 'Squirrel', 'Hedgehog', 'Butterfly', 'Bee', 'Snail', 'Camel', 'Hippo',
    'Polar Bear', 'Flamingo', 'Peacock', 'Seal', 'Whale', 'Crab', 'Goldfish', 'Hamster', 'Puppy', 'Kitten',
  ],
  food: [
    'Pizza', 'Pancake', 'Spaghetti', 'Ice Cream', 'Banana', 'Apple', 'Strawberry', 'Watermelon', 'Popcorn', 'Sandwich',
    'Burger', 'Hot Dog', 'Taco', 'Sushi', 'Cookie', 'Cupcake', 'Doughnut', 'Cereal', 'Toast', 'Cheese',
    'Carrot', 'Broccoli', 'Corn', 'Potato', 'Rice', 'Soup', 'Salad', 'Egg', 'Yogurt', 'Chocolate',
    'Lemon', 'Grapes', 'Orange', 'Pineapple', 'Muffin', 'Waffle', 'Noodles', 'Honey', 'Pretzel', 'Milkshake',
  ],
  places: [
    'Beach', 'Zoo', 'Library', 'Park', 'Airport', 'Museum', 'Hospital', 'Supermarket', 'Cinema', 'Farm',
    'Swimming Pool', 'Playground', 'Bakery', 'Castle', 'Desert', 'Jungle', 'Mountain', 'Island', 'Space Station', 'Aquarium',
    'Train Station', 'Campsite', 'Funfair', 'Restaurant', 'Bowling Alley', 'Ice Rink', 'Garden', 'Forest', 'Lighthouse', 'Volcano',
    'Igloo', 'Treehouse', 'Toy Shop', 'Post Office', 'Fire Station', 'Waterpark', 'Cave', 'Bridge', 'Stadium', 'Pet Shop',
  ],
  sports: [
    'Football', 'Basketball', 'Tennis', 'Swimming', 'Gymnastics', 'Baseball', 'Golf', 'Skiing', 'Surfing', 'Skateboarding',
    'Ice Skating', 'Cycling', 'Volleyball', 'Badminton', 'Table Tennis', 'Rugby', 'Cricket', 'Hockey', 'Karate', 'Bowling',
    'Archery', 'Rowing', 'Diving', 'Climbing', 'Running', 'Hurdles', 'Long Jump', 'Snowboarding', 'Sailing', 'Horse Riding',
    'Dodgeball', 'Netball', 'Ballet', 'Yoga', 'Trampoline', 'Roller Skating', 'Kayaking', 'Fencing', 'Hopscotch', 'Sack Race',
  ],
  school: [
    'Pencil', 'Eraser', 'Ruler', 'Backpack', 'Sports Day', 'Whiteboard', 'Homework', 'Lunchbox', 'Desk', 'Library Book',
    'Scissors', 'Glue Stick', 'Calculator', 'Crayon', 'Notebook', 'Playtime', 'Spelling Test', 'Globe', 'Map', 'Paintbrush',
    'Sharpener', 'Recorder', 'Science Lab', 'Microscope', 'School Bus', 'Uniform', 'Assembly', 'PE Lesson', 'Maths', 'Art Class',
    'Classroom', 'Bell', 'School Trip', 'Sticker', 'Pencil Case', 'Dictionary', 'Chalk', 'School Report', 'Lunch Hall', 'Times Tables',
  ],
  jobs: [
    'Doctor', 'Firefighter', 'Teacher', 'Chef', 'Pilot', 'Astronaut', 'Farmer', 'Police Officer', 'Vet', 'Dentist',
    'Baker', 'Artist', 'Singer', 'Dancer', 'Builder', 'Nurse', 'Scientist', 'Librarian', 'Postal Worker', 'Zookeeper',
    'Photographer', 'Lifeguard', 'Hairdresser', 'Gardener', 'Bus Driver', 'Magician', 'Clown', 'Plumber', 'Mechanic', 'Detective',
    'Lighthouse Keeper', 'Shopkeeper', 'Waiter', 'Footballer', 'Painter', 'Inventor', 'Coach', 'Tailor', 'Author', 'Explorer',
  ],
  home: [
    'Sofa', 'Bed', 'Pillow', 'Toothbrush', 'Fridge', 'Oven', 'Television', 'Lamp', 'Bathtub', 'Towel',
    'Mirror', 'Clock', 'Kettle', 'Toaster', 'Washing Machine', 'Vacuum', 'Curtains', 'Rug', 'Spoon', 'Fork',
    'Plate', 'Cup', 'Blanket', 'Doorbell', 'Stairs', 'Window', 'Chair', 'Table', 'Bookshelf', 'Teddy Bear',
    'Shampoo', 'Soap', 'Umbrella', 'Slippers', 'Remote Control', 'Laundry Basket', 'Broom', 'Plant Pot', 'Microwave', 'Alarm Clock',
  ],
  fantasy: [
    'Unicorn', 'Dragon', 'Wizard', 'Fairy', 'Mermaid', 'Wishing Well', 'Magic Wand', 'Treasure Chest', 'Crown', 'Princess',
    'Knight', 'Giant', 'Elf', 'Pixie', 'Genie', 'Flying Carpet', 'Potion', 'Spell Book', 'Wishing Star', 'Pegasus',
    'Phoenix', 'Gnome', 'Troll', 'Robot', 'Superhero', 'Time Machine', 'Magic Mirror', 'Crystal Ball', 'Pirate Ship', 'Treasure Map',
    'Gingerbread House', 'Beanstalk', 'Glass Slipper', 'Talking Cat', 'Cloud Castle', 'Jetpack', 'Fairy Godmother', 'Enchanted Forest', 'Invisibility Cloak', 'Fairy Dust',
  ],
  space: [
    'Rocket', 'Moon', 'Sun', 'Star', 'Planet', 'Comet', 'Meteor', 'Asteroid', 'Galaxy', 'Black Hole',
    'Telescope', 'Satellite', 'Space Suit', 'Mars', 'Jupiter', 'Saturn', 'Earth', 'Venus', 'Neptune', 'Milky Way',
    'Shooting Star', 'Alien', 'Flying Saucer', 'Moon Rover', 'Crater', 'Constellation', 'Orbit', 'Gravity', 'Launch Pad', 'Countdown',
    'Space Shuttle', 'Space Helmet', 'Solar System', 'Eclipse', 'Stargazing', 'Mission Control', 'Space Food', 'Northern Lights', 'Planetarium', 'Mercury',
  ],
  ocean: [
    'Shark', 'Jellyfish', 'Starfish', 'Seahorse', 'Coral Reef', 'Seaweed', 'Submarine', 'Seashell', 'Wave', 'Sea Turtle',
    'Clownfish', 'Stingray', 'Lobster', 'Walrus', 'Sea Lion', 'Orca', 'Narwhal', 'Pufferfish', 'Shipwreck', 'Scuba Diver',
    'Snorkel', 'Anchor', 'Sailboat', 'Surfboard', 'Sandcastle', 'Rock Pool', 'Sea Otter', 'Manatee', 'Swordfish', 'Squid',
    'Iceberg', 'Pearl', 'Oyster', 'Sea Urchin', 'Seagull', 'Message In A Bottle', 'Fishing Net', 'Lifeboat', 'Hermit Crab', 'Eel',
  ],
  toys: [
    'Yo-Yo', 'Building Blocks', 'Doll', 'Action Figure', 'Kite', 'Jigsaw Puzzle', 'Puzzle Cube', 'Spinning Top', 'Skipping Rope', 'Marbles',
    'Toy Car', 'Train Set', 'Dollhouse', 'Rocking Horse', 'Bouncy Ball', 'Modelling Clay', 'Board Game', 'Jack In The Box', 'Hula Hoop', 'Scooter',
    'Bubbles', 'Puppet', 'Remote Control Car', 'Dominoes', 'Playing Cards', 'Toy Drum', 'Xylophone', 'Kaleidoscope', 'Snow Globe', 'Pinwheel',
    'Soft Toy', 'Toy Dinosaur', 'Paper Plane', 'Balloon', 'Rattle', 'Magic Set', 'Bucket And Spade', 'Tea Set', 'Chess', 'Pogo Stick',
  ],
  weather: [
    'Rain', 'Snow', 'Sunshine', 'Rainbow', 'Thunder', 'Lightning', 'Cloud', 'Fog', 'Hail', 'Wind',
    'Whirlwind', 'Thunderstorm', 'Puddle', 'Snowflake', 'Icicle', 'Frost', 'Heatwave', 'Drizzle', 'Breeze', 'Wellies',
    'Raincoat', 'Weather Forecast', 'Thermometer', 'Blizzard', 'Dew', 'Snowman', 'Sunglasses', 'Sun Hat', 'Mittens', 'Scarf',
    'Weather Vane', 'Sunscreen', 'Snow Day', 'Spring', 'Summer', 'Autumn', 'Winter', 'Sunrise', 'Sunset', 'Sledge',
  ],
};

/**
 * 🎭 Undercover: the crew all get one word of a pair and the undercover player(s) get the
 * other — close enough that they may not realise they're the odd one out. All lowercase.
 */
export const UNDERCOVER_PAIRS: [string, string][] = [
  ['cat', 'dog'], ['beach', 'pool'], ['apple', 'pear'], ['lion', 'tiger'], ['pizza', 'burger'],
  ['juice', 'smoothie'], ['piano', 'guitar'], ['football', 'rugby'], ['sun', 'moon'], ['rain', 'snow'],
  ['train', 'bus'], ['car', 'van'], ['plane', 'helicopter'], ['ship', 'submarine'], ['pencil', 'crayon'],
  ['spoon', 'fork'], ['cup', 'mug'], ['shoe', 'boot'], ['hat', 'cap'], ['sock', 'glove'],
  ['bed', 'sofa'], ['chair', 'stool'], ['cake', 'pie'], ['cookie', 'cracker'], ['ice cream', 'milkshake'],
  ['butterfly', 'moth'], ['bee', 'ladybird'], ['frog', 'toad'], ['rabbit', 'hamster'], ['horse', 'donkey'],
  ['cow', 'goat'], ['duck', 'goose'], ['owl', 'eagle'], ['penguin', 'puffin'], ['shark', 'dolphin'],
  ['octopus', 'jellyfish'], ['crab', 'lobster'], ['whale', 'seal'], ['snail', 'slug'], ['spider', 'ant'],
  ['elephant', 'rhino'], ['giraffe', 'zebra'], ['monkey', 'gorilla'], ['panda', 'koala'], ['fox', 'wolf'],
  ['squirrel', 'chipmunk'], ['mouse', 'gerbil'], ['parrot', 'flamingo'], ['swan', 'pelican'], ['dinosaur', 'dragon'],
  ['unicorn', 'pegasus'], ['wizard', 'magician'], ['king', 'knight'], ['pirate', 'sailor'], ['robot', 'alien'],
  ['astronaut', 'pilot'], ['doctor', 'nurse'], ['teacher', 'librarian'], ['chef', 'baker'], ['firefighter', 'lifeguard'],
  ['farmer', 'gardener'], ['singer', 'dancer'], ['painter', 'photographer'], ['dentist', 'vet'], ['school', 'library'],
  ['park', 'playground'], ['zoo', 'farm'], ['museum', 'castle'], ['cinema', 'theatre'], ['supermarket', 'bakery'],
  ['airport', 'harbour'], ['desert', 'jungle'], ['mountain', 'volcano'], ['lake', 'river'], ['forest', 'garden'],
  ['cave', 'tunnel'], ['igloo', 'tent'], ['treehouse', 'hut'], ['basketball', 'netball'], ['tennis', 'badminton'],
  ['swimming', 'diving'], ['skiing', 'snowboarding'], ['skateboard', 'scooter'], ['bicycle', 'tricycle'], ['cricket', 'baseball'],
  ['hockey', 'golf'], ['karate', 'judo'], ['ballet', 'gymnastics'], ['sprint', 'marathon'], ['bowling', 'mini golf'],
  ['chess', 'draughts'], ['kite', 'balloon'], ['yoyo', 'spinning top'], ['doll', 'teddy'], ['puzzle', 'maze'],
  ['blocks', 'dominoes'], ['drum', 'tambourine'], ['violin', 'cello'], ['trumpet', 'trombone'], ['flute', 'recorder'],
  ['song', 'poem'], ['book', 'magazine'], ['comic', 'cartoon'], ['tv', 'radio'], ['phone', 'tablet'],
  ['computer', 'calculator'], ['camera', 'binoculars'], ['clock', 'watch'], ['lamp', 'candle'], ['window', 'door'],
  ['stairs', 'ladder'], ['bath', 'shower'], ['toothbrush', 'hairbrush'], ['soap', 'shampoo'], ['towel', 'blanket'],
  ['pillow', 'cushion'], ['fridge', 'freezer'], ['oven', 'microwave'], ['kettle', 'teapot'], ['bread', 'bagel'],
  ['cheese', 'butter'], ['milk', 'yogurt'], ['egg', 'pancake'], ['rice', 'pasta'], ['soup', 'stew'],
  ['sandwich', 'wrap'], ['taco', 'burrito'], ['sushi', 'noodles'], ['carrot', 'parsnip'], ['broccoli', 'cauliflower'],
  ['cherry', 'grape'], ['orange', 'tangerine'], ['lemon', 'lime'], ['banana', 'mango'], ['watermelon', 'pineapple'],
  ['peach', 'plum'], ['coconut', 'kiwi'], ['chocolate', 'caramel'], ['popcorn', 'crisps'], ['doughnut', 'muffin'],
  ['cupcake', 'brownie'], ['lollipop', 'candyfloss'], ['jelly', 'custard'], ['honey', 'jam'], ['lemonade', 'water'],
  ['thunder', 'lightning'], ['snowman', 'sandcastle'], ['holiday', 'birthday'], ['party', 'picnic'], ['backpack', 'suitcase'],
];

/** 😀 Emoji clues: each clue is 1–2 of these. Picked to describe almost anything. */
export const EMOJI_CLUES: string[] = [
  '🐶', '🐱', '🐟', '🐦', '🐛', '🦁', '🐘', '🐸',
  '🌳', '🌸', '🌊', '⛰️', '☀️', '🌙', '⭐', '❄️',
  '🔥', '💧', '⚡', '🌈', '🌍', '🧊', '✨', '❤️',
  '🍎', '🍕', '🍦', '🍰', '🥕', '🧀', '🍽️', '😋',
  '⚽', '🎨', '🎵', '📚', '✏️', '🎁', '🎈', '🧸',
  '🏠', '🏰', '🚗', '✈️', '🚀', '⛵', '👑', '🤖',
  '😀', '😴', '🏃', '💪', '👀', '👂', '✋', '🤫',
  '⬆️', '⬇️', '🔴', '🔵', '🟢', '🟡', '🔊', '🕐',
];

export const categoryInfo = (id: ImposterCategory): CategoryInfo =>
  IMPOSTER_CATEGORIES.find(c => c.id === id) ?? IMPOSTER_CATEGORIES[0];
