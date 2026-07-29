import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wonderful-ocean-0c82eb910.7.azurestaticapps.net"),
  title: "InterviewIQ - AI Interview Preparation",
  description:
    "Analyze a job description, generate tailored interview questions, practice by typing or voice, and get actionable AI coaching.",
  openGraph: {
    title: "InterviewIQ - Practice smarter. Answer stronger.",
    description:
      "A full-stack AI interview preparation product demo with voice practice.",
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
      "A full-stack AI interview preparation product demo with voice practice.",
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
