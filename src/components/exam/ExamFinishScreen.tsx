interface ExamFinishScreenProps {
  onSubmit: () => void;
  message?: string;
  title?: string;
  buttonText?: string;
}

const ExamFinishScreen = ({
  onSubmit,
  message = "Once you submit your test you will no longer have access to the questions.",
  title = "Submit Test?",
  buttonText = "Submit test",
}: ExamFinishScreenProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onSubmit}
            className="px-6 py-2.5 rounded-lg bg-[#24085a] hover:bg-[#1a0640] text-white text-sm font-semibold transition-colors"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamFinishScreen;
