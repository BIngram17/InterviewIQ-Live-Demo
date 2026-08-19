import { expect, test } from "@playwright/test";

const resumeText = "Jordan Lee Software Developer. Built accessible React applications and Node.js APIs. Improved release reliability through automated tests and GitHub Actions. Collaborated with product teams to deliver customer-facing features.";
const jobDescription = "Build accessible React applications and reliable Node.js services. Write automated tests, collaborate across product teams, and improve continuous delivery workflows.";

test("main sidebar keeps all three product destinations visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const sidebar = page.locator(".sidebar");
  const resumeLink = sidebar.getByRole("link", { name: "Resume Studio" });
  await expect(resumeLink).toBeVisible();
  const [sidebarBox, resumeBox] = await Promise.all([sidebar.boundingBox(), resumeLink.boundingBox()]);
  expect(sidebarBox).not.toBeNull();
  expect(resumeBox).not.toBeNull();
  expect(resumeBox!.x + resumeBox!.width).toBeLessThanOrEqual(sidebarBox!.x + sidebarBox!.width);
});

test("Resume Studio completes and remembers a tailored application", async ({ page }) => {
  await page.route("**/api/job-import", (route) => route.fulfill({ json: { jobTitle: "Software Developer", company: "Northstar", level: "entry", jobDescription, sourceUrl: "https://example.com/job" } }));
  await page.route("**/api/resume-extract", (route) => route.fulfill({ json: { resumeText, fileName: "resume.txt" } }));
  await page.route("**/api/resume-tools", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ json: body.action === "review" ? {
      action: "review", headline: "Strong foundation", score: 84, projectedScore: 93, summary: "Good role alignment.", strengths: ["React delivery"], gaps: ["Add testing detail"], atsKeywords: ["React", "Node.js"], nextSteps: ["Quantify impact"],
      scoreBreakdown: [{ category: "Required qualifications", score: 25, maxScore: 30, evidence: "React and Node.js are present.", improvement: "Add testing evidence." }],
      changes: [{ section: "Experience", currentIssue: "Impact is unclear", suggestion: "Add a verified outcome", example: "Improved release reliability by [verified percentage].", relatedRequirement: "improve continuous delivery workflows", kind: "needs-info", priority: "high", scoreImpact: 5 }]
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
  await expect(page.getByText("Needs your confirmation")).toBeVisible();
  await expect(page.getByText("Potential fit", { exact: true })).toBeVisible();
  await expect(page.getByText("93%")).toBeVisible();
  await expect(page.getByText("Potential lift:")).toBeVisible();
  await expect(page.getByText(/improve continuous delivery/)).toBeVisible();
  await page.getByLabel("Tone").selectOption("concise");
  await page.getByRole("button", { name: /Generate tailored cover letter/ }).click();
  await expect(page.getByText("Saved versions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download DOCX" })).toBeVisible();
  await expect(page.getByText(/Saved in this browser/)).toBeVisible({ timeout: 3000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.UPDATE_README_SCREENSHOT === "1") {
    await page.screenshot({ path: "public/resume-studio.png", fullPage: true });
  }
});

test("mobile layout prioritizes the target job and collapses saved applications", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resume/");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.getByRole("button", { name: "Dark" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "InterviewIQ tools" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved applications" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View saved" })).toBeVisible();
  await expect(page.locator(".application-memory-list")).toHaveCount(0);
  const jobUrl = page.getByLabel("Job posting URL");
  await jobUrl.fill("https://example.com/jobs/software-developer");
  await page.getByRole("button", { name: "Start new" }).click();
  await expect(jobUrl).toHaveValue("");
});

test("Coding Practice gates progression on passing tests and unlocks support after three failures", async ({ page }) => {
  await page.route("**/api/coding-challenge", (route) => route.fulfill({ json: {
    title: "Count unique tags",
    goal: "Practice using a set while preserving a clear input contract.",
    prompt: "Return the number of unique strings in the input array.",
    examples: ['["api", "ui", "api"] returns 2'],
    constraints: ["The input is an array of strings.", "The input may be empty."],
    concepts: ["sets", "iteration"],
    inputType: "string-array",
    outputType: "integer",
    tests: [
      { input: ["api", "ui", "api"], expected: 2 },
      { input: [], expected: 0 },
      { input: ["api"], expected: 1 },
    ],
    language: "javascript",
    difficulty: "intermediate",
    topic: "maps-sets",
  } }));
  await page.route("**/api/coding-coach", (route) => route.fulfill({ json: {
    assessment: "The function always returns zero, so every non-empty case fails.",
    whatWorks: ["The required solution function is present."],
    nextActions: ["Create a Set from the input and return its size."],
    hint: "Which JavaScript collection keeps only unique values?",
  } }));
  await page.route("**/api/code-feedback", (route) => route.fulfill({ json: {
    score: 9,
    verdict: "Correct, concise, and appropriate for the constraints.",
    strengths: ["Uses the right data structure."],
    improvements: ["Explain the expected set-operation cost."],
    complexity: "O(n) expected time and O(n) space.",
    suggestedCode: "function solution(input) { return new Set(input).size; }",
  } }));

  await page.goto("/coding/");
  await expect(page.getByRole("navigation", { name: "InterviewIQ tools" })).toContainText("Coding Practice");
  await expect(page.getByLabel("Language").locator("option")).toHaveText(["JavaScript", "Python", "Java", "C#", "Rust"]);
  await page.getByLabel("Topic").selectOption("maps-sets");
  await page.getByRole("button", { name: "Generate guided challenge" }).click();
  await expect(page.getByRole("heading", { name: "Count unique tags", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: /Approach/ }).click();
  await expect(page.getByRole("heading", { name: "Choose an approach" })).toBeVisible();
  await page.getByLabel("Your work").fill("I will compare a nested-loop approach with a set, then use the set for linear expected time.");
  await expect(page.getByText("13% complete")).toBeVisible();
  await page.getByRole("button", { name: "Copy challenge" }).click();
  await expect(page.getByRole("button", { name: /Challenge copied/ })).toBeVisible();
  await page.getByRole("button", { name: /Code/ }).click();
  await expect(page.getByRole("button", { name: /Testing/ })).toBeDisabled();
  const editor = page.getByLabel("JavaScript solution");
  await editor.fill("function solution(input) {\n  return new Set(input).size;\n}");
  await editor.press("End");
  await editor.press("Enter");
  await editor.press("Tab");
  await expect(editor).toHaveValue(/\n  $/);
  await editor.fill("function solution(input) { return 0; }");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.getByRole("button", { name: "Run 3 tests" }).click();
    if (attempt < 3) await expect(page.getByText(`Unsuccessful runs: ${attempt} of 3`, { exact: false })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Support unlocked after three unsuccessful runs" })).toBeVisible();
  await page.getByRole("button", { name: "Get AI debugging support" }).click();
  await expect(page.getByText("Which JavaScript collection keeps only unique values?")).toBeVisible();
  await editor.fill("function solution(input) { return new Set(input).size; }");
  await page.getByRole("button", { name: "Run 3 tests" }).click();
  await expect(page.getByRole("heading", { name: "All tests passed—next step unlocked" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Testing/ })).toBeEnabled();
  await page.getByRole("button", { name: /Review/ }).click();
  await page.getByRole("button", { name: "Get final AI review" }).click();
  await expect(page.getByText("Correct, concise, and appropriate for the constraints.")).toBeVisible();
  await expect(page.getByText("1 saved", { exact: true })).toBeVisible({ timeout: 3000 });
  await page.getByRole("button", { name: "Start new" }).click();
  await expect(page.getByText("1 saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open challenge" }).click();
  await expect(page.getByRole("heading", { name: "Count unique tags", level: 2 })).toBeVisible();
  await expect(page.getByText("Correct, concise, and appropriate for the constraints.")).toBeVisible();
});
