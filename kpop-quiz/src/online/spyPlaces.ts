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
    'Trumpets Hooves Clanking Lutes', 'Crown Armour Cape Gown', 'Towers Moat Throne Banners', 'Feast Pie Grapes Bread',
    'Joust Bow Guard Dance', 'Sword Shield Gift Scroll', 'Torches Stone Roast Stables', 'King Knight Jester Princess']),
  place('zoo', 'Zoo', '🦁', 'Zookeeper|Vet|Tour Guide|Ice Cream Seller|Visitor|Photographer|Penguin Keeper|Gift Shop Helper', [
    'Roaring Squawking Chattering Trumpeting', 'Cap Shorts Trainers Sunglasses', 'Giraffes Lions Penguins Enclosures', 'Popcorn Ice-lolly Sandwiches Crisps',
    'Watch Feed Snap Explore', 'Camera Map Binoculars Snacks', 'Hay Straw Mud Animals', 'Zookeeper Monkeys Lions Visitors']),
  place('space', 'Space station', '🚀', 'Commander|Astronaut|Engineer|Scientist|Pilot|Space Chef|Robot Helper|Doctor', [
    'Beeping Humming Buzzing Countdown', 'Spacesuit Helmet Jumpsuit Gloves', 'Earth Stars Planets Satellites', 'Tortillas Pouches Nuts Crackers',
    'Float Experiment Spacewalk Exercise', 'Camera Notebook Tools Photos', 'Metal Nothing Machines Plastic', 'Astronauts Commander Robots Scientists']),
  place('bakery', 'Bakery', '🥐', 'Baker|Cake Decorator|Cashier|Delivery Driver|Customer|Apprentice|Bread Taster|Cleaner', [
    'Ovens Mixers Doorbell Chatter', 'Apron Hairnet Chef-hat Oven-gloves', 'Cakes Bread Ovens Flour', 'Croissant Cupcake Doughnut Bun',
    'Bake Knead Decorate Queue', 'Wallet Bag Basket Order', 'Bread Cinnamon Sugar Butter', 'Baker Customers Decorator Cashier']),
  place('pirate', 'Pirate ship', '🏴‍☠️', 'Captain|First Mate|Lookout|Ship Cook|Deckhand|Navigator|Parrot Keeper|Cabin Helper', [
    'Waves Seagulls Creaking Shanties', 'Eyepatch Bandana Tricorn Boots', 'Sails Ocean Treasure Flag', 'Biscuits Fish Oranges Coconut',
    'Sail Steer Climb Swab', 'Map Telescope Compass Shovel', 'Salt Seaweed Tar Fish', 'Captain Parrot Crew Mermaid']),
  place('library', 'School library', '📚', 'Librarian|Student|Teacher|Book Club Leader|Visiting Author|Library Helper|Reader|Storyteller', [
    'Whispers Shushing Pages Scanner', 'Uniform Glasses Jumper Lanyard', 'Shelves Books Computers Posters', 'Nothing Mints Water Raisins',
    'Read Borrow Study Research', 'Card Bookbag Pencil Notebook', 'Paper Books Dust Pencils', 'Librarian Classmates Author Teacher']),
  place('beach', 'Beach', '🏖️', 'Lifeguard|Surfer|Ice Cream Seller|Sandcastle Builder|Swimmer|Fisher|Sunbather|Beach Cleaner', [
    'Waves Seagulls Laughter Splashing', 'Swimsuit Sunhat Flip-flops Sunglasses', 'Sand Sea Shells Umbrellas', 'Ice-lolly Sandwiches Watermelon Chips',
    'Swim Surf Paddle Sunbathe', 'Towel Bucket Spade Sunscreen', 'Salt Sunscreen Seaweed Chips', 'Lifeguard Surfers Crabs Seagulls']),
  place('farm', 'Farm', '🚜', 'Farmer|Tractor Driver|Shepherd|Vet|Egg Collector|Scarecrow|Sheepdog|Visitor', [
    'Mooing Oinking Clucking Tractors', 'Wellies Overalls Hat Gloves', 'Barn Fields Cows Haystacks', 'Eggs Apples Cheese Carrots',
    'Plough Milk Harvest Feed', 'Bucket Pitchfork Boots Seeds', 'Hay Mud Grass Animals', 'Farmer Sheepdog Chickens Cows']),
  place('hospital', 'Hospital', '🏥', 'Doctor|Nurse|Patient|Surgeon|Visitor|Receptionist|Porter|Paramedic', [
    'Beeping Footsteps Pagers Sirens', 'Gown Scrubs Mask Wristband', 'Beds Wheelchairs Monitors Bandages', 'Jelly Grapes Soup Toast',
    'Rest Heal Visit Check-up', 'Flowers Card Pyjamas Grapes', 'Soap Disinfectant Flowers Coffee', 'Doctor Nurse Patients Visitors']),
  place('circus', 'Circus', '🎪', 'Ringmaster|Clown|Acrobat|Juggler|Tightrope Walker|Popcorn Seller|Trapeze Artist|Unicyclist', [
    'Drumroll Cheering Laughing Honking', 'Costume Sequins Red-nose Top-hat', 'Tent Ring Trapeze Spotlights', 'Popcorn Candyfloss Peanuts Hotdog',
    'Juggle Clap Tumble Perform', 'Ticket Camera Friends Balloon', 'Popcorn Sawdust Sugar Candyfloss', 'Ringmaster Clowns Acrobats Jugglers']),
  place('supermarket', 'Supermarket', '🛒', 'Cashier|Shelf Stacker|Shopper|Manager|Baker|Security Guard|Delivery Driver|Trolley Collector', [
    'Beeping Announcements Trolleys Chatter', 'Coat Uniform Badge Trainers', 'Aisles Trolleys Shelves Tills', 'Samples Bread Fruit Biscuits',
    'Shop Queue Pay Stack', 'List Bags Wallet Coupons', 'Bread Fruit Coffee Flowers', 'Cashier Shoppers Manager Neighbours']),
  place('pool', 'Swimming pool', '🏊', 'Lifeguard|Swimmer|Diver|Coach|Swim Teacher|Toddler|Snack Seller|Pool Cleaner', [
    'Splashing Whistles Echoes Giggles', 'Goggles Swimsuit Cap Armbands', 'Water Lanes Diving-board Slides', 'Crisps Chocolate Banana Flapjack',
    'Swim Dive Float Race', 'Towel Shampoo Floats Flip-flops', 'Chlorine Shampoo Soap Water', 'Lifeguard Swimmers Coach Divers']),
  place('cinema', 'Cinema', '🎬', 'Usher|Ticket Seller|Projectionist|Film Fan|Snack Seller|Film Critic|Manager|Cleaner', [
    'Soundtrack Crunching Laughter Shushing', 'Glasses Hoodie Jumper Coat', 'Screen Seats Trailers Darkness', 'Popcorn Nachos Sweets Slushie',
    'Watch Laugh Munch Whisper', 'Ticket Snacks Friends Tissues', 'Popcorn Butter Nachos Sweets', 'Usher Friends Fans Critics']),
  place('airport', 'Airport', '✈️', 'Pilot|Flight Attendant|Passenger|Security Officer|Baggage Handler|Air Traffic Controller|Check-in Clerk|Shop Assistant', [
    'Engines Announcements Wheels Beeping', 'Uniform Headphones Backpack Neck-pillow', 'Planes Runway Suitcases Gates', 'Sandwich Pretzel Crisps Muffin',
    'Fly Wait Check-in Board', 'Passport Suitcase Ticket Headphones', 'Fuel Coffee Perfume Pastries', 'Pilot Passengers Guards Crew']),
  place('campsite', 'Campsite', '⛺', 'Camp Leader|Camper|Scout|Park Ranger|Fire Builder|Camp Cook|Hiker|Birdwatcher', [
    'Owls Crickets Crackling Rustling', 'Wellies Raincoat Hoodie Headtorch', 'Tents Campfire Trees Stars', 'Marshmallows Sausages Beans Toast',
    'Hike Camp Explore Sing', 'Sleeping-bag Torch Tent Compass', 'Smoke Pine Grass Rain', 'Ranger Scouts Campers Squirrels']),
  place('aquarium', 'Aquarium', '🐠', 'Diver|Fish Keeper|Visitor|Guide|Shark Expert|Photographer|Sea Scientist|Ticket Seller', [
    'Bubbles Pumps Splashing Gasps', 'Wetsuit Lanyard Jacket Trainers', 'Tanks Sharks Jellyfish Turtles', 'Sandwich Crisps Cookie Raisins',
    'Watch Learn Point Photograph', 'Camera Guidebook Ticket Notebook', 'Water Salt Fish Seaweed', 'Sharks Divers Guides Turtles']),
  place('train', 'Train', '🚂', 'Train Driver|Conductor|Passenger|Ticket Inspector|Snack Trolley Server|Engineer|Commuter|Tourist', [
    'Clatter Whistle Announcements Horn', 'Coat Scarf Headphones Backpack', 'Fields Stations Tracks Windows', 'Sandwich Crisps Tea Chocolate',
    'Travel Read Nap Look', 'Ticket Book Suitcase Snacks', 'Coffee Diesel Sandwiches Steam', 'Conductor Driver Passengers Commuters']),
  place('firestation', 'Fire station', '🚒', 'Firefighter|Fire Chief|Engine Driver|Dispatcher|Dalmatian|Trainee|Mechanic|Visitor', [
    'Sirens Alarms Engines Radios', 'Helmet Boots Jacket Gloves', 'Ladders Hoses Trucks Pole', 'Chili Pizza Sandwiches Pasta',
    'Train Rescue Polish Practise', 'Radio Torch Hose Map', 'Smoke Rubber Diesel Polish', 'Firefighters Chief Dalmatian Trainees']),
  place('ski', 'Ski resort', '⛷️', 'Ski Instructor|Skier|Snowboarder|Lift Operator|Hot Chocolate Seller|Mountain Rescuer|Hotel Manager|Snowplough Driver', [
    'Swishing Wind Crunching Laughing', 'Goggles Gloves Salopettes Beanie', 'Snow Mountains Lifts Slopes', 'Fondue Soup Waffles Cocoa',
    'Ski Snowboard Sledge Slide', 'Skis Poles Sledge Scarf', 'Pine Snow Cocoa Woodsmoke', 'Instructor Skiers Snowboarders Rescuers']),
  place('jungle', 'Jungle', '🌴', 'Explorer|Jungle Guide|Scientist|Photographer|Bird Watcher|Map Maker|Plant Expert|Camp Cook', [
    'Parrots Monkeys Rain Frogs', 'Hat Boots Shorts Poncho', 'Vines Trees Parrots Waterfalls', 'Bananas Mangoes Coconuts Nuts',
    'Explore Climb Trek Swing', 'Map Binoculars Water Compass', 'Flowers Mud Rain Leaves', 'Monkeys Toucans Explorers Sloths']),
  place('museum', 'Museum', '🏛️', 'Curator|Tour Guide|Security Guard|Visitor|Historian|Artist|Gift Shop Seller|Cleaner', [
    'Footsteps Whispers Echoes Guides', 'Lanyard Jacket Trainers Badge', 'Dinosaurs Paintings Statues Fossils', 'Scone Sandwich Muffin Cake',
    'Look Learn Wander Sketch', 'Camera Map Sketchbook Ticket', 'Dust Polish Wood Paper', 'Curator Guide Guards Tourists']),
  place('restaurant', 'Restaurant', '🍝', 'Chef|Waiter|Customer|Manager|Dishwasher|Food Critic|Host|Sous Chef', [
    'Clinking Sizzling Chatter Music', 'Apron Dress Shirt Bowtie', 'Tables Menus Candles Plates', 'Pasta Pizza Soup Dessert',
    'Order Eat Cook Serve', 'Wallet Appetite Family Friends', 'Garlic Herbs Bread Sauce', 'Waiter Chef Diners Manager']),
  place('playground', 'Playground', '🛝', 'Kid|Parent|Babysitter|Ice Cream Seller|Gardener|Football Player|Skater|Dog Walker', [
    'Giggling Squeaking Birds Chatter', 'Trainers Jeans Coat Cap', 'Swings Slides Sandpit Seesaw', 'Lolly Apple Crisps Raisins',
    'Swing Slide Climb Play', 'Ball Scooter Skipping-rope Water', 'Grass Flowers Sunscreen Rain', 'Friends Parents Dogs Kids']),
  place('toyshop', 'Toy shop', '🧸', 'Shopkeeper|Customer|Toy Tester|Toymaker|Cashier|Gift Wrapper|Kid|Grandparent', [
    'Beeping Squeaking Music Rattling', 'Badge Apron Coat Hat', 'Teddies Dolls Puzzles Games', 'Lollipop Sweets Chocolate Biscuit',
    'Browse Play Buy Wrap', 'Wallet Money Wishlist Bag', 'Plastic Cardboard Sweets Crayons', 'Shopkeeper Kids Grandparents Toymaker']),
];
