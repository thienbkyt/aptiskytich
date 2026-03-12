import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, BookOpen, LogIn, LogOut, Shield, Flame, ChevronDown, BookText, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const skillLinks = [
  { label: "Grammar & Vocabulary", path: "/grammar" },
  { label: "Reading", path: "/reading" },
  { label: "Listening", path: "/listening" },
  { label: "Speaking", path: "/speaking" },
  { label: "Writing", path: "/writing" },
];

const moreLinks = [
  { label: "Học từ vựng", path: "/vocabulary", icon: BookText },
  { label: "Khóa học Aptis 7 ngày cam kết đầu ra", path: "/course", icon: GraduationCap },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="section-container">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* LEFT: Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-lg text-foreground">
              Aptis <span className="text-primary">Kỳ Tích</span>
            </span>
          </Link>

          {/* CENTER: Nav links (desktop) */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {skillLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive(link.path)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* More dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                    moreLinks.some((l) => isActive(l.path))
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  More
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-72">
                {moreLinks.map((link) => (
                  <DropdownMenuItem key={link.path} asChild>
                    <Link to={link.path} className="flex items-center gap-3 cursor-pointer">
                      <link.icon className="w-4 h-4 text-primary" />
                      <span>{link.label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* RIGHT: Actions (desktop) */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <ThemeToggle />
            {isAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="gap-2 text-primary">
                  <Shield className="w-4 h-4" />
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Flame className="w-4 h-4 text-primary" />
                    Dashboard
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="gap-2" onClick={signOut}>
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Đăng nhập
                  </Button>
                </Link>
                <Link to="/mock-test">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">
                    Thi thử miễn phí
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile: theme + hamburger */}
          <div className="lg:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg hover:bg-muted"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {skillLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium ${
                    isActive(link.path)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* More section in mobile */}
              <div className="pt-1">
                <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">More</p>
                {moreLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${
                      isActive(link.path)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                ))}
              </div>

              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2.5 rounded-lg text-sm font-medium text-primary"
                >
                  Admin
                </Link>
              )}

              <div className="pt-2 border-t border-border mt-2">
                {user ? (
                  <div className="space-y-2">
                    <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full">Dashboard</Button>
                    </Link>
                    <Button className="w-full" variant="destructive" onClick={() => { signOut(); setIsOpen(false); }}>
                      Đăng xuất
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full">Đăng nhập</Button>
                    </Link>
                    <Link to="/mock-test" onClick={() => setIsOpen(false)}>
                      <Button className="w-full bg-primary text-primary-foreground">Thi thử miễn phí</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
