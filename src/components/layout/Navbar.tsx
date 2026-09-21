import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu, X, LogIn, Shield, Flame, ChevronDown,
  BookOpen, ClipboardCheck, Sparkles, Crown,
  Users, FileSpreadsheet, BarChart3, Mic, PenLine, Headphones, Book, BookText, Ear,
  History,
  MoreHorizontal, Lightbulb, Star, Newspaper, MessageSquare,
  Bell, Sun, Moon, LogOut, UserCircle, Check,
  type LucideIcon,
} from "lucide-react";
import logoImg from "@/assets/logo.webp";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { useTheme } from "@/hooks/useTheme";
import { useUserBootstrap } from "@/hooks/useUserBootstrap";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { prefetchHandlers } from "@/lib/routePrefetch";
import ProfileModal from "@/components/layout/ProfileModal";
import NotificationBell from "@/components/layout/NotificationBell";
import TierPill from "@/components/dashboard/TierPill";
import { FEATURES } from "@/config/features";
import FeatureSuggestionModal from "@/components/suggestions/FeatureSuggestionModal";
import FeedbackModal from "@/components/feedback/FeedbackModal";

/* ── Nav data ── */
const skillLinks: { label: string; path: string; icon: LucideIcon; desc: string }[] = [
  { label: "Speaking", path: "/speaking", icon: Mic, desc: "Luyện nói theo đề Aptis" },
  { label: "Writing", path: "/writing", icon: PenLine, desc: "Luyện viết theo đề Aptis" },
  { label: "Listening", path: "/listening", icon: Headphones, desc: "Luyện nghe theo đề Aptis" },
  { label: "Reading", path: "/reading", icon: BookOpen, desc: "Luyện đọc theo đề Aptis" },
  { label: "Grammar & Vocabulary", path: "/grammar", icon: Book, desc: "Ngữ pháp và từ vựng" },
];

const toolLinks: { label: string; path: string; icon: LucideIcon; desc: string }[] = [
  { label: "Học từ vựng", path: "/vocabulary", icon: BookText, desc: "Kho từ vựng & flashcard" },
  { label: "Dictation & Shadowing", path: "/nghe-chep", icon: Ear, desc: "Luyện nghe chép & nói nhại" },
];

const moreLinks: { label: string; path: string; icon: LucideIcon; desc: string }[] = [
  { label: "Review tích đức", path: "/reviews", icon: Star, desc: "Đề thi các bạn chia sẻ lại" },
  { label: "Mẹo thi Aptis", path: "/meo-thi-aptis", icon: Newspaper, desc: "Blog mẹo & kinh nghiệm thi" },
];

const adminLinks = [
  { label: "Import Center", path: "/admin", desc: "Quản lý đề thi & dữ liệu", icon: FileSpreadsheet },
  { label: "Người dùng", path: "/admin/students", desc: "Xem lịch sử người dùng", icon: Users },
  { label: "Quản lý Pro", path: "/admin/pro", desc: "Gói Pro, công tắc Free, tính năng", icon: Crown },
  { label: "Report", path: "/admin/report", desc: "Thống kê & báo cáo", icon: BarChart3 },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [mobileSkillOpen, setMobileSkillOpen] = useState(false);
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const { isPro, isPremium, tier, proUntil } = useIsPro();
  const { unread_notification_count } = useUserBootstrap();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const userDisplayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Học viên";
  const unreadCount = Math.max(0, unread_notification_count || 0);
  const unreadBadgeText = unreadCount > 9 ? "9+" : String(unreadCount);

  const isActive = (path: string) => location.pathname === path;
  const isSkillActive = [...skillLinks, ...toolLinks].some((l) => isActive(l.path));
  const isAdminActive = isActive("/admin") || isActive("/admin/report") || isActive("/admin/students") || isActive("/admin/pro");
  const isKeyActive = isActive("/key-du-doan");
  const isHistoryActive = isActive("/history");
  const isMoreActive = moreLinks.some((l) => isActive(l.path));

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setMobileSkillOpen(false);
    setMobileAdminOpen(false);
    setMobileMoreOpen(false);
  }, [location.pathname]);

  // Smooth sticky header: subtle background change on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSkillEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setSkillOpen(true);
  };
  const handleSkillLeave = () => {
    hoverTimeout.current = setTimeout(() => setSkillOpen(false), 150);
  };
  const handleMoreEnter = () => {
    if (moreHoverTimeout.current) clearTimeout(moreHoverTimeout.current);
    setMoreOpen(true);
    setSkillOpen(false);
  };
  const handleMoreLeave = () => {
    moreHoverTimeout.current = setTimeout(() => setMoreOpen(false), 150);
  };
  const ctaBaseClass =
    "flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full transition-transform duration-200 whitespace-nowrap shadow-[0_4px_14px_rgba(204,28,1,0.35)] hover:scale-105";

  const openNotifications = () => {
    window.dispatchEvent(new Event("kt-open-notifications"));
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 xl:h-16 transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-primary/30 shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.18)]"
          : "bg-background/80 backdrop-blur-sm border-b border-primary/20"
      }`}
    >
      <div className="h-16 xl:h-full max-w-[1440px] mx-auto px-4 lg:px-6 flex items-center gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <img src={logoImg} alt="Aptis Kỳ Tích" width={40} height={40} className="h-10 w-10 px-0 pb-0 transition-transform duration-200 group-hover:scale-105" decoding="async" />
          <span className="font-heading font-bold text-base text-foreground tracking-tight whitespace-nowrap">
            Aptis <span className="gradient-text">Kỳ Tích</span>
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <div className="hidden xl:flex items-center flex-1 min-w-0 justify-start gap-1 ml-4 lg:ml-6">
          {/* Thi thử — main CTA */}
          <Link
            to="/thi-thu"
            {...prefetchHandlers("/thi-thu")}
            className={`${ctaBaseClass} ${
              isActive("/thi-thu")
                ? "bg-gradient-to-r from-[#B01801] to-[#E58A3F] text-white ring-2 ring-white/60"
                : "bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white hover:shadow-[0_6px_18px_rgba(204,28,1,0.45)]"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Thi thử
          </Link>

          {/* Luyện tập dropdown */}
          <div
            className="relative"
            onMouseEnter={handleSkillEnter}
            onMouseLeave={handleSkillLeave}
            onFocus={handleSkillEnter}
          >
            <button
              className={`group flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                isSkillActive || skillOpen
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Luyện tập từng kỹ năng
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${skillOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {skillOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 pt-2 z-50"
                >
                  <div className="w-64 bg-popover border border-border rounded-xl shadow-lg p-2">
                    {/* 5 kỹ năng chính */}
                    {skillLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        {...prefetchHandlers(link.path)}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive(link.path)
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <link.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{link.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                        </div>
                      </Link>
                    ))}

                    {/* Divider + label */}
                    <div className="border-t border-border my-2" />
                    <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Công cụ ôn tập
                    </p>

                    {/* Công cụ ôn tập */}
                    {toolLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        {...prefetchHandlers(link.path)}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive(link.path)
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <link.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{link.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Đề Key Dự Đoán — top-level */}
          <Link
            to="/key-du-doan"
            {...prefetchHandlers("/key-du-doan")}
            className={`group flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
              isKeyActive
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Đề Key Dự Đoán
          </Link>

          {/* Lịch sử — top-level */}
          <Link
            to="/history"
            {...prefetchHandlers("/history")}
            className={`group flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
              isHistoryActive
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <History className="w-4 h-4" />
            Lịch sử học tập
          </Link>

          {/* More dropdown */}
          <div
            className="relative"
            onMouseEnter={handleMoreEnter}
            onMouseLeave={handleMoreLeave}
            onFocus={handleMoreEnter}
          >
            <button
              className={`group flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                isMoreActive || moreOpen
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
              More
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 pt-2 z-50"
                >
                  <div className="w-64 bg-popover border border-border rounded-xl shadow-lg p-2">
                    <button
                      type="button"
                      onClick={() => { setMoreOpen(false); setSuggestOpen(true); }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left text-foreground hover:bg-muted"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Lightbulb className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">Đề xuất tính năng</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Gửi ý tưởng cho đội ngũ</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left text-foreground hover:bg-muted"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">Feedback</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Cảm nhận của học viên</p>
                      </div>
                    </button>
                    {moreLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive(link.path)
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <link.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{link.label}</p>
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

        {/* ── Desktop right actions ── */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <div className="absolute h-0 w-0 overflow-visible [&>div>button]:hidden">
                <NotificationBell />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Mở menu tài khoản"
                    className="relative w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      (user.email?.[0] ?? "U").toUpperCase()
                    )}
                    {unreadCount > 0 && (
                      <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-80 rounded-xl border-border bg-popover p-2 text-popover-foreground shadow-lg">
                  <DropdownMenuLabel className="px-2 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{userDisplayName}</p>
                        <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                      </div>
                      {(isPro || isPremium) && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] px-2 py-0.5 text-[10px] font-extrabold text-white">
                          <Crown className="h-3 w-3" /> PRO
                        </span>
                      )}
                    </div>
                    {(isPro || isPremium) && (
                      <TierPill
                        tier={tier}
                        isPro={isPro}
                        isPremium={isPremium}
                        proUntil={proUntil}
                        className="mt-2 py-2"
                      />
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" {...prefetchHandlers("/dashboard")} className="cursor-pointer gap-2 rounded-lg px-3 py-2">
                      <Flame className="w-4 h-4 text-primary" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" {...prefetchHandlers("/admin")} className="cursor-pointer gap-2 rounded-lg px-3 py-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Quản trị
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={openNotifications} className="cursor-pointer gap-2 rounded-lg px-3 py-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <span>Thông báo</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto min-w-[20px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-primary-foreground">
                        {unreadBadgeText}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">Giao diện</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => setTheme("light")} className="cursor-pointer gap-2 rounded-lg px-3 py-2">
                    <Sun className="w-4 h-4 text-primary" />
                    Sáng
                    {theme === "light" && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTheme("dark")} className="cursor-pointer gap-2 rounded-lg px-3 py-2">
                    <Moon className="w-4 h-4 text-primary" />
                    Tối
                    {resolvedTheme === "dark" && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setProfileOpen(true)} className="cursor-pointer gap-2 rounded-lg px-3 py-2">
                    <UserCircle className="w-4 h-4 text-primary" />
                    Thông tin tài khoản
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={signOut} className="cursor-pointer gap-2 rounded-lg px-3 py-2 text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth" {...prefetchHandlers("/auth")}>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 px-3 text-sm font-semibold bg-card text-foreground dark:text-foreground border-border hover:bg-muted">
                  <LogIn className="w-4 h-4" />
                  Đăng nhập
                </Button>
              </Link>
              <Link to="/auth?tab=signup" {...prefetchHandlers("/auth")}>
                <Button size="sm" variant="glow" className="rounded-full h-8 px-4 text-sm font-semibold gap-1.5">
                  Đăng ký
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* ── Mobile: theme + hamburger ── */}
        <div className="xl:hidden flex items-center gap-1 ml-auto [&_button]:max-[767px]:h-11 [&_button]:max-[767px]:w-11">
          <ThemeToggle />
          <button
            className="p-2 rounded-lg hover:bg-muted transition-colors max-[767px]:h-11 max-[767px]:w-11"
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
            className="xl:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {/* Main CTA */}
              <Link to="/thi-thu" className="block px-2 pt-1 pb-2">
                <Button className="w-full bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white hover:brightness-110 rounded-[10px] text-sm font-bold gap-2 h-11 shadow-[0_4px_14px_rgba(204,28,1,0.35)]">
                  <ClipboardCheck className="w-4 h-4" />
                  Thi thử miễn phí
                </Button>
              </Link>

              <div className="my-2 mx-4 border-t border-border" />

              {/* Luyện tập accordion */}
              <button
                onClick={() => setMobileSkillOpen(!mobileSkillOpen)}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isSkillActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Luyện tập từng kỹ năng
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
                      {/* 5 kỹ năng chính */}
                      {skillLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                            isActive(link.path)
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          <link.icon className="w-4 h-4" />
                          {link.label}
                        </Link>
                      ))}

                      {/* Divider + label */}
                      <div className="border-t border-border my-2 mx-4" />
                      <p className="px-4 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Công cụ ôn tập
                      </p>

                      {/* Công cụ ôn tập */}
                      {toolLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                            isActive(link.path)
                              ? "bg-primary/10 text-primary font-semibold"
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

              {/* Đề Key Dự Đoán — top-level */}
              <Link
                to="/key-du-doan"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isKeyActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Đề Key Dự Đoán
              </Link>

              {/* Lịch sử — top-level */}
              <Link
                to="/history"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isHistoryActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <History className="w-4 h-4 text-primary" />
                Lịch sử học tập
              </Link>

              {/* More accordion */}
              <button
                onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isMoreActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-3">
                  <MoreHorizontal className="w-4 h-4 text-primary" />
                  More
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileMoreOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {mobileMoreOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-6 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => { setMobileOpen(false); setSuggestOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Lightbulb className="w-4 h-4" />
                        Đề xuất tính năng
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMobileOpen(false); setFeedbackOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Feedback
                      </button>
                      {moreLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                            isActive(link.path)
                              ? "bg-primary/10 text-primary font-semibold"
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
                  <div className="my-2 mx-4 border-t border-border" />
                  <button
                    onClick={() => setMobileAdminOpen(!mobileAdminOpen)}
                    className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isAdminActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-primary" />
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
                          {adminLinks.map((link) => (
                            <Link
                              key={link.path}
                              to={link.path}
                              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                                isActive(link.path)
                                  ? "bg-primary/10 text-primary font-semibold"
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
                </>
              )}

              <div className="my-2 mx-4 border-t border-border" />

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
                    <Link to="/dashboard">
                      <Button variant="outline" className="w-full justify-center gap-2 text-sm">
                        <Flame className="w-4 h-4 text-primary" />
                        Dashboard
                      </Button>
                    </Link>
                    {(isPro || isPremium) ? (
                      <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-extrabold">
                        <Crown className="w-3.5 h-3.5" />
                        <span>Bạn đang là thành viên PRO</span>
                        {proUntil && (
                          <span className="text-[10px] font-semibold opacity-80">
                            · đến {new Date(proUntil).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Link to="/pricing">
                        <Button className="w-full justify-center gap-2 text-sm font-bold bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white hover:brightness-110 border-0">
                          <Crown className="w-4 h-4" /> Nâng cấp Pro
                        </Button>
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link to="/auth">
                      <Button variant="outline" className="w-full justify-center gap-2 text-sm font-semibold bg-card text-foreground dark:text-foreground border-border hover:bg-muted">
                        <LogIn className="w-4 h-4" />
                        Đăng nhập
                      </Button>
                    </Link>
                    <Link to="/auth?tab=signup">
                      <Button className="w-full justify-center gap-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                        Đăng ký miễn phí
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
      <FeatureSuggestionModal open={suggestOpen} onOpenChange={setSuggestOpen} />
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </nav>
  );
};

export default Navbar;
