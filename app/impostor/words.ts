export interface WordEntry {
  /** The secret word the crew receives. */
  word: string;
  /** Vague clues for the impostor — at least 3. One is shown at random each round. */
  hints: string[];
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  words: WordEntry[];
}

export const CATEGORIES: Category[] = [
  {
    id: "food",
    name: "Food & Drink",
    emoji: "🍕",
    words: [
      {
        word: "Pizza",
        hints: ["Something you order for a group", "Often delivered", "Has slices"],
      },
      {
        word: "Sushi",
        hints: ["Often eaten with chopsticks", "Served cold", "Japanese cuisine"],
      },
      {
        word: "Pancake",
        hints: ["A breakfast food", "Often stacked", "Goes with syrup"],
      },
      {
        word: "Coffee",
        hints: ["A morning drink", "Can be hot or iced", "Contains caffeine"],
      },
      {
        word: "Ice cream",
        hints: ["A cold dessert", "Comes in many flavors", "Melts quickly"],
      },
      {
        word: "Hamburger",
        hints: ["Fast food", "Has a bun", "Eaten with your hands"],
      },
      {
        word: "Spaghetti",
        hints: ["An Italian dish", "Long and thin", "Served with sauce"],
      },
      {
        word: "Popcorn",
        hints: ["A movie snack", "Made from a seed", "Comes in a bucket"],
      },
      {
        word: "Chocolate",
        hints: ["A sweet treat", "Often given as a gift", "Can melt"],
      },
      {
        word: "Watermelon",
        hints: ["A summer fruit", "Has seeds", "Mostly water"],
      },
    ],
  },
  {
    id: "animals",
    name: "Animals",
    emoji: "🦁",
    words: [
      {
        word: "Elephant",
        hints: ["A very large animal", "Has a long nose", "Never forgets"],
      },
      {
        word: "Penguin",
        hints: ["Lives somewhere cold", "A bird that can't fly", "Black and white"],
      },
      {
        word: "Dolphin",
        hints: ["Lives in the water", "Very intelligent", "Often seen jumping"],
      },
      {
        word: "Kangaroo",
        hints: ["An animal that jumps", "Carries young in a pouch", "From Australia"],
      },
      {
        word: "Owl",
        hints: ["Active at night", "Can turn its head far", "A bird of prey"],
      },
      {
        word: "Snake",
        hints: ["A reptile", "Has no legs", "Some are venomous"],
      },
      {
        word: "Butterfly",
        hints: ["A small flying creature", "Was once a caterpillar", "Has colorful wings"],
      },
      {
        word: "Tiger",
        hints: ["A wild predator", "Has stripes", "A big cat"],
      },
      {
        word: "Rabbit",
        hints: ["A common pet", "Has long ears", "Hops around"],
      },
      {
        word: "Shark",
        hints: ["A dangerous sea animal", "Has many teeth", "Has a fin"],
      },
    ],
  },
  {
    id: "places",
    name: "Places",
    emoji: "🌍",
    words: [
      {
        word: "Beach",
        hints: ["A place you go to relax", "Has sand", "Near the water"],
      },
      {
        word: "Hospital",
        hints: ["A building with staff in uniform", "You go when sick", "Has beds and machines"],
      },
      {
        word: "Airport",
        hints: ["A place full of travelers", "Has security checks", "People wait here"],
      },
      {
        word: "Library",
        hints: ["A quiet public place", "Full of books", "You borrow things here"],
      },
      {
        word: "Stadium",
        hints: ["A place for big crowds", "Has many seats", "Events happen here"],
      },
      {
        word: "Museum",
        hints: ["A place you visit to learn", "Has exhibits", "Things are on display"],
      },
      {
        word: "Restaurant",
        hints: ["A place you pay to be served", "Has a menu", "You eat here"],
      },
      {
        word: "School",
        hints: ["A place with daily routines", "Has classrooms", "You learn here"],
      },
      {
        word: "Mountain",
        hints: ["Somewhere outdoors", "Very tall", "People climb it"],
      },
      {
        word: "Cinema",
        hints: ["A place for entertainment", "It's dark inside", "Has a big screen"],
      },
    ],
  },
  {
    id: "objects",
    name: "Everyday Objects",
    emoji: "📦",
    words: [
      {
        word: "Umbrella",
        hints: ["Useful in bad weather", "Keeps you dry", "Opens and closes"],
      },
      {
        word: "Toothbrush",
        hints: ["A daily-use item", "Used in the bathroom", "Has bristles"],
      },
      {
        word: "Mirror",
        hints: ["Found in most homes", "You look into it", "Made of glass"],
      },
      {
        word: "Backpack",
        hints: ["Something you carry", "Has straps", "Holds your things"],
      },
      {
        word: "Candle",
        hints: ["Gives off light", "Has a wick", "Melts as it burns"],
      },
      {
        word: "Clock",
        hints: ["Tells you something", "Has hands or numbers", "On the wall"],
      },
      {
        word: "Pillow",
        hints: ["Found in a bedroom", "Soft", "You rest your head on it"],
      },
      {
        word: "Scissors",
        hints: ["A handheld tool", "Has two blades", "Used for cutting"],
      },
      {
        word: "Wallet",
        hints: ["Keeps things safe", "Fits in a pocket", "Holds cards and cash"],
      },
      {
        word: "Key",
        hints: ["Opens something", "Small and metal", "Goes in a lock"],
      },
    ],
  },
  {
    id: "movies",
    name: "Movies & Shows",
    emoji: "🎬",
    words: [
      {
        word: "Titanic",
        hints: ["A famous romance film", "Involves a ship", "Set on the ocean"],
      },
      {
        word: "Frozen",
        hints: ["An animated movie", "Has a famous song", "Involves ice and snow"],
      },
      {
        word: "Harry Potter",
        hints: ["Based on books", "Involves magic", "Set at a school"],
      },
      {
        word: "Star Wars",
        hints: ["A sci-fi franchise", "Set in space", "Has a famous villain"],
      },
      {
        word: "Avengers",
        hints: ["A superhero film", "Has a big team", "Lots of action"],
      },
      {
        word: "Jurassic Park",
        hints: ["Features creatures", "Set on an island", "Involves science gone wrong"],
      },
      {
        word: "The Lion King",
        hints: ["An animated classic", "Set in the wild", "Features animals"],
      },
      {
        word: "Spider-Man",
        hints: ["A superhero story", "Involves a teenager", "Has special powers"],
      },
      {
        word: "F.R.I.E.N.D.S.",
        hints: ["A long-running sitcom", "Set in a city", "About a group of people"],
      },
      {
        word: "Squid Game",
        hints: ["A survival show", "Involves games", "Has high stakes"],
      },
      {
        word: "The Office",
        hints: ["A workplace sitcom", "Filmed like a documentary", "Set at a company"],
      },
      {
        word: "The Big Bang Theory",
        hints: ["A sitcom about scientists", "Lots of nerdy humor", "Set in an apartment"],
      },
      {
        word: "The Simpsons",
        hints: ["An animated sitcom", "Has yellow characters", "Running for decades"],
      },
    ],
  },
  {
    id: "sports",
    name: "Sports",
    emoji: "⚽",
    words: [
      {
        word: "Football",
        hints: ["A team sport", "Played with your feet", "Has goals"],
      },
      {
        word: "Basketball",
        hints: ["Played with a ball", "Involves a hoop", "Lots of jumping"],
      },
      {
        word: "Tennis",
        hints: ["Played with a racket", "Played over a net", "Can be one-on-one"],
      },
      {
        word: "Swimming",
        hints: ["Done in water", "An Olympic sport", "Involves different strokes"],
      },
      {
        word: "Boxing",
        hints: ["A combat sport", "Uses gloves", "Fought in a ring"],
      },
      {
        word: "Golf",
        hints: ["An outdoor sport", "Uses clubs", "Aim for a hole"],
      },
      {
        word: "Cycling",
        hints: ["Involves a vehicle", "Uses two wheels", "Can be a race"],
      },
      {
        word: "Skiing",
        hints: ["A winter sport", "Done on snow", "Going downhill"],
      },
      {
        word: "Volleyball",
        hints: ["Played over a net", "Played with hands", "Often on a beach"],
      },
      {
        word: "Bowling",
        hints: ["An indoor activity", "Knock things down", "Roll a ball"],
      },
    ],
  },
  {
    id: "esports",
    name: "Esports",
    emoji: "🎮",
    words: [
      {
        word: "League of Legends",
        hints: ["A popular MOBA", "Played in two teams", "Has champions"],
      },
      {
        word: "Valorant",
        hints: ["A tactical shooter", "Has agents", "Plant or defuse"],
      },
      {
        word: "Fortnite",
        hints: ["A battle royale game", "You can build", "Last one standing wins"],
      },
      {
        word: "Overwatch",
        hints: ["A team-based shooter", "Has heroes", "Objective-based"],
      },
      {
        word: "Dota 2",
        hints: ["A MOBA", "Has a huge prize pool", "Two teams of five"],
      },
      {
        word: "CS:GO",
        hints: ["A competitive shooter", "Terrorists vs counters", "Buy weapons each round"],
      },
      {
        word: "PUBG",
        hints: ["A battle royale game", "Drop onto a map", "Shrinking play zone"],
      },
      {
        word: "Apex Legends",
        hints: ["A battle royale game", "Played in squads", "Has legends with abilities"],
      },
      {
        word: "Rainbow Six Siege",
        hints: ["A tactical shooter", "Attackers vs defenders", "Destructible walls"],
      },
      {
        word: "Call of Duty",
        hints: ["A first-person shooter", "A long-running series", "Has a campaign and multiplayer"],
      },
      {
        word: "FIFA",
        hints: ["A sports game", "About a popular sport", "Released yearly"],
      },
      {
        word: "Minecraft",
        hints: ["A sandbox game", "Made of blocks", "You can build anything"],
      },
      {
        word: "Roblox",
        hints: ["A sandbox platform", "Made of many games", "Popular with kids"],
      },
      {
        word: "Stumble Guys",
        hints: ["A party game", "Lots of players race", "Obstacle courses"],
      },
    ],
  },
];

export function randomWord(category: Category): WordEntry {
  return category.words[Math.floor(Math.random() * category.words.length)];
}

export function randomHint(entry: WordEntry): string {
  return entry.hints[Math.floor(Math.random() * entry.hints.length)];
}
