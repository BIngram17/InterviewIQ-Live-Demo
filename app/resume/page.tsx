"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import CopyButton from "../components/CopyButton";
import ProductSwitcher from "../components/ProductSwitcher";
import JobUrlImporter, { ImportedJob } from "../components/JobUrlImporter";

type Change = { criterionId?: string; section: string; operation?: "add" | "replace" | "move"; placement?: string; sourceEvidence?: string; currentIssue: string; suggestion: string; example: string; relatedRequirement?: string; kind?: "rewrite" | "needs-info"; priority?: "high" | "medium" | "low"; scoreImpact?: number };
type EvaluationCriterion = { id: string; category: string; requirement: string; importance: "required" | "preferred" | "quality"; status: "met" | "partial" | "missing"; projectedStatus: "met" | "partial" | "missing"; evidence: string; explanation: string };
type ScoreBreakdown = { category: string; score: number; maxScore: number; previousScore?: number; evidence: string; improvement: string };
type ResumeResult = {
  action: "review" | "cover-letter";
  headline?: string;
  score?: number;
  projectedScore?: number;
  previousScore?: number;
  scoreDelta?: number;
  reviewFingerprint?: string;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  atsKeywords?: string[];
  nextSteps?: string[];
  scoreBreakdown?: ScoreBreakdown[];
  evaluationCriteria?: EvaluationCriterion[];
  changes?: Change[];
  coverLetter?: string;
  notes?: string[];
  isDraft?: boolean;
  warning?: string;
  retryAfterSeconds?: number;
};

type SavedApplication = {
  id: string;
  name: string;
  updatedAt: number;
  jobTitle: string;
  company: string;
  level: string;
  jobDescription: string;
  resume: string;
  resumeFileName: string;
  reviewResult: ResumeResult | null;
  coverResult: ResumeResult | null;
  coverVersions: CoverVersion[];
};
type CoverTone = "standard" | "concise" | "conversational";
type CoverVersion = { id: string; createdAt: number; tone: CoverTone; result: ResumeResult };
type CandidateProfile = { contactDetails: string; confirmedSkills: string; experienceHighlights: string; achievements: string; educationCertifications: string };

const applicationStorageKey = "interviewiq-saved-applications-v1";
const candidateProfileStorageKey = "interviewiq-candidate-profile-v1";
const reviewFormattingStorageKey = "interviewiq-review-bold-keywords-v1";
const maxSavedApplications = 24;
const emptyCandidateProfile: CandidateProfile = { contactDetails: "", confirmedSkills: "", experienceHighlights: "", achievements: "", educationCertifications: "" };

export default function ResumeStudio() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [resume, setResume] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState("entry");
  const [jobDescription, setJobDescription] = useState("");
  const [reviewResult, setReviewResult] = useState<ResumeResult | null>(null);
  const [isReviewStale, setIsReviewStale] = useState(false);
  const [coverResult, setCoverResult] = useState<ResumeResult | null>(null);
  const [coverTone, setCoverTone] = useState<CoverTone>("standard");
  const [boldImportantPhrases, setBoldImportantPhrases] = useState(false);
  const [coverVersions, setCoverVersions] = useState<CoverVersion[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [resumeStatus, setResumeStatus] = useState("");
  const [coverStatus, setCoverStatus] = useState("");
  const [reviewRetrySeconds, setReviewRetrySeconds] = useState(0);
  const [coverRetrySeconds, setCoverRetrySeconds] = useState(0);
  const [savedApplications, setSavedApplications] = useState<SavedApplication[]>([]);
  const [activeApplicationId, setActiveApplicationId] = useState("");
  const [isMemoryLoaded, setIsMemoryLoaded] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isTargetCollapsed, setIsTargetCollapsed] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "full">("idle");
  const [lastSavedAt, setLastSavedAt] = useState(0);
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [deletedApplication, setDeletedApplication] = useState<SavedApplication | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>(emptyCandidateProfile);
  const [isCandidateProfileLoaded, setIsCandidateProfileLoaded] = useState(false);
  const [isCandidateProfileOpen, setIsCandidateProfileOpen] = useState(false);
  const [isCandidateProfileClearPending, setIsCandidateProfileClearPending] = useState(false);
  const [candidateProfileStatus, setCandidateProfileStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewFormattingLoadedRef = useRef(false);

  useEffect(() => { document.documentElement.dataset.theme = isDarkMode ? "dark" : "light"; }, [isDarkMode]);

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(reviewFormattingStorageKey) === "true";
    const timeout = window.setTimeout(() => {
      reviewFormattingLoadedRef.current = true;
      setBoldImportantPhrases(storedPreference);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!reviewFormattingLoadedRef.current) return;
    window.localStorage.setItem(reviewFormattingStorageKey, String(boldImportantPhrases));
  }, [boldImportantPhrases]);

  useEffect(() => {
    if (reviewRetrySeconds <= 0) return;
    const timeout = window.setTimeout(() => setReviewRetrySeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [reviewRetrySeconds]);

  useEffect(() => {
    if (coverRetrySeconds <= 0) return;
    const timeout = window.setTimeout(() => setCoverRetrySeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [coverRetrySeconds]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(candidateProfileStorageKey);
      const parsed = stored ? JSON.parse(stored) : {};
      const profile = Object.fromEntries(Object.keys(emptyCandidateProfile).map((key) => [key, typeof parsed?.[key] === "string" ? parsed[key] : ""])) as CandidateProfile;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandidateProfile(profile);
    } catch {
      window.localStorage.removeItem(candidateProfileStorageKey);
    } finally {
      setIsCandidateProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isCandidateProfileLoaded) return;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(candidateProfileStorageKey, JSON.stringify(candidateProfile));
        setCandidateProfileStatus(Object.values(candidateProfile).some((value) => value.trim()) ? "Profile saved in this browser." : "");
      } catch {
        setCandidateProfileStatus("Candidate Profile could not be saved because browser storage is full.");
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [candidateProfile, isCandidateProfileLoaded]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(applicationStorageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter((item) => item && typeof item.id === "string" && typeof item.updatedAt === "number")
          .map((item) => ({
            id: item.id,
            name: typeof item.name === "string" ? item.name : "",
            updatedAt: item.updatedAt,
            jobTitle: typeof item.jobTitle === "string" ? item.jobTitle : "",
            company: typeof item.company === "string" ? item.company : "",
            level: ["internship", "entry", "mid", "senior"].includes(item.level) ? item.level : "entry",
            jobDescription: typeof item.jobDescription === "string" ? item.jobDescription : "",
            resume: typeof item.resume === "string" ? item.resume : "",
            resumeFileName: typeof item.resumeFileName === "string" ? item.resumeFileName : "",
            reviewResult: item.reviewResult && typeof item.reviewResult === "object" ? item.reviewResult : null,
            coverResult: item.coverResult && typeof item.coverResult === "object" ? item.coverResult : null,
            coverVersions: Array.isArray(item.coverVersions) ? item.coverVersions.slice(0, 10) : [],
          }))
          .slice(0, maxSavedApplications) as SavedApplication[];
        // Restore the latest device-local application when Resume Studio opens.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSavedApplications(valid);
        if (valid[0]) {
          const latest = valid[0];
          setActiveApplicationId(latest.id);
          setJobTitle(latest.jobTitle || "");
          setCompany(latest.company || "");
          setLevel(latest.level || "entry");
          setJobDescription(latest.jobDescription || "");
          setResume(latest.resume || "");
          setResumeFileName(latest.resumeFileName || "");
          setReviewResult(latest.reviewResult || null);
          setCoverResult(latest.coverResult || null);
          setCoverVersions(latest.coverVersions || []);
          setIsTargetCollapsed(Boolean(latest.jobTitle && latest.jobDescription.length >= 50));
        } else {
          setActiveApplicationId(crypto.randomUUID());
        }
      } else {
        setActiveApplicationId(crypto.randomUUID());
      }
    } catch {
      window.localStorage.removeItem(applicationStorageKey);
      setActiveApplicationId(crypto.randomUUID());
    } finally {
      setIsMemoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isMemoryLoaded) return;
    try {
      window.localStorage.setItem(applicationStorageKey, JSON.stringify(savedApplications.slice(0, maxSavedApplications)));
    } catch {
      window.setTimeout(() => setSaveState("full"), 0);
    }
  }, [isMemoryLoaded, savedApplications]);

  useEffect(() => {
    if (!isMemoryLoaded || !activeApplicationId) return;
    const hasApplication = Boolean(jobTitle.trim() || company.trim() || jobDescription.trim() || resume.trim() || reviewResult || coverResult);
    if (!hasApplication) return;
    const savingTimeout = window.setTimeout(() => setSaveState("saving"), 0);
    const timeout = window.setTimeout(() => {
      const currentName = savedApplications.find((item) => item.id === activeApplicationId)?.name || "";
      const saved: SavedApplication = {
        id: activeApplicationId,
        name: currentName,
        updatedAt: Date.now(),
        jobTitle,
        company,
        level,
        jobDescription,
        resume,
        resumeFileName,
        reviewResult,
        coverResult,
        coverVersions,
      };
      setSavedApplications((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, maxSavedApplications));
      setLastSavedAt(saved.updatedAt);
      setSaveState("saved");
    }, 600);
    return () => { window.clearTimeout(savingTimeout); window.clearTimeout(timeout); };
  // savedApplications is intentionally excluded so the autosave write does not schedule itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeApplicationId, company, coverResult, coverVersions, isMemoryLoaded, jobDescription, jobTitle, level, resume, resumeFileName, reviewResult]);

  const loadApplication = (application: SavedApplication) => {
    setActiveApplicationId(application.id);
    setJobTitle(application.jobTitle);
    setCompany(application.company);
    setLevel(application.level);
    setJobDescription(application.jobDescription);
    setResume(application.resume);
    setResumeFileName(application.resumeFileName);
    setReviewResult(application.reviewResult);
    setIsReviewStale(false);
    setCoverResult(application.coverResult);
    setCoverVersions(application.coverVersions || []);
    setIsTargetCollapsed(Boolean(application.jobTitle && application.jobDescription.length >= 50));
    setResumeStatus("Saved application restored from this browser.");
    setCoverStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startNewApplication = () => {
    setActiveApplicationId(crypto.randomUUID());
    setJobTitle("");
    setCompany("");
    setLevel("entry");
    setJobDescription("");
    setResume("");
    setResumeFileName("");
    setReviewResult(null);
    setIsReviewStale(false);
    setCoverResult(null);
    setCoverVersions([]);
    setIsTargetCollapsed(false);
    setResumeStatus("");
    setCoverStatus("");
  };

  const deleteApplication = (applicationId: string) => {
    const deleted = savedApplications.find((item) => item.id === applicationId) || null;
    setDeletedApplication(deleted);
    setSavedApplications((current) => current.filter((item) => item.id !== applicationId));
    setPendingDeleteId("");
    if (applicationId === activeApplicationId) startNewApplication();
  };

  const renameApplication = (applicationId: string) => {
    const name = renameValue.trim().slice(0, 80);
    setSavedApplications((current) => current.map((item) => item.id === applicationId ? { ...item, name, updatedAt: Date.now() } : item));
    setRenamingId("");
  };

  const updateCandidateProfile = (field: keyof CandidateProfile, value: string) => {
    setCandidateProfile((current) => ({ ...current, [field]: value }));
    setIsReviewStale(Boolean(reviewResult));
    setCoverResult(null);
    setIsCandidateProfileClearPending(false);
  };

  const clearCandidateProfile = () => {
    setCandidateProfile(emptyCandidateProfile);
    setIsReviewStale(Boolean(reviewResult));
    setCoverResult(null);
    setIsCandidateProfileClearPending(false);
    setCandidateProfileStatus("Candidate Profile cleared from this browser.");
  };

  const exportCandidateProfile = () => {
    const content = [
      ["Contact details", candidateProfile.contactDetails],
      ["Confirmed skills", candidateProfile.confirmedSkills],
      ["Experience highlights", candidateProfile.experienceHighlights],
      ["Achievements and metrics", candidateProfile.achievements],
      ["Education and certifications", candidateProfile.educationCertifications],
    ].filter(([, value]) => value.trim()).map(([label, value]) => `${label}\n${value}`).join("\n\n");
    downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), "interviewiq-candidate-profile.txt");
    setCandidateProfileStatus("Candidate Profile exported as a text file.");
  };

  const applyImportedJob = (job: ImportedJob) => {
    setJobTitle(job.jobTitle);
    setCompany(job.company);
    setLevel(job.level);
    setJobDescription(job.jobDescription);
    setReviewResult(null);
    setIsReviewStale(false);
    setCoverResult(null);
    setCoverVersions([]);
    setIsTargetCollapsed(true);
  };

  const extractResume = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setResumeStatus("Resume files must be 5 MB or smaller.");
      return;
    }
    setIsExtracting(true);
    setResumeStatus("Reading your resume...");
    setIsReviewStale(Boolean(reviewResult));
    setCoverResult(null);
    try {
      const form = new FormData();
      form.append("resume", file);
      const response = await fetch("/api/resume-extract", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "The resume could not be read.");
      setResume(payload.resumeText);
      setResumeFileName(payload.fileName);
      setResumeStatus(`${payload.fileName} is ready for review.`);
    } catch (error) {
      setResumeStatus(error instanceof Error ? error.message : "The resume could not be read.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => extractResume(event.target.files?.[0]);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    extractResume(event.dataTransfer.files?.[0]);
  };

  const jobReady = jobTitle.trim().length >= 2 && jobDescription.trim().length >= 50;
  const resumeReady = resume.trim().length >= 120;
  const toolsReady = jobReady && resumeReady;
  const candidateProfileSections = Object.values(candidateProfile).filter((value) => value.trim()).length;

  const runTool = async (action: "review" | "cover-letter") => {
    if (!toolsReady || (action === "review" && reviewRetrySeconds > 0) || (action === "cover-letter" && coverRetrySeconds > 0)) return;
    const setBusy = action === "review" ? setIsReviewing : setIsGeneratingCover;
    const setStatus = action === "review" ? setResumeStatus : setCoverStatus;
    setBusy(true);
    setStatus("");
    const previousReview = action === "review" && reviewResult?.evaluationCriteria?.length
      ? { reviewFingerprint: reviewResult.reviewFingerprint, evaluationCriteria: reviewResult.evaluationCriteria, scoreBreakdown: reviewResult.scoreBreakdown, changes: reviewResult.changes }
      : undefined;
    try {
      const response = await fetch("/api/resume-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resume, candidateProfile, jobTitle, company, level, jobDescription, tone: coverTone, emphasizeKeywords: action === "review" && boldImportantPhrases, previousReview }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (action === "review" && response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          setReviewRetrySeconds(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 30);
        }
        if (action === "cover-letter" && response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          setCoverRetrySeconds(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 30);
        }
        throw new Error(payload?.error || "The resume coach could not complete this request.");
      }
      if (action === "review") {
        setReviewRetrySeconds(0);
        setReviewResult(payload);
        setIsReviewStale(false);
        setStatus("Your review and targeted changes are ready.");
      } else {
        setCoverResult(payload);
        setCoverVersions((current) => [{ id: crypto.randomUUID(), createdAt: Date.now(), tone: coverTone, result: payload }, ...current].slice(0, 10));
        const retryAfter = Number(payload?.retryAfterSeconds);
        setCoverRetrySeconds(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 0);
        setStatus(payload?.isDraft ? payload.warning || "Your draft was preserved, but it still needs a length adjustment." : "Your tailored cover letter is ready.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The resume coach could not complete this request.");
    } finally {
      setBusy(false);
    }
  };

  const downloadCover = async (format: "txt" | "docx") => {
    if (!coverResult?.coverLetter) return;
    const base = safeFileName(`${company || "company"}-${jobTitle || "role"}-cover-letter`);
    if (format === "txt") {
      downloadBlob(new Blob([coverResult.coverLetter], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
    } else {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const paragraphs = coverResult.coverLetter
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
        .filter(Boolean);
      const document = new Document({
        sections: [{
          properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: paragraphs.map((paragraph) => new Paragraph({
            children: [new TextRun({ text: paragraph, font: "Times New Roman", size: 24 })],
            spacing: { line: 240, after: 160 },
          })),
        }],
      });
      downloadBlob(await Packer.toBlob(document), `${base}.docx`);
    }
    setCoverStatus(`Downloaded ${format.toUpperCase()} cover letter.`);
  };

  return (
    <div className="studio-page">
      <header className="studio-topbar">
        <Link className="studio-brand" href="/"><span className="studio-logo">IQ</span><span><strong>Interview<span>IQ</span></strong><small>Resume Studio</small></span></Link>
        <div className="studio-top-actions">
          <ProductSwitcher active="resume" />
          <button className="theme-toggle studio-theme" type="button" onClick={() => setIsDarkMode((value) => !value)}>{isDarkMode ? "Light" : "Dark"}</button>
        </div>
      </header>

      <main className="studio-shell">
        <section className="studio-hero">
          <div><p className="eyebrow">AI application toolkit</p><h1>Build a stronger application in one workspace.</h1><p>Upload your resume for a complete review and targeted changes, then tailor a cover letter to the same job posting.</p></div>
        </section>

        <article className={`panel studio-panel target-job-panel ${isTargetCollapsed ? "target-collapsed" : ""}`}>
          <div className="panel-header"><div><p className="section-label">Shared target</p><h2>{isTargetCollapsed ? `${jobTitle}${company ? ` at ${company}` : ""}` : "Add the job once for both tools"}</h2>{isTargetCollapsed && <p className="memory-note">{formatRoleLevel(level)} · Job details ready</p>}</div><button className="ghost-button" type="button" onClick={() => setIsTargetCollapsed((value) => !value)}>{isTargetCollapsed ? "Edit target" : "Collapse"}</button></div>
          {!isTargetCollapsed && <div className="target-job-layout">
            <JobUrlImporter key={activeApplicationId || "loading"} onImported={applyImportedJob} compact />
            <div className="target-job-fields">
              <div className="target-job-meta">
                <label className="field"><span>Job title</span><input maxLength={100} value={jobTitle} onChange={(event) => { setJobTitle(event.target.value); setReviewResult(null); setIsReviewStale(false); setCoverResult(null); }} /></label>
                <label className="field"><span>Company</span><input maxLength={100} value={company} onChange={(event) => { setCompany(event.target.value); setReviewResult(null); setIsReviewStale(false); setCoverResult(null); }} /></label>
                <label className="field"><span>Role level</span><select value={level} onChange={(event) => { setLevel(event.target.value); setReviewResult(null); setIsReviewStale(false); setCoverResult(null); }}><option value="internship">Internship</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior level</option></select></label>
              </div>
              <label className="field"><span>Job description</span><textarea className="job-description-textarea" value={jobDescription} maxLength={6000} onChange={(event) => { setJobDescription(event.target.value); setReviewResult(null); setIsReviewStale(false); setCoverResult(null); }} placeholder="Import a posting URL or paste the complete job description here." /></label>
              <button className="small-action-button target-ready-button" type="button" disabled={!jobReady} onClick={() => setIsTargetCollapsed(true)}>Use this target job</button>
            </div>
          </div>}
        </article>

        <section className="readiness-strip" aria-label="Application readiness">
          <div><strong>Application readiness</strong><span>{toolsReady ? "Ready for AI review and cover letter" : "Complete the target job and resume to continue"}</span></div>
          <div className="readiness-items"><span className={jobReady ? "ready" : ""}>{jobReady ? "✓" : "1"} Target job</span><span className={resumeReady ? "ready" : ""}>{resumeReady ? "✓" : "2"} Resume</span><span className={reviewResult ? "ready" : ""}>{reviewResult ? "✓" : "3"} Review</span><span className={coverResult ? "ready" : ""}>{coverResult ? "✓" : "4"} Cover letter</span></div>
        </section>

        <section className="panel application-memory-panel">
          <div className="panel-header">
            <div><p className="section-label">Application memory</p><h2>Saved applications</h2><p className="memory-note">{saveState === "saving" ? "Saving…" : saveState === "saved" ? `Saved in this browser · ${formatRelativeTime(lastSavedAt)}` : saveState === "full" ? "Browser storage is full. Delete an older application to continue saving." : `Drafts and AI results save only in this browser. Up to ${maxSavedApplications}; the oldest is replaced at the limit.`}</p></div>
            <div className="memory-header-actions"><span className="count-pill">{savedApplications.length} / {maxSavedApplications} saved</span><button className="ghost-button" type="button" onClick={() => setIsMemoryOpen((value) => !value)}>{isMemoryOpen ? "Hide saved" : "View saved"}</button><button className="ghost-button" type="button" onClick={startNewApplication}>Start new</button></div>
          </div>
          {deletedApplication && <div className="undo-banner"><span>Deleted {deletedApplication.name || deletedApplication.jobTitle || "saved application"}.</span><button type="button" onClick={() => { setSavedApplications((current) => [deletedApplication, ...current].slice(0, maxSavedApplications)); setDeletedApplication(null); }}>Undo</button></div>}
          {isMemoryOpen && (savedApplications.length === 0 ? (
            <div className="memory-empty"><strong>No saved applications yet</strong><span>Your first draft will autosave as you add a job or resume.</span></div>
          ) : (
            <div className="application-memory-list">
              {savedApplications.map((application) => (
                <article className={`application-memory-card ${application.id === activeApplicationId ? "active-memory-card" : ""}`} key={application.id}>
                  <div className="memory-card-heading"><div>{renamingId === application.id ? <div className="rename-row"><input aria-label="Saved application name" value={renameValue} maxLength={80} onChange={(event) => setRenameValue(event.target.value)} /><button type="button" onClick={() => renameApplication(application.id)}>Save</button></div> : <h3>{application.name || application.jobTitle || "Untitled application"}</h3>}<p>{application.jobTitle || "Role not specified"}{application.company ? ` · ${application.company}` : ""}</p></div><span>{formatMemoryDate(application.updatedAt)}</span></div>
                  <div className="memory-card-tags"><span className={application.reviewResult && application.coverResult ? "complete-tag" : "draft-tag"}>{application.reviewResult && application.coverResult ? "Completed" : "Draft"}</span><span>{formatRoleLevel(application.level)}</span>{application.reviewResult && <span>Review saved</span>}{application.coverVersions.length > 0 && <span>{application.coverVersions.length} letter{application.coverVersions.length === 1 ? "" : "s"}</span>}</div>
                  <div className="memory-card-actions"><button className="small-action-button" type="button" onClick={() => loadApplication(application)}>Restore</button><button className="small-action-button" type="button" onClick={() => { setRenamingId(application.id); setRenameValue(application.name || application.jobTitle); }}>Rename</button>{pendingDeleteId === application.id ? <><button className="small-action-button danger-action" type="button" onClick={() => deleteApplication(application.id)}>Confirm delete</button><button className="small-action-button" type="button" onClick={() => setPendingDeleteId("")}>Cancel</button></> : <button className="small-action-button danger-action" type="button" onClick={() => setPendingDeleteId(application.id)}>Delete</button>}</div>
                </article>
              ))}
            </div>
          ))}
        </section>

        <section className="panel candidate-profile-panel">
          <div className="panel-header">
            <div><p className="section-label">Candidate Profile</p><h2>Confirmed career facts</h2><p className="memory-note">Reusable facts from current or previous resumes. Saved only in this browser and used only when you request AI assistance.</p></div>
            <div className="memory-header-actions"><span className="count-pill">{candidateProfileSections} / 5 completed</span><button className="ghost-button" type="button" onClick={() => setIsCandidateProfileOpen((value) => !value)}>{isCandidateProfileOpen ? "Hide profile" : candidateProfileSections ? "Edit profile" : "Create profile"}</button>{candidateProfileSections > 0 && <button className="ghost-button" type="button" onClick={exportCandidateProfile}>Export profile</button>}{isCandidateProfileClearPending ? <><button className="ghost-button danger-action" type="button" onClick={clearCandidateProfile}>Confirm clear</button><button className="ghost-button" type="button" onClick={() => setIsCandidateProfileClearPending(false)}>Cancel</button></> : candidateProfileSections > 0 && <button className="ghost-button danger-action" type="button" onClick={() => setIsCandidateProfileClearPending(true)}>Clear profile</button>}</div>
          </div>
          {isCandidateProfileOpen && <div className="candidate-profile-fields">
            <label className="field"><span>Confirmed skills</span><textarea value={candidateProfile.confirmedSkills} maxLength={1800} onChange={(event) => updateCandidateProfile("confirmedSkills", event.target.value)} placeholder="List only skills and tools you have personally confirmed." /></label>
            <label className="field"><span>Experience highlights</span><textarea value={candidateProfile.experienceHighlights} maxLength={2200} onChange={(event) => updateCandidateProfile("experienceHighlights", event.target.value)} placeholder="Reusable responsibilities, projects, leadership, or domain experience from previous resumes." /></label>
            <label className="field"><span>Achievements and metrics</span><textarea value={candidateProfile.achievements} maxLength={1800} onChange={(event) => updateCandidateProfile("achievements", event.target.value)} placeholder="Verified outcomes, numbers, awards, or accomplishments. Include context so the AI does not guess." /></label>
            <label className="field"><span>Education and certifications</span><textarea value={candidateProfile.educationCertifications} maxLength={1600} onChange={(event) => updateCandidateProfile("educationCertifications", event.target.value)} placeholder="Degrees, dates, certifications, coursework, and training you have confirmed." /></label>
            <label className="field profile-contact-field"><span>Optional contact details</span><textarea value={candidateProfile.contactDetails} maxLength={800} onChange={(event) => updateCandidateProfile("contactDetails", event.target.value)} placeholder="Name, location, email, phone, portfolio, or LinkedIn details to reuse in application documents." /></label>
          </div>}
          {candidateProfileStatus && <p className="studio-status" role="status">{candidateProfileStatus}</p>}
        </section>

        <section className="resume-studio-columns">
          <div className="resume-review-column">
            <article className="panel studio-panel resume-source-panel">
              <div className="panel-header"><div><p className="section-label">Resume reviewer</p><h2>Upload your resume</h2></div><span className="count-pill">{resume.length.toLocaleString()} characters</span></div>
              <div
                className={`resume-drop-zone ${isDragging ? "drag-active" : ""}`}
                role="button"
                tabIndex={0}
                aria-label="Upload a resume from your computer"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }}
                onDrop={handleDrop}
              >
                <input ref={fileInputRef} className="resume-file-input" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={handleFileChange} />
                <span className="upload-icon">↑</span>
                <strong>{isExtracting ? "Reading your resume..." : "Drag and drop your resume here"}</strong>
                <p>PDF, DOCX, or TXT · up to 5 MB</p>
                <span className="upload-file-button">Upload from computer</span>
              </div>
              {resumeFileName && <div className="uploaded-file-chip"><span><strong>{resumeFileName}</strong><small>Text extracted successfully</small></span><button type="button" onClick={() => { setResume(""); setResumeFileName(""); setReviewResult(null); setIsReviewStale(false); setCoverResult(null); setResumeStatus(""); }}>Remove</button></div>}
              <div className="paste-divider"><span>or paste and edit</span></div>
              <label className="field"><span>Resume text</span><textarea className="resume-textarea" value={resume} maxLength={14000} onChange={(event) => { setResume(event.target.value); setResumeFileName(""); setIsReviewStale(Boolean(reviewResult)); setCoverResult(null); }} placeholder="Paste the complete text of your resume here." /></label>
              <p className="privacy-note">The original file is not stored. Extracted text autosaves only in this browser and is sent to AI when you run a tool.</p>
              {!toolsReady && <p className="requirement-hint">Add a target job and at least 120 characters of resume text to enable AI tools.</p>}
              <button className="primary-button review-resume-button" type="button" disabled={!toolsReady || isReviewing || isExtracting || reviewRetrySeconds > 0} onClick={() => runTool("review")}>{isReviewing ? "Reviewing resume..." : reviewRetrySeconds > 0 ? `Try again in ${reviewRetrySeconds}s` : reviewResult ? "Regenerate review + targeted changes" : "Review resume + targeted changes"}</button>
              <label className="review-format-option"><input type="checkbox" checked={boldImportantPhrases} onChange={(event) => setBoldImportantPhrases(event.target.checked)} /><span><strong>Bold important keywords and phrases</strong><small>Formats emphasized terms in recommended examples and preserves bold styling when supported by the destination.</small></span></label>
              {resumeStatus && <p className="studio-status" role="status">{resumeStatus}</p>}
            </article>

            <article className="panel studio-panel resume-result-panel">
              <div className="panel-header"><div><p className="section-label">AI resume coach</p><h2>{reviewResult?.headline || "Review and recommendations"}</h2></div><div className="review-score-stack">{isReviewStale && <span className="review-stale-badge">Needs refresh</span>}{reviewResult?.score && <span className="resume-score">{reviewResult.score}%<small>fit</small></span>}</div></div>
              {isReviewStale && <p className="review-stale-notice" role="status">The resume or Candidate Profile changed. Regenerate the review to calculate an updated score against the same criteria.</p>}
              {!reviewResult ? <EmptyResult text="Upload or paste your resume, add the target job, and run the review to see strengths, gaps, ATS keywords, and exact changes." /> : <ReviewResultView result={reviewResult} />}
            </article>
          </div>

          <div className="cover-letter-column">
            <article className="panel studio-panel cover-letter-action-panel">
              <div className="panel-header"><div><p className="section-label">Cover letter generator</p><h2>Create your tailored letter</h2></div></div>
              <label className="field"><span>Tone</span><select value={coverTone} onChange={(event) => setCoverTone(event.target.value as CoverTone)}><option value="standard">Professional</option><option value="concise">Concise</option><option value="conversational">Conversational</option></select></label>
              <button className="primary-button" type="button" disabled={!toolsReady || isGeneratingCover || isExtracting || coverRetrySeconds > 0} onClick={() => runTool("cover-letter")}>{isGeneratingCover ? "Writing cover letter..." : coverRetrySeconds > 0 ? `Try again in ${coverRetrySeconds}s` : coverResult ? "Generate another version" : "Generate tailored cover letter"}</button>
              {coverStatus && <p className="studio-status" role="status">{coverStatus}</p>}
            </article>

            <article className="panel studio-panel resume-result-panel cover-result-panel">
              <div className="panel-header"><div><p className="section-label">AI cover letter</p><h2>{coverResult?.headline || "Your tailored letter"}</h2></div></div>
              {!coverResult ? <EmptyResult text="The letter will use only facts from your resume and Candidate Profile, then align them with this job posting." /> : <CoverLetterView result={coverResult} onDownload={downloadCover} />}
              {!!coverVersions.length && <section className="cover-version-list"><h3>Saved versions</h3>{coverVersions.map((version, index) => <button className={version.result === coverResult ? "active" : ""} type="button" key={version.id} onClick={() => { setCoverResult(version.result); setCoverTone(version.tone); }}><span>Version {coverVersions.length - index} · {formatTone(version.tone)}{version.result.isDraft ? " · Draft" : ""}</span><small>{formatMemoryDate(version.createdAt)}</small></button>)}</section>}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function ReviewResultView({ result }: { result: ResumeResult }) {
  const allChanges = result.changes?.map((change) => `${formatOperation(change.operation)} — ${change.section}\nWhere: ${change.placement}\nChange: ${change.suggestion}\nExample: ${change.example}`).join("\n\n") || "";
  return <div className="resume-result-content">
    {result.summary && <p className="result-summary">{result.summary}</p>}
    {result.score && result.projectedScore && <section className="score-path-card"><div><span>Current fit</span><strong>{result.score}%</strong>{typeof result.scoreDelta === "number" && <small className={result.scoreDelta > 0 ? "score-delta positive" : result.scoreDelta < 0 ? "score-delta negative" : "score-delta"}>{formatScoreDelta(result.scoreDelta)} since last review</small>}</div><span className="score-path-arrow">→</span><div><span>Potential fit</span><strong>{result.projectedScore}%</strong></div><p>The current score is calculated from locked criteria for this application. Potential fit assumes every safe rewrite is applied and every requested detail is verified; it remains an estimate, not an ATS guarantee.</p></section>}
    {!!result.scoreBreakdown?.length && <section className="score-breakdown"><div><p className="section-label">Scoring rubric</p><h3>Where the points come from</h3></div>{result.scoreBreakdown.map((item) => { const delta = typeof item.previousScore === "number" ? item.score - item.previousScore : null; return <article key={item.category}><div><strong>{item.category}</strong><span>{item.score}/{item.maxScore}{delta !== null && delta !== 0 ? ` (${formatScoreDelta(delta)})` : ""}</span></div><p>{item.evidence}</p>{item.improvement && <small><strong>Best improvement:</strong> {item.improvement}</small>}</article>; })}</section>}
    <KeywordList items={result.atsKeywords} />
    <div className="result-two-column"><ResultList title="What already works" items={result.strengths} /><ResultList title="Gaps to address" items={result.gaps} /></div>
    <ResultList title="Highest-impact next steps" items={result.nextSteps} />
    {!!result.changes?.length && <section className="targeted-changes-section">
      <div className="result-section-header"><div><p className="section-label">Targeted changes</p><h3>Recommended resume edits</h3></div><CopyButton text={stripBoldMarkers(allChanges)} html={boldMarkdownToHtml(allChanges)} label="Copy all" copiedLabel="All copied" /></div>
      {result.changes.map((change, index) => <section className="resume-change-card" key={`${change.section}-${index}`}>
        <div className="change-card-header"><span>{change.priority ? `${capitalize(change.priority)} priority · ` : ""}{change.section}</span><span className={change.kind === "needs-info" ? "needs-info" : "safe-rewrite"}>{change.kind === "needs-info" ? "Needs your confirmation" : "Uses confirmed evidence"}</span></div>
        <div className="change-placement"><span>{formatOperation(change.operation)}</span><p><strong>Where:</strong> {change.placement || `In the ${change.section} section`}</p></div>
        {change.sourceEvidence && <p className="source-evidence"><strong>{change.operation === "replace" ? "Replace this text:" : change.operation === "move" ? "Move this text:" : "Confirmed evidence:"}</strong> “{change.sourceEvidence}”</p>}
        {change.scoreImpact && <p className="score-impact"><strong>Potential lift:</strong> up to +{change.scoreImpact} points</p>}
        {change.relatedRequirement && <p className="related-requirement"><strong>Targets:</strong> {change.relatedRequirement}</p>}
        {change.currentIssue && <p><strong>Issue:</strong> {change.currentIssue}</p>}<p><strong>Change:</strong> {change.suggestion}</p>
        {change.example && <div><strong>Example</strong><p><BoldText text={change.example} /></p><CopyButton text={stripBoldMarkers(change.example)} html={boldMarkdownToHtml(change.example)} label="Copy example" copiedLabel="Example copied" /></div>}
      </section>)}
    </section>}
  </div>;
}

function CoverLetterView({ result, onDownload }: { result: ResumeResult; onDownload: (format: "txt" | "docx") => void }) {
  const wordCount = result.coverLetter?.trim().split(/\s+/).filter(Boolean).length || 0;
  const actionableNotes = visibleCoverLetterNotes(result.notes);
  return <div className="resume-result-content">{result.isDraft && <div className="cover-draft-warning" role="alert"><strong>Draft preserved</strong><p>{result.warning || "This letter still needs to be adjusted to the 325-400 word target before sending."}</p></div>}<div className="result-actions"><span className="count-pill">{wordCount} words{result.isDraft ? " · draft" : ""}</span><CopyButton text={result.coverLetter || ""} label="Copy" copiedLabel="Letter copied" /><button className="small-action-button" type="button" onClick={() => onDownload("txt")}>Download TXT</button><button className="small-action-button" type="button" onClick={() => onDownload("docx")}>Download DOCX</button></div><div className="cover-letter-output">{result.coverLetter}</div>{actionableNotes.length ? <ResultList title="Before sending" items={actionableNotes} /> : null}</div>;
}

function EmptyResult({ text }: { text: string }) { return <div className="empty-state"><div className="empty-icon">AI</div><h3>Ready when you are</h3><p>{text}</p></div>; }
function ResultList({ title, items = [] }: { title: string; items?: string[] }) { return <section className="feedback-block"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>; }
function KeywordList({ items = [] }: { items?: string[] }) { return items.length ? <section className="keyword-section"><h3>ATS keywords to verify</h3><div className="analysis-chip-list">{items.map((item) => <span className="analysis-chip" key={item}>{item}</span>)}</div></section> : null; }
function stripBoldMarkers(value: string) { return value.replace(/\*\*/g, ""); }
function BoldText({ text }: { text: string }) { return <>{text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>)}</>; }
function boldMarkdownToHtml(value: string) {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => part.startsWith("**") && part.endsWith("**") ? `<strong>${escape(part.slice(2, -2))}</strong>` : escape(part)).join("").replace(/\n/g, "<br>");
}
function formatMemoryDate(value: number) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatRoleLevel(value: string) { return value === "internship" ? "Internship" : value === "entry" ? "Entry level" : value === "mid" ? "Mid level" : "Senior level"; }
function formatTone(value: CoverTone) { return value === "concise" ? "Concise" : value === "conversational" ? "Conversational" : "Professional"; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatScoreDelta(value: number) { return value > 0 ? `+${value}` : String(value); }
function visibleCoverLetterNotes(value: string[] = []) { return value.filter((item) => !/\bword count\b|\b\d+\s+words?\b|\bparagraph\s+\d+\b|\btarget(?:ed)?\s*(?:range)?\s*[:(-]?\s*\d+/i.test(item)); }
function formatOperation(value?: Change["operation"]) { return value === "replace" ? "Replace" : value === "move" ? "Move" : "Add"; }
function formatRelativeTime(value: number) { const seconds = Math.max(0, Math.round((Date.now() - value) / 1000)); return seconds < 10 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`; }
function safeFileName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cover-letter"; }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
