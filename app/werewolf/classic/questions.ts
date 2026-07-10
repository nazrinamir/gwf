export interface VillagerPrompt {
  question: string;
  choices: string[];
}

/** Simple daily-life prompts — pick an answer, get a weird reaction. */
export const VILLAGER_PROMPTS: VillagerPrompt[] = [
  {
    question: "What is your favourite food?",
    choices: ["Rice", "Noodles", "Pizza", "Chicken", "Salad"],
  },
  {
    question: "What do you usually eat for breakfast?",
    choices: ["Bread", "Eggs", "Cereal", "Coffee only", "Leftovers"],
  },
  {
    question: "How do you take your coffee or tea?",
    choices: ["Black", "With milk", "Sweet", "Iced", "I don't drink it"],
  },
  {
    question: "What time do you usually wake up?",
    choices: ["Before 6", "6–7", "7–8", "8–9", "Whenever"],
  },
  {
    question: "How do you get around most days?",
    choices: ["Walk", "Bus", "Car", "Bike", "Stay home"],
  },
  {
    question: "What is your favourite drink?",
    choices: ["Water", "Juice", "Soda", "Milk tea", "Coffee"],
  },
  {
    question: "Where do you usually eat lunch?",
    choices: ["Home", "Office", "Restaurant", "Street food", "Skip lunch"],
  },
  {
    question: "What do you do after work or school?",
    choices: ["Rest", "Exercise", "Cook", "Scroll phone", "Hang out"],
  },
  {
    question: "What is your favourite snack?",
    choices: ["Chips", "Fruit", "Chocolate", "Nuts", "Biscuits"],
  },
  {
    question: "How do you like your eggs?",
    choices: ["Fried", "Scrambled", "Boiled", "Omelette", "No eggs"],
  },
  {
    question: "What weather do you like best?",
    choices: ["Sunny", "Rainy", "Cloudy", "Cool breeze", "Cold"],
  },
  {
    question: "What do you usually cook at home?",
    choices: ["Soup", "Stir-fry", "Pasta", "Rice dishes", "I order in"],
  },
  {
    question: "When do you usually go to sleep?",
    choices: ["Before 10", "10–11", "11–12", "After midnight", "No idea"],
  },
  {
    question: "What is your favourite fruit?",
    choices: ["Apple", "Banana", "Mango", "Orange", "Grapes"],
  },
  {
    question: "How spicy do you like your food?",
    choices: ["No spice", "Mild", "Medium", "Hot", "Extra hot"],
  },
];

export const WEIRD_ANSWER_LINE = "Hmmm very weird answer";

export function randomVillagerPrompt(): VillagerPrompt {
  return VILLAGER_PROMPTS[
    Math.floor(Math.random() * VILLAGER_PROMPTS.length)
  ]!;
}
