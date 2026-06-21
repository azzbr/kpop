// Riddle Rush bank. Read the riddle and type the answer.
// Kid-friendly classics; `alt` lists accepted variants. Matching ignores
// case, spaces and punctuation (see GuessRace normalize).

export interface Riddle {
  q: string;
  answer: string;
  alt?: string[];
  hint?: string;
}

export const RIDDLES: Riddle[] = [
  // --- Classic "what am I" object riddles ---
  { q: 'I have keys but open no locks. What am I?', answer: 'piano', alt: ['keyboard'], hint: 'a musical instrument' },
  { q: 'I have hands but cannot clap. What am I?', answer: 'clock', alt: ['watch'], hint: 'it tells the time' },
  { q: 'I get wetter the more I dry. What am I?', answer: 'towel', hint: 'you use it after a bath' },
  { q: 'I have a face and two hands but no arms or legs. What am I?', answer: 'clock', alt: ['watch'], hint: 'tick tock' },
  { q: 'I must be broken before you can use me. What am I?', answer: 'egg', hint: 'a chicken lays me' },
  { q: 'I have a neck but no head. What am I?', answer: 'bottle', hint: 'you drink from me' },
  { q: 'I have many teeth but cannot bite. What am I?', answer: 'comb', alt: ['zipper'], hint: 'you use me on your hair' },
  { q: 'I have one eye but cannot see. What am I?', answer: 'needle', hint: 'you sew with me' },
  { q: 'I have a thumb and four fingers but I am not alive. What am I?', answer: 'glove', hint: 'keeps your hand warm' },
  { q: 'I have legs but I cannot walk. What am I?', answer: 'table', alt: ['chair'], hint: 'furniture you eat at' },
  { q: 'I am full of holes but I still hold water. What am I?', answer: 'sponge', hint: 'you wash with me' },
  { q: 'I have a tail and a head but no body. What am I?', answer: 'coin', alt: ['penny'], hint: 'money you can flip' },
  { q: 'I have words but I never speak. What am I?', answer: 'book', hint: 'you read me' },
  { q: 'I have a ring but no finger. What am I?', answer: 'telephone', alt: ['phone', 'bell', 'doorbell'], hint: 'I ring when someone calls' },
  { q: 'I have a bed but I never sleep, and I run but never walk. What am I?', answer: 'river', hint: 'water flows through me' },
  { q: 'I am tall when I am young and short when I am old. What am I?', answer: 'candle', hint: 'I have a flame' },
  { q: 'I go up but I never come down. What am I?', answer: 'age', alt: ['your age'], hint: 'it grows on your birthday' },
  { q: 'The more you take away from me, the bigger I get. What am I?', answer: 'hole', hint: 'you dig me' },
  { q: 'I can travel around the world while staying in one corner. What am I?', answer: 'stamp', hint: 'you stick me on a letter' },
  { q: 'The more of me you take, the more you leave behind. What am I?', answer: 'footsteps', alt: ['footprints', 'steps'], hint: 'you make me when you walk' },
  { q: 'What kind of room has no doors or windows?', answer: 'mushroom', hint: 'it grows in the forest' },
  { q: 'What building has the most stories?', answer: 'library', hint: 'it is full of books' },
  { q: 'I am black and white and read all over. What am I?', answer: 'newspaper', alt: ['paper'], hint: 'people read me with the news' },
  { q: 'What has a thousand needles but cannot sew?', answer: 'porcupine', alt: ['hedgehog', 'cactus'], hint: 'a spiky animal' },
  { q: 'What kind of band never plays music?', answer: 'rubber band', alt: ['band'], hint: 'it is stretchy' },
  { q: 'What flies all day but never goes anywhere?', answer: 'flag', hint: 'it waves on a pole' },
  { q: 'I shine at night but I am not the sun. What am I?', answer: 'moon', alt: ['star'], hint: 'you see me in the dark sky' },
  { q: 'I twinkle high in the night sky. What am I?', answer: 'star', alt: ['stars'], hint: 'wish upon me' },
  { q: 'I fall but I never get hurt, I am cold and white. What am I?', answer: 'snow', alt: ['snowflake'], hint: 'I come in winter' },
  { q: 'I have a golden head and a golden tail but no body. What am I?', answer: 'coin', hint: 'you can spend me' },
  { q: 'What can you catch but never throw?', answer: 'cold', alt: ['a cold'], hint: 'it makes you sneeze' },
  { q: 'What has ears but cannot hear?', answer: 'corn', alt: ['cornfield'], hint: 'it grows on a cob' },
  { q: 'What goes up and down but never moves?', answer: 'stairs', alt: ['staircase'], hint: 'you climb me' },
  { q: 'What has a bottom at the top?', answer: 'legs', alt: ['your legs'], hint: 'part of your body' },
  { q: 'What has a head, a tail, but no arms and no legs?', answer: 'coin', hint: 'money you flip' },
  { q: 'What can fill a whole room but takes up no space?', answer: 'light', alt: ['air', 'sound'], hint: 'flip a switch for it' },
  { q: 'What has a face and runs without legs?', answer: 'clock', hint: 'it ticks all day' },
  { q: 'What kind of coat is best put on wet?', answer: 'paint', alt: ['a coat of paint'], hint: 'you brush it on a wall' },
  { q: 'What has teeth but cannot eat?', answer: 'comb', alt: ['zipper', 'saw'], hint: 'tidy your hair with it' },
  { q: 'What has a spine but no bones?', answer: 'book', hint: 'you read it' },
  { q: 'What word is spelled wrong in every dictionary?', answer: 'wrong', hint: 'the opposite of right' },
  { q: 'Which month has 28 days?', answer: 'all of them', alt: ['all', 'every month', 'all months'], hint: 'think about every month' },
  { q: 'I am a number. Take away one letter and I become even. What am I?', answer: 'seven', hint: 's + even' },
  { q: 'What can run but cannot walk, has a mouth but never talks?', answer: 'river', alt: ['stream'], hint: 'water flows in me' },

  // --- "What am I" animal riddles ---
  { q: 'I carry my house on my back and move very slowly. What am I?', answer: 'snail', alt: ['turtle', 'tortoise'], hint: 'I leave a slimy trail' },
  { q: 'I have stripes and a loud roar. What am I?', answer: 'tiger', hint: 'a big wild cat' },
  { q: 'I have a long neck and eat leaves from tall trees. What am I?', answer: 'giraffe', hint: 'the tallest animal' },
  { q: 'I have a trunk but I am not a tree. What am I?', answer: 'elephant', hint: 'the biggest land animal' },
  { q: 'I am black and white and love to eat bamboo. What am I?', answer: 'panda', hint: 'a cuddly looking bear' },
  { q: 'I waddle on the ice and I am a bird that cannot fly. What am I?', answer: 'penguin', hint: 'I live where it is cold' },
  { q: 'I buzz from flower to flower and make honey. What am I?', answer: 'bee', hint: 'I am yellow and black' },
  { q: 'I spin a web to catch my dinner. What am I?', answer: 'spider', hint: 'I have eight legs' },
  { q: 'I hop on lily pads and say ribbit. What am I?', answer: 'frog', hint: 'I am green' },
  { q: 'I am the king of the jungle. What am I?', answer: 'lion', hint: 'I have a big mane' },
  { q: 'I have a shell and eight arms in the sea. What am I?', answer: 'octopus', hint: 'I can squirt ink' },
  { q: 'I am a baby dog. What am I?', answer: 'puppy', hint: 'I am small and woof' },
  { q: 'I am a baby cat. What am I?', answer: 'kitten', hint: 'I am small and meow' },
  { q: 'I have spots and I am the fastest animal on land. What am I?', answer: 'cheetah', hint: 'I run super fast' },
  { q: 'I am the largest animal in the whole ocean. What am I?', answer: 'whale', alt: ['blue whale'], hint: 'I spout water' },
  { q: 'I jump very high and carry my baby in a pouch. What am I?', answer: 'kangaroo', hint: 'I live in Australia' },
  { q: 'I say moo and give you milk. What am I?', answer: 'cow', hint: 'I live on a farm' },
  { q: 'I am pink and I say oink. What am I?', answer: 'pig', hint: 'I roll in the mud' },
  { q: 'I have soft wool and I say baa. What am I?', answer: 'sheep', hint: 'a farm animal' },
  { q: 'I say quack and I swim in ponds. What am I?', answer: 'duck', hint: 'I have webbed feet' },
  { q: 'I purr and I say meow. What am I?', answer: 'cat', hint: 'a furry pet' },
  { q: 'I am loyal, I fetch sticks, and I say woof. What am I?', answer: 'dog', hint: 'man’s best friend' },
  { q: 'I have a fin and sharp teeth and I live in the sea. What am I?', answer: 'shark', hint: 'people fear me in the water' },
  { q: 'I hoot at night and turn my head all the way around. What am I?', answer: 'owl', hint: 'a wise night bird' },

  // --- "What am I" food riddles ---
  { q: 'I am yellow, I peel, and monkeys love me. What am I?', answer: 'banana', hint: 'a curved fruit' },
  { q: 'I am red, round, and I keep the doctor away. What am I?', answer: 'apple', hint: 'grows on a tree' },
  { q: 'You cut me and you cry, but I am not sad. What am I?', answer: 'onion', hint: 'a smelly vegetable' },
  { q: 'I am cold and sweet and I melt in the sun. What am I?', answer: 'ice cream', alt: ['icecream', 'ice lolly', 'popsicle'], hint: 'a summer treat on a cone' },
  { q: 'I am round and hot with cheese on top. What am I?', answer: 'pizza', hint: 'cut into slices' },
  { q: 'I am sticky and sweet and bees make me. What am I?', answer: 'honey', hint: 'spread me on toast' },
  { q: 'I go pop when you heat me and you eat me at the movies. What am I?', answer: 'popcorn', hint: 'a fluffy corn snack' },

  // --- "What am I" nature riddles ---
  { q: 'I rise in the east and set in the west. What am I?', answer: 'sun', hint: 'I shine in the day' },
  { q: 'I am made of drops and I fall from the clouds. What am I?', answer: 'rain', alt: ['raindrop'], hint: 'an umbrella keeps me off you' },
  { q: 'I appear after the rain with seven colours. What am I?', answer: 'rainbow', hint: 'an arch in the sky' },
  { q: 'I am fluffy and white and I float in the sky. What am I?', answer: 'cloud', hint: 'rain comes from me' },
  { q: 'You cannot see me but you feel me push the trees. What am I?', answer: 'wind', alt: ['air'], hint: 'I blow kites' },
  { q: 'I grow from a tiny seed and I give you shade. What am I?', answer: 'tree', hint: 'I have a trunk and leaves' },
  { q: 'I am a mountain that can erupt with hot lava. What am I?', answer: 'volcano', hint: 'I rumble and smoke' },
  { q: 'I float in space and you live on me. What am I?', answer: 'earth', alt: ['planet', 'the earth', 'world'], hint: 'a big blue and green ball' },

  // --- "What am I" fantasy & object riddles ---
  { q: 'I breathe fire and have big wings in fairy tales. What am I?', answer: 'dragon', hint: 'knights fight me' },
  { q: 'I am a magical horse with a single horn. What am I?', answer: 'unicorn', hint: 'I am rainbow-coloured in stories' },
  { q: 'I am half girl and half fish and I live in the sea. What am I?', answer: 'mermaid', hint: 'I have a fishy tail' },
  { q: 'I fly on a broomstick in spooky stories. What am I?', answer: 'witch', hint: 'I have a pointy hat' },
  { q: 'I have high stone walls and a king and queen live in me. What am I?', answer: 'castle', hint: 'I may have a moat' },
  { q: 'You wear me on your feet to keep them warm and dry. What am I?', answer: 'shoes', alt: ['shoe', 'boots'], hint: 'they come in pairs' },
  { q: 'I keep you dry when it rains. What am I?', answer: 'umbrella', hint: 'you open me over your head' },
  { q: 'I have pages and a cover and you turn me to read a story. What am I?', answer: 'book', hint: 'a library is full of me' },
  { q: 'You look into me to see your own face. What am I?', answer: 'mirror', hint: 'I show a reflection' },
  { q: 'I open and close to let you in and out of a room. What am I?', answer: 'door', hint: 'I have a handle' },
  { q: 'I tick and tock and tell you the time. What am I?', answer: 'clock', alt: ['watch'], hint: 'I have hands' },
  { q: 'I have wheels and pedals and you ride me to school. What am I?', answer: 'bicycle', alt: ['bike'], hint: 'two wheels' },
  { q: 'I blast off with fire and fly into outer space. What am I?', answer: 'rocket', hint: 'astronauts ride me' },
  { q: 'I am where you go each day to read, write, and learn. What am I?', answer: 'school', hint: 'a teacher works here' },
  { q: 'I am soft, I have candles, and you make a wish over me. What am I?', answer: 'cake', alt: ['birthday cake'], hint: 'a birthday treat' },
  { q: 'You blow me up for a party and I can float or pop. What am I?', answer: 'balloon', hint: 'I am full of air' },

  // --- "Who am I" job riddles ---
  { q: 'I help sick people feel better. Who am I?', answer: 'doctor', alt: ['nurse'], hint: 'I work in a hospital' },
  { q: 'I rush to put out fires. Who am I?', answer: 'firefighter', alt: ['fireman'], hint: 'I ride a red truck' },
  { q: 'I fly planes high in the sky. Who am I?', answer: 'pilot', hint: 'I sit in the cockpit' },
  { q: 'I cook tasty food in a restaurant. Who am I?', answer: 'chef', alt: ['cook'], hint: 'I wear a tall white hat' },
  { q: 'I teach children at school every day. Who am I?', answer: 'teacher', hint: 'I use a whiteboard' },
  { q: 'I travel to space inside a rocket. Who am I?', answer: 'astronaut', hint: 'I wear a space suit' },
  { q: 'I make people laugh at the circus with my red nose. Who am I?', answer: 'clown', hint: 'I have big shoes' },
  { q: 'I keep people safe and catch the bad guys. Who am I?', answer: 'police', alt: ['police officer', 'policeman', 'cop'], hint: 'I wear a badge' },
  { q: 'I deliver letters and parcels to your door. Who am I?', answer: 'postman', alt: ['mailman', 'mail carrier'], hint: 'I carry a big bag' },

  // --- A few more brain-ticklers ---
  { q: 'What can you break with just one word?', answer: 'silence', hint: 'it means total quiet' },
  { q: 'What has a neck and two arms but no hands?', answer: 'shirt', alt: ['jumper', 'sweater'], hint: 'you wear it on your top half' },
  { q: 'What has a tongue but never talks or tastes?', answer: 'shoe', alt: ['shoes'], hint: 'it goes on your foot' },
  { q: 'What is always coming but never actually arrives?', answer: 'tomorrow', hint: 'it is the day after today' },
  { q: 'I am light as a feather, yet even the strongest person can hold me for only a minute. What am I?', answer: 'breath', alt: ['your breath'], hint: 'you take one to breathe' },
  { q: 'What runs all the way around a garden but never moves?', answer: 'fence', alt: ['wall'], hint: 'it keeps the garden in' },
  { q: 'What has many rings but no fingers, and the rings tell its age?', answer: 'tree', hint: 'count the circles inside its trunk' },
  { q: 'What has lots of teeth and joins the two sides of your coat together?', answer: 'zipper', alt: ['zip'], hint: 'you pull it up' },
  { q: 'What is round, has no beginning or end, and you can wear it on your finger?', answer: 'ring', hint: 'a piece of jewellery' },
  { q: 'What kind of "key" is a cheeky animal that loves bananas?', answer: 'monkey', hint: 'mon-key' },
  { q: 'What kind of "key" is a big bird people eat at a feast?', answer: 'turkey', hint: 'tur-key' },
  { q: 'What has black and white stripes and is a safe place to cross the road?', answer: 'zebra crossing', alt: ['crossing'], hint: 'named after a stripy animal' },
  { q: 'I am white, I come from a cow, and you pour me on your cereal. What am I?', answer: 'milk', hint: 'you drink me' },
  { q: 'What has a tail, can wag, and is a happy dog’s way of saying hello?', answer: 'tail', hint: 'it wags when a dog is happy' },
];

// Pick N riddles, shuffled fresh each game.
export function pickRiddles(n: number): Riddle[] {
  return [...RIDDLES].sort(() => Math.random() - 0.5).slice(0, n);
}
