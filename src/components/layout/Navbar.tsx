import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu, X, LogIn, Shield, Flame, ChevronDown,
  BookText, GraduationCap, Book, Headphones, Mic, PenLine,
  BookOpen, ClipboardCheck, FileSpreadsheet, BarChart3, Users, Crown, type LucideIcon,
} from "lucide-react";
import logoImg from "@/assets/logo.webp";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import ThemeToggle from "@/components/ThemeToggle";

import { prefetchHandlers, prefetchOnIdle } from "@/lib/routePrefetch";
import ProfileModal from "@/components/layout/ProfileModal";
import NotificationBell from "@/components/layout/NotificationBell";
import { FEATURES } from "@/config/features";

/* ── Nav data ── */
const allTopLinks: { label: string; path: string; icon: LucideIcon }[] = [
  { label: "Khóa học Aptis 7 ngày", path: "/course", icon: GraduationCap },
];
const topLinks = allTopLinks.filter((l) => l.path !== "/course" || FEATURES.course);


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
  const [adminHover, setAdminHover] = useState(false);
  const [mobileSkillOpen, setMobileSkillOpen] = useState(false);
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { isPro, isPremium, tier, loading: tierLoading } = useIsPro();
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  const isActive = (path: string) => location.pathname === path;
  const isSkillActive = skillLinks.some((l) => isActive(l.path));
  const isAdminActive = isActive("/admin") || isActive("/admin/report") || isActive("/admin/students") || isActive("/admin/pro");

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setMobileSkillOpen(false);
    setMobileAdminOpen(false);
  }, [location.pathname]);

  // Idle prefetch disabled — heavy routes (dashboard/admin) only load on hover now.

  const handleSkillEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setSkillHover(true);
  };
  const handleSkillLeave = () => {
    hoverTimeout.current = setTimeout(() => setSkillHover(false), 150);
  };
  const handleAdminEnter = () => {
    if (adminHoverTimeout.current) clearTimeout(adminHoverTimeout.current);
    setAdminHover(true);
  };
  const handleAdminLeave = () => {
    adminHoverTimeout.current = setTimeout(() => setAdminHover(false), 150);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/90 backdrop-blur-md border-b border-primary/40 shadow-[0_1px_0_0_hsl(var(--primary)/0.6),0_8px_24px_-8px_hsl(var(--primary)/0.25)]">
      <div className="h-full max-w-[1200px] mx-auto px-4 flex items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 mr-4 group">
          <img src={logoImg} alt="Aptis Kỳ Tích" className="h-10 w-auto px-0 pb-0 transition-transform group-hover:scale-105" />
          <span className="font-heading font-bold text-base text-foreground tracking-tight">
            Aptis <span className="gradient-text">Kỳ Tích</span>
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <div className="hidden md:flex items-center flex-1 justify-center gap-2">
          {/* 1. Thi thử Aptis - red CTA */}
          <Link to="/thi-thu" {...prefetchHandlers("/thi-thu")}>
            <Button
              size="sm"
              variant="glow"
              className="rounded-full px-4 py-2 h-auto text-sm font-semibold gap-1.5"
            >
              <ClipboardCheck className="w-4 h-4" />
              Thi thử Aptis
            </Button>
          </Link>

          {/* 2. Luyện tập theo kỹ năng dropdown */}
          <div
            className="relative"
            onMouseEnter={handleSkillEnter}
            onMouseLeave={handleSkillLeave}
            onFocus={handleSkillEnter}
          >
            <button
              className={`group flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full border-[1.5px] border-[#CC1C01] text-[#CC1C01] bg-transparent hover:bg-[#CC1C01]/10 transition-all whitespace-nowrap`}
            >
              <BookOpen className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
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
                        {...prefetchHandlers(link.path)}
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

          {/* 3. Học từ vựng */}
          <Link
            to="/vocabulary"
            {...prefetchHandlers("/vocabulary")}
            className={`group relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap hover:bg-primary/5 ${
              isActive("/vocabulary")
                ? "text-primary"
                : "text-secondary-foreground hover:text-primary"
            }`}
          >
            <BookText className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3" />
            Học từ vựng bài thi Aptis
            {isActive("/vocabulary") && (
              <motion.div
                layoutId="nav-active"
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-0 rounded-full bg-primary/50 transition-all duration-300 group-hover:w-[calc(100%-1.5rem)]" />
          </Link>

          {/* 4. Khóa học Aptis 7 ngày */}
          {topLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              {...prefetchHandlers(link.path)}
              className={`group relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap hover:bg-primary/5 ${
                isActive(link.path)
                  ? "text-primary"
                  : "text-secondary-foreground hover:text-primary"
              }`}
            >
              <link.icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3" />
              {link.label}
              {isActive(link.path) && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-0 rounded-full bg-primary/50 transition-all duration-300 group-hover:w-[calc(100%-1.5rem)]" />
            </Link>
          ))}
        </div>

        {/* ── Desktop right actions ── */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {isAdmin && (
            <div
              className="relative"
              onMouseEnter={handleAdminEnter}
              onMouseLeave={handleAdminLeave}
            >
              <button
                className={`flex items-center gap-1 px-3.5 py-2 text-sm font-bold rounded-md transition-colors whitespace-nowrap ${
                  isAdminActive
                    ? "text-primary"
                    : "text-secondary-foreground"
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${adminHover ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {adminHover && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 pt-2 z-50"
                  >
                    <div className="w-56 bg-popover border border-border rounded-xl shadow-lg p-1.5">
                      <Link
                        to="/admin"
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive("/admin")
                            ? "bg-primary/5 text-primary"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">Import Center</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Quản lý đề thi & dữ liệu</p>
                        </div>
                      </Link>
                      <Link
                        to="/admin/students"
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive("/admin/students")
                            ? "bg-primary/5 text-primary"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">Người dùng</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Xem lịch sử người dùng</p>
                        </div>
                      </Link>
                      <Link
                        to="/admin/pro"
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive("/admin/pro")
                            ? "bg-primary/5 text-primary"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Crown className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">Quản lý Pro</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Gói Pro, công tắc Free, tính năng</p>
                        </div>
                      </Link>
                      <Link
                        to="/admin/report"
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive("/admin/report")
                            ? "bg-primary/5 text-primary"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <BarChart3 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">Report</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Thống kê & báo cáo</p>
                        </div>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {user ? (
            <>
              {tierLoading ? (
                <span
                  aria-hidden
                  className="inline-block h-8 w-24 rounded-full bg-muted/40 animate-pulse"
                />
              ) : isPremium ? (
                <span
                  title="Bạn đang là thành viên Premium (trọn đời)"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#CC1C01] via-[#FEAD5F] to-[#CC1C01] text-white text-[11px] font-extrabold shadow-[0_0_12px_-2px_rgba(254,173,95,0.6)]"
                >
                  <Crown className="w-3.5 h-3.5" /> Premium
                </span>
              ) : isPro ? (
                <Link to="/pricing" {...prefetchHandlers("/pricing")} title="Bạn đang là Pro — nâng cấp Premium để dùng trọn đời">
                  <Button
                    size="sm"
                    className="rounded-full h-8 px-3 text-xs font-extrabold gap-1 bg-gradient-to-r from-[#CC1C01] via-[#FEAD5F] to-[#CC1C01] bg-[length:200%_100%] text-white hover:brightness-110 hover:bg-[position:100%_0] transition-all border-0 shadow-[0_0_14px_-3px_rgba(254,173,95,0.7)]"
                  >
                    <Crown className="w-3.5 h-3.5" /> Lên Premium
                  </Button>
                </Link>
              ) : (
                <Link to="/pricing" {...prefetchHandlers("/pricing")}>
                  <Button
                    size="sm"
                    className="rounded-full h-8 px-3.5 text-xs font-extrabold gap-1 bg-gradient-to-r from-[#CC1C01] via-[#FEAD5F] to-[#CC1C01] bg-[length:200%_100%] text-white hover:brightness-110 hover:bg-[position:100%_0] transition-all border-0 shadow-[0_0_14px_-3px_rgba(254,173,95,0.7)]"
                  >
                    <Crown className="w-3.5 h-3.5" /> Nâng cấp
                  </Button>
                </Link>
              )}
              <NotificationBell />
              <Link to="/dashboard" {...prefetchHandlers("/dashboard")}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-sm h-8 px-3">
                  <Flame className="w-4 h-4 text-primary" />
                  Dashboard
                </Button>
              </Link>
              <button
                onClick={() => setProfileOpen(true)}
                aria-label="Thông tin tài khoản"
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  (user.email?.[0] ?? "U").toUpperCase()
                )}
              </button>
            </>
          ) : (
            <Link to="/auth" {...prefetchHandlers("/auth")}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-sm h-8 px-3">
                <LogIn className="w-4 h-4" />
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

              <div className="my-1 mx-4 border-t border-border" />

              {/* Skill accordion */}
              <button
                onClick={() => setMobileSkillOpen(!mobileSkillOpen)}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm font-bold text-[#CC1C01] transition-colors ${
                  isSkillActive
                    ? "bg-primary/10"
                    : "hover:bg-primary/5"
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


              {isAdmin && (
                <>
                  <div className="my-1 mx-4 border-t border-border" />
                  <button
                    onClick={() => setMobileAdminOpen(!mobileAdminOpen)}
                    className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isAdminActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Shield className="w-4 h-4" />
                      Admin
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileAdminOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {mobileAdminOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-6 space-y-0.5">
                          <Link
                            to="/admin"
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                              isActive("/admin")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            Import Center
                          </Link>
                          <Link
                            to="/admin/students"
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                              isActive("/admin/students")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <Users className="w-4 h-4" />
                            Người dùng
                          </Link>
                          <Link
                            to="/admin/pro"
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                              isActive("/admin/pro")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <Crown className="w-4 h-4" />
                            Quản lý Pro
                          </Link>
                          <Link
                            to="/admin/report"
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                              isActive("/admin/report")
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <BarChart3 className="w-4 h-4" />
                            Report
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              <div className="my-1 mx-4 border-t border-border" />

              <div className="px-2 pt-1 space-y-2">
                {user ? (
                  <>
                    <button
                      onClick={() => setProfileOpen(true)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="avatar" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          (user.email?.[0] ?? "U").toUpperCase()
                        )}
                      </span>
                      <span className="text-sm font-medium truncate">{user.email}</span>
                    </button>
                    <NotificationBell variant="mobile" />
                    {isPro ? (
                      <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#CC1C01]/10 to-[#FEAD5F]/10 border border-[#CC1C01]/30 text-[#CC1C01] text-xs font-extrabold">
                        <Crown className="w-3.5 h-3.5" /> Bạn đang là thành viên Pro
                      </div>
                    ) : (
                      <Link to="/pricing">
                        <Button className="w-full justify-center gap-2 text-sm font-bold bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white hover:brightness-110 border-0">
                          <Crown className="w-4 h-4" /> Nâng cấp Pro
                        </Button>
                      </Link>
                    )}
                    <Link to="/dashboard">
                      <Button variant="outline" className="w-full justify-center gap-2 text-sm">
                        <Flame className="w-4 h-4 text-primary" />
                        Dashboard
                      </Button>
                    </Link>
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
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </nav>
  );
};

export default Navbar;
