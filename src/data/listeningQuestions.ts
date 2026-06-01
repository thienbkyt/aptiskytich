// Listening question data types and mock data for Aptis Listening (4 parts)

// Part 1: Word Recognition – Listen to short audio, pick the word/phrase you hear
export interface ListeningPart1Question {
  id: number;
  audioUrl: string;
  questionText?: string;
  options: string[];
  correct: number;
}

// Part 2: Matching Information – 4 speakers, match each to one of 6 info items
export interface ListeningPart2Person {
  name: string; // "A" | "B" | "C" | "D"
  audioUrl: string;
}

export interface ListeningPart2InfoItem {
  text: string;
  correctPerson: string; // "A" | "B" | "C" | "D" | "none"
}

export interface ListeningPart2Question {
  id: number;
  audioUrl: string;
  questionText: string;
  persons: ListeningPart2Person[];
  infoItems: ListeningPart2InfoItem[];
}

// Part 3: Short Conversations – Listen to a dialogue, answer MCQ
export interface ListeningPart3Question {
  id: number;
  audioUrl: string;
  questionText: string;
  options: string[];
  correct: number;
}

// Part 4: Monologues – Listen to a longer recording, answer MCQ
export interface ListeningPart4Question {
  id: number;
  audioUrl: string;
  questionText: string;
  options: string[];
  correct: number;
}

// Mock data – Part 1
export const mockListeningPart1: ListeningPart1Question[] = [
  {
    id: 1,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    options: ["appointment", "apartment", "agreement", "arrangement"],
    correct: 0,
  },
  {
    id: 2,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    options: ["schedule", "school", "scholar", "sculpture"],
    correct: 0,
  },
  {
    id: 3,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    options: ["environment", "entertainment", "engagement", "encouragement"],
    correct: 0,
  },
  {
    id: 4,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    options: ["temperature", "temporary", "temptation", "tendency"],
    correct: 1,
  },
  {
    id: 5,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    options: ["necessary", "negative", "negotiate", "neighbour"],
    correct: 2,
  },
];

// Mock data – Part 2
export const mockListeningPart2: ListeningPart2Question[] = [
  {
    id: 1,
    audioUrl: "",
    questionText: "Four people are talking about science. Complete the sentences below.",
    persons: [
      { name: "A", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
      { name: "B", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
      { name: "C", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
      { name: "D", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
    ],
    infoItems: [
      { text: "enjoyed science experiments at school.", correctPerson: "A" },
      { text: "finds science difficult to understand.", correctPerson: "B" },
      { text: "wants to study science.", correctPerson: "C" },
      { text: "likes reading science books.", correctPerson: "D" },
      { text: "preferred non-science school subjects.", correctPerson: "none" },
      { text: "now enjoys science.", correctPerson: "none" },
    ],
  },
];

// Mock data – Part 3
export const mockListeningPart3: ListeningPart3Question[] = [
  {
    id: 1,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
    questionText: "Why is the woman calling?",
    options: ["To make an appointment", "To cancel an order", "To ask for directions", "To complain about service"],
    correct: 0,
  },
  {
    id: 2,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
    questionText: "What does the man suggest?",
    options: ["Going to a restaurant", "Cooking at home", "Ordering delivery", "Skipping dinner"],
    correct: 2,
  },
  {
    id: 3,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3",
    questionText: "What problem do they discuss?",
    options: ["Traffic congestion", "A broken machine", "A delayed flight", "A missing document"],
    correct: 3,
  },
  {
    id: 4,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3",
    questionText: "What will the speakers do next?",
    options: ["Go to the library", "Visit a friend", "Call the office", "Send an email"],
    correct: 1,
  },
  {
    id: 5,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3",
    questionText: "How does the woman feel?",
    options: ["Excited", "Worried", "Bored", "Angry"],
    correct: 1,
  },
];

// Mock data – Part 4
export const mockListeningPart4: ListeningPart4Question[] = [
  {
    id: 1,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
    questionText: "What is the main purpose of the talk?",
    options: ["To introduce a new product", "To explain company policy", "To announce a schedule change", "To report financial results"],
    correct: 0,
  },
  {
    id: 2,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
    questionText: "According to the speaker, what is the advantage of the new system?",
    options: ["Lower cost", "Faster processing", "Better quality", "Easier maintenance"],
    correct: 1,
  },
  {
    id: 3,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
    questionText: "When will the changes take effect?",
    options: ["Next week", "Next month", "In three months", "Next year"],
    correct: 1,
  },
  {
    id: 4,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
    questionText: "What should employees do if they have questions?",
    options: ["Ask their manager", "Visit the website", "Send an email to HR", "Attend a meeting"],
    correct: 2,
  },
  {
    id: 5,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
    questionText: "What does the speaker say about training?",
    options: ["It's optional", "It starts immediately", "It will be provided online", "It's only for managers"],
    correct: 2,
  },
];
