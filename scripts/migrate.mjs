import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";

// Transform the public HTML inventory into framework-independent, semantic content.
// No WordPress scripts, styles, runtime attributes, or executable source are retained.
const crawl = JSON.parse(await readFile("data/crawl.json", "utf8"));
const sourceLayout = JSON.parse(
  await readFile("data/source-layout.json", "utf8"),
);
let activeLayout = {};
const origin = crawl.origin;
const cleanText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();
const escape = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const redirects = new Map(
  crawl.pages
    .filter((p) => p.status === 200 && p.url !== p.finalUrl)
    .map((p) => [new URL(p.url).pathname, new URL(p.finalUrl).pathname]),
);
const routeOf = (value) => {
  if (!value) return "";
  if (value.startsWith("#") || /^(mailto:|tel:)/.test(value)) return value;
  if (/^(javascript:|data:)/i.test(value)) return "";
  try {
    const url = new URL(value, origin);
    if (/^(www\.)?acexperts\.ae$/.test(url.hostname)) {
      if (/\/wp-(?:admin|includes|json)\b|wp-login|\.php$/.test(url.pathname))
        return "";
      if (/\.(?:avif|webp|png|jpe?g|gif|svg|pdf)$/i.test(url.pathname))
        return url.href;
      return `${redirects.get(url.pathname) || url.pathname}${url.search}${url.hash}`;
    }
    if (/^(?:web\.)?whatsapp\.com$/.test(url.hostname)) {
      return `https://wa.me/${(url.searchParams.get("phone") || "").replace(/\D/g, "")}?text=${encodeURIComponent(url.searchParams.get("text") || "Hello")}`;
    }
    return url.href;
  } catch {
    return "";
  }
};

function semanticHtml($, nodes, options = {}) {
  const render = (node, top = false) => {
    if (node.type === "text") return escape(node.data);
    if (node.type !== "tag") return "";
    const el = $(node),
      original = node.name,
      sourceClass = el.attr("class") || "";
    const classes = new Set(sourceClass.split(/\s+/));
    const has = (name) => classes.has(name);
    const layoutKey =
      el.attr("data-id") ||
      `${el.parent().attr("data-id") || el.closest("[data-id]").attr("data-id")}:${has("e-con-inner") ? "inner" : has("elementor-container") ? "container" : has("swiper-wrapper") ? "track" : has("elementor-flip-box__front") ? "elementor-flip-box__front" : has("elementor-flip-box__back") ? "elementor-flip-box__back" : "loop"}`;
    const layout = activeLayout[layoutKey];
    const children = () =>
      (node.children || []).map((child) => render(child)).join("");
    if (
      [
        "script",
        "style",
        "noscript",
        "link",
        "meta",
        "input",
        "form",
        "iframe",
        "svg",
        "path",
      ].includes(original)
    )
      return "";
    if (original === "i" && !cleanText(el.text())) return "";
    if (
      has("elementor-swiper-button") ||
      has("swiper-pagination") ||
      has("elementor-screen-only") ||
      has("screen-reader-text") ||
      has("elementor-gallery-item__overlay") ||
      has("elementor-flip-box__layer__overlay")
    ) {
      return has("elementor-flip-box__layer__overlay") ? children() : "";
    }
    if (has("elementor-accordion-item")) {
      const question = cleanText(
        el.find(".elementor-accordion-title").first().text(),
      );
      const answer = semanticHtml(
        $,
        el.find(".elementor-tab-content").first().contents(),
      );
      return `<details class="faq-item"><summary>${escape(question)}</summary>\n<div class="faq-answer">${answer}</div></details>`;
    }
    if (has("e-n-accordion-item")) {
      const summary = el.find("summary").first();
      return `<details class="faq-item"><summary>${escape(cleanText(summary.find(".e-n-accordion-item-title-text").text() || summary.text()))}</summary><div class="faq-answer">${semanticHtml($, el.children().not("summary"))}</div></details>`;
    }
    if (has("elementor-counter-number"))
      return `<span class="stat-number">${escape(el.attr("data-to-value") || el.text())}</span>`;
    if (has("e-gallery-image") && el.attr("data-thumbnail")) {
      return `<img class="content-image" src="${escape(el.attr("data-thumbnail"))}" alt="${escape(el.attr("aria-label") || "")}" width="${escape(el.attr("data-width") || "800")}" height="${escape(el.attr("data-height") || "600")}">`;
    }
    if (
      has("elementor-widget") &&
      activeLayout[el.parent().attr("data-id")]?.display === "grid"
    )
      return `<div class="content-column">${children()}</div>`;
    if (
      has("elementor-widget-container") ||
      has("elementor-widget-wrap") ||
      has("elementor-button-content-wrapper") ||
      has("elementor-button-text") ||
      has("elementor-button-wrapper") ||
      has("elementor-image-box-content") ||
      has("elementor-icon-box-content") ||
      (has("elementor-widget") && !has("elementor-widget-testimonial"))
    )
      return children();

    let tag = original === "i" ? "em" : original;
    const mapped = [];
    const containerChildren = el.children(
      ".e-con,.elementor-column,.elementor-inner-section,.elementor-widget",
    ).length;
    const horizontal = layout
      ? layout.display === "grid" ||
        (layout.display === "flex" && layout.direction.startsWith("row"))
      : containerChildren > 1;
    const columnCount =
      layout?.display === "grid" && layout.columns !== "none"
        ? layout.columns.split(/\s+/).length
        : containerChildren;
    if (top) {
      tag = "section";
      mapped.push("content-section", `section-${options.kind || "content"}`);
    } else if (has("e-loop-item") || (tag === "article" && has("post"))) {
      tag = "article";
      mapped.push("content-card");
    } else if (has("elementor-container") || has("e-con-inner")) {
      mapped.push(
        horizontal && containerChildren > 1 ? "content-grid" : "content-inner",
      );
      if (horizontal && containerChildren > 1)
        mapped.push(`columns-${Math.min(columnCount, 5)}`);
    } else if (has("e-con") || has("elementor-column")) {
      mapped.push(
        horizontal && containerChildren > 1 ? "content-grid" : "content-column",
      );
      if (horizontal && containerChildren > 1)
        mapped.push(`columns-${Math.min(columnCount, 5)}`);
    }
    if (has("swiper-wrapper"))
      mapped.push(
        options.hero
          ? "hero-track"
          : has("elementor-image-carousel")
            ? "logo-grid"
            : "card-grid",
      );
    if (has("swiper-slide"))
      mapped.push(options.hero ? "hero-slide" : "carousel-card");
    if (has("elementor-loop-container") && !el.find(".swiper-wrapper").length)
      mapped.push("card-grid");
    if (options.heroRoot && node === nodes[0]) mapped.push("hero-slide");
    if (has("elementor-image-box-wrapper")) mapped.push("service-card");
    if (has("elementor-icon-box-wrapper")) mapped.push("feature-card");
    if (has("elementor-counter")) mapped.push("stat");
    if (has("elementor-counter-title")) mapped.push("stat-label");
    if (has("elementor-counter-number-wrapper")) mapped.push("stat-value");
    if (has("elementor-testimonial-wrapper") || has("elementor-testimonial"))
      mapped.push("testimonial");
    if (
      has("elementor-testimonial-content") ||
      has("elementor-testimonial__text")
    ) {
      tag = "blockquote";
      mapped.push("testimonial-quote");
    }
    if (has("elementor-testimonial-name") || has("elementor-testimonial__name"))
      mapped.push("testimonial-author");
    if (has("elementor-testimonial-job") || has("elementor-testimonial__title"))
      mapped.push("testimonial-role");
    if (has("elementor-testimonial__footer")) mapped.push("testimonial-footer");
    if (has("elementor-accordion") || has("e-n-accordion"))
      mapped.push("faq-list");
    if (has("elementor-gallery__container") || has("elementor-image-gallery"))
      mapped.push("gallery-grid");
    if (has("elementor-icon-list-items")) mapped.push("icon-list");
    if (has("elementor-post-info")) mapped.push("post-meta");
    if (has("elementor-pagination") || has("pagination"))
      mapped.push("pagination");
    if (has("page-numbers") && has("current")) mapped.push("current");
    if (has("elementor-button")) mapped.push("button");
    if (has("elementor-flip-box")) mapped.push("feature-card");
    if (has("elementor-heading-title") && !/^h[1-6]$/.test(tag)) {
      tag = "p";
      mapped.push("eyebrow");
    }
    if (has("elementor-image-box-title") || has("elementor-icon-box-title"))
      mapped.push("card-title");
    if (tag === "img") mapped.push("content-image");
    if (tag === "search" || has("e-filter")) {
      tag = "nav";
      mapped.push("project-filters");
    }
    if (
      tag === "span" &&
      /font-weight:\s*(?:[6-9]00|bold)/.test(el.attr("style") || "")
    )
      tag = "strong";

    const backgroundUrls = layout?.backgrounds || [];
    const imagePanel =
      backgroundUrls.length > 0 &&
      !cleanText(el.text()) &&
      !el.find("img").length;
    if (backgroundUrls.length)
      mapped.push(imagePanel ? "media-panel" : "has-background");
    let attrs = mapped.length
      ? ` class="${[...new Set(mapped)].join(" ")}"`
      : "";
    if (tag === "a") {
      const href = routeOf(el.attr("href"));
      if (href) attrs += ` href="${escape(href)}"`;
      else tag = "span";
      if (href && el.attr("target") === "_blank")
        attrs += ' target="_blank" rel="noopener noreferrer"';
    }
    if (tag === "img") {
      const src = el.attr("data-src") || el.attr("src");
      if (!src || src.startsWith("data:")) return "";
      attrs += ` src="${escape(new URL(src, origin).href)}" alt="${escape(el.attr("alt") || "")}"`;
      for (const name of ["width", "height"])
        if (/^\d+$/.test(el.attr(name) || ""))
          attrs += ` ${name}="${el.attr(name)}"`;
    }
    if (tag === "time" && el.attr("datetime"))
      attrs += ` datetime="${escape(el.attr("datetime"))}"`;
    if (tag === "th" || tag === "td")
      for (const name of ["colspan", "rowspan", "scope"])
        if (el.attr(name)) attrs += ` ${name}="${escape(el.attr(name))}"`;
    if (tag === "button") {
      tag = "span";
      attrs = ' class="filter-label"';
    }
    if (el.attr("id") && !/^(?:elementor|zf_div|wp-|e-n-)/.test(el.attr("id")))
      attrs += ` id="${escape(el.attr("id"))}"`;
    if (["br", "hr", "img"].includes(tag)) return `<${tag}${attrs}>`;
    const backgroundHtml = backgroundUrls
      .map(
        (url) =>
          `<img class="${imagePanel ? "content-image" : "section-background"}" src="${escape(url)}" alt="">`,
      )
      .join("");
    const body = backgroundHtml + children();
    if (!cleanText(load(body).text()) && !/<(?:img|hr|br)\b/.test(body))
      return body;
    if (tag === "div" && !attrs) return body;
    return `<${tag}${attrs}>${body}</${tag}>`;
  };
  return nodes
    .toArray()
    .map((node) => render(node, options.top))
    .join("")
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

function pageMain($) {
  const main = $("main").first();
  if (main.length) return main;
  return $(
    '[data-elementor-type="single-post"], [data-elementor-type="single"], [data-elementor-type="archive"]',
  ).first();
}
function faqData($, root) {
  const faqs = [];
  root.find(".elementor-accordion-item").each((_, node) => {
    const el = $(node);
    faqs.push({
      question: cleanText(el.find(".elementor-accordion-title").first().text()),
      answerHtml: semanticHtml(
        $,
        el.find(".elementor-tab-content").first().contents(),
      ),
    });
  });
  root.find(".e-n-accordion-item").each((_, node) => {
    const el = $(node);
    faqs.push({
      question: cleanText(
        el.find(".e-n-accordion-item-title-text").first().text(),
      ),
      answerHtml: semanticHtml($, el.children().not("summary")),
    });
  });
  return faqs.filter((faq) => faq.question && faq.answerHtml);
}
function cardData($, root) {
  const cards = [];
  root.find(".e-loop-item, article.post").each((_, node) => {
    const el = $(node),
      heading = el.find("h1,h2,h3,h4").first(),
      anchor = heading.find("a").first();
    const title = cleanText(heading.text()),
      route = routeOf(
        anchor.attr("href") || el.find("a[href]").first().attr("href"),
      );
    if (!title || !route || route === "#") return;
    cards.push({
      route,
      title,
      image: el.find("img").first().attr("src") || "",
      excerpt: cleanText(el.find("p").first().text()),
      date: cleanText(el.find("time").first().text()),
    });
  });
  return [...new Map(cards.map((card) => [card.route, card])).values()];
}
const homeKinds = [
  "hero",
  "benefits",
  "about",
  "cta",
  "services-heading",
  "services",
  "stats",
  "benefits",
  "projects",
  "testimonials",
  "blog",
  "faq",
];
const byRoute = new Map();
for (const source of crawl.pages.filter((page) => page.status === 200)) {
  if (!byRoute.has(source.route) || source.url === source.finalUrl)
    byRoute.set(source.route, source);
}
const pages = [];
for (const source of byRoute.values()) {
  activeLayout = sourceLayout.pages[source.route] || {};
  const $ = load(await readFile(source.sourceFile, "utf8"));
  const main = pageMain($);
  if (!main.length)
    throw new Error(`Missing content container: ${source.route}`);
  const type =
    source.route === "/project-portfolio/"
      ? "projects"
      : source.route.startsWith("/project-portfolio/")
        ? "project"
        : source.type;
  const migrationNotes = [];
  if (source.route === "/faq/") {
    main.find(".elementor-top-column").each((_, node) => {
      const text = cleanText($(node).text());
      if (
        text.includes("1105 Rooseveltan Street") &&
        text.includes("info@example.com")
      ) {
        migrationNotes.push({
          reason:
            "Removed unrelated theme demonstration sidebar with fake US address, placeholder phone/email and unavailable brochure.",
          sourceText: text,
        });
        $(node).remove();
      }
    });
  }
  if (type === "service") {
    main
      .find("*")
      .contents()
      .filter(
        (_, node) =>
          node.type === "text" && node.data.includes("info@switchgear.com"),
      )
      .each((_, node) => {
        node.data = node.data.replaceAll(
          "info@switchgear.com",
          "info@voltronix.ae",
        );
      });
    main
      .find('a[href="mailto:info@switchgear.com"]')
      .attr("href", "mailto:info@voltronix.ae");
    migrationNotes.push({
      reason:
        "Corrected the stale service-sidebar email info@switchgear.com to the company email info@voltronix.ae published on the contact page.",
    });
  }
  main
    .find("a")
    .filter(
      (_, node) =>
        cleanText($(node).text()) === "Emergency AC Maintenance" &&
        routeOf($(node).attr("href")) === "/ac-repair-services/",
    )
    .each((_, node) => {
      $(node).attr("href", "/emergency-ac-maintenance-service/");
      migrationNotes.push({
        reason:
          "Corrected the Emergency AC Maintenance service card link, which pointed to the general repair page in the source.",
      });
    });
  main.find(".elementor-counter-number").each((_, node) => {
    if ($(node).attr("data-to-value")) {
      migrationNotes.push({
        reason:
          "Rendered the source counter final value without requiring animation.",
        label: cleanText(
          $(node)
            .closest(".elementor-counter")
            .find(".elementor-counter-title")
            .text(),
        ),
        value: $(node).attr("data-to-value"),
      });
    }
  });
  // The mobile filter is a responsive duplicate of the same desktop choices.
  if (source.route === "/projects/")
    main
      .find(".elementor-hidden-desktop.elementor-hidden-tablet")
      .filter(
        (_, node) =>
          $(node).find('[data-widget_type="taxonomy-filter.default"]').length >
          0,
      )
      .remove();
  main.find('[data-widget_type="html.default"]').each((_, node) => {
    if ($(node).find('[id^="zf_div_"]').length)
      migrationNotes.push({
        reason:
          "Replaced the source Zoho script-driven form with the local contact form component.",
      });
  });
  const schemas = source.schemas.flatMap(
    (schema) => schema["@graph"] || [schema],
  );
  const articleSchema = schemas.find((schema) =>
    ["Article", "BlogPosting"].includes(schema["@type"]),
  );
  const featured = main
    .find('[data-widget_type="theme-post-featured-image.default"] img')
    .first();
  const page = {
    route: source.route,
    type,
    title: source.title,
    h1:
      source.h1[0] ||
      (source.route === "/project-portfolio/"
        ? "Projects"
        : source.title.replace(/ Archives.*$| [|–] .*$/g, "")),
    description: source.description,
    canonical: source.canonical || `${origin}${source.route}`,
    robots: source.robots,
    heroImage:
      featured.attr("src") || main.find("img").first().attr("src") || "",
    sourceUrl: source.finalUrl,
    sourceFile: source.sourceFile,
    contentHtml: "",
    sections: [],
    faqs: faqData($, main),
    cards: cardData($, main),
    migrationNotes,
  };
  let contentRoot = main;
  if (type === "article") {
    contentRoot = main
      .find('[data-widget_type="theme-post-content.default"]')
      .first();
    if (!contentRoot.length)
      throw new Error(`Missing article body: ${source.route}`);
    page.contentHtml = semanticHtml($, contentRoot.contents());
    page.sections = [
      { id: "article-body", kind: "article", html: page.contentHtml },
    ];
    const categories = main
      .find('[data-widget_type="post-info.default"]')
      .first()
      .find('a[href*="/category/"]')
      .map((_, node) => ({
        name: cleanText($(node).text()),
        route: routeOf($(node).attr("href")),
      }))
      .get();
    page.article = {
      author:
        articleSchema?.author?.name ||
        cleanText(main.find(".elementor-author-box__name").first().text()),
      authorBio: cleanText(
        main.find(".elementor-author-box__bio").first().text(),
      ),
      authorImage:
        main.find(".elementor-author-box__avatar img").first().attr("src") ||
        "",
      published: articleSchema?.datePublished || "",
      modified: articleSchema?.dateModified || "",
      categories,
    };
    const sidebar = main.children().first().clone();
    sidebar
      .find(
        '[data-widget_type="theme-post-content.default"], [data-widget_type="theme-post-title.default"], [data-widget_type="theme-post-featured-image.default"], [data-widget_type="author-box.default"], [data-widget_type="post-info.default"], [data-widget_type="share-buttons.default"]',
      )
      .remove();
    page.sidebarHtml = semanticHtml($, sidebar.contents());
    page.cards = page.cards.filter((card) => card.route !== page.route);
    page.faqs = faqData($, contentRoot);
  } else {
    const elementorRoot = main
      .find('[data-elementor-post-type="page"]')
      .first();
    contentRoot = elementorRoot.length ? elementorRoot : main;
    contentRoot.children().each((index, node) => {
      const section = $(node),
        text = cleanText(section.text());
      let kind = type === "home" ? homeKinds[index] || "content" : "content";
      if (
        type !== "home" &&
        section.find(".elementor-accordion-item,.e-n-accordion-item").length
      )
        kind = "faq";
      else if (type !== "home" && /TRUST IN US|Trust in us/.test(text))
        kind = "cta";
      else if (type !== "home" && section.find("h1").length) kind = "intro";
      const html = semanticHtml($, section, {
        top: true,
        kind,
        hero: kind === "hero",
      });
      if (html) page.sections.push({ id: `section-${index + 1}`, kind, html });
    });
    page.contentHtml = page.sections.map((section) => section.html).join("\n");
  }
  if (type === "home") {
    page.slides = main
      .find('[data-widget_type="nested-carousel.default"] .swiper-slide')
      .map((_, node) => {
        const slide = $(node);
        return {
          html: semanticHtml($, slide.children(".e-con").first(), {
            hero: true,
            heroRoot: true,
          }),
          image: slide.find("img").first().attr("src") || "",
          title: cleanText(
            slide.find(".elementor-heading-title").first().text(),
          ),
        };
      })
      .get();
    page.stats = main
      .find(".elementor-counter")
      .map((_, node) => ({
        label: cleanText($(node).find(".elementor-counter-title").text()),
        value: `${$(node).find(".elementor-counter-number").attr("data-to-value") || ""}${cleanText($(node).find(".elementor-counter-number-suffix").text())}`,
      }))
      .get();
  }
  if (type === "project") {
    page.gallery = main
      .find(".e-gallery-image[data-thumbnail]")
      .map((_, node) => ({
        image: $(node).attr("data-thumbnail"),
        alt: $(node).attr("aria-label") || "",
      }))
      .get();
    page.projectFacts = main
      .find(".elementor-icon-box-wrapper")
      .map((_, node) => ({
        label: cleanText($(node).find(".elementor-icon-box-title").text()),
        value: cleanText(
          $(node).find(".elementor-icon-box-description").text(),
        ),
      }))
      .get();
    page.heroImage ||= page.gallery[0]?.image || "";
  }
  if (type !== "article") {
    const rendered = load(page.contentHtml);
    const contentImages = rendered("img").filter(
      (_, node) => !rendered(node).closest(".logo-grid").length,
    );
    const serviceImage =
      type === "service"
        ? rendered(".media-panel img").first().attr("src")
        : "";
    page.heroImage = serviceImage || contentImages.first().attr("src") || "";
  }
  const migratedText = cleanText(load(page.contentHtml).text());
  if (type === "article" && migratedText !== cleanText(contentRoot.text()))
    throw new Error(`Article text preservation failed: ${page.route}`);
  page.preservation = {
    sourceContentWords: cleanText(contentRoot.text()).split(/\s+/).length,
    migratedContentWords: migratedText.split(/\s+/).length,
    scope:
      type === "article"
        ? "Complete article body; author metadata and related cards stored separately."
        : "Complete main content, excluding documented runtime and placeholder artifacts.",
  };
  pages.push(page);
}
pages.sort((a, b) => a.route.localeCompare(b.route));
await writeFile("data/pages.json", JSON.stringify(pages, null, 2));
console.log(
  `Migrated ${pages.length} routes (${pages.filter((page) => page.type === "article").length} complete articles, ${pages.reduce((count, page) => count + page.faqs.length, 0)} FAQ entries).`,
);
