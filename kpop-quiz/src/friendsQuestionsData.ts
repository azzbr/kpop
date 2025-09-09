export interface FriendsQuestionTemplate {
  id: string;
  questionTemplate: string;
  answers: string[];
  correctAnswer: number;
  category: string;
}

export const friendsQuestionTemplates: FriendsQuestionTemplate[] = [
  // Original 12 questions
  {
    id: 'color',
    questionTemplate: "What's [Friend]'s favorite color?",
    answers: ['Red', 'Blue', 'Green', 'Yellow'],
    correctAnswer: 0,
    category: 'Favorites'
  },
  {
    id: 'animal',
    questionTemplate: "What animal would [Friend] want as a pet?",
    answers: ['Dog', 'Cat', 'Rabbit', 'Bird'],
    correctAnswer: 1,
    category: 'Favorites'
  },
  {
    id: 'subject',
    questionTemplate: "What's [Friend]'s favorite subject in school?",
    answers: ['Math', 'Reading', 'Art', 'PE'],
    correctAnswer: 2,
    category: 'Favorites'
  },
  {
    id: 'future',
    questionTemplate: "What would [Friend] want to be when they grow up?",
    answers: ['Doctor', 'Teacher', 'Astronaut', 'Artist'],
    correctAnswer: 3,
    category: 'Dreams'
  },
  {
    id: 'food',
    questionTemplate: "What's [Friend]'s favorite food?",
    answers: ['Pizza', 'Ice Cream', 'Chocolate', 'Pasta'],
    correctAnswer: 0,
    category: 'Favorites'
  },
  {
    id: 'sport',
    questionTemplate: "What's [Friend]'s favorite sport to play?",
    answers: ['Soccer', 'Basketball', 'Swimming', 'Tennis'],
    correctAnswer: 1,
    category: 'Favorites'
  },
  {
    id: 'season',
    questionTemplate: "What's [Friend]'s favorite season?",
    answers: ['Spring', 'Summer', 'Fall', 'Winter'],
    correctAnswer: 2,
    category: 'Favorites'
  },
  {
    id: 'hobby',
    questionTemplate: "What's [Friend]'s favorite hobby?",
    answers: ['Drawing', 'Reading', 'Dancing', 'Playing Games'],
    correctAnswer: 3,
    category: 'Personality'
  },
  {
    id: 'superpower',
    questionTemplate: "What superpower would [Friend] want?",
    answers: ['Fly', 'Invisible', 'Super Speed', 'Read Minds'],
    correctAnswer: 0,
    category: 'Dreams'
  },
  {
    id: 'vacation',
    questionTemplate: "Where would [Friend] want to go on vacation?",
    answers: ['Beach', 'Mountains', 'City', 'Space'],
    correctAnswer: 1,
    category: 'Dreams'
  },
  {
    id: 'music',
    questionTemplate: "What type of music does [Friend] like?",
    answers: ['Pop', 'Rock', 'Hip Hop', 'Classical'],
    correctAnswer: 2,
    category: 'Favorites'
  },
  {
    id: 'movie',
    questionTemplate: "What's [Friend]'s favorite movie type?",
    answers: ['Comedy', 'Action', 'Animated', 'Adventure'],
    correctAnswer: 3,
    category: 'Favorites'
  },

  // New Favorites questions
  {
    id: 'icecream',
    questionTemplate: "What's [Friend]'s favorite ice cream flavor?",
    answers: ['Vanilla', 'Chocolate', 'Strawberry', 'Mint'],
    correctAnswer: 1,
    category: 'Favorites'
  },
  {
    id: 'fruit',
    questionTemplate: "What's [Friend]'s favorite fruit?",
    answers: ['Apple', 'Banana', 'Orange', 'Grapes'],
    correctAnswer: 0,
    category: 'Favorites'
  },
  {
    id: 'drink',
    questionTemplate: "What's [Friend]'s favorite drink?",
    answers: ['Juice', 'Milk', 'Water', 'Soda'],
    correctAnswer: 3,
    category: 'Favorites'
  },
  {
    id: 'game',
    questionTemplate: "What's [Friend]'s favorite game to play?",
    answers: ['Tag', 'Hide and Seek', 'Simon Says', 'Freeze Dance'],
    correctAnswer: 2,
    category: 'Favorites'
  },
  {
    id: 'cartoon',
    questionTemplate: "What's [Friend]'s favorite cartoon?",
    answers: ['SpongeBob', 'Tom and Jerry', 'Scooby Doo', 'Mickey Mouse'],
    correctAnswer: 1,
    category: 'Favorites'
  },
  {
    id: 'pizza',
    questionTemplate: "What's [Friend]'s favorite pizza topping?",
    answers: ['Pepperoni', 'Cheese', 'Pineapple', 'Mushrooms'],
    correctAnswer: 0,
    category: 'Favorites'
  },
  {
    id: 'candy',
    questionTemplate: "What's [Friend]'s favorite candy?",
    answers: ['Chocolate Bar', 'Lollipop', 'Gummy Bears', 'Hard Candy'],
    correctAnswer: 2,
    category: 'Favorites'
  },
  {
    id: 'toy',
    questionTemplate: "What's [Friend]'s favorite type of toy?",
    answers: ['Action Figures', 'Dolls', 'Building Blocks', 'Stuffed Animals'],
    correctAnswer: 3,
    category: 'Favorites'
  },

  // New Personality questions
  {
    id: 'morning_night',
    questionTemplate: "Is [Friend] more of a morning person or night owl?",
    answers: ['Morning Person', 'Night Owl', 'Both', 'Neither'],
    correctAnswer: 1,
    category: 'Personality'
  },
  {
    id: 'shy_outgoing',
    questionTemplate: "Is [Friend] shy or outgoing?",
    answers: ['Very Shy', 'A Little Shy', 'Outgoing', 'Very Outgoing'],
    correctAnswer: 2,
    category: 'Personality'
  },
  {
    id: 'messy_neat',
    questionTemplate: "Is [Friend] messy or neat?",
    answers: ['Very Messy', 'A Little Messy', 'Neat', 'Very Neat'],
    correctAnswer: 1,
    category: 'Personality'
  },
  {
    id: 'funny_serious',
    questionTemplate: "Is [Friend] funny or serious?",
    answers: ['Very Funny', 'A Little Funny', 'Serious', 'Very Serious'],
    correctAnswer: 0,
    category: 'Personality'
  },
  {
    id: 'brave_careful',
    questionTemplate: "Is [Friend] brave or careful?",
    answers: ['Very Brave', 'A Little Brave', 'Careful', 'Very Careful'],
    correctAnswer: 1,
    category: 'Personality'
  },
  {
    id: 'loud_quiet',
    questionTemplate: "Is [Friend] loud or quiet?",
    answers: ['Very Loud', 'A Little Loud', 'Quiet', 'Very Quiet'],
    correctAnswer: 2,
    category: 'Personality'
  },

  // New Dreams questions
  {
    id: 'invent',
    questionTemplate: "What would [Friend] invent?",
    answers: ['Flying Car', 'Time Machine', 'Robot Helper', 'Magic Wand'],
    correctAnswer: 3,
    category: 'Dreams'
  },
  {
    id: 'country',
    questionTemplate: "What country would [Friend] visit?",
    answers: ['Japan', 'France', 'Australia', 'Egypt'],
    correctAnswer: 0,
    category: 'Dreams'
  },
  {
    id: 'lottery',
    questionTemplate: "What would [Friend] do if they won the lottery?",
    answers: ['Buy Toys', 'Help Family', 'Travel', 'Save It'],
    correctAnswer: 2,
    category: 'Dreams'
  },
  {
    id: 'change_world',
    questionTemplate: "What would [Friend] change about the world?",
    answers: ['More Parks', 'No Homework', 'Free Ice Cream', 'World Peace'],
    correctAnswer: 1,
    category: 'Dreams'
  },
  {
    id: 'magic_power',
    questionTemplate: "What magic power would [Friend] want?",
    answers: ['Teleport', 'Shape Shift', 'Talk to Animals', 'Control Weather'],
    correctAnswer: 2,
    category: 'Dreams'
  },

  // New School/Friends questions
  {
    id: 'recess',
    questionTemplate: "What's [Friend]'s favorite recess activity?",
    answers: ['Swinging', 'Slides', 'Tag', 'Jump Rope'],
    correctAnswer: 3,
    category: 'School'
  },
  {
    id: 'project',
    questionTemplate: "What would [Friend] do for a class project?",
    answers: ['Build Model', 'Write Story', 'Make Poster', 'Give Presentation'],
    correctAnswer: 1,
    category: 'School'
  },
  {
    id: 'lunch',
    questionTemplate: "What's [Friend]'s favorite school lunch?",
    answers: ['Sandwich', 'Pizza Day', 'Tacos', 'Pasta'],
    correctAnswer: 0,
    category: 'School'
  },
  {
    id: 'club',
    questionTemplate: "What club would [Friend] join?",
    answers: ['Art Club', 'Sports Club', 'Science Club', 'Drama Club'],
    correctAnswer: 1,
    category: 'School'
  },

  // New Fun questions
  {
    id: 'rainy_day',
    questionTemplate: "What would [Friend] do on a rainy day?",
    answers: ['Read Books', 'Watch TV', 'Play Inside', 'Draw Pictures'],
    correctAnswer: 2,
    category: 'Fun'
  },
  {
    id: 'joke',
    questionTemplate: "What's [Friend]'s favorite type of joke?",
    answers: ['Knock Knock', 'Riddles', 'Puns', 'Silly Faces'],
    correctAnswer: 3,
    category: 'Fun'
  },
  {
    id: 'animal_sound',
    questionTemplate: "What animal sound does [Friend] make best?",
    answers: ['Cow', 'Duck', 'Lion', 'Monkey'],
    correctAnswer: 1,
    category: 'Fun'
  },
  {
    id: 'bedtime_story',
    questionTemplate: "What's [Friend]'s favorite bedtime story?",
    answers: ['Cinderella', 'Little Red Riding Hood', 'The Three Little Pigs', 'Goldilocks'],
    correctAnswer: 0,
    category: 'Fun'
  },
  {
    id: 'dance_move',
    questionTemplate: "What's [Friend]'s best dance move?",
    answers: ['The Robot', 'The Moonwalk', 'The Sprinkler', 'The Floss'],
    correctAnswer: 2,
    category: 'Fun'
  },
  {
    id: 'superhero',
    questionTemplate: "What superhero would [Friend] be?",
    answers: ['Superman', 'Wonder Woman', 'Spider-Man', 'Batman'],
    correctAnswer: 3,
    category: 'Fun'
  }
];

export const generateQuestionsForFriends = (friends: string[]): any[] => {
  if (friends.length === 0) return [];

  const questions: any[] = [];

  // Generate 6-8 questions per friend for longer, more engaging games
  friends.forEach(friend => {
    const questionsPerFriend = Math.min(8, friendsQuestionTemplates.length);
    const shuffledTemplates = [...friendsQuestionTemplates].sort(() => Math.random() - 0.5);

    for (let i = 0; i < questionsPerFriend; i++) {
      const template = shuffledTemplates[i];
      questions.push({
        id: `${friend}_${template.id}`,
        question: template.questionTemplate.replace('[Friend]', friend),
        answers: template.answers,
        correctAnswer: template.correctAnswer,
        aboutFriend: friend,
        category: template.category
      });
    }
  });

  // Shuffle all questions
  return questions.sort(() => Math.random() - 0.5);
};
