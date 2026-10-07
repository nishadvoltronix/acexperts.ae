import Link from 'next/link';
import { QualityImage as Image } from "./QualityImage";
import { getAsset } from '@/lib/content';
import type { PageData } from '@/lib/types';
import { Button, Container, Icon, SectionHeading, ACIcon, ReferenceArt, type IconName } from './ui';
import { SharedCTA } from './SharedCTA';
import { Testimonials, type Testimonial } from './Testimonials';

const features: {icon:IconName;title:string;subtitle:string}[] = [{icon:'clock',title:'24/7',subtitle:'Emergency Service'},{icon:'shield',title:'Certified',subtitle:'AC Technicians'},{icon:'bolt',title:'Quick & Reliable',subtitle:'Service'},{icon:'thumb',title:'100% Satisfaction',subtitle:'Guarantee'}];
const cards = [{type:'repair',title:'AC Repair',text:'Fast & reliable repair for all AC brands.',route:'/ac-repair-services/'},{type:'installation',title:'AC Installation',text:'Professional installation for residential & commercial spaces.',route:'/ac-installation-service/'},{type:'maintenance',title:'AC Maintenance',text:'Keep your AC running efficiently with our maintenance plans.',route:'/preventive-ac-maintenance-service/'},{type:'cleaning',title:'AC Cleaning',text:'Improve air quality with deep AC cleaning.',route:'/services/'}] as const;
const stats:{icon:IconName;value:string;label:string}[]=[{icon:'heart',value:'156',label:'Clients'},{icon:'award',value:'15+',label:'Years of Experience'},{icon:'users',value:'200',label:'Proactive Team'},{icon:'shield',value:'100%',label:'Satisfaction Guarantee'}];
const promises:{icon:IconName;title:string;subtitle:string}[]=[{icon:'clock',title:'24/7',subtitle:'Emergency Support'},{icon:'clock',title:'On-Time',subtitle:'Service'},{icon:'price',title:'Affordable',subtitle:'Pricing'},{icon:'gear',title:'Quality Parts',subtitle:'Expert Repairs'},{icon:'award',title:'Warranty',subtitle:'On Our Work'},{icon:'shield',title:'Trusted Across',subtitle:'UAE'}];
const reviews:Testimonial[]=[
{quote:'I was impressed with the quick response and quality of work provided by the Voltronix AC Expert’s professional technicians. They fixed my AC unit in no time, and it has been working perfectly ever since.',name:'Muhammed Navas',role:'CEO',image:'https://acexperts.ae/wp-content/uploads/2024/08/farmer-black-vest-plaid-shirt-standing-near-cattle-pen-Phone.jpg'},
{quote:'The technician who came to my home was knowledgeable, friendly, and professional. They were able to diagnose the problem with my AC and fix it in a timely manner. I would definitely recommend their services.',name:'Juan',role:'Manager',image:'https://acexperts.ae/wp-content/uploads/2024/08/close-up-young-arabian-man-holding-phone-handsome-bearded-man-speaking-mobile-phone-reflecting-shop-glass-outdoors-communication-modern-technology-concept-Phone.jpg'},
{quote:'I was in a bit of a panic when my AC stopped working on a hot summer day, but the team at Voltronix AC Experts quickly came to my rescue. They were able to repair my unit, and I was back to feeling comfortable in no time.',name:'Jane Jacob',role:'Operating Officer',image:'https://acexperts.ae/wp-content/uploads/2019/05/testimonial3.png'},
{quote:'I was pleased with the attention to detail and the customer service provided by Voltronix AC Experts. They went above and beyond to make sure my AC was running efficiently and that I was completely satisfied with their services.',name:'Lookman',role:'Administrative Officer',image:'https://acexperts.ae/wp-content/uploads/2024/08/front-view-smiley-man-posing-Phone.jpg'},
];
const brandDefinitions: {name:string;source?:string;crop?:'brandSamsung'|'brandPanasonic'}[] = [
  {name:'Daikin',source:'https://acexperts.ae/wp-content/uploads/2023/03/5.png'},
  {name:'LG',source:'https://acexperts.ae/wp-content/uploads/2023/03/6.png'},
  {name:'Samsung',crop:'brandSamsung'},
  {name:'Mitsubishi',source:'https://acexperts.ae/wp-content/uploads/2023/03/7.png'},
  {name:'Gree',source:'https://acexperts.ae/wp-content/uploads/2023/03/3.png'},
  {name:'Panasonic',crop:'brandPanasonic'},
  {name:'General',source:'https://acexperts.ae/wp-content/uploads/2023/03/1.png'},
];
export function HomePage({page}:{page:PageData}) {
  const testimonials=reviews.map(review=>{
    const portrait=getAsset(review.image);
    if(!portrait) throw new Error(`Missing migrated testimonial portrait: ${review.name}`);
    return {...review,image:portrait.localPath};
  });
  const brands=brandDefinitions.map(brand=>({...brand,asset:brand.source?getAsset(brand.source):undefined}));
  return <div className="home-page"><h1 className="sr-only">{page.h1}</h1><section className="home-hero"><Container><div className="home-hero-copy"><span className="hero-kicker"><Icon name="award" size={16}/>AC REPAIR & MAINTENANCE IN UAE</span><h2>Keeping You Cool,<br/><span>Every Day.</span></h2><p>AC Experts provides professional AC repair, installation and<br className="desktop-break"/> maintenance services across Dubai & UAE.</p><div className="hero-features">{features.map(f=><div key={f.icon}><Icon name={f.icon}/><span><strong>{f.title}</strong><small>{f.subtitle}</small></span></div>)}</div><div className="hero-actions"><Button href="/contact-us/">Book a Service</Button><Button href="/services/" secondary>Our Services</Button></div></div></Container><ReferenceArt crop="hero" alt="AC Experts technician servicing a wall-mounted air conditioner" className="hero-art" priority><span className="hero-diagnostics"><span className="diagnostics-icon"><Icon name="cpu"/></span><span><strong>Expert<br/>AC Diagnostics</strong><small>Faster. Smarter. Reliable.</small></span></span></ReferenceArt><div className="hero-dots" aria-hidden="true"/></section>
  <section className="home-services container" id="our-services"><SectionHeading eyebrow="Our services">Complete AC Solutions for<br/><span>Homes & Businesses</span></SectionHeading><div className="service-grid">{cards.map(card=><article className="service-card" key={card.type}><div className="service-icon-orb"><ACIcon type={card.type}/></div><h3><Link href={card.route}>{card.title}</Link></h3><p>{card.text}</p><Link href={card.route} className="learn-more">Learn More <span aria-hidden="true">→</span></Link></article>)}</div></section>
  <section className="home-why" id="why-us"><Container><div className="why-copy"><span className="eyebrow">Why choose us</span><h2>Experience the AC Experts<br/><span>Difference</span></h2><p>We combine skilled professionals, advanced tools, and a customer-first approach to deliver unmatched AC services you can rely on.</p><Button href="/about/">About Us</Button></div><div className="stats-grid">{stats.map(stat=><div className="stat-card" key={stat.label}><span className="icon-orb"><Icon name={stat.icon}/></span><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div></Container><ReferenceArt crop="skyline" className="skyline-art"/></section>
  <section className="promise-band"><Container><h2>We Make AC Services Simple, Fast & Reliable!</h2><span className="heading-rule" aria-hidden="true"><i/></span><div className="promise-grid">{promises.map(p=><div key={p.title}><span className="promise-icon"><Icon name={p.icon}/></span><p><strong>{p.title}</strong><span>{p.subtitle}</span></p></div>)}</div></Container></section>
  <section className="home-brands container"><SectionHeading>We Service <span>All Major Brands</span></SectionHeading><div className="brand-row">{brands.map(brand=><div key={brand.name}>{brand.crop?<ReferenceArt crop={brand.crop} alt={brand.name} className="brand-art"/>:brand.asset?<Image src={brand.asset.localPath} alt={brand.name} width={brand.asset.width||160} height={brand.asset.height||60} sizes="130px"/>:<span className={`brand-word brand-${brand.name.toLowerCase()}`}>{brand.name}</span>}</div>)}</div><span className="brand-indicator" aria-hidden="true"><i/><i/><i/></span></section>
  <Testimonials items={testimonials}/><SharedCTA/></div>;
}
