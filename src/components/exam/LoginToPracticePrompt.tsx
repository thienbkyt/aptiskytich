import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Props {
  message: string;
}

const LoginToPracticePrompt = ({ message }: Props) => {
  return (
    <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
      <LogIn className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-muted-foreground font-medium mb-4">{message}</p>
      <Button asChild className="bg-primary hover:bg-brand-brown text-white font-semibold">
        <Link to="/auth">Đăng nhập</Link>
      </Button>
    </div>
  );
};

export default LoginToPracticePrompt;
