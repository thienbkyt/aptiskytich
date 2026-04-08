import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import RichTextEditor from "@/components/writing/RichTextEditor";
import type { WritingPart4Data } from "@/data/writingQuestions";

interface Props {
  data: WritingPart4Data;
  informalAnswer: string;
  formalAnswer: string;
  onInformalChange: (value: string) => void;
  onFormalChange: (value: string) => void;
  timeLeft: number;
  totalTime: number;
  submitted: boolean;
  onSubmit: () => void;
  sections: any[];
}

const WritingPart4TwoEmails = ({
  data, informalAnswer, formalAnswer,
  onInformalChange, onFormalChange,
  timeLeft, totalTime, submitted, onSubmit, sections,
}: Props) => {
  return (
    <div className="min-h-[70vh] flex flex-col pb-20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-heading font-bold text-foreground">Writing – Part 4</p>
          <p className="text-sm text-muted-foreground max-w-lg">{data.instruction}</p>
        </div>
        <TimerDisplay timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      {/* Informal Email */}
      <div className="mb-8">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3">
          📧 {data.informalEmail.label}
        </h3>
        <div className="bg-card border border-border rounded-xl p-5 mb-3">
          <p className="text-sm text-foreground leading-relaxed">{data.informalEmail.scenario}</p>
        </div>
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">Include the following:</p>
          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
            {data.informalEmail.bulletPoints.map((bp, i) => <li key={i}>{bp}</li>)}
          </ul>
        </div>
        <RichTextEditor
          onTextChange={onInformalChange}
          disabled={submitted}
          placeholder="Write your informal email here..."
          minHeight="140px"
          wordLimit={data.informalEmail.wordLimit}
        />
        {submitted && (
          <div className="bg-muted/50 rounded-xl p-4 mt-3 text-sm">
            <p className="font-semibold text-foreground mb-2">Bài viết mẫu:</p>
            <p className="text-muted-foreground whitespace-pre-line">{data.informalEmail.sampleAnswer}</p>
          </div>
        )}
      </div>

      {/* Formal Email */}
      <div className="mb-4">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3">
          📄 {data.formalEmail.label}
        </h3>
        <div className="bg-card border border-border rounded-xl p-5 mb-3">
          <p className="text-sm text-foreground leading-relaxed">{data.formalEmail.scenario}</p>
        </div>
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">Include the following:</p>
          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
            {data.formalEmail.bulletPoints.map((bp, i) => <li key={i}>{bp}</li>)}
          </ul>
        </div>
        <RichTextEditor
          onTextChange={onFormalChange}
          disabled={submitted}
          placeholder="Write your formal email here..."
          minHeight="220px"
          wordLimit={data.formalEmail.wordLimit}
        />
        {submitted && (
          <div className="bg-muted/50 rounded-xl p-4 mt-3 text-sm">
            <p className="font-semibold text-foreground mb-2">Bài viết mẫu:</p>
            <p className="text-muted-foreground whitespace-pre-line">{data.formalEmail.sampleAnswer}</p>
          </div>
        )}
      </div>

      <BottomNavBar isFirst={true} isLast={true} onSubmit={!submitted ? onSubmit : undefined} submitLabel="Submit" sections={sections} />
    </div>
  );
};

export default WritingPart4TwoEmails;
