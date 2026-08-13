"use client";

import { useState } from "react";

export type ImportedJob = {
  jobTitle: string;
  company: string;
  level: "internship" | "entry" | "mid" | "senior";
  jobDescription: string;
  sourceUrl: string;
};

export default function JobUrlImporter({
  onImported,
  compact = false,
}: {
  onImported: (job: ImportedJob) => void;
  compact?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState("");

  const importJob = async () => {
    if (!url.trim()) {
      setStatus("Paste a public job-posting URL first.");
      return;
    }
    setIsImporting(true);
    setStatus("");
    try {
      const response = await fetch("/api/job-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "The posting could not be imported.");
      onImported(payload);
      setStatus("Job details imported. Review them before continuing.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The posting could not be imported.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className={`job-url-importer ${compact ? "compact-importer" : ""}`}>
      <div className="url-import-heading">
        <div>
          <strong>Import a job posting</strong>
          <span>Works with publicly accessible job pages.</span>
        </div>
        <span className="ai-import-badge">AI extract</span>
      </div>
      <div className="url-import-row">
        <label className="sr-only" htmlFor={compact ? "resume-job-url" : "interview-job-url"}>Job posting URL</label>
        <input
          id={compact ? "resume-job-url" : "interview-job-url"}
          type="url"
          inputMode="url"
          placeholder="https://company.com/jobs/software-engineer"
          value={url}
          maxLength={2000}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") importJob(); }}
        />
        <button className="import-button" type="button" onClick={importJob} disabled={isImporting}>
          {isImporting ? "Importing…" : "Import job"}
        </button>
      </div>
      {status && <p className="url-import-status" role="status">{status}</p>}
    </div>
  );
}
