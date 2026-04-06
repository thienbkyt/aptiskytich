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
    instruction: "Four people respond in the comments section of an online magazine article about education and work. Read the texts and then answer the questions below.",
    people: [
      {
        name: "Petra",
        text: "As you get older, responsibilities like a job and family dominate your life. It can be hard to balance things. Studying at university is demanding. So you should do it at an age when you are independent and carefree. It is also important to learn how the world of business works.",
      },
      {
        name: "Antonio",
        text: "Life doesn't really get serious until you hit your mid-twenties. Before that, try out different things and get some life experience. It's only as you approach your thirties that you need to get serious about your career. Many colleges offer inexpensive courses for more mature students.",
      },
      {
        name: "Eleanor",
        text: "Nowadays, it is popular for school leavers to take a break before they think about an occupation or a place at university. I think the most important thing is to start working as soon as you can. You need practical experience for your CV, and that can be more valuable than a diploma.",
      },
      {
        name: "Jermaine",
        text: "I think we should all keep learning, but you don't need a piece of paper from an institution to prove it. There are many free courses available online. A lot of young people get into debt because they have to pay for their studies.",
      },
    ],
    statements: [
      { text: "Who thinks you should study when you are older?", correctPerson: 1 },
      { text: "Who thinks formal qualifications are too expensive?", correctPerson: 3 },
      { text: "Who thinks you should go to university when you are young?", correctPerson: 0 },
      { text: "Who thinks you should study independently?", correctPerson: 3 },
      { text: "Who thinks you should combine a job with studying?", correctPerson: 2 },
      { text: "Who thinks you should choose a course that is practical?", correctPerson: 0 },
      { text: "Who thinks you should get a job immediately after leaving school?", correctPerson: 2 },
    ],
    explanation: "Cần đọc kỹ ý kiến mỗi người và so sánh với các câu hỏi để tìm sự tương ứng.",
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
