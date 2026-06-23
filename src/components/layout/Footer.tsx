import { Link } from "react-router-dom";
import { Mail, Phone, MessageCircle, Facebook, Youtube, ArrowUpRight } from "lucide-react";
import logoImg from "@/assets/logo.webp";

const Footer = () => (
  <footer className="relative bg-sidebar text-sidebar-foreground/80 overflow-hidden">
    {/* Top glow bar */}
    <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
    <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 blur-[120px] pointer-events-none" />

    <div className="section-padding section-container relative">
      <div className="grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <img src={logoImg} alt="Aptis Kỳ Tích" className="h-10 w-auto" />
            <span className="font-heading font-bold text-lg text-sidebar-foreground">
              Aptis <span className="gradient-text">Kỳ Tích</span>
            </span>
          </div>
          <p className="text-sm text-sidebar-foreground/50 leading-relaxed mb-5">
            Nền tảng luyện thi Aptis có AI Kỳ Tích hỗ trợ. Giúp bạn đạt B1–B2 nhanh nhất.
          </p>
          <div className="flex items-center gap-2">
            {[
              { Icon: Facebook, href: "https://facebook.com", label: "Facebook" },
              { Icon: Youtube, href: "https://youtube.com", label: "YouTube" },
              { Icon: MessageCircle, href: "https://zalo.me/0867833227", label: "Zalo" },
            ].map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-9 h-9 rounded-lg border border-sidebar-border/60 flex items-center justify-center text-sidebar-foreground/70 hover:text-primary hover:border-primary/60 hover:shadow-glow-soft transition-all"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-heading font-semibold text-sidebar-foreground mb-4 uppercase text-xs tracking-wider">Luyện tập</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/grammar" className="hover:text-primary transition-colors">Grammar & Vocab</Link></li>
            <li><Link to="/reading" className="hover:text-primary transition-colors">Reading</Link></li>
            <li><Link to="/listening" className="hover:text-primary transition-colors">Listening</Link></li>
            <li><Link to="/speaking" className="hover:text-primary transition-colors">Speaking</Link></li>
            <li><Link to="/writing" className="hover:text-primary transition-colors">Writing</Link></li>
            <li><Link to="/vocabulary" className="hover:text-primary transition-colors">Học từ vựng</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold text-sidebar-foreground mb-4 uppercase text-xs tracking-wider">Tính năng</h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link to="/thi-thu" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                Thi thử Aptis <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </li>
            <li>
              <Link to="/grammar" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                Luyện theo kỹ năng <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </li>
            <li>
              <Link to="/speaking" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                AI chấm Speaking–Writing <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </li>
            <li>
              <Link to="/progress" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                Theo dõi tiến bộ <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold text-sidebar-foreground mb-4 uppercase text-xs tracking-wider">Liên hệ</h4>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> aptiskytich.admin@gmail.com</li>
            <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> 0867 833 227</li>
            <li className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" />
              <a href="https://zalo.me/0867833227" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                Zalo: 0867 833 227
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sidebar-border/60 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-sidebar-foreground/40">
        <div>© 2026 Aptis Kỳ Tích. All rights reserved.</div>
        <div className="text-xs">Made with <span className="text-primary">♥</span> for Aptis Kỳ Tích</div>
      </div>
    </div>
  </footer>
);

export default Footer;
