import { app } from "@azure/functions";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ApiError, multilineText, text, withApi } from "../lib/ai.js";

const maxResumeBytes = 5 * 1024 * 1024;

function fileKind(fileName, contentType, buffer) {
  const name = fileName.toLowerCase();
  if (contentType === "application/pdf" || name.endsWith(".pdf")) {
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new ApiError(415, "That file is not a valid PDF.");
    return "pdf";
  }
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new ApiError(415, "That file is not a valid DOCX document.");
    return "docx";
  }
  if (contentType === "text/plain" || name.endsWith(".txt")) {
    if (buffer.includes(0)) throw new ApiError(415, "That text file contains unsupported binary data.");
    return "text";
  }
  throw new ApiError(415, "Upload a PDF, DOCX, or TXT resume.");
}

async function extractResume(kind, buffer) {
  if (kind === "text") return buffer.toString("utf8");
  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText({ first: 10 })).text;
  } finally {
    await parser.destroy();
  }
}

app.http("resumeExtract", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "resume-extract",
  handler: withApi(async (request) => {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxResumeBytes + 100_000) throw new ApiError(413, "Resume files must be 5 MB or smaller.");

    let form;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError(400, "The resume upload could not be read.");
    }
    const file = form.get("resume");
    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
      throw new ApiError(400, "Choose a resume file to upload.");
    }
    if (!file.size || file.size > maxResumeBytes) throw new ApiError(413, "Resume files must be 5 MB or smaller.");

    const fileName = text(file.name, 180) || "resume";
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = fileKind(fileName, file.type, buffer);
    let extracted;
    try {
      extracted = await extractResume(kind, buffer);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, "Text could not be extracted from that resume. Try a DOCX or TXT version.");
    }
    const resumeText = multilineText(extracted, 14_000);
    if (resumeText.length < 120) throw new ApiError(422, "Not enough readable text was found in that resume.");
    return { fileName, resumeText, characters: resumeText.length };
  }, "resume-extract"),
});
