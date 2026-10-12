import { Bot } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BuyCreditsPanel from "./BuyCreditsPanel";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  usageText?: string | null;
  walletBalance?: number | null;
}

const BuyCreditsDialog = ({ open, onOpenChange, title, description, usageText, walletBalance }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
      <DialogHeader className="text-left">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Bot className="h-6 w-6" /></span>
          <div>
            <DialogTitle>{title ?? "Mua thêm lượt chấm AI"}</DialogTitle>
            <DialogDescription className="mt-1">
              {description ?? "Lượt mua thêm được dùng khi bạn đã hết lượt trong ngày của gói Pro."}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <BuyCreditsPanel usageText={usageText} walletBalance={walletBalance} onCancel={() => onOpenChange(false)} />
    </DialogContent>
  </Dialog>
);

export default BuyCreditsDialog;
