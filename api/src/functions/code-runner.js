import { app } from "@azure/functions";
import { readBody, withApi } from "../lib/ai.js";
import { executeCode } from "../lib/code-execution.js";

app.http("codeRunner", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "code-runner",
  handler: withApi(async (request) => executeCode(await readBody(request)), "code-runner"),
});
