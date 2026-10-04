// Halloween quiz bank (seasonal). Fact-checked October 2026 — kid-friendly, no scary content.
// Origins are worded carefully: historians link Halloween to Samhain but the details are debated.
import type { QuizBank } from './types';
import { mc, tf, typed, ordered } from './types';

export const halloween: QuizBank = {
  id: 'halloween',
  title: 'Halloween',
  emoji: '🎃',
  questions: [
    // Traditions & history
    mc('Which Celtic festival is often linked to the origins of Halloween?', 'Samhain', ['Diwali', 'Hanukkah', 'Holi'], { emoji: '🔥', fact: 'Samhain marked the end of the harvest and the start of winter.' }),
    mc('On what date is Halloween?', 'October 31', ['October 13', 'November 1', 'September 30'], { emoji: '📅' }),
    tf("The name Halloween comes from 'All Hallows' Eve'.", true, { emoji: '📜', fact: "It's the evening before All Hallows' Day (All Saints' Day)." }),
    mc("All Saints' Day, the day after Halloween, is on…", 'November 1', ['October 30', 'December 1', 'November 11'], { emoji: '🗓️' }),
    mc('In Ireland and Scotland, lanterns were once carved from which vegetable?', 'Turnips', ['Watermelons', 'Coconuts', 'Pineapples'], { emoji: '🏮', fact: 'Pumpkins became the favourite later, in North America — they are much easier to carve!' }),
    typed('What do we call a pumpkin with a carved face and a light inside?', ["Jack-o'-lantern", 'jack o lantern', 'jackolantern', 'jack lantern'], { emoji: '🎃' }),
    mc('What do trick-or-treaters usually say at the door?', 'Trick or treat!', ['Happy birthday!', 'Knock knock!', 'Merry Christmas!'], { emoji: '🍬' }),
    mc('Which party game means catching apples in water with your mouth?', 'Apple bobbing', ['Apple juggling', 'Hide and seek', 'Musical chairs'], { emoji: '🍎' }),

    // Pumpkins
    tf('A pumpkin is a type of squash.', true, { emoji: '🎃' }),
    tf('Scientists call a pumpkin a fruit, because it holds the seeds.', true, { emoji: '🌱', fact: 'Fruits grow from a flower and carry the seeds — pumpkins do both.' }),
    mc('Pumpkins grow on…', 'Vines', ['Tall trees', 'Underground roots', 'Cactus plants'], { emoji: '🌿' }),
    mc('Pumpkins are in the same plant family as…', 'Cucumbers', ['Carrots', 'Potatoes', 'Apples'], { emoji: '🥒', fact: 'The gourd family also includes melons and courgettes (zucchini).' }),
    tf('A pumpkin is about 90% water.', true, { emoji: '💧' }),
    tf('The biggest prize pumpkins can weigh more than 1,000 kg.', true, { emoji: '🏆', fact: 'The world record pumpkin (2023) weighed about 1,247 kg — about as heavy as a small car!' }),
    ordered("Put a pumpkin's life in order", ['Seed', 'Sprout', 'Vine', 'Flower', 'Pumpkin'], { emoji: '🌱' }),

    // Bats
    tf('Bats are the only mammals that can truly fly.', true, { emoji: '🦇', fact: "Flying squirrels and colugos glide, but they can't flap and fly." }),
    mc('How do many bats find insects in the dark?', 'Echolocation', ['Photosynthesis', 'Hibernation', 'Camouflage'], { emoji: '🔊', fact: 'They make high squeaks and listen for the echoes bouncing back.' }),
    tf('All bats drink blood.', false, { emoji: '🦇', fact: 'Only 3 kinds of vampire bat do. Most bats eat insects, fruit or flower nectar.' }),
    mc('Which of these animals is a bat?', 'Flying fox', ['Flying squirrel', 'Flying fish', 'Flying frog'], { emoji: '🦊', fact: 'Flying foxes are large fruit bats — the biggest have wings about 1.5 m across.' }),

    // Owls
    mc('About how far can an owl turn its head?', '270 degrees', ['90 degrees', '360 degrees', '45 degrees'], { emoji: '🦉', fact: 'Not all the way round — but much further than we can!' }),
    tf('Owls can roll their eyes around in their sockets, like people can.', false, { emoji: '👀', fact: "Owls' eyes are tube-shaped and fixed in place, so they turn their heads instead." }),
    mc('What is a group of owls often called?', 'A parliament', ['A pride', 'A pack', 'A school'], { emoji: '🦉' }),

    // Spiders
    tf('Spiders are insects.', false, { emoji: '🕸️', fact: 'Spiders have 8 legs and 2 body parts; insects have 6 legs and 3 body parts.' }),
    typed('Spiders and scorpions belong to which group of 8-legged animals?', ['Arachnids', 'arachnid', 'arachnida'], { emoji: '🕷️' }),
    mc('What is spider silk made of?', 'Protein', ['Plastic', 'Sugar', 'Cotton'], { emoji: '🧵' }),
    tf('Weight for weight, spider silk can be stronger than steel.', true, { emoji: '💪' }),
    tf('Some baby spiders float through the air on silk threads.', true, { emoji: '🎈', fact: "It's called ballooning — the wind carries them to new homes." }),

    // Autumn science
    mc('Why do many leaves change colour in autumn?', 'Chlorophyll breaks down', ['They get sunburnt', 'Rain washes them', 'Frost paints them'], { emoji: '🍁', fact: 'When the green fades, yellow and orange colours that were hiding show through.' }),
    typed("What do we call some animals' long, deep winter sleep?", ['Hibernation', 'hibernating', 'hibernate'], { emoji: '🐻' }),
    mc('Why do many birds fly south in autumn?', 'To find food and warmth', ['To visit the Moon', 'To lose their feathers', 'To find more snow'], { emoji: '🪿' }),
  ],
};
