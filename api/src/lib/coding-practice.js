import { arrayOfText, text } from "./ai.js";

export const codingLanguages = new Set(["javascript", "python", "java", "csharp", "rust"]);
export const codingDifficulties = new Set(["beginner", "intermediate", "advanced"]);
export const codingTopics = new Set(["arrays-strings", "maps-sets", "stacks-queues", "sorting-search", "recursion-dp", "practical-data"]);
export const coachingStages = new Set(["understand", "edge-cases", "approach", "pseudocode", "implementation", "testing", "complexity"]);
export const executionValueTypes = new Set(["string", "integer", "boolean", "string-array", "integer-array", "boolean-array"]);
export const codingChallengeContextLimit = 6000;

export function codingChallengeContext(value) {
  return text(value, codingChallengeContextLimit);
}

function safeJsonValue(value) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || serialized.length > 1200) return undefined;
    return JSON.parse(serialized);
  } catch {
    return undefined;
  }
}

export function valueMatchesExecutionType(value, type) {
  if (type === "string") return typeof value === "string" && value.length <= 500;
  if (type === "integer") return Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000;
  if (type === "boolean") return typeof value === "boolean";
  if (!type.endsWith("-array") || !Array.isArray(value) || value.length > 100) return false;
  const itemType = type.replace("-array", "");
  return value.every((item) => valueMatchesExecutionType(item, itemType));
}

export function validateChallenge(value, mode = "solve", requireProject = false) {
  if (!value || typeof value !== "object") return null;
  const title = text(value.title, 140);
  const prompt = text(value.prompt, 1600);
  const goal = text(value.goal, 500);
  let examples = arrayOfText(value.examples, 3, 500);
  const constraints = arrayOfText(value.constraints, 8, 220);
  const concepts = arrayOfText(value.concepts, 6, 100);
  const inputType = executionValueTypes.has(value.inputType) ? value.inputType : "";
  const outputType = executionValueTypes.has(value.outputType) ? value.outputType : "";
  const tests = Array.isArray(value.tests)
    ? value.tests.slice(0, 6).map((test) => {
      const input = safeJsonValue(test?.input);
      const expected = safeJsonValue(test?.expected);
      if (input === undefined || expected === undefined) return null;
      return { input, expected };
    }).filter(Boolean)
    : [];
  if (mode === "debug") examples = tests.slice(0, 3).map((test) => `${JSON.stringify(test.input)} → ${JSON.stringify(test.expected)}`);
  if (!title || !prompt || !goal || !inputType || !outputType || examples.length < 1 || constraints.length < 2 || tests.length < 3) return null;
  if (tests.some((test) => !valueMatchesExecutionType(test.input, inputType) || !valueMatchesExecutionType(test.expected, outputType))) return null;
  let files;
  const bugReports = arrayOfText(value.bugReports, 3, 500);
  if (mode === "debug" && Array.isArray(value.files)) {
    if (value.files.length < 3 || value.files.length > 5) return null;
    files = value.files.map((file) => ({ name: file?.name, content: typeof file?.content === "string" ? file.content.replace(/\r\n?/g, "\n").trim() : "" }));
    if (files.some((file) => typeof file.name !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,45}\.(js|py|java|cs|rs)$/.test(file.name) || !file.content || file.content.length > 4000)) return null;
    if (new Set(files.map((file) => file.name.toLowerCase())).size !== files.length) return null;
    if (!bugReports.length) return null;
  }
  if (mode === "debug" && requireProject && !files) return null;
  const starterCode = files ? files.map((file) => file.content).join("\n\n") : typeof value.starterCode === "string" ? value.starterCode.replace(/\r\n?/g, "\n").trim() : "";
  if (mode === "debug" && (!starterCode || starterCode.length > 6000 || !/\bsolution\s*\(/.test(starterCode))) return null;
  return { title, prompt, goal, examples, constraints, concepts, inputType, outputType, tests, mode, ...(mode === "debug" ? { starterCode, ...(files ? { files, bugReports } : {}) } : {}) };
}
