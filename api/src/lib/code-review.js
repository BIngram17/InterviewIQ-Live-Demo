import { arrayOfText, text } from "./ai.js";

function firstArray(value, keys) {
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return null;
}

function firstText(value, keys, maxLength) {
  for (const key of keys) {
    const result = text(value?.[key], maxLength);
    if (result) return result;
  }
  return "";
}

function firstCode(value, keys, maxLength) {
  for (const key of keys) {
    if (typeof value?.[key] !== "string") continue;
    const result = value[key]
      .replace(/\r\n?/g, "\n")
      .trim()
      .replace(/^```[^\n]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim()
      .slice(0, maxLength);
    if (result) return result;
  }
  return "";
}

function numericScore(value) {
  const candidate = value?.score ?? value?.rating;
  if (Number.isFinite(Number(candidate))) return Number(candidate);
  const match = String(candidate || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

export function hasCompleteCodeReview(value, guidedReview = false) {
  return Number.isFinite(numericScore(value))
    && Boolean(firstText(value, ["verdict", "assessment"], 500))
    && Boolean(firstArray(value, ["strengths", "whatWorks"]))
    && Boolean(firstArray(value, ["improvements", "nextActions", "areasToImprove"]))
    && Boolean(firstText(value, ["complexity", "complexityAnalysis"], 500))
    && (guidedReview || Boolean(firstCode(value, ["suggestedCode", "improvedCode"], 12000)));
}

export function normalizeCodeReview(value, { guidedReview = false, testSummary = "" } = {}) {
  const score = numericScore(value);
  const strengths = arrayOfText(firstArray(value, ["strengths", "whatWorks"]) || [], 5, 220);
  const improvements = arrayOfText(firstArray(value, ["improvements", "nextActions", "areasToImprove"]) || [], 5, 220);
  const executionEvidence = text(testSummary, 500);

  if (!strengths.length && executionEvidence) {
    strengths.push(`Execution evidence: ${executionEvidence.replace(/[.]+$/, "")}.`);
  }
  if (!improvements.length) {
    improvements.push("No critical code change was identified; consider additional edge-case tests beyond the provided suite.");
  }

  return {
    score: Math.max(1, Math.min(10, Number.isFinite(score) ? score : 1)),
    verdict: firstText(value, ["verdict", "assessment"], 500),
    strengths,
    improvements,
    complexity: firstText(value, ["complexity", "complexityAnalysis"], 500),
    suggestedCode: guidedReview ? "" : firstCode(value, ["suggestedCode", "improvedCode"], 12000),
  };
}
