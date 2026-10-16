import { site } from "@/lib/site";

export function FloatingWhatsApp() {
  return (
    <a
      className="floating-whatsapp"
      href={site.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Voltronix on WhatsApp"
      title="Chat with Voltronix on WhatsApp"
    >
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 3.5a12.5 12.5 0 0 0-10.7 19L3.5 28.5l6.2-1.7A12.5 12.5 0 1 0 16 3.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M11.4 10.5c-.5-.2-1 .1-1.3.6-.7 1.1-.8 2.1-.2 3.4 1.3 3 3.8 5.5 6.8 6.8 1.3.6 2.3.5 3.4-.2.5-.3.8-.8.6-1.3l-3.4-1.6c-.4-.2-.8-.1-1.1.2l-.9 1.1a10.2 10.2 0 0 1-4.4-4.4l1.1-.9c.3-.3.4-.7.2-1.1l-1.6-3.4Z" fill="currentColor" />
      </svg>
    </a>
  );
}
