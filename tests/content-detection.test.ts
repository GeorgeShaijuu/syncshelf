import { describe, it, expect } from "vitest";
import {
  detectCode,
  detectUrl,
  detectContent,
  classifyFile,
} from "../src/features/clipboard/capture";

describe("Content Detection Engine", () => {
  // Case 1: Plain URL
  it("detects plain HTTPS URLs as link type", () => {
    const input = "https://github.com/facebook/react";
    const res = detectContent(input);
    expect(res.type).toBe("link");
    expect(res.content).toBe("https://github.com/facebook/react");
    expect(res.domain).toBe("github.com");
  });

  // Case 2: Plain URL with query params & hash
  it("detects complex URLs with query params and hash as link type", () => {
    const input = "https://news.ycombinator.com/item?id=3847291&filter=comments#top";
    const res = detectContent(input);
    expect(res.type).toBe("link");
    expect(res.content).toBe("https://news.ycombinator.com/item?id=3847291&filter=comments#top");
    expect(res.domain).toBe("news.ycombinator.com");
  });

  // Case 3: JavaScript / TypeScript code snippet
  it("detects TypeScript/JavaScript code snippet with imports and const", () => {
    const code = `import React, { useState } from 'react';
export const Counter = () => {
  const [count, setCount] = useState<number>(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
};`;
    const res = detectContent(code);
    expect(res.type).toBe("code");
    expect(["typescript", "javascript"]).toContain(res.language);
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  // Case 4: Python snippet
  it("detects Python code snippet with def, class and indentation", () => {
    const pythonCode = `def calculate_fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2)

if __name__ == "__main__":
    print(calculate_fibonacci(10))`;
    const res = detectContent(pythonCode);
    expect(res.type).toBe("code");
    expect(res.language).toBe("python");
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  // Case 5: JSON payload
  it("detects valid JSON object or array as json code", () => {
    const jsonStr = JSON.stringify(
      {
        projectId: "syncshelf-514903",
        features: ["clipboard", "realtime", "r2-storage"],
        active: true,
        count: 42,
      },
      null,
      2
    );
    const res = detectContent(jsonStr);
    expect(res.type).toBe("code");
    expect(res.language).toBe("json");
    expect(res.confidence).toBe(1.0);
  });

  // Case 6: SQL query
  it("detects SQL statements with keywords", () => {
    const sql = `SELECT u.id, u.email, COUNT(i.id) as total_items
FROM users u
LEFT JOIN items i ON u.id = i.created_by
WHERE u.active = true
GROUP BY u.id, u.email
ORDER BY total_items DESC;`;
    const res = detectContent(sql);
    expect(res.type).toBe("code");
    expect(res.language).toBe("sql");
  });

  // Case 7: HTML tags
  it("detects HTML markup as html code", () => {
    const html = `<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold">Welcome to SyncShelf</h1>
  <p class="text-muted-foreground">Universal Clipboard</p>
</div>`;
    const res = detectContent(html);
    expect(res.type).toBe("code");
    expect(res.language).toBe("html");
  });

  // Case 8: Shell command
  it("detects shell scripts and CLI commands as bash code", () => {
    const command = "curl -X POST https://api.syncshelf.app/v1/items -H 'Authorization: Bearer token'";
    const res = detectContent(command);
    expect(res.type).toBe("code");
    expect(res.language).toBe("bash");
  });

  // Case 9: Plain paragraph of English prose
  it("detects natural English prose as plain text, NOT code", () => {
    const prose = `Hello team, please remember that we have our weekly sprint planning meeting on Monday morning at 10 AM. We will review our velocity, discuss the latest milestones, and prioritize the upcoming backlog items. Let me know if you have any questions or conflicts.`;
    const res = detectContent(prose);
    expect(res.type).toBe("text");
  });

  // Case 10: Multi-item grocery/todo list
  it("detects simple bullet lists as plain text, NOT code", () => {
    const list = `- Buy organic milk\n- 2 loaves of sourdough bread\n- Fresh avocados\n- Ground coffee beans\n- Dishwasher soap`;
    const res = detectContent(list);
    expect(res.type).toBe("text");
  });

  // Case 11: Single word or short phrase
  it("detects single words or short notes as text", () => {
    const shortText = "Meeting notes";
    const res = detectContent(shortText);
    expect(res.type).toBe("text");
    expect(res.content).toBe("Meeting notes");
  });

  // Case 12: Ambiguous text with low confidence falls back gracefully to text
  it("falls back gracefully to text when confidence is low", () => {
    const ambiguous = "Note: remember to check on the servers tomorrow morning.";
    const res = detectContent(ambiguous);
    expect(res.type).toBe("text");
  });

  // File Classification Suite
  describe("File Classification", () => {
    it("classifies image files correctly", () => {
      expect(classifyFile({ name: "screenshot.png", type: "image/png" }).type).toBe("image");
      expect(classifyFile({ name: "photo.jpg" }).type).toBe("image");
      expect(classifyFile({ name: "vector.svg", type: "image/svg+xml" }).type).toBe("image");
      expect(classifyFile({ name: "animated.webp" }).type).toBe("image");
    });

    it("classifies audio files correctly", () => {
      expect(classifyFile({ name: "recording.mp3", type: "audio/mpeg" }).type).toBe("audio");
      expect(classifyFile({ name: "sound.wav" }).type).toBe("audio");
      expect(classifyFile({ name: "track.flac" }).type).toBe("audio");
    });

    it("classifies video files correctly", () => {
      expect(classifyFile({ name: "demo.mp4", type: "video/mp4" }).type).toBe("video");
      expect(classifyFile({ name: "screencast.webm" }).type).toBe("video");
      expect(classifyFile({ name: "clip.mov" }).type).toBe("video");
      expect(classifyFile({ name: "recording.mkv" }).type).toBe("video");
    });

    it("classifies documents, archives, and generic files correctly", () => {
      expect(classifyFile({ name: "report.pdf", type: "application/pdf" }).type).toBe("file");
      expect(classifyFile({ name: "archive.zip" }).type).toBe("file");
      expect(classifyFile({ name: "budget.xlsx" }).type).toBe("file");
      expect(classifyFile({ name: "data.csv" }).type).toBe("file");
      expect(classifyFile({ name: "unknown.bin", type: "application/octet-stream" }).type).toBe("file");
    });
  });
});
