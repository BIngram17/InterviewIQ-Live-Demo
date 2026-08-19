"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import JobUrlImporter, { ImportedJob } from "./components/JobUrlImporter";
import CopyButton from "./components/CopyButton";
import ProductSwitcher from "./components/ProductSwitcher";
import { applyCodeEditorKey } from "./lib/code-editor";

type CodingTest = { input: unknown; expected: unknown };
type CodingChallenge = {
  title: string;
  prompt: string;
  examples: string;
  starter?: string;
  tests?: CodingTest[];
};
type InterviewQuestion = {
  category: string;
  question: string;
  why: string;
  coding?: CodingChallenge;
};
type RoleAnalysis = {
  summary: string;
  technical: string[];
  soft: string[];
  topics: string[];
};

type AnswerFeedback = {
  score: number;
  strengths: string[];
  improvements: string[];
  coaching: string;
  improvedAnswer: string;
};

type CodeFeedback = {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  complexity: string;
  suggestedCode: string;
};

type AnswerAttempt = {
  id: string;
  sessionId: string;
  question: string;
  response: string;
  score: number;
  createdAt: string;
  feedback?: AnswerFeedback;
  codeFeedback?: CodeFeedback;
  codeLanguage?: CodeLanguage;
};

type SavedInterviewSession = {
  id: string;
  key: string;
  title: string;
  company: string;
  level: string;
  interviewType: string;
  jobDescription: string;
  questions: InterviewQuestion[];
  analysis: RoleAnalysis;
  createdAt: string;
  updatedAt: string;
};

type ActiveSection = "practice" | "questions" | "feedback";
type CodeLanguage = "javascript" | "python" | "java";
const answerHistoryStorageKey = "interviewiq-answer-history-v1";
const interviewSessionsStorageKey = "interviewiq-saved-sessions-v1";

const roleProfiles = {
  software: {
    label: "software engineering",
    triggers: ["software", "developer", "engineer", "frontend", "backend", "full stack", "react", "python", "java", "api"],
    technical: ["System design", "Data structures", "API design", "Testing"],
    topics: ["Architecture tradeoffs", "Code quality", "Reliability", "Delivery"],
    roleQuestion: "Walk me through how you would design and ship a reliable feature from API contract to production monitoring.",
  },
  data: {
    label: "data and analytics",
    triggers: ["data", "analyst", "analytics", "sql", "machine learning", "business intelligence", "scientist"],
    technical: ["SQL", "Data modeling", "Experiment design", "Data quality"],
    topics: ["Metric definition", "Causal reasoning", "Data validation", "Insight communication"],
    roleQuestion: "How would you turn an ambiguous business question into a trustworthy analysis and recommendation?",
  },
  security: {
    label: "cybersecurity",
    triggers: ["security", "cyber", "soc", "siem", "incident", "vulnerability", "threat"],
    technical: ["Threat modeling", "Incident response", "Detection engineering", "Risk assessment"],
    topics: ["Triage", "Containment", "Least privilege", "Security communication"],
    roleQuestion: "How would you investigate, contain, and communicate a high-confidence security alert?",
  },
  product: {
    label: "product management",
    triggers: ["product", "roadmap", "customer discovery", "prioritize", "user research", "b2b", "saas"],
    technical: ["Product analytics", "Experiment design", "Roadmapping", "SQL"],
    topics: ["Prioritization", "Customer discovery", "Product launches", "Outcomes"],
    roleQuestion: "How would you prioritize a roadmap when customer needs, engineering constraints, and business goals conflict?",
  },
  project: {
    label: "program and project delivery",
    triggers: ["project", "program", "scrum", "agile", "delivery", "pmo", "stakeholder"],
    technical: ["Program planning", "Risk management", "Dependency mapping", "Agile delivery"],
    topics: ["Escalation", "Scope control", "Cross-team alignment", "Execution"],
    roleQuestion: "How would you recover a cross-functional program that is behind schedule and has unclear ownership?",
  },
  design: {
    label: "product design",
    triggers: ["designer", "ux", "ui", "figma", "research", "prototype", "design system"],
    technical: ["User research", "Interaction design", "Prototyping", "Design systems"],
    topics: ["Design rationale", "Accessibility", "User testing", "Product collaboration"],
    roleQuestion: "Walk me through how you would move from an ambiguous user problem to a validated design decision.",
  },
  general: {
    label: "cross-functional business",
    triggers: [],
    technical: ["Domain expertise", "Data-informed decisions", "Process improvement", "Execution"],
    topics: ["Prioritization", "Communication", "Problem solving", "Results"],
    roleQuestion: "How would you approach an ambiguous, high-impact problem in this role?",
  },
} as const;

const codingChallenges: Record<string, CodingChallenge[]> = {
  software: [
    {
      title: "Merge overlapping maintenance windows",
      prompt: "Implement solution(windows). Merge overlapping [start, end] time windows and return them ordered by start time.",
      examples: "[[1, 3], [2, 6], [8, 10]] → [[1, 6], [8, 10]]",
      starter: `function solution(windows) {\n  // Merge overlapping time windows.\n  return [];\n}`,
      tests: [
        { input: [[1, 3], [2, 6], [8, 10]], expected: [[1, 6], [8, 10]] },
        { input: [[1, 4], [4, 5]], expected: [[1, 5]] },
        { input: [], expected: [] },
      ],
    },
    {
      title: "Find the longest successful deployment streak",
      prompt: "Implement solution(deployments). Return the longest number of consecutive successful deployments.",
      examples: "[true, true, false, true, true, true] → 3",
      starter: `function solution(deployments) {\n  // Return the longest consecutive run of true values.\n  return 0;\n}`,
      tests: [
        { input: [true, true, false, true, true, true], expected: 3 },
        { input: [false, false], expected: 0 },
        { input: [true, true, true, true], expected: 4 },
      ],
    },
    {
      title: "Identify duplicate request IDs",
      prompt: "Implement solution(requestIds). Return duplicate request IDs once each, in the order their duplicate is first detected.",
      examples: '["a", "b", "a", "c", "b"] → ["a", "b"]',
      starter: `function solution(requestIds) {\n  // Return each duplicated request ID once.\n  return [];\n}`,
      tests: [
        { input: ["a", "b", "a", "c", "b"], expected: ["a", "b"] },
        { input: ["x", "x", "x"], expected: ["x"] },
        { input: [], expected: [] },
      ],
    },
  ],
  data: [{
    title: "Summarize valid revenue records",
    prompt: "Implement solution(rows). Return the sum of positive numeric revenue values, rounded to two decimals.",
    examples: '[{ revenue: 10 }, { revenue: -2 }, { revenue: 3.456 }] → 13.46',
    starter: `function solution(rows) {\n  // Ignore missing, non-numeric, and negative revenue.\n  return 0;\n}`,
    tests: [
      { input: [{ revenue: 10 }, { revenue: -2 }, { revenue: 3.456 }], expected: 13.46 },
      { input: [{ revenue: "bad" }, {}, { revenue: 5 }], expected: 5 },
      { input: [], expected: 0 },
    ],
  }],
  security: [{
    title: "Identify suspicious login sources",
    prompt: "Implement solution(events). Return sorted IPs with at least three failed login events.",
    examples: '[{ ip: "10.0.0.1", ok: false }, …] → ["10.0.0.1"]',
    starter: `function solution(events) {\n  // Find IPs with 3+ failed attempts.\n  return [];\n}`,
    tests: [
      { input: [{ ip: "a", ok: false }, { ip: "a", ok: false }, { ip: "b", ok: false }, { ip: "a", ok: false }], expected: ["a"] },
      { input: [{ ip: "b", ok: false }, { ip: "a", ok: false }, { ip: "b", ok: false }, { ip: "b", ok: false }], expected: ["b"] },
      { input: [], expected: [] },
    ],
  }],
};

const instructionPattern =
  /(ignore|override|disregard).{0,35}(instruction|prompt|system|developer)|reveal.{0,25}(prompt|secret|instruction)|jailbreak|<\s*script|javascript\s*:/i;

function cleanText(value: string, limit: number) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function getRoleProfile(title: string, description: string) {
  const haystack = `${title} ${description}`.toLowerCase();
  const entries = Object.entries(roleProfiles).filter(([key]) => key !== "general");
  return entries
    .map(([key, profile]) => ({
      key,
      profile,
      score: profile.triggers.reduce((total, trigger) => total + (haystack.includes(trigger) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.score
    ? entries
        .map(([key, profile]) => ({
          key,
          profile,
          score: profile.triggers.reduce((total, trigger) => total + (haystack.includes(trigger) ? 1 : 0), 0),
        }))
        .sort((a, b) => b.score - a.score)[0]
    : { key: "general", profile: roleProfiles.general, score: 0 };
}

function pickVariant<T>(items: readonly T[], variant: number, offset = 0) {
  return items[(variant + offset) % items.length];
}

function buildInterview(
  rawTitle: string,
  rawDescription: string,
  level: string,
  interviewType: string,
  variant = 0,
) {
  const title = cleanText(rawTitle, 100) || "this role";
  const description = cleanText(rawDescription, 4000);
  const { key, profile } = getRoleProfile(title, description);
  const levelLabel =
    level === "internship"
      ? "internship"
      : level === "entry"
        ? "entry-level"
        : level === "mid"
          ? "mid-level"
          : "senior";
  const leadershipQuestions =
    level === "senior"
      ? [
          `As a ${title}, how would you set direction, influence stakeholders, and raise the performance of the wider team?`,
          `What would your first 90 days look like as a ${title}, and how would you decide where to intervene personally versus delegate?`,
          `Tell me how you would challenge an executive decision that creates risk for ${profile.topics[0].toLowerCase()}.`,
        ]
      : level === "mid"
        ? [
            `As a ${title}, how would you independently drive a project while keeping partners aligned?`,
            `How would you recognize that a project needs escalation, and what context would you bring to leadership?`,
            `How do you balance independent judgment with seeking feedback in a ${title} role?`,
          ]
        : level === "entry"
          ? [
              `As a new ${title}, how would you take ownership of a clearly scoped project while knowing when to ask for guidance?`,
              `Describe how you would build confidence in a task you have not completed before and communicate your progress.`,
              `How would you use feedback during your first few months to improve the quality and independence of your work?`,
            ]
          : [
            `As a ${title}, how would you seek context, learn quickly, and deliver a well-scoped first contribution?`,
            `As an intern, how would you approach an unfamiliar task using documentation, experimentation, and questions for your mentor?`,
            `What would you do to make an internship project useful to the team while developing your own skills?`,
            ];
  const roleQuestions = [
    profile.roleQuestion.replace("this role", title),
    `You inherit a ${profile.topics[0].toLowerCase()} initiative that is underperforming. How would you diagnose the cause and choose the next action as a ${title}?`,
    `What signals would tell you that your approach to ${profile.topics[2].toLowerCase()} is working, and how would you respond if the signals disagree?`,
  ];
  const behavioralQuestions = [
    `Tell me about a time you demonstrated ${profile.topics[0].toLowerCase()} in work relevant to a ${title}.`,
    `Describe a time your original approach to ${profile.topics[1].toLowerCase()} was wrong. What did you learn and change?`,
    `Give me an example of when you improved ${profile.topics[2].toLowerCase()} without having formal authority.`,
  ];
  const problemQuestions = [
    `Describe how you would handle an ambiguous ${profile.topics[1].toLowerCase()} problem with incomplete information.`,
    `A critical assumption behind ${profile.topics[0].toLowerCase()} is challenged one week before launch. How would you respond?`,
    `How would you choose between speed and confidence when making a decision about ${profile.topics[2].toLowerCase()}?`,
  ];
  const collaborationQuestions = [
    `Tell me about a difficult partnership you improved while delivering ${profile.topics[2].toLowerCase()}.`,
    `Describe a disagreement with a cross-functional partner about ${profile.topics[0].toLowerCase()}. How did you reach a decision?`,
    `Tell me about a time stakeholder expectations conflicted during ${profile.topics[1].toLowerCase()}. What did you do?`,
  ];
  const technicalQuestions = [
    `Explain a difficult tradeoff involving ${profile.technical[0]} and ${profile.technical[1]}. What would change your decision?`,
    `How would you evaluate the quality and reliability of work involving ${profile.technical[2]}?`,
    `Walk me through a failure mode involving ${profile.technical[3]}. How would you detect and mitigate it?`,
  ];
  const questions: InterviewQuestion[] = [
    {
      category: "Role specific",
      question: pickVariant(roleQuestions, variant),
      why: `Tests practical judgment expected in ${profile.label}.`,
    },
    {
      category: "Behavioral",
      question: pickVariant(behavioralQuestions, variant, 1),
      why: "Looks for specific ownership, actions, and measurable results.",
    },
    {
      category: "Role level",
      question: pickVariant(leadershipQuestions, variant, 2),
      why: `Calibrated to ${levelLabel} scope, autonomy, and influence.`,
    },
    {
      category: "Problem solving",
      question: pickVariant(problemQuestions, variant, 1),
      why: "Evaluates structure, assumptions, tradeoffs, and risk reduction.",
    },
    {
      category: interviewType === "behavioral" ? "Collaboration" : "Technical depth",
      question:
        interviewType === "behavioral"
          ? pickVariant(collaborationQuestions, variant, 2)
          : pickVariant(technicalQuestions, variant, 2),
      why: interviewType === "behavioral" ? "Reveals empathy and conflict resolution." : "Tests domain depth and decision quality.",
    },
  ];
  const challengeOptions = codingChallenges[key];
  const challenge = challengeOptions?.[variant % challengeOptions.length];
  if (challenge && interviewType !== "behavioral") {
    questions.push({
      category: "Coding",
      question: pickVariant(
        [
          challenge.title,
          `${challenge.title}: solve it with clear edge-case handling`,
          `${challenge.title}: optimize for correctness and readability`,
        ],
        variant,
      ),
      why: "Includes executable tests in a restricted browser sandbox.",
      coding: challenge,
    });
  }
  const analysis: RoleAnalysis = {
    summary: `This ${levelLabel} ${title} interview emphasizes ${profile.label}, ${profile.topics.slice(0, 3).join(", ").toLowerCase()}, and evidence of impact. Questions are derived from the selected role, level, interview type, and job description—not a fixed list.`,
    technical: [...profile.technical],
    soft:
      level === "senior"
        ? ["Strategic influence", "Executive communication", "Mentorship", "Ownership"]
        : level === "mid"
          ? ["Cross-functional collaboration", "Clear communication", "Independent execution"]
          : level === "entry"
            ? ["Learning agility", "Communication", "Teamwork", "Ownership"]
            : ["Curiosity", "Coachability", "Communication", "Learning agility"],
    topics: [...profile.topics],
  };
  return { questions, analysis, containsInstructionLikeText: instructionPattern.test(`${rawTitle} ${rawDescription}`) };
}

const sampleAnswer =
  "During a cross-functional launch, support and engineering disagreed about which customer issue to solve first. I did not own either roadmap, so I analyzed support tickets and interviewed five account managers. The data showed one workflow caused nearly half of our escalations. I brought both teams into a focused working session, aligned everyone on customer impact, and proposed a two-week experiment. The change reduced related tickets by 38 percent and became part of the next release.";

function sessionKeyFor(title: string, company: string, level: string) {
  return JSON.stringify([
    title.trim().toLowerCase().replace(/\s+/g, " "),
    company.trim().toLowerCase().replace(/\s+/g, " "),
    level,
  ]);
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [started, setStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [jobTitle, setJobTitle] = useState("Senior Product Manager");
  const [company, setCompany] = useState("Northstar Labs");
  const [interviewType, setInterviewType] = useState("mixed");
  const [difficulty, setDifficulty] = useState("senior");
  const [jobDescription, setJobDescription] = useState(
    "Lead product strategy for a B2B platform. Partner with engineering, design, sales, and customer success. Use data and customer research to prioritize the roadmap and deliver measurable outcomes.",
  );
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [roleAnalysis, setRoleAnalysis] = useState<RoleAnalysis | null>(null);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedbackReady, setFeedbackReady] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [codeFeedback, setCodeFeedback] = useState<CodeFeedback | null>(null);
  const [codeFeedbackLanguage, setCodeFeedbackLanguage] = useState<CodeLanguage>("javascript");
  const [isReviewingCode, setIsReviewingCode] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("practice");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Ready to record");
  const [answerHistory, setAnswerHistory] = useState<AnswerAttempt[]>([]);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [isAnswerHistoryLoaded, setIsAnswerHistoryLoaded] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedInterviewSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [areSavedSessionsLoaded, setAreSavedSessionsLoaded] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
  }, [isDarkMode]);

  useEffect(() => {
    try {
      const savedHistory = window.localStorage.getItem(answerHistoryStorageKey);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          // Hydrate browser-only session data after the client mounts.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setAnswerHistory(
            parsedHistory
              .filter((attempt) => attempt && typeof attempt.sessionId === "string")
              .slice(0, 100),
          );
        }
      }
    } catch {
      window.localStorage.removeItem(answerHistoryStorageKey);
    } finally {
      setIsAnswerHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isAnswerHistoryLoaded) return;
    window.localStorage.setItem(answerHistoryStorageKey, JSON.stringify(answerHistory.slice(0, 100)));
  }, [answerHistory, isAnswerHistoryLoaded]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(interviewSessionsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Hydrate browser-only saved sessions after the client mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(parsed)) setSavedSessions(parsed.slice(0, 20));
      }
    } catch {
      window.localStorage.removeItem(interviewSessionsStorageKey);
    } finally {
      setAreSavedSessionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!areSavedSessionsLoaded) return;
    window.localStorage.setItem(interviewSessionsStorageKey, JSON.stringify(savedSessions.slice(0, 20)));
  }, [savedSessions, areSavedSessionsLoaded]);

  useEffect(() => {
    const updateActiveSection = () => {
      const marker = window.scrollY + Math.min(320, window.innerHeight * 0.38);
      const feedbackTop = document.querySelector("#feedback")?.getBoundingClientRect().top ?? Infinity;
      const questionsTop = document.querySelector("#questions")?.getBoundingClientRect().top ?? Infinity;
      const pageMarker = marker - window.scrollY;
      if (feedbackTop <= pageMarker) setActiveSection("feedback");
      else if (questionsTop <= pageMarker) setActiveSection("questions");
      else setActiveSection("practice");
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(
      () => setRecordingSeconds((current) => current + 1),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordingUrl]);

  const selectedQuestion =
    selectedQuestionIndex === null ? null : questions[selectedQuestionIndex];

  const score = codeFeedback?.score ?? feedback?.score ?? (feedbackReady ? 8.7 : null);
  const sessionAnswerHistory = useMemo(
    () => answerHistory.filter((attempt) => attempt.sessionId === activeSessionId),
    [activeSessionId, answerHistory],
  );

  const recordAttempt = (attempt: Omit<AnswerAttempt, "id" | "createdAt" | "sessionId">) => {
    if (!activeSessionId) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const savedAttempt: AnswerAttempt = {
      ...attempt,
      id,
      sessionId: activeSessionId,
      createdAt: now,
    };
    setAnswerHistory((current) => [savedAttempt, ...current].slice(0, 100));
    setSavedSessions((current) => {
      const session = current.find((item) => item.id === activeSessionId);
      if (!session) return current;
      return [{ ...session, updatedAt: now }, ...current.filter((item) => item.id !== activeSessionId)];
    });
    setActiveAttemptId(id);
  };

  const recordingTime = useMemo(
    () =>
      `${String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:${String(
        recordingSeconds % 60,
      ).padStart(2, "0")}`,
    [recordingSeconds],
  );

  const startPrep = async () => {
    setIsStarting(true);
    setNotice("");
    const targetSessionKey = sessionKeyFor(jobTitle, company, difficulty);
    const matchingSession = savedSessions.find((session) => session.key === targetSessionKey);
    const previousQuestions =
      activeSessionId && matchingSession?.id === activeSessionId
        ? questions.map((item) => item.question)
        : matchingSession?.questions.map((item) => item.question) ?? [];
    let generated: { questions: InterviewQuestion[]; analysis: RoleAnalysis; containsInstructionLikeText?: boolean };
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          company,
          jobDescription,
          level: difficulty,
          interviewType,
          previousQuestions,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Live AI is unavailable.");
      generated = payload;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Live AI is unavailable.");
      setIsStarting(false);
      return;
    }
    setQuestions(generated.questions);
    setRoleAnalysis(generated.analysis);
    const now = new Date().toISOString();
    const sessionId = matchingSession?.id ?? crypto.randomUUID();
    const updatedSession: SavedInterviewSession = {
      id: sessionId,
      key: targetSessionKey,
      title: jobTitle.trim(),
      company: company.trim(),
      level: difficulty,
      interviewType,
      jobDescription: jobDescription.trim(),
      questions: generated.questions,
      analysis: generated.analysis,
      createdAt: matchingSession?.createdAt ?? now,
      updatedAt: now,
    };
    setSavedSessions((current) => [
      updatedSession,
      ...current.filter((session) => session.id !== sessionId && session.key !== targetSessionKey),
    ].slice(0, 20));
    setActiveSessionId(sessionId);
    setStarted(true);
    setSelectedQuestionIndex(0);
    setFeedbackReady(false);
    setFeedback(null);
    setFeedbackError("");
    setCodeFeedback(null);
    setActiveAttemptId(null);
    setIsStarting(false);
    setNotice(`${generated.questions.length} fresh questions generated live with Google AI Studio.`);
    window.setTimeout(
      () => document.querySelector("#questions")?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  const selectQuestion = (index: number) => {
    setSelectedQuestionIndex(index);
    setAnswer("");
    setFeedbackReady(false);
    setFeedback(null);
    setFeedbackError("");
    setCodeFeedback(null);
    setActiveAttemptId(null);
    setNotice("");
    setRecordingUrl("");
    setRecordingSeconds(0);
  };

  const reviewAnswer = async () => {
    if (!selectedQuestion) return;
    const submittedAnswer = answer.trim().length < 20 ? sampleAnswer : answer;
    if (submittedAnswer !== answer) setAnswer(submittedAnswer);
    setIsReviewing(true);
    setFeedbackError("");
    setFeedbackReady(false);
    setNotice("");
    window.setTimeout(
      () => document.querySelector("#feedback")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      100,
    );
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          level: difficulty,
          question: selectedQuestion.question,
          answer: submittedAnswer,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Live AI feedback is unavailable.");
      if (!payload) throw new Error("The AI feedback response could not be read. Please try again.");
      setFeedback(payload);
      setFeedbackError("");
      setCodeFeedback(null);
      setFeedbackReady(true);
      recordAttempt({
        question: selectedQuestion.question,
        response: submittedAnswer,
        score: payload.score,
        feedback: payload,
      });
      setNotice("Your answer was reviewed live with Google AI Studio.");
    } catch (error) {
      setFeedback(null);
      setCodeFeedback(null);
      setFeedbackReady(false);
      setFeedbackError(error instanceof Error ? error.message : "Live AI feedback is unavailable.");
      setNotice("");
      setIsReviewing(false);
      return;
    }
    setIsReviewing(false);
    window.setTimeout(
      () => document.querySelector("#feedback")?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  const beginCodeReview = () => {
    setIsReviewingCode(true);
    setFeedbackReady(false);
    setFeedback(null);
    setFeedbackError("");
    setCodeFeedback(null);
    setActiveAttemptId(null);
    setNotice("Tests finished. The AI coach is reviewing your code…");
  };

  const completeCodeReview = (review: CodeFeedback, language: CodeLanguage, submittedCode: string) => {
    setCodeFeedback(review);
    setCodeFeedbackLanguage(language);
    setFeedback(null);
    setFeedbackReady(true);
    setIsReviewingCode(false);
    recordAttempt({
      question: selectedQuestion?.question || "Coding practice",
      response: submittedCode,
      score: review.score,
      codeFeedback: review,
      codeLanguage: language,
    });
    setNotice("Your code was reviewed live with Google AI Studio.");
    window.setTimeout(
      () => document.querySelector("#feedback")?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  const failCodeReview = (message: string) => {
    setCodeFeedback(null);
    setFeedbackReady(false);
    setIsReviewingCode(false);
    setNotice(message);
  };

  const clearCodeReview = () => {
    setCodeFeedback(null);
    setFeedbackReady(false);
    setIsReviewingCode(false);
    setActiveAttemptId(null);
  };

  const loadAttempt = (attempt: AnswerAttempt) => {
    setAnswer(attempt.response);
    setFeedback(attempt.feedback ?? null);
    setFeedbackError("");
    setCodeFeedback(attempt.codeFeedback ?? null);
    if (attempt.codeLanguage) setCodeFeedbackLanguage(attempt.codeLanguage);
    setFeedbackReady(true);
    setActiveAttemptId(attempt.id);
    setNotice("Loaded a previous answer attempt.");
    window.setTimeout(
      () => document.querySelector("#feedback")?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  const loadSession = (session: SavedInterviewSession) => {
    setJobTitle(session.title);
    setCompany(session.company);
    setDifficulty(session.level);
    setInterviewType(session.interviewType);
    setJobDescription(session.jobDescription);
    setQuestions(session.questions);
    setRoleAnalysis(session.analysis);
    setActiveSessionId(session.id);
    setStarted(true);
    setSelectedQuestionIndex(session.questions.length ? 0 : null);
    setAnswer("");
    setFeedbackReady(false);
    setFeedback(null);
    setFeedbackError("");
    setCodeFeedback(null);
    setActiveAttemptId(null);
    setNotice(`Loaded your ${session.title} interview session.`);
  };

  const deleteSession = (sessionId: string) => {
    setSavedSessions((current) => current.filter((session) => session.id !== sessionId));
    setAnswerHistory((current) => current.filter((attempt) => attempt.sessionId !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setStarted(false);
      setQuestions([]);
      setRoleAnalysis(null);
      setSelectedQuestionIndex(null);
      setAnswer("");
      setFeedbackReady(false);
      setFeedback(null);
      setFeedbackError("");
      setCodeFeedback(null);
      setActiveAttemptId(null);
    }
  };

  const resetDemo = () => {
    stopVoiceRecording();
    setJobTitle("");
    setCompany("");
    setInterviewType("mixed");
    setDifficulty("senior");
    setJobDescription("");
    setStarted(false);
    setQuestions([]);
    setRoleAnalysis(null);
    setSelectedQuestionIndex(null);
    setAnswer("");
    setFeedbackReady(false);
    setFeedback(null);
    setFeedbackError("");
    setCodeFeedback(null);
    setActiveAttemptId(null);
    setActiveSessionId(null);
    setIsReviewingCode(false);
    setNotice("");
    setRecordingUrl("");
    setRecordingSeconds(0);
    setVoiceStatus("Ready to record");
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceStatus("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingSeconds(0);
      setRecordingUrl("");
      setVoiceStatus("Recording — speak naturally");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecordingUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      const speechWindow = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const SpeechRecognition =
        speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.onresult = (event) => {
          let finalText = "";
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            if (event.results[index].isFinal) {
              finalText += event.results[index][0].transcript;
            }
          }
          if (finalText.trim()) {
            setAnswer((current) => `${current}${current ? " " : ""}${finalText.trim()}`);
          }
        };
        recognitionRef.current = recognition;
        recognition.start();
        setVoiceStatus("Recording + live transcription");
      }

      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceStatus("Microphone access was not enabled. You can still type your answer.");
    }
  };

  function stopVoiceRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    if (recorderRef.current) setVoiceStatus("Recording saved — review or play it back");
  }

  const applyImportedJob = (job: ImportedJob) => {
    setJobTitle(job.jobTitle);
    setCompany(job.company);
    setDifficulty(job.level);
    setJobDescription(job.jobDescription);
    setNotice("Job details imported. Review them, then start interview prep.");
  };

  const downloadFeedback = () => {
    if (!feedback) return;
    const report = buildFeedbackReport(
      feedback,
      sessionAnswerHistory.find((attempt) => attempt.id === activeAttemptId)?.question
        || selectedQuestion?.question
        || "Not specified",
      jobTitle,
      company,
    );
    const blobUrl = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    const safeRole = (jobTitle || "interview").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = blobUrl;
    link.download = `interviewiq-${safeRole || "interview"}-feedback.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    setNotice("Feedback report downloaded.");
  };

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand stacked-brand">
          <div className="interviewiq-logo" aria-hidden="true">
            <svg className="interviewiq-logo-svg" viewBox="0 0 120 120" focusable="false">
              <defs>
                <linearGradient id="interviewIqGradient" x1="16" y1="20" x2="104" y2="100">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="48%" stopColor="#5b5cf6" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
                <filter id="interviewIqGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d="M60 10L102 34V82L60 110L18 82V34L60 10Z" fill="url(#interviewIqGradient)" filter="url(#interviewIqGlow)" />
              <path className="logo-cutout" d="M42 42L60 30L78 42V75L67 82V49L60 45L53 49V82L42 75V42Z" />
              <path className="logo-check" d="M53 82L66 94L94 74V91L64 110L42 90V75L53 82Z" />
              <path className="logo-inner-highlight" d="M60 10L102 34V82L60 110V93L86 76V43L60 28V10Z" />
            </svg>
          </div>
          <div className="brand-text-block">
            <p className="brand-name">Interview<span>IQ</span></p>
            <p className="brand-subtitle">AI interview coach</p>
          </div>
        </div>

        <ProductSwitcher active="interview" />

        <nav className="sidebar-nav" aria-label="InterviewIQ navigation">
          <a className={`nav-item ${activeSection === "practice" ? "active" : ""}`} href="#practice" onClick={() => setActiveSection("practice")}><span className="nav-icon">01</span>Practice</a>
          <a className={`nav-item ${activeSection === "questions" ? "active" : ""}`} href="#questions" onClick={() => setActiveSection("questions")}><span className="nav-icon">02</span>Questions</a>
          <a className={`nav-item ${activeSection === "feedback" ? "active" : ""}`} href="#feedback" onClick={() => setActiveSection("feedback")}><span className="nav-icon">03</span>Feedback</a>
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-card-label">Session stats</p>
          <div className="stat-row"><span>Questions</span><strong>{started ? questions.length : 0}</strong></div>
          <div className="stat-row"><span>Selected</span><strong>{selectedQuestionIndex === null ? "None" : `Question ${selectedQuestionIndex + 1}`}</strong></div>
          <div className="stat-row"><span>Score</span><strong>{score ? `${score}/10` : "Pending"}</strong></div>
        </div>

        <button className="theme-toggle" type="button" onClick={() => setIsDarkMode((value) => !value)}>
          <span className="theme-toggle-icon">{isDarkMode ? "☀" : "☾"}</span>
          <span>{isDarkMode ? "Light mode" : "Dark mode"}</span>
        </button>

        <div className="sidebar-footer">
          <p>Demo AI engine</p>
          <strong><i /> Ready</strong>
        </div>
      </aside>

      <main className="app-shell" id="top">
        <section className="hero">
          <div>
            <p className="eyebrow">AI-powered interview preparation</p>
            <h1>Practice smarter.<br />Answer stronger.</h1>
            <p className="hero-copy">
              Generate realistic interview questions from a job description,
              practice by typing or recording your answers, and get direct AI coaching.
            </p>
            <div className="hero-actions"><Link className="resume-studio-button" href="/resume/">Open Resume Studio <span>→</span></Link></div>
          </div>
          <div className="hero-card">
            <span className="status-dot" />
            <div><p className="hero-card-label">Portfolio demo</p><p className="hero-card-value">Interactive + voice enabled</p></div>
          </div>
        </section>

        {notice && <section className="success-alert" role="status">{notice}</section>}

        <section className="panel session-history-panel">
          <div className="panel-header">
            <div><p className="section-label">Your progress</p><h2>Saved interview sessions</h2></div>
            <span className="count-pill">{savedSessions.length} sessions</span>
          </div>
          {savedSessions.length === 0 ? (
            <EmptyState icon="01" title="No saved sessions yet" text="Start interview prep to create your first saved session on this device." />
          ) : (
            <div className="session-list">
              {savedSessions.map((session) => {
                const attempts = answerHistory.filter((attempt) => attempt.sessionId === session.id);
                const averageScore = attempts.length
                  ? attempts.reduce((total, attempt) => total + attempt.score, 0) / attempts.length
                  : null;
                return (
                  <article className={`session-card ${session.id === activeSessionId ? "active-session" : ""}`} key={session.id}>
                    <div className="session-card-main">
                      <div><h3>{session.title}</h3><p>{session.company || "Company not specified"}</p></div>
                      <span className="session-score">{averageScore ? `${averageScore.toFixed(1)}/10` : "New"}</span>
                    </div>
                    <div className="session-meta">
                      <span>{formatAttemptDate(session.updatedAt)}</span>
                      <span>{formatLevel(session.level)}</span>
                      <span>{attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}</span>
                    </div>
                    <div className="session-actions">
                      <button className="small-action-button" type="button" onClick={() => loadSession(session)}>Load session</button>
                      <button className="small-action-button danger-action" type="button" onClick={() => deleteSession(session.id)} aria-label={`Delete ${session.title} interview session`}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="layout-grid" id="practice">
          <article className="panel form-panel">
            <div className="panel-header">
              <div><p className="section-label">Step 1</p><h2>Build your interview</h2></div>
              <button className="ghost-button" type="button" onClick={resetDemo}>Reset</button>
            </div>
            <JobUrlImporter onImported={applyImportedJob} />
            <label className="field"><span>Job title</span><input maxLength={100} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></label>
            <label className="field"><span>Company name</span><input maxLength={100} value={company} onChange={(event) => setCompany(event.target.value)} /></label>
            <div className="field-row">
              <label className="field"><span>Interview type</span><select value={interviewType} onChange={(event) => setInterviewType(event.target.value)}><option value="mixed">Mixed</option><option value="behavioral">Behavioral</option><option value="technical">Technical</option></select></label>
              <label className="field"><span>Role level</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="internship">Internship</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior level</option></select></label>
            </div>
            <label className="field">
              <span>Job description</span>
              <textarea maxLength={4000} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
            </label>
            <button className="primary-button" type="button" onClick={startPrep} disabled={isStarting}>
              {isStarting ? "Analyzing role and generating questions…" : started ? "Regenerate interview prep" : "Start interview prep"}
            </button>
          </article>

          <article className="panel analysis-panel">
            <div className="panel-header">
              <div><p className="section-label">AI job analysis</p><h2>What this role is looking for</h2></div>
            {roleAnalysis && <span className="count-pill">Analysis ready</span>}
            </div>
            {!roleAnalysis ? (
              <EmptyState icon="AI" title="Your role analysis will appear here" text="Start interview prep to identify the skills, responsibilities, and likely interview themes in this job description." />
            ) : (
              <div className="analysis-content">
                <div className="analysis-summary"><h3>Role summary</h3><p>{roleAnalysis.summary}</p></div>
                <AnalysisGroup title="Technical skills" items={roleAnalysis.technical} />
                <AnalysisGroup title="Soft skills" items={roleAnalysis.soft} />
                <AnalysisGroup title="Likely interview topics" items={roleAnalysis.topics} />
              </div>
            )}
          </article>
        </section>

        <section className="practice-workspace" id="questions">
          <div className="practice-column">
          <article className="panel questions-panel">
            <div className="panel-header">
              <div><p className="section-label">Step 2</p><h2>Generated questions</h2></div>
              <span className="count-pill">{started ? `${questions.length} questions` : "Waiting"}</span>
            </div>
            {!started ? (
              <EmptyState icon="02" title="No questions yet" text="Your tailored question set will be generated after the job analysis." />
            ) : (
              <div className="question-list">
                {questions.map((item, index) => (
                  <button className={`question-card ${selectedQuestionIndex === index ? "selected" : ""}`} type="button" key={item.question} onClick={() => selectQuestion(index)}>
                    <span className="question-card-top"><span className="category-badge">{item.category}</span><span className="question-number">0{index + 1}</span></span>
                    <span className="question-text">{item.question}</span>
                    <span className="why-it-matters">{item.why}</span>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="panel answer-history-panel">
            <div className="panel-header">
              <div><p className="section-label">Previous attempts</p><h2>Answer history</h2></div>
              <span className="count-pill">{sessionAnswerHistory.length} {sessionAnswerHistory.length === 1 ? "attempt" : "attempts"}</span>
            </div>
            {sessionAnswerHistory.length === 0 ? (
              <EmptyState icon="AI" title="No attempts in this session" text="Submit an answer or run a coding review and it will be saved only to this interview session." />
            ) : (
              <div className="answer-history-list">
                {sessionAnswerHistory.map((attempt) => (
                  <button
                    className={`answer-history-card ${activeAttemptId === attempt.id ? "active-answer" : ""}`}
                    type="button"
                    key={attempt.id}
                    onClick={() => loadAttempt(attempt)}
                  >
                    <span className="answer-history-top">
                      <span className="answer-history-score">{attempt.score.toFixed(1)}/10</span>
                      <span className="answer-history-date">{formatAttemptDate(attempt.createdAt)}</span>
                    </span>
                    <span className="answer-history-question">{attempt.question}</span>
                    <span className="answer-history-preview">{attempt.codeFeedback?.verdict || attempt.response}</span>
                  </button>
                ))}
              </div>
            )}
          </article>
          </div>

          <div className="practice-column">
          <article className="panel answer-panel">
            <div className="panel-header">
              <div><p className="section-label">Step 3</p><h2>Practice your answer</h2></div>
              {recordingUrl && <span className="count-pill">Voice saved</span>}
            </div>
            {!selectedQuestion ? (
              <EmptyState icon="03" title="Choose a question to begin" text="Select one of your generated questions, then type or record your response." />
            ) : (
              <>
                <div className="selected-question-box">
                  <span className="category-badge">{selectedQuestion.category}</span>
                  <p>{selectedQuestion.question}</p>
                </div>

                {selectedQuestion.coding ? (
                  <CodingPractice
                    key={selectedQuestion.coding.title}
                    challenge={selectedQuestion.coding}
                    onReviewStart={beginCodeReview}
                    onFeedback={completeCodeReview}
                    onError={failCodeReview}
                    onReset={clearCodeReview}
                  />
                ) : (
                  <>
                <div className={`voice-recorder ${isRecording ? "recording" : ""}`}>
                  <div className="voice-recorder-top">
                    <div className="voice-icon">{isRecording ? "●" : "◉"}</div>
                    <div><strong>Voice answer</strong><p>{voiceStatus}</p></div>
                    <span className="voice-time">{recordingTime}</span>
                  </div>
                  <div className="waveform" aria-hidden="true">
                    {[12, 23, 16, 31, 20, 38, 17, 28, 13, 34, 22, 16, 30, 19, 25, 12].map((height, index) => (
                      <i key={index} style={{ height: isRecording ? `${height}px` : "8px" }} />
                    ))}
                  </div>
                  <div className="voice-actions">
                    {!isRecording ? (
                      <button className="record-answer-button" type="button" onClick={startVoiceRecording}><span>●</span> Record answer</button>
                    ) : (
                      <button className="record-answer-button stop-recording" type="button" onClick={stopVoiceRecording}><span>■</span> Stop recording</button>
                    )}
                    <button className="ghost-button" type="button" onClick={() => setAnswer(sampleAnswer)}>Use sample answer</button>
                  </div>
                  {recordingUrl && <audio className="recording-playback" controls src={recordingUrl}>Your browser does not support audio playback.</audio>}
                </div>

                <label className="field answer-field">
                  <span>Your answer or voice transcript</span>
                  <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type your response, or use Record answer for voice practice…" />
                </label>
                <button className="primary-button" type="button" onClick={reviewAnswer} disabled={isReviewing}>
                  {isReviewing ? "Reviewing with Google AI Studio…" : "Review answer with AI"}
                </button>
                <p className="privacy-note">Voice stays in this browser session and is not uploaded or saved.</p>
                  </>
                )}
              </>
            )}
          </article>

          <article className="panel feedback-panel" id="feedback">
            <div className="panel-header">
              <div><p className="section-label">{codeFeedback ? "AI coding coach" : "AI coaching"}</p><h2>Answer feedback</h2></div>
              {feedbackReady && <div className="score-badge"><strong>{score?.toFixed(1)}</strong><span>out of 10</span></div>}
            </div>
            {isReviewing ? (
              <EmptyState
                icon="AI"
                title="Reviewing your answer…"
                text="The AI coach is scoring your response and preparing specific feedback. This can take a few moments on the free demo tier."
              />
            ) : feedbackError ? (
              <div className="feedback-request-error" role="alert">
                <div>
                  <h3>Feedback wasn’t completed</h3>
                  <p>{feedbackError}</p>
                </div>
                <button className="primary-button" type="button" onClick={reviewAnswer}>Try AI feedback again</button>
              </div>
            ) : !feedbackReady ? (
              <EmptyState
                icon="AI"
                title={isReviewingCode ? "Reviewing your code…" : "Your coaching report will appear here"}
                text={
                  selectedQuestion?.coding
                    ? "Run the JavaScript tests, or request a review for Python or Java, to see the score and coaching here."
                    : "Practice an answer and submit it for a score, strengths, improvement areas, coaching notes, and an improved response."
                }
              />
            ) : codeFeedback ? (
              <div className="feedback-content">
                <div className="feedback-block"><h3>AI assessment</h3><p>{codeFeedback.verdict}</p></div>
                <FeedbackBlock title="What works" items={codeFeedback.strengths} />
                <FeedbackBlock title="What to improve" items={codeFeedback.improvements} />
                <div className="feedback-block"><h3>Complexity</h3><p>{codeFeedback.complexity}</p></div>
                <div className="feedback-block suggested-code">
                  <h3>Suggested {codeFeedbackLanguage === "javascript" ? "JavaScript" : codeFeedbackLanguage === "python" ? "Python" : "Java"} solution</h3>
                  <pre><code>{codeFeedback.suggestedCode}</code></pre>
                </div>
              </div>
            ) : feedback ? (
              <div className="feedback-content">
                <div className="feedback-actions">
                  <CopyButton text={buildFeedbackReport(feedback, sessionAnswerHistory.find((attempt) => attempt.id === activeAttemptId)?.question || selectedQuestion?.question || "Not specified", jobTitle, company)} label="Copy feedback" copiedLabel="Feedback copied" />
                  <button className="small-action-button" type="button" onClick={() => setAnswer(feedback.improvedAnswer)}>Use improved answer</button>
                  <button className="small-action-button" type="button" onClick={downloadFeedback}>Download</button>
                </div>
                <FeedbackBlock title="Strengths" items={feedback.strengths} />
                <FeedbackBlock title="Areas to improve" items={feedback.improvements} />
                <div className="feedback-block"><h3>Coaching notes</h3><p>{feedback.coaching}</p></div>
                <div className="feedback-block improved-answer"><h3>Improved answer</h3><p>{feedback.improvedAnswer}</p></div>
              </div>
            ) : null}
          </article>
          </div>
        </section>

        <footer className="demo-footer">
          <strong>InterviewIQ</strong>
          <span>Live AI interview preparation · React · Azure Functions · Google AI Studio</span>
          <a href="https://github.com/BIngram17/InterviewIQ-Live-Demo" target="_blank" rel="noreferrer">View source on GitHub ↗</a>
        </footer>
      </main>
    </div>
  );
}

function starterFor(language: CodeLanguage, challenge: CodingChallenge) {
  if (language === "javascript") {
    return challenge.starter || `function solution(input) {\n  // Write your solution here.\n  return input;\n}`;
  }
  if (language === "python") {
    return `def solution(input):\n    # Write your solution here.\n    return input`;
  }
  return `import java.util.*;\n\nclass Solution {\n    public static Object solution(Object input) {\n        // Write your solution here.\n        return input;\n    }\n}`;
}

function CodingPractice({
  challenge,
  onReviewStart,
  onFeedback,
  onError,
  onReset,
}: {
  challenge: CodingChallenge;
  onReviewStart: () => void;
  onFeedback: (review: CodeFeedback, language: CodeLanguage, code: string) => void;
  onError: (message: string) => void;
  onReset: () => void;
}) {
  const [language, setLanguage] = useState<CodeLanguage>("javascript");
  const [code, setCode] = useState(starterFor("javascript", challenge));
  const [results, setResults] = useState<Array<{ passed: boolean; actual?: unknown; expected?: unknown; error?: string }>>([]);
  const [runnerError, setRunnerError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isReviewingCode, setIsReviewingCode] = useState(false);
  const [runnerKey, setRunnerKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activeRunRef = useRef("");
  const timeoutRef = useRef<number | null>(null);
  const reviewCodeRef = useRef<(testSummary?: string) => Promise<void>>(async () => {});
  const tests = challenge.tests ?? [];

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.source !== "interviewiq-code-runner" ||
        event.data?.runId !== activeRunRef.current
      ) {
        return;
      }
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      const receivedError = typeof event.data.error === "string" ? event.data.error.slice(0, 200) : "";
      const receivedResults = Array.isArray(event.data.results) ? event.data.results.slice(0, tests.length) : [];
      setIsRunning(false);
      setRunnerError(receivedError);
      setResults(receivedResults);
      const passedCount = receivedResults.filter((result: { passed?: boolean }) => result.passed).length;
      void reviewCodeRef.current(receivedError || `${passedCount}/${tests.length} local tests passed`);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [tests.length]);

  const changeLanguage = (nextLanguage: CodeLanguage) => {
    setLanguage(nextLanguage);
    setCode(starterFor(nextLanguage, challenge));
    setResults([]);
    setRunnerError("");
    onReset();
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!["Tab", "Enter", "}", "]", ")"].includes(event.key)) return;
    const target = event.currentTarget;
    const edit = applyCodeEditorKey({
      value: code,
      selectionStart: target.selectionStart,
      selectionEnd: target.selectionEnd,
      key: event.key,
      shiftKey: event.shiftKey,
      language,
    });
    if (!edit) return;
    event.preventDefault();
    if (edit.value.length > 12000) return;
    setCode(edit.value);
    onReset();
    window.requestAnimationFrame(() => target.setSelectionRange(edit.selectionStart, edit.selectionEnd));
  };

  const runTests = () => {
    if (language !== "javascript" || !tests.length || !iframeRef.current?.contentWindow) return;
    const runId = crypto.randomUUID();
    activeRunRef.current = runId;
    setIsRunning(true);
    setResults([]);
    setRunnerError("");
    iframeRef.current.contentWindow.postMessage(
      { type: "run", runId, code: code.slice(0, 12000), tests },
      "*",
    );
    timeoutRef.current = window.setTimeout(() => {
      activeRunRef.current = "";
      setIsRunning(false);
      const timeoutMessage = "Execution stopped after 2 seconds. Check for an infinite loop.";
      setRunnerError(timeoutMessage);
      setRunnerKey((current) => current + 1);
      void reviewCodeRef.current(timeoutMessage);
    }, 2000);
  };

  const reviewCode = async (testSummaryOverride?: string) => {
    setIsReviewingCode(true);
    onReviewStart();
    try {
      const testSummary = testSummaryOverride || (language === "javascript" && tests.length
        ? runnerError || (results.length ? `${results.filter((result) => result.passed).length}/${tests.length} local tests passed` : "Local tests not run")
        : "No local runtime used; review statically.");
      const response = await fetch("/api/code-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          challenge: `${challenge.title}\n${challenge.prompt}\nExample: ${challenge.examples}`,
          code,
          testSummary,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "AI code feedback is unavailable.");
      onFeedback(payload, language, code);
    } catch (error) {
      onError(error instanceof Error ? error.message : "AI code feedback is unavailable.");
    } finally {
      setIsReviewingCode(false);
    }
  };
  useEffect(() => {
    reviewCodeRef.current = reviewCode;
  });

  const passed = results.filter((result) => result.passed).length;
  const languageLabel = language === "javascript" ? "JavaScript" : language === "python" ? "Python" : "Java";

  return (
    <div className="coding-workspace">
      <div className="coding-brief">
        <div><span className="category-badge">{languageLabel}</span><h3>{challenge.title}</h3></div>
        <p>{challenge.prompt}</p>
        <code>{challenge.examples}</code>
      </div>
      <div className="language-tabs" role="group" aria-label="Programming language">
        {(["javascript", "python", "java"] as CodeLanguage[]).map((item) => (
          <button
            className={language === item ? "active" : ""}
            type="button"
            key={item}
            onClick={() => changeLanguage(item)}
          >
            {item === "javascript" ? "JavaScript" : item === "python" ? "Python" : "Java"}
          </button>
        ))}
      </div>
      <div className="editor-toolbar">
        <span>{languageLabel} practice editor</span>
        <small id="coding-editor-help">Tab indents · Shift+Tab outdents · Enter keeps indentation</small>
      </div>
      <label className="sr-only" htmlFor="coding-editor">{languageLabel} solution</label>
      <textarea
        id="coding-editor"
        className="code-editor"
        spellCheck={false}
        aria-describedby="coding-editor-help"
        value={code}
        maxLength={12000}
        onChange={(event) => {
          setCode(event.target.value);
          onReset();
        }}
        onKeyDown={handleEditorKeyDown}
      />
      <div className="code-actions">
        {language === "javascript" && tests.length > 0 && (
          <button className="primary-button" type="button" onClick={runTests} disabled={isRunning || isReviewingCode}>
            {isRunning ? "Running tests…" : isReviewingCode ? "AI coach reviewing…" : `Run ${tests.length} tests + AI feedback`}
          </button>
        )}
        {(language !== "javascript" || tests.length === 0) && (
          <button className="primary-button ai-review-button" type="button" onClick={() => reviewCode()} disabled={isReviewingCode}>
            {isReviewingCode ? "Reviewing code with AI…" : "Get AI code feedback"}
          </button>
        )}
        <button className="ghost-button" type="button" onClick={() => { setCode(starterFor(language, challenge)); setResults([]); setRunnerError(""); onReset(); }}>
          Reset code
        </button>
      </div>
      {(results.length > 0 || runnerError) && (
        <div className={`test-report ${runnerError || passed < tests.length ? "tests-failed" : "tests-passed"}`} role="status">
          <strong>{runnerError || `${passed}/${tests.length} tests passed`}</strong>
          {!runnerError && results.map((result, index) => (
            <span key={index}>{result.passed ? "✓" : "×"} Test {index + 1}{result.error ? `: ${result.error}` : ""}</span>
          ))}
        </div>
      )}
      <iframe
        key={runnerKey}
        ref={iframeRef}
        className="code-runner-frame"
        sandbox="allow-scripts"
        src="/code-runner.html"
        title="Restricted coding test runner"
      />
      <p className="privacy-note">
        JavaScript tests run only in your browser. AI review sends the challenge and code to the protected Azure API; code is reviewed as text and never executed on the server.
      </p>
    </div>
  );
}

function formatAttemptDate(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "Saved attempt";
  if (Date.now() - created.getTime() < 60_000) return "Just now";
  return created.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildFeedbackReport(
  feedback: AnswerFeedback,
  question: string,
  jobTitle: string,
  company: string,
) {
  return [
    "InterviewIQ AI Feedback",
    "",
    `Role: ${jobTitle || "Not specified"}`,
    `Company: ${company || "Not specified"}`,
    `Question: ${question}`,
    `Score: ${feedback.score.toFixed(1)}/10`,
    "",
    "Strengths",
    ...feedback.strengths.map((item) => `- ${item}`),
    "",
    "Areas to improve",
    ...feedback.improvements.map((item) => `- ${item}`),
    "",
    "Coaching notes",
    feedback.coaching,
    "",
    "Improved answer",
    feedback.improvedAnswer,
  ].join("\n");
}

function formatLevel(level: string) {
  if (level === "internship") return "Internship";
  if (level === "entry") return "Entry level";
  if (level === "mid") return "Mid level";
  return "Senior level";
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>;
}

function AnalysisGroup({ title, items }: { title: string; items: string[] }) {
  return <div className="analysis-group"><h3>{title}</h3><div className="analysis-chip-list">{items.map((item) => <span className="analysis-chip" key={item}>{item}</span>)}</div></div>;
}

function FeedbackBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="feedback-block"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
