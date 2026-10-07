"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { services, site } from "@/lib/site";
import { BrandLogo, Icon } from "./ui";

const primaryLinks = [
  { title: "Home", route: "/" },
  { title: "Services", route: "/services/" },
  { title: "About Us", route: "/about/" },
  { title: "Why Us", route: "/#why-us" },
  { title: "Blogs", route: "/blog/" },
  { title: "Contact Us", route: "/contact-us/" },
];

const additionalLinks = [
  { title: "Our Projects", route: "/projects/" },
  { title: "Products", route: "/products/" },
  { title: "Frequently Asked Questions", route: "/faq/" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const disclosure = nav.current?.querySelector<HTMLDetailsElement>(
        "details[open]",
      );
      if (disclosure) {
        disclosure.open = false;
        disclosure.querySelector("summary")?.focus();
      } else if (open) {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    nav.current?.querySelectorAll("details").forEach((item) => {
      item.open = false;
    });
  }

  return (
    <header className="site-header">
      <div className="navigation-bar container">
        <Link
          href="/"
          className="header-brand"
          aria-label="AC Experts home"
          onClick={close}
        >
          <BrandLogo />
        </Link>
        <button
          ref={toggle}
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen(!open)}
        >
          <span>{open ? "Close" : "Menu"}</span>
          <Icon name={open ? "close" : "menu"} size={22} />
        </button>
        <nav
          ref={nav}
          id="primary-navigation"
          aria-label="Main navigation"
          className={open ? "primary-navigation is-open" : "primary-navigation"}
        >
          <ul>
            {primaryLinks.map((item) => (
              <li
                key={item.route}
                className={item.route === "/services/" ? "has-dropdown" : undefined}
              >
                <Link
                  href={item.route}
                  aria-current={pathname === item.route ? "page" : undefined}
                  onClick={close}
                >
                  {item.title}
                </Link>
                {item.route === "/services/" && (
                  <details className="nav-dropdown">
                    <summary aria-label="Service pages and more">
                      <Icon name="arrow" size={12} />
                    </summary>
                    <ul>
                      {[...services, ...additionalLinks].map((service) => (
                        <li key={service.route}>
                          <Link
                            href={service.route}
                            aria-current={pathname === service.route ? "page" : undefined}
                            onClick={close}
                          >
                            {service.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <a className="header-phone" href={site.phoneHref}>
          <span className="header-phone-icon">
            <Icon name="phone" size={21} />
          </span>
          <span>
            <strong>{site.phone}</strong>
            <small>24/7 Customer Support</small>
          </span>
        </a>
      </div>
    </header>
  );
}
