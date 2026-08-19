"use client";

import Link from "next/link";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import CopyButton from "../components/CopyButton";
import ProductSwitcher from "../components/ProductSwitcher";
import { applyCodeEditorKey } from "../lib/code-editor";

type CodeLanguage = "javascript" | "python" | "java" | "csharp" | "rust";
type Difficulty = "beginner" | "intermediate" | "advanced";
type Topic = "arrays-strings" | "maps-sets" | "stacks-queues" | "sorting-search" | "recursion-dp" | "practical-data";
type CoachingStage = "understand" | "edge-cases" | "approach" | "pseudocode" | "implementation" | "testing" | "complexity";
type CodingTest = { input: unknown; expected: unknown };
type Challenge = { title: string; goal: string; prompt: string; examples: string[]; constraints: string[]; concepts: string[]; tests: CodingTest[]; language: CodeLanguage; difficulty: Difficulty; topic: Topic };
type CoachFeedback = { assessment: string; whatWorks: string[]; nextActions: string[]; hint: string };
type FinalReview = { score: number; verdict: string; strengths: string[]; improvements: string[]; complexity: string };
type SolutionWalkthrough = { approach: string; pseudocode: string; code: string; complexity: string; pitfalls: string[] };
type TestResult = { passed: boolean; actual?: unknown; expected?: unknown; error?: string };

const storageKey = "interviewiq-coding-practice-v1";
const recentTitlesKey = "interviewiq-coding-practice-titles-v1";
const languages: CodeLanguage[] = ["javascript", "python", "java", "csharp", "rust"];
const stages: Array<{ id: CoachingStage | "review"; number: string; title: string; short: string; guidance: string; placeholder: string }> = [
  { id: "understand", number: "01", title: "Understand the problem", short: "Understand", guidance: "Restate the task in your own words. Identify the exact result the function must return before thinking about code.", placeholder: "In my own words, this problem asks me to…\nThe function receives…\nIt should return…" },
  { id: "edge-cases", number: "02", title: "Inputs, constraints, and edge cases", short: "Edge cases", guidance: "List the normal input shape, important constraints, empty or invalid cases, duplicates, ordering, and boundary values.", placeholder: "Inputs and outputs:\nConstraints that affect the solution:\nEdge cases I need to handle:" },
  { id: "approach", number: "03", title: "Choose an approach", short: "Approach", guidance: "Compare at least two possible approaches, then choose the data structure and algorithm that best fit the constraints.", placeholder: "Approach A:\nApproach B:\nI will use… because…" },
  { id: "pseudocode", number: "04", title: "Plan with pseudocode", short: "Pseudocode", guidance: "Write language-neutral steps detailed enough that implementation becomes translation rather than improvisation.", placeholder: "1. Initialize…\n2. For each…\n3. If…\n4. Return…" },
  { id: "implementation", number: "05", title: "Implement the solution", short: "Code", guidance: "Translate the plan into clear code. Keep the required function name solution and adjust parameter types where the language requires it.", placeholder: "" },
  { id: "testing", number: "06", title: "Test and debug", short: "Testing", guidance: "Predict outcomes before running tests. For non-JavaScript languages, document the cases you would run locally and what each proves.", placeholder: "Test cases I expect to pass:\nA failure would likely mean:\nMy debugging plan:" },
  { id: "complexity", number: "07", title: "Analyze complexity", short: "Complexity", guidance: "State time and space complexity, define each variable, and explain which operations dominate.", placeholder: "Time complexity: O(…) because…\nSpace complexity: O(…) because…\nTradeoffs:" },
  { id: "review", number: "08", title: "Final AI review", short: "Review", guidance: "Request a complete review after you have planned, implemented, tested, and analyzed your solution.", placeholder: "" },
];

function languageLabel(value: CodeLanguage) {
  return value === "javascript" ? "JavaScript" : value === "python" ? "Python" : value === "java" ? "Java" : value === "csharp" ? "C#" : "Rust";
}

function starterFor(language: CodeLanguage) {
  if (language === "javascript") return "function solution(input) {\n  // Translate your pseudocode into code.\n  return input;\n}";
  if (language === "python") return "def solution(input):\n    # Translate your pseudocode into code.\n    return input";
  if (language === "java") return "class Solution {\n    public static Object solution(Object input) {\n        // Adjust types to match the challenge.\n        return input;\n    }\n}";
  if (language === "csharp") return "public static class Solution {\n    public static object solution(object input) {\n        // Adjust types to match the challenge.\n        return input;\n    }\n}";
  return "fn solution(input: Vec<i32>) -> Vec<i32> {\n    // Adjust types to match the challenge.\n    input\n}";
}

function challengeText(challenge: Challenge) {
  return `${challenge.title}\n${challenge.prompt}\nExamples:\n${challenge.examples.join("\n")}\nConstraints:\n${challenge.constraints.join("\n")}`;
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
  const [solutionWalkthrough, setSolutionWalkthrough] = useState<SolutionWalkthrough | null>(null);
  const [solutionError, setSolutionError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isLoadingSolution, setIsLoadingSolution] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [runnerKey, setRunnerKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activeRunRef = useRef("");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = isDarkMode ? "dark" : "light"; }, [isDarkMode]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.challenge) {
        // Hydrate browser-only practice progress after the page mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLanguage(languages.includes(parsed.language) ? parsed.language : "javascript");
        setDifficulty(["beginner", "intermediate", "advanced"].includes(parsed.difficulty) ? parsed.difficulty : "intermediate");
        setTopic(parsed.topic || "arrays-strings");
        setRoleContext(typeof parsed.roleContext === "string" ? parsed.roleContext : "");
        setChallenge(parsed.challenge);
        setActiveStep(Number.isInteger(parsed.activeStep) ? Math.max(0, Math.min(stages.length - 1, parsed.activeStep)) : 0);
        setNotes(parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {});
        setCoachFeedback(parsed.coachFeedback && typeof parsed.coachFeedback === "object" ? parsed.coachFeedback : {});
        setCode(typeof parsed.code === "string" ? parsed.code : starterFor(parsed.language || "javascript"));
        setTestResults(Array.isArray(parsed.testResults) ? parsed.testResults : []);
        setFinalReview(parsed.finalReview && typeof parsed.finalReview === "object" ? parsed.finalReview : null);
        setFailedAttempts(Number.isInteger(parsed.failedAttempts) ? Math.max(0, Math.min(20, parsed.failedAttempts)) : 0);
        setSolutionWalkthrough(parsed.solutionWalkthrough && typeof parsed.solutionWalkthrough === "object" ? parsed.solutionWalkthrough : null);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !challenge) return;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ language, difficulty, topic, roleContext, challenge, activeStep, notes, coachFeedback, code, testResults, finalReview, failedAttempts, solutionWalkthrough }));
      } catch {
        setStatus("Progress could not be saved because browser storage is full.");
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [activeStep, challenge, coachFeedback, code, difficulty, failedAttempts, finalReview, isLoaded, language, notes, roleContext, solutionWalkthrough, testResults, topic]);

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
      if (stage.id === "implementation" && code.trim().length > starterFor(language).trim().length + 10) done.add(index);
      else if (stage.id === "testing" && (testResults.length || notes.testing?.trim())) done.add(index);
      else if (stage.id === "review" && finalReview) done.add(index);
      else if (stage.id !== "implementation" && stage.id !== "review" && notes[stage.id]?.trim()) done.add(index);
    });
    return done;
  }, [code, finalReview, language, notes, testResults.length]);

  const generateChallenge = async () => {
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
      setChallenge(payload);
      setCode(starterFor(language));
      setNotes({});
      setCoachFeedback({});
      setTestResults([]);
      setRunnerError("");
      setFinalReview(null);
      setReviewError("");
      setFailedAttempts(0);
      setSolutionWalkthrough(null);
      setSolutionError("");
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
    setCode(starterFor(next));
    setTestResults([]);
    setRunnerError("");
    setFinalReview(null);
    setReviewError("");
    setFailedAttempts(0);
    setSolutionWalkthrough(null);
    setSolutionError("");
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
    setFinalReview(null);
    window.requestAnimationFrame(() => target.setSelectionRange(edit.selectionStart, edit.selectionEnd));
  };

  const requestStepCoaching = async (stage: CoachingStage) => {
    if (!challenge) return;
    const work = stage === "implementation" ? code : stage === "testing" ? `${notes.testing || ""}\n${status}` : notes[stage] || "";
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

  const runTests = () => {
    if (!challenge || language !== "javascript" || !iframeRef.current?.contentWindow) return;
    const runId = crypto.randomUUID();
    activeRunRef.current = runId;
    setIsRunning(true);
    setTestResults([]);
    setRunnerError("");
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
      const testSummary = language === "javascript" ? runnerError || (testResults.length ? `${passed}/${challenge.tests.length} browser tests passed` : "Browser tests not run") : notes.testing || "Static review only; no local runtime used.";
      const response = await fetch("/api/code-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, challenge: challengeText(challenge), code, testSummary, reviewMode: "guided" }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || "Final AI review is unavailable.");
      if (!Number.isFinite(Number(payload.score)) || !payload.verdict || !Array.isArray(payload.strengths) || !Array.isArray(payload.improvements) || !payload.complexity) {
        throw new Error("The AI returned an incomplete review. Please try again.");
      }
      setFinalReview(payload);
      if (Number(payload.score) < 7) setFailedAttempts((value) => Math.min(20, value + 1));
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

  const requestSolution = async () => {
    if (!challenge || failedAttempts < 3) return;
    setIsLoadingSolution(true);
    setSolutionError("");
    try {
      const response = await fetch("/api/coding-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, challenge: challengeText(challenge), failedAttempts }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || "The solution walkthrough is unavailable.");
      if (!payload.approach || !payload.pseudocode || !payload.code || !payload.complexity || !Array.isArray(payload.pitfalls)) {
        throw new Error("The AI returned an incomplete solution walkthrough. Please try again.");
      }
      setSolutionWalkthrough(payload);
      setStatus("The complete solution walkthrough is ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The solution walkthrough is unavailable.";
      setSolutionError(message);
      setStatus(message);
    } finally {
      setIsLoadingSolution(false);
    }
  };

  const startNewChallenge = () => {
    setChallenge(null);
    setStatus("");
    setReviewError("");
    setFailedAttempts(0);
    setSolutionWalkthrough(null);
    setSolutionError("");
    window.localStorage.removeItem(storageKey);
  };

  const current = stages[activeStep];
  const currentFeedback = current.id === "review" ? null : coachFeedback[current.id];
  const progress = Math.round((completed.size / stages.length) * 100);
  const passed = testResults.filter((result) => result.passed).length;

  return (
    <div className="studio-page coding-practice-page">
      <header className="studio-topbar">
        <Link className="studio-brand" href="/"><span className="studio-logo">IQ</span><span><strong>Interview<span>IQ</span></strong><small>Coding Practice</small></span></Link>
        <div className="studio-top-actions"><ProductSwitcher active="coding" /><button className="theme-toggle studio-theme" type="button" onClick={() => setIsDarkMode((value) => !value)}>{isDarkMode ? "Light" : "Dark"}</button></div>
      </header>

      <main className="studio-shell coding-practice-shell">
        <section className="studio-hero coding-hero"><div><p className="eyebrow">Guided coding practice</p><h1>Learn how to solve—not just what to type.</h1><p>Work from prompt comprehension through planning, implementation, testing, complexity analysis, and an evidence-based AI review.</p></div><div className="hero-card"><span className="status-dot" /><div><p className="hero-card-label">Safe live demo</p><p className="hero-card-value">5 languages · browser-sandboxed JavaScript</p></div></div></section>

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

        {!challenge ? <section className="panel coding-welcome"><div className="empty-state"><div className="empty-icon">01</div><h3>Your guided workspace will appear here</h3><p>Choose a language, difficulty, and topic. Each generated problem includes examples, constraints, safe tests, structured planning steps, and AI coaching.</p></div></section> : <>
          <section className="panel challenge-overview">
            <div className="challenge-heading"><div><p className="section-label">{languageLabel(language)} · {difficulty}</p><h2>{challenge.title}</h2><p>{challenge.goal}</p></div><CopyButton text={challengeText(challenge)} label="Copy challenge" copiedLabel="Challenge copied" /></div>
            <p className="challenge-prompt">{challenge.prompt}</p>
            <div className="challenge-details"><div><h3>Examples</h3>{challenge.examples.map((item) => <code key={item}>{item}</code>)}</div><div><h3>Constraints</h3><ul>{challenge.constraints.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
            <div className="analysis-chip-list">{challenge.concepts.map((item) => <span className="analysis-chip" key={item}>{item}</span>)}</div>
          </section>

          <section className="coding-progress-card" aria-label="Coding practice progress"><div><strong>{progress}% complete</strong><span>{completed.size} of {stages.length} steps</span></div><div className="coding-progress-track"><i style={{ width: `${progress}%` }} /></div><span>Progress is saved only in this browser.</span></section>

          <section className="coding-lab-layout">
            <aside className="panel learning-step-nav" aria-label="Problem-solving steps">{stages.map((stage, index) => <button className={`${activeStep === index ? "active" : ""} ${completed.has(index) ? "complete" : ""}`} type="button" key={stage.id} onClick={() => setActiveStep(index)}><span>{completed.has(index) ? "✓" : stage.number}</span><div><strong>{stage.short}</strong><small>{completed.has(index) ? "Completed" : "In progress"}</small></div></button>)}</aside>

            <article className="panel guided-step-panel">
              <div className="guided-step-heading"><span>{current.number}</span><div><p className="section-label">Problem-solving workflow</p><h2>{current.title}</h2><p>{current.guidance}</p></div></div>

              {current.id === "implementation" ? <div className="guided-editor">
                <div className="language-tabs" role="group" aria-label="Programming language">{languages.map((item) => <button className={language === item ? "active" : ""} type="button" key={item} onClick={() => changeLanguage(item)}>{languageLabel(item)}</button>)}</div>
                <div className="editor-toolbar"><span>{languageLabel(language)} solution</span><small id="guided-editor-help">Tab indents · Shift+Tab outdents · Enter keeps indentation</small></div>
                <textarea className="code-editor guided-code-editor" value={code} maxLength={12000} spellCheck={false} aria-label={`${languageLabel(language)} solution`} aria-describedby="guided-editor-help" onChange={(event) => { setCode(event.target.value); setFinalReview(null); }} onKeyDown={handleEditorKeyDown} />
                <div className="code-actions"><button className="ghost-button" type="button" onClick={() => { setCode(starterFor(language)); setFinalReview(null); }}>Reset code</button><CopyButton text={code} label="Copy code" copiedLabel="Code copied" /></div>
              </div> : current.id === "review" ? <div className="final-review-step">
                <button className="primary-button" type="button" onClick={requestFinalReview} disabled={isReviewing}>{isReviewing ? "Reviewing your complete solution…" : finalReview ? "Regenerate final AI review" : "Get final AI review"}</button>
                {reviewError && <div className="inline-action-error" role="alert"><strong>Review could not be completed</strong><p>{reviewError}</p><button className="ghost-button" type="button" onClick={requestFinalReview}>Try final review again</button></div>}
                {!finalReview ? <div className="coaching-placeholder"><strong>Finish when you are ready</strong><p>The coach will assess correctness, edge cases, complexity, readability, and language conventions. JavaScript test results are included automatically.</p></div> : <div className="final-code-review"><div className="final-review-score"><strong>{finalReview.score.toFixed(1)}</strong><span>out of 10</span></div><section><h3>Assessment</h3><p>{finalReview.verdict}</p></section><section><h3>What works</h3><ul>{finalReview.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>What to improve</h3><ul>{finalReview.improvements.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>Complexity</h3><p>{finalReview.complexity}</p></section>{finalReview.score < 7 && failedAttempts < 3 && <section className="coaching-placeholder"><strong>Apply the feedback and try again</strong><p>The complete answer unlocks after three unsuccessful attempts.</p></section>}</div>}
              </div> : <>
                <label className="field guided-notes-field"><span>Your work</span><textarea value={notes[current.id] || ""} maxLength={5000} onChange={(event) => { setNotes((value) => ({ ...value, [current.id]: event.target.value })); setCoachFeedback((value) => { const next = { ...value }; delete next[current.id]; return next; }); }} placeholder={current.placeholder} /></label>
                {current.id === "testing" && <div className="testing-controls">{language === "javascript" ? <button className="primary-button" type="button" onClick={runTests} disabled={isRunning}>{isRunning ? "Running browser tests…" : `Run ${challenge.tests.length} browser tests`}</button> : <p className="privacy-note">{languageLabel(language)} is reviewed as inert text in this public demo. Document your predicted tests here, then use the AI coach and final review.</p>}{(testResults.length > 0 || runnerError) && <div className={`test-report ${runnerError || passed < challenge.tests.length ? "tests-failed" : "tests-passed"}`} role="status"><strong>{runnerError || `${passed}/${challenge.tests.length} tests passed`}</strong>{!runnerError && testResults.map((result, index) => <span key={index}>{result.passed ? "✓" : "×"} Test {index + 1}{result.error ? `: ${result.error}` : ""}</span>)}</div>}</div>}
                <button className="primary-button step-coach-button" type="button" onClick={() => requestStepCoaching(current.id as CoachingStage)} disabled={isCoaching}>{isCoaching ? "Coach is reviewing this step…" : currentFeedback ? "Regenerate step coaching" : "Get coaching on this step"}</button>
                {!currentFeedback ? <div className="coaching-placeholder"><strong>Think first, then ask for help</strong><p>The coach responds to your reasoning, corrects misconceptions, and gives a focused hint without skipping the learning process.</p></div> : <div className="step-coaching-result"><section><h3>Coach assessment</h3><p>{currentFeedback.assessment}</p></section><section><h3>What works</h3><ul>{currentFeedback.whatWorks.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>Next actions</h3><ul>{currentFeedback.nextActions.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="coach-hint"><div className="result-section-header"><h3>Focused hint</h3><CopyButton text={currentFeedback.hint} label="Copy hint" copiedLabel="Hint copied" /></div><p>{currentFeedback.hint}</p></section></div>}
              </>}

              {activeStep >= 4 && <section className={`solution-unlock-card ${failedAttempts >= 3 ? "unlocked" : ""}`}>
                <div><p className="section-label">Stuck protection</p><h3>{solutionWalkthrough ? "Complete solution walkthrough" : failedAttempts >= 3 ? "The complete answer is unlocked" : "Keep trying—the answer will unlock"}</h3><p>{solutionWalkthrough ? "Compare this reasoning with your approach, then rewrite the solution in your own words." : `${Math.min(failedAttempts, 3)} of 3 unsuccessful attempts recorded. Failed JavaScript test runs and AI reviews below 7/10 count as attempts.`}</p></div>
                {!solutionWalkthrough && <button className="ghost-button" type="button" disabled={failedAttempts < 3 || isLoadingSolution} onClick={requestSolution}>{isLoadingSolution ? "Building the walkthrough…" : failedAttempts >= 3 ? "Show complete solution" : `${3 - failedAttempts} more ${3 - failedAttempts === 1 ? "attempt" : "attempts"} needed`}</button>}
                {solutionError && <div className="inline-action-error" role="alert"><strong>Solution could not be loaded</strong><p>{solutionError}</p><button className="ghost-button" type="button" onClick={requestSolution}>Try again</button></div>}
                {solutionWalkthrough && <div className="solution-walkthrough"><section><h4>Reasoning</h4><p>{solutionWalkthrough.approach}</p></section><section><h4>Pseudocode</h4><pre><code>{solutionWalkthrough.pseudocode}</code></pre></section><section><div className="result-section-header"><h4>Complete {languageLabel(language)} solution</h4><CopyButton text={solutionWalkthrough.code} label="Copy solution" copiedLabel="Solution copied" /></div><pre><code>{solutionWalkthrough.code}</code></pre></section><section><h4>Complexity</h4><p>{solutionWalkthrough.complexity}</p></section><section><h4>Common pitfalls</h4><ul>{solutionWalkthrough.pitfalls.map((item) => <li key={item}>{item}</li>)}</ul></section></div>}
              </section>}

              <div className="guided-step-actions"><button className="ghost-button" type="button" disabled={activeStep === 0} onClick={() => setActiveStep((value) => Math.max(0, value - 1))}>← Previous</button><button className="primary-button" type="button" disabled={activeStep === stages.length - 1} onClick={() => setActiveStep((value) => Math.min(stages.length - 1, value + 1))}>Next step →</button></div>
            </article>
          </section>
          <iframe key={runnerKey} ref={iframeRef} className="code-runner-frame" sandbox="allow-scripts" src="/code-runner.html" title="Restricted coding test runner" />
        </>}

        <footer className="demo-footer"><strong>InterviewIQ</strong><span>Guided problem solving · 5 languages · AI coaching</span><a href="https://github.com/BIngram17/InterviewIQ-Live-Demo" target="_blank" rel="noreferrer">View source on GitHub ↗</a></footer>
      </main>
    </div>
  );
}
