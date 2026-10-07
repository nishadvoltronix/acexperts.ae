import { Button, Icon, ReferenceArt, type IconName } from './ui';
import { site } from '@/lib/site';
export function SharedCTA() {
  const features: {icon:IconName;lines:string[]}[]=[{icon:'clock',lines:['24/7','Support']},{icon:'shield',lines:['Quick','Response']},{icon:'users',lines:['Expert','Technicians']}];
  return <section className="shared-cta container" aria-labelledby="support-heading"><div className="cta-card"><div className="cta-copy"><span className="eyebrow">Need immediate help?</span><h2 id="support-heading">We’re Just a <span>Call Away!</span></h2><p>Our customer support team is available 24/7<br className="desktop-break"/> to assist you anytime, anywhere in UAE.</p><Button href={site.phoneHref} arrow={false}><Icon name="phone" size={20}/>{site.phone}</Button></div><div className="cta-features">{features.map(f=><div key={f.icon}><span className="icon-orb"><Icon name={f.icon}/></span><p>{f.lines[0]}<br/>{f.lines[1]}</p></div>)}</div><ReferenceArt crop="cta" alt="AC Experts technician beside a branded service van" className="cta-art"/></div></section>;
}
