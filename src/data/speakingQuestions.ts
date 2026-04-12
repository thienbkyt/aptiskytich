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
  questions: string[];
  prepTime: number;
  speakTime: number;
}

// Part 3: Compare Pictures – Compare two images (45s prep, 60s speak)
export interface SpeakingPart3Data {
  imageUrl1: string;
  imageUrl2: string;
  prompt: string;
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
  prepTime: 0,    // No prep for Part 1
  speakTime: 30,  // 30 seconds per answer
};

export const mockSpeakingPart2: SpeakingPart2Data = {
  imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800",
  prompt: "Describe what you can see in this picture. You should talk about the people, the place, and what is happening.",
  questions: [
    "Describe what you can see in this picture.",
    "Why do people enjoy visiting places like this?",
    "Tell me about the last time you visited a similar place.",
  ],
  prepTime: 45,
  speakTime: 45,
};

export const mockSpeakingPart3: SpeakingPart3Data = {
  imageUrl1: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
  imageUrl2: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
  prompt: "Compare these two pictures. Talk about the similarities and differences between them.",
  prepTime: 45,
  speakTime: 60,
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
