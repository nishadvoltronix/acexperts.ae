const contentOrigin = "https://acexperts.ae";
const linkProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Return only browser-safe links; parsed protocols also catch encoded whitespace tricks. */
export function safeContentUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const href = value.trim();
  // Backslashes can become slashes in browser URL parsing; controls can hide a scheme.
  if (!href || /[\u0000-\u001f\u007f\\]/.test(value) || href.startsWith("//"))
    return undefined;
  try {
    const url = new URL(href, contentOrigin);
    if (!linkProtocols.has(url.protocol) || url.username || url.password)
      return undefined;
    return href;
  } catch {
    return undefined;
  }
}

const contentTags = new Set([
  "a", "abbr", "address", "article", "aside", "b", "blockquote", "br", "caption",
  "cite", "code", "col", "colgroup", "dd", "del", "details", "div", "dl", "dt",
  "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "i", "img", "li", "main", "mark", "nav", "ol", "p", "pre", "s", "section",
  "small", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td",
  "tfoot", "th", "thead", "time", "tr", "u", "ul",
]);
const commonAttributes = new Set([
  "class", "id", "title", "lang", "dir", "role", "aria-label", "aria-labelledby",
  "aria-describedby", "aria-hidden",
]);

export function isAllowedContentTag(tag: string): boolean {
  return contentTags.has(tag);
}

/** Rebuild attributes explicitly; event handlers, style, srcdoc and arbitrary props never pass. */
export function safeContentAttributes(tag: string, input: Record<string, string>) {
  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(input)) {
    if (commonAttributes.has(name)) attributes[name] = value;
    else if (tag === "img" && name === "alt") attributes.alt = value;
    else if (["img", "col", "colgroup"].includes(tag) &&
      ["width", "height", "span"].includes(name) && /^[1-9]\d{0,4}$/.test(value))
      attributes[name] = value;
    else if (["td", "th"].includes(tag) && ["colspan", "rowspan"].includes(name) &&
      /^[1-9]\d{0,2}$/.test(value)) attributes[name] = value;
    else if (tag === "th" && name === "scope" && ["row", "col", "rowgroup", "colgroup"].includes(value))
      attributes.scope = value;
    else if (tag === "time" && name === "datetime") attributes.datetime = value;
    else if (tag === "details" && name === "open") attributes.open = "";
    else if (["ol", "li"].includes(tag) && ["start", "value"].includes(name) && /^-?\d{1,6}$/.test(value))
      attributes[name] = value;
    else if (tag === "ol" && name === "reversed") attributes.reversed = "";
    else if (tag === "a" && name === "target" && ["_blank", "_self"].includes(value))
      attributes.target = value;
  }
  if (attributes.target === "_blank") attributes.rel = "noopener noreferrer";
  return attributes;
}
