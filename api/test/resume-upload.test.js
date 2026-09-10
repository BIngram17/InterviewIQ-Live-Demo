import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";

test("patched DOCX parser preserves candidate text and special characters", async () => {
  const text = "Jordan Lee — Support & Operations. Built training guides and resolved billing questions.";
  const buffer = await Packer.toBuffer(new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }],
  }));
  const extracted = await mammoth.extractRawText({ buffer });
  assert.equal(extracted.value.trim(), text);
});
