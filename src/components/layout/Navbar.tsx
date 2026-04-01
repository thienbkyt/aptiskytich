import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu, X, LogIn, LogOut, Shield, Flame, ChevronDown,
  BookText, GraduationCap, Book, Headphones, Mic, PenLine,
  BookOpen, ClipboardCheck, type LucideIcon,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";

/* ── Nav data ── */
const topLinks: { label: string; path: string; icon: LucideIcon }[] = [
  { label: "Khóa học Aptis 7 ngày", path: "/course", icon: GraduationCap },
];

const skillLinks: { label: string; path: string; icon: LucideIcon; desc: string }[] = [
  { label: "Speaking", path: "/speaking", icon: Mic, desc: "Luyện nói theo đề Aptis" },
  { label: "Writing", path: "/writing", icon: PenLine, desc: "Luyện viết theo đề Aptis" },
  { label: "Listening", path: "/listening", icon: Headphones, desc: "Luyện nghe theo đề Aptis" },
  { label: "Reading", path: "/reading", icon: BookOpen, desc: "Luyện đọc theo đề Aptis" },
  { label: "Grammar & Vocabulary", path: "/grammar", icon: Book, desc: "Ngữ pháp và từ vựng" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [skillHover, setSkillHover] = useState(false);
  const [mobileSkillOpen, setMobileSkillOpen] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const isSkillActive = skillLinks.some((l) => isActive(l.path));

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setMobileSkillOpen(false);
  }, [location.pathname]);

  const handleSkillEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setSkillHover(true);
  };
  const handleSkillLeave = () => {
    hoverTimeout.current = setTimeout(() => setSkillHover(false), 150);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-xl border-b-[3px] border-b-primary border-x-0 border-t-0">
      <div className="h-full max-w-[1200px] mx-auto px-4 flex items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 mr-4">
          <img src={logoImg} alt="Aptis Kỳ Tích" className="h-10 w-auto" />
          <span className="font-heading font-bold text-base text-foreground tracking-tight">
            Aptis <span className="text-primary">Kỳ Tích</span>
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <div className="hidden md:flex items-center flex-1 justify-center gap-1">
          {/* 1. Thi thử Aptis - red CTA */}
          <Link to="/thi-thu">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-[10px] px-4 py-2 h-auto text-xs font-semibold shadow-sm gap-1.5"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Thi thử Aptis
            </Button>
          </Link>

          {/* 2. Học từ vựng */}
          <Link
            to="/vocabulary"
            className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold rounded-md transition-colors whitespace-nowrap ${
              isActive("/vocabulary")
                ? "text-primary"
                : "text-secondary-foreground"
            }`}
          >
            <BookText className="w-3.5 h-3.5" />
            Học từ vựng bài thi Aptis
            {isActive("/vocabulary") && (
              <motion.div
                layoutId="nav-active"
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </Link>

          {/* 3. Luyện tập theo kỹ năng dropdown */}
          <div
            className="relative"
            onMouseEnter={handleSkillEnter}
            onMouseLeave={handleSkillLeave}
          >
            <button
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                isSkillActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Luyện tập theo kỹ năng
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${skillHover ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {skillHover && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50"
                >
                  <div className="w-72 bg-popover border border-border rounded-xl shadow-lg p-1.5">
                    {skillLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive(link.path)
                            ? "bg-primary/5 text-primary"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <link.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">{link.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 4. Khóa học Aptis 7 ngày */}
          {topLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive(link.path)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <link.icon className="w-3.5 h-3.5" />
              {link.label}
              {isActive(link.path) && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </Link>
          ))}
        </div>

        {/* ── Desktop right actions ── */}
        <div className="hidden md:flex items-center gap-1.5">
          <ThemeToggle />
          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-primary text-xs h-8 px-2.5">
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Button>
            </Link>
          )}
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 px-2.5">
                  <Flame className="w-3.5 h-3.5 text-primary" />
                  Dashboard
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-2.5" onClick={signOut}>
                <LogOut className="w-3.5 h-3.5" />
                Đăng xuất
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 px-2.5">
                <LogIn className="w-3.5 h-3.5" />
                Đăng nhập
              </Button>
            </Link>
          )}
        </div>

        {/* ── Mobile: theme + hamburger ── */}
        <div className="md:hidden flex items-center gap-1 ml-auto">
          <ThemeToggle />
          <button
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="px-4 py-3 space-y-0.5 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {/* Top links */}
              {topLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}

              <div className="my-1 mx-4 border-t border-border" />

              {/* Skill accordion */}
              <button
                onClick={() => setMobileSkillOpen(!mobileSkillOpen)}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isSkillActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4" />
                  Luyện tập theo kỹ năng
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileSkillOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {mobileSkillOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-6 space-y-0.5">
                      {skillLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                            isActive(link.path)
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          <link.icon className="w-4 h-4" />
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="my-1 mx-4 border-t border-border" />

              {/* Thi thử CTA */}
              <Link
                to="/thi-thu"
                className="block px-2 pt-1"
              >
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-[10px] text-sm font-semibold gap-2">
                  <ClipboardCheck className="w-4 h-4" />
                  Thi thử Aptis
                </Button>
              </Link>

              {isAdmin && (
                <>
                  <div className="my-1 mx-4 border-t border-border" />
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-primary"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </Link>
                </>
              )}

              <div className="my-1 mx-4 border-t border-border" />

              <div className="px-2 pt-1 space-y-2">
                {user ? (
                  <>
                    <Link to="/dashboard">
                      <Button variant="outline" className="w-full justify-center gap-2 text-sm">
                        <Flame className="w-4 h-4 text-primary" />
                        Dashboard
                      </Button>
                    </Link>
                    <Button
                      className="w-full text-sm"
                      variant="destructive"
                      onClick={signOut}
                    >
                      Đăng xuất
                    </Button>
                  </>
                ) : (
                  <Link to="/auth">
                    <Button variant="outline" className="w-full justify-center gap-2 text-sm">
                      <LogIn className="w-4 h-4" />
                      Đăng nhập
                    </Button>
                  </Link>
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
