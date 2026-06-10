// Year 4/5 (UK) school question bank for Friends Arena games.

export type SchoolCategory = 'maths' | 'science' | 'english' | 'geography' | 'history' | 'fun';

export interface SchoolQuestion {
  category: SchoolCategory;
  questionText: string;
  answers: { answerText: string; isCorrect: boolean }[];
}

export interface PreparedQ {
  text: string;
  options: string[];
  correct: number;
}

export const CATEGORIES: { id: SchoolCategory | 'mix'; label: string; emoji: string }[] = [
  { id: 'mix', label: 'Mega Mix', emoji: '🎲' },
  { id: 'maths', label: 'Maths', emoji: '🔢' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'english', label: 'English', emoji: '📚' },
  { id: 'geography', label: 'Geography', emoji: '🗺️' },
  { id: 'history', label: 'History', emoji: '🏰' },
  { id: 'fun', label: 'Fun Facts', emoji: '🌈' },
];

const q = (category: SchoolCategory, questionText: string, correct: string, ...wrong: string[]): SchoolQuestion => ({
  category,
  questionText,
  answers: [{ answerText: correct, isCorrect: true }, ...wrong.map((w) => ({ answerText: w, isCorrect: false }))],
});

export const SCHOOL_QUESTIONS: SchoolQuestion[] = [
  // ---- MATHS ----
  q('maths', 'What is 7 × 8?', '56', '54', '48', '64'),
  q('maths', 'What is 9 × 6?', '54', '56', '45', '63'),
  q('maths', 'What is 12 × 12?', '144', '124', '132', '154'),
  q('maths', 'What is 8 × 4?', '32', '28', '36', '24'),
  q('maths', 'What is 11 × 7?', '77', '71', '87', '67'),
  q('maths', 'What is half of 90?', '45', '40', '50', '55'),
  q('maths', 'What is a quarter of 100?', '25', '20', '40', '75'),
  q('maths', 'What is ¾ of 20?', '15', '12', '10', '16'),
  q('maths', 'What is 100 − 37?', '63', '73', '67', '53'),
  q('maths', 'What is 25 + 48?', '73', '63', '83', '75'),
  q('maths', 'What is 144 ÷ 12?', '12', '10', '14', '16'),
  q('maths', 'How many minutes are in 1¼ hours?', '75', '65', '85', '90'),
  q('maths', 'What number is the Roman numeral XII?', '12', '7', '11', '14'),
  q('maths', 'What is the Roman numeral for 10?', 'X', 'V', 'L', 'C'),
  q('maths', 'How many degrees are in a right angle?', '90', '45', '180', '100'),
  q('maths', 'The angles inside a triangle add up to…?', '180°', '90°', '360°', '270°'),
  q('maths', 'How many sides does a hexagon have?', '6', '5', '7', '8'),
  q('maths', 'How many faces does a cube have?', '6', '4', '8', '12'),
  q('maths', 'What comes next: 6, 12, 18, 24, …?', '30', '28', '32', '36'),
  q('maths', 'How many metres are in 1 kilometre?', '1,000', '100', '10', '500'),
  // ---- SCIENCE ----
  q('science', 'At what temperature does water freeze?', '0°C', '10°C', '32°C', '100°C'),
  q('science', 'At what temperature does water boil?', '100°C', '50°C', '90°C', '200°C'),
  q('science', 'When a solid turns into a liquid, it is called…?', 'Melting', 'Freezing', 'Evaporating', 'Condensing'),
  q('science', 'When a liquid turns into a gas, it is called…?', 'Evaporation', 'Melting', 'Freezing', 'Condensation'),
  q('science', 'When a gas turns back into a liquid, it is called…?', 'Condensation', 'Evaporation', 'Melting', 'Boiling'),
  q('science', 'Which organ pumps blood around your body?', 'The heart', 'The brain', 'The lungs', 'The stomach'),
  q('science', 'How many bones are in an adult human body?', '206', '106', '306', '86'),
  q('science', 'What is the largest organ of the human body?', 'The skin', 'The heart', 'The brain', 'The liver'),
  q('science', 'How do plants make their own food?', 'Photosynthesis', 'Respiration', 'Digestion', 'Evaporation'),
  q('science', 'Which gas do plants take in from the air?', 'Carbon dioxide', 'Oxygen', 'Helium', 'Hydrogen'),
  q('science', 'Which gas do humans need to breathe in?', 'Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'),
  q('science', 'How long does Earth take to orbit the Sun?', 'One year', 'One day', 'One month', 'One week'),
  q('science', 'Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Earth', 'Mars'),
  q('science', 'Which planet is known as the Red Planet?', 'Mars', 'Jupiter', 'Venus', 'Saturn'),
  q('science', 'What force pulls things down to the ground?', 'Gravity', 'Friction', 'Magnetism', 'Air resistance'),
  q('science', 'For electricity to flow, a circuit must be…?', 'Complete (closed)', 'Broken', 'Wooden', 'Wet'),
  q('science', 'Which material is a good conductor of electricity?', 'Copper', 'Wood', 'Plastic', 'Rubber'),
  q('science', 'Sound is made when something…?', 'Vibrates', 'Glows', 'Melts', 'Floats'),
  q('science', 'An animal that only eats plants is called a…?', 'Herbivore', 'Carnivore', 'Omnivore', 'Predator'),
  q('science', 'An animal that is active at night is called…?', 'Nocturnal', 'Diurnal', 'Hibernating', 'Migrating'),
  // ---- ENGLISH ----
  q('english', 'A word that names a person, place or thing is a…?', 'Noun', 'Verb', 'Adjective', 'Adverb'),
  q('english', 'A doing or action word is called a…?', 'Verb', 'Noun', 'Adjective', 'Pronoun'),
  q('english', 'A word that describes a noun is an…?', 'Adjective', 'Adverb', 'Verb', 'Article'),
  q('english', 'A word that describes a verb is an…?', 'Adverb', 'Adjective', 'Noun', 'Pronoun'),
  q('english', 'Which word is a synonym of "happy"?', 'Joyful', 'Sad', 'Angry', 'Sleepy'),
  q('english', 'What is the opposite of "hot"?', 'Cold', 'Warm', 'Boiling', 'Sunny'),
  q('english', 'What is the plural of "child"?', 'Children', 'Childs', 'Childes', 'Childrens'),
  q('english', 'What is the plural of "mouse"?', 'Mice', 'Mouses', 'Mouse', 'Mices'),
  q('english', 'What is the past tense of "run"?', 'Ran', 'Runned', 'Running', 'Runs'),
  q('english', 'What is the past tense of "go"?', 'Went', 'Goed', 'Gone to', 'Going'),
  q('english', 'Which spelling is correct?', 'Because', 'Becuase', 'Becose', 'Beecause'),
  q('english', 'Which spelling is correct?', 'Beautiful', 'Beutiful', 'Beautifull', 'Butiful'),
  q('english', 'Which spelling is correct?', 'Wednesday', 'Wensday', 'Wedensday', 'Wednessday'),
  q('english', '"___ going to the park." Which word fits?', "They're", 'Their', 'There', 'Theyre'),
  q('english', 'Which punctuation mark ends a question?', 'Question mark (?)', 'Full stop (.)', 'Comma (,)', 'Exclamation mark (!)'),
  q('english', 'What is the contraction of "do not"?', "Don't", "Doesn't", "Didn't", "Won't"),
  q('english', 'The prefix "un-" (like unhappy) means…?', 'Not', 'Very', 'Again', 'Before'),
  q('english', 'The word "football" is an example of a…?', 'Compound word', 'Verb', 'Pronoun', 'Prefix'),
  // ---- GEOGRAPHY ----
  q('geography', 'What is the capital city of England?', 'London', 'Manchester', 'Birmingham', 'Liverpool'),
  q('geography', 'What is the capital city of Scotland?', 'Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'),
  q('geography', 'What is the capital city of Wales?', 'Cardiff', 'Swansea', 'Newport', 'Wrexham'),
  q('geography', 'What is the capital city of France?', 'Paris', 'Lyon', 'Nice', 'Marseille'),
  q('geography', 'What is the capital city of Spain?', 'Madrid', 'Barcelona', 'Seville', 'Valencia'),
  q('geography', 'What is the longest river in the UK?', 'River Severn', 'River Thames', 'River Trent', 'River Mersey'),
  q('geography', 'Which river flows through London?', 'The Thames', 'The Severn', 'The Tyne', 'The Avon'),
  q('geography', 'What is the highest mountain in the UK?', 'Ben Nevis', 'Snowdon', 'Scafell Pike', 'Helvellyn'),
  q('geography', 'How many continents are there?', '7', '5', '6', '8'),
  q('geography', 'What is the largest continent?', 'Asia', 'Africa', 'Europe', 'North America'),
  q('geography', 'What is the largest ocean?', 'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'),
  q('geography', 'Which continent is the coldest?', 'Antarctica', 'Europe', 'Asia', 'South America'),
  q('geography', 'How many countries make up the United Kingdom?', '4', '3', '5', '2'),
  q('geography', 'What is the UK flag called?', 'The Union Jack', 'The St George Cross', 'The Royal Flag', 'The Britannia'),
  q('geography', 'What is the largest hot desert in the world?', 'The Sahara', 'The Gobi', 'The Outback', 'The Kalahari'),
  q('geography', 'Kangaroos live in the wild in which country?', 'Australia', 'Brazil', 'India', 'South Africa'),
  q('geography', 'The Eiffel Tower is in which city?', 'Paris', 'London', 'Rome', 'New York'),
  q('geography', 'The Great Pyramids of Giza are in which country?', 'Egypt', 'Greece', 'Mexico', 'China'),
  // ---- HISTORY ----
  q('history', 'In which year was the Great Fire of London?', '1666', '1066', '1766', '1966'),
  q('history', 'Where did the Great Fire of London start?', 'A bakery in Pudding Lane', 'A castle', 'A church', 'A ship on the Thames'),
  q('history', 'The Romans came from which country?', 'Italy', 'Greece', 'Spain', 'Egypt'),
  q('history', 'What wall did the Romans build in northern England?', "Hadrian's Wall", 'The Great Wall', "Offa's Dyke", 'The London Wall'),
  q('history', 'The Vikings came from which lands?', 'Scandinavia', 'France', 'Italy', 'Spain'),
  q('history', 'What were Viking ships called?', 'Longships', 'Galleons', 'Canoes', 'Ferries'),
  q('history', 'Which Tudor king had six wives?', 'Henry VIII', 'Henry VII', 'Edward VI', 'Richard III'),
  q('history', 'Which famous Tudor queen was Henry VIII\'s daughter?', 'Elizabeth I', 'Victoria', 'Mary Queen of Scots', 'Anne'),
  q('history', 'The Ancient Egyptians built which famous structures?', 'Pyramids', 'Castles', 'Cathedrals', 'Lighthouses'),
  q('history', 'What was an Ancient Egyptian ruler called?', 'A pharaoh', 'A king', 'An emperor', 'A sultan'),
  q('history', 'What is Ancient Egyptian picture writing called?', 'Hieroglyphics', 'Calligraphy', 'Runes', 'Graffiti'),
  q('history', 'Which river was most important to Ancient Egypt?', 'The Nile', 'The Amazon', 'The Thames', 'The Tiber'),
  q('history', 'Who was the famous boy king of Egypt?', 'Tutankhamun', 'Julius Caesar', 'Alexander', 'Rameses'),
  q('history', 'Who was the first person to walk on the Moon?', 'Neil Armstrong', 'Buzz Lightyear', 'Yuri Gagarin', 'Tim Peake'),
  q('history', 'In WW2, children moved from cities to the countryside were called…?', 'Evacuees', 'Refugees', 'Pioneers', 'Scouts'),
  q('history', 'Which queen ruled Britain for most of the 1800s?', 'Queen Victoria', 'Queen Elizabeth II', 'Queen Anne', 'Queen Mary'),
  // ---- FUN FACTS ----
  q('fun', 'How many days are in a week?', '7', '5', '6', '8'),
  q('fun', 'How many colours are in a rainbow?', '7', '5', '6', '8'),
  q('fun', 'How many legs does a spider have?', '8', '6', '10', '4'),
  q('fun', 'How many legs does an insect have?', '6', '8', '4', '10'),
  q('fun', 'What is the biggest animal that has ever lived?', 'The blue whale', 'The elephant', 'The T-rex', 'The giraffe'),
  q('fun', 'What is the fastest land animal?', 'The cheetah', 'The lion', 'The horse', 'The greyhound'),
  q('fun', 'What is the tallest animal in the world?', 'The giraffe', 'The elephant', 'The ostrich', 'The camel'),
  q('fun', 'What do bees make?', 'Honey', 'Jam', 'Butter', 'Sugar'),
  q('fun', 'What is a baby dog called?', 'A puppy', 'A kitten', 'A cub', 'A foal'),
  q('fun', 'What is a baby sheep called?', 'A lamb', 'A calf', 'A kid', 'A piglet'),
  q('fun', 'What is a baby frog called?', 'A tadpole', 'A froglet', 'A minnow', 'A newt'),
  q('fun', 'How many players are on a football team (on the pitch)?', '11', '10', '12', '9'),
  q('fun', 'How many rings are on the Olympic flag?', '5', '4', '6', '7'),
  q('fun', 'What does a caterpillar turn into?', 'A butterfly', 'A bee', 'A dragonfly', 'A ladybird'),
  q('fun', 'Which bird cannot fly?', 'The penguin', 'The owl', 'The robin', 'The seagull'),
  q('fun', 'How many zeros are in one thousand?', '3', '2', '4', '5'),
];

export function pickQuestions(category: SchoolCategory | 'mix', count: number): PreparedQ[] {
  const pool = category === 'mix' ? SCHOOL_QUESTIONS : SCHOOL_QUESTIONS.filter((x) => x.category === category);
  return [...pool]
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((qu) => {
      const answers = [...qu.answers].sort(() => Math.random() - 0.5);
      return {
        text: qu.questionText,
        options: answers.map((a) => a.answerText),
        correct: answers.findIndex((a) => a.isCorrect),
      };
    });
}
