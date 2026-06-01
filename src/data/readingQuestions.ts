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

// Part 2: Text cohesion — drag and drop sentences in the right order (2 sections)
export interface ReadingPart2Sentence {
  text: string;
  correctPosition: number; // 1..5 (per section, normalized)
}
export interface ReadingPart2Section {
  sentences: ReadingPart2Sentence[];
}
export interface ReadingCohesionQuestion {
  id: number;
  type: "text-cohesion";
  instruction: string;
  sections: ReadingPart2Section[];
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

// Part 4: Long reading — match headings to paragraphs via dropdown
export interface ReadingLongQuestion {
  id: number;
  type: "long-reading";
  passage: string;
  instruction: string;
  title?: string;
  paragraphs?: { index: number; text: string }[];
  headings?: { text: string; paragraphIndex: number | null }[];
  // Legacy MCQ format (kept for backward compat)
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
    instruction: "The sentences below are from some instructions. Put the sentences in the right order. The first sentence is done for you.",
    sections: [
      {
        sentences: [
          { text: "If you are visiting our office for the first time, please follow these instructions.", correctPosition: 1 },
          { text: "You should go to the front desk upon arrival and give your name and address.", correctPosition: 2 },
          { text: "A member of staff will write this information in the visitor's book.", correctPosition: 3 },
          { text: "Next, he or she will give you a visitor's identity card.", correctPosition: 4 },
          { text: "You can then use the card to enter through the security gate.", correctPosition: 5 },
        ],
      },
      {
        sentences: [
          { text: "Before you leave, please return the card to a member of staff at the front desk.", correctPosition: 1 },
          { text: "The staff will record your departure time in the visitor's book.", correctPosition: 2 },
          { text: "Please make sure you have collected all of your belongings before leaving.", correctPosition: 3 },
          { text: "If you have any feedback, you can leave a note at reception.", correctPosition: 4 },
          { text: "We hope you enjoyed your visit and look forward to seeing you again.", correctPosition: 5 },
        ],
      },
    ],
    explanation: "Các câu cần được sắp xếp theo logic.",
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
    instruction: "Read the passage quickly. Choose a heading for each numbered paragraph (1–7) from the drop-down box. There is one more heading than you need.",
    title: "The Rise of Electric Vehicles",
    passage: "",
    paragraphs: [
      { index: 1, text: "Electric vehicles (EVs) have become increasingly popular over the past decade. Several factors have contributed to this growth, including government incentives, improving battery technology, and growing environmental awareness among consumers." },
      { index: 2, text: "One of the main advantages of EVs is their lower operating cost. Electricity is generally cheaper than petrol or diesel, and electric motors require less maintenance than internal combustion engines." },
      { index: 3, text: "However, challenges remain. The initial purchase price of EVs is still higher than comparable petrol cars, although this gap is narrowing. Charging infrastructure is expanding but remains insufficient in many rural areas." },
      { index: 4, text: "Despite these challenges, analysts predict that EVs will account for more than 50% of new car sales globally by 2030. Major automakers have announced plans to phase out internal combustion engines entirely." },
    ],
    headings: [
      { text: "Growing popularity", paragraphIndex: 1 },
      { text: "Cost benefits", paragraphIndex: 2 },
      { text: "Remaining obstacles", paragraphIndex: 3 },
      { text: "A promising future", paragraphIndex: 4 },
      { text: "Government regulations", paragraphIndex: null },
    ],
    questions: [],
    explanation: "Bài đọc về xu hướng xe điện — cần nắm được ý chính của từng đoạn để gán tiêu đề phù hợp.",
  },
];
