import { expect, test } from "@playwright/test";

const resumeText = "Jordan Lee Software Developer. Built accessible React applications and Node.js APIs. Improved release reliability through automated tests and GitHub Actions. Collaborated with product teams to deliver customer-facing features.";
const jobDescription = "Build accessible React applications and reliable Node.js services. Write automated tests, collaborate across product teams, and improve continuous delivery workflows.";

test("Resume Studio completes and remembers a tailored application", async ({ page }) => {
  await page.route("**/api/job-import", (route) => route.fulfill({ json: { jobTitle: "Software Developer", company: "Northstar", level: "entry", jobDescription, sourceUrl: "https://example.com/job" } }));
  await page.route("**/api/resume-extract", (route) => route.fulfill({ json: { resumeText, fileName: "resume.txt" } }));
  await page.route("**/api/resume-tools", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ json: body.action === "review" ? {
      action: "review", headline: "Strong foundation", score: 84, summary: "Good role alignment.", strengths: ["React delivery"], gaps: ["Add testing detail"], atsKeywords: ["React", "Node.js"], nextSteps: ["Quantify impact"],
      changes: [{ section: "Experience", currentIssue: "Impact is unclear", suggestion: "Add a verified outcome", example: "Improved release reliability by [verified percentage].", relatedRequirement: "improve continuous delivery workflows", kind: "needs-info" }]
    } : { action: "cover-letter", headline: "Northstar cover letter", coverLetter: "Dear Hiring Team,\n\nI am excited to apply for the Software Developer role. My experience building React applications and Node.js APIs aligns with your needs.\n\nSincerely,\nJordan Lee", notes: ["Verify the hiring manager name."] } });
  });

  await page.goto("/resume/");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.getByRole("button", { name: "Dark" })).toBeVisible();
  await page.getByLabel("Job title").fill("Software Developer");
  await page.getByLabel("Company").fill("Northstar");
  await page.getByLabel("Job description").fill(jobDescription);
  await page.getByRole("button", { name: "Use this target job" }).click();
  await expect(page.getByRole("heading", { name: "Software Developer at Northstar" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from(resumeText) });
  await page.getByRole("button", { name: /Review resume/ }).click();
  await expect(page.getByText("Needs your input")).toBeVisible();
  await expect(page.getByText(/improve continuous delivery/)).toBeVisible();
  await page.getByLabel("Tone").selectOption("concise");
  await page.getByRole("button", { name: /Generate tailored cover letter/ }).click();
  await expect(page.getByText("Saved versions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download DOCX" })).toBeVisible();
  await expect(page.getByText(/Saved in this browser/)).toBeVisible({ timeout: 3000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "public/resume-studio.png", fullPage: true });
});

test("mobile layout prioritizes the target job and collapses saved applications", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resume/");
  await expect(page.getByRole("navigation", { name: "InterviewIQ tools" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved applications" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View saved" })).toBeVisible();
  await expect(page.locator(".application-memory-list")).toHaveCount(0);
});
