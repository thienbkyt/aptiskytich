// Listening question data types and mock data for Aptis Listening (4 parts)

// Part 1: Word Recognition – Listen to short audio, pick the word/phrase you hear
export interface ListeningPart1Question {
  id: number;
  audioUrl: string | null;
  questionText?: string;
  options: string[];
  correct: number;
  script?: string;
}

// Part 2: Matching Information – 4 speakers, match each to one of 6 info items
export interface ListeningPart2Person {
  name: string; // "A" | "B" | "C" | "D"
  audioUrl: string | null;
}

export interface ListeningPart2InfoItem {
  text: string;
  correctPerson: string; // "A" | "B" | "C" | "D" | "none"
}

export interface ListeningPart2Question {
  id: number;
  audioUrl: string | null;
  questionText: string;
  persons: ListeningPart2Person[];
  infoItems: ListeningPart2InfoItem[];
  script?: string;
}

// Part 3: Short Conversations – Two speakers, classify each statement (man/woman/both)
export interface ListeningPart3Statement {
  text: string;
  correctAnswer: string; // "man" | "woman" | "both"
}

export interface ListeningPart3Question {
  id: number;
  audioUrl: string | null;
  questionText: string;
  statements: ListeningPart3Statement[];
  script?: string;
}

// Part 4: Monologues – 2 clips, each with 1 audio + 2 MCQ questions
export interface ListeningPart4ClipQuestion {
  text: string;
  options: string[];
  correct: number;
}

export interface ListeningPart4Clip {
  id: number;
  audioUrl: string | null;
  questions: ListeningPart4ClipQuestion[];
  script?: string;
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
    questionText: "You will hear a conversation between a man and a woman about travelling. Who expresses which opinion?",
    statements: [
      { text: "Travelling by train is the most comfortable option.", correctAnswer: "man" },
      { text: "Flying is faster but more stressful.", correctAnswer: "woman" },
      { text: "Public transport in cities is usually reliable.", correctAnswer: "both" },
      { text: "Driving long distances can be tiring.", correctAnswer: "man" },
    ],
  },
];


// Mock data – Part 4
export const mockListeningPart4: ListeningPart4Clip[] = [
  {
    id: 1,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
    questions: [
      {
        text: "What is the main purpose of the talk?",
        options: ["To introduce a new product", "To explain company policy", "To announce a schedule change"],
        correct: 0,
      },
      {
        text: "According to the speaker, what is the advantage of the new system?",
        options: ["Lower cost", "Faster processing", "Better quality"],
        correct: 1,
      },
    ],
  },
  {
    id: 2,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3",
    questions: [
      {
        text: "When will the changes take effect?",
        options: ["Next week", "Next month", "In three months"],
        correct: 1,
      },
      {
        text: "What should employees do if they have questions?",
        options: ["Ask their manager", "Visit the website", "Send an email to HR"],
        correct: 2,
      },
    ],
  },
];

