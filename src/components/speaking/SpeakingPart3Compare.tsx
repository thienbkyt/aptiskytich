import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import type { SpeakingPart3Data } from "@/data/speakingQuestions";

interface Props {
  data: SpeakingPart3Data;
  answers: (string | null)[];
  onAnswer: (questionIndex: number, personName: string) => void;
  submitted: boolean;
}

const SpeakingPart3Compare = ({ data, answers, onAnswer, submitted }: Props) => {
  const { instruction, texts, questions } = data;
  const personNames = texts.map(t => t.name);

  return (
    <div className="space-y-6">
      {/* Instruction */}
      <p className="text-sm text-gray-700 leading-relaxed">{instruction}</p>

      {/* 4 Person cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {texts.map((person, i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <p className="text-sm font-bold text-gray-900 mb-2">{person.name}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{person.content}</p>
          </div>
        ))}
      </div>

      {/* Questions with dropdowns */}
      <div className="space-y-4">
        {questions.map((q, qi) => {
          const selected = answers[qi];
          const isCorrect = submitted && selected === q.correctPerson;
          const isWrong = submitted && selected !== null && selected !== q.correctPerson;

          return (
            <div key={qi} className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-800 font-medium min-w-0 flex-1">
                <span className="font-bold">{qi + 1}.</span> {q.text}
              </span>
              <div className="relative">
                <select
                  value={selected || ""}
                  onChange={(e) => !submitted && onAnswer(qi, e.target.value)}
                  disabled={submitted}
                  className={`appearance-none w-[140px] h-9 pl-3 pr-8 text-sm border rounded-md bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#24085a]/30 ${
                    submitted
                      ? isCorrect
                        ? "border-green-500 bg-green-50 text-green-700"
                        : isWrong
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-300 text-gray-500"
                      : selected
                      ? "border-[#24085a] text-gray-900"
                      : "border-gray-300 text-gray-500"
                  }`}
                >
                  <option value=""></option>
                  {personNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {submitted && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
              {submitted && isWrong && (
                <span className="flex items-center gap-1 shrink-0">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-xs text-red-600">→ {q.correctPerson}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpeakingPart3Compare;
