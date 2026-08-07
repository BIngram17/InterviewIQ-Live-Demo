import { app } from "@azure/functions";
import { ApiError, arrayOfText, completeJson, readBody, text, withApi } from "../lib/ai.js";

app.http("feedback", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "feedback",
  handler: withApi(async (request) => {
    const body = await readBody(request);
    const question = text(body.question, 500);
    const answer = text(body.answer, 7000);
    const jobTitle = text(body.jobTitle, 100);
    const level = ["internship", "entry", "mid", "senior"].includes(body.level) ? body.level : "mid";

    if (!question || answer.length < 20) throw new ApiError(400, "Add a complete answer before requesting feedback.");

    const raw = await completeJson({
      system:
        "You are InterviewIQ, an exacting but supportive interview coach. Evaluate only the candidate answer against the interview question and role. " +
        "Do not invent achievements. Reward specificity, structure, judgment, level-appropriate scope, and measurable evidence. " +
        'Return JSON with shape {"score":number 1-10,"strengths":string[],"improvements":string[],"coaching":string,"improvedAnswer":string}.',
      data: { jobTitle, level, question, answer },
      maxTokens: 1500,
      temperature: 0.45,
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
