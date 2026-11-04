// Winter quiz bank (seasonal, Winter Wonderland). Fact-checked November 2026 — kid-friendly, no
// scary content. Wording is careful where science says "very likely" rather than "always"
// (e.g. snowflakes being different, Arctic foxes turning white).
import type { QuizBank } from './types';
import { mc, tf, typed, ordered } from './types';

export const winter: QuizBank = {
  id: 'winter',
  title: 'Winter',
  emoji: '❄️',
  questions: [
    // Snow & ice
    tf('Snowflakes usually have six sides or six arms.', true, { emoji: '❄️', fact: 'Water freezes into a six-sided pattern, so snow crystals grow with six arms.' }),
    mc('At what temperature does pure water freeze?', '0 °C', ['10 °C', '-50 °C', '100 °C'], { emoji: '🌡️', fact: 'That is 32 °F. Salty water has to get colder than that before it freezes.' }),
    tf('Ice floats because it is lighter than the same amount of liquid water.', true, { emoji: '🧊', fact: 'That is why ponds freeze from the top down — fish can keep swimming underneath.' }),
    mc('What do we call a long, pointy spike of ice hanging from a roof?', 'Icicle', ['Igloo', 'Glacier', 'Iceberg'], { emoji: '🏠' }),
    mc('A huge river of ice that moves very slowly is called a…', 'Glacier', ['Geyser', 'Volcano', 'Canyon'], { emoji: '🏔️' }),
    tf('Most of an iceberg is hidden under the water.', true, { emoji: '🧊', fact: 'Only about one tenth of an iceberg shows above the sea.' }),
    mc('What is the name of a snow house built by some Inuit people?', 'Igloo', ['Tipi', 'Yurt', 'Chalet'], { emoji: '🏠', fact: 'Snow is full of tiny air pockets, so an igloo keeps out the cold wind and holds in warmth.' }),
    mc('Lots of snow with very strong wind, so you can hardly see, is a…', 'Blizzard', ['Drizzle', 'Heatwave', 'Rainbow'], { emoji: '🌨️' }),
    tf('Snow looks white because it is full of white paint.', false, { emoji: '🎨', fact: 'Snow is ice crystals. They bounce all the colours of light back to us, so we see white.' }),
    tf('It is very unlikely that two big snowflakes are exactly the same.', true, { emoji: '🔍', fact: 'Each flake grows its own way as it tumbles through the cloud.' }),
    typed('What do you call a figure made of snow, often with a carrot nose?', ['snowman', 'snow man', 'snowmen', 'snowwoman', 'snow woman', 'snow person'], { emoji: '⛄' }),
    typed('What frozen water falls from the clouds as soft white flakes?', ['snow', 'snowflakes', 'snowflake'], { emoji: '🌨️' }),

    // Polar animals
    tf('Polar bears live in the Arctic, near the North Pole.', true, { emoji: '🐻‍❄️' }),
    tf('Polar bears and penguins meet each other in the wild.', false, { emoji: '🐧', fact: 'Polar bears live in the far north. Almost all penguins live in the southern half of the world.' }),
    mc("Under its fur, what colour is a polar bear's skin?", 'Black', ['White', 'Pink', 'Yellow'], { emoji: '🐻‍❄️', fact: 'Black skin soaks up warmth from the sun. The fur only looks white.' }),
    mc('Which penguin is the biggest?', 'Emperor penguin', ['Little blue penguin', 'Rockhopper penguin', 'Gentoo penguin'], { emoji: '🐧', fact: 'Emperor penguins can stand over a metre tall.' }),
    tf('Emperor penguin dads keep their egg warm on top of their feet.', true, { emoji: '🥚', fact: 'They tuck it under a warm fold of skin and huddle together through the winter storms.' }),
    mc('What do we call it when an animal sleeps through the winter?', 'Hibernation', ['Migration', 'Pollination', 'Evaporation'], { emoji: '💤' }),
    mc('Which of these animals hibernates in winter?', 'Hedgehog', ['Penguin', 'Robin', 'Reindeer'], { emoji: '🦔', fact: 'Hedgehogs curl up in a nest of leaves and sleep until spring.' }),
    tf('Reindeer and caribou are the same kind of animal.', true, { emoji: '🦌', fact: 'In North America the wild ones are called caribou.' }),
    mc('Many Arctic foxes grow fur of which colour for the winter?', 'White', ['Green', 'Orange', 'Purple'], { emoji: '🦊', fact: 'White fur helps them hide in the snow. In summer it turns brown or grey.' }),
    mc('Many birds fly to warmer places for the winter. This is called…', 'Migration', ['Hibernation', 'Camouflage', 'Erosion'], { emoji: '🕊️' }),

    // Seasons & sky
    mc('In the northern half of the world, the shortest day is around…', '21 December', ['21 March', '21 June', '21 September'], { emoji: '🌅', fact: 'It is called the winter solstice. After it, the days slowly get longer again.' }),
    tf('We have seasons because the Earth is tilted.', true, { emoji: '🌍', fact: 'As the Earth goes round the Sun, first one half and then the other leans towards it.' }),
    tf('When it is winter in the UK, it is summer in Australia.', true, { emoji: '🦘', fact: 'Some Australians have a barbecue on the beach for Christmas!' }),
    mc('The northern lights are also called the…', 'Aurora borealis', ['Milky Way', 'Solar eclipse', 'Shooting stars'], { emoji: '🌌' }),
    tf('The northern lights glow when tiny bits from the Sun hit the air high above the Earth.', true, { emoji: '✨', fact: 'They are easiest to see on dark winter nights, far in the north or south.' }),
    mc('Which is the coldest continent?', 'Antarctica', ['Africa', 'Europe', 'Australia'], { emoji: '🧭' }),

    // Winter fun around the world
    mc('Hanukkah, the Jewish festival of lights, lasts how many nights?', 'Eight', ['Two', 'Twelve', 'Thirty'], { emoji: '🕎' }),
    mc('In Scotland, New Year’s Eve is called…', 'Hogmanay', ['Halloween', 'Diwali', 'Easter'], { emoji: '🎆' }),
    mc('Which winter sport means sliding on a sledge, lying on your back, feet first?', 'Luge', ['Curling', 'Skiing', 'Ice hockey'], { emoji: '🛷', fact: 'In skeleton, the riders go head first on their tummies instead!' }),
    ordered('Put these months in order', ['November', 'December', 'January', 'February'], { emoji: '📅' }),
  ],
};
