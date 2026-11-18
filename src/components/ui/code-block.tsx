"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language = "plaintext", className = "" }: CodeBlockProps) {
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function highlight() {
      try {
        const { codeToHtml } = await import("shiki");
        const lang = language.toLowerCase().trim() || "plaintext";
        const html = await codeToHtml(code, {
          lang,
          theme: "github-dark",
        });
        if (isMounted) {
          setHighlightedHtml(html);
        }
      } catch (err) {
        // Fallback if specific language is not recognized by shiki
        try {
          const { codeToHtml } = await import("shiki");
          const fallbackHtml = await codeToHtml(code, {
            lang: "plaintext",
            theme: "github-dark",
          });
          if (isMounted) {
            setHighlightedHtml(fallbackHtml);
          }
        } catch {
          if (isMounted) setHighlightedHtml(null);
        }
      }
    }

    highlight();
    return () => {
      isMounted = false;
    };
  }, [code, language]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div className={`relative rounded-lg overflow-hidden border border-border bg-[#24292e] group ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/50 text-xs text-muted-foreground font-mono">
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 p-1 hover:text-foreground rounded transition-colors text-xs"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500 text-[10px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="p-3 text-xs overflow-x-auto max-h-80 font-mono">
        {highlightedHtml ? (
          <div
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            className="[&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 font-mono"
          />
        ) : (
          <pre className="text-zinc-200 whitespace-pre font-mono">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
