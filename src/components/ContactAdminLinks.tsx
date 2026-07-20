import { MessageCircle, Facebook } from "lucide-react";
import { ZALO_URL, FB_URL } from "@/config/contact";

interface Props {
  className?: string;
}

const ContactAdminLinks = ({ className = "" }: Props) => {
  const btnStyle = { backgroundColor: "#002F5F" } as const;
  return (
    <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <a
        href={ZALO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        style={btnStyle}
      >
        <MessageCircle className="w-4 h-4" />
        Zalo
      </a>
      <a
        href={FB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        style={btnStyle}
      >
        <Facebook className="w-4 h-4" />
        Facebook
      </a>
    </div>
  );
};

export default ContactAdminLinks;
