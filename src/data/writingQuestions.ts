// Writing Part types and mock data

// Part 1: Short answers — answer 5 questions with 1-5 words
export interface WritingPart1Data {
  type: "short-answers";
  instruction: string;
  questions: { id: number; text: string; sampleAnswer: string }[];
}

// Part 2: Social media response — write ~25 words responding to a post
export interface WritingPart2Data {
  type: "social-media";
  instruction: string;
  socialPost: { author: string; content: string };
  promptQuestions: string[];
  wordLimit: number;
  sampleAnswer: string;
}

// Part 3: Three questions — each answer 30-40 words
export interface WritingPart3Data {
  type: "three-questions";
  instruction: string;
  questions: { id: number; text: string; sampleAnswer: string }[];
  wordLimit: number; // per question (e.g. 40)
}

// Part 4: Two emails — informal + formal combined
export interface WritingPart4Data {
  type: "two-emails";
  instruction: string;
  informalEmail: {
    label: string;
    scenario: string;
    bulletPoints: string[];
    wordLimit: number;
    sampleAnswer: string;
  };
  formalEmail: {
    label: string;
    scenario: string;
    bulletPoints: string[];
    wordLimit: number;
    sampleAnswer: string;
  };
}

export type WritingPartData = WritingPart1Data | WritingPart2Data | WritingPart3Data | WritingPart4Data;

// Mock data
export const mockWritingPart1: WritingPart1Data[] = [
  {
    type: "short-answers",
    instruction: "Answer the following questions. Write between 1 and 5 words for each answer.",
    questions: [
      { id: 1, text: "What is your favourite season?", sampleAnswer: "I like summer best." },
      { id: 2, text: "What do you usually eat for breakfast?", sampleAnswer: "Bread and eggs." },
      { id: 3, text: "How do you get to work or school?", sampleAnswer: "I take the bus." },
      { id: 4, text: "What is the last book you read?", sampleAnswer: "Harry Potter." },
      { id: 5, text: "What do you like to do on weekends?", sampleAnswer: "I go jogging." },
    ],
  },
];

export const mockWritingPart2: WritingPart2Data[] = [
  {
    type: "social-media",
    instruction: "Read the social media post below and write a response. Use about 20-30 words.",
    socialPost: {
      author: "TravelBug_Jenny",
      content: "Just booked my flight to Japan! 🇯🇵 So excited for cherry blossom season. Has anyone been? Any tips?",
    },
    promptQuestions: [
      "Have you been to Japan or would you like to go?",
      "Give Jenny a tip or share your opinion.",
    ],
    wordLimit: 30,
    sampleAnswer: "Hi Jenny! I haven't been to Japan yet, but it's on my bucket list. I've heard Kyoto is amazing during cherry blossom season. Have a great trip!",
  },
];

export const mockWritingPart3: WritingPart3Data[] = [
  {
    type: "three-questions",
    instruction: "Answer the following three questions. Write between 30 and 40 words for each answer. Your answers should be relevant, grammatically correct, and logically connected.",
    questions: [
      {
        id: 1,
        text: "Do you think it is important to learn a foreign language? Why or why not?",
        sampleAnswer: "Yes, I believe learning a foreign language is very important. It helps us communicate with people from different countries and opens up more job opportunities. It also allows us to understand other cultures better.",
      },
      {
        id: 2,
        text: "What is the best way to learn a new language?",
        sampleAnswer: "In my opinion, the best way to learn a new language is to practise speaking every day. You should also watch films and read books in that language to improve your vocabulary naturally.",
      },
      {
        id: 3,
        text: "How has technology changed the way people learn languages?",
        sampleAnswer: "Technology has made language learning much easier and more accessible. People can now use apps, watch online videos, and join virtual classes from anywhere in the world, which was not possible before.",
      },
    ],
    wordLimit: 40,
  },
];

export const mockWritingPart4: WritingPart4Data[] = [
  {
    type: "two-emails",
    instruction: "Write two emails based on the scenarios below. The first is an informal email (~50 words) and the second is a formal email (~120-150 words).",
    informalEmail: {
      label: "Informal Email (~50 words)",
      scenario: "You are organising a surprise birthday party for your friend Tom. Write an email to another friend to invite them.",
      bulletPoints: [
        "When and where the party is",
        "What to bring",
        "Ask them to keep it a secret",
      ],
      wordLimit: 50,
      sampleAnswer: "Hi Sarah,\n\nI'm organising a surprise birthday party for Tom this Saturday at 7pm at my house. Could you bring some snacks or drinks? Please don't tell Tom — it's a surprise!\n\nHope you can make it!\nAnna",
    },
    formalEmail: {
      label: "Formal Email (~120-150 words)",
      scenario: "You recently stayed at the Grand Hotel and experienced several problems. Write a formal email to the hotel manager to complain.",
      bulletPoints: [
        "Explain when you stayed and what room you had",
        "Describe the problems you experienced",
        "Say what you would like the hotel to do",
      ],
      wordLimit: 150,
      sampleAnswer: "Dear Sir/Madam,\n\nI am writing to express my dissatisfaction with my recent stay at the Grand Hotel from 15-17 March. I was booked into Room 305.\n\nUnfortunately, I experienced several issues during my stay. Firstly, the room was not clean when I arrived — there were used towels on the floor and the bed had not been made. Secondly, the air conditioning was not working properly, making it very uncomfortable to sleep. Additionally, the breakfast service was extremely slow, and the food was cold.\n\nI would appreciate it if you could offer a partial refund or a complimentary stay to make up for these problems. I have always enjoyed staying at your hotel and hope this was an isolated incident.\n\nI look forward to hearing from you.\n\nYours faithfully,\nJohn Smith",
    },
  },
];
