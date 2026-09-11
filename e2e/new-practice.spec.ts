import { test, expect } from "@playwright/test";

test("interview includes resume context, remembers it, and refuses sample substitution", async ({ page }) => {
  let body: Record<string, unknown> = {};
  let feedbackCalls = 0;
  await page.route("**/api/interview", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: {
      analysis: { summary: "Candidate interview", technical: ["Planning", "Delivery"], soft: ["Communication", "Teamwork"], topics: ["Experience"] },
      questions: Array.from({ length: 6 }, (_, i) => ({ category: "Experience", question: i === 0 ? "Tell me about yourself." : "Describe your project " + i, why: "Assess relevant experience." })),
    } });
  });
  await page.route("**/api/feedback", async (route) => { feedbackCalls++; await route.fulfill({ json: {} }); });
  await page.goto("/");
  await page.getByLabel("Your resume (optional)", { exact: true }).fill("Built a customer support training program and coached new team members.");
  await page.getByRole("button", { name: "Start interview prep", exact: true }).click();
  await expect(page.getByText("Tell me about yourself.", { exact: true }).first()).toBeVisible();
  expect(body.resume).toContain("customer support");
  expect(body.includeCommon).toBe(true);
  await page.getByPlaceholder("Type your response, or use Record answer for voice practice…").fill("Hi");
  await page.getByRole("button", { name: "Review answer with AI", exact: true }).click();
  expect(feedbackCalls).toBe(0);
  await expect(page.getByPlaceholder("Type your response, or use Record answer for voice practice…")).toHaveValue("Hi");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("interviewiq-saved-sessions-v1") || "[]")[0]?.resume)).toContain("customer support");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Your resume (optional)", { exact: true })).toHaveValue("");
});

test("debugging requires repairs, unlocks support, and preserves the original faulty code", async ({ page }) => {
  let mode = "";
  let reviewedCode = "";
  await page.route("**/api/code-feedback", async (route) => {
    reviewedCode = route.request().postDataJSON().code;
    await route.fulfill({ json: { score: 9, verdict: "The repair preserves the helper contract.", strengths: ["Correct output"], improvements: ["Add additional regression tests"], complexity: "Linear time." } });
  });
  const starter = "function measure(input) {\n  return input.length - 1;\n}";
  const files = [{ name: "measure.js", content: starter }, { name: "billing.js", content: "function count(input) { return measure(input); }" }, { name: "solution.js", content: "function solution(input) { return count(input); }" }];
  await page.route("**/api/coding-challenge", async (route) => {
    mode = route.request().postDataJSON().mode;
    await route.fulfill({ json: {
      title: "Repair the counter", goal: "Diagnose a boundary bug", prompt: "Return the length of an ASCII string.",
      examples: ['"abc" returns 3'], constraints: ["ASCII only", "Empty input allowed"], concepts: ["Boundaries"],
      inputType: "string", outputType: "integer", language: "javascript", difficulty: "beginner", topic: "arrays-strings",
      mode: "debug", files, bugReports: ["Customer reports show the wrong item count."], starterCode: files.map((f) => f.content).join("\n\n"), tests: [{ input: "", expected: 0 }, { input: "a", expected: 1 }, { input: "abc", expected: 3 }],
    } });
  });
  await page.goto("/coding/");
  await page.getByLabel("Practice mode").selectOption("debug");
  await page.getByRole("button", { name: "Generate guided challenge", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Repair the counter", exact: true })).toBeVisible();
  expect(mode).toBe("debug");
  await expect(page.locator(".learning-step-nav")).toHaveCount(0);
  await expect(page.getByText("Customer reports show the wrong item count.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Review my repairs/ })).toBeDisabled();
  const editor = page.getByRole("textbox", { name: "measure.js", exact: true });
  await expect(editor).toHaveValue(starter);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByRole("button", { name: "Run 3 tests", exact: true }).click();
    await expect(page.locator(".test-report strong")).toHaveText("0/3 tests passed");
    if (attempt < 3) await expect(page.locator(".attempt-counter")).toContainText("Unsuccessful runs: " + attempt);
  }
  await expect(page.getByRole("button", { name: "Get AI debugging support", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Review my repairs/ })).toBeDisabled();
  await editor.fill("function measure(input) { return input.length; }");
  await page.getByRole("button", { name: "billing.js", exact: false }).click();
  await expect(page.getByRole("textbox", { name: "billing.js", exact: true })).toHaveValue(files[1].content);
  await page.getByRole("button", { name: "Run 3 tests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All tests passed—next step unlocked" })).toBeVisible();
  await page.getByRole("button", { name: /Review my repairs/ }).click();
  await page.getByRole("button", { name: "Get final AI review", exact: true }).click();
  await expect(page.getByText("The repair preserves the helper contract.", { exact: true })).toBeVisible();
  expect(reviewedCode).toContain("function measure");
  expect(reviewedCode).toContain("function count");
  expect(reviewedCode).toContain("function solution");
  await page.getByRole("button", { name: "Back to files", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("interviewiq-coding-practice-v1") || "")).toContain("return input.length;");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "work/debug-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "work/debug-desktop.png", fullPage: true });
  await page.reload();
  await expect(page.getByLabel("Practice mode")).toHaveValue("debug");
  await page.getByRole("button", { name: "Reset code", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "measure.js", exact: true })).toHaveValue(starter);
});
test("unchanged debugging projects that already pass cannot unlock review", async ({ page }) => {
  const files = [{ name: "policy.js", content: "function amount(n) { return n; }" }, { name: "billing.js", content: "function total(n) { return amount(n); }" }, { name: "solution.js", content: "function solution(input) { return total(input); }" }];
  await page.route("**/api/coding-challenge", route => route.fulfill({ json: {
    title: "Checkout regression", goal: "Repair billing", prompt: "Return the correct total.", examples: ["1 returns 1"], constraints: ["Whole amounts", "Nonnegative"], concepts: [], language: "javascript", mode: "debug", files,
    bugReports: ["Customers report wrong totals."], starterCode: files.map(f => f.content).join("\n\n"), inputType: "integer", outputType: "integer", tests: [{ input: 0, expected: 0 }, { input: 1, expected: 1 }, { input: 2, expected: 2 }],
  } }));
  await page.goto("/coding/");
  await page.getByLabel("Practice mode").selectOption("debug");
  await page.getByRole("button", { name: "Generate guided challenge", exact: true }).click();
  await page.getByRole("button", { name: "Run 3 tests", exact: true }).click();
  await expect(page.locator(".runner-error-output")).toContainText("already passes every test without repairs");
  await expect(page.getByRole("button", { name: /Review my repairs/ })).toBeDisabled();
  await expect(page.locator(".attempt-counter")).toContainText("Unsuccessful runs: 0");
});
