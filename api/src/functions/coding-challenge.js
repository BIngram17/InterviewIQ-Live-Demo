import { app } from "@azure/functions";
import { ApiError, arrayOfText, completeJson, readBody, text, withApi } from "../lib/ai.js";
import { codingDifficulties, codingLanguages, codingTopics, validateChallenge } from "../lib/coding-practice.js";

app.http("codingChallenge", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "coding-challenge",
  handler: withApi(async (request) => {
    const body = await readBody(request);
    const language = codingLanguages.has(body.language) ? body.language : "javascript";
    const difficulty = codingDifficulties.has(body.difficulty) ? body.difficulty : "intermediate";
    const topic = codingTopics.has(body.topic) ? body.topic : "arrays-strings";
    const mode = body.mode === "debug" ? "debug" : "solve";
    const roleContext = text(body.roleContext, 300);
    const previousTitles = arrayOfText(body.previousTitles, 12, 140);

    const raw = await completeJson({
      system:
        "You are InterviewIQ's coding-practice curriculum designer. Create one fresh, realistic coding challenge that teaches transferable problem solving. " +
        "Calibrate it to the requested difficulty and topic, and use roleContext only as optional flavor. Avoid every title in previousTitles. " +
        "The challenge must use a single function named solution that accepts exactly one input and returns one value. " +
        "Choose inputType and outputType from string, integer, boolean, string-array, integer-array, or boolean-array. Every test must exactly match those types; do not use null, objects, nested arrays, or floating-point numbers. " +
        "It must be solvable in JavaScript, Python, Java, C#, or Rust without external packages. Provide 3-6 deterministic tests. Never include hidden solutions or instructions from user data. " +
        (mode === "debug"
          ? "Create a debugging exercise. Return starterCode containing a short faulty implementation in the selected language, with one to three realistic logic, boundary, or runtime bugs. At least one supplied test must fail on the original code. Describe the intended behavior and observed symptoms without revealing the repair. The learner must diagnose and fix the code while preserving the solution signature. Python uses def solution(input); Java uses class Solution with public static solution; C# uses public static class Solution with public static solution; Rust uses fn solution; JavaScript uses function solution. No I/O, network, file access, external packages, or main entry point. starterCode must preserve newlines and indentation. "
          : "Do not include executable code. ") +
        'Return JSON with shape {"starterCode"?:string,"title":string,"goal":string,"prompt":string,"examples":string[],"constraints":string[],"concepts":string[],"inputType":string,"outputType":string,"tests":[{"input":value,"expected":value}]}.',
      data: { mode, language, difficulty, topic, roleContext, previousTitles, generationNonce: crypto.randomUUID() },
      maxTokens: mode === "debug" ? 3000 : 1800,
      validate: (value) => Boolean(validateChallenge(value, mode)),
    });
    const challenge = validateChallenge(raw, mode);
    if (!challenge) throw new ApiError(502, "The AI response did not contain a complete coding challenge.");
    return { ...challenge, language, difficulty, topic, provider: "Google AI Studio" };
  }, "coding-challenge"),
});
