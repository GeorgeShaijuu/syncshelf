/**
 * Content Classifier
 * Analyzes string content for URLs, links, and text formatting.
 */

export interface UrlDetectionResult {
  isUrl: boolean;
  url?: string;
  domain?: string;
  titleSuggestion?: string;
}

/**
 * Checks if a trimmed string is a standalone valid HTTP/HTTPS URL.
 */
export function detectUrl(rawText: string): UrlDetectionResult {
  if (!rawText) return { isUrl: false };
  const text = rawText.trim();

  // Exclude strings with spaces or newlines (cannot be single clean URL)
  if (/\s/.test(text)) {
    // Check if it's a markdown link: [title](https://...)
    const mdMatch = text.match(/^\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)$/);
    if (mdMatch) {
      try {
        const parsed = new URL(mdMatch[2]);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return {
            isUrl: true,
            url: parsed.href,
            domain: parsed.hostname,
            titleSuggestion: mdMatch[1],
          };
        }
      } catch {
        return { isUrl: false };
      }
    }
    return { isUrl: false };
  }

  // Common schemes to reject
  if (
    text.startsWith("javascript:") ||
    text.startsWith("data:") ||
    text.startsWith("file:") ||
    text.startsWith("vbscript:")
  ) {
    return { isUrl: false };
  }

  // Check if string starts with standard web protocols or clean domain
  let candidate = text;
  if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
    // If it looks like www.domain.com or domain.com/path, test with https
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return { isUrl: false };
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { isUrl: false };
    }

    const domain = parsed.hostname;
    // Build human friendly title suggestion (domain or domain + path)
    let titleSuggestion = domain.replace(/^www\./, "");
    if (parsed.pathname && parsed.pathname !== "/") {
      const pathSnippet = parsed.pathname.slice(0, 30);
      titleSuggestion += pathSnippet;
    }

    return {
      isUrl: true,
      url: parsed.href,
      domain,
      titleSuggestion,
    };
  } catch {
    return { isUrl: false };
  }
}

/**
 * Cleans and truncates a string for title presentation.
 */
export function generateSnippetTitle(text: string, maxLength: number = 60): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= maxLength) {
    return firstLine;
  }
  return `${firstLine.slice(0, maxLength - 3).trim()}...`;
}
