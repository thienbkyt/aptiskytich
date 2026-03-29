import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import logoImg from "@/assets/logo.png";

const Footer = () => (
  <footer className="bg-sidebar text-sidebar-foreground/80 section-padding">
    <div className="section-container">
      <div className="grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-lg text-sidebar-foreground">
              Aptis Kỳ Tích
            </span>
          </div>
          <p className="text-sm text-sidebar-foreground/50 leading-relaxed">
            Nền tảng luyện thi Aptis miễn phí. Giúp bạn đạt B1–B2 nhanh nhất.
          </p>
        </div>
        <div>
          <h4 className="font-heading font-semibold text-sidebar-foreground mb-4">Luyện tập</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/mock-test" className="hover:text-sidebar-foreground transition-colors">Thi thử Aptis</Link></li>
            <li><Link to="/practice" className="hover:text-sidebar-foreground transition-colors">Luyện Grammar</Link></li>
            <li><Link to="/practice" className="hover:text-sidebar-foreground transition-colors">Luyện Reading</Link></li>
            <li><Link to="/practice" className="hover:text-sidebar-foreground transition-colors">Luyện Listening</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold text-sidebar-foreground mb-4">Khóa học</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/course" className="hover:text-sidebar-foreground transition-colors">Aptis Kỳ Tích – 7 Ngày</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-semibold text-sidebar-foreground mb-4">Liên hệ</h4>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> contact@aptiskytich.vn</li>
            <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> 0909 xxx xxx</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sidebar-border mt-12 pt-8 text-center text-sm text-sidebar-foreground/30">
        © 2026 Aptis Kỳ Tích. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
