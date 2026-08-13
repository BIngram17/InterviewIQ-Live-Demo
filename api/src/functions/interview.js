import { app } from "@azure/functions";
import { ApiError, arrayOfText, completeJson, readBody, text, withApi } from "../lib/ai.js";

const levels = new Set(["internship", "entry", "mid", "senior"]);
const interviewTypes = new Set(["mixed", "behavioral", "technical"]);

function validateQuestion(value) {
  if (!value || typeof value !== "object") return null;
  const category = text(value.category, 40);
  const question = text(value.question, 420);
  const why = text(value.why, 220);
  if (!category || !question || !why) return null;

  let coding;
  if (value.coding && typeof value.coding === "object") {
    const title = text(value.coding.title, 120);
    const prompt = text(value.coding.prompt, 700);
    const examples = text(value.coding.examples, 500);
    if (title && prompt && examples) {
      coding = { title, prompt, examples };
    }
  }
  return { category, question, why, ...(coding ? { coding } : {}) };
}

app.http("interview", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "interview",
  handler: withApi(async (request) => {
    const body = await readBody(request);
    const jobTitle = text(body.jobTitle, 100);
    const company = text(body.company, 100);
    const jobDescription = text(body.jobDescription, 6000);
    const level = levels.has(body.level) ? body.level : "mid";
    const interviewType = interviewTypes.has(body.interviewType) ? body.interviewType : "mixed";
    const previousQuestions = arrayOfText(body.previousQuestions, 10, 420);

    if (jobTitle.length < 2 || jobDescription.length < 30) {
      throw new ApiError(400, "Add a job title and a more detailed job description.");
    }

    const raw = await completeJson({
      system:
        "You are InterviewIQ, an expert interview coach. Analyze the exact role and create six fresh, realistic interview questions. " +
        "Calibrate scope, autonomy, and leadership to the role level. Internship questions should emphasize learning, fundamentals, coachability, and achievable scoped contributions rather than prior leadership experience. Use concrete responsibilities and skills from the job description. " +
        "Avoid every question in previousQuestions and avoid generic filler. For mixed or technical software/data roles, include exactly one coding question. " +
        "A coding question must be language-neutral and solvable in JavaScript, Python, or Java in 20 minutes. " +
        'Return JSON with shape {"analysis":{"summary":string,"technical":string[],"soft":string[],"topics":string[]},"questions":[{"category":string,"question":string,"why":string,"coding"?:{"title":string,"prompt":string,"examples":string}}]}.',
      data: { jobTitle, company, jobDescription, level, interviewType, previousQuestions, generationNonce: crypto.randomUUID() },
      maxTokens: 2200,
    });

    const analysis = {
      summary: text(raw?.analysis?.summary, 800),
      technical: arrayOfText(raw?.analysis?.technical, 6, 100),
      soft: arrayOfText(raw?.analysis?.soft, 6, 100),
      topics: arrayOfText(raw?.analysis?.topics, 6, 100),
    };
    const questions = Array.isArray(raw?.questions)
      ? raw.questions.map(validateQuestion).filter(Boolean).slice(0, 6)
      : [];

    if (!analysis.summary || analysis.technical.length < 2 || analysis.soft.length < 2 || questions.length < 4) {
      throw new ApiError(502, "The AI response did not contain a complete interview set.");
    }
    return { analysis, questions, provider: "Google AI Studio" };
  }, "interview"),
});
