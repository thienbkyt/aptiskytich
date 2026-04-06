// Speaking question data types and mock data for Aptis Speaking (4 parts)

// Part 1: Personal Questions – Answer personal questions (30s prep, 45s speak)
export interface SpeakingPart1Data {
  questions: string[];
  prepTime: number;   // seconds per question
  speakTime: number;  // seconds per question
}

// Part 2: Describe a Picture – Describe what you see (45s prep, 45s speak)
export interface SpeakingPart2Data {
  imageUrl: string;
  prompt: string;
  prepTime: number;
  speakTime: number;
}

// Part 3: Opinion Matching – Read 4 people's opinions + answer 7 dropdown questions
export interface SpeakingPart3Data {
  instruction: string;
  texts: { name: string; content: string }[];
  questions: { text: string; correctPerson: string }[];
  prepTime: number;
  speakTime: number;
}

// Part 4: Opinion Questions – Discuss abstract topic (60s prep, 120s speak)
export interface SpeakingPart4Data {
  topic: string;
  questions: string[];
  prepTime: number;
  speakTime: number;
}

export type SpeakingPartType = "part1" | "part2" | "part3" | "part4";

// Mock data
export const mockSpeakingPart1: SpeakingPart1Data = {
  questions: [
    "What is your full name?",
    "Where do you come from?",
    "What do you do for a living?",
  ],
  prepTime: 0,
  speakTime: 30,
};

export const mockSpeakingPart2: SpeakingPart2Data = {
  imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800",
  prompt: "Describe what you can see in this picture. You should talk about the people, the place, and what is happening.",
  prepTime: 45,
  speakTime: 45,
};

export const mockSpeakingPart3: SpeakingPart3Data = {
  instruction: "Four people respond in the comments section of an online magazine article about education and work. Read the texts and then answer the questions below.",
  texts: [
    { name: "Petra", content: "As you get older, responsibilities like a job and family dominate your life. It can be hard to balance things. Studying at university is demanding. So you should do it at an age when you are independent and carefree. It is also important to learn how the world of business works. Spending unpaid time in a company is a great way to get that experience. Any course that can give you an opportunity to do that is worth considering." },
    { name: "Antonio", content: "Life doesn't really get serious until you hit your mid-twenties. Before that, try out different things and get some life experience. It's only as you approach your thirties that you need to get serious about your career. That's the time to start thinking about further education. Many colleges offer inexpensive courses for more mature students. Going back to student life for a year is a great idea, and you can then return to the world of work at management level." },
    { name: "Eleanor", content: "Nowadays, it is popular for school leavers to take a break before they think about an occupation or a place at university. I think the most important thing is to start working as soon as you can. You need practical experience for your CV, and that can be more valuable than a diploma. Nevertheless, your studies do not have to stop just because you are working. Colleges and universities offer options for people who want to do both." },
    { name: "Jermaine", content: "I think we should all keep learning, but you don't need a piece of paper from an institution to prove it. There are many free courses available online. Of course, not all are good, but a little research will help you identify which one is best for you. A lot of young people get into debt because they have to pay for their studies. With the resources available online these days, you can take control. You won't regret it." },
  ],
  questions: [
    { text: "Who thinks you should study when you are older?", correctPerson: "Antonio" },
    { text: "Who thinks formal qualifications are too expensive?", correctPerson: "Jermaine" },
    { text: "Who thinks you should go to university when you are young?", correctPerson: "Petra" },
    { text: "Who thinks you should study independently?", correctPerson: "Jermaine" },
    { text: "Who thinks you should combine a job with studying?", correctPerson: "Eleanor" },
    { text: "Who thinks you should choose a course that is practical?", correctPerson: "Petra" },
    { text: "Who thinks you should get a job immediately after leaving school?", correctPerson: "Eleanor" },
  ],
  prepTime: 0,
  speakTime: 0,
};

export const mockSpeakingPart4: SpeakingPart4Data = {
  topic: "The importance of technology in education",
  questions: [
    "How has technology changed the way people learn?",
    "What are the advantages and disadvantages of using technology in classrooms?",
    "Do you think online learning will replace traditional classrooms in the future? Why or why not?",
  ],
  prepTime: 60,
  speakTime: 120,
};
