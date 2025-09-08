export interface Question {
  questionText: string;
  answers: { answerText: string; isCorrect: boolean }[];
}

export interface HunterProfile {
  name: string;
  group: string;
  imageUrl: string;
  codename: string;
  specialAbility: string;
}

export const easyQuestions: Question[] = [
  {
    questionText: "What is the name of the K-Pop group the main characters are in?",
    answers: [
      { answerText: "HUNTR/X", isCorrect: true },
      { answerText: "Saja Boys", isCorrect: false },
      { answerText: "The Idols", isCorrect: false },
      { answerText: "Demon Slayers", isCorrect: false },
    ],
  },
  {
    questionText: "Which member is the leader and lead vocalist of HUNTR/X?",
    answers: [
      { answerText: "Rumi", isCorrect: true },
      { answerText: "Mira", isCorrect: false },
      { answerText: "Zoey", isCorrect: false },
      { answerText: "Celine", isCorrect: false },
    ],
  },
  {
    questionText: "What do the girls hunt when they are not performing on stage?",
    answers: [
      { answerText: "Demons", isCorrect: true },
      { answerText: "Ghosts", isCorrect: false },
      { answerText: "Vampires", isCorrect: false },
      { answerText: "Aliens", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of the rival boy band?",
    answers: [
      { answerText: "Saja Boys", isCorrect: true },
      { answerText: "The Phantoms", isCorrect: false },
      { answerText: "Shadow Crew", isCorrect: false },
      { answerText: "Dark Knights", isCorrect: false },
    ],
  },
  {
    questionText: "Which character is the main rapper and youngest member (maknae) of the group?",
    answers: [
      { answerText: "Zoey", isCorrect: true },
      { answerText: "Rumi", isCorrect: false },
      { answerText: "Mira", isCorrect: false },
      { answerText: "Jinu", isCorrect: false },
    ],
  },
  {
    questionText: "Who is the former demon hunter that acts as the group's guardian?",
    answers: [
      { answerText: "Celine", isCorrect: true },
      { answerText: "Bobby", isCorrect: false },
      { answerText: "Healer Han", isCorrect: false },
      { answerText: "Jinu", isCorrect: false },
    ],
  },
  {
    questionText: "What is the title of HUNTR/X's most popular song in the movie?",
    answers: [
      { answerText: "\"Golden\"", isCorrect: true },
      { answerText: "\"Takedown\"", isCorrect: false },
      { answerText: "\"Soda Pop\"", isCorrect: false },
      { answerText: "\"Free\"", isCorrect: false },
    ],
  },
  {
    questionText: "What does Jinu, the leader of the Saja Boys, always have with him?",
    answers: [
      { answerText: "A blue pet tiger", isCorrect: true },
      { answerText: "A magic necklace", isCorrect: false },
      { answerText: "A special microphone", isCorrect: false },
      { answerText: "A black cat", isCorrect: false },
    ],
  },
  {
    questionText: "What big event are the bands competing in?",
    answers: [
      { answerText: "The Idol Awards", isCorrect: true },
      { answerText: "The Music Gala", isCorrect: false },
      { answerText: "The K-Pop Championship", isCorrect: false },
      { answerText: "The Dance Off", isCorrect: false },
    ],
  },
  {
    questionText: "Who is the quirky manager of HUNTR/X?",
    answers: [
      { answerText: "Bobby", isCorrect: true },
      { answerText: "Jinu", isCorrect: false },
      { answerText: "Celine", isCorrect: false },
      { answerText: "Gwi-Ma", isCorrect: false },
    ],
  },
  {
    questionText: "What city serves as the main setting for the movie?",
    answers: [
        { answerText: "Seoul", isCorrect: true },
        { answerText: "Busan", isCorrect: false },
        { answerText: "Incheon", isCorrect: false },
        { answerText: "Daegu", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of HUNTR/X's loyal fanbase?",
    answers: [
        { answerText: "The Hunties", isCorrect: true },
        { answerText: "The Slayers", isCorrect: false },
        { answerText: "The X-Crew", isCorrect: false },
        { answerText: "The Goldens", isCorrect: false },
    ],
  },
  {
    questionText: "What color are the eyes of the demons the girls fight?",
    answers: [
        { answerText: "Red", isCorrect: true },
        { answerText: "Yellow", isCorrect: false },
        { answerText: "Green", isCorrect: false },
        { answerText: "Purple", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of the company that manages HUNTR/X?",
    answers: [
        { answerText: "Idol Entertainment", isCorrect: true },
        { answerText: "K-Pop Nation", isCorrect: false },
        { answerText: "Star Power Agency", isCorrect: false },
        { answerText: "Music Masters", isCorrect: false },
    ],
  },
  {
    questionText: "What snack is Zoey frequently seen enjoying?",
    answers: [
        { answerText: "Gummy bears", isCorrect: true },
        { answerText: "Potato chips", isCorrect: false },
        { answerText: "Chocolate bars", isCorrect: false },
        { answerText: "Popcorn", isCorrect: false },
    ],
  },
  {
    questionText: "What is the symbol that represents the demon hunters?",
    answers: [
        { answerText: "A stylized 'H'", isCorrect: true },
        { answerText: "A crescent moon", isCorrect: false },
        { answerText: "A roaring tiger", isCorrect: false },
        { answerText: "A broken sword", isCorrect: false },
    ],
  },
  {
    questionText: "What happens to a demon's physical form after it is vanquished?",
    answers: [
        { answerText: "It dissolves into dust", isCorrect: true },
        { answerText: "It freezes into ice", isCorrect: false },
        { answerText: "It bursts into flames", isCorrect: false },
        { answerText: "It fades into shadows", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of the training facility where the girls hone their skills?",
    answers: [
        { answerText: "The Dojo", isCorrect: true },
        { answerText: "The Vault", isCorrect: false },
        { answerText: "The Grid", isCorrect: false },
        { answerText: "The Chamber", isCorrect: false },
    ],
  },
  {
    questionText: "Who is the demanding but talented choreographer for HUNTR/X?",
    answers: [
        { answerText: "Ms. Ahn", isCorrect: true },
        { answerText: "Mr. Lee", isCorrect: false },
        { answerText: "Mr. Park", isCorrect: false },
        { answerText: "Ms. Kim", isCorrect: false },
    ],
  },
  {
    questionText: "What is the title of the Saja Boys' hit song that puts people in a trance?",
    answers: [
        { answerText: "\"Hypnotic\"", isCorrect: true },
        { answerText: "\"Siren\"", isCorrect: false },
        { answerText: "\"Control\"", isCorrect: false },
        { answerText: "\"Oblivion\"", isCorrect: false },
    ],
  },
  {
    questionText: "What is the primary source of the demon hunters' enhanced abilities?",
    answers: [
        { answerText: "Their microphones", isCorrect: true },
        { answerText: "Ancient amulets", isCorrect: false },
        { answerText: "Magical tattoos", isCorrect: false },
        { answerText: "Specialized training", isCorrect: false },
    ],
  },
  {
    questionText: "What is Mira's signature dance move called?",
    answers: [
        { answerText: "The Phoenix", isCorrect: true },
        { answerText: "The Dragon", isCorrect: false },
        { answerText: "The Serpent", isCorrect: false },
        { answerText: "The Tiger", isCorrect: false },
    ],
  },
  {
    questionText: "What is Zoey's optimistic catchphrase?",
    answers: [
        { answerText: "\"Let's get it!\"", isCorrect: true },
        { answerText: "\"Time to shine!\"", isCorrect: false },
        { answerText: "\"No problem!\"", isCorrect: false },
        { answerText: "\"Easy peasy!\"", isCorrect: false },
    ],
  },
  {
    questionText: "What is Rumi's favorite color, often seen in her outfits?",
    answers: [
        { answerText: "Lavender", isCorrect: true },
        { answerText: "Rose gold", isCorrect: false },
        { answerText: "Sky blue", isCorrect: false },
        { answerText: "Mint green", isCorrect: false },
    ],
  },
  {
    questionText: "Where does the climactic final battle against Gwi-Ma take place?",
    answers: [
        { answerText: "The Idol Awards stage", isCorrect: true },
        { answerText: "A deserted subway station", isCorrect: false },
        { answerText: "The rooftop of a skyscraper", isCorrect: false },
        { answerText: "An ancient temple", isCorrect: false },
    ],
  },
  {
    questionText: "What type of business does Healer Han run as a cover?",
    answers: [
        { answerText: "An acupuncture clinic", isCorrect: true },
        { answerText: "A tea shop", isCorrect: false },
        { answerText: "An antique store", isCorrect: false },
        { answerText: "A bookstore", isCorrect: false },
    ],
  },
  {
    questionText: "What must the girls do to activate their hunter weapons?",
    answers: [
        { answerText: "Sing a specific note", isCorrect: true },
        { answerText: "Perform a dance move", isCorrect: false },
        { answerText: "Say a magic word", isCorrect: false },
        { answerText: "Strike a pose", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of the entertainment news show that follows the bands?",
    answers: [
        { answerText: "K-Pop Confidential", isCorrect: true },
        { answerText: "Idol Insider", isCorrect: false },
        { answerText: "Music Mania", isCorrect: false },
        { answerText: "Seoul Spotlight", isCorrect: false },
    ],
  },
  {
    questionText: "What does Bobby give the girls for good luck before their performances?",
    answers: [
        { answerText: "Matching bracelets", isCorrect: true },
        { answerText: "Special water bottles", isCorrect: false },
        { answerText: "Customized jackets", isCorrect: false },
        { answerText: "Lucky socks", isCorrect: false },
    ],
  },
  {
    questionText: "How do HUNTR/X make their grand entrance at the Idol Awards?",
    answers: [
        { answerText: "They descend from the ceiling", isCorrect: true },
        { answerText: "They rise up from the stage", isCorrect: false },
        { answerText: "They ride in on motorcycles", isCorrect: false },
        { answerText: "They appear in a cloud of smoke", isCorrect: false },
    ],
  },
];

export const normalQuestions: Question[] = [
  {
    questionText: "What is the secret about Rumi's family that only Celine knows at the beginning?",
    answers: [
      { answerText: "She is part demon", isCorrect: true },
      { answerText: "She is secretly a princess", isCorrect: false },
      { answerText: "Her parents were famous hunters", isCorrect: false },
      { answerText: "She can't sing", isCorrect: false },
    ],
  },
  {
    questionText: "What kind of weapon does Mira, the main dancer, use in combat?",
    answers: [
      { answerText: "A polearm", isCorrect: true },
      { answerText: "A sword", isCorrect: false },
      { answerText: "Throwing knives", isCorrect: false },
      { answerText: "A bow and arrow", isCorrect: false },
    ],
  },
  {
    questionText: "The Saja Boys' final performance is designed to do what?",
    answers: [
      { answerText: "Unleash the demon king", isCorrect: true },
      { answerText: "Win the Idol Awards", isCorrect: false },
      { answerText: "Steal HUNTR/X's fans", isCorrect: false },
      { answerText: "Create a new song", isCorrect: false },
    ],
  },
  {
    questionText: "What is Zoey's weapon of choice?",
    answers: [
      { answerText: "Throwing knives", isCorrect: true },
      { answerText: "A magical microphone", isCorrect: false },
      { answerText: "A battle axe", isCorrect: false },
      { answerText: "A whip", isCorrect: false },
    ],
  },
  {
    questionText: "Who is Jinu?",
    answers: [
      { answerText: "The leader of the Saja Boys", isCorrect: true },
      { answerText: "A fan of HUNTR/X", isCorrect: false },
      { answerText: "The girls' dance coach", isCorrect: false },
      { answerText: "A TV show host", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of the powerful demon king?",
    answers: [
      { answerText: "Gwi-Ma", isCorrect: true },
      { answerText: "Saja", isCorrect: false },
      { answerText: "Honmoon", isCorrect: false },
      { answerText: "Jinu", isCorrect: false },
    ],
  },
  {
    questionText: "What physical change appears on Rumi when her demon powers are revealed?",
    answers: [
      { answerText: "Demon marks", isCorrect: true },
      { answerText: "Her eyes glow red", isCorrect: false },
      { answerText: "She grows wings", isCorrect: false },
      { answerText: "Her hair turns white", isCorrect: false },
    ],
  },
  {
    questionText: "What is Mira's family background?",
    answers: [
      { answerText: "She comes from a wealthy family", isCorrect: true },
      { answerText: "She grew up in an orphanage", isCorrect: false },
      { answerText: "Her parents are farmers", isCorrect: false },
      { answerText: "She was a street performer", isCorrect: false },
    ],
  },
  {
    questionText: "What effect do the Saja Boys' songs have on their audience?",
    answers: [
      { answerText: "It puts them in a trance", isCorrect: true },
      { answerText: "It makes them happy", isCorrect: false },
      { answerText: "It makes them sleepy", isCorrect: false },
      { answerText: "It gives them superpowers", isCorrect: false },
    ],
  },
  {
    questionText: "Who is the eccentric doctor that Rumi visits for her voice?",
    answers: [
      { answerText: "Healer Han", isCorrect: true },
      { answerText: "Dr. Kim", isCorrect: false },
      { answerText: "Dr. Park", isCorrect: false },
      { answerText: "Dr. Lee", isCorrect: false },
    ],
  },
  {
    questionText: "What is the specific type of demon the Saja Boys are revealed to be?",
    answers: [
        { answerText: "Jeoseung Saja (Grim Reapers)", isCorrect: true },
        { answerText: "Dokkaebi (Goblins)", isCorrect: false },
        { answerText: "Gumiho (Nine-tailed Foxes)", isCorrect: false },
        { answerText: "Imugi (Lesser Dragons)", isCorrect: false },
    ],
  },
  {
    questionText: "What past trauma connects Celine to the demon king, Gwi-Ma?",
    answers: [
        { answerText: "Gwi-Ma killed her former hunter partner", isCorrect: true },
        { answerText: "She was once possessed by Gwi-Ma", isCorrect: false },
        { answerText: "Gwi-Ma destroyed her ancestral home", isCorrect: false },
        { answerText: "She failed to seal Gwi-Ma in the past", isCorrect: false },
    ],
  },
  {
    questionText: "Why did Mira's wealthy family disapprove of her dream to become a K-Pop idol?",
    answers: [
        { answerText: "They viewed it as an undignified profession", isCorrect: true },
        { answerText: "They wanted her to be a classical musician", isCorrect: false },
        { answerText: "They were afraid for her safety", isCorrect: false },
        { answerText: "They had already arranged her marriage", isCorrect: false },
    ],
  },
  {
    questionText: "How did Zoey first discover her demon-hunting abilities?",
    answers: [
        { answerText: "She instinctively saved a civilian from a demon attack", isCorrect: true },
        { answerText: "Celine recruited her after seeing her potential", isCorrect: false },
        { answerText: "She had a vision of herself fighting demons", isCorrect: false },
        { answerText: "Her powers manifested during a dance practice", isCorrect: false },
    ],
  },
  {
    questionText: "What is the significance of the blue spirit tiger that accompanies Jinu?",
    answers: [
        { answerText: "It is a manifestation of his demonic power", isCorrect: true },
        { answerText: "It is the ghost of his deceased pet", isCorrect: false },
        { answerText: "It is a guardian spirit bound to his family", isCorrect: false },
        { answerText: "It is an illusion created to intimidate rivals", isCorrect: false },
    ],
  },
  {
    questionText: "What does the full prophecy regarding Gwi-Ma's return state?",
    answers: [
        { answerText: "That one with both human and demon blood will be the key", isCorrect: true },
        { answerText: "That he can only be summoned during a solar eclipse", isCorrect: false },
        { answerText: "That the Honmoon barrier will weaken on a specific day", isCorrect: false },
        { answerText: "That a great sacrifice is needed to unleash him", isCorrect: false },
    ],
  },
  {
    questionText: "Besides losing her voice, what is another side effect Rumi experiences as her demon powers grow?",
    answers: [
        { answerText: "She gains superhuman strength", isCorrect: true },
        { answerText: "She can hear people's thoughts", isCorrect: false },
        { answerText: "She can turn invisible", isCorrect: false },
        { answerText: "She develops an aversion to sunlight", isCorrect: false },
    ],
  },
  {
    questionText: "How does Healer Han possess such deep knowledge of the demon world?",
    answers: [
        { answerText: "He is from a long line of demon-hunting scholars", isCorrect: true },
        { answerText: "He is a retired demon hunter himself", isCorrect: false },
        { answerText: "He made a deal with a demon for information", isCorrect: false },
        { answerText: "He is secretly a half-demon", isCorrect: false },
    ],
  },
  {
    questionText: "What is the true, sinister purpose of the Idol Awards event?",
    answers: [
        { answerText: "To gather enough human energy to break the Honmoon", isCorrect: true },
        { answerText: "To publicly shame and discredit HUNTR/X", isCorrect: false },
        { answerText: "To identify new potential demon hunters", isCorrect: false },
        { answerText: "To crown the new demon king", isCorrect: false },
    ],
  },
  {
    questionText: "What ultimate sacrifice did Rumi's mother make to protect her daughter?",
    answers: [
        { answerText: "She sealed her own demon half away, weakening herself", isCorrect: true },
        { answerText: "She gave up her singing voice permanently", isCorrect: false },
        { answerText: "She erased Rumi's memories of her", isCorrect: false },
        { answerText: "She trapped herself in the demon realm", isCorrect: false },
    ],
  },
  {
    questionText: "What technology do the demon hunters use to track their targets?",
    answers: [
        { answerText: "A phone app that detects demonic energy", isCorrect: true },
        { answerText: "Enchanted compasses that point to evil", isCorrect: false },
        { answerText: "A network of hidden cameras across the city", isCorrect: false },
        { answerText: "Trained animals that can sniff out demons", isCorrect: false },
    ],
  },
  {
    questionText: "What is the primary weakness of the Jeoseung Saja demons?",
    answers: [
        { answerText: "Pure, high-frequency sound", isCorrect: true },
        { answerText: "Sunlight", isCorrect: false },
        { answerText: "Cold iron", isCorrect: false },
        { answerText: "Running water", isCorrect: false },
    ],
  },
  {
    questionText: "What is the backstory of Rumi's saingeom sword?",
    answers: [
        { answerText: "It was passed down from her mother", isCorrect: true },
        { answerText: "Celine forged it especially for her", isCorrect: false },
        { answerText: "She found it in an ancient temple", isCorrect: false },
        { answerText: "It was a gift from Healer Han", isCorrect: false },
    ],
  },
  {
    questionText: "How did Bobby end up becoming the manager of a K-Pop demon hunter group?",
    answers: [
        { answerText: "He was a former roadie who discovered their secret", isCorrect: true },
        { answerText: "He was assigned by the entertainment company", isCorrect: false },
        { answerText: "He is Celine's estranged younger brother", isCorrect: false },
        { answerText: "He answered a mysterious online job posting", isCorrect: false },
    ],
  },
  {
    questionText: "What is the origin of the Honmoon barrier that protects the human world?",
    answers: [
        { answerText: "It was created by a circle of ancient shamans", isCorrect: true },
        { answerText: "It is a natural phenomenon", isCorrect: false },
        { answerText: "It was a gift from a benevolent deity", isCorrect: false },
        { answerText: "It is a piece of advanced alien technology", isCorrect: false },
    ],
  },
  {
    questionText: "What is Jinu's personal motivation for wanting to unleash Gwi-Ma?",
    answers: [
        { answerText: "He believes demons should rule the world", isCorrect: true },
        { answerText: "He wants to avenge his family's honor", isCorrect: false },
        { answerText: "He was promised ultimate power by Gwi-Ma", isCorrect: false },
        { answerText: "He seeks to merge the human and demon realms", isCorrect: false },
    ],
  },
  {
    questionText: "What is the relationship between the Saja Boys and their human CEO?",
    answers: [
        { answerText: "The CEO is their willing servant", isCorrect: true },
        { answerText: "They are holding him hostage", isCorrect: false },
        { answerText: "He is unaware of their true nature", isCorrect: false },
        { answerText: "He is a powerful warlock who controls them", isCorrect: false },
    ],
  },
  {
    questionText: "How do the girls upgrade their weapons for the final battle?",
    answers: [
        { answerText: "By combining them with a powerful energy crystal", isCorrect: true },
        { answerText: "Through a ritual guided by Healer Han", isCorrect: false },
        { answerText: "By unlocking their own latent potential", isCorrect: false },
        { answerText: "By finding ancient blueprints and forging new ones", isCorrect: false },
    ],
  },
  {
    questionText: "What do the lyrics of HUNTR/X's song \"Golden\" secretly reference?",
    answers: [
        { answerText: "The hidden strength and light within a person", isCorrect: true },
        { answerText: "A legendary demon-slaying weapon", isCorrect: false },
        { answerText: "The prophecy of the demon king's return", isCorrect: false },
        { answerText: "A coded message to other demon hunters", isCorrect: false },
    ],
  },
  {
    questionText: "What personal item of her mother's does Rumi keep for good luck?",
    answers: [
        { answerText: "A jade pendant", isCorrect: true },
        { answerText: "A silver locket", isCorrect: false },
        { answerText: "A worn-out lyric book", isCorrect: false },
        { answerText: "A pair of diamond earrings", isCorrect: false },
    ],
  },
];

export const hardQuestions: Question[] = [
  {
    questionText: "What is the name of the magical barrier that separates the human and demon worlds?",
    answers: [
      { answerText: "The Honmoon", isCorrect: true },
      { answerText: "The Veil", isCorrect: false },
      { answerText: "The Gateway", isCorrect: false },
      { answerText: "The Shield", isCorrect: false },
    ],
  },
  {
    questionText: "Who raised Rumi after her mother, a former hunter and idol, passed away?",
    answers: [
      { answerText: "Celine", isCorrect: true },
      { answerText: "Healer Han", isCorrect: false },
      { answerText: "Her father", isCorrect: false },
      { answerText: "Bobby", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of the song HUNTR/X creates to try and expose the Saja Boys?",
    answers: [
      { answerText: "\"Takedown\"", isCorrect: true },
      { answerText: "\"Golden\"", isCorrect: false },
      { answerText: "\"Soda Pop\"", isCorrect: false },
      { answerText: "\"Your Idol\"", isCorrect: false },
    ],
  },
  {
    questionText: "What happens to Rumi that makes her start losing her voice?",
    answers: [
      { answerText: "Her demon heritage is surfacing", isCorrect: true },
      { answerText: "She is getting sick", isCorrect: false },
      { answerText: "She is practicing too much", isCorrect: false },
      { answerText: "A demon cursed her", isCorrect: false },
    ],
  },
  {
    questionText: "What nationality is Zoey?",
    answers: [
      { answerText: "Korean American", isCorrect: true },
      { answerText: "Korean Canadian", isCorrect: false },
      { answerText: "Korean Australian", isCorrect: false },
      { answerText: "Korean British", isCorrect: false },
    ],
  },
  {
    questionText: "Rumi's mother was both a K-Pop idol and a what?",
    answers: [
      { answerText: "A demon hunter", isCorrect: true },
      { answerText: "A doctor", isCorrect: false },
      { answerText: "A movie star", isCorrect: false },
      { answerText: "A fashion designer", isCorrect: false },
    ],
  },
  {
    questionText: "What does Gwi-Ma, the demon king, look like?",
    answers: [
      { answerText: "A giant mouth of fire", isCorrect: true },
      { answerText: "A handsome boy band member", isCorrect: false },
      { answerText: "A shadow monster", isCorrect: false },
      { answerText: "A giant wolf", isCorrect: false },
    ],
  },
  {
    questionText: "What special item does Rumi use in combat?",
    answers: [
      { answerText: "A saingeom sword", isCorrect: true },
      { answerText: "A gokdo polearm", isCorrect: false },
      { answerText: "Shinkal throwing knives", isCorrect: false },
      { answerText: "A magical pendant", isCorrect: false },
    ],
  },
  {
    questionText: "The Saja Boys are secretly what?",
    answers: [
      { answerText: "Demons", isCorrect: true },
      { answerText: "Angels", isCorrect: false },
      { answerText: "Robots", isCorrect: false },
      { answerText: "Aliens", isCorrect: false },
    ],
  },
  {
    questionText: "How do impostor demons trick Rumi at the Idol Awards?",
    answers: [
      { answerText: "They pretend to be Mira and Zoey", isCorrect: true },
      { answerText: "They pretend to be her fans", isCorrect: false },
      { answerText: "They offer her a magic cure", isCorrect: false },
      { answerText: "They disguise as judges", isCorrect: false },
    ],
  },
  {
    questionText: "Who provides the singing voice for Rumi in the movie's soundtrack?",
    answers: [
      { answerText: "Ejae", isCorrect: true },
      { answerText: "Arden Cho", isCorrect: false },
      { answerText: "Lea Salonga", isCorrect: false },
      { answerText: "Audrey Nuna", isCorrect: false },
    ],
  },
  {
    questionText: "Mira was considered the 'black sheep' of her family because of her what?",
    answers: [
      { answerText: "Rebellious nature", isCorrect: true },
      { answerText: "Desire to be an idol", isCorrect: false },
      { answerText: "Secret life as a hunter", isCorrect: false },
      { answerText: "Lack of musical talent", isCorrect: false },
    ],
  },
  {
    questionText: "After her secret is revealed, what desperate request does Rumi make to Celine?",
    answers: [
      { answerText: "To end her life", isCorrect: true },
      { answerText: "To run away with her", isCorrect: false },
      { answerText: "To erase her memory", isCorrect: false },
      { answerText: "To fight Jinu for her", isCorrect: false },
    ],
  },
  {
    questionText: "What is the Korean mythological term for the demons that the girls hunt?",
    answers: [
      { answerText: "Jeoseung Saja", isCorrect: true },
      { answerText: "Gumiho", isCorrect: false },
      { answerText: "Dokkaebi", isCorrect: false },
      { answerText: "Gwisin", isCorrect: false },
    ],
  },
  {
    questionText: "Which animation studio produced K-Pop: Demon Hunters for Netflix?",
    answers: [
      { answerText: "Sony Pictures Animation", isCorrect: true },
      { answerText: "Pixar", isCorrect: false },
      { answerText: "DreamWorks Animation", isCorrect: false },
      { answerText: "Studio Ghibli", isCorrect: false },
    ],
  },
  {
    questionText: "What is the specific incantation, spoken in Korean, used to seal Gwi-Ma?",
    answers: [
        { answerText: "\"Bong-in\"", isCorrect: true },
        { answerText: "\"So-myeol\"", isCorrect: false },
        { answerText: "\"Jeong-hwa\"", isCorrect: false },
        { answerText: "\"Gyeol-bak\"", isCorrect: false },
    ],
  },
  {
    questionText: "What was the name of the ancient order of demon hunters that Celine once belonged to?",
    answers: [
        { answerText: "The Hwarang", isCorrect: true },
        { answerText: "The Chasa", isCorrect: false },
        { answerText: "The Geom-gwi", isCorrect: false },
        { answerText: "The Susaek", isCorrect: false },
    ],
  },
  {
    questionText: "Who was the original creator of the Honmoon barrier centuries ago?",
    answers: [
        { answerText: "A legendary shaman queen", isCorrect: true },
        { answerText: "A council of mountain gods", isCorrect: false },
        { answerText: "A benevolent dragon", isCorrect: false },
        { answerText: "The first demon hunter", isCorrect: false },
    ],
  },
  {
    questionText: "What is the full corporate name of the entertainment company that manages HUNTR/X?",
    answers: [
        { answerText: "Idol Entertainment Global", isCorrect: true },
        { answerText: "Star-Making Factory Inc.", isCorrect: false },
        { answerText: "K-DreamWorks Entertainment", isCorrect: false },
        { answerText: "Seoul Pop Music Group", isCorrect: false },
    ],
  },
  {
    questionText: "What is the real-world brand of the high-tech throwing knives that Zoey uses?",
    answers: [
        { answerText: "They are a fictional design for the movie", isCorrect: true },
        { answerText: "SOG Knives", isCorrect: false },
        { answerText: "Gerber Gear", isCorrect: false },
        { answerText: "Cold Steel", isCorrect: false },
    ],
  },
  {
    questionText: "What traditional Korean instrument is prominently featured in the instrumental of \"Takedown\"?",
    answers: [
        { answerText: "A gayageum", isCorrect: true },
        { answerText: "A daegeum", isCorrect: false },
        { answerText: "A haegeum", isCorrect: false },
        { answerText: "A geomungo", isCorrect: false },
    ],
  },
  {
    questionText: "What hidden meaning is implied by the name \"Saja Boys\"?",
    answers: [
        { answerText: "\"Saja\" can mean \"lion,\" but also \"messenger from the dead\"", isCorrect: true },
        { answerText: "It is an acronym for \"Supreme Alliance of Jade Angels\"", isCorrect: false },
        { answerText: "It is the name of the ancient demon they worship", isCorrect: false },
        { answerText: "It translates to \"The Boys Who Steal Voices\"", isCorrect: false },
    ],
  },
  {
    questionText: "Who was the celebrity director hired to direct HUNTR/X's \"Golden\" music video?",
    answers: [
        { answerText: "Director X", isCorrect: true },
        { answerText: "Joseph Kahn", isCorrect: false },
        { answerText: "Hannah Lux Davis", isCorrect: false },
        { answerText: "Dave Meyers", isCorrect: false },
    ],
  },
  {
    questionText: "Which real-life K-Pop group's intricate choreography was a major inspiration for HUNTR/X's dance style?",
    answers: [
        { answerText: "BLACKPINK", isCorrect: true },
        { answerText: "TWICE", isCorrect: false },
        { answerText: "Red Velvet", isCorrect: false },
        { answerText: "ITZY", isCorrect: false },
    ],
  },
  {
    questionText: "What is the symbolic meaning of the spider lilies that appear in visions of Gwi-Ma's return?",
    answers: [
        { answerText: "Death and the final goodbye", isCorrect: true },
        { answerText: "Eternal love and passion", isCorrect: false },
        { answerText: "Betrayal and deceit", isCorrect: false },
        { answerText: "Rebirth and resurrection", isCorrect: false },
    ],
  },
  {
    questionText: "What does the ancient text inscribed on Rumi's saingeom sword translate to?",
    answers: [
        { answerText: "\"The light that pierces darkness\"", isCorrect: true },
        { answerText: "\"Born of two worlds, guardian of one\"", isCorrect: false },
        { answerText: "\"Sing the song of salvation\"", isCorrect: false },
        { answerText: "\"The blade that tames the beast\"", isCorrect: false },
    ],
  },
  {
    questionText: "What is the title of the prequel webcomic released before the movie?",
    answers: [
        { answerText: "K-Pop: Demon Hunters - Trainee Days", isCorrect: true },
        { answerText: "HUNTR/X: The Beginning", isCorrect: false },
        { answerText: "The Legend of the Saingeom", isCorrect: false },
        { answerText: "Seoul Under Siege", isCorrect: false },
    ],
  },
  {
    questionText: "Mira's polearm fighting style is based on which Chinese martial art?",
    answers: [
        { answerText: "Wushu", isCorrect: true },
        { answerText: "Kung Fu", isCorrect: false },
        { answerText: "Wing Chun", isCorrect: false },
        { answerText: "Tai Chi", isCorrect: false },
    ],
  },
  {
    questionText: "The design of Gwi-Ma's fiery form was inspired by the mythological creature known as what?",
    answers: [
        { answerText: "Bulgasari", isCorrect: true },
        { answerText: "Haetae", isCorrect: false },
        { answerText: "Samjoko", isCorrect: false },
        { answerText: "Girin", isCorrect: false },
    ],
  },
  {
    questionText: "What is the name of the fictional social media platform the idols use to interact with fans?",
    answers: [
        { answerText: "IdolVerse", isCorrect: true },
        { answerText: "K-Nect", isCorrect: false },
        { answerText: "FanLink", isCorrect: false },
        { answerText: "StarChat", isCorrect: false },
    ],
  },
];

export const hunterProfiles: HunterProfile[] = [
  {
    name: "Rumi",
    group: "HUNTR/X",
    imageUrl: "/5of5.jpg",
    codename: "Crimson Blade",
    specialAbility: "Wields a saingeom sword with incredible speed and power.",
  },
  {
    name: "Mira",
    group: "HUNTR/X",
    imageUrl: "/1to4.jpg",
    codename: "Whirlwind Dancer",
    specialAbility: "Master of the gokdo polearm, combining dance with deadly strikes.",
  },
  {
    name: "Zoey",
    group: "HUNTR/X",
    imageUrl: "/allwrong.webp",
    codename: "Phantom Knife",
    specialAbility: "Unleashes a barrage of shinkal throwing knives with pinpoint accuracy.",
  },
];

// Helper function to shuffle answers within a question
const shuffleAnswers = (question: Question): Question => {
  const shuffledAnswers = [...question.answers].sort(() => 0.5 - Math.random());
  return {
    ...question,
    answers: shuffledAnswers
  };
};

// Helper function to get random questions from an array
const getRandomQuestions = (questions: Question[], count: number): Question[] => {
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, count);
  // Shuffle answers for each selected question
  return selectedQuestions.map(shuffleAnswers);
};

export const getQuestionsByDifficulty = (difficulty: 'easy' | 'normal' | 'hard'): Question[] => {
  switch (difficulty) {
    case 'easy':
      return getRandomQuestions(easyQuestions, 5);
    case 'normal':
      return getRandomQuestions(normalQuestions, 7);
    case 'hard':
      return hardQuestions.map(shuffleAnswers); // Shuffle answers for all hard questions
    default:
      return getRandomQuestions(easyQuestions, 5);
  }
};

export const getProfileByScore = (score: number, totalQuestions: number): HunterProfile => {
  if (score === totalQuestions) {
    // All correct - return Rumi with 5of5.jpg
    return hunterProfiles[0];
  } else if (score >= 1) {
    // At least 1 correct - return Mira with 1to4.jpg
    return hunterProfiles[1];
  } else {
    // All wrong - return Zoey with allwrong.webp
    return hunterProfiles[2];
  }
};

// Keep the old function for backward compatibility if needed
export const getRandomHunterProfile = (): HunterProfile => {
  const randomIndex = Math.floor(Math.random() * hunterProfiles.length);
  return hunterProfiles[randomIndex];
};
