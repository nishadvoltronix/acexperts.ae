'use client';
import { useState } from 'react';
import { QualityImage as Image } from "./QualityImage";
import { Icon, SectionHeading } from './ui';
export interface Testimonial { quote:string; name:string; role:string; image:string; }
export function Testimonials({items}:{items:Testimonial[]}) {
  const [active,setActive]=useState(0);
  const visible=[0,1,2].map(offset=>items[(active+offset)%items.length]);
  return <section className="home-testimonials container" aria-label="Client testimonials"><SectionHeading eyebrow="What our clients say">Trusted by <span>Our Clients</span></SectionHeading><div className="testimonials-track"><button className="slider-arrow previous" aria-label="Previous testimonials" onClick={()=>setActive((active+items.length-1)%items.length)}><Icon name="arrow" size={16}/></button><div className="testimonials-grid">{visible.map((item,index)=><article key={item.name} className={`testimonial-card testimonial-position-${index}`}><span className="quote-mark" aria-hidden="true">“</span><blockquote>{item.quote}</blockquote><div className="testimonial-person"><Image src={item.image} alt="" width={44} height={44} sizes="72px"/><div><strong>{item.name}</strong><p>{item.role}</p></div></div></article>)}</div><button className="slider-arrow next" aria-label="Next testimonials" onClick={()=>setActive((active+1)%items.length)}><Icon name="arrow" size={16}/></button></div><div className="slider-dots" role="group" aria-label="Choose testimonial">{items.map((item,i)=><button key={item.name} aria-label={`Show ${item.name}'s testimonial`} aria-pressed={active===i} onClick={()=>setActive(i)}/>)}</div></section>;
}
