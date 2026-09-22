import ShowcaseConsentCard from "./ShowcaseConsentCard";
import ShowcaseSetSamples from "./ShowcaseSetSamples";

interface Props {
  skill: "writing" | "speaking";
  partType: string | null | undefined;
  testResultId: string | null | undefined;
  examSetId: string | null | undefined;
  rawPart: number | null | undefined;
}

/** Thẻ mời chia sẻ + bài mẫu cùng đề, dùng sau khi đã có điểm AI. */
const ShowcaseSection = ({ skill, partType, testResultId, examSetId, rawPart }: Props) => {
  return (
    <div className="space-y-3">
      <ShowcaseConsentCard
        skill={skill}
        partType={partType}
        testResultId={testResultId}
        rawPart={rawPart}
      />
      <ShowcaseSetSamples
        examSetId={examSetId}
        rawPart={rawPart}
        skill={skill}
        partType={partType}
      />
    </div>
  );
};

export default ShowcaseSection;
