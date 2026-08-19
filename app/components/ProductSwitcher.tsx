import Link from "next/link";

export default function ProductSwitcher({ active }: { active: "interview" | "coding" | "resume" }) {
  return (
    <nav className="product-switcher" aria-label="InterviewIQ tools">
      <Link className={active === "interview" ? "active" : ""} href="/">Interview Prep</Link>
      <Link className={active === "coding" ? "active" : ""} href="/coding/">Coding Practice</Link>
      <Link className={active === "resume" ? "active" : ""} href="/resume/">Resume Studio</Link>
    </nav>
  );
}
