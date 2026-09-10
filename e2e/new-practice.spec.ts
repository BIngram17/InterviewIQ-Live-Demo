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
  const starter = "function solution(input) {\n  return input.length - 1;\n}";
  await page.route("**/api/coding-challenge", async (route) => {
    mode = route.request().postDataJSON().mode;
    await route.fulfill({ json: {
      title: "Repair the counter", goal: "Diagnose a boundary bug", prompt: "Return the length of an ASCII string.",
      examples: ['"abc" returns 3'], constraints: ["ASCII only", "Empty input allowed"], concepts: ["Boundaries"],
      inputType: "string", outputType: "integer", language: "javascript", difficulty: "beginner", topic: "arrays-strings",
      mode: "debug", starterCode: starter, tests: [{ input: "", expected: 0 }, { input: "a", expected: 1 }, { input: "abc", expected: 3 }],
    } });
  });
  await page.goto("/coding/");
  await page.getByLabel("Practice mode").selectOption("debug");
  await page.getByRole("button", { name: "Generate guided challenge", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Repair the counter", exact: true })).toBeVisible();
  expect(mode).toBe("debug");
  await page.locator(".learning-step-nav").getByRole("button", { name: /Code/ }).click();
  const editor = page.getByRole("textbox", { name: "JavaScript solution", exact: true });
  await expect(editor).toHaveValue(starter);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByRole("button", { name: "Run 3 tests", exact: true }).click();
    await expect(page.locator(".test-report strong")).toHaveText("0/3 tests passed");
    if (attempt < 3) await expect(page.locator(".attempt-counter")).toContainText("Unsuccessful runs: " + attempt);
  }
  await expect(page.getByRole("button", { name: "Get AI debugging support", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass tests to continue", exact: true })).toBeDisabled();
  await editor.fill("function solution(input) { return input.length; }");
  await page.getByRole("button", { name: "Run 3 tests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All tests passed—next step unlocked" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("interviewiq-coding-practice-v1") || "")).toContain("return input.length;");
  await page.reload();
  await expect(page.getByLabel("Practice mode")).toHaveValue("debug");
  await page.getByRole("button", { name: "Reset code", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "JavaScript solution", exact: true })).toHaveValue(starter);
});
