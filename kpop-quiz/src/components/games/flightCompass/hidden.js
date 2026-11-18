// Flight Compass by the family (azzbr/flight-compass), brought into Fun Quest as an ES module.
// Flight Compass — content kept out of the game for now, to be revealed later.
//
// Listed countries are removed from play: their cities are never targets or start
// cities, and their country and town names are not labelled on the map. The land
// itself is still drawn.
//
// To reveal a country, delete its entry below (or empty the list). Kept the same as the family's game.
  const HIDDEN = {
    countries: [
      // a3: Natural Earth code (cities, place labels); id: ISO numeric code (map country names)
      { a3: 'ISR', id: '376' },
    ],
  };
  export default HIDDEN;
