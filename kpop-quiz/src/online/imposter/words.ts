// Imposter word lists — kid-friendly, easy to give a one-word clue for. No scary or violent words.

export type ImposterCategory =
  | 'animals' | 'food' | 'places' | 'sports' | 'school' | 'jobs' | 'home' | 'fantasy';

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
    'Burger', 'Hot Dog', 'Taco', 'Sushi', 'Cookie', 'Cupcake', 'Donut', 'Cereal', 'Toast', 'Cheese',
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
    'Dodgeball', 'Netball', 'Ballet', 'Yoga', 'Trampoline', 'Roller Skating', 'Kayaking', 'Fencing', 'Hopscotch', 'Frisbee',
  ],
  school: [
    'Pencil', 'Eraser', 'Ruler', 'Backpack', 'Teacher', 'Whiteboard', 'Homework', 'Lunchbox', 'Desk', 'Library Book',
    'Scissors', 'Glue Stick', 'Calculator', 'Crayon', 'Notebook', 'Playtime', 'Spelling Test', 'Globe', 'Map', 'Paintbrush',
    'Sharpener', 'Recorder', 'Science Lab', 'Microscope', 'School Bus', 'Uniform', 'Assembly', 'Gym Class', 'Maths', 'Art Class',
    'Classroom', 'Bell', 'Field Trip', 'Sticker', 'Pencil Case', 'Dictionary', 'Chalk', 'Report Card', 'Lunch Hall', 'Clock',
  ],
  jobs: [
    'Doctor', 'Firefighter', 'Teacher', 'Chef', 'Pilot', 'Astronaut', 'Farmer', 'Police Officer', 'Vet', 'Dentist',
    'Baker', 'Artist', 'Singer', 'Dancer', 'Builder', 'Nurse', 'Scientist', 'Librarian', 'Mail Carrier', 'Zookeeper',
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
    'Unicorn', 'Dragon', 'Wizard', 'Fairy', 'Mermaid', 'Castle', 'Magic Wand', 'Treasure Chest', 'Crown', 'Princess',
    'Knight', 'Giant', 'Elf', 'Pixie', 'Genie', 'Flying Carpet', 'Potion', 'Spell Book', 'Rainbow', 'Pegasus',
    'Phoenix', 'Gnome', 'Troll', 'Robot', 'Superhero', 'Time Machine', 'Magic Mirror', 'Crystal Ball', 'Pirate Ship', 'Treasure Map',
    'Gingerbread House', 'Beanstalk', 'Glass Slipper', 'Talking Cat', 'Cloud Castle', 'Jetpack', 'Alien', 'Rocket', 'Invisibility Cloak', 'Fairy Dust',
  ],
};

export const categoryInfo = (id: ImposterCategory): CategoryInfo =>
  IMPOSTER_CATEGORIES.find(c => c.id === id) ?? IMPOSTER_CATEGORIES[0];
