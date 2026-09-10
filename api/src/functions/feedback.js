import { app } from "@azure/functions";
import { ApiError, arrayOfText, completeJson, readBody, text, withApi } from "../lib/ai.js";

app.http("feedback", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "feedback",
  handler: withApi(async (request) => {
    const body = await readBody(request, 100_000);
    const question = text(body.question, 500);
    const answer = text(body.answer, 7000);
    const jobTitle = text(body.jobTitle, 100);
    const resume = text(body.resume, 14_000);
    const company = text(body.company, 100);
    const jobDescription = text(body.jobDescription, 6000);
    const level = ["internship", "entry", "mid", "senior"].includes(body.level) ? body.level : "mid";

    if (!question || answer.length < 20) throw new ApiError(400, "Add a complete answer before requesting feedback.");

    const raw = await completeJson({
      system:
        "You are InterviewIQ, an exacting but supportive interview coach. Evaluate only the candidate answer against the interview question and role. " +
        "Use supplied resume facts as context, but do not penalize relevant new facts the candidate shares in their answer. For introductions and motivation, evaluate relevance, clarity, and authentic fit; do not force STAR or numerical outcomes where inappropriate. Never invent company facts or candidate facts in improved answers; use bracketed placeholders for missing details. Do not invent achievements. Reward specificity, structure, judgment, level-appropriate scope, and measurable evidence. " +
        'Return JSON with shape {"score":number 1-10,"strengths":string[],"improvements":string[],"coaching":string,"improvedAnswer":string}.',
      data: { jobTitle, company, jobDescription, resume, level, question, answer },
      maxTokens: 1200,
      validate: (value) => (
        Number.isFinite(Number(value?.score))
        && Array.isArray(value?.strengths)
        && value.strengths.some((item) => typeof item === "string" && item.trim())
        && Array.isArray(value?.improvements)
        && value.improvements.some((item) => typeof item === "string" && item.trim())
        && typeof value?.coaching === "string"
        && Boolean(value.coaching.trim())
        && typeof value?.improvedAnswer === "string"
        && Boolean(value.improvedAnswer.trim())
      ),
    });

    const result = {
      score: Math.max(1, Math.min(10, Number(raw?.score) || 1)),
      strengths: arrayOfText(raw?.strengths, 5, 220),
      improvements: arrayOfText(raw?.improvements, 5, 220),
      coaching: text(raw?.coaching, 900),
      improvedAnswer: text(raw?.improvedAnswer, 3000),
    };
    if (!result.strengths.length || !result.improvements.length || !result.coaching || !result.improvedAnswer) {
      throw new ApiError(502, "The AI response did not contain complete feedback.");
    }
    return { ...result, provider: "Google AI Studio" };
  }, "feedback"),
});
