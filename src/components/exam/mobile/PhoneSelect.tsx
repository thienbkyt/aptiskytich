import { useCallback, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import MobileOptionSheet, { type SheetOption } from "./MobileOptionSheet";

interface Props {
  value: number | null | undefined;
  options: SheetOption[];
  onChange: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Lớp màu (đúng/sai/đã chọn) do component cha quyết định. */
  className?: string;
  title?: string;
  context?: ReactNode;
  inline?: boolean;
}

/** Nút chọn đáp án cho điện thoại: chạm → mở bảng chọn từ dưới lên. */
const PhoneSelect = ({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Chọn…",
  className = "",
  title,
  context,
  inline = false,
}: Props) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const current = options.find((o) => o.value === value);
  const has = value !== null && value !== undefined && !!current;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`${inline ? "inline-flex align-middle my-0.5 max-w-full" : "flex w-full"} min-h-[40px] items-center justify-between gap-1.5 rounded-lg border-2 px-3 py-1.5 text-[15px] text-left bg-exam-surface disabled:cursor-default ${
          has ? "font-semibold" : "text-exam-text-muted"
        } ${className}`}
      >
        <span className={`min-w-0 ${inline ? "truncate" : "whitespace-normal"}`}>{has ? current!.label : placeholder}</span>
        {!disabled && <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />}
      </button>
      <MobileOptionSheet
        open={open}
        title={title}
        context={context}
        options={options}
        selected={value}
        onSelect={(v) => {
          onChange(v);
          setOpen(false);
        }}
        onClose={close}
      />
    </>
  );
};

export default PhoneSelect;
