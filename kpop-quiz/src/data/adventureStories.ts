// "Adventure Diary" (screen id idol_diary): choose-your-path stories.
// Each story is a small graph: every node is either a step (2–3 choices) or an ending.
// Every path from `start` reaches an ending in 3–5 choices (tested in adventureStories.test.ts).

export interface StoryChoice { emoji: string; label: string; to: string }
export interface StoryEnding { emoji: string; title: string; kind: 'happy' | 'funny' }
export interface StoryNode { text: string; choices?: StoryChoice[]; end?: StoryEnding }
export interface AdventureStory {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  start: string;
  nodes: Record<string, StoryNode>;
}

const c = (emoji: string, label: string, to: string): StoryChoice => ({ emoji, label, to });
const step = (text: string, ...choices: StoryChoice[]): StoryNode => ({ text, choices });
const end = (emoji: string, title: string, kind: StoryEnding['kind'], text: string): StoryNode => ({ text, end: { emoji, title, kind } });

export const ADVENTURE_STORIES: AdventureStory[] = [
  {
    id: 'space', title: 'Space Station Surprise', emoji: '🚀',
    blurb: 'A funny signal is coming from outside the station…',
    start: 'start',
    nodes: {
      start: step('You wake up on Star Station Nova. Your robot helper beeps: “Good morning! A funny signal is coming from outside!”',
        c('🔭', 'Look through the telescope', 'scope'), c('🧑‍🚀', 'Float outside in a space suit', 'walk')),
      scope: step('Through the telescope you spot a tiny green comet zooming in circles. It looks like it is waving its tail at you!',
        c('💡', 'Flash the station lights', 'lights'), c('📡', 'Send a hello message', 'message')),
      walk: step('You float outside. Stars twinkle all around you. A shiny box drifts past and bonks gently on your helmet.',
        c('📦', 'Catch the shiny box', 'box'), c('🛰️', 'Follow it to the old satellite', 'satellite')),
      lights: step('Blink, blink, blink! The comet zooms closer and does a loop-the-loop. It wants to play!',
        c('🏃', 'Play comet tag', 'end_tag'), c('🎵', 'Play it some music', 'music')),
      message: step('A reply pops up on the screen: “BEEP BOOP. I AM A LOST COMET. WHERE IS MY COMET FAMILY?”',
        c('🗺️', 'Check the star map', 'map'), c('🎵', 'Play calm music while you think', 'music')),
      box: step('The box has a label that says DO NOT TICKLE. You tickle it just a tiny bit. The box starts to giggle!',
        c('🔓', 'Open it very carefully', 'end_giggle'), c('🏠', 'Take it inside to show the robot', 'robot')),
      satellite: step('The old satellite is covered in space dust. Its screen flickers on and shows a map with a big glowing X.',
        c('🗺️', 'Follow the map', 'map'), c('🧽', 'Polish the satellite', 'end_shiny')),
      music: step('You play your favourite song. The comet wiggles to the beat, and its tail sparkles in every colour of the rainbow!',
        c('🕺', 'Dance along', 'end_disco'), c('🎤', 'Teach the comet to sing', 'end_choir')),
      map: step('The map shows a cosy cloud of comets near the Moon. “That’s my family!” the comet beeps happily.',
        c('🚀', 'Lead the comet home', 'end_home'), c('🎉', 'Throw a goodbye party first', 'end_party')),
      robot: step('The robot scans the box. “It is full of tickle-bubbles,” it says. “Very rare. Very silly.”',
        c('🫧', 'Let the bubbles out', 'end_giggle'), c('🎁', 'Save it for a friend’s birthday', 'end_gift')),
      end_tag: end('🏃', 'Comet Tag Champion', 'funny', 'You chase the comet around the station ten times. It is super fast, but you tag it with a giant space mitten. The comet asks for a rematch straight away!'),
      end_giggle: end('😂', 'The Giggle Box', 'funny', 'Out pop hundreds of tickle-bubbles! Everyone on the station laughs so hard that the robot has to sit down. Best morning ever.'),
      end_shiny: end('✨', 'Sparkle Polish', 'happy', 'You polish until the satellite gleams. It beams out a thank-you message that lights up the sky like fireworks.'),
      end_disco: end('🪩', 'Space Disco', 'happy', 'The whole crew joins in. The first ever space disco is a huge hit, and the comet becomes the station’s dance teacher.'),
      end_choir: end('🎤', 'Beep Boop Choir', 'funny', 'The comet can only sing one note: BOOP. But it sings it with so much heart that everybody joins in. BOOP!'),
      end_home: end('🌙', 'Guiding Star', 'happy', 'You steer the station past the Moon, and the comet zooms into a big comet hug. Its family flashes you a sparkly thank-you.'),
      end_party: end('🎉', 'Goodbye Party', 'happy', 'You throw a party with star-shaped balloons. When the comet flies home, it promises to visit every year. Look up and wave!'),
      end_gift: end('🎁', 'The Perfect Present', 'happy', 'You wrap the giggle box with a bow. Your friend opens it on their birthday and laughs all day. Best gift in the galaxy!'),
    },
  },
  {
    id: 'sea', title: 'Under the Sea', emoji: '🐠',
    blurb: 'A friendly turtle taps on your submarine window…',
    start: 'start',
    nodes: {
      start: step('You are exploring a coral reef in a little yellow submarine. A friendly turtle taps on your window with its flipper.',
        c('🐢', 'Follow the turtle', 'turtle'), c('🐚', 'Explore the glowing cave', 'cave')),
      turtle: step('The turtle leads you to an old sunken ship covered in seaweed. A crab is standing on the deck, looking very worried.',
        c('🦀', 'Ask the crab what’s wrong', 'crab'), c('🗝️', 'Look for the captain’s chest', 'chest')),
      cave: step('The cave walls glow blue. Inside, five baby octopuses are trying to build a sandcastle, but it keeps floating away.',
        c('🏰', 'Help them build it', 'castle'), c('🫧', 'Blow bubbles to make them laugh', 'bubbles')),
      crab: step('“I lost my shiny shell hat!” says the crab. “I can’t go to the Reef Party without it!”',
        c('🔍', 'Search the ship', 'search'), c('🐚', 'Make a new hat from shells', 'hat')),
      chest: step('You find a wooden chest. When you open it, out comes a puff of sand… and a very surprised pufferfish!',
        c('🙏', 'Say sorry to the pufferfish', 'end_puff'), c('📜', 'Read the invitation inside', 'party')),
      castle: step('You show them how to pat the sand down tight. The castle stands tall! The octopuses wave all their arms.',
        c('🎉', 'Go to the Reef Party', 'party'), c('📸', 'Take a photo with them', 'end_photo')),
      bubbles: step('Your bubbles wobble up through the water. The baby octopuses giggle and blow bubbles back. It’s a bubble battle!',
        c('🫧', 'Blow the biggest bubble ever', 'end_bigbubble'), c('🏰', 'Build the castle together', 'castle')),
      search: step('In the captain’s cabin you find the shell hat under a pillow. A sleepy seahorse was using it as a bed!',
        c('🛏️', 'Find the seahorse a new bed', 'end_seahorse'), c('🎉', 'Take everyone to the party', 'party')),
      hat: step('You stick shells together with sticky seaweed. The new hat is a bit wonky, but the crab LOVES it.',
        c('🎉', 'Head to the Reef Party', 'party'), c('🥁', 'Start a hat parade', 'end_parade')),
      party: step('The Reef Party is amazing! Jellyfish glow like lanterns and the dolphins are telling jokes.',
        c('🐬', 'Listen to the dolphin jokes', 'end_jokes'), c('💃', 'Dance the Wiggle Fin', 'end_dance')),
      end_puff: end('🐡', 'Puffed Up', 'funny', 'The pufferfish puffs up into a round, spiky ball, then floats away grumbling. Next time you will knock on the chest first!'),
      end_photo: end('📸', 'All Arms Wave', 'happy', 'Click! The photo shows you and the octopuses waving forty-two arms. Two of them are yours! You hang it up in your submarine.'),
      end_bigbubble: end('🫧', 'The Bubble Bus', 'funny', 'Your bubble is so big that all the octopuses climb inside. It floats up to the surface and a seagull gets the surprise of its life!'),
      end_seahorse: end('🛏️', 'Sweet Dreams', 'happy', 'You make the seahorse a cosy bed from soft sea sponge. It falls asleep smiling, and the crab gets its hat back. Everyone wins!'),
      end_parade: end('🥁', 'Hat Parade', 'funny', 'Soon every fish wants a wonky shell hat. The parade goes all around the reef, and the crab marches proudly at the front.'),
      end_jokes: end('🐬', 'Dolphin Comedy Club', 'funny', '“Why are fish so clever? Because they live in schools!” You laugh so much that bubbles come out of your nose.'),
      end_dance: end('💃', 'Wiggle Fin Champion', 'happy', 'You wiggle, you spin, you flap your arms like fins. Three wise old turtles give you a golden starfish medal!'),
    },
  },
  {
    id: 'dragon', title: 'Dragon School', emoji: '🐉',
    blurb: 'Your baby dragon Pip keeps hiccuping sparks…',
    start: 'start',
    nodes: {
      start: step('It’s your first day at Dragon School! Your baby dragon, Pip, is so excited that it keeps hiccuping little sparks.',
        c('🔥', 'Go to Fire Breathing class', 'fire'), c('🪽', 'Go to Flying class', 'fly')),
      fire: step('The teacher asks every dragon to light a candle. Pip takes a big breath… and sneezes out a cloud of bubbles instead!',
        c('🫧', 'Laugh along with Pip', 'bubbleclass'), c('💪', 'Help Pip practise', 'practise')),
      fly: step('Up on the windy hill, the flying teacher calls, “Flap, flap, glide!” Pip flaps so hard that you both lift off the ground.',
        c('☁️', 'Fly up to the clouds', 'clouds'), c('🌳', 'Land in a big tree', 'tree')),
      bubbleclass: step('Everyone laughs, and Pip laughs too. The teacher smiles. “Every dragon is different. Bubble dragons are very rare!”',
        c('🎨', 'Make bubble art', 'end_bubbleart'), c('🏆', 'Enter the talent show', 'show')),
      practise: step('You and Pip practise all lunchtime. Puff! A tiny flame! Puff! A slightly bigger flame! Pip does a happy dance.',
        c('🕯️', 'Light the class candle', 'end_candle'), c('🏆', 'Show off at the talent show', 'show')),
      clouds: step('The clouds feel cool and fluffy. A grumpy cloud rumbles, “Excuse me, this is MY bit of sky!”',
        c('🙏', 'Say sorry and ask its name', 'cloudfriend'), c('🌈', 'Offer to paint it a rainbow', 'end_rainbow')),
      tree: step('You land next to a bird’s nest. Three baby birds stare at Pip with wide eyes. Pip stares back with wide eyes.',
        c('🐦', 'Teach them to flap', 'end_flapclub'), c('🪽', 'Try flying again', 'clouds')),
      show: step('The talent show hall is packed. The judges are a wise old dragon, a very fluffy sheep, and the head teacher.',
        c('✨', 'Do Pip’s best trick', 'end_talent'), c('🤝', 'Do a team act with friends', 'end_team')),
      cloudfriend: step('“I’m Nimbus,” says the cloud. “Nobody ever asks my name!” Nimbus puffs up, all happy and fluffy.',
        c('🌧️', 'Ask Nimbus to water the garden', 'end_garden'), c('🏫', 'Give Nimbus a ride to school', 'end_nimbus')),
      end_bubbleart: end('🎨', 'Bubble Artist', 'happy', 'Pip blows bubbles and you paint them in bright colours. The bubble pictures float around the school all day. Everyone wants one!'),
      end_candle: end('🕯️', 'First Flame', 'happy', 'Pip lights the candle perfectly. The whole class cheers, and Pip is so proud it hiccups sparks for an hour.'),
      end_rainbow: end('🌈', 'Rainbow Cloud', 'happy', 'You paint stripes of every colour. The grumpy cloud smiles for the first time. “Now I can make rainbows for everyone!”'),
      end_flapclub: end('🐦', 'The Flap Club', 'funny', 'Soon the baby birds and Pip are all flapping together. Nobody flies very well yet, but the Flap Club is the noisiest club in school!'),
      end_talent: end('🏆', 'Star of the Show', 'happy', 'Pip does a triple loop and puffs a heart-shaped cloud. The fluffy sheep shouts BAAA very loudly. First prize!'),
      end_team: end('🤝', 'Dream Team', 'happy', 'You and your friends do a dragon dance together. It’s a bit wobbly, but you all finish together, and the crowd cheers.'),
      end_garden: end('🌻', 'Garden Helper', 'happy', 'Nimbus rains gently on the school garden. A week later, giant sunflowers pop up everywhere, and Nimbus is very proud.'),
      end_nimbus: end('☁️', 'Cloud Pet', 'funny', 'Nimbus follows you into class and floats above your desk. Every time you get a question right, it drops one tiny snowflake.'),
    },
  },
  {
    id: 'museum', title: 'Mystery at the Museum', emoji: '🏛️',
    blurb: 'The Golden Rubber Duck has vanished!',
    start: 'start',
    nodes: {
      start: step('It’s a school trip to the City Museum. As you walk in, the guide gasps. “The Golden Rubber Duck is missing!”',
        c('🔍', 'Look for clues', 'clues'), c('🗣️', 'Ask the guard what happened', 'guard')),
      clues: step('On the floor you find a trail of tiny wet footprints and a single brown feather.',
        c('👣', 'Follow the footprints', 'footprints'), c('🪶', 'Ask the bird expert', 'expert')),
      guard: step('The guard yawns. “I heard quacking at midnight. But ducks can’t open doors… can they?”',
        c('🎥', 'Check the cameras', 'cameras'), c('👣', 'Search for footprints', 'footprints')),
      footprints: step('The footprints lead to the dinosaur hall. From behind the giant T. rex skeleton you hear… splashing?',
        c('👀', 'Peek behind the T. rex', 'pond'), c('🦖', 'Politely ask the T. rex', 'end_trex')),
      expert: step('The bird expert looks closely at the feather. “This came from a duck. A real one. A very clever one.”',
        c('🫛', 'Leave out a bowl of peas', 'peas'), c('🎥', 'Watch the cameras', 'cameras')),
      cameras: step('On the video, a small duck waddles in, pushes the door open with its beak, and carries the golden duck away!',
        c('🏃', 'Follow the duck’s path', 'pond'), c('🫛', 'Tempt it back with peas', 'peas')),
      pond: step('Behind the T. rex there’s a fountain. A real duck is floating next to the Golden Rubber Duck, looking very happy.',
        c('🤝', 'Make a deal with the duck', 'end_deal'), c('🖼️', 'Make it part of the museum', 'end_exhibit')),
      peas: step('You leave a bowl of peas by the door. Soon you hear waddle, waddle, waddle… and a quiet “quack?”',
        c('🙌', 'Give the duck a friendly welcome', 'end_welcome'), c('📸', 'Take a photo as proof', 'end_photo')),
      end_trex: end('🦖', 'Ask the Bones', 'funny', 'You politely ask the T. rex if it saw anything. It says nothing, because it is a skeleton. But a voice behind it says “QUACK!” Mystery solved!'),
      end_deal: end('🤝', 'The Duck Deal', 'happy', 'The duck just wanted a friend to float with. Now the museum lends it the golden duck every Sunday, and everyone is happy.'),
      end_exhibit: end('🖼️', 'Living Exhibit', 'funny', 'The museum puts up a new sign: “Two Ducks, One Fountain.” It becomes the most popular exhibit in the whole museum!'),
      end_welcome: end('🦆', 'Museum Mascot', 'happy', 'The duck waddles in, drops the golden duck at your feet and bows. The museum makes it the official museum mascot!'),
      end_photo: end('📸', 'Front Page News', 'happy', 'Your photo is in the newspaper: “Young Detective Solves Duck Mystery!” Your whole class cheers when you get back to school.'),
    },
  },
  {
    id: 'jungle', title: 'Jungle Explorer', emoji: '🌴',
    blurb: 'Something in the trees is singing a very funny song…',
    start: 'start',
    nodes: {
      start: step('You are exploring the jungle with a map and binoculars. Somewhere nearby, something is singing a very funny song.',
        c('🎶', 'Follow the singing', 'singing'), c('🌉', 'Cross the rope bridge', 'bridge')),
      singing: step('It’s a parrot! It is sitting on a branch singing, “Banana, banana, where are my bananas?”',
        c('🍌', 'Help find its bananas', 'bananas'), c('🎤', 'Sing along', 'singalong')),
      bridge: step('The rope bridge wobbles over a sparkling river. On the other side, a monkey is waving a map at you.',
        c('🐒', 'Say hello to the monkey', 'monkey'), c('🛶', 'Take a canoe down the river', 'canoe')),
      bananas: step('You find the bananas in a hollow log. But a sleepy sloth is hugging them like a teddy bear.',
        c('🤫', 'Ask the sloth very politely', 'end_sloth'), c('🫐', 'Offer to swap them for berries', 'end_swap')),
      singalong: step('The parrot loves it! It teaches you the second verse, which is just the word “banana” forty times.',
        c('🥁', 'Add a drum beat', 'end_band'), c('🐒', 'Invite the monkey to listen', 'monkey')),
      monkey: step('The monkey shows you its map. There is a big X next to a waterfall. “Treasure!” it chatters.',
        c('🌴', 'Ask the monkey to lead the way', 'waterfall'), c('🗺️', 'Swap maps with the monkey', 'end_mapswap')),
      canoe: step('You paddle gently down the river. A family of capybaras is relaxing in the warm water like it’s a bath.',
        c('👋', 'Join the capybara pool party', 'end_capy'), c('💧', 'Keep paddling to the waterfall', 'waterfall')),
      waterfall: step('Behind the waterfall is a hidden cave full of glowing flowers. In the middle sits a little wooden box.',
        c('📦', 'Open the box', 'end_treasure'), c('🌸', 'Leave everything just as it is', 'end_kind')),
      end_sloth: end('🦥', 'Slow and Steady', 'funny', 'The sloth nods very… very… slowly. Twenty minutes later it hands you one banana. The parrot is SO happy.'),
      end_swap: end('🫐', 'Fair Swap', 'happy', 'The sloth likes berries even more! The parrot gets its bananas, the sloth gets a snack, and you make two new friends.'),
      end_band: end('🥁', 'The Banana Band', 'funny', 'You drum on a log, the parrot sings and the frogs join in with croaks. The Banana Band plays until sunset!'),
      end_mapswap: end('🗺️', 'Map Mix-up', 'funny', 'You swap maps. Yours shows the way home. The monkey’s map shows… the best trees for swinging. You both laugh and keep the new maps.'),
      end_capy: end('🛁', 'Capybara Spa Day', 'funny', 'The capybaras make room for you. A little bird lands on your head, just like it does on theirs. It’s the most relaxing day ever.'),
      end_treasure: end('📔', 'Explorer’s Journal', 'happy', 'Inside is an old explorer’s journal full of drawings of jungle animals. On the last page it says: “Add your own!”'),
      end_kind: end('🌸', 'Jungle Guardian', 'happy', 'You leave the cave just as it was. The monkey gives you a flower crown and names you the Jungle Guardian.'),
    },
  },
  {
    id: 'time', title: 'The Time Machine', emoji: '⏰',
    blurb: 'Grandad’s shed has a big red button…',
    start: 'start',
    nodes: {
      start: step('In Grandad’s shed you find a dusty machine with a big red button and a sign: “TIME MACHINE (probably)”.',
        c('🦕', 'Set the dial to dinosaur times', 'dinos'), c('🤖', 'Set it to the far future', 'future')),
      dinos: step('WHOOSH! You land among giant ferns. A baby triceratops sniffs your shoelaces with great interest.',
        c('🤝', 'Make friends with it', 'trike'), c('⛰️', 'Look around from the hilltop', 'hill')),
      future: step('WHOOSH! You land in a city where cars fly and the pavements move all by themselves.',
        c('🛹', 'Ride a hoverboard', 'hover'), c('🏫', 'Visit a future school', 'school')),
      trike: step('The baby triceratops follows you everywhere. It loves it when you scratch behind its frill.',
        c('🌲', 'Play fetch with a pinecone', 'end_fetch'), c('🏠', 'Help it find its herd', 'herd')),
      hill: step('From the hill you can see a herd of dinosaurs, and one little triceratops that has wandered away from them.',
        c('🏠', 'Help it get back', 'herd'), c('✏️', 'Draw a picture of the view', 'end_sketch')),
      hover: step('The hoverboard zooms along. A friendly robot zooms up next to you. “Race you to the park?”',
        c('🏁', 'Race the robot', 'end_race'), c('🤖', 'Ask it to show you around', 'school')),
      school: step('In the future school, holograms teach the lessons. Today’s lesson is “Life in the Old Days”, which means your time!',
        c('🙋', 'Tell the class about your life', 'end_teacher'), c('⏰', 'Hurry back home for tea', 'end_home')),
      herd: step('You lead the little triceratops back. Its mum gives a happy rumble, and the whole herd stamps their feet.',
        c('👋', 'Wave goodbye and go home', 'end_home'), c('🦕', 'Ride back on its mum’s back', 'end_ride')),
      end_fetch: end('🌲', 'Dino Fetch', 'funny', 'You throw the pinecone. The triceratops runs off and comes back with a whole tree. Good try, buddy!'),
      end_sketch: end('✏️', 'Real Dino Artist', 'happy', 'You draw the dinosaurs just as you saw them. Back home, your teacher says it is the best dinosaur drawing she has ever seen.'),
      end_race: end('🏁', 'Photo Finish', 'happy', 'You and the robot cross the line at exactly the same moment. “A TIE!” it beeps. “Best race ever. Let’s be friends!”'),
      end_teacher: end('🙋', 'Guest Teacher', 'funny', 'The future kids can’t believe you carry paper books in a bag. You get the biggest round of applause in history.'),
      end_home: end('🏠', 'Home Sweet Home', 'happy', 'You press the red button and land back in Grandad’s shed. He looks up and smiles. “Back already? Tell me EVERYTHING.”'),
      end_ride: end('🦕', 'Dino Express', 'funny', 'The mum triceratops gives you a ride all the way to the time machine. It’s bumpy and slow, and it’s the best ride of your life.'),
    },
  },
  {
    id: 'robot', title: 'My Robot Friend', emoji: '🤖',
    blurb: 'You build a robot. It wants to know what fun is…',
    start: 'start',
    nodes: {
      start: step('You build a robot from a box, two bottle caps and a torch. You press its nose and it blinks. “HELLO. I AM BOLT. WHAT IS FUN?”',
        c('🎲', 'Teach Bolt a game', 'game'), c('🧹', 'Ask Bolt to help tidy up', 'tidy')),
      game: step('You teach Bolt hide-and-seek. Bolt covers its eyes and counts: “1, 2, 3… 9,000.” That might take a while.',
        c('🙈', 'Hide anyway', 'hide'), c('🔟', 'Teach Bolt to count to ten', 'count')),
      tidy: step('Bolt tidies super fast. Too fast! Your socks are in the fridge and your books are in the bath.',
        c('😂', 'Laugh and help sort it out', 'sort'), c('📋', 'Make Bolt a tidy-up list', 'list')),
      hide: step('You hide under your bed. An hour later, Bolt is still counting. You start to feel very sleepy.',
        c('😴', 'Keep snoozing', 'end_nap'), c('📣', 'Shout “Ready!”', 'found')),
      count: step('“1, 2, 3… 10! READY OR NOT!” Bolt searches every room, beeping loudly as it goes.',
        c('🤫', 'Stay very, very quiet', 'found'), c('🔄', 'Swap and let Bolt hide', 'end_bolthide')),
      sort: step('Together you put everything back. Bolt holds up a sock. “WHAT IS THIS?” “A sock.” “WHY IS THERE ONLY ONE?”',
        c('🧦', 'Search for the missing sock', 'end_sock'), c('🤔', 'Explain the great sock mystery', 'end_mystery')),
      list: step('You draw a list with pictures. Bolt reads it carefully, beeps twice and gets to work.',
        c('✅', 'Check its work', 'end_tidy'), c('🎵', 'Play music while it tidies', 'end_dance')),
      found: step('Bolt finds you! It does a victory spin. “HIDE-AND-SEEK IS FUN. AGAIN. AGAIN. AGAIN.”',
        c('🏅', 'Give Bolt a medal', 'end_medal'), c('❌', 'Teach it noughts and crosses', 'end_newgame')),
      end_nap: end('😴', 'Champion Hider', 'funny', 'You wake up the next morning. Bolt has finally finished counting. “I GIVE UP. YOU ARE THE GREATEST HIDER IN HISTORY.”'),
      end_bolthide: end('📦', 'Box Disguise', 'funny', 'Bolt hides by standing very still in a corner. It just looks like a box with eyes. You pretend you can’t see it for ages.'),
      end_sock: end('🧦', 'Sock Detective', 'happy', 'The missing sock is inside your pillowcase! Bolt is amazed. It makes you a sign that says SOCK DETECTIVE for your door.'),
      end_mystery: end('🤔', 'The Great Sock Mystery', 'funny', 'You explain that socks just vanish sometimes, and nobody knows why. Bolt thinks about it all night and is still confused.'),
      end_tidy: end('✅', 'Tidy Team', 'happy', 'Your room is perfect! Everything is in the right place, even the socks. Your family asks if Bolt can tidy their rooms too.'),
      end_dance: end('🕺', 'The Robo-Sweep', 'happy', 'Bolt tidies to the beat, spinning and sliding. By the end of the song your room is clean, and Bolt has invented a new dance!'),
      end_medal: end('🏅', 'Best Friends', 'happy', 'You make Bolt a medal from shiny foil. Bolt wears it every day and calls you its best friend. It beeps happily every time it sees you.'),
      end_newgame: end('🤝', 'Game Masters', 'funny', 'You play ten games of noughts and crosses. Every single one is a draw! Bolt says that means you are both geniuses.'),
    },
  },
  {
    id: 'snow', title: 'The Great Snow Fort', emoji: '❄️',
    blurb: 'It snowed all night. Time to build!',
    start: 'start',
    nodes: {
      start: step('It snowed all night! The whole street is white and sparkly. Your friends are outside planning the biggest snow fort ever.',
        c('🧱', 'Build the walls', 'walls'), c('⛄', 'Build a snowman guard', 'snowman')),
      walls: step('You roll big snowballs and stack them up. The walls get taller and taller. Then you notice the fort is leaning a tiny bit…',
        c('🪵', 'Prop it up with sticks', 'sticks'), c('🤞', 'Hope for the best', 'lean')),
      snowman: step('Your snowman is huge! It needs a face. You have a carrot, two buttons and a spare woolly hat.',
        c('🥕', 'Give it a classic face', 'classic'), c('😎', 'Add sunglasses too', 'cool')),
      sticks: step('The sticks work! The fort stands strong. Your friend runs over. “The kids next door want a snowball contest!”',
        c('🎯', 'Agree to a target contest', 'contest'), c('🤝', 'Invite them to build with you', 'team')),
      lean: step('The fort leans… and leans… and FLOMP! It falls down into a perfect snow slide.',
        c('🛷', 'Slide down it', 'end_slide'), c('🔨', 'Build it again together', 'team')),
      classic: step('The snowman looks friendly. A robin lands on its hat and starts to sing.',
        c('🐦', 'Make a bird feeder for the robin', 'end_robin'), c('🏰', 'Make the snowman the fort guard', 'contest')),
      cool: step('With sunglasses on, it is the coolest snowman on the street. Kids come from all around to see it.',
        c('🎪', 'Hold a snowman show', 'end_show'), c('🏰', 'Make it the fort guard', 'contest')),
      contest: step('Everyone throws snowballs at a target on a tree. No throwing at people, only at the target! The score is tied.',
        c('🎯', 'Take the final throw', 'end_bullseye'), c('🧣', 'Call it a draw and warm up', 'end_warm')),
      team: step('With everyone helping, the fort grows into a snow castle with towers, windows and a secret tunnel.',
        c('🚩', 'Plant a flag on top', 'end_castle'), c('🔦', 'Light it up at night', 'end_glow')),
      end_slide: end('🛷', 'Accidental Slide', 'funny', 'WHEEEE! Everyone takes turns on the slide all afternoon. It’s the best fort that ever fell down.'),
      end_robin: end('🐦', 'Robin’s Friend', 'happy', 'You hang up a feeder full of seeds. The robin visits every morning and sings you a thank-you song.'),
      end_show: end('😎', 'Coolest Show in Town', 'funny', 'Your snowman show is a huge hit. Even the postman stops to take a photo, and the snowman doesn’t even blink.'),
      end_bullseye: end('🎯', 'Bullseye!', 'happy', 'You aim, you throw… BULLSEYE! Both teams cheer, and the kids next door become your new friends.'),
      end_warm: end('🧣', 'Warm-Up Party', 'happy', 'Everybody squeezes inside, wrapped in blankets and telling jokes. It’s a draw, and everyone agrees that’s perfect.'),
      end_castle: end('🚩', 'Snow Castle', 'happy', 'Your flag flaps on the tallest tower. The whole street calls it Snow Castle, and it lasts all week.'),
      end_glow: end('🏮', 'The Glowing Fort', 'happy', 'At night, torches make the fort glow like a giant lantern. Neighbours come out to see it, and everyone says “Wow!”'),
    },
  },
];

export const storyById = (id: string) => ADVENTURE_STORIES.find(s => s.id === id);

/** Every ending in a story, as [nodeId, node]. */
export const endingsOf = (story: AdventureStory) =>
  Object.entries(story.nodes).filter(([, n]) => n.end) as [string, StoryNode & { end: StoryEnding }][];

/** Builds the full story text for a finished path (node ids from start to ending). */
export function pathText(story: AdventureStory, path: string[]): { text: string; choice?: string }[] {
  return path.map((id, i) => {
    const node = story.nodes[id];
    const nextId = path[i + 1];
    const choice = nextId ? node?.choices?.find(ch => ch.to === nextId) : undefined;
    return { text: node?.text ?? '', choice: choice ? `${choice.emoji} ${choice.label}` : undefined };
  });
}

/** True when `path` is a real walk from the start to an ending of this story. */
export function isValidPath(story: AdventureStory, path: string[]): boolean {
  if (path[0] !== story.start) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if (!story.nodes[path[i]]?.choices?.some(ch => ch.to === path[i + 1])) return false;
  }
  return !!story.nodes[path[path.length - 1]]?.end;
}
