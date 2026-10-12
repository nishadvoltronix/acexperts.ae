"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { services, site } from "@/lib/site";
import { BrandLogo, Icon } from "./ui";

const desktopHoverQuery = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

const primaryLinks = [
  { title: "Home", route: "/" },
  { title: "About", route: "/about/" },
  { title: "Services", route: "/services/" },
  { title: "Projects", route: "/projects/" },
  { title: "Products", route: "/products/" },
  { title: "Blog", route: "/blog/" },
  { title: "Contact", route: "/contact-us/" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  const serviceDisclosure = useRef<HTMLDetailsElement>(null);
  const hoverOpened = useRef(false);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelHoverClose() {
    if (hoverCloseTimer.current !== null) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }

  function openOnHover(event: PointerEvent<HTMLLIElement>) {
    if (event.pointerType === "touch" || !window.matchMedia(desktopHoverQuery).matches) return;
    cancelHoverClose();
    if (serviceDisclosure.current && !serviceDisclosure.current.open) {
      serviceDisclosure.current.open = true;
      hoverOpened.current = true;
    }
  }

  function closeAfterHover(event: PointerEvent<HTMLLIElement>) {
    if (event.pointerType === "touch" || !window.matchMedia(desktopHoverQuery).matches) return;
    cancelHoverClose();
    // Give the pointer time to cross into the dropdown without interrupting
    // keyboard users who still have focus inside the disclosure.
    hoverCloseTimer.current = setTimeout(() => {
      hoverCloseTimer.current = null;
      const disclosure = serviceDisclosure.current;
      if (disclosure && !disclosure.querySelector(":focus-visible")) {
        disclosure.open = false;
        hoverOpened.current = false;
      }
    }, 180);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const disclosure = nav.current?.querySelector<HTMLDetailsElement>(
        "details[open]",
      );
      if (disclosure) {
        if (hoverCloseTimer.current !== null) clearTimeout(hoverCloseTimer.current);
        hoverCloseTimer.current = null;
        hoverOpened.current = false;
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

  useEffect(() => {
    // The shared header stays mounted during client-side navigation.
    if (serviceDisclosure.current) serviceDisclosure.current.open = false;
    hoverOpened.current = false;
    if (hoverCloseTimer.current !== null) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = null;
    return () => {
      if (hoverCloseTimer.current !== null) clearTimeout(hoverCloseTimer.current);
    };
  }, [pathname]);

  function close() {
    cancelHoverClose();
    hoverOpened.current = false;
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
          aria-label="Voltronix home"
          onClick={close}
        >
          <BrandLogo preload />
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
                onPointerEnter={item.route === "/services/" ? openOnHover : undefined}
                onPointerLeave={item.route === "/services/" ? closeAfterHover : undefined}
                onFocus={item.route === "/services/" ? cancelHoverClose : undefined}
                onBlur={item.route === "/services/" ? (event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    cancelHoverClose();
                    if (serviceDisclosure.current) serviceDisclosure.current.open = false;
                    hoverOpened.current = false;
                  }
                } : undefined}
              >
                <Link
                  href={item.route}
                  aria-current={pathname === item.route ? "page" : undefined}
                  onClick={close}
                >
                  {item.title}
                </Link>
                {item.route === "/services/" && (
                  <details ref={serviceDisclosure} className="nav-dropdown">
                    <summary
                      aria-label="Service pages"
                      onClick={(event) => {
                        // A pointer first enters before clicking. Keep that
                        // first click open; subsequent clicks toggle natively.
                        if (event.detail > 0 && hoverOpened.current) event.preventDefault();
                        hoverOpened.current = false;
                      }}
                      onKeyDown={() => { hoverOpened.current = false; }}
                    >
                      <Icon name="arrow" size={12} />
                    </summary>
                    <ul>
                      {services.map((service) => (
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
