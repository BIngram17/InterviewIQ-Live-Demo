"use client";

import Link from "next/link";
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import CopyButton from "../components/CopyButton";
import ProductSwitcher from "../components/ProductSwitcher";
import { applyCodeEditorKey } from "../lib/code-editor";

type CodeLanguage = "javascript" | "python" | "java" | "csharp" | "rust";
type ExecutionValueType = "string" | "integer" | "boolean" | "string-array" | "integer-array" | "boolean-array";
type Difficulty = "beginner" | "intermediate" | "advanced";
type Topic = "arrays-strings" | "maps-sets" | "stacks-queues" | "sorting-search" | "recursion-dp" | "practical-data";
type CoachingStage = "understand" | "edge-cases" | "approach" | "pseudocode" | "implementation" | "testing" | "complexity";
type CodingTest = { input: unknown; expected: unknown };
type Challenge = { title: string; goal: string; prompt: string; examples: string[]; constraints: string[]; concepts: string[]; inputType: ExecutionValueType; outputType: ExecutionValueType; tests: CodingTest[]; language: CodeLanguage; difficulty: Difficulty; topic: Topic };
type CoachFeedback = { assessment: string; whatWorks: string[]; nextActions: string[]; hint: string };
type FinalReview = { score: number; verdict: string; strengths: string[]; improvements: string[]; complexity: string };
type TestResult = { passed: boolean; actual?: unknown; expected?: unknown; error?: string };
type SavedCodingChallenge = {
  id: string;
  savedAt: string;
  language: CodeLanguage;
  difficulty: Difficulty;
  topic: Topic;
  roleContext: string;
  challenge: Challenge;
  activeStep: number;
  notes: Record<string, string>;
  coachFeedback: Record<string, CoachFeedback>;
  code: string;
  testResults: TestResult[];
  finalReview: FinalReview | null;
  failedAttempts: number;
};

const storageKey = "interviewiq-coding-practice-v1";
const recentTitlesKey = "interviewiq-coding-practice-titles-v1";
const savedChallengesKey = "interviewiq-coding-practice-history-v1";
const maxSavedChallenges = 24;
const languages: CodeLanguage[] = ["javascript", "python", "java", "csharp", "rust"];
const executionValueTypes: ExecutionValueType[] = ["string", "integer", "boolean", "string-array", "integer-array", "boolean-array"];
const stages: Array<{ id: CoachingStage | "review"; number: string; title: string; short: string; guidance: string; placeholder: string }> = [
  { id: "understand", number: "01", title: "Understand the problem", short: "Understand", guidance: "Restate the task in your own words. Identify the exact result the function must return before thinking about code.", placeholder: "In my own words, this problem asks me to…\nThe function receives…\nIt should return…" },
  { id: "edge-cases", number: "02", title: "Inputs, constraints, and edge cases", short: "Edge cases", guidance: "List the normal input shape, important constraints, empty or invalid cases, duplicates, ordering, and boundary values.", placeholder: "Inputs and outputs:\nConstraints that affect the solution:\nEdge cases I need to handle:" },
  { id: "approach", number: "03", title: "Choose an approach", short: "Approach", guidance: "Compare at least two possible approaches, then choose the data structure and algorithm that best fit the constraints.", placeholder: "Approach A:\nApproach B:\nI will use… because…" },
  { id: "pseudocode", number: "04", title: "Plan with pseudocode", short: "Pseudocode", guidance: "Write language-neutral steps detailed enough that implementation becomes translation rather than improvisation.", placeholder: "1. Initialize…\n2. For each…\n3. If…\n4. Return…" },
  { id: "implementation", number: "05", title: "Implement the solution", short: "Code", guidance: "Translate the plan into clear code. Keep the required function name solution and adjust parameter types where the language requires it.", placeholder: "" },
  { id: "testing", number: "06", title: "Test and debug", short: "Testing", guidance: "Review the passing test evidence, document what each case proves, and note any additional edge cases you would test.", placeholder: "The provided tests prove:\nAdditional cases I would add:\nA regression would likely mean:" },
  { id: "complexity", number: "07", title: "Analyze complexity", short: "Complexity", guidance: "State time and space complexity, define each variable, and explain which operations dominate.", placeholder: "Time complexity: O(…) because…\nSpace complexity: O(…) because…\nTradeoffs:" },
  { id: "review", number: "08", title: "Final AI review", short: "Review", guidance: "Request a complete review after you have planned, implemented, tested, and analyzed your solution.", placeholder: "" },
];

function languageLabel(value: CodeLanguage) {
  return value === "javascript" ? "JavaScript" : value === "python" ? "Python" : value === "java" ? "Java" : value === "csharp" ? "C#" : "Rust";
}

function valueType(value: unknown): ExecutionValueType | "empty-array" | null {
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (Number.isSafeInteger(value)) return "integer";
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return "empty-array";
  const itemTypes = new Set(value.map((item) => valueType(item)));
  if (itemTypes.size !== 1) return null;
  const itemType = [...itemTypes][0];
  if (itemType === "string" || itemType === "integer" || itemType === "boolean") return `${itemType}-array`;
  return null;
}

function inferredType(values: unknown[], existing: unknown): ExecutionValueType | null {
  if (executionValueTypes.includes(existing as ExecutionValueType)) return existing as ExecutionValueType;
  const observed = values.map(valueType);
  if (observed.some((type) => type === null)) return null;
  const concrete = [...new Set(observed.filter((type): type is ExecutionValueType => type !== "empty-array"))];
  if (concrete.length !== 1) return concrete.length === 0 ? "integer-array" : null;
  if (observed.includes("empty-array") && !concrete[0].endsWith("-array")) return null;
  return concrete[0];
}

function normalizeChallenge(value: unknown): Challenge | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Challenge>;
  if (!candidate.title || !Array.isArray(candidate.tests) || candidate.tests.length === 0) return null;
  const inputType = inferredType(candidate.tests.map((test) => test?.input), candidate.inputType);
  const outputType = inferredType(candidate.tests.map((test) => test?.expected), candidate.outputType);
  if (!inputType || !outputType) return null;
  return { ...candidate, inputType, outputType } as Challenge;
}

function normalizeSavedChallenge(value: unknown): SavedCodingChallenge | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SavedCodingChallenge>;
  const challenge = normalizeChallenge(candidate.challenge);
  const id = typeof candidate.id === "string" && candidate.id ? candidate.id : newPracticeId();
  if (!challenge) return null;
  return {
    ...candidate,
    id,
    challenge,
    language: languages.includes(candidate.language as CodeLanguage) ? candidate.language as CodeLanguage : "javascript",
    difficulty: ["beginner", "intermediate", "advanced"].includes(candidate.difficulty || "") ? candidate.difficulty as Difficulty : "intermediate",
    topic: candidate.topic || "arrays-strings",
    roleContext: typeof candidate.roleContext === "string" ? candidate.roleContext : "",
    activeStep: Number.isInteger(candidate.activeStep) ? candidate.activeStep as number : 0,
    notes: candidate.notes && typeof candidate.notes === "object" ? candidate.notes : {},
    coachFeedback: candidate.coachFeedback && typeof candidate.coachFeedback === "object" ? candidate.coachFeedback : {},
    code: typeof candidate.code === "string" ? candidate.code : starterFor(candidate.language || "javascript", challenge),
    testResults: Array.isArray(candidate.testResults) ? candidate.testResults : [],
    finalReview: candidate.finalReview && typeof candidate.finalReview === "object" ? candidate.finalReview : null,
    failedAttempts: Number.isInteger(candidate.failedAttempts) ? Math.max(0, Math.min(20, candidate.failedAttempts as number)) : 0,
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
  };
}

function languageType(language: CodeLanguage, type: ExecutionValueType) {
  const scalar = type.replace("-array", "");
  const isArray = type.endsWith("-array");
  if (language === "java") return `${scalar === "integer" ? "int" : scalar === "boolean" ? "boolean" : "String"}${isArray ? "[]" : ""}`;
  if (language === "csharp") return `${scalar === "integer" ? "int" : scalar === "boolean" ? "bool" : "string"}${isArray ? "[]" : ""}`;
  if (language === "rust") return isArray ? `Vec<${scalar === "integer" ? "i32" : scalar === "boolean" ? "bool" : "String"}>` : scalar === "integer" ? "i32" : scalar === "boolean" ? "bool" : "String";
  return "";
}

function defaultValue(language: CodeLanguage, type: ExecutionValueType) {
  if (type.endsWith("-array")) return language === "rust" ? "Vec::new()" : language === "java" ? `new ${languageType(language, type.replace("-array", "") as ExecutionValueType)}[0]` : language === "csharp" ? `System.Array.Empty<${languageType(language, type.replace("-array", "") as ExecutionValueType)}>()` : "[]";
  if (type === "integer") return "0";
  if (type === "boolean") return language === "python" ? "False" : "false";
  return language === "rust" ? "String::new()" : '""';
}

function starterFor(language: CodeLanguage, challenge?: Challenge | null) {
  const inputType = challenge?.inputType || "integer-array";
  const outputType = challenge?.outputType || "integer-array";
  if (language === "javascript") return "function solution(input) {\n  // Translate your pseudocode into code.\n  return input;\n}";
  if (language === "python") return "def solution(input):\n    # Translate your pseudocode into code.\n    return input";
  if (language === "java") return `class Solution {\n    public static ${languageType(language, outputType)} solution(${languageType(language, inputType)} input) {\n        // Translate your pseudocode into code.\n        return ${defaultValue(language, outputType)};\n    }\n}`;
  if (language === "csharp") return `public static class Solution {\n    public static ${languageType(language, outputType)} solution(${languageType(language, inputType)} input) {\n        // Translate your pseudocode into code.\n        return ${defaultValue(language, outputType)};\n    }\n}`;
  return `fn solution(input: ${languageType(language, inputType)}) -> ${languageType(language, outputType)} {\n    // Translate your pseudocode into code.\n    ${defaultValue(language, outputType)}\n}`;
}

function challengeText(challenge: Challenge) {
  return `${challenge.title}\n${challenge.prompt}\nExamples:\n${challenge.examples.join("\n")}\nConstraints:\n${challenge.constraints.join("\n")}`;
}

function newPracticeId() {
  return globalThis.crypto?.randomUUID?.() || `coding-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatSavedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently saved" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function savedProgress(saved: SavedCodingChallenge) {
  let completed = 0;
  stages.forEach((stage) => {
    if (stage.id === "implementation" && saved.testResults.length === saved.challenge.tests.length && saved.testResults.every((result) => result.passed)) completed += 1;
    else if (stage.id === "testing" && (saved.testResults.length || saved.notes.testing?.trim())) completed += 1;
    else if (stage.id === "review" && saved.finalReview) completed += 1;
    else if (stage.id !== "implementation" && stage.id !== "review" && saved.notes[stage.id]?.trim()) completed += 1;
  });
  return completed;
}

export default function CodingPracticePage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [language, setLanguage] = useState<CodeLanguage>("javascript");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [topic, setTopic] = useState<Topic>("arrays-strings");
  const [roleContext, setRoleContext] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [coachFeedback, setCoachFeedback] = useState<Record<string, CoachFeedback>>({});
  const [code, setCode] = useState(starterFor("javascript"));
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [runnerError, setRunnerError] = useState("");
  const [finalReview, setFinalReview] = useState<FinalReview | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [practiceId, setPracticeId] = useState("");
  const [savedChallenges, setSavedChallenges] = useState<SavedCodingChallenge[]>([]);
  const [runnerKey, setRunnerKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activeRunRef = useRef("");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = isDarkMode ? "dark" : "light"; }, [isDarkMode]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(savedChallengesKey) || "[]");
      if (Array.isArray(saved)) {
        const normalizedSaved = saved.map(normalizeSavedChallenge).filter((item): item is SavedCodingChallenge => Boolean(item)).slice(0, maxSavedChallenges);
        // Hydrate device-local challenge history after the page mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSavedChallenges(normalizedSaved);
        window.localStorage.setItem(savedChallengesKey, JSON.stringify(normalizedSaved));
      }
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      const normalizedActive = normalizeSavedChallenge(parsed);
      if (normalizedActive) {
        setLanguage(normalizedActive.language);
        setDifficulty(normalizedActive.difficulty);
        setTopic(normalizedActive.topic);
        setRoleContext(normalizedActive.roleContext);
        setChallenge(normalizedActive.challenge);
        setActiveStep(Math.max(0, Math.min(stages.length - 1, normalizedActive.activeStep)));
        setNotes(normalizedActive.notes);
        setCoachFeedback(normalizedActive.coachFeedback);
        setCode(normalizedActive.code);
        setTestResults(normalizedActive.testResults);
        setFinalReview(normalizedActive.finalReview);
        setFailedAttempts(normalizedActive.failedAttempts);
        setPracticeId(normalizedActive.id);
        window.localStorage.setItem(storageKey, JSON.stringify(normalizedActive));
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.source !== "interviewiq-code-runner" || event.data?.runId !== activeRunRef.current) return;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      const error = typeof event.data.error === "string" ? event.data.error.slice(0, 200) : "";
      const results = Array.isArray(event.data.results) ? event.data.results.slice(0, challenge?.tests.length || 0) : [];
      setRunnerError(error);
      setTestResults(results);
      setIsRunning(false);
      if (error || results.some((result: TestResult) => !result.passed)) {
        setFailedAttempts((value) => Math.min(20, value + 1));
      }
      setStatus(error || `${results.filter((result: TestResult) => result.passed).length}/${challenge?.tests.length || 0} browser tests passed.`);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [challenge?.tests.length]);

  const completed = useMemo(() => {
    const done = new Set<number>();
    stages.forEach((stage, index) => {
      if (stage.id === "implementation" && testResults.length === challenge?.tests.length && testResults.every((result) => result.passed)) done.add(index);
      else if (stage.id === "testing" && (testResults.length || notes.testing?.trim())) done.add(index);
      else if (stage.id === "review" && finalReview) done.add(index);
      else if (stage.id !== "implementation" && stage.id !== "review" && notes[stage.id]?.trim()) done.add(index);
    });
    return done;
  }, [challenge?.tests, finalReview, notes, testResults]);

  const saveCurrentChallenge = useCallback(() => {
    if (!challenge || !practiceId) return;
    const snapshot: SavedCodingChallenge = { id: practiceId, savedAt: new Date().toISOString(), language, difficulty, topic, roleContext, challenge, activeStep, notes, coachFeedback, code, testResults, finalReview, failedAttempts };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      setSavedChallenges((current) => {
        const next = [snapshot, ...current.filter((item) => item.id !== practiceId)].slice(0, maxSavedChallenges);
        window.localStorage.setItem(savedChallengesKey, JSON.stringify(next));
        return next;
      });
    } catch {
      setStatus("Progress could not be saved because browser storage is full.");
    }
  }, [activeStep, challenge, coachFeedback, code, difficulty, failedAttempts, finalReview, language, notes, practiceId, roleContext, testResults, topic]);

  useEffect(() => {
    if (!isLoaded || !challenge || !practiceId) return;
    const timeout = window.setTimeout(saveCurrentChallenge, 450);
    return () => window.clearTimeout(timeout);
  }, [challenge, isLoaded, practiceId, saveCurrentChallenge]);

  const generateChallenge = async () => {
    saveCurrentChallenge();
    setIsGenerating(true);
    setStatus("");
    try {
      const savedTitles = JSON.parse(window.localStorage.getItem(recentTitlesKey) || "[]");
      const response = await fetch("/api/coding-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, difficulty, topic, roleContext, previousTitles: Array.isArray(savedTitles) ? savedTitles : [] }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || "A coding challenge could not be generated.");
      setPracticeId(newPracticeId());
      setChallenge(payload);
      setCode(starterFor(language, payload));
      setNotes({});
      setCoachFeedback({});
      setTestResults([]);
      setRunnerError("");
      setFinalReview(null);
      setReviewError("");
      setFailedAttempts(0);
      setActiveStep(0);
      window.localStorage.setItem(recentTitlesKey, JSON.stringify([payload.title, ...(Array.isArray(savedTitles) ? savedTitles : [])].slice(0, 12)));
      setStatus("A fresh guided challenge is ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "A coding challenge could not be generated.");
    } finally {
      setIsGenerating(false);
    }
  };

  const changeLanguage = (next: CodeLanguage) => {
    setLanguage(next);
    setCode(starterFor(next, challenge));
    setTestResults([]);
    setRunnerError("");
    setFinalReview(null);
    setReviewError("");
    setFailedAttempts(0);
    setStatus(`${languageLabel(next)} selected. Generate a new challenge or continue this language-neutral problem.`);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!["Tab", "Enter", "}", "]", ")"].includes(event.key)) return;
    const target = event.currentTarget;
    const edit = applyCodeEditorKey({ value: code, selectionStart: target.selectionStart, selectionEnd: target.selectionEnd, key: event.key, shiftKey: event.shiftKey, language });
    if (!edit) return;
    event.preventDefault();
    if (edit.value.length > 12000) return;
    setCode(edit.value);
    setTestResults([]);
    setRunnerError("");
    setFinalReview(null);
    window.requestAnimationFrame(() => target.setSelectionRange(edit.selectionStart, edit.selectionEnd));
  };

  const requestStepCoaching = async (stage: CoachingStage) => {
    if (!challenge) return;
    const testEvidence = runnerError || testResults.map((result, index) => `Test ${index + 1}: ${result.passed ? "passed" : result.error || "failed"}; expected ${JSON.stringify(result.expected)}`).join("\n");
    const work = stage === "implementation" ? `${code}\n\nTEST EVIDENCE:\n${testEvidence}` : stage === "testing" ? `${notes.testing || ""}\n${status}` : notes[stage] || "";
    if (work.trim().length < 8) {
      setStatus("Add your thinking for this step before asking the coach.");
      return;
    }
    setIsCoaching(true);
    setStatus("");
    try {
      const response = await fetch("/api/coding-coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, stage, challenge: challengeText(challenge), work }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || "Step coaching is unavailable.");
      setCoachFeedback((current) => ({ ...current, [stage]: payload }));
      setStatus("Step coaching is ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Step coaching is unavailable.");
    } finally {
      setIsCoaching(false);
    }
  };

  const runTests = async () => {
    if (!challenge) return;
    setIsRunning(true);
    setTestResults([]);
    setRunnerError("");
    setCoachFeedback((current) => { const next = { ...current }; delete next.implementation; return next; });
    if (language !== "javascript") {
      try {
        const response = await fetch("/api/code-runner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, code, inputType: challenge.inputType, outputType: challenge.outputType, tests: challenge.tests }) });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) throw new Error(payload?.error || "The code sandbox is unavailable.");
        const results = Array.isArray(payload.results) ? payload.results.slice(0, challenge.tests.length) : [];
        const error = typeof payload.error === "string" ? payload.error : "";
        setTestResults(results);
        setRunnerError(error);
        if (error || results.length !== challenge.tests.length || results.some((result: TestResult) => !result.passed)) setFailedAttempts((value) => Math.min(20, value + 1));
        setStatus(error || `${results.filter((result: TestResult) => result.passed).length}/${challenge.tests.length} sandbox tests passed.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The code sandbox is unavailable.";
        setRunnerError(message);
        setStatus(message);
      } finally {
        setIsRunning(false);
      }
      return;
    }
    if (!iframeRef.current?.contentWindow) { setIsRunning(false); return; }
    const runId = crypto.randomUUID();
    activeRunRef.current = runId;
    iframeRef.current.contentWindow.postMessage({ type: "run", runId, code: code.slice(0, 12000), tests: challenge.tests }, "*");
    timeoutRef.current = window.setTimeout(() => {
      activeRunRef.current = "";
      setIsRunning(false);
      setRunnerError("Execution stopped after 2 seconds. Check for an infinite loop.");
      setFailedAttempts((value) => Math.min(20, value + 1));
      setRunnerKey((value) => value + 1);
    }, 2000);
  };

  const requestFinalReview = async () => {
    if (!challenge) return;
    setIsReviewing(true);
    setStatus("");
    setReviewError("");
    try {
      const passed = testResults.filter((result) => result.passed).length;
      const testSummary = runnerError || (testResults.length ? `${passed}/${challenge.tests.length} executed tests passed` : "Tests not run");
      const response = await fetch("/api/code-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, challenge: challengeText(challenge), code, testSummary, reviewMode: "guided" }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || "Final AI review is unavailable.");
      if (!Number.isFinite(Number(payload.score)) || !payload.verdict || !Array.isArray(payload.strengths) || !Array.isArray(payload.improvements) || !payload.complexity) {
        throw new Error("The AI returned an incomplete review. Please try again.");
      }
      setFinalReview(payload);
      setActiveStep(stages.length - 1);
      setStatus("Your final coding review is ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Final AI review is unavailable.";
      setReviewError(message);
      setStatus(message);
    } finally {
      setIsReviewing(false);
    }
  };

  const clearActiveChallenge = () => {
    setChallenge(null);
    setPracticeId("");
    setActiveStep(0);
    setNotes({});
    setCoachFeedback({});
    setCode(starterFor(language, null));
    setTestResults([]);
    setRunnerError("");
    setFinalReview(null);
    setStatus("");
    setReviewError("");
    setFailedAttempts(0);
    window.localStorage.removeItem(storageKey);
  };

  const startNewChallenge = () => {
    saveCurrentChallenge();
    clearActiveChallenge();
  };

  const restoreSavedChallenge = (saved: SavedCodingChallenge) => {
    setPracticeId(saved.id);
    setLanguage(saved.language);
    setDifficulty(saved.difficulty);
    setTopic(saved.topic);
    setRoleContext(saved.roleContext);
    setChallenge(saved.challenge);
    setActiveStep(Math.max(0, Math.min(stages.length - 1, saved.activeStep)));
    setNotes(saved.notes);
    setCoachFeedback(saved.coachFeedback);
    setCode(saved.code);
    setTestResults(saved.testResults);
    setFinalReview(saved.finalReview);
    setFailedAttempts(saved.failedAttempts);
    setRunnerError("");
    setReviewError("");
    setStatus(`Restored ${saved.challenge.title}.`);
  };

  const deleteSavedChallenge = (saved: SavedCodingChallenge) => {
    const isCurrent = saved.id === practiceId;
    if (!window.confirm(isCurrent ? "Delete this saved challenge and clear the active workspace?" : `Delete “${saved.challenge.title}” from this browser?`)) return;
    setSavedChallenges((current) => {
      const next = current.filter((item) => item.id !== saved.id);
      window.localStorage.setItem(savedChallengesKey, JSON.stringify(next));
      return next;
    });
    if (isCurrent) clearActiveChallenge();
    else setStatus(`${saved.challenge.title} was deleted.`);
  };

  const current = stages[activeStep];
  const currentFeedback = current.id === "review" ? null : coachFeedback[current.id];
  const progress = Math.round((completed.size / stages.length) * 100);
  const passed = testResults.filter((result) => result.passed).length;
  const allTestsPassed = Boolean(challenge && testResults.length === challenge.tests.length && testResults.every((result) => result.passed));

  return (
    <div className="studio-page coding-practice-page">
      <header className="studio-topbar">
        <Link className="studio-brand" href="/"><span className="studio-logo">IQ</span><span><strong>Interview<span>IQ</span></strong><small>Coding Practice</small></span></Link>
        <div className="studio-top-actions"><ProductSwitcher active="coding" /><button className="theme-toggle studio-theme" type="button" onClick={() => setIsDarkMode((value) => !value)}>{isDarkMode ? "Light" : "Dark"}</button></div>
      </header>

      <main className="studio-shell coding-practice-shell">
        <section className="studio-hero coding-hero"><div><p className="eyebrow">Guided coding practice</p><h1>Learn how to solve—not just what to type.</h1><p>Work from prompt comprehension through planning, implementation, real test execution, complexity analysis, and an evidence-based AI review.</p></div><div className="hero-card"><span className="status-dot" /><div><p className="hero-card-label">Safe live demo</p><p className="hero-card-value">5 languages · sandboxed test execution</p></div></div></section>

        <section className="panel coding-setup-panel">
          <div className="panel-header"><div><p className="section-label">Challenge setup</p><h2>Choose what to practice</h2></div>{challenge && <button className="ghost-button" type="button" onClick={startNewChallenge}>Start new</button>}</div>
          <div className="coding-setup-grid">
            <label className="field"><span>Language</span><select value={language} onChange={(event) => changeLanguage(event.target.value as CodeLanguage)}>{languages.map((item) => <option value={item} key={item}>{languageLabel(item)}</option>)}</select></label>
            <label className="field"><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label className="field"><span>Topic</span><select value={topic} onChange={(event) => setTopic(event.target.value as Topic)}><option value="arrays-strings">Arrays and strings</option><option value="maps-sets">Maps and sets</option><option value="stacks-queues">Stacks and queues</option><option value="sorting-search">Sorting and searching</option><option value="recursion-dp">Recursion and dynamic programming</option><option value="practical-data">Practical data processing</option></select></label>
            <label className="field role-context-field"><span>Optional job or role context</span><input value={roleContext} maxLength={300} onChange={(event) => setRoleContext(event.target.value)} placeholder="Example: entry-level backend developer in healthcare" /></label>
          </div>
          <button className="primary-button generate-coding-button" type="button" onClick={generateChallenge} disabled={isGenerating}>{isGenerating ? "Generating a fresh challenge…" : challenge ? "Generate a different challenge" : "Generate guided challenge"}</button>
          {status && <p className="studio-status" role="status">{status}</p>}
        </section>

        <section className="panel coding-history-panel">
          <div className="panel-header"><div><p className="section-label">Device-local memory</p><h2>Saved coding challenges</h2><p className="memory-note">Your latest {maxSavedChallenges} challenges keep their plan, code, test results, coaching, progress, and final review in this browser.</p></div><span className="count-pill">{savedChallenges.length} saved</span></div>
          {savedChallenges.length === 0 ? <div className="memory-empty"><strong>No saved challenges yet</strong><span>Generate a challenge and your progress will save automatically.</span></div> : <div className="coding-history-list">{savedChallenges.map((saved) => {
            const completedSteps = savedProgress(saved);
            const isCurrent = saved.id === practiceId;
            return <article className={`coding-history-card ${isCurrent ? "active-coding-history" : ""}`} key={saved.id}>
              <div className="coding-history-heading"><div><h3>{saved.challenge.title}</h3><p>{languageLabel(saved.language)} · {saved.difficulty} · {formatSavedDate(saved.savedAt)}</p></div>{isCurrent && <span>Active</span>}</div>
              <div className="coding-history-progress"><div><i style={{ width: `${Math.round((completedSteps / stages.length) * 100)}%` }} /></div><span>{completedSteps} of {stages.length} steps</span></div>
              <div className="memory-card-actions"><button className="small-action-button" type="button" onClick={() => restoreSavedChallenge(saved)}>{isCurrent ? "Continue" : "Open challenge"}</button><button className="small-action-button danger-button" type="button" onClick={() => deleteSavedChallenge(saved)}>Delete</button></div>
            </article>;
          })}</div>}
        </section>

        {!challenge ? <section className="panel coding-welcome"><div className="empty-state"><div className="empty-icon">01</div><h3>Your guided workspace will appear here</h3><p>Choose a language, difficulty, and topic. Each generated problem includes examples, constraints, safe tests, structured planning steps, and AI coaching.</p></div></section> : <>
          <section className="panel challenge-overview">
            <div className="challenge-heading"><div><p className="section-label">{languageLabel(language)} · {difficulty}</p><h2>{challenge.title}</h2><p>{challenge.goal}</p></div><CopyButton text={challengeText(challenge)} label="Copy challenge" copiedLabel="Challenge copied" /></div>
            <p className="challenge-prompt">{challenge.prompt}</p>
            <div className="challenge-details"><div><h3>Examples</h3>{challenge.examples.map((item) => <code key={item}>{item}</code>)}</div><div><h3>Constraints</h3><ul>{challenge.constraints.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
            <div className="analysis-chip-list">{challenge.concepts.map((item) => <span className="analysis-chip" key={item}>{item}</span>)}</div>
          </section>

          <section className="coding-progress-card" aria-label="Coding practice progress"><div><strong>{progress}% complete</strong><span>{completed.size} of {stages.length} steps</span></div><div className="coding-progress-track"><i style={{ width: `${progress}%` }} /></div><span>Progress is saved only in this browser.</span></section>

          <section className="coding-lab-layout">
            <aside className="panel learning-step-nav" aria-label="Problem-solving steps">{stages.map((stage, index) => {
              const locked = index > 4 && !allTestsPassed;
              return <button className={`${activeStep === index ? "active" : ""} ${completed.has(index) ? "complete" : ""} ${locked ? "locked" : ""}`} type="button" key={stage.id} disabled={locked} onClick={() => setActiveStep(index)}><span>{locked ? "🔒" : completed.has(index) ? "✓" : stage.number}</span><div><strong>{stage.short}</strong><small>{locked ? "Pass tests to unlock" : completed.has(index) ? "Completed" : "In progress"}</small></div></button>;
            })}</aside>

            <article className="panel guided-step-panel">
              <div className="guided-step-heading"><span>{current.number}</span><div><p className="section-label">Problem-solving workflow</p><h2>{current.title}</h2><p>{current.guidance}</p></div></div>

              {current.id === "implementation" ? <div className="guided-editor">
                <div className="language-tabs" role="group" aria-label="Programming language">{languages.map((item) => <button className={language === item ? "active" : ""} type="button" key={item} onClick={() => changeLanguage(item)}>{languageLabel(item)}</button>)}</div>
                <div className="editor-toolbar"><span>{languageLabel(language)} solution</span><small id="guided-editor-help">Tab indents · Shift+Tab outdents · Enter keeps indentation</small></div>
                <textarea className="code-editor guided-code-editor" value={code} maxLength={12000} spellCheck={false} aria-label={`${languageLabel(language)} solution`} aria-describedby="guided-editor-help" onChange={(event) => { setCode(event.target.value); setTestResults([]); setRunnerError(""); setFinalReview(null); }} onKeyDown={handleEditorKeyDown} />
                <div className="code-actions"><button className="ghost-button" type="button" onClick={() => { setCode(starterFor(language, challenge)); setTestResults([]); setRunnerError(""); setFinalReview(null); }}>Reset code</button><CopyButton text={code} label="Copy code" copiedLabel="Code copied" /></div>
                <section className={`implementation-test-gate ${allTestsPassed ? "passed" : ""}`}>
                  <div><p className="section-label">Required checkpoint</p><h3>{allTestsPassed ? "All tests passed—next step unlocked" : `Pass all ${challenge.tests.length} tests to continue`}</h3><p>{allTestsPassed ? "Your implementation satisfied every provided test case." : "Run your code in the sandbox. Later workflow steps stay locked until the implementation is correct."}</p></div>
                  <button className="primary-button" type="button" onClick={runTests} disabled={isRunning}>{isRunning ? `Running ${languageLabel(language)} tests…` : allTestsPassed ? "Run tests again" : `Run ${challenge.tests.length} tests`}</button>
                  {(testResults.length > 0 || runnerError) && <div className={`test-report ${runnerError || !allTestsPassed ? "tests-failed" : "tests-passed"}`} role="status"><strong>{runnerError ? "The run needs attention" : `${passed}/${challenge.tests.length} tests passed`}</strong>{runnerError && <pre className="runner-error-output">{runnerError}</pre>}{testResults.map((result, index) => <span key={index}>{result.passed ? "✓" : "×"} Test {index + 1}: input {JSON.stringify(challenge.tests[index]?.input)} → expected {JSON.stringify(result.expected)}{result.error ? ` · ${result.error}` : ""}</span>)}</div>}
                </section>
                {!allTestsPassed && failedAttempts < 3 && <p className="attempt-counter">Unsuccessful runs: {failedAttempts} of 3 before AI debugging support unlocks.</p>}
                {!allTestsPassed && failedAttempts >= 3 && <section className="debug-support-card">
                  <div><p className="section-label">AI debugging support</p><h3>Support unlocked after three unsuccessful runs</h3><p>The coach will use your code and test evidence to identify the likely fault and guide the next correction without replacing your work.</p></div>
                  <button className="primary-button" type="button" onClick={() => requestStepCoaching("implementation")} disabled={isCoaching}>{isCoaching ? "Coach is analyzing the failures…" : coachFeedback.implementation ? "Regenerate debugging support" : "Get AI debugging support"}</button>
                  {coachFeedback.implementation && <div className="step-coaching-result"><section><h3>Coach assessment</h3><p>{coachFeedback.implementation.assessment}</p></section><section><h3>What works</h3><ul>{coachFeedback.implementation.whatWorks.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>Next actions</h3><ul>{coachFeedback.implementation.nextActions.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="coach-hint"><div className="result-section-header"><h3>Focused hint</h3><CopyButton text={coachFeedback.implementation.hint} label="Copy hint" copiedLabel="Hint copied" /></div><p>{coachFeedback.implementation.hint}</p></section></div>}
                </section>}
              </div> : current.id === "review" ? <div className="final-review-step">
                <button className="primary-button" type="button" onClick={requestFinalReview} disabled={isReviewing}>{isReviewing ? "Reviewing your complete solution…" : finalReview ? "Regenerate final AI review" : "Get final AI review"}</button>
                {reviewError && <div className="inline-action-error" role="alert"><strong>Review could not be completed</strong><p>{reviewError}</p><button className="ghost-button" type="button" onClick={requestFinalReview}>Try final review again</button></div>}
                {!finalReview ? <div className="coaching-placeholder"><strong>Finish when you are ready</strong><p>The coach will assess correctness, edge cases, complexity, readability, and language conventions. Passing execution results are included automatically.</p></div> : <div className="final-code-review"><div className="final-review-score"><strong>{finalReview.score.toFixed(1)}</strong><span>out of 10</span></div><section><h3>Assessment</h3><p>{finalReview.verdict}</p></section><section><h3>What works</h3><ul>{finalReview.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>What to improve</h3><ul>{finalReview.improvements.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>Complexity</h3><p>{finalReview.complexity}</p></section></div>}
              </div> : <>
                <label className="field guided-notes-field"><span>Your work</span><textarea value={notes[current.id] || ""} maxLength={5000} onChange={(event) => { setNotes((value) => ({ ...value, [current.id]: event.target.value })); setCoachFeedback((value) => { const next = { ...value }; delete next[current.id]; return next; }); }} placeholder={current.placeholder} /></label>
                {current.id === "testing" && <div className="testing-controls"><div className="test-report tests-passed" role="status"><strong>{passed}/{challenge.tests.length} executed tests passed</strong>{testResults.map((result, index) => <span key={index}>✓ Test {index + 1}: input {JSON.stringify(challenge.tests[index]?.input)} → expected {JSON.stringify(result.expected)}</span>)}</div></div>}
                <button className="primary-button step-coach-button" type="button" onClick={() => requestStepCoaching(current.id as CoachingStage)} disabled={isCoaching}>{isCoaching ? "Coach is reviewing this step…" : currentFeedback ? "Regenerate step coaching" : "Get coaching on this step"}</button>
                {!currentFeedback ? <div className="coaching-placeholder"><strong>Think first, then ask for help</strong><p>The coach responds to your reasoning, corrects misconceptions, and gives a focused hint without skipping the learning process.</p></div> : <div className="step-coaching-result"><section><h3>Coach assessment</h3><p>{currentFeedback.assessment}</p></section><section><h3>What works</h3><ul>{currentFeedback.whatWorks.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>Next actions</h3><ul>{currentFeedback.nextActions.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="coach-hint"><div className="result-section-header"><h3>Focused hint</h3><CopyButton text={currentFeedback.hint} label="Copy hint" copiedLabel="Hint copied" /></div><p>{currentFeedback.hint}</p></section></div>}
              </>}

              <div className="guided-step-actions"><button className="ghost-button" type="button" disabled={activeStep === 0} onClick={() => setActiveStep((value) => Math.max(0, value - 1))}>← Previous</button><button className="primary-button" type="button" disabled={activeStep === stages.length - 1 || (activeStep === 4 && !allTestsPassed)} onClick={() => setActiveStep((value) => Math.min(stages.length - 1, value + 1))}>{activeStep === 4 && !allTestsPassed ? "Pass tests to continue" : "Next step →"}</button></div>
            </article>
          </section>
          <iframe key={runnerKey} ref={iframeRef} className="code-runner-frame" sandbox="allow-scripts" src="/code-runner.html" title="Restricted coding test runner" />
        </>}

        <footer className="demo-footer"><strong>InterviewIQ</strong><span>Guided problem solving · 5 languages · AI coaching</span><a href="https://github.com/BIngram17/InterviewIQ-Live-Demo" target="_blank" rel="noreferrer">View source on GitHub ↗</a></footer>
      </main>
    </div>
  );
}
