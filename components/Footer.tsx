import Link from "next/link";
import { services, site } from "@/lib/site";
import { BrandLogo, Icon } from "./ui";
import { NewsletterForm } from "./NewsletterForm";

const quickLinks = [
  { title: "Home", route: "/" },
  { title: "About Us", route: "/about/" },
  { title: "Why Us", route: "/#why-us" },
  { title: "Blogs", route: "/blog/" },
  { title: "Contact Us", route: "/contact-us/" },
];

function SocialLinks() {
  return (
    <nav className="social-links" aria-label="Social media">
      <a href="https://www.facebook.com/voltronixuae" aria-label="AC Experts on Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 21v-8h3l.5-4H14V7c0-1 .4-2 2-2h2V1.5C17 1.2 16 1 15 1c-3 0-5 2-5 5v3H7v4h3v8h4Z" /></svg>
      </a>
      <a href="https://www.instagram.com/vtnxllc" aria-label="AC Experts on Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>
      </a>
      <a href="https://www.linkedin.com/company/voltronix-uae/" aria-label="AC Experts on LinkedIn">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 8h4v13H4V8Zm2-7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm5 7h4v2c1-2 6-3 7 2v9h-4v-8c0-3-3-3-3 0v8h-4V8Z" /></svg>
      </a>
      <a href="https://x.com/nstsllc" aria-label="AC Experts on X">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 3 13 18h4L8 3H4Zm0 18L20 3" /></svg>
      </a>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid container">
        <div className="footer-brand">
          <Link href="/" aria-label="AC Experts home">
            <BrandLogo />
          </Link>
          <p>
            AC Experts provides AC repair, installation and maintenance services
            in Dubai &amp; UAE.
          </p>
          <SocialLinks />
          <details className="footer-details footer-group">
            <summary>Part of Voltronix Group</summary>
            <p>
              Our team of specialists from varying disciplines will guarantee the
              provision of integrated solutions to finish your task by drawing on
              their experience from the collection of our completed projects.
            </p>
            <ul>
              <li><a href="https://voltronix.ae">Contracting</a></li>
              <li><a href="https://dewaapprovals.ae">DEWA Approvals</a></li>
              <li><a href="https://switchgear.ae">Switchgear</a></li>
            </ul>
          </details>
        </div>
        <div className="footer-links">
          <h2>Quick Links</h2>
          <ul>
            {quickLinks.map((item) => (
              <li key={item.route}><Link href={item.route}>{item.title}</Link></li>
            ))}
          </ul>
        </div>
        <div className="footer-services">
          <h2><Link href="/services/">Our Services</Link></h2>
          <ul>
            {services.map((service) => (
              <li key={service.route}><Link href={service.route}>{service.title}</Link></li>
            ))}
            <li><Link href="/projects/">Our Projects</Link></li>
            <li><Link href="/products/">Products</Link></li>
          </ul>
        </div>
        <div className="footer-contact">
          <h2>Contact Us</h2>
          <ul className="footer-contact-list">
            <li><Icon name="phone" size={17} /><a href={site.phoneHref}>{site.phone}</a></li>
            <li><Icon name="email" size={17} /><a href={`mailto:${site.email}`}>{site.email}</a></li>
            <li><Icon name="pin" size={17} /><span>Dubai, UAE</span></li>
            <li><Icon name="clock" size={17} /><span>24/7 Customer Support</span></li>
          </ul>
          <details className="footer-details">
            <summary>Address &amp; business hours</summary>
            <address><strong>VOLTRONIX</strong><br />{site.address}</address>
            <p>Mobile: <a href="tel:+971502420957">{site.mobile}</a></p>
            <p><a href={site.whatsapp}>Contact AC Experts on WhatsApp</a></p>
            <p>{site.hours}</p>
          </details>
        </div>
        <div className="footer-newsletter">
          <h2>Newsletter</h2>
          <p>Subscribe to get updates &amp; offers.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="footer-bottom container">
        <p>© 2026 AC Experts. All Rights Reserved.</p>
        <div className="footer-bottom-links">
          <Link href="/faq/">FAQs</Link>
          <span aria-hidden="true">|</span>
          <Link href="/contact-us/">Contact Us</Link>
        </div>
      </div>
    </footer>
  );
}
