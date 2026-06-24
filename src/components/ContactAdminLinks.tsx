import { MessageCircle, Facebook } from "lucide-react";

const ZALO_URL = "https://zalo.me/0867833227";
const FB_URL = "https://www.facebook.com/Aptiskytich";

interface Props {
  className?: string;
}

const ContactAdminLinks = ({ className = "" }: Props) => {
  return (
    <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <a
        href={ZALO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#0068FF" }}
      >
        <MessageCircle className="w-4 h-4" />
        Zalo · 0867 833 227
      </a>
      <a
        href={FB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#1877F2" }}
      >
        <Facebook className="w-4 h-4" />
        Facebook
      </a>
    </div>
  );
};

export default ContactAdminLinks;
