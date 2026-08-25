import { DOMParser } from "deno_dom";

export interface NormalizedStep {
  step: number;
  text: string;
  image_path: null;
}

export interface JsonLdRecipe {
  name?: string;
  description?: string;
  recipeYield?: string | number | string[];
  prepTime?: string;
  cookTime?: string;
  recipeIngredient?: string[];
  recipeInstructions?: unknown;
  author?: { name?: string } | string;
}

export function findJsonLdRecipe(html: string): JsonLdRecipe | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? "");
    } catch {
      continue; // malformed JSON-LD on this page — try the next script tag
    }
    const graph = (parsed as Record<string, unknown>)?.["@graph"];
    const candidates = Array.isArray(parsed) ? parsed : Array.isArray(graph) ? graph : [parsed];
    for (const c of candidates) {
      const type = (c as Record<string, unknown>)?.["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.includes("Recipe")) return c as JsonLdRecipe;
    }
  }
  return null;
}

export function extractOgImage(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = doc?.querySelector('meta[property="og:image"]');
  return meta?.getAttribute("content") ?? null;
}

export function extractMainText(html: string, maxChars = 8000): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return "";
  for (const tag of ["script", "style", "nav", "footer", "header", "noscript"]) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }
  const text = doc.body?.textContent ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

// ISO 8601 duration like "PT15M" or "PT1H30M" -> minutes.
export function parseIsoDurationMinutes(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const total = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return total > 0 ? total : null;
}

export function parseServings(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : null;
  }
  return null;
}

export function parseAuthor(author: unknown): string | null {
  if (typeof author === "string") return author;
  if (author && typeof author === "object" && "name" in author) {
    return (author as { name?: string }).name ?? null;
  }
  return null;
}

// recipeInstructions varies wildly across sites: a plain string, an array
// of strings, an array of HowToStep objects, or nested HowToSection groups.
export function normalizeInstructions(raw: unknown): NormalizedStep[] {
  const steps: string[] = [];

  function walk(node: unknown) {
    if (typeof node === "string") {
      steps.push(node);
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (obj.itemListElement) walk(obj.itemListElement);
      else if (typeof obj.text === "string") steps.push(obj.text);
      else if (typeof obj.name === "string") steps.push(obj.name);
    }
  }

  walk(raw);
  return steps
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, i) => ({ step: i + 1, text, image_path: null }));
}
