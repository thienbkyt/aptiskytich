import type { Question, GapFillQuestion } from "@/data/questions";

// Part 1: Sentence comprehension — read sentence, pick correct meaning (MCQ)
export interface ReadingSentenceQuestion {
  id: number;
  type: "sentence-comprehension";
  sentence: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

// Part 2: Text cohesion — fill in missing sentences to complete a text
export interface ReadingCohesionQuestion {
  id: number;
  type: "text-cohesion";
  passage: string; // with {0}, {1}... placeholders for missing sentences
  instruction: string;
  sentenceOptions: string[]; // pool of sentences to choose from
  gaps: { correct: number }[]; // correct sentence index for each gap
  explanation: string;
}

// Part 3: Opinion matching — match opinions to people
export interface ReadingOpinionQuestion {
  id: number;
  type: "opinion-matching";
  instruction: string;
  people: { name: string; text: string }[];
  statements: { text: string; correctPerson: number }[];
  explanation: string;
}

// Part 4: Long reading — read long text, answer MCQ
export interface ReadingLongQuestion {
  id: number;
  type: "long-reading";
  passage: string;
  instruction: string;
  questions: { text: string; options: string[]; correct: number }[];
  explanation: string;
}

export type ReadingPartQuestion =
  | ReadingSentenceQuestion
  | ReadingCohesionQuestion
  | ReadingOpinionQuestion
  | ReadingLongQuestion;

// Mock data for each part
export const mockPart1Questions: ReadingSentenceQuestion[] = [
  {
    id: 1,
    type: "sentence-comprehension",
    sentence: "The manager decided to postpone the meeting until further notice.",
    question: "What does this sentence mean?",
    options: [
      "The meeting was cancelled permanently.",
      "The meeting will happen at a later, unspecified time.",
      "The meeting is happening right now.",
      "The manager forgot about the meeting.",
    ],
    correct: 1,
    explanation: "'Postpone until further notice' nghĩa là hoãn lại đến khi có thông báo mới.",
  },
  {
    id: 2,
    type: "sentence-comprehension",
    sentence: "She couldn't help but laugh at the comedian's jokes.",
    question: "What does this sentence mean?",
    options: [
      "She refused to laugh.",
      "She found it impossible not to laugh.",
      "She helped the comedian.",
      "She was not amused.",
    ],
    correct: 1,
    explanation: "'Couldn't help but + V' nghĩa là không thể ngăn bản thân làm điều gì.",
  },
  {
    id: 3,
    type: "sentence-comprehension",
    sentence: "The new policy will come into effect at the beginning of next month.",
    question: "What does this sentence tell us?",
    options: [
      "The policy has already started.",
      "The policy will start next month.",
      "The policy was rejected.",
      "The policy ends next month.",
    ],
    correct: 1,
    explanation: "'Come into effect' = bắt đầu có hiệu lực.",
  },
  {
    id: 4,
    type: "sentence-comprehension",
    sentence: "He takes after his mother in many ways.",
    question: "What does this sentence mean?",
    options: [
      "He follows his mother everywhere.",
      "He is similar to his mother.",
      "He takes care of his mother.",
      "He runs after his mother.",
    ],
    correct: 1,
    explanation: "'Take after someone' = giống ai đó (về tính cách, ngoại hình).",
  },
  {
    id: 5,
    type: "sentence-comprehension",
    sentence: "The restaurant is second to none when it comes to seafood.",
    question: "What does this sentence mean?",
    options: [
      "The restaurant is the second best for seafood.",
      "The restaurant is the best for seafood.",
      "The restaurant doesn't serve seafood.",
      "The restaurant is not good at seafood.",
    ],
    correct: 1,
    explanation: "'Second to none' = tốt nhất, không ai sánh bằng.",
  },
];

export const mockPart2Questions: ReadingCohesionQuestion[] = [
  {
    id: 10,
    type: "text-cohesion",
    instruction: "Read the text below. Choose the correct sentence from the list to fill each gap.",
    passage: `The city of Bath is one of the most popular tourist destinations in England.

{0}

The Romans built a temple and bathing complex here nearly 2,000 years ago.

{1}

Today, visitors can explore the Roman Baths museum and enjoy the natural hot springs.

{2}

The city is also famous for its beautiful Georgian architecture.`,
    sentenceOptions: [
      "It is known for its natural hot springs and Roman history.",
      "The baths fell into disrepair after the Romans left Britain.",
      "Every year, over a million tourists visit the city.",
      "The weather in Bath is typically mild and pleasant.",
    ],
    gaps: [{ correct: 0 }, { correct: 1 }, { correct: 2 }],
    explanation: "Các câu cần được sắp xếp theo logic: giới thiệu → lịch sử → hiện tại.",
  },
];

export const mockPart3Questions: ReadingOpinionQuestion[] = [
  {
    id: 20,
    type: "opinion-matching",
    instruction: "Read the texts from four people about working from home. Then match each statement to the correct person.",
    people: [
      {
        name: "Anna",
        text: "I love working from home because I can manage my own schedule. I'm more productive when I don't have to commute. However, I sometimes miss the social interaction with colleagues.",
      },
      {
        name: "Ben",
        text: "Working from home has been challenging for me. I find it hard to separate work and personal life. My home office is in the living room, so there are constant distractions from my family.",
      },
      {
        name: "Clara",
        text: "I prefer a hybrid model — working from home three days and going to the office twice a week. This gives me the best of both worlds: flexibility and face-to-face collaboration.",
      },
      {
        name: "David",
        text: "I think working from home is the future. Companies should invest in better remote working tools. The traditional office is outdated and unnecessary for most knowledge workers.",
      },
    ],
    statements: [
      { text: "This person thinks offices are no longer needed.", correctPerson: 3 },
      { text: "This person finds it difficult to focus at home.", correctPerson: 1 },
      { text: "This person likes combining home and office work.", correctPerson: 2 },
      { text: "This person is more efficient without commuting.", correctPerson: 0 },
      { text: "This person sometimes feels lonely working remotely.", correctPerson: 0 },
    ],
    explanation: "Cần đọc kỹ ý kiến mỗi người và so sánh với các phát biểu để tìm sự tương ứng.",
  },
];

export const mockPart4Questions: ReadingLongQuestion[] = [
  {
    id: 30,
    type: "long-reading",
    instruction: "Read the text below and answer the questions.",
    passage: `The Rise of Electric Vehicles

Electric vehicles (EVs) have become increasingly popular over the past decade. Several factors have contributed to this growth, including government incentives, improving battery technology, and growing environmental awareness among consumers.

One of the main advantages of EVs is their lower operating cost. Electricity is generally cheaper than petrol or diesel, and electric motors require less maintenance than internal combustion engines. Additionally, EVs produce zero direct emissions, making them a cleaner alternative for urban transportation.

However, challenges remain. The initial purchase price of EVs is still higher than comparable petrol cars, although this gap is narrowing. Charging infrastructure is expanding but remains insufficient in many rural areas. Battery range, while improving, is still a concern for long-distance travel.

Despite these challenges, analysts predict that EVs will account for more than 50% of new car sales globally by 2030. Major automakers have announced plans to phase out internal combustion engines entirely within the next two decades. The transition to electric vehicles represents one of the most significant shifts in the automotive industry since the invention of the car itself.`,
    questions: [
      {
        text: "What has NOT contributed to the growth of EVs according to the text?",
        options: [
          "Government incentives",
          "Better battery technology",
          "Lower fuel prices",
          "Environmental awareness",
        ],
        correct: 2,
      },
      {
        text: "What is mentioned as an advantage of EVs?",
        options: [
          "They are cheaper to buy",
          "They require less maintenance",
          "They can travel longer distances",
          "They are faster than petrol cars",
        ],
        correct: 1,
      },
      {
        text: "What challenge of EVs is mentioned?",
        options: [
          "They are too small",
          "They are too noisy",
          "Charging infrastructure is limited in rural areas",
          "They cannot be used in cities",
        ],
        correct: 2,
      },
      {
        text: "What do analysts predict?",
        options: [
          "EVs will replace all cars by 2025",
          "EVs will make up over 50% of new sales by 2030",
          "Petrol cars will become cheaper",
          "Battery technology will stop improving",
        ],
        correct: 1,
      },
    ],
    explanation: "Bài đọc về xu hướng xe điện — cần nắm được ý chính, ưu/nhược điểm và dự đoán tương lai.",
  },
];
