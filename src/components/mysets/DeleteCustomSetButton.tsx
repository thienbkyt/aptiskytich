import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteCustomSet } from "@/hooks/useCustomSets";

interface DeleteCustomSetButtonProps {
  setId: string;
  title: string;
  /** Gọi sau khi xoá thành công để refetch danh sách + cập nhật số đếm bộ lọc. */
  onDeleted: () => void;
  size?: "sm" | "icon";
  variant?: "ghost" | "outline";
  iconClassName?: string;
  className?: string;
}

const DeleteCustomSetButton = ({
  setId,
  title,
  onDeleted,
  size = "icon",
  variant = "outline",
  iconClassName = "w-4 h-4",
  className,
}: DeleteCustomSetButtonProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteCustomSet(setId);
      toast.success("Đã xoá bộ đề");
      setOpen(false);
      onDeleted();
    } catch {
      toast.error("Không xoá được bộ đề");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        aria-label="Xoá bộ đề"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Trash2 className={`${iconClassName} text-destructive`} />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bộ đề này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bộ <span className="font-semibold text-foreground">{title}</span> sẽ bị xoá. Lịch sử các
              lần bạn đã làm vẫn được giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DeleteCustomSetButton;
