/**
 * Central Content Detector
 * Orchestrates URL, code, and text detection to categorize pasted text.
 */

import { detectCode, CodeDetectionResult } from "./code-detector";
import { detectUrl, generateSnippetTitle, UrlDetectionResult } from "./content-classifier";

export interface DetectedContentResult {
  type: "text" | "code" | "link";
  title: string;
  content: string;
  language?: string;
  domain?: string;
  confidence: number;
}

/**
 * Automatically inspects and categorizes raw text.
 */
export function detectContent(rawText: string): DetectedContentResult {
  const text = rawText ? rawText.trim() : "";

  if (!text) {
    return {
      type: "text",
      title: "Empty note",
      content: "",
      confidence: 1.0,
    };
  }

  // 1. Check if the text is a standalone URL
  const urlResult = detectUrl(text);
  if (urlResult.isUrl && urlResult.url) {
    return {
      type: "link",
      title: urlResult.titleSuggestion || urlResult.domain || "Web Link",
      content: urlResult.url,
      domain: urlResult.domain,
      confidence: 1.0,
    };
  }

  // 2. Check if the text is programming code
  const codeResult: CodeDetectionResult = detectCode(text);
  if (codeResult.isCode && codeResult.confidence >= 0.65) {
    const lang = codeResult.language || "code";
    const title = generateSnippetTitle(text, 50) || `${lang.toUpperCase()} Snippet`;
    return {
      type: "code",
      title,
      content: text,
      language: lang,
      confidence: codeResult.confidence,
    };
  }

  // 3. Fallback to readable text
  const textTitle = generateSnippetTitle(text, 50) || "Note";
  return {
    type: "text",
    title: textTitle,
    content: text,
    confidence: 1.0,
  };
}
