import { expect, test } from "@playwright/test";

const resumeText = "Jordan Lee Software Developer. Built accessible React applications and Node.js APIs. Improved release reliability through automated tests and GitHub Actions. Collaborated with product teams to deliver customer-facing features.";
const jobDescription = "Build accessible React applications and reliable Node.js services. Write automated tests, collaborate across product teams, and improve continuous delivery workflows.";

test("main sidebar keeps all three product destinations visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const sidebar = page.locator(".sidebar");
  const resumeLink = sidebar.getByRole("link", { name: "Resume Studio" });
  const codingPracticeLink = sidebar.getByRole("link", { name: "Coding Practice" });
  await expect(resumeLink).toBeVisible();
  await expect(codingPracticeLink).toHaveText("Coding Practice");
  const codingLabelFits = await codingPracticeLink.evaluate((link) => link.scrollWidth <= link.clientWidth);
  expect(codingLabelFits).toBe(true);
  const [sidebarBox, resumeBox] = await Promise.all([sidebar.boundingBox(), resumeLink.boundingBox()]);
  expect(sidebarBox).not.toBeNull();
  expect(resumeBox).not.toBeNull();
  expect(resumeBox!.x + resumeBox!.width).toBeLessThanOrEqual(sidebarBox!.x + sidebarBox!.width);
  const heroActions = page.locator(".hero-actions");
  const codingCta = heroActions.getByRole("link", { name: "Open Coding Practice" });
  const resumeCta = heroActions.getByRole("link", { name: "Open Resume Studio" });
  await expect(codingCta).toBeVisible();
  await expect(resumeCta).toBeVisible();
  const [codingBox, resumeCtaBox] = await Promise.all([codingCta.boundingBox(), resumeCta.boundingBox()]);
  expect(codingBox!.x).toBeLessThan(resumeCtaBox!.x);
});

test("saved interview sessions are collapsed until requested", async ({ page }) => {
  const savedSession = {
    id: "saved-session-1",
    key: "software|entry|northstar",
    title: "Software Developer",
    company: "Northstar",
    level: "entry",
    interviewType: "mixed",
    jobDescription,
    questions: [],
    analysis: { summary: "Role summary", technical: [], soft: [], topics: [] },
    createdAt: "2026-08-19T12:00:00.000Z",
    updatedAt: "2026-08-19T12:00:00.000Z",
  };
  await page.addInitScript((session) => window.localStorage.setItem("interviewiq-saved-sessions-v1", JSON.stringify([session])), savedSession);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Show saved" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Software Developer", level: 3 })).toHaveCount(0);
  await toggle.click();
  await expect(page.getByRole("button", { name: "Hide saved" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Software Developer", level: 3 })).toBeVisible();
});

test("Resume Studio completes and remembers a tailored application", async ({ page }) => {
  let reviewCalls = 0;
  let receivedLockedReview = false;
  const evaluationCriteria = [
    ["Required qualifications", "Required React experience", "required"],
    ["Relevant experience and seniority", "Relevant software delivery", "quality"],
    ["Skills and ATS terminology", "Relevant technical terminology", "quality"],
    ["Quantified impact and evidence", "Evidence of measurable impact", "quality"],
    ["Clarity and ATS readability", "Clear ATS-readable structure", "quality"],
  ].map(([category, requirement, importance], index) => ({ id: `criterion-${index}`, category, requirement, importance, status: "met", projectedStatus: "met", evidence: "React applications", explanation: "Verified evidence" }));
  await page.route("**/api/job-import", (route) => route.fulfill({ json: { jobTitle: "Software Developer", company: "Northstar", level: "entry", jobDescription, sourceUrl: "https://example.com/job" } }));
  await page.route("**/api/resume-extract", (route) => route.fulfill({ json: { resumeText, fileName: "resume.txt" } }));
  await page.route("**/api/resume-tools", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "review") {
      reviewCalls += 1;
      receivedLockedReview = Boolean(body.previousReview?.evaluationCriteria?.length);
    }
    await route.fulfill({ json: body.action === "review" ? {
      action: "review", reviewFingerprint: "locked-target", headline: "Resume Review: Python and Kubernetes Software Engineer - Data, AI/ML & Analytics", score: reviewCalls === 1 ? 84 : 89, previousScore: reviewCalls === 1 ? undefined : 84, scoreDelta: reviewCalls === 1 ? undefined : 5, projectedScore: 93, summary: "Good role alignment.", strengths: ["React delivery"], gaps: ["Add testing detail"], atsKeywords: ["React", "Node.js"], nextSteps: ["Quantify impact"], evaluationCriteria,
      scoreBreakdown: [{ category: "Required qualifications", score: reviewCalls === 1 ? 25 : 28, previousScore: reviewCalls === 1 ? undefined : 25, maxScore: 30, evidence: "React and Node.js are present.", improvement: "Add testing evidence." }],
      changes: [{ section: "Experience", currentIssue: "Impact is unclear", suggestion: "Add a verified outcome", example: "Improved release reliability by [verified percentage].", relatedRequirement: "improve continuous delivery workflows", kind: "needs-info", priority: "high", scoreImpact: 5 }]
    } : { action: "cover-letter", headline: "Northstar cover letter", coverLetter: "Dear Hiring Team,\n\nI am excited to apply for the Software Developer role. My experience building React applications and Node.js APIs aligns with your needs.\n\nSincerely,\nJordan Lee", notes: ["Word count: 351 words (target: 350-375).", "Paragraph 1: 58 words.", "Verify the hiring manager name."] } });
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
  await page.getByLabel("Resume text").fill(`${resumeText} Reduced deployment failures by 20% through automated validation.`);
  await expect(page.getByText("Needs refresh")).toBeVisible();
  const scoreInsidePanel = await page.locator(".resume-result-panel:not(.cover-result-panel)").evaluate((panel) => {
    const score = panel.querySelector(".resume-score");
    if (!score) return false;
    const panelBox = panel.getBoundingClientRect();
    const scoreBox = score.getBoundingClientRect();
    return scoreBox.left >= panelBox.left && scoreBox.right <= panelBox.right;
  });
  expect(scoreInsidePanel).toBe(true);
  await page.getByRole("button", { name: /Regenerate review/ }).click();
  await expect(page.getByText("+5 since last review")).toBeVisible();
  expect(receivedLockedReview).toBe(true);
  await page.getByLabel("Tone").selectOption("concise");
  await page.getByRole("button", { name: /Generate tailored cover letter/ }).click();
  await expect(page.getByText("Saved versions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download DOCX" })).toBeVisible();
  await expect(page.getByText("Verify the hiring manager name.")).toBeVisible();
  await expect(page.getByText(/Paragraph 1:/)).toHaveCount(0);
  await expect(page.getByText(/target: 350-375/i)).toHaveCount(0);
  await expect(page.getByText(/Saved in this browser/)).toBeVisible({ timeout: 3000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.UPDATE_README_SCREENSHOT === "1") {
    await page.screenshot({ path: "public/resume-studio.png", fullPage: true });
  }
});

test("Resume Studio shows a retry countdown when the free AI quota is busy", async ({ page }) => {
  await page.route("**/api/resume-tools", (route) => route.fulfill({
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "4" },
    body: JSON.stringify({ error: "The free AI demo is busy. Try again in 4 seconds." }),
  }));

  await page.goto("/resume/");
  await page.getByLabel("Job title").fill("Software Developer");
  await page.getByLabel("Company").fill("Northstar");
  await page.getByLabel("Job description").fill(jobDescription);
  await page.getByRole("button", { name: "Use this target job" }).click();
  await page.getByLabel("Resume text").fill(resumeText);
  await page.getByRole("button", { name: "Generate tailored cover letter" }).click();

  await expect(page.getByText("The free AI demo is busy. Try again in 4 seconds.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Try again in [1-4]s/ })).toBeDisabled();
});

test("mobile layout prioritizes the target job and collapses saved applications", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resume/");
  const toolSwitcher = page.getByRole("navigation", { name: "InterviewIQ tools" });
  const resumeStudioLink = toolSwitcher.getByRole("link", { name: "Resume Studio" });
  const [switcherBox, resumeLinkBox] = await Promise.all([toolSwitcher.boundingBox(), resumeStudioLink.boundingBox()]);
  expect(switcherBox).not.toBeNull();
  expect(resumeLinkBox).not.toBeNull();
  expect(resumeLinkBox!.x + resumeLinkBox!.width).toBeLessThanOrEqual(switcherBox!.x + switcherBox!.width);
  expect(await resumeStudioLink.evaluate((link) => link.scrollWidth <= link.clientWidth)).toBe(true);
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

test("Resume Studio actions stay inside their panels in phone landscape", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/resume/");

  const savedPanel = page.locator(".application-memory-panel");
  const profilePanel = page.locator(".candidate-profile-panel");
  const startNew = savedPanel.getByRole("button", { name: "Start new" });
  const createProfile = profilePanel.getByRole("button", { name: "Create profile" });

  for (const [panel, action] of [[savedPanel, startNew], [profilePanel, createProfile]] as const) {
    const [panelBox, actionBox] = await Promise.all([panel.boundingBox(), action.boundingBox()]);
    expect(panelBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
    expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
  }

  await createProfile.click();
  await expect(profilePanel.getByRole("button", { name: "Hide profile" })).toBeVisible();
  const [profileBox, hideProfileBox] = await Promise.all([
    profilePanel.boundingBox(),
    profilePanel.getByRole("button", { name: "Hide profile" }).boundingBox(),
  ]);
  expect(hideProfileBox!.x + hideProfileBox!.width).toBeLessThanOrEqual(profileBox!.x + profileBox!.width);
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

test("Coding Practice migrates pre-runner saved challenges", async ({ page }) => {
  const legacyChallenge = {
    id: "legacy-python-challenge",
    savedAt: "2026-08-01T12:00:00.000Z",
    language: "python",
    difficulty: "beginner",
    topic: "maps-sets",
    roleContext: "",
    challenge: {
      title: "Count unique tags",
      goal: "Practice sets.",
      prompt: "Return the number of unique strings.",
      examples: ['["api", "ui", "api"] returns 2'],
      constraints: ["The input may be empty.", "Values are strings."],
      concepts: ["sets"],
      tests: [
        { input: ["api", "ui", "api"], expected: 2 },
        { input: [], expected: 0 },
        { input: ["api"], expected: 1 },
      ],
      language: "python",
      difficulty: "beginner",
      topic: "maps-sets",
    },
    activeStep: 4,
    notes: {},
    coachFeedback: {},
    code: "def solution(input):\n    return len(set(input))",
    testResults: [],
    finalReview: null,
    failedAttempts: 0,
  };
  await page.addInitScript((saved) => window.localStorage.setItem("interviewiq-coding-practice-history-v1", JSON.stringify([saved])), legacyChallenge);
  await page.route("**/api/code-runner", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.inputType).toBe("string-array");
    expect(body.outputType).toBe("integer");
    await route.fulfill({ json: { results: body.tests.map((item: { expected: unknown }) => ({ passed: true, expected: item.expected })), error: "" } });
  });

  await page.goto("/coding/");
  await page.getByRole("button", { name: "Open challenge" }).click();
  await expect(page.getByRole("heading", { name: "Count unique tags", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: /Code/ }).click();
  await page.getByRole("button", { name: "Run 3 tests" }).click();
  await expect(page.getByRole("heading", { name: "All tests passed—next step unlocked" })).toBeVisible();
});
