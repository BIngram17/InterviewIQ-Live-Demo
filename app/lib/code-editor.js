export function indentationFor(language) {
  return language === "javascript" ? "  " : "    ";
}

function lineStart(value, position) {
  return value.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
}

function lineEnd(value, position) {
  const ending = value.indexOf("\n", position);
  return ending === -1 ? value.length : ending;
}

function removableIndent(line, indentation) {
  if (line.startsWith("\t")) return 1;
  const spaces = line.match(/^ +/)?.[0].length || 0;
  return Math.min(spaces, indentation.length);
}

function editSelectedLines(value, selectionStart, selectionEnd, indentation, outdent) {
  const blockStart = lineStart(value, selectionStart);
  const effectiveEnd = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd;
  const blockEnd = lineEnd(value, effectiveEnd);
  const lines = value.slice(blockStart, blockEnd).split("\n");

  if (!outdent) {
    const replacement = lines.map((line) => indentation + line).join("\n");
    return {
      value: value.slice(0, blockStart) + replacement + value.slice(blockEnd),
      selectionStart: selectionStart + indentation.length,
      selectionEnd: selectionEnd + indentation.length * lines.length,
    };
  }

  const removals = lines.map((line) => removableIndent(line, indentation));
  const replacement = lines.map((line, index) => line.slice(removals[index])).join("\n");
  const firstRemovalBeforeSelection = Math.min(removals[0], selectionStart - blockStart);
  const totalRemoval = removals.reduce((total, amount) => total + amount, 0);
  const nextStart = Math.max(blockStart, selectionStart - firstRemovalBeforeSelection);
  return {
    value: value.slice(0, blockStart) + replacement + value.slice(blockEnd),
    selectionStart: nextStart,
    selectionEnd: Math.max(nextStart, selectionEnd - totalRemoval),
  };
}

function increasesIndent(line, language) {
  const content = line.trimEnd();
  if (/[{[(]$/.test(content)) return true;
  return language === "python" && /:\s*(?:#.*)?$/.test(content);
}

export function applyCodeEditorKey({ value, selectionStart, selectionEnd, key, shiftKey = false, language }) {
  const indentation = indentationFor(language);

  if (key === "Tab") {
    if (selectionStart !== selectionEnd) {
      return editSelectedLines(value, selectionStart, selectionEnd, indentation, shiftKey);
    }
    if (shiftKey) {
      const start = lineStart(value, selectionStart);
      const end = lineEnd(value, selectionStart);
      const removal = removableIndent(value.slice(start, end), indentation);
      return {
        value: value.slice(0, start) + value.slice(start + removal),
        selectionStart: Math.max(start, selectionStart - removal),
        selectionEnd: Math.max(start, selectionEnd - removal),
      };
    }
    return {
      value: value.slice(0, selectionStart) + indentation + value.slice(selectionEnd),
      selectionStart: selectionStart + indentation.length,
      selectionEnd: selectionStart + indentation.length,
    };
  }

  if (key === "Enter") {
    const start = lineStart(value, selectionStart);
    const currentLine = value.slice(start, selectionStart);
    const currentIndent = currentLine.match(/^[ \t]*/)?.[0] || "";
    const extraIndent = increasesIndent(currentLine, language) ? indentation : "";
    const nextCharacter = value[selectionEnd];
    const openingCharacter = currentLine.trimEnd().slice(-1);
    const matchingClosing = { "{": "}", "[": "]", "(": ")" }[openingCharacter];
    const closesImmediately = matchingClosing && nextCharacter === matchingClosing;
    const insertion = closesImmediately
      ? `\n${currentIndent}${extraIndent}\n${currentIndent}`
      : `\n${currentIndent}${extraIndent}`;
    const cursor = selectionStart + 1 + currentIndent.length + extraIndent.length;
    return {
      value: value.slice(0, selectionStart) + insertion + value.slice(selectionEnd),
      selectionStart: cursor,
      selectionEnd: cursor,
    };
  }

  if (["}", "]", ")"].includes(key) && selectionStart === selectionEnd) {
    const start = lineStart(value, selectionStart);
    const beforeCursor = value.slice(start, selectionStart);
    if (beforeCursor && !beforeCursor.trim()) {
      const removal = removableIndent(beforeCursor, indentation);
      const nextIndent = beforeCursor.slice(0, beforeCursor.length - removal);
      const cursor = start + nextIndent.length + 1;
      return {
        value: value.slice(0, start) + nextIndent + key + value.slice(selectionEnd),
        selectionStart: cursor,
        selectionEnd: cursor,
      };
    }
  }

  return null;
}
