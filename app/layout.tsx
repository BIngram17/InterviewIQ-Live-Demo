import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wonderful-ocean-0c82eb910.7.azurestaticapps.net"),
  title: "InterviewIQ - AI Career Preparation",
  description:
    "Prepare for interviews, learn coding problem solving in five languages, tailor resumes, and generate grounded cover letters with AI coaching.",
  openGraph: {
    title: "InterviewIQ - Practice smarter. Answer stronger.",
    description:
      "AI interview prep, guided coding practice, resume review, and cover-letter generation in one live product demo.",
    images: [
      {
        url: "/og-v2.png",
        width: 1734,
        height: 907,
        alt: "InterviewIQ dashboard and voice practice preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InterviewIQ - Practice smarter. Answer stronger.",
    description:
      "AI interview prep, guided coding practice, resume review, and cover-letter generation in one live product demo.",
    images: ["/og-v2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
