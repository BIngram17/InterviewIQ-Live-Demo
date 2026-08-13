"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import JobUrlImporter, { ImportedJob } from "../components/JobUrlImporter";

type Change = { section: string; currentIssue: string; suggestion: string; example: string };
type ResumeResult = {
  action: "review" | "cover-letter";
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
  const [isReviewing, setIsReviewing] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [resumeStatus, setResumeStatus] = useState("");
  const [coverStatus, setCoverStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = isDarkMode ? "dark" : "light"; }, [isDarkMode]);

  const applyImportedJob = (job: ImportedJob) => {
    setJobTitle(job.jobTitle);
    setCompany(job.company);
    setLevel(job.level);
    setJobDescription(job.jobDescription);
    setReviewResult(null);
    setCoverResult(null);
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

  const runTool = async (action: "review" | "cover-letter") => {
    const setBusy = action === "review" ? setIsReviewing : setIsGeneratingCover;
    const setStatus = action === "review" ? setResumeStatus : setCoverStatus;
    setBusy(true);
    setStatus("");
    if (action === "review") setReviewResult(null); else setCoverResult(null);
    try {
      const response = await fetch("/api/resume-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resume, jobTitle, company, level, jobDescription }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "The resume coach could not complete this request.");
      if (action === "review") {
        setReviewResult(payload);
        setStatus("Your review and targeted changes are ready.");
      } else {
        setCoverResult(payload);
        setStatus("Your tailored cover letter is ready.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The resume coach could not complete this request.");
    } finally {
      setBusy(false);
    }
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
          <Link className="ghost-button studio-home-link" href="/">← Interview coach</Link>
          <button className="theme-toggle studio-theme" type="button" onClick={() => setIsDarkMode((value) => !value)}>{isDarkMode ? "☀ Light" : "☾ Dark"}</button>
        </div>
      </header>

      <main className="studio-shell">
        <section className="studio-hero">
          <div><p className="eyebrow">AI application toolkit</p><h1>Build a stronger application in one workspace.</h1><p>Upload your resume for a complete review and targeted changes, then tailor a cover letter to the same job posting.</p></div>
          <div className="studio-feature-grid" aria-label="Resume Studio capabilities"><span>PDF, DOCX & TXT</span><span>Review + targeted edits</span><span>Tailored cover letters</span></div>
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
              <p className="privacy-note">Your file is converted to text for this request and is not permanently stored.</p>
              <button className="primary-button review-resume-button" type="button" disabled={isReviewing || isExtracting} onClick={() => runTool("review")}>{isReviewing ? "Reviewing resume..." : "Review resume + targeted changes"}</button>
              {resumeStatus && <p className="studio-status" role="status">{resumeStatus}</p>}
            </article>

            <article className="panel studio-panel resume-result-panel">
              <div className="panel-header"><div><p className="section-label">AI resume coach</p><h2>{reviewResult?.headline || "Review and recommendations"}</h2></div>{reviewResult?.score && <span className="resume-score">{reviewResult.score}%<small>fit</small></span>}</div>
              {!reviewResult ? <EmptyResult text="Upload or paste your resume, add the target job, and run the review to see strengths, gaps, ATS keywords, and exact changes." /> : <ReviewResultView result={reviewResult} />}
            </article>
          </div>

          <div className="cover-letter-column">
            <article className="panel studio-panel job-cover-panel">
              <div className="panel-header"><div><p className="section-label">Cover letter generator</p><h2>Add the target job</h2></div></div>
              <JobUrlImporter onImported={applyImportedJob} compact />
              <div className="field-row studio-field-row">
                <label className="field"><span>Job title</span><input maxLength={100} value={jobTitle} onChange={(event) => { setJobTitle(event.target.value); setReviewResult(null); setCoverResult(null); }} /></label>
                <label className="field"><span>Company</span><input maxLength={100} value={company} onChange={(event) => { setCompany(event.target.value); setReviewResult(null); setCoverResult(null); }} /></label>
              </div>
              <label className="field"><span>Role level</span><select value={level} onChange={(event) => { setLevel(event.target.value); setReviewResult(null); setCoverResult(null); }}><option value="internship">Internship</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior level</option></select></label>
              <label className="field"><span>Job description</span><textarea className="job-description-textarea" value={jobDescription} maxLength={6000} onChange={(event) => { setJobDescription(event.target.value); setReviewResult(null); setCoverResult(null); }} placeholder="Import a posting URL or paste the complete job description here." /></label>
              <button className="primary-button" type="button" disabled={isGeneratingCover || isExtracting} onClick={() => runTool("cover-letter")}>{isGeneratingCover ? "Writing cover letter..." : "Generate tailored cover letter"}</button>
              {coverStatus && <p className="studio-status" role="status">{coverStatus}</p>}
            </article>

            <article className="panel studio-panel resume-result-panel cover-result-panel">
              <div className="panel-header"><div><p className="section-label">AI cover letter</p><h2>{coverResult?.headline || "Your tailored letter"}</h2></div></div>
              {!coverResult ? <EmptyResult text="The letter will use only facts from your resume and align them with this job posting." /> : <CoverLetterView result={coverResult} onCopy={copyCoverLetter} />}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function ReviewResultView({ result }: { result: ResumeResult }) {
  return <div className="resume-result-content">
    {result.summary && <p className="result-summary">{result.summary}</p>}
    <KeywordList items={result.atsKeywords} />
    <div className="result-two-column"><ResultList title="What already works" items={result.strengths} /><ResultList title="Gaps to address" items={result.gaps} /></div>
    <ResultList title="Highest-impact next steps" items={result.nextSteps} />
    {!!result.changes?.length && <section className="targeted-changes-section"><div><p className="section-label">Targeted changes</p><h3>Recommended resume edits</h3></div>{result.changes.map((change, index) => <section className="resume-change-card" key={`${change.section}-${index}`}><span>{change.section}</span>{change.currentIssue && <p><strong>Issue:</strong> {change.currentIssue}</p>}<p><strong>Change:</strong> {change.suggestion}</p>{change.example && <div><strong>Example</strong><p>{change.example}</p></div>}</section>)}</section>}
  </div>;
}

function CoverLetterView({ result, onCopy }: { result: ResumeResult; onCopy: () => void }) {
  return <div className="resume-result-content"><button className="small-action-button result-copy-button" type="button" onClick={onCopy}>Copy cover letter</button><div className="cover-letter-output">{result.coverLetter}</div>{result.notes?.length ? <ResultList title="Before sending" items={result.notes} /> : null}</div>;
}

function EmptyResult({ text }: { text: string }) { return <div className="empty-state"><div className="empty-icon">AI</div><h3>Ready when you are</h3><p>{text}</p></div>; }
function ResultList({ title, items = [] }: { title: string; items?: string[] }) { return <section className="feedback-block"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>; }
function KeywordList({ items = [] }: { items?: string[] }) { return items.length ? <section className="keyword-section"><h3>ATS keywords to verify</h3><div className="analysis-chip-list">{items.map((item) => <span className="analysis-chip" key={item}>{item}</span>)}</div></section> : null; }
