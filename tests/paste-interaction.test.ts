import { describe, it, expect } from "vitest";
import {
  isEditableElement,
  extractDataTransferPayload,
  detectContent,
  classifyFile,
} from "../src/features/clipboard/capture";

describe("Paste Interaction & Capture Handlers", () => {
  describe("Editable Element Guard (isEditableElement)", () => {
    it("returns false for null or undefined targets", () => {
      expect(isEditableElement(null)).toBe(false);
      expect(isEditableElement(undefined as any)).toBe(false);
    });

    it("identifies standard interactive input elements", () => {
      const input = {
        tagName: "INPUT",
        getAttribute: () => null,
        closest: () => null,
      };
      expect(isEditableElement(input)).toBe(true);

      const textarea = {
        tagName: "TEXTAREA",
        getAttribute: () => null,
        closest: () => null,
      };
      expect(isEditableElement(textarea)).toBe(true);

      const select = {
        tagName: "SELECT",
        getAttribute: () => null,
        closest: () => null,
      };
      expect(isEditableElement(select)).toBe(true);
    });

    it("identifies contentEditable elements", () => {
      const editableDiv = {
        tagName: "DIV",
        isContentEditable: true,
        getAttribute: () => null,
        closest: () => null,
      };
      expect(isEditableElement(editableDiv)).toBe(true);
    });

    it("identifies elements with ARIA role textbox or searchbox", () => {
      const customEditor = {
        tagName: "DIV",
        getAttribute: (attr: string) => (attr === "role" ? "textbox" : null),
        closest: () => null,
      };
      expect(isEditableElement(customEditor)).toBe(true);

      const searchEditor = {
        tagName: "DIV",
        getAttribute: (attr: string) => (attr === "role" ? "searchbox" : null),
        closest: () => null,
      };
      expect(isEditableElement(searchEditor)).toBe(true);
    });

    it("returns false for non-editable passive board elements", () => {
      const boardCanvas = {
        tagName: "DIV",
        isContentEditable: false,
        getAttribute: () => null,
        closest: () => null,
      };
      expect(isEditableElement(boardCanvas)).toBe(false);

      const button = {
        tagName: "BUTTON",
        isContentEditable: false,
        getAttribute: () => null,
        closest: () => null,
      };
      expect(isEditableElement(button)).toBe(false);
    });
  });

  describe("extractDataTransferPayload", () => {
    it("returns empty payload if dataTransfer is null", () => {
      const res = extractDataTransferPayload(null);
      expect(res.kind).toBe("empty");
    });

    it("extracts and classifies multiple dragged/dropped files", () => {
      const file1 = { name: "diagram.png", type: "image/png", size: 1024 } as File;
      const file2 = { name: "spec.pdf", type: "application/pdf", size: 2048 } as File;
      const file3 = { name: "audio.mp3", type: "audio/mpeg", size: 4096 } as File;

      const mockDataTransfer = {
        files: [file1, file2, file3],
        items: [],
        getData: () => "",
      } as unknown as DataTransfer;

      const res = extractDataTransferPayload(mockDataTransfer);
      expect(res.kind).toBe("files");
      if (res.kind === "files") {
        expect(res.files.length).toBe(3);
        expect(res.files[0].type).toBe("image");
        expect(res.files[1].type).toBe("file");
        expect(res.files[2].type).toBe("audio");
      }
    });

    it("extracts text data and runs automatic content detection", () => {
      const mockDataTransfer = {
        files: [],
        items: [],
        getData: (format: string) =>
          format === "text/plain" ? "https://syncshelf.app/docs" : "",
      } as unknown as DataTransfer;

      const res = extractDataTransferPayload(mockDataTransfer);
      expect(res.kind).toBe("content");
      if (res.kind === "content") {
        expect(res.content.type).toBe("link");
        expect(res.content.domain).toBe("syncshelf.app");
      }
    });

    it("prioritizes files over text when screenshot or binary data is pasted", () => {
      const imageFile = {
        name: "pasted_image.png",
        type: "image/png",
        size: 50000,
      } as File;

      const mockDataTransfer = {
        files: [imageFile],
        items: [],
        getData: () => "Some accidental text",
      } as unknown as DataTransfer;

      const res = extractDataTransferPayload(mockDataTransfer);
      expect(res.kind).toBe("files");
      if (res.kind === "files") {
        expect(res.files[0].type).toBe("image");
      }
    });
  });

  describe("Filter Independence", () => {
    it("classifies pasted content according to content rather than view filter", () => {
      // Regardless of whether user views 'image', 'code', or 'all',
      // pasting text snippet results in text item
      const pastedNote = "Sprint retrospective items for next Friday.";
      const detection = detectContent(pastedNote);
      expect(detection.type).toBe("text");

      // Pasting URL results in link item
      const pastedUrl = "https://linear.app/project/issues";
      const linkDetection = detectContent(pastedUrl);
      expect(linkDetection.type).toBe("link");

      // Pasting video file results in video item
      const videoClassification = classifyFile({ name: "demo.mp4", type: "video/mp4" });
      expect(videoClassification.type).toBe("video");
    });
  });
});
