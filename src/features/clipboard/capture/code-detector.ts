/**
 * Heuristic Code Detection Engine
 * Distinguishes programming code from plain text across major languages.
 * Analyzes syntax patterns, keywords, structural markers, indentation, and formatting.
 */

export interface CodeDetectionResult {
  isCode: boolean;
  language?: string;
  confidence: number; // 0.0 to 1.0
}

interface LanguagePattern {
  language: string;
  strongKeywords: RegExp[];
  commonKeywords: RegExp[];
  syntaxPatterns: RegExp[];
  structurePatterns: RegExp[];
}

const LANGUAGE_PATTERNS: LanguagePattern[] = [
  {
    language: "json",
    strongKeywords: [],
    commonKeywords: [],
    syntaxPatterns: [
      /^\s*\{[\s\S]*\}\s*$/,
      /^\s*\[[\s\S]*\]\s*$/,
      /"[^"]+"\s*:\s*("[^"]*"|\d+|true|false|null|[\{\[])/,
    ],
    structurePatterns: [/^\s*"[a-zA-Z0-9_$-]+":/m],
  },
  {
    language: "sql",
    strongKeywords: [
      /\bSELECT\b[\s\S]+\bFROM\b/i,
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+[a-zA-Z0-9_.]+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bCREATE\s+(TABLE|INDEX|VIEW|DATABASE)\b/i,
      /\bALTER\s+TABLE\b/i,
      /\bDROP\s+TABLE\b/i,
    ],
    commonKeywords: [
      /\bWHERE\b/i,
      /\bORDER\s+BY\b/i,
      /\bGROUP\s+BY\b/i,
      /\bHAVING\b/i,
      /\bJOIN\b/i,
      /\bLEFT\s+JOIN\b/i,
      /\bINNER\s+JOIN\b/i,
      /\bPRIMARY\s+KEY\b/i,
    ],
    syntaxPatterns: [/;$/, /--[^\n]*/],
    structurePatterns: [],
  },
  {
    language: "html",
    strongKeywords: [
      /<!DOCTYPE\s+html>/i,
      /<html[\s>]/i,
      /<body[\s>]/i,
      /<head[\s>]/i,
      /<div[\s>]/i,
      /<span[\s>]/i,
      /<script[\s>]/i,
      /<style[\s>]/i,
      /<template[\s>]/i,
    ],
    commonKeywords: [
      /<\/?[a-z0-9-]+(\s+[a-z0-9_:-]+(=("[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/i,
    ],
    syntaxPatterns: [/<\/?[a-z0-9-]+>/i, /<!--[\s\S]*?-->/],
    structurePatterns: [/<\/[a-z0-9-]+>/i],
  },
  {
    language: "typescript",
    strongKeywords: [
      /\binterface\s+[A-Z][a-zA-Z0-9_]*\s*\{/,
      /\btype\s+[A-Z][a-zA-Z0-9_]*\s*=/,
      /\bexport\s+(interface|type|const|function|class)\b/,
      /:\s*(string|number|boolean|any|void|unknown|never|Record<|Array<)[\[\]]*\b/,
      /\bas\s+(const|[A-Z][a-zA-Z0-9_]*)\b/,
    ],
    commonKeywords: [
      /\bconst\b/,
      /\blet\b/,
      /\bfunction\b/,
      /\bimport\b[\s\S]*\bfrom\b/,
      /\bconsole\.(log|error|warn)\b/,
      /\breturn\b/,
      /\basync\b/,
      /\bawait\b/,
    ],
    syntaxPatterns: [/=>/, /===/, /!==/, /\?\./, /\?\?/, /\{\s*[a-zA-Z0-9_]+\s*:\s*[a-zA-Z0-9_]+/],
    structurePatterns: [/\{[\s\S]*\}/, /\([a-zA-Z0-9_,\s:]*\)\s*=>/],
  },
  {
    language: "javascript",
    strongKeywords: [
      /\bfunction\s+[a-zA-Z0-9_]+\s*\(/,
      /\bconst\s+[a-zA-Z0-9_]+\s*=/,
      /\blet\s+[a-zA-Z0-9_]+\s*=/,
      /\bvar\s+[a-zA-Z0-9_]+\s*=/,
      /\bexport\s+default\b/,
      /\bmodule\.exports\b/,
      /\brequire\(["'][^"']+["']\)/,
    ],
    commonKeywords: [
      /\bimport\b/,
      /\breturn\b/,
      /\bconsole\.(log|warn|error)\b/,
      /\bnew\s+Promise\b/,
      /\basync\b/,
      /\bawait\b/,
    ],
    syntaxPatterns: [/=>/, /===/, /!==/, /\bdocument\.getElementById\b/, /\bwindow\./],
    structurePatterns: [/\{[\s\S]*\}/],
  },
  {
    language: "python",
    strongKeywords: [
      /\bdef\s+[a-zA-Z0-9_]+\s*\([^\)]*\)\s*:/,
      /\bclass\s+[a-zA-Z0-9_]+(\([^\)]*\))?\s*:/,
      /\bif\s+__name__\s*==\s*['"]__main__['"]\s*:/,
      /\bfrom\s+[a-zA-Z0-9_.]+\s+import\s+/,
      /\bimport\s+[a-zA-Z0-9_.]+(\s+as\s+[a-zA-Z0-9_]+)?$/,
    ],
    commonKeywords: [
      /\belif\b/,
      /\bexcept(\s+[a-zA-Z0-9_]+(\s+as\s+[a-zA-Z0-9_]+)?)?\s*:/,
      /\bfinally\s*:/,
      /\bself\.[a-zA-Z0-9_]+/,
      /\bprint\(/,
      /\bTrue\b/,
      /\bFalse\b/,
      /\bNone\b/,
    ],
    syntaxPatterns: [/:\s*$/m, /^\s{4}[a-zA-Z0-9_]/m, /"""[\s\S]*?"""/, /'''[\s\S]*?'''/],
    structurePatterns: [/\bdef\b/, /\bclass\b/],
  },
  {
    language: "rust",
    strongKeywords: [
      /\bfn\s+[a-zA-Z0-9_]+\s*\([^\)]*\)\s*(->\s*[^{]+)?\s*\{/,
      /\blet\s+mut\s+/,
      /\bimpl(\s+<[^>]+>)?\s+[a-zA-Z0-9_]+/,
      /\bpub\s+(fn|struct|enum|trait|mod)\b/,
      /\bprintln!\s*\(/,
      /\bmatch\s+[a-zA-Z0-9_]+\s*\{/,
    ],
    commonKeywords: [/\bstruct\b/, /\benum\b/, /\btrait\b/, /\bOption<.+>/, /\bResult<.+>/],
    syntaxPatterns: [/::/, /&mut\s+/, /->/, /=>/],
    structurePatterns: [/\{[\s\S]*\}/],
  },
  {
    language: "go",
    strongKeywords: [
      /\bpackage\s+[a-zA-Z0-9_]+/,
      /\bfunc\s+(\([^\)]+\)\s+)?[a-zA-Z0-9_]+\s*\([^\)]*\)/,
      /\bimport\s*\(/,
      /\bfmt\.Print(ln|f)?\(/,
    ],
    commonKeywords: [/\btype\s+[a-zA-Z0-9_]+\s+struct\b/, /\bdefer\b/, /\bgo\s+[a-zA-Z0-9_]+\(/],
    syntaxPatterns: [/:=/, /&[A-Z][a-zA-Z0-9_]+\{/],
    structurePatterns: [/func\s+/],
  },
  {
    language: "bash",
    strongKeywords: [
      /^#!\/bin\/(bash|sh|zsh)/m,
      /\b(npm|yarn|pnpm)\s+(run|install|add|test|build|exec|dlx)\b/,
      /\bgit\s+(clone|commit|push|pull|status|checkout|branch|merge|rebase|stash)\b/,
      /\bcurl\s+(-[a-zA-Z]+\s+)*https?:\/\//,
      /\bchmod\s+[+0-9]/,
      /\bexport\s+[A-Z0-9_]+=/,
      /\bsudo\s+[a-zA-Z0-9_-]+/,
      /\bdocker\s+(run|build|compose|ps|exec)\b/,
    ],
    commonKeywords: [/\becho\s+["']/, /\bset\s+-e\b/, /\bif\s+\[\s+/, /\bfi\b/, /\bdone\b/],
    syntaxPatterns: [/\$\([^\)]+\)/, /\${[a-zA-Z0-9_]+}/, />>\s*[a-zA-Z0-9_./-]+/],
    structurePatterns: [],
  },
  {
    language: "css",
    strongKeywords: [
      /@media\s*\([^\)]+\)\s*\{/,
      /@keyframes\s+[a-zA-Z0-9_-]+\s*\{/,
    ],
    commonKeywords: [
      /\b(margin|padding|display|flex|grid|background|color|border|font-size|position|width|height):\s*[^;]+;/i,
    ],
    syntaxPatterns: [
      /^[.#]?[a-zA-Z0-9_-]+\s*\{[\s\S]*\}/m,
      /[a-zA-Z0-9_-]+\s*:\s*[^;]+;/m,
    ],
    structurePatterns: [/\{[\s\S]*\}/],
  },
  {
    language: "yaml",
    strongKeywords: [],
    commonKeywords: [],
    syntaxPatterns: [
      /^---\s*$/m,
      /^[a-zA-Z0-9_-]+:\s*$/m,
      /^\s{2,}[a-zA-Z0-9_-]+:\s*.+$/m,
      /^\s*-\s+[a-zA-Z0-9_-]+:/m,
    ],
    structurePatterns: [/^[a-zA-Z0-9_-]+:\s/m],
  },
];

/**
 * Checks if a string is valid JSON object or array.
 */
function testJson(text: string): boolean {
  const trimmed = text.trim();
  if (
    (!trimmed.startsWith("{") || !trimmed.endsWith("}")) &&
    (!trimmed.startsWith("[") || !trimmed.endsWith("]"))
  ) {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

/**
 * Checks for common natural language prose indicators (conversational punctuation, greeting, paragraph sentences).
 */
function getProseIndicatorCount(text: string): number {
  let count = 0;
  const trimmed = text.trim();

  // Natural greeting or email style
  if (/^(hi|hello|dear|hey|good morning|good afternoon)\b/i.test(trimmed)) count += 3;

  // Full English sentences ending with period and followed by capital letter
  const sentenceMatches = trimmed.match(/[a-z0-9][.!?]\s+[A-Z]/g);
  if (sentenceMatches && sentenceMatches.length >= 2) count += sentenceMatches.length;

  // Conversational phrases
  if (/\b(please|thanks|thank you|regards|let me know|as discussed|meeting|notes)\b/i.test(trimmed)) {
    count += 2;
  }

  // Common markdown list of plain items (e.g. groceries, todo) without code syntax
  const listItems = trimmed.match(/^[-*]\s+[a-zA-Z0-9\s,.]+$/gm);
  if (listItems && listItems.length >= 2 && !/[{}();=<>]/.test(trimmed)) {
    count += 3;
  }

  return count;
}

/**
 * Detects whether the given text is code and returns the best matching programming language.
 */
export function detectCode(rawText: string): CodeDetectionResult {
  if (!rawText) {
    return { isCode: false, confidence: 0 };
  }

  const text = rawText.trim();
  if (text.length < 3) {
    return { isCode: false, confidence: 0 };
  }

  // 1. Definite JSON check
  if (testJson(text)) {
    return { isCode: true, language: "json", confidence: 1.0 };
  }

  const proseScore = getProseIndicatorCount(text);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let bestMatch: { language: string; score: number } | null = null;

  for (const pattern of LANGUAGE_PATTERNS) {
    let score = 0;

    // Strong keywords have high weight
    for (const re of pattern.strongKeywords) {
      if (re.test(text)) {
        score += 4;
      }
    }

    // Common keywords
    for (const re of pattern.commonKeywords) {
      if (re.test(text)) {
        score += 1.5;
      }
    }

    // Syntax patterns
    for (const re of pattern.syntaxPatterns) {
      if (re.test(text)) {
        score += 1.5;
      }
    }

    // Structure patterns
    for (const re of pattern.structurePatterns) {
      if (re.test(text)) {
        score += 1.0;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { language: pattern.language, score };
    }
  }

  // Structural code markers: curly brackets, semicolons, arrows, indentation
  const hasBrackets = /\{[\s\S]*\}/.test(text);
  const hasSemicolons = /;\s*$/m.test(text);
  const hasArrowFunc = /=>/.test(text);
  const hasIndent = /^( {2,4}|\t)[a-zA-Z0-9_]/m.test(rawText);

  let generalCodeScore = 0;
  if (hasBrackets) generalCodeScore += 2;
  if (hasSemicolons) generalCodeScore += 1.5;
  if (hasArrowFunc) generalCodeScore += 2;
  if (hasIndent) generalCodeScore += 1;

  // Single-line shell command check
  if (
    lines.length === 1 &&
    /^(npm|pnpm|yarn|git|npx|curl|docker|chmod|sudo|ssh)\s+[a-zA-Z0-9_-]+/i.test(text)
  ) {
    return { isCode: true, language: "bash", confidence: 0.95 };
  }

  const highestScore = bestMatch ? bestMatch.score : 0;
  const compositeScore = highestScore + generalCodeScore * 0.5 - proseScore * 1.5;

  // Confidence calculation normalized between 0 and 1
  const confidence = Math.min(Math.max(compositeScore / 6.0, 0), 1.0);

  // If score exceeds threshold and not overpowered by natural language prose
  if (bestMatch && bestMatch.score >= 3.5 && proseScore < 4) {
    return {
      isCode: true,
      language: bestMatch.language,
      confidence: Math.max(confidence, 0.75),
    };
  }

  if (generalCodeScore >= 3 && proseScore < 2) {
    return {
      isCode: true,
      language: bestMatch ? bestMatch.language : "plaintext",
      confidence: Math.max(confidence, 0.7),
    };
  }

  return {
    isCode: false,
    confidence,
  };
}
