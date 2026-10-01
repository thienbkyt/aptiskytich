import { Sun, Moon, Ghost } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { isHalloweenSeason } from "@/lib/halloween";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const showHalloween = isHalloweenSeason();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          {theme === "halloween" ? <Ghost className="w-4 h-4" /> : resolvedTheme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showHalloween && (
          <DropdownMenuItem onClick={() => setTheme("halloween")} className="gap-2">
            <Ghost className="w-4 h-4" />
            Halloween 🎃
            {theme === "halloween" && <span className="ml-auto text-primary">✓</span>}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
          <Sun className="w-4 h-4" />
          Sáng
          {theme === "light" && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
          <Moon className="w-4 h-4" />
          Tối
          {theme === "dark" && <span className="ml-auto text-primary">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
