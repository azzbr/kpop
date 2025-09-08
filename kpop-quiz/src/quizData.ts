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
