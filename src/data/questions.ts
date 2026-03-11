export interface Question {
  id: number;
  skill: "grammar" | "reading" | "listening" | "speaking" | "writing";
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  question_type?: "mcq" | "gap-fill";
  audio_url?: string | null;
}

export interface GapFillQuestion {
  id: number;
  skill: "reading";
  question_type: "gap-fill";
  passage: string; // Text with {0}, {1}, {2}... placeholders
  instruction: string;
  gaps: GapFillGap[];
  explanation: string;
}

export interface GapFillGap {
  options: string[];
  correct: number;
}

export const sampleGapFillQuestions: GapFillQuestion[] = [
  {
    id: 101,
    skill: "reading",
    question_type: "gap-fill",
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
      { options: ["view", "look", "sight", "scene"], correct: 0 },
      { options: ["sunny", "rainy", "cloudy", "windy"], correct: 0 },
      { options: ["boat", "train", "plane", "bus"], correct: 0 },
      { options: ["castle", "office", "airport", "station"], correct: 0 },
      { options: ["drive", "walk", "fly", "swim"], correct: 0 },
      { options: ["shops", "hospitals", "schools", "libraries"], correct: 0 },
    ],
    explanation: "Đoạn email kể về kỳ nghỉ ở Hy Lạp. Cần chọn từ phù hợp ngữ cảnh cho mỗi chỗ trống.",
  },
];

export const sampleQuestions: Question[] = [
  // Grammar & Vocabulary (10)
  { id: 1, skill: "grammar", question_text: "She _____ to the office every day.", options: ["go", "goes", "going", "gone"], correct_answer: 1, explanation: "Chủ ngữ 'She' (ngôi 3 số ít) → động từ thêm -s/-es ở thì hiện tại đơn." },
  { id: 2, skill: "grammar", question_text: "I have been living here _____ 2015.", options: ["for", "since", "during", "while"], correct_answer: 1, explanation: "'Since' dùng với mốc thời gian cụ thể (2015). 'For' dùng với khoảng thời gian." },
  { id: 3, skill: "grammar", question_text: "If I _____ rich, I would travel the world.", options: ["am", "was", "were", "be"], correct_answer: 2, explanation: "Câu điều kiện loại 2: If + S + were/V2... Dùng 'were' cho tất cả các ngôi." },
  { id: 4, skill: "grammar", question_text: "The book _____ by millions of people.", options: ["has read", "has been read", "has been reading", "have read"], correct_answer: 1, explanation: "Câu bị động thì hiện tại hoàn thành: has/have + been + V3." },
  { id: 5, skill: "grammar", question_text: "He asked me where I _____.", options: ["live", "lived", "am living", "have lived"], correct_answer: 1, explanation: "Câu tường thuật: lùi thì từ hiện tại đơn sang quá khứ đơn." },
  { id: 6, skill: "grammar", question_text: "She is _____ tallest girl in the class.", options: ["a", "an", "the", "—"], correct_answer: 2, explanation: "Dùng 'the' trước so sánh nhất (superlative)." },
  { id: 7, skill: "grammar", question_text: "We need to find a _____ to this problem.", options: ["solve", "solution", "solving", "solved"], correct_answer: 1, explanation: "'Solution' là danh từ phù hợp sau mạo từ 'a'. 'Solve' là động từ." },
  { id: 8, skill: "grammar", question_text: "The meeting has been _____ until next week.", options: ["postponed", "cancelled", "delayed", "put"], correct_answer: 0, explanation: "'Postponed' = hoãn lại đến thời điểm cụ thể (until next week)." },
  { id: 9, skill: "grammar", question_text: "I wish I _____ speak French fluently.", options: ["can", "could", "may", "will"], correct_answer: 1, explanation: "Cấu trúc 'wish': I wish + S + could/V2 (ước về hiện tại)." },
  { id: 10, skill: "grammar", question_text: "_____ the rain, we went out for a walk.", options: ["Despite", "Although", "Because", "However"], correct_answer: 0, explanation: "'Despite' + N/V-ing: Mặc dù. 'Although' + clause." },

  // Reading (5)
  { id: 11, skill: "reading", question_text: "Read the passage: 'The company announced that all employees would receive a 10% salary increase starting next month. The decision was made after reviewing the company's strong financial performance this year.' — What is the main topic?", options: ["Company layoffs", "Salary increase announcement", "Financial crisis", "New hiring policy"], correct_answer: 1, explanation: "Đoạn văn nói về thông báo tăng lương 10% cho nhân viên." },
  { id: 12, skill: "reading", question_text: "'Many young people today prefer to work remotely rather than go to an office. They value flexibility and the ability to manage their own time.' — According to the text, what do young people value?", options: ["High salary", "Office culture", "Flexibility", "Job security"], correct_answer: 2, explanation: "Bài viết chỉ rõ: 'They value flexibility and the ability to manage their own time.'" },
  { id: 13, skill: "reading", question_text: "'The new library will open next Saturday. It will have over 50,000 books and free WiFi for all visitors.' — When will the library open?", options: ["Next Monday", "Next Saturday", "This weekend", "Next month"], correct_answer: 1, explanation: "Câu đầu tiên nói rõ: 'The new library will open next Saturday.'" },
  { id: 14, skill: "reading", question_text: "'Studies show that people who exercise regularly tend to sleep better and feel less stressed. Even a 30-minute walk can make a difference.' — What is the benefit of exercise mentioned?", options: ["Weight loss", "Better sleep and less stress", "More energy", "Stronger muscles"], correct_answer: 1, explanation: "Bài viết đề cập: 'sleep better and feel less stressed.'" },
  { id: 15, skill: "reading", question_text: "'The restaurant received excellent reviews for its seafood dishes. However, several customers complained about the slow service.' — What was the criticism?", options: ["Food quality", "Prices", "Slow service", "Location"], correct_answer: 2, explanation: "'Several customers complained about the slow service' → Phàn nàn về dịch vụ chậm." },

  // Listening (5) - simulated as text-based
  { id: 16, skill: "listening", question_text: "🎧 You hear: 'The train to London departs at 3:45 PM from platform 6.' — What time does the train leave?", options: ["3:15 PM", "3:45 PM", "4:15 PM", "3:30 PM"], correct_answer: 1, explanation: "Thông báo nói rõ: 'departs at 3:45 PM'." },
  { id: 17, skill: "listening", question_text: "🎧 You hear a conversation: 'A: Could you help me find the post office? B: Sure, go straight ahead and turn left at the traffic lights.' — Where should the person turn?", options: ["At the roundabout", "At the traffic lights", "At the bridge", "At the park"], correct_answer: 1, explanation: "Người B nói: 'turn left at the traffic lights.'" },
  { id: 18, skill: "listening", question_text: "🎧 You hear: 'Good morning, this is Dr. Smith's office. We need to reschedule your appointment to Thursday at 2 PM.' — What day is the new appointment?", options: ["Monday", "Wednesday", "Thursday", "Friday"], correct_answer: 2, explanation: "Tin nhắn nói: 'reschedule to Thursday at 2 PM.'" },
  { id: 19, skill: "listening", question_text: "🎧 You hear: 'The weather forecast for tomorrow shows heavy rain in the morning, but it should clear up by the afternoon.' — When will the rain stop?", options: ["Morning", "Noon", "Afternoon", "Evening"], correct_answer: 2, explanation: "Dự báo nói: 'should clear up by the afternoon.'" },
  { id: 20, skill: "listening", question_text: "🎧 You hear a conversation: 'A: How much is this shirt? B: It's normally $40, but it's on sale for $28 today.' — How much does the shirt cost today?", options: ["$40", "$28", "$32", "$35"], correct_answer: 1, explanation: "Người B nói giá sale hôm nay là $28." },

  // Speaking (5) - knowledge-based questions about speaking strategies
  { id: 21, skill: "speaking", question_text: "🎤 In Aptis Speaking Part 1, you are asked: 'Tell me about your hometown.' Which response is BEST?", options: ["It's nice.", "I live in Hanoi. It's a big city with lots of history and delicious food. I really enjoy the Old Quarter.", "Hanoi is capital of Vietnam.", "My hometown is good place."], correct_answer: 1, explanation: "Câu trả lời tốt cần đầy đủ, có chi tiết cụ thể, dùng từ vựng phong phú và ngữ pháp đúng." },
  { id: 22, skill: "speaking", question_text: "🎤 Which phrase is BEST to start comparing two pictures in Aptis Speaking?", options: ["Picture 1 is good, picture 2 is bad.", "In the first picture I can see... while in the second picture...", "Both pictures are same same.", "I don't know what to say."], correct_answer: 1, explanation: "Dùng cấu trúc so sánh rõ ràng: 'In the first picture... while in the second picture...' thể hiện khả năng diễn đạt tốt." },
  { id: 23, skill: "speaking", question_text: "🎤 You need to describe a photo of people at a market. Which vocabulary set is MOST relevant?", options: ["Computer, software, coding", "Vendors, bargain, fresh produce, crowded", "Mountains, hiking, camping", "Airport, boarding pass, luggage"], correct_answer: 1, explanation: "Từ vựng về chợ: vendors (người bán), bargain (mặc cả), fresh produce (nông sản tươi), crowded (đông đúc)." },
  { id: 24, skill: "speaking", question_text: "🎤 When giving your opinion in Aptis Speaking, which expression is MOST appropriate at B1-B2 level?", options: ["I think so.", "In my opinion, ... because ...", "Yes.", "Maybe."], correct_answer: 1, explanation: "'In my opinion, ... because ...' thể hiện ý kiến rõ ràng kèm lý do, đạt chuẩn B1-B2." },
  { id: 25, skill: "speaking", question_text: "🎤 Which is the BEST way to ask for clarification during the speaking test?", options: ["What?", "Could you repeat the question, please?", "I don't understand.", "Say again."], correct_answer: 1, explanation: "'Could you repeat the question, please?' lịch sự và tự nhiên, thể hiện khả năng giao tiếp tốt." },

  // Writing (5) - knowledge-based questions about writing skills
  { id: 26, skill: "writing", question_text: "✍️ In Aptis Writing, you need to write an informal email to a friend. Which greeting is MOST appropriate?", options: ["Dear Sir/Madam,", "To Whom It May Concern,", "Hi Sarah,", "Respected Sir,"], correct_answer: 2, explanation: "'Hi Sarah,' phù hợp với email thân mật gửi bạn bè. 'Dear Sir/Madam' dùng cho thư trang trọng." },
  { id: 27, skill: "writing", question_text: "✍️ Which sentence uses the correct formal register for a complaint letter?", options: ["Your service was rubbish!", "I am writing to express my dissatisfaction with the service I received.", "Fix this now or I'll be angry.", "The service was like super bad lol."], correct_answer: 1, explanation: "'I am writing to express my dissatisfaction...' là cách viết trang trọng, phù hợp với thư khiếu nại." },
  { id: 28, skill: "writing", question_text: "✍️ Which linking word BEST shows contrast?", options: ["Furthermore", "However", "Therefore", "In addition"], correct_answer: 1, explanation: "'However' dùng để nối 2 ý tương phản. 'Furthermore/In addition' dùng để bổ sung. 'Therefore' chỉ kết quả." },
  { id: 29, skill: "writing", question_text: "✍️ In an essay, which is the BEST way to introduce your opinion?", options: ["I reckon that...", "It is widely believed that... However, I would argue that...", "Everyone knows that...", "Obviously..."], correct_answer: 1, explanation: "Cấu trúc 'It is widely believed... However, I would argue...' thể hiện tư duy phản biện ở cấp B2." },
  { id: 30, skill: "writing", question_text: "✍️ Which closing is appropriate for a formal email?", options: ["Love, Anna", "Cheers mate!", "I look forward to hearing from you. Yours sincerely,", "Bye bye!"], correct_answer: 2, explanation: "'I look forward to hearing from you. Yours sincerely,' là cách kết thúc email trang trọng chuẩn mực." },
];

export const getQuestionsBySkill = (skill: Question["skill"]) =>
  sampleQuestions.filter((q) => q.skill === skill);

export const getMockTestQuestions = () => sampleQuestions;

export const getLevel = (score: number, total: number): string => {
  const pct = (score / total) * 100;
  if (pct >= 90) return "C1";
  if (pct >= 75) return "B2";
  if (pct >= 60) return "B1";
  if (pct >= 45) return "A2";
  return "A1";
};

export const getLevelColor = (level: string): string => {
  switch (level) {
    case "C1": case "C2": return "text-secondary";
    case "B2": return "text-primary";
    case "B1": return "text-info";
    case "A2": return "text-accent";
    default: return "text-destructive";
  }
};
