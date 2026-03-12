import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, BookOpen, LogIn, LogOut, Shield, Flame, ChevronDown, BookText, GraduationCap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";

const skillLinks = [
  { label: "Grammar & Vocabulary", path: "/grammar" },
  { label: "Reading", path: "/reading" },
  { label: "Listening", path: "/listening" },
  { label: "Speaking", path: "/speaking" },
  { label: "Writing", path: "/writing" },
];

const moreLinks = [
  { label: "Học từ vựng", path: "/vocabulary", icon: BookText, desc: "Ôn luyện từ vựng theo chủ đề Aptis" },
  { label: "Khóa học Aptis 7 ngày cam kết đầu ra", path: "/course", icon: GraduationCap, desc: "Lộ trình học tập chuyên sâu" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreHover, setMoreHover] = useState(false);
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-xl border-b border-border">
      <div className="h-full max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-[17px] text-foreground tracking-tight">
            Aptis <span className="text-primary">Kỳ Tích</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-1">
          {skillLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative px-3 py-2 text-[13.5px] font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive(link.path)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {link.label}
              {isActive(link.path) && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </Link>
          ))}

          {/* More dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setMoreHover(true)}
            onMouseLeave={() => setMoreHover(false)}
          >
            <button
              className={`flex items-center gap-1 px-3 py-2 text-[13.5px] font-medium rounded-md transition-colors whitespace-nowrap ${
                moreLinks.some((l) => isActive(l.path))
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              More
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreHover ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {moreHover && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 pt-2 z-50"
                >
                  <div className="w-80 bg-popover border border-border rounded-xl shadow-lg p-1.5">
                    {moreLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`flex items-start gap-3 px-3 py-3 rounded-lg transition-colors ${
                          isActive(link.path)
                            ? "bg-primary/5 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
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
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop right actions */}
        <div className="hidden lg:flex items-center gap-2">
          <ThemeToggle />
          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5 text-primary text-[13px]">
                <Shield className="w-4 h-4" />
                Admin
              </Button>
            </Link>
          )}
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1.5 text-[13px]">
                  <Flame className="w-4 h-4 text-primary" />
                  Dashboard
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="gap-1.5 text-[13px]" onClick={signOut}>
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="gap-1.5 text-[13px]">
                  <LogIn className="w-4 h-4" />
                  Đăng nhập
                </Button>
              </Link>
              <Link to="/mock-test">
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/85 rounded-[10px] px-[18px] py-[10px] h-auto text-[13.5px] font-semibold shadow-sm"
                >
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
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="px-4 py-3 space-y-0.5 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {skillLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-1 mx-4 border-t border-border" />

              {moreLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
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

              {isAdmin && (
                <>
                  <div className="my-1 mx-4 border-t border-border" />
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
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
                    <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full justify-center gap-2 text-sm">
                        <Flame className="w-4 h-4 text-primary" />
                        Dashboard
                      </Button>
                    </Link>
                    <Button
                      className="w-full text-sm"
                      variant="destructive"
                      onClick={() => { signOut(); setMobileOpen(false); }}
                    >
                      Đăng xuất
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/auth" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full justify-center gap-2 text-sm">
                        <LogIn className="w-4 h-4" />
                        Đăng nhập
                      </Button>
                    </Link>
                    <Link to="/mock-test" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/85 rounded-[10px] text-sm font-semibold">
                        Thi thử miễn phí
                      </Button>
                    </Link>
                  </>
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
