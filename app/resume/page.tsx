"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import ProductSwitcher from "../components/ProductSwitcher";
import JobUrlImporter, { ImportedJob } from "../components/JobUrlImporter";

type Change = { section: string; currentIssue: string; suggestion: string; example: string; relatedRequirement?: string; kind?: "rewrite" | "needs-info"; priority?: "high" | "medium" | "low"; scoreImpact?: number };
type ScoreBreakdown = { category: string; score: number; maxScore: number; evidence: string; improvement: string };
type ResumeResult = {
  action: "review" | "cover-letter";
  headline?: string;
  score?: number;
  projectedScore?: number;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  atsKeywords?: string[];
  nextSteps?: string[];
  scoreBreakdown?: ScoreBreakdown[];
  changes?: Change[];
  coverLetter?: string;
  notes?: string[];
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

const applicationStorageKey = "interviewiq-saved-applications-v1";
const maxSavedApplications = 24;

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
  const [coverResult, setCoverResult] = useState<ResumeResult | null>(null);
  const [coverTone, setCoverTone] = useState<CoverTone>("standard");
  const [coverVersions, setCoverVersions] = useState<CoverVersion[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [resumeStatus, setResumeStatus] = useState("");
  const [coverStatus, setCoverStatus] = useState("");
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = isDarkMode ? "dark" : "light"; }, [isDarkMode]);

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

  const applyImportedJob = (job: ImportedJob) => {
    setJobTitle(job.jobTitle);
    setCompany(job.company);
    setLevel(job.level);
    setJobDescription(job.jobDescription);
    setReviewResult(null);
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
    setReviewResult(null);
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

  const runTool = async (action: "review" | "cover-letter") => {
    if (!toolsReady) return;
    const setBusy = action === "review" ? setIsReviewing : setIsGeneratingCover;
    const setStatus = action === "review" ? setResumeStatus : setCoverStatus;
    setBusy(true);
    setStatus("");
    if (action === "review") setReviewResult(null);
    try {
      const response = await fetch("/api/resume-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resume, jobTitle, company, level, jobDescription, tone: coverTone }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "The resume coach could not complete this request.");
      if (action === "review") {
        setReviewResult(payload);
        setStatus("Your review and targeted changes are ready.");
      } else {
        setCoverResult(payload);
        setCoverVersions((current) => [{ id: crypto.randomUUID(), createdAt: Date.now(), tone: coverTone, result: payload }, ...current].slice(0, 10));
        setStatus("Your tailored cover letter is ready.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The resume coach could not complete this request.");
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (value: string, message: string) => {
    try { await navigator.clipboard.writeText(value); setResumeStatus(message); }
    catch { setResumeStatus("Clipboard access was blocked. Select the text to copy it."); }
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

  const copyCoverLetter = async () => {
    if (!coverResult?.coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverResult.coverLetter);
      setCoverStatus("Cover letter copied to your clipboard.");
    } catch {
      setCoverStatus("Clipboard access was blocked. Select the letter text to copy it.");
    }
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
                <label className="field"><span>Job title</span><input maxLength={100} value={jobTitle} onChange={(event) => { setJobTitle(event.target.value); setReviewResult(null); setCoverResult(null); }} /></label>
                <label className="field"><span>Company</span><input maxLength={100} value={company} onChange={(event) => { setCompany(event.target.value); setReviewResult(null); setCoverResult(null); }} /></label>
                <label className="field"><span>Role level</span><select value={level} onChange={(event) => { setLevel(event.target.value); setReviewResult(null); setCoverResult(null); }}><option value="internship">Internship</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior level</option></select></label>
              </div>
              <label className="field"><span>Job description</span><textarea className="job-description-textarea" value={jobDescription} maxLength={6000} onChange={(event) => { setJobDescription(event.target.value); setReviewResult(null); setCoverResult(null); }} placeholder="Import a posting URL or paste the complete job description here." /></label>
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
              {resumeFileName && <div className="uploaded-file-chip"><span><strong>{resumeFileName}</strong><small>Text extracted successfully</small></span><button type="button" onClick={() => { setResume(""); setResumeFileName(""); setReviewResult(null); setCoverResult(null); setResumeStatus(""); }}>Remove</button></div>}
              <div className="paste-divider"><span>or paste and edit</span></div>
              <label className="field"><span>Resume text</span><textarea className="resume-textarea" value={resume} maxLength={14000} onChange={(event) => { setResume(event.target.value); setResumeFileName(""); setReviewResult(null); setCoverResult(null); }} placeholder="Paste the complete text of your resume here." /></label>
              <p className="privacy-note">The original file is not stored. Extracted text autosaves only in this browser and is sent to AI when you run a tool.</p>
              {!toolsReady && <p className="requirement-hint">Add a target job and at least 120 characters of resume text to enable AI tools.</p>}
              <button className="primary-button review-resume-button" type="button" disabled={!toolsReady || isReviewing || isExtracting} onClick={() => runTool("review")}>{isReviewing ? "Reviewing resume..." : reviewResult ? "Regenerate review + targeted changes" : "Review resume + targeted changes"}</button>
              {resumeStatus && <p className="studio-status" role="status">{resumeStatus}</p>}
            </article>

            <article className="panel studio-panel resume-result-panel">
              <div className="panel-header"><div><p className="section-label">AI resume coach</p><h2>{reviewResult?.headline || "Review and recommendations"}</h2></div>{reviewResult?.score && <span className="resume-score">{reviewResult.score}%<small>fit</small></span>}</div>
              {!reviewResult ? <EmptyResult text="Upload or paste your resume, add the target job, and run the review to see strengths, gaps, ATS keywords, and exact changes." /> : <ReviewResultView result={reviewResult} onCopy={(value, message) => copyText(value, message)} />}
            </article>
          </div>

          <div className="cover-letter-column">
            <article className="panel studio-panel cover-letter-action-panel">
              <div className="panel-header"><div><p className="section-label">Cover letter generator</p><h2>Create your tailored letter</h2></div></div>
              <label className="field"><span>Tone</span><select value={coverTone} onChange={(event) => setCoverTone(event.target.value as CoverTone)}><option value="standard">Professional</option><option value="concise">Concise</option><option value="conversational">Conversational</option></select></label>
              <button className="primary-button" type="button" disabled={!toolsReady || isGeneratingCover || isExtracting} onClick={() => runTool("cover-letter")}>{isGeneratingCover ? "Writing cover letter..." : coverResult ? "Generate another version" : "Generate tailored cover letter"}</button>
              {coverStatus && <p className="studio-status" role="status">{coverStatus}</p>}
            </article>

            <article className="panel studio-panel resume-result-panel cover-result-panel">
              <div className="panel-header"><div><p className="section-label">AI cover letter</p><h2>{coverResult?.headline || "Your tailored letter"}</h2></div></div>
              {!coverResult ? <EmptyResult text="The letter will use only facts from your resume and align them with this job posting." /> : <CoverLetterView result={coverResult} onCopy={copyCoverLetter} onDownload={downloadCover} />}
              {!!coverVersions.length && <section className="cover-version-list"><h3>Saved versions</h3>{coverVersions.map((version, index) => <button className={version.result === coverResult ? "active" : ""} type="button" key={version.id} onClick={() => { setCoverResult(version.result); setCoverTone(version.tone); }}><span>Version {coverVersions.length - index} · {formatTone(version.tone)}</span><small>{formatMemoryDate(version.createdAt)}</small></button>)}</section>}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function ReviewResultView({ result, onCopy }: { result: ResumeResult; onCopy: (value: string, message: string) => void }) {
  return <div className="resume-result-content">
    {result.summary && <p className="result-summary">{result.summary}</p>}
    {result.score && result.projectedScore && <section className="score-path-card"><div><span>Current fit</span><strong>{result.score}%</strong></div><span className="score-path-arrow">→</span><div><span>Potential fit</span><strong>{result.projectedScore}%</strong></div><p>Potential fit assumes every safe rewrite is applied and every requested detail is verified. It is an estimate, not an ATS guarantee.</p></section>}
    {!!result.scoreBreakdown?.length && <section className="score-breakdown"><div><p className="section-label">Scoring rubric</p><h3>Where the points come from</h3></div>{result.scoreBreakdown.map((item) => <article key={item.category}><div><strong>{item.category}</strong><span>{item.score}/{item.maxScore}</span></div><p>{item.evidence}</p>{item.improvement && <small><strong>Best improvement:</strong> {item.improvement}</small>}</article>)}</section>}
    <KeywordList items={result.atsKeywords} />
    <div className="result-two-column"><ResultList title="What already works" items={result.strengths} /><ResultList title="Gaps to address" items={result.gaps} /></div>
    <ResultList title="Highest-impact next steps" items={result.nextSteps} />
    {!!result.changes?.length && <section className="targeted-changes-section"><div className="result-section-header"><div><p className="section-label">Targeted changes</p><h3>Recommended resume edits</h3></div><button className="small-action-button" type="button" onClick={() => onCopy(result.changes!.map((change) => `${change.section}: ${change.suggestion}\nExample: ${change.example}`).join("\n\n"), "All targeted changes copied.")}>Copy all</button></div>{result.changes.map((change, index) => <section className="resume-change-card" key={`${change.section}-${index}`}><div className="change-card-header"><span>{change.priority ? `${capitalize(change.priority)} priority · ` : ""}{change.section}</span><span className={change.kind === "needs-info" ? "needs-info" : "safe-rewrite"}>{change.kind === "needs-info" ? "Needs your input" : "Safe rewrite"}</span></div>{change.scoreImpact && <p className="score-impact"><strong>Potential lift:</strong> up to +{change.scoreImpact} points</p>}{change.relatedRequirement && <p className="related-requirement"><strong>Targets:</strong> {change.relatedRequirement}</p>}{change.currentIssue && <p><strong>Issue:</strong> {change.currentIssue}</p>}<p><strong>Change:</strong> {change.suggestion}</p>{change.example && <div><strong>Example</strong><p>{change.example}</p><button className="small-action-button" type="button" onClick={() => onCopy(change.example, `${change.section} example copied.`)}>Copy example</button></div>}</section>)}</section>}
  </div>;
}

function CoverLetterView({ result, onCopy, onDownload }: { result: ResumeResult; onCopy: () => void; onDownload: (format: "txt" | "docx") => void }) {
  const wordCount = result.coverLetter?.trim().split(/\s+/).filter(Boolean).length || 0;
  return <div className="resume-result-content"><div className="result-actions"><span className="count-pill">{wordCount} words</span><button className="small-action-button" type="button" onClick={onCopy}>Copy</button><button className="small-action-button" type="button" onClick={() => onDownload("txt")}>Download TXT</button><button className="small-action-button" type="button" onClick={() => onDownload("docx")}>Download DOCX</button></div><div className="cover-letter-output">{result.coverLetter}</div>{result.notes?.length ? <ResultList title="Before sending" items={result.notes} /> : null}</div>;
}

function EmptyResult({ text }: { text: string }) { return <div className="empty-state"><div className="empty-icon">AI</div><h3>Ready when you are</h3><p>{text}</p></div>; }
function ResultList({ title, items = [] }: { title: string; items?: string[] }) { return <section className="feedback-block"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>; }
function KeywordList({ items = [] }: { items?: string[] }) { return items.length ? <section className="keyword-section"><h3>ATS keywords to verify</h3><div className="analysis-chip-list">{items.map((item) => <span className="analysis-chip" key={item}>{item}</span>)}</div></section> : null; }
function formatMemoryDate(value: number) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function formatRoleLevel(value: string) { return value === "internship" ? "Internship" : value === "entry" ? "Entry level" : value === "mid" ? "Mid level" : "Senior level"; }
function formatTone(value: CoverTone) { return value === "concise" ? "Concise" : value === "conversational" ? "Conversational" : "Professional"; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatRelativeTime(value: number) { const seconds = Math.max(0, Math.round((Date.now() - value) / 1000)); return seconds < 10 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`; }
function safeFileName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cover-letter"; }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
