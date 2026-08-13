import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume Studio | InterviewIQ",
  description: "Review your resume, get targeted suggestions, and generate a job-specific cover letter with live AI.",
};

export default function ResumeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
