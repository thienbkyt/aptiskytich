import type { Question, GapFillQuestion } from "@/data/questions";

// Part 1: Gap-fill — read passage (email), fill in blanks with dropdown
export interface ReadingSentenceQuestion {
  id: number;
  type: "gap-fill";
  instruction: string;
  passage: string; // with {0}, {1}... placeholders for gaps
  gaps: { options: string[]; correct: number }[];
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
    type: "gap-fill",
    instruction: "Read the email from Janice to her friend. Choose one word from the list for each gap. The first one is done for you.",
    passage: `Dear Sally,

Tim and I are on holiday in Greece. We have a nice {0} of the sea from our hotel.

The weather is {1} and it's really hot.

Yesterday we went on a {2} on the lake and caught some fish.

We had lunch and then we visited an old {3}.

Tomorrow we are going to take a car and {4} around.

We are going to visit some {5} and buy clothes.

Love,

Janice`,
    gaps: [
      { options: ["view", "large", "boat"], correct: 0 },
      { options: ["view", "large", "boat"], correct: 1 },
      { options: ["boat", "castle", "drive"], correct: 0 },
      { options: ["castle", "shops", "drive"], correct: 0 },
      { options: ["drive", "shops", "books"], correct: 0 },
      { options: ["shops", "books", "brothers"], correct: 0 },
    ],
    explanation: "Điền từ phù hợp vào mỗi chỗ trống dựa trên ngữ cảnh của bức thư.",
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
