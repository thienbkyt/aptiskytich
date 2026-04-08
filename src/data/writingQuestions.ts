// Writing Part types and mock data

// Part 1: Short answers — answer 5 questions with 1-5 words
export interface WritingPart1Data {
  type: "short-answers";
  instruction: string;
  questions: { id: number; text: string; sampleAnswer: string }[];
}

// Part 2: Form fill — write 20-30 words in sentences
export interface WritingPart2Data {
  type: "form-fill";
  instruction: string;
  question: string;
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
  /** Role context, e.g. "You are a member of the Travel Club. You have received this email from the club:" */
  scenarioIntro: string;
  /** The full email body received from the club */
  scenarioEmail: string;
  informalEmail: {
    instruction: string;
    wordLimit: number;
    sampleAnswer: string;
  };
  formalEmail: {
    instruction: string;
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
    type: "form-fill",
    instruction: "You are a new member of the Travel Club. Fill in the form. Write in sentences. Use 20–30 words. Recommended time: 7 minutes.",
    question: "Please tell us why you are interested in travel.",
    wordLimit: 45,
    sampleAnswer: "I am interested in travel because I love exploring new cultures and meeting people from different countries. Travelling also helps me relax and learn new things.",
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
    scenarioIntro: "You are a member of the Travel Club. You have received this email from the club:",
    scenarioEmail: "Dear Member,\n\nWe are writing to tell you that the famous travel writer Mr David Price will unfortunately not be able to attend our next club meeting. Although Mr Price will not be there to sign copies of his new book Around The World In Eighty Ways, members of the club will be able to buy a copy at the price of twenty five pounds. If you would like to reserve a copy of the book, please contact the club secretary.\n\nThe President",
    informalEmail: {
      instruction: "Write an email to your friend. Write about your feelings and what you think the club should do about the situation. Write about 50 words. Recommended time: 10 minutes.",
      wordLimit: 75,
      sampleAnswer: "Hi Sarah,\n\nI'm really disappointed that Mr Price won't be at the meeting. I was looking forward to meeting him! I think the club should try to reschedule his visit. At least we can still buy the book. Are you going to get one?\n\nLet me know!\nAnna",
    },
    formalEmail: {
      instruction: "Write an email to the president of the club. Write about your feelings and what you think the club should do about the situation. Write 120–150 words. Recommended time: 20 minutes.",
      wordLimit: 225,
      sampleAnswer: "Dear Mr/Ms President,\n\nI am writing to express my disappointment regarding the cancellation of Mr David Price's visit to our next club meeting. Many members, including myself, were very excited about this event and had been looking forward to it for some time.\n\nWhile I understand that these situations can be difficult to control, I believe the club should make every effort to reschedule Mr Price's visit in the near future. It would also be helpful if the club could communicate any updates about this matter to all members as soon as possible.\n\nIn the meantime, I appreciate that we will still have the opportunity to purchase his book. However, I would suggest that the club consider offering a small discount as a gesture of goodwill to those members who were particularly affected by this change.\n\nI look forward to hearing from you.\n\nYours sincerely,\nJohn Smith",
    },
  },
];
