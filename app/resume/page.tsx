"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import JobUrlImporter, { ImportedJob } from "../components/JobUrlImporter";

type ResumeAction = "review" | "suggestions" | "cover-letter";
type Change = { section: string; currentIssue: string; suggestion: string; example: string };
type ResumeResult = {
  action: ResumeAction;
  headline?: string;
  score?: number;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  atsKeywords?: string[];
  nextSteps?: string[];
  changes?: Change[];
  coverLetter?: string;
  notes?: string[];
};

const actions: Array<{ id: ResumeAction; label: string; detail: string }> = [
  { id: "review", label: "Resume review", detail: "Get a role-fit score, strengths, gaps, and next steps." },
  { id: "suggestions", label: "Targeted changes", detail: "Receive section-by-section edits and truthful examples." },
  { id: "cover-letter", label: "Cover letter", detail: "Generate a tailored letter grounded only in your resume." },
];

export default function ResumeStudio() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [action, setAction] = useState<ResumeAction>("review");
  const [resume, setResume] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState("entry");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => { document.documentElement.dataset.theme = isDarkMode ? "dark" : "light"; }, [isDarkMode]);

  const applyImportedJob = (job: ImportedJob) => {
    setJobTitle(job.jobTitle);
    setCompany(job.company);
    setLevel(job.level);
    setJobDescription(job.jobDescription);
    setResult(null);
  };

  const runTool = async () => {
    setIsWorking(true);
    setStatus("");
    setResult(null);
    try {
      const response = await fetch("/api/resume-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resume, jobTitle, company, level, jobDescription }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "The resume coach could not complete this request.");
      setResult(payload);
      setStatus("Your AI resume coaching is ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The resume coach could not complete this request.");
    } finally {
      setIsWorking(false);
    }
  };

  const copyCoverLetter = async () => {
    if (!result?.coverLetter) return;
    try {
      await navigator.clipboard.writeText(result.coverLetter);
      setStatus("Cover letter copied to your clipboard.");
    } catch {
      setStatus("Clipboard access was blocked. Select the letter text to copy it.");
    }
  };

  return (
    <div className="studio-page">
      <header className="studio-topbar">
        <Link className="studio-brand" href="/">
          <span className="studio-logo">IQ</span>
          <span><strong>Interview<span>IQ</span></strong><small>Resume Studio</small></span>
        </Link>
        <div className="studio-top-actions">
          <Link className="ghost-button studio-home-link" href="/">← Interview coach</Link>
          <button className="theme-toggle studio-theme" type="button" onClick={() => setIsDarkMode((value) => !value)}>
            {isDarkMode ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>

      <main className="studio-shell">
        <section className="studio-hero">
          <div>
            <p className="eyebrow">AI application toolkit</p>
            <h1>Turn one resume into a stronger application.</h1>
            <p>Compare your resume with a real job posting, prioritize truthful improvements, and draft a tailored cover letter.</p>
          </div>
          <div className="studio-feature-grid" aria-label="Resume Studio capabilities">
            <span>ATS alignment</span><span>Targeted edits</span><span>Cover letters</span>
          </div>
        </section>

        <section className="studio-workspace">
          <div className="studio-input-column">
            <article className="panel studio-panel">
              <div className="panel-header"><div><p className="section-label">Target role</p><h2>Import the job posting</h2></div></div>
              <JobUrlImporter onImported={applyImportedJob} compact />
              <div className="field-row studio-field-row">
                <label className="field"><span>Job title</span><input maxLength={100} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></label>
                <label className="field"><span>Company</span><input maxLength={100} value={company} onChange={(e) => setCompany(e.target.value)} /></label>
              </div>
              <label className="field"><span>Role level</span><select value={level} onChange={(e) => setLevel(e.target.value)}><option value="internship">Internship</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior level</option></select></label>
              <label className="field"><span>Job description</span><textarea value={jobDescription} maxLength={6000} onChange={(e) => setJobDescription(e.target.value)} placeholder="Import a posting or paste the job description here." /></label>
            </article>

            <article className="panel studio-panel">
              <div className="panel-header"><div><p className="section-label">Your experience</p><h2>Paste your resume</h2></div><span className="count-pill">{resume.length.toLocaleString()} characters</span></div>
              <label className="field"><span>Resume text</span><textarea className="resume-textarea" value={resume} maxLength={14000} onChange={(e) => setResume(e.target.value)} placeholder="Paste the complete text of your resume. Formatting is not required." /></label>
              <p className="privacy-note">Your resume is sent only to the protected AI endpoint for this request and is not saved by InterviewIQ.</p>
            </article>
          </div>

          <div className="studio-output-column">
            <article className="panel studio-panel tool-picker-panel">
              <div className="panel-header"><div><p className="section-label">Choose an outcome</p><h2>What should the coach create?</h2></div></div>
              <div className="resume-tool-tabs">
                {actions.map((item) => <button key={item.id} className={action === item.id ? "active" : ""} type="button" onClick={() => { setAction(item.id); setResult(null); }}><strong>{item.label}</strong><span>{item.detail}</span></button>)}
              </div>
              <button className="primary-button" type="button" disabled={isWorking} onClick={runTool}>{isWorking ? "AI coach is working…" : actions.find((item) => item.id === action)?.label}</button>
              {status && <p className="studio-status" role="status">{status}</p>}
            </article>

            <article className="panel studio-panel resume-result-panel">
              <div className="panel-header"><div><p className="section-label">AI resume coach</p><h2>{result?.headline || "Your tailored result will appear here"}</h2></div>{result?.score && <span className="resume-score">{result.score}%<small>fit</small></span>}</div>
              {!result ? <div className="empty-state"><div className="empty-icon">AI</div><h3>Ready when you are</h3><p>Import a target role, paste your resume, and choose one of the three coaching tools.</p></div> : <ResumeResultView result={result} onCopyCoverLetter={copyCoverLetter} />}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function ResumeResultView({ result, onCopyCoverLetter }: { result: ResumeResult; onCopyCoverLetter: () => void }) {
  if (result.action === "cover-letter") return <div className="resume-result-content"><button className="small-action-button result-copy-button" type="button" onClick={onCopyCoverLetter}>Copy cover letter</button><div className="cover-letter-output">{result.coverLetter}</div>{result.notes?.length ? <ResultList title="Before sending" items={result.notes} /> : null}</div>;
  if (result.action === "suggestions") return <div className="resume-result-content">{result.summary && <p className="result-summary">{result.summary}</p>}<KeywordList items={result.atsKeywords} />{result.changes?.map((change, index) => <section className="resume-change-card" key={`${change.section}-${index}`}><span>{change.section}</span>{change.currentIssue && <p><strong>Issue:</strong> {change.currentIssue}</p>}<p><strong>Change:</strong> {change.suggestion}</p>{change.example && <div><strong>Example</strong><p>{change.example}</p></div>}</section>)}</div>;
  return <div className="resume-result-content">{result.summary && <p className="result-summary">{result.summary}</p>}<KeywordList items={result.atsKeywords} /><div className="result-two-column"><ResultList title="What already works" items={result.strengths} /><ResultList title="Gaps to address" items={result.gaps} /></div><ResultList title="Highest-impact next steps" items={result.nextSteps} /></div>;
}

function ResultList({ title, items = [] }: { title: string; items?: string[] }) { return <section className="feedback-block"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>; }
function KeywordList({ items = [] }: { items?: string[] }) { return items.length ? <section className="keyword-section"><h3>ATS keywords to verify</h3><div className="analysis-chip-list">{items.map((item) => <span className="analysis-chip" key={item}>{item}</span>)}</div></section> : null; }
