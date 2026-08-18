import assert from "node:assert/strict";
import test from "node:test";
import { applyCodeEditorKey, indentationFor } from "../../app/lib/code-editor.js";

test("Tab inserts the language indentation and Shift+Tab removes it", () => {
  assert.equal(indentationFor("javascript"), "  ");
  assert.equal(indentationFor("python"), "    ");

  const indented = applyCodeEditorKey({ value: "return value", selectionStart: 0, selectionEnd: 0, key: "Tab", language: "python" });
  assert.deepEqual(indented, { value: "    return value", selectionStart: 4, selectionEnd: 4 });

  const outdented = applyCodeEditorKey({ value: indented.value, selectionStart: 4, selectionEnd: 4, key: "Tab", shiftKey: true, language: "python" });
  assert.deepEqual(outdented, { value: "return value", selectionStart: 0, selectionEnd: 0 });
});

test("Tab and Shift+Tab indent and outdent selected lines", () => {
  const source = "first\nsecond";
  const indented = applyCodeEditorKey({ value: source, selectionStart: 0, selectionEnd: source.length, key: "Tab", language: "javascript" });
  assert.equal(indented.value, "  first\n  second");

  const outdented = applyCodeEditorKey({ value: indented.value, selectionStart: 2, selectionEnd: indented.value.length, key: "Tab", shiftKey: true, language: "javascript" });
  assert.equal(outdented.value, source);
});

test("Enter preserves indentation and adds a level after an opening block", () => {
  const javascript = "  if (ready) {";
  const jsEdit = applyCodeEditorKey({ value: javascript, selectionStart: javascript.length, selectionEnd: javascript.length, key: "Enter", language: "javascript" });
  assert.equal(jsEdit.value, "  if (ready) {\n    ");
  assert.equal(jsEdit.selectionStart, jsEdit.value.length);

  const python = "    if ready:";
  const pythonEdit = applyCodeEditorKey({ value: python, selectionStart: python.length, selectionEnd: python.length, key: "Enter", language: "python" });
  assert.equal(pythonEdit.value, "    if ready:\n        ");
});

test("Enter between paired braces creates an indented blank line", () => {
  const edit = applyCodeEditorKey({ value: "{}", selectionStart: 1, selectionEnd: 1, key: "Enter", language: "javascript" });
  assert.equal(edit.value, "{\n  \n}");
  assert.equal(edit.selectionStart, 4);
});

test("a closing brace on an indented blank line outdents automatically", () => {
  const edit = applyCodeEditorKey({ value: "  ", selectionStart: 2, selectionEnd: 2, key: "}", language: "javascript" });
  assert.deepEqual(edit, { value: "}", selectionStart: 1, selectionEnd: 1 });
});
