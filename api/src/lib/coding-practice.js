import { arrayOfText, text } from "./ai.js";

export const codingLanguages = new Set(["javascript", "python", "java", "csharp", "rust"]);
export const codingDifficulties = new Set(["beginner", "intermediate", "advanced"]);
export const codingTopics = new Set(["arrays-strings", "maps-sets", "stacks-queues", "sorting-search", "recursion-dp", "practical-data"]);
export const coachingStages = new Set(["understand", "edge-cases", "approach", "pseudocode", "implementation", "testing", "complexity"]);
export const codingChallengeContextLimit = 6000;

export function codingChallengeContext(value) {
  return text(value, codingChallengeContextLimit);
}

export function validateSolutionWalkthrough(value) {
  if (!value || typeof value !== "object") return null;
  const approach = text(value.approach, 1200);
  const pseudocode = text(value.pseudocode, 1600);
  const code = typeof value.code === "string" ? value.code.slice(0, 12000).trim() : "";
  const complexity = text(value.complexity, 700);
  const pitfalls = arrayOfText(value.pitfalls, 6, 280);
  if (!approach || !pseudocode || !code || !complexity || !pitfalls.length) return null;
  return { approach, pseudocode, code, complexity, pitfalls };
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

export function validateChallenge(value) {
  if (!value || typeof value !== "object") return null;
  const title = text(value.title, 140);
  const prompt = text(value.prompt, 1600);
  const goal = text(value.goal, 500);
  const examples = arrayOfText(value.examples, 3, 500);
  const constraints = arrayOfText(value.constraints, 8, 220);
  const concepts = arrayOfText(value.concepts, 6, 100);
  const tests = Array.isArray(value.tests)
    ? value.tests.slice(0, 6).map((test) => {
      const input = safeJsonValue(test?.input);
      const expected = safeJsonValue(test?.expected);
      if (input === undefined || expected === undefined) return null;
      return { input, expected };
    }).filter(Boolean)
    : [];
  if (!title || !prompt || !goal || examples.length < 1 || constraints.length < 2 || tests.length < 3) return null;
  return { title, prompt, goal, examples, constraints, concepts, tests };
}
