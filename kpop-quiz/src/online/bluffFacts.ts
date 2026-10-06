// Bluff Buster prompts: a weird-but-true fact with one gap. Everyone types a fake answer for the
// gap, then tries to spot the real one. Every fact here has been fact-checked; answers (and alts)
// are lowercase letters and spaces only, ≤ 20 characters, because kids type them on the
// on-screen keyboard. `alt` lists other answers that also count as the truth (a fake that matches
// one is refused as "that's the real answer").

export interface BluffPrompt {
  id: string;
  /** The fact, with exactly one `___` for the gap. */
  text: string;
  answer: string;
  alt?: string[];
  /** One friendly sentence shown with the reveal. */
  fact: string;
}

export const BLUFF_PROMPTS: BluffPrompt[] = [
  // ── Animal groups ──
  { id: 'g-flamingo', text: 'A group of flamingos is called a ___.', answer: 'flamboyance', fact: 'A flamboyance of flamingos — as bright and showy as it sounds!' },
  { id: 'g-owl', text: 'A group of owls is called a ___.', answer: 'parliament', fact: 'Owls look so wise that a group of them is named after a meeting of law-makers.' },
  { id: 'g-jelly', text: 'A group of jellyfish is called a ___.', answer: 'smack', alt: ['bloom'], fact: 'A group of jellyfish is a smack (a huge one is called a bloom).' },
  { id: 'g-zebra', text: 'A group of zebras is called a ___.', answer: 'dazzle', alt: ['zeal'], fact: 'All those stripes moving together really do dazzle — and confuse hungry lions.' },
  { id: 'g-giraffe', text: 'A group of giraffes standing still is called a ___.', answer: 'tower', fact: 'Giraffes standing together are a tower; when they walk they are a journey.' },
  { id: 'g-porcupine', text: 'A group of porcupines is called a ___.', answer: 'prickle', fact: 'A prickle of porcupines — careful where you sit!' },
  { id: 'g-rhino', text: 'A group of rhinos is called a ___.', answer: 'crash', fact: 'A group of rhinos is a crash, which suits an animal that can charge at about 50 km/h.' },
  { id: 'g-penguin', text: 'A group of penguins swimming in the water is called a ___.', answer: 'raft', fact: 'Penguins in the water are a raft; on land they are a waddle or a colony.' },
  { id: 'g-ferret', text: 'A group of ferrets is called a ___.', answer: 'business', fact: 'A group of ferrets is a business — busy, busy, busy!' },
  { id: 'g-pug', text: 'A group of pugs is called a ___.', answer: 'grumble', fact: 'Pugs snort and snuffle so much that a group of them is a grumble.' },
  { id: 'g-lemur', text: 'A group of lemurs is called a ___.', answer: 'conspiracy', fact: 'Lemurs huddle and plot together — a group is a conspiracy.' },
  { id: 'g-hippo', text: 'A group of hippos is called a ___.', answer: 'bloat', fact: 'A group of hippos is a bloat (or a pod).' },
  { id: 'g-butterfly', text: 'A group of butterflies is called a ___.', answer: 'kaleidoscope', alt: ['flutter'], fact: 'A group of butterflies can be a kaleidoscope or a flutter — so colourful!' },
  { id: 'g-cat', text: 'A group of cats is called a ___.', answer: 'clowder', fact: 'A group of cats is a clowder (some people also say a glaring).' },
  { id: 'g-kitten', text: 'A group of kittens is called a ___.', answer: 'kindle', alt: ['litter'], fact: 'A group of kittens is a kindle or a litter.' },
  { id: 'g-bear', text: 'A group of bears is called a ___.', answer: 'sleuth', alt: ['sloth'], fact: 'A group of bears is a sleuth or a sloth — even though bears are not sloths!' },
  { id: 'g-frog', text: 'A group of frogs is called an ___.', answer: 'army', fact: 'A group of frogs is an army — a very hoppy army.' },
  { id: 'g-parrot', text: 'A group of parrots is called a ___.', answer: 'pandemonium', fact: 'Parrots are LOUD, so a group of them is a pandemonium.' },
  { id: 'g-shark', text: 'A group of sharks is called a ___.', answer: 'shiver', fact: 'A group of sharks is often called a shiver — brrr!' },
  { id: 'g-humming', text: 'A group of hummingbirds is called a ___.', answer: 'charm', alt: ['bouquet'], fact: 'A group of hummingbirds is a charm (or a bouquet).' },

  // ── Baby animals ──
  { id: 'b-kangaroo', text: 'A baby kangaroo is called a ___.', answer: 'joey', fact: 'A baby kangaroo is a joey, and it grows up in its mum’s pouch.' },
  { id: 'b-echidna', text: 'A baby echidna is called a ___.', answer: 'puggle', fact: 'Echidnas lay eggs, and the baby that hatches is called a puggle.' },
  { id: 'b-puffin', text: 'A baby puffin is called a ___.', answer: 'puffling', fact: 'Baby puffins are pufflings — fluffy and grey.' },
  { id: 'b-hedgehog', text: 'A baby hedgehog is called a ___.', answer: 'hoglet', fact: 'Baby hedgehogs are hoglets, and their spines are soft when they are born.' },
  { id: 'b-swan', text: 'A baby swan is called a ___.', answer: 'cygnet', fact: 'A baby swan is a cygnet, and it is fluffy and grey, not white.' },
  { id: 'b-pigeon', text: 'A baby pigeon is called a ___.', answer: 'squab', alt: ['squeaker'], fact: 'Baby pigeons are squabs (or squeakers). They stay in the nest until they are almost grown up, which is why you rarely see one.' },

  // ── Animal facts ──
  { id: 'a-octopus', text: 'An octopus has ___ hearts.', answer: 'three', fact: 'An octopus has three hearts — and blue blood!' },
  { id: 'a-otter-hands', text: 'Sea otters hold ___ while they sleep so they don’t drift apart.', answer: 'hands', alt: ['paws'], fact: 'Sea otters hold paws while they float and sleep, so nobody drifts away.' },
  { id: 'a-otter-rock', text: 'Sea otters keep a favourite ___ in a pocket of skin under their arm.', answer: 'rock', alt: ['stone'], fact: 'Sea otters keep a favourite rock under their arm and use it to crack open shellfish.' },
  { id: 'a-shrimp', text: 'A shrimp’s heart is in its ___.', answer: 'head', fact: 'A shrimp’s heart sits in its head part (the front section of its body).' },
  { id: 'a-butterfly-feet', text: 'Butterflies taste their food with their ___.', answer: 'feet', fact: 'Butterflies have taste sensors on their feet, so they taste a leaf by standing on it.' },
  { id: 'a-snail', text: 'Snails have thousands of tiny ___.', answer: 'teeth', fact: 'A snail’s tongue is covered in thousands of tiny teeth for scraping up food.' },
  { id: 'a-hummingbird', text: 'Hummingbirds can hover in the air and even fly ___.', answer: 'backwards', alt: ['backward'], fact: 'Hummingbirds beat their wings so fast they can hover — and fly backwards!' },
  { id: 'a-polar', text: 'Under its white fur, a polar bear’s skin is ___.', answer: 'black', fact: 'A polar bear’s skin is black, which helps it soak up the sun’s warmth.' },
  { id: 'a-seahorse', text: 'With seahorses, it is the ___ who gives birth to the babies.', answer: 'dad', alt: ['father', 'male', 'daddy'], fact: 'Seahorse dads carry the eggs in a pouch and give birth to the babies.' },
  { id: 'a-giraffe-neck', text: 'A giraffe’s long neck has ___ bones in it.', answer: 'seven', fact: 'A giraffe has seven neck bones — the same number as you! Each one is just much longer.' },
  { id: 'a-ostrich', text: 'An ostrich’s eye is bigger than its ___.', answer: 'brain', fact: 'An ostrich’s eye is bigger than its brain — and bigger than any other land animal’s eye.' },
  { id: 'a-shark-trees', text: 'Sharks lived on Earth before there were any ___.', answer: 'trees', fact: 'Sharks have been around for over 400 million years — longer than trees!' },
  { id: 'a-dolphin', text: 'Dolphins sleep with one ___ open.', answer: 'eye', fact: 'Dolphins rest one half of their brain at a time, keeping one eye open.' },
  { id: 'a-dalmatian', text: 'Dalmatian puppies are born completely ___.', answer: 'white', fact: 'Dalmatian puppies are born white, and their spots appear after a couple of weeks.' },
  { id: 'a-goat', text: 'Goats have pupils shaped like a ___.', answer: 'rectangle', alt: ['rectangular', 'rectangles'], fact: 'Goats have rectangle-shaped pupils, which help them see nearly all the way around.' },
  { id: 'a-rat', text: 'Rats make a laughing sound when they are ___.', answer: 'tickled', alt: ['tickling', 'tickle'], fact: 'Scientists found that rats make happy squeaks, like laughing, when they are tickled.' },
  { id: 'a-sloth', text: 'Sloths can hold their breath for longer than ___.', answer: 'dolphins', alt: ['dolphin'], fact: 'By slowing their heart, sloths can hold their breath for up to 40 minutes — longer than dolphins.' },
  { id: 'a-space-flies', text: 'The first animals sent into space were ___.', answer: 'fruit flies', alt: ['flies', 'fruit fly'], fact: 'In 1947 fruit flies rode a rocket into space — and came back safely.' },
  { id: 'a-koala', text: 'A koala’s ___ look almost exactly like a human’s.', answer: 'fingerprints', alt: ['finger prints'], fact: 'Koala fingerprints are so like ours that they are hard to tell apart, even under a microscope.' },

  // ── Space ──
  { id: 's-venus-day', text: 'A day on Venus is longer than its ___.', answer: 'year', fact: 'Venus spins so slowly that one day there lasts longer than its whole trip round the Sun.' },
  { id: 's-mars-sunset', text: 'Sunsets on Mars look ___.', answer: 'blue', fact: 'Dust in the air on Mars makes its sunsets glow blue.' },
  { id: 's-venus-west', text: 'On Venus, the Sun rises in the ___.', answer: 'west', fact: 'Venus spins the other way round from Earth, so its Sun rises in the west.' },
  { id: 's-saturn', text: 'Saturn is so light for its size that it is less dense than ___.', answer: 'water', fact: 'Saturn is less dense than water — in a giant enough bathtub, it would float!' },
  { id: 's-sunlight', text: 'Light from the Sun takes about ___ minutes to reach Earth.', answer: 'eight', fact: 'Sunlight takes about 8 minutes to reach us, so you see the Sun as it was 8 minutes ago.' },
  { id: 's-hottest', text: 'The hottest planet in our solar system is ___.', answer: 'venus', fact: 'Venus is the hottest planet — even hotter than Mercury — because its thick clouds trap the heat.' },
  { id: 's-short-day', text: 'The planet with the shortest day is ___.', answer: 'jupiter', fact: 'Jupiter spins round in about 10 hours, the shortest day of any planet.' },
  { id: 's-volcano', text: 'The tallest volcano in the solar system is on ___.', answer: 'mars', fact: 'Olympus Mons on Mars is about two and a half times as tall as Mount Everest.' },
  { id: 's-taller', text: 'Astronauts get a little bit ___ while they are in space.', answer: 'taller', fact: 'Without gravity squashing their spine, astronauts grow a few centimetres taller in space.' },
  { id: 's-moon-away', text: 'Every year the Moon moves a tiny bit ___ from Earth.', answer: 'away', alt: ['further', 'farther'], fact: 'The Moon drifts about 4 cm further away from Earth every year.' },
  { id: 's-tardigrade', text: 'Tiny animals called ___ have survived a trip into outer space.', answer: 'tardigrades', alt: ['water bears', 'tardigrade'], fact: 'Tardigrades (water bears) survived 10 days outside a spacecraft in 2007.' },
  { id: 's-lightning', text: 'A bolt of lightning is hotter than the surface of the ___.', answer: 'sun', fact: 'Lightning can be about five times hotter than the surface of the Sun.' },
  { id: 's-australia', text: 'Australia is wider than the ___.', answer: 'moon', fact: 'Australia is about 4,000 km wide; the Moon is about 3,500 km across.' },

  // ── Your body ──
  { id: 'h-ear', text: 'The smallest bone in your body is in your ___.', answer: 'ear', fact: 'The tiniest bone, the stirrup, is deep inside your ear and smaller than a grain of rice.' },
  { id: 'h-bones', text: 'Newborn babies have more ___ than grown-ups.', answer: 'bones', fact: 'Babies are born with about 300 bones; some join together, so adults have 206.' },
  { id: 'h-nails', text: 'Your fingernails grow faster than your ___.', answer: 'toenails', alt: ['toe nails'], fact: 'Fingernails grow faster than toenails — roughly twice as fast.' },
  { id: 'h-cornea', text: 'The ___ at the front of your eye has no blood vessels at all.', answer: 'cornea', fact: 'Your cornea has no blood vessels; it gets most of its oxygen straight from the air.' },
  { id: 'h-hum', text: 'With your mouth closed, you can’t ___ while you hold your nose.', answer: 'hum', fact: 'Humming needs air to come out of your nose — try it (gently)!' },
  { id: 'h-femur', text: 'The longest bone in your body is in your ___.', answer: 'thigh', alt: ['leg', 'upper leg'], fact: 'The femur, your thigh bone, is the longest and strongest bone in your body.' },
  { id: 'h-heart', text: 'Your heart beats about 100,000 times every ___.', answer: 'day', fact: 'Your heart beats about 100,000 times a day without you even thinking about it.' },

  // ── Inventions, words and our planet ──
  { id: 'i-trampoline', text: 'The trampoline was invented by a boy aged ___.', answer: 'sixteen', fact: 'George Nissen built his first trampoline in 1930, when he was 16.' },
  { id: 'i-braille', text: 'Louis Braille invented Braille writing when he was ___ years old.', answer: 'fifteen', fact: 'Louis Braille was 15 when he created his raised-dot alphabet for blind readers.' },
  { id: 'i-lolly', text: 'The ice lolly was invented by accident by a boy aged ___.', answer: 'eleven', fact: 'In 1905, 11-year-old Frank Epperson left a fizzy drink with a stick in it outside on a cold night.' },
  { id: 'i-bubblewrap', text: 'Bubble wrap was first invented to be used as ___.', answer: 'wallpaper', alt: ['wall paper'], fact: 'Bubble wrap began in 1957 as an idea for bumpy wallpaper.' },
  { id: 'i-microwave', text: 'The microwave oven was discovered when a ___ bar melted in an engineer’s pocket.', answer: 'chocolate', alt: ['candy'], fact: 'Percy Spencer noticed a melted chocolate bar near a radar machine, which led to the microwave.' },
  { id: 'i-mouse', text: 'The very first computer mouse was made of ___.', answer: 'wood', alt: ['wooden'], fact: 'The first computer mouse, made in the 1960s, was a little wooden box with wheels.' },
  { id: 'i-bread', text: 'Before rubbers were invented, people rubbed out pencil with ___.', answer: 'bread', fact: 'People used balls of bread to rub out pencil marks before rubber erasers came along.' },
  { id: 'i-eiffel', text: 'The Eiffel Tower gets a little taller in the ___.', answer: 'summer', fact: 'The iron in the Eiffel Tower expands in summer heat, making it up to about 15 cm taller.' },
  { id: 'e-desert', text: 'The largest desert in the world is ___.', answer: 'antarctica', fact: 'A desert is a place with very little rain or snow — so icy Antarctica is the biggest desert!' },
  { id: 'e-scotland', text: 'The national animal of Scotland is the ___.', answer: 'unicorn', fact: 'Scotland’s national animal is the unicorn, a symbol of strength and purity.' },
  { id: 'e-trees', text: 'There are more trees on Earth than ___ in our galaxy, the Milky Way.', answer: 'stars', fact: 'Earth has about 3 trillion trees; the Milky Way has a few hundred billion stars.' },
  { id: 'e-canada', text: 'Canada has more ___ than the rest of the world put together.', answer: 'lakes', fact: 'Canada has more lakes than all the other countries in the world put together.' },
  { id: 'w-tittle', text: 'The dot on top of a small letter i is called a ___.', answer: 'tittle', fact: 'The dot on an i (or a j) is called a tittle.' },
  { id: 'w-aglet', text: 'The plastic tip on the end of a shoelace is called an ___.', answer: 'aglet', fact: 'That little tip on your shoelace is an aglet — it stops the lace fraying.' },
  { id: 'w-petrichor', text: 'The nice earthy smell after it rains is called ___.', answer: 'petrichor', fact: 'Petrichor is the earthy smell of rain falling on dry ground.' },
  { id: 'w-octothorpe', text: 'Another name for the # symbol is the ___.', answer: 'octothorpe', alt: ['octothorp'], fact: 'The # symbol (hash) is also called an octothorpe.' },
  { id: 'e-oxford', text: 'Oxford University is older than the ___ Empire.', answer: 'aztec', fact: 'Teaching began at Oxford around 1096; the Aztec city of Tenochtitlan was founded in 1325.' },
  { id: 'e-honey', text: 'Honey found in ancient Egyptian tombs could still be ___.', answer: 'eaten', alt: ['edible', 'eat'], fact: 'Honey hardly ever goes off — pots thousands of years old were still safe to eat.' },
  { id: 'e-carrot', text: 'Long ago, most carrots were ___, not orange.', answer: 'purple', alt: ['yellow', 'white'], fact: 'The first carrots were purple or yellow; orange carrots became popular in the 1600s.' },
];
