export interface WordEntry {
  /** The secret word the crew receives. */
  word: string;
  /** A vague clue the impostor receives instead of the word. */
  hint: string;
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
      { word: "Pizza", hint: "Something you order for a group" },
      { word: "Sushi", hint: "Often eaten with chopsticks" },
      { word: "Pancake", hint: "A breakfast food" },
      { word: "Coffee", hint: "A morning drink" },
      { word: "Ice cream", hint: "A cold dessert" },
      { word: "Hamburger", hint: "Fast food" },
      { word: "Spaghetti", hint: "An Italian dish" },
      { word: "Popcorn", hint: "A movie snack" },
      { word: "Chocolate", hint: "A sweet treat" },
      { word: "Watermelon", hint: "A summer fruit" },
    ],
  },
  {
    id: "animals",
    name: "Animals",
    emoji: "🦁",
    words: [
      { word: "Elephant", hint: "A very large animal" },
      { word: "Penguin", hint: "Lives somewhere cold" },
      { word: "Dolphin", hint: "Lives in the water" },
      { word: "Kangaroo", hint: "An animal that jumps" },
      { word: "Owl", hint: "Active at night" },
      { word: "Snake", hint: "A reptile" },
      { word: "Butterfly", hint: "A small flying creature" },
      { word: "Tiger", hint: "A wild predator" },
      { word: "Rabbit", hint: "A common pet" },
      { word: "Shark", hint: "A dangerous sea animal" },
    ],
  },
  {
    id: "places",
    name: "Places",
    emoji: "🌍",
    words: [
      { word: "Beach", hint: "A place you go to relax" },
      { word: "Hospital", hint: "A building with staff in uniform" },
      { word: "Airport", hint: "A place full of travelers" },
      { word: "Library", hint: "A quiet public place" },
      { word: "Stadium", hint: "A place for big crowds" },
      { word: "Museum", hint: "A place you visit to learn" },
      { word: "Restaurant", hint: "A place you pay to be served" },
      { word: "School", hint: "A place with daily routines" },
      { word: "Mountain", hint: "Somewhere outdoors" },
      { word: "Cinema", hint: "A place for entertainment" },
    ],
  },
  {
    id: "objects",
    name: "Everyday Objects",
    emoji: "📦",
    words: [
      { word: "Umbrella", hint: "Useful in bad weather" },
      { word: "Toothbrush", hint: "A daily-use item" },
      { word: "Mirror", hint: "Found in most homes" },
      { word: "Backpack", hint: "Something you carry" },
      { word: "Candle", hint: "Gives off light" },
      { word: "Clock", hint: "Tells you something" },
      { word: "Pillow", hint: "Found in a bedroom" },
      { word: "Scissors", hint: "A handheld tool" },
      { word: "Wallet", hint: "Keeps things safe" },
      { word: "Key", hint: "Opens something" },
    ],
  },
  {
    id: "movies",
    name: "Movies & Shows",
    emoji: "🎬",
    words: [
      { word: "Titanic", hint: "A famous romance film" },
      { word: "Frozen", hint: "An animated movie" },
      { word: "Harry Potter", hint: "Based on books" },
      { word: "Star Wars", hint: "A sci-fi franchise" },
      { word: "Avengers", hint: "A superhero film" },
      { word: "Jurassic Park", hint: "Features creatures" },
      { word: "The Lion King", hint: "An animated classic" },
      { word: "Spider-Man", hint: "A superhero story" },
      { word: "Friends", hint: "A long-running sitcom" },
      { word: "Squid Game", hint: "A survival show" },
    ],
  },
  {
    id: "sports",
    name: "Sports",
    emoji: "⚽",
    words: [
      { word: "Football", hint: "A team sport" },
      { word: "Basketball", hint: "Played with a ball" },
      { word: "Tennis", hint: "Played with a racket" },
      { word: "Swimming", hint: "Done in water" },
      { word: "Boxing", hint: "A combat sport" },
      { word: "Golf", hint: "An outdoor sport" },
      { word: "Cycling", hint: "Involves a vehicle" },
      { word: "Skiing", hint: "A winter sport" },
      { word: "Volleyball", hint: "Played over a net" },
      { word: "Bowling", hint: "An indoor activity" },
    ],
  },
];

export function randomWord(category: Category): WordEntry {
  return category.words[Math.floor(Math.random() * category.words.length)];
}
