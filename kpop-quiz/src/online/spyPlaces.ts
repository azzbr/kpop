// Spy Station content: 24 secret places, each with fun roles and one-word answer chips for the
// 8 question cards. Questions are the same for every place (the asker might be the spy, who
// doesn't know the place). Answers are single words (hyphens allowed).

export type SpyQuestionId = 'hear' | 'wear' | 'see' | 'eat' | 'do' | 'bring' | 'smell' | 'meet';

export const SPY_QUESTIONS: { id: SpyQuestionId; text: string; emoji: string }[] = [
  { id: 'hear', text: 'What do you hear here?', emoji: '👂' },
  { id: 'wear', text: 'What would you wear here?', emoji: '👕' },
  { id: 'see', text: 'What can you see around you?', emoji: '👀' },
  { id: 'eat', text: 'What snack would you have here?', emoji: '🍪' },
  { id: 'do', text: 'What do people do here?', emoji: '🤸' },
  { id: 'bring', text: 'What would you bring here?', emoji: '🎒' },
  { id: 'smell', text: 'What does it smell like here?', emoji: '👃' },
  { id: 'meet', text: 'Who might you meet here?', emoji: '🙋' },
];

export interface SpyPlace {
  id: string;
  name: string;
  emoji: string;
  /** Fun roles for the locals (repeated if there are more locals than roles). */
  roles: string[];
  answers: Record<SpyQuestionId, string[]>;
}

const w = (s: string) => s.split(' ');
function place(id: string, name: string, emoji: string, roles: string, a: [string, string, string, string, string, string, string, string]): SpyPlace {
  const [hear, wear, see, eat, doIt, bring, smell, meet] = a.map(w);
  return { id, name, emoji, roles: roles.split('|'), answers: { hear, wear, see, eat, do: doIt, bring, smell, meet } };
}

//              hear | wear | see | eat | do | bring | smell | meet
export const SPY_PLACES: SpyPlace[] = [
  place('castle', 'Castle', '🏰', 'King|Queen|Knight|Jester|Royal Cook|Guard|Princess|Dragon Keeper', [
    'Trumpets Hooves Clanking Lutes', 'Crown Armour Cape Gown', 'Towers Moat Throne Banners', 'Feast Pie Tarts Drumstick',
    'Joust Bow Curtsy Rule', 'Shield Gift Scroll Goblet', 'Torches Stone Roast Stables', 'King Knight Jester Princess']),
  place('zoo', 'Zoo', '🦁', 'Zookeeper|Vet|Tour Guide|Ice Cream Seller|Visitor|Photographer|Penguin Keeper|Gift Shop Helper', [
    'Roaring Growling Hissing Squawking', 'Safari-hat Shorts Sunglasses Face-paint', 'Giraffes Lions Zebras Enclosures', 'Ice-lolly Popcorn Picnic Animal-biscuits',
    'Feed Pet Snap Spot', 'Binoculars Animal-book Zoo-map Sticker-book', 'Hay Straw Mud Animals', 'Zookeeper Monkeys Lions Meerkats']),
  place('space', 'Space station', '🚀', 'Commander|Astronaut|Engineer|Scientist|Pilot|Space Chef|Robot Helper|Doctor', [
    'Beeping Humming Buzzing Countdown', 'Spacesuit Helmet Jumpsuit Space-gloves', 'Earth Stars Planets Satellites', 'Tortillas Pouches Crackers Dried-fruit',
    'Float Experiment Spacewalk Exercise', 'Toolkit Photos Space-pen Laptop', 'Metal Nothing Machines Plastic', 'Astronauts Commander Robots Scientists']),
  place('bakery', 'Bakery', '🥐', 'Baker|Cake Decorator|Cashier|Delivery Driver|Customer|Apprentice|Bread Taster|Cleaner', [
    'Ovens Mixers Doorbell Timers', 'Apron Hairnet Chef-hat Oven-gloves', 'Cakes Bread Ovens Flour', 'Croissant Cupcake Doughnut Bun',
    'Bake Knead Decorate Ice', 'Basket Recipe Rolling-pin Cake-tin', 'Bread Cinnamon Sugar Butter', 'Baker Decorator Cashier Delivery-driver']),
  place('pirate', 'Pirate ship', '🏴‍☠️', 'Captain|First Mate|Lookout|Ship Cook|Deckhand|Navigator|Parrot Keeper|Cabin Helper', [
    'Waves Seagulls Creaking Shanties', 'Eyepatch Bandana Tricorn Sash', 'Sails Mast Treasure Flag', 'Ship-biscuits Fish Oranges Coconut',
    'Sail Steer Climb Swab', 'Treasure-map Telescope Compass Shovel', 'Salt Seaweed Tar Fish', 'Captain Parrot Crew Mermaid']),
  place('library', 'School library', '📚', 'Librarian|Student|Teacher|Book Club Leader|Visiting Author|Library Helper|Reader|Storyteller', [
    'Whispers Shushing Pages Ticking', 'School-uniform Reading-glasses Cardigan Tie', 'Shelves Books Computers Posters', 'Nothing Mints Water Raisins',
    'Read Borrow Study Return', 'Library-card Book-bag Bookmark Pencil', 'Paper Books Dust Pencils', 'Librarian Classmates Author Teacher']),
  place('beach', 'Beach', '🏖️', 'Lifeguard|Surfer|Ice Cream Seller|Sandcastle Builder|Swimmer|Fisher|Sunbather|Beach Cleaner', [
    'Waves Seagulls Splashing Wind', 'Swimsuit Sunhat Flip-flops Sunglasses', 'Sand Sea Shells Umbrellas', 'Ice-lolly Watermelon Chips Picnic',
    'Swim Surf Paddle Sunbathe', 'Towel Bucket Spade Sunscreen', 'Salt Sunscreen Seaweed Chips', 'Lifeguard Surfers Crabs Seagulls']),
  place('farm', 'Farm', '🚜', 'Farmer|Tractor Driver|Shepherd|Vet|Egg Collector|Scarecrow|Sheepdog|Visitor', [
    'Mooing Oinking Clucking Tractors', 'Wellies Overalls Straw-hat Work-gloves', 'Barn Fields Cows Haystacks', 'Eggs Apples Cheese Carrots',
    'Plough Milk Harvest Feed', 'Bucket Pitchfork Seeds Wheelbarrow', 'Hay Mud Grass Animals', 'Farmer Sheepdog Chickens Cows']),
  place('hospital', 'Hospital', '🏥', 'Doctor|Nurse|Patient|Surgeon|Visitor|Receptionist|Porter|Paramedic', [
    'Beeping Sirens Trolleys Sneezing', 'Gown Scrubs Mask Wristband', 'Beds Wheelchairs Monitors Bandages', 'Jelly Grapes Custard Rice-pudding',
    'Rest Heal Bandage Check-up', 'Flowers Get-well-card Pyjamas Slippers', 'Soap Disinfectant Flowers Hand-gel', 'Doctor Nurse Patients Paramedics']),
  place('circus', 'Circus', '🎪', 'Ringmaster|Clown|Acrobat|Juggler|Tightrope Walker|Popcorn Seller|Trapeze Artist|Unicyclist', [
    'Drumroll Honking Cheering Ta-da', 'Costume Sequins Red-nose Top-hat', 'Big-top Ring Trapeze Spotlights', 'Popcorn Candyfloss Peanuts Hotdog',
    'Juggle Tumble Perform Clown-around', 'Balloon Glow-stick Clown-horn Juggling-balls', 'Popcorn Sawdust Sugar Candyfloss', 'Ringmaster Clowns Acrobats Jugglers']),
  place('supermarket', 'Supermarket', '🛒', 'Cashier|Shelf Stacker|Shopper|Manager|Baker|Security Guard|Delivery Driver|Trolley Collector', [
    'Beeping Announcements Trolleys Tills', 'Name-badge Fleece Hairnet Apron', 'Aisles Trolleys Shelves Tills', 'Samples Pick-n-mix Deli-cheese Fruit',
    'Stack Scan Weigh Check-out', 'Shopping-list Shopping-bags Coupons Trolley-coin', 'Bread Fruit Flowers Cheese-counter', 'Cashier Shoppers Manager Shelf-stackers']),
  place('pool', 'Swimming pool', '🏊', 'Lifeguard|Swimmer|Diver|Coach|Swim Teacher|Toddler|Snack Seller|Pool Cleaner', [
    'Splashing Whistles Echoes Wave-machine', 'Goggles Swimsuit Swim-cap Armbands', 'Water Lanes Diving-board Slides', 'Flapjack Vending-snack Squash Cereal-bar',
    'Swim Dive Float Race', 'Towel Shampoo Floats Flip-flops', 'Chlorine Shampoo Soap Water', 'Lifeguard Swimmers Coach Divers']),
  place('cinema', 'Cinema', '🎬', 'Usher|Ticket Seller|Projectionist|Film Fan|Snack Seller|Film Critic|Manager|Cleaner', [
    'Soundtrack Crunching Shushing Slurping', 'Movie-glasses Hoodie Fan-shirt Cosy-jumper', 'Screen Seats Trailers Darkness', 'Popcorn Nachos Sweets Slushie',
    'Watch Munch Whisper Gasp', 'Film-ticket Tissues Booster-seat Movie-snacks', 'Popcorn Butter Nachos Sweets', 'Usher Film-fans Critics Projectionist']),
  place('airport', 'Airport', '✈️', 'Pilot|Flight Attendant|Passenger|Security Officer|Baggage Handler|Air Traffic Controller|Check-in Clerk|Shop Assistant', [
    'Engines Announcements Wheels Beeping', 'Pilot-hat Neck-pillow Headphones Backpack', 'Planes Runway Suitcases Gates', 'Pretzel Plane-meal Travel-sweets Smoothie',
    'Fly Wait Check-in Board', 'Passport Suitcase Boarding-pass Travel-game', 'Jet-fuel Coffee Perfume Pastries', 'Pilot Passengers Guards Crew']),
  place('campsite', 'Campsite', '⛺', 'Camp Leader|Camper|Scout|Park Ranger|Fire Builder|Camp Cook|Hiker|Birdwatcher', [
    'Owls Crickets Crackling Rustling', 'Wellies Raincoat Hoodie Headtorch', 'Tents Campfire Trees Stars', 'Marshmallows Sausages Beans Toast',
    'Hike Camp Explore Sing', 'Sleeping-bag Torch Tent Compass', 'Smoke Pine Grass Rain', 'Ranger Scouts Campers Squirrels']),
  place('aquarium', 'Aquarium', '🐠', 'Diver|Fish Keeper|Visitor|Guide|Shark Expert|Photographer|Sea Scientist|Ticket Seller', [
    'Bubbles Pumps Splashing Gasps', 'Wetsuit Flippers Dive-mask Air-tank', 'Tanks Sharks Jellyfish Turtles', 'Fish-fingers Seaweed-snack Fishy-crackers Shark-sweets',
    'Point Learn Peek Dive', 'Fish-book Fish-spotter Sea-quiz Splash-poncho', 'Water Salt Fish Seaweed', 'Sharks Divers Guides Turtles']),
  place('train', 'Train', '🚂', 'Train Driver|Conductor|Passenger|Ticket Inspector|Snack Trolley Server|Engineer|Commuter|Tourist', [
    'Clatter Choo-choo Announcements Horn', 'Conductor-cap Scarf Headphones Backpack', 'Fields Stations Tracks Platforms', 'Trolley-snacks Tea Packed-lunch Shortbread',
    'Travel Read Nap Wave', 'Train-ticket Comic Suitcase Travel-snacks', 'Coffee Diesel Sandwiches Steam', 'Conductor Driver Passengers Commuters']),
  place('firestation', 'Fire station', '🚒', 'Firefighter|Fire Chief|Engine Driver|Dispatcher|Dalmatian|Trainee|Mechanic|Visitor', [
    'Sirens Alarms Engines Radios', 'Helmet Fire-boots Fire-jacket Breathing-mask', 'Ladders Hoses Trucks Pole', 'Chilli Pizza Pasta Stew',
    'Drill Rescue Polish Slide-pole', 'Radio Torch Hose First-aid-kit', 'Smoke Rubber Diesel Polish', 'Firefighters Chief Dalmatian Trainees']),
  place('ski', 'Ski resort', '⛷️', 'Ski Instructor|Skier|Snowboarder|Lift Operator|Hot Chocolate Seller|Mountain Rescuer|Hotel Manager|Snowplough Driver', [
    'Swishing Wind Crunching Scraping', 'Goggles Mittens Ski-jacket Beanie', 'Snow Mountains Lifts Slopes', 'Fondue Soup Waffles Cocoa',
    'Ski Snowboard Sledge Slide', 'Skis Poles Sledge Lip-balm', 'Pine Snow Cocoa Woodsmoke', 'Instructor Skiers Snowboarders Rescuers']),
  place('jungle', 'Jungle', '🌴', 'Explorer|Jungle Guide|Scientist|Photographer|Bird Watcher|Map Maker|Plant Expert|Camp Cook', [
    'Parrots Monkeys Rain Frogs', 'Explorer-hat Hiking-boots Shorts Poncho', 'Vines Trees Parrots Waterfalls', 'Bananas Mangoes Coconut Nuts',
    'Explore Climb Trek Swing', 'Bug-spray Binoculars Water-bottle Compass', 'Flowers Mud Rain Leaves', 'Monkeys Toucans Explorers Sloths']),
  place('museum', 'Museum', '🏛️', 'Curator|Tour Guide|Security Guard|Visitor|Historian|Artist|Gift Shop Seller|Cleaner', [
    'Footsteps Whispers Echoes Guides', 'White-gloves Visitor-sticker Comfy-shoes Lanyard', 'Dinosaurs Paintings Statues Fossils', 'Scone Fudge Dino-biscuit Cafe-cake',
    'Look Learn Wander Sketch', 'Sketchbook Museum-map Quiz-sheet Magnifying-glass', 'Dust Polish Wood Paper', 'Curator Guides Guards Historians']),
  place('restaurant', 'Restaurant', '🍝', 'Chef|Waiter|Customer|Manager|Dishwasher|Food Critic|Host|Sous Chef', [
    'Clinking Sizzling Cutlery Bells', 'Apron Bowtie Smart-shirt Party-dress', 'Tables Menus Candles Plates', 'Pasta Pizza Soup Dessert',
    'Order Eat Cook Serve', 'Appetite Family Booking Good-manners', 'Garlic Herbs Bread Sauce', 'Waiter Chef Diners Manager']),
  place('playground', 'Playground', '🛝', 'Kid|Parent|Babysitter|Ice Cream Seller|Gardener|Football Player|Skater|Dog Walker', [
    'Giggling Squeaking Shouting Bouncing', 'Trainers Knee-pads Tracksuit Helmet', 'Swings Slides Sandpit Seesaw', 'Ice-lolly Fruit-snack Rice-cake Juice-box',
    'Swing Slide Climb Play', 'Ball Scooter Skipping-rope Chalk', 'Grass Flowers Sunscreen Rain', 'Parents Dogs Babysitters Toddlers']),
  place('toyshop', 'Toy shop', '🧸', 'Shopkeeper|Customer|Toy Tester|Toymaker|Cashier|Gift Wrapper|Kid|Grandparent', [
    'Squeaking Rattling Jingles Whirring', 'Name-badge Elf-hat Tiara Superhero-mask', 'Teddies Dolls Puzzles Games', 'Lollipop Chocolate-coins Jelly-beans Gobstopper',
    'Play Wrap Wish Test', 'Pocket-money Wishlist Birthday-money Piggy-bank', 'Plastic Cardboard Sweets Crayons', 'Shopkeeper Toymaker Grandparents Toy-testers']),
];
