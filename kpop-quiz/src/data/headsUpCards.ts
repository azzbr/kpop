// Heads Up card decks — kid-friendly, well known, easy to act out or describe.
// Movies & TV are titles only (G/PG, widely known by 8–12 year olds).

export type HeadsUpCategoryId =
  | 'animals' | 'movies' | 'actions' | 'sports' | 'food' | 'jobs' | 'places' | 'superpowers';

export interface HeadsUpCategory { id: HeadsUpCategoryId; name: string; emoji: string; hint: string; cards: string[] }

export const HEADS_UP_CATEGORIES: HeadsUpCategory[] = [
  {
    id: 'animals', name: 'Animals', emoji: '🐘', hint: 'Make the noise, do the moves!',
    cards: [
      'Elephant', 'Giraffe', 'Penguin', 'Kangaroo', 'Monkey', 'Snake', 'Frog', 'Chicken', 'Dog', 'Cat',
      'Lion', 'Shark', 'Dolphin', 'Owl', 'Bunny', 'Crab', 'Horse', 'Cow', 'Pig', 'Duck',
      'Gorilla', 'Butterfly', 'Mouse', 'Octopus', 'Turtle', 'Sloth', 'Bat', 'Flamingo', 'Panda', 'Koala',
      'Zebra', 'Camel', 'Seal', 'Peacock', 'Squirrel', 'Bee', 'Crocodile', 'Polar Bear', 'Hedgehog', 'T-Rex',
    ],
  },
  {
    id: 'movies', name: 'Movies & TV', emoji: '🎬', hint: 'Act out the characters or hum the song!',
    cards: [
      'Frozen', 'Toy Story', 'Moana', 'Encanto', 'The Lion King', 'Finding Nemo', 'Shrek', 'Minions', 'Cars', 'Inside Out',
      'Zootopia', 'Coco', 'Up', 'Ratatouille', 'The Incredibles', 'Monsters, Inc.', 'PAW Patrol', 'Peppa Pig', 'Bluey', 'SpongeBob SquarePants',
      'Despicable Me', 'Kung Fu Panda', 'How to Train Your Dragon', 'Madagascar', 'Tangled', 'Aladdin', 'The Little Mermaid', 'Beauty and the Beast', 'Cinderella', 'Paddington',
      'Harry Potter', 'Pokémon', 'Sonic the Hedgehog', 'The Super Mario Bros. Movie', 'Lilo & Stitch', 'WALL-E', 'Trolls', 'The LEGO Movie', 'Winnie the Pooh', 'Scooby-Doo',
    ],
  },
  {
    id: 'actions', name: 'Actions', emoji: '🎭', hint: 'No talking — act it out!',
    cards: [
      'Brushing teeth', 'Riding a bike', 'Swimming', 'Juggling', 'Baking a cake', 'Walking a dog', 'Playing guitar', 'Washing a car', 'Flying a kite', 'Eating spaghetti',
      'Jumping rope', 'Building a snowman', 'Making a bed', 'Taking a selfie', 'Sneezing', 'Yawning', 'Tying shoelaces', 'Surfing', 'Climbing a ladder', 'Blowing bubbles',
      'Playing the drums', 'Hula hooping', 'Bowling', 'Painting a wall', 'Rowing a boat', 'Ballet dancing', 'Doing a cartwheel', 'Ice skating', 'Brushing hair', 'Washing dishes',
      'Reading a book', 'Opening a present', 'Blowing out candles', 'Catching a fish', 'Mowing the lawn', 'Typing on a computer', 'Walking like a penguin', 'Dancing like a robot', 'Eating an ice cream', 'Putting on socks',
    ],
  },
  {
    id: 'sports', name: 'Sports', emoji: '⚽', hint: 'Show the moves!',
    cards: [
      'Football', 'Basketball', 'Tennis', 'Swimming', 'Gymnastics', 'Baseball', 'Golf', 'Skiing', 'Surfing', 'Skateboarding',
      'Ice Skating', 'Cycling', 'Volleyball', 'Badminton', 'Table Tennis', 'Rugby', 'Cricket', 'Ice Hockey', 'Karate', 'Bowling',
      'Archery', 'Rowing', 'Diving', 'Rock Climbing', 'Sprinting', 'Hurdles', 'Long Jump', 'Snowboarding', 'Sailing', 'Horse Riding',
      'Dodgeball', 'Netball', 'Tug of War', 'Yoga', 'Trampolining', 'Roller Skating', 'Kayaking', 'Fencing', 'Weightlifting', 'Frisbee',
    ],
  },
  {
    id: 'food', name: 'Food', emoji: '🍕', hint: 'Pretend to eat it, describe the taste!',
    cards: [
      'Pizza', 'Pancakes', 'Spaghetti', 'Ice Cream', 'Banana', 'Apple', 'Strawberry', 'Watermelon', 'Popcorn', 'Sandwich',
      'Burger', 'Hot Dog', 'Taco', 'Sushi', 'Cookie', 'Cupcake', 'Donut', 'Cereal', 'Toast', 'Cheese',
      'Carrot', 'Broccoli', 'Corn on the Cob', 'Chips', 'Rice', 'Soup', 'Salad', 'Boiled Egg', 'Yogurt', 'Chocolate',
      'Lemon', 'Grapes', 'Coconut', 'Pineapple', 'Birthday Cake', 'Waffles', 'Noodles', 'Lollipop', 'Pretzel', 'Milkshake',
    ],
  },
  {
    id: 'jobs', name: 'Jobs', emoji: '👩‍🚒', hint: 'What do they do all day?',
    cards: [
      'Doctor', 'Firefighter', 'Teacher', 'Chef', 'Pilot', 'Astronaut', 'Farmer', 'Police Officer', 'Vet', 'Dentist',
      'Baker', 'Artist', 'Singer', 'Dancer', 'Builder', 'Nurse', 'Scientist', 'Librarian', 'Mail Carrier', 'Zookeeper',
      'Photographer', 'Lifeguard', 'Hairdresser', 'Gardener', 'Bus Driver', 'Magician', 'Clown', 'Plumber', 'Mechanic', 'Detective',
      'Pirate', 'Shopkeeper', 'Waiter', 'Footballer', 'DJ', 'Inventor', 'Referee', 'Window Cleaner', 'News Reporter', 'Explorer',
    ],
  },
  {
    id: 'places', name: 'Famous Places', emoji: '🗼', hint: 'Which country? What is it famous for?',
    cards: [
      'Eiffel Tower', 'Statue of Liberty', 'Big Ben', 'Great Wall of China', 'Pyramids of Giza', 'Taj Mahal', 'Mount Everest', 'Grand Canyon', 'Niagara Falls', 'Sydney Opera House',
      'Colosseum', 'Leaning Tower of Pisa', 'Stonehenge', 'Golden Gate Bridge', 'Machu Picchu', 'Disneyland', 'Buckingham Palace', 'Amazon Rainforest', 'Sahara Desert', 'North Pole',
      'Antarctica', 'Hollywood', 'Times Square', 'Mount Fuji', 'Great Barrier Reef', 'Christ the Redeemer', 'Tower Bridge', 'The Moon', 'Venice', 'Hawaii',
      'Empire State Building', 'Burj Khalifa', 'Mount Rushmore', 'Loch Ness', 'Acropolis', 'Uluru', 'Galápagos Islands', 'Victoria Falls', 'Iceland', 'Angkor Wat',
    ],
  },
  {
    id: 'superpowers', name: 'Superpowers', emoji: '🦸', hint: 'Show off your power!',
    cards: [
      'Flying', 'Invisibility', 'Super Strength', 'Super Speed', 'Teleporting', 'Mind Reading', 'Time Travel', 'Shape Shifting', 'Talking to Animals', 'Breathing Underwater',
      'X-Ray Vision', 'Laser Eyes', 'Freezing Things', 'Controlling Weather', 'Shrinking', 'Growing Giant', 'Stretchy Body', 'Healing', 'Super Jumping', 'Wall Climbing',
      'Night Vision', 'Super Hearing', 'Force Field', 'Walking Through Walls', 'Controlling Water', 'Making Plants Grow', 'Copying Yourself', 'Stopping Time', 'Glowing in the Dark', 'Magnet Powers',
      'Super Smell', 'Moving Things With Your Mind', 'Seeing the Future', 'Bubble Shield', 'Making Snow', 'Lightning Powers', 'Speaking Every Language', 'Super Memory', 'Turning Into a Cat', 'Never Getting Tired',
    ],
  },
];

export const headsUpCategory = (id: HeadsUpCategoryId): HeadsUpCategory =>
  HEADS_UP_CATEGORIES.find(c => c.id === id) ?? HEADS_UP_CATEGORIES[0];
