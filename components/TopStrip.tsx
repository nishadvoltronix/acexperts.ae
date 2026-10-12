import { site } from "@/lib/site";
import { CompanyLinks, SocialLinks } from "./CompanyLinks";
import { Icon } from "./ui";

export function TopStrip() {
  return (
    <div className="top-strip">
      <div className="top-strip-inner">
        <div className="top-strip-contact">
          <span className="top-strip-since">SINCE 2009</span>
          <span className="top-strip-location"><Icon name="pin" size={14} />Dubai Investment Park 02</span>
          <a href={site.phoneHref}><Icon name="phone" size={14} />{site.phone}</a>
          <a href={`mailto:${site.email}`}><Icon name="email" size={14} />{site.email}</a>
        </div>
        <div className="top-strip-group">
          <strong>Part of VOLTRONIX GROUP</strong>
          <CompanyLinks label="Header group companies" />
        </div>
        <SocialLinks label="Header social media" />
      </div>
    </div>
  );
}
