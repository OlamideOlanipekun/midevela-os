import { extractDocument } from "@/server/website/extraction/document";

/**
 * Knowledge extraction from a single policy/FAQ page.
 *
 * Deterministic. Sections are harvested from heading/paragraph structure;
 * content is normalized (tags stripped, entities decoded). The orchestrator
 * persists these as KnowledgeEntry rows (type POLICY/FAQ/DOCUMENT) and each
 * persisted entry carries sourceUrl + pageId for grounding.
 */

export interface ExtractedKnowledgeEntry {
  type: "POLICY" | "FAQ" | "DOCUMENT";
  title: string;
  content: string;
  sourceUrl: string;
  /** sections keyed casually as heading → body, for the UI to show. */
  sections: Array<{ heading: string; body: string }>;
}

const POLICY_HEADING_RE =
  /^(shipping|delivery|return|returns|refund|refunds|privacy|terms|warranty|payment|cancellation|cancel|faq|frequently asked)/i;

/**
 * Extract knowledge from a page.
 *
 * Order of preference:
 *  1. FAQ pairs (heading + following paragraph) → one FAQ entry each.
 *  2. Policy headings → one POLICY entry with sections.
 *  3. Otherwise → one DOCUMENT entry (title + content).
 * Returns [] when the page has no usable text.
 */
export function extractKnowledge(
  html: string,
  pageUrl: string
): ExtractedKnowledgeEntry[] {
  const doc = extractDocument(html, { baseUrl: pageUrl });

  if (doc.h1s.length + doc.paragraphs.length + doc.headings.length === 0) {
    return [];
  }

  const title = doc.title || doc.h1s[0] || pageUrl;
  const out: ExtractedKnowledgeEntry[] = [];

  // 1. FAQ pairs.
  const faqPairs = extractFaqPairs(doc.headings, doc.paragraphs);
  if (faqPairs.length > 0) {
    for (const faq of faqPairs.slice(0, 30)) {
      out.push({
        type: "FAQ",
        title: faq.q.slice(0, 300),
        content: faq.a.slice(0, 8000),
        sourceUrl: pageUrl,
        sections: [],
      });
    }
    return out;
  }

  // 2. Policy page → grouped sections.
  const sections = buildSections(doc.headings, doc.paragraphs);
  const policySections = sections.filter((s) => POLICY_HEADING_RE.test(s.heading));
  if (policySections.length > 0) {
    out.push({
      type: "POLICY",
      title: title.slice(0, 500),
      content: policySections
        .map((s) => `${s.heading}\n${s.body}`)
        .join("\n\n")
        .slice(0, 12000),
      sourceUrl: pageUrl,
      sections: policySections,
    });
    return out;
  }

  // 3. Fallback document entry.
  const content = sections
    .map((s) => (s.heading ? `${s.heading}\n${s.body}` : s.body))
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
  if (!content.trim()) return [];

  out.push({
    type: "DOCUMENT",
    title: title.slice(0, 500),
    content,
    sourceUrl: pageUrl,
    sections,
  });
  return out;
}

interface Section {
  heading: string;
  body: string;
}

/**
 * Build sections by walking the document's paragraphs in order and attaching
 * each to the most recent heading. Headings/text-level structure is:
 *   h2 "Shipping" ... p1 p2 h3 "Delivery times" ... p3
 * produces [{heading:"Shipping", body:"p1 p2"}, {heading:"Delivery times", body:"p3"}].
 */
function buildSections(
  headings: Array<{ level: number; text: string }>,
  paragraphs: string[]
): Section[] {
  const sections: Section[] = [];
  let headingCursor = 0;
  let paraCursor = 0;

  while (paraCursor < paragraphs.length) {
    const heading = headings[headingCursor];
    const body: string[] = [];

    // First paragraph of this block isn't the heading text (headings are
    // separate nodes) — attach it to the current heading.
    if (heading) {
      // Attach consecutive paragraphs to this heading until the next heading
      // slot *would* overlap (we keep it simple: chunk until 4k chars).
      let prefix = "";
      while (
        paraCursor < paragraphs.length &&
        prefix.length < 3500
      ) {
        const next = prefix ? ` ${paragraphs[paraCursor]}` : paragraphs[paraCursor];
        if (prefix.length + next.length > 3500) break;
        prefix = next;
        paraCursor++;
      }
      body.push(prefix.trim());
      sections.push({ heading: heading.text, body: body.join(" ").slice(0, 4000) });
      headingCursor++;
    } else {
      // No more headings — rest of paragraphs go into a catch-all section.
      const rest: string[] = [];
      for (; paraCursor < paragraphs.length; paraCursor++) rest.push(paragraphs[paraCursor]);
      if (rest.length) sections.push({ heading: "", body: rest.join(" ").slice(0, 8000) });
    }
  }

  // Any headings that had no following paragraph.
  for (; headingCursor < headings.length; headingCursor++) {
    sections.push({ heading: headings[headingCursor].text, body: "" });
  }

  return sections;
}

/** Detect FAQ (Q/A) blocks: pairing each h2/h3/h4 with the next paragraph. */
function extractFaqPairs(
  headings: Array<{ level: number; text: string }>,
  paragraphs: string[]
): Array<{ q: string; a: string }> {
  const pairs: Array<{ q: string; a: string }> = [];
  const qs = headings
    .filter((h) => h.level === 2 || h.level === 3 || h.level === 4)
    .map((h) => h.text)
    .filter((t) => t.length >= 8 && /[?]|^what|^how|^why|^when|^can|^do|^is/i.test(t));

  for (let i = 0; i < qs.length; i++) {
    const answer = paragraphs.find((p) => p.length >= 15) ?? "";
    if (answer) pairs.push({ q: qs[i], a: answer });
  }
  return pairs;
}