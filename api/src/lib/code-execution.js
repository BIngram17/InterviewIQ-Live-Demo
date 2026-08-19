import { ApiError } from "./ai.js";
import { codingLanguages, executionValueTypes, valueMatchesExecutionType } from "./coding-practice.js";

const WANDBOX_ENDPOINT = "https://wandbox.org/api/compile.json";
const compilerByLanguage = {
  javascript: process.env.WANDBOX_COMPILER_JAVASCRIPT || "nodejs-20.17.0",
  python: process.env.WANDBOX_COMPILER_PYTHON || "cpython-3.12.7",
  java: process.env.WANDBOX_COMPILER_JAVA || "openjdk-jdk-21+35",
  csharp: process.env.WANDBOX_COMPILER_CSHARP || "mono-6.12.0.199",
  rust: process.env.WANDBOX_COMPILER_RUST || "rust-1.82.0",
};

function cleanError(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\r\n?/g, "\n").trim().slice(0, 900);
}

function literal(value, type, language) {
  if (type === "integer") return String(value);
  if (type === "boolean") return language === "python" ? (value ? "True" : "False") : String(value);
  if (type === "string") return language === "rust" ? `String::from(${JSON.stringify(value)})` : JSON.stringify(value);
  const itemType = type.replace("-array", "");
  const items = value.map((item) => literal(item, itemType, language)).join(", ");
  if (language === "javascript" || language === "python") return `[${items}]`;
  if (language === "java") {
    const javaType = itemType === "integer" ? "int" : itemType === "boolean" ? "boolean" : "String";
    return `new ${javaType}[]{${items}}`;
  }
  if (language === "csharp") {
    const csharpType = itemType === "integer" ? "int" : itemType === "boolean" ? "bool" : "string";
    return `new ${csharpType}[] {${items}}`;
  }
  return `vec![${items}]`;
}

function comparison(language, outputType) {
  const isArray = outputType.endsWith("-array");
  if (language === "java") return isArray ? "java.util.Arrays.equals(actual, expected)" : "java.util.Objects.equals(actual, expected)";
  if (language === "csharp") return isArray ? "System.Linq.Enumerable.SequenceEqual(actual, expected)" : "object.Equals(actual, expected)";
  return "actual == expected";
}

export function validateExecutionRequest(value) {
  if (!value || typeof value !== "object") return null;
  const language = codingLanguages.has(value.language) ? value.language : "";
  const code = typeof value.code === "string" ? value.code.trim().slice(0, 12000) : "";
  const inputType = executionValueTypes.has(value.inputType) ? value.inputType : "";
  const outputType = executionValueTypes.has(value.outputType) ? value.outputType : "";
  const tests = Array.isArray(value.tests) ? value.tests.slice(0, 6).map((test) => ({ input: test?.input, expected: test?.expected })) : [];
  if (!language || code.length < 8 || !inputType || !outputType || tests.length < 1 || tests.some((test) => !valueMatchesExecutionType(test.input, inputType) || !valueMatchesExecutionType(test.expected, outputType))) return null;
  return { language, code, inputType, outputType, tests };
}

export function buildExecutionSource({ language, code, inputType, outputType, tests }, marker) {
  const cases = tests.map((test, index) => ({ index, input: literal(test.input, inputType, language), expected: literal(test.expected, outputType, language) }));
  if (language === "javascript") {
    return `${code}\n\n${cases.map(({ index, input, expected }) => `try { const actual = solution(${input}); const expected = ${expected}; console.log(${JSON.stringify(marker)} + ${index} + ":" + (JSON.stringify(actual) === JSON.stringify(expected) ? "PASS" : "FAIL")); } catch (_) { console.log(${JSON.stringify(marker)} + ${index} + ":ERROR"); }`).join("\n")}`;
  }
  if (language === "python") {
    return `${code}\n\n${cases.map(({ index, input, expected }) => `try:\n    actual = solution(${input})\n    expected = ${expected}\n    print(${JSON.stringify(marker)} + "${index}:" + ("PASS" if actual == expected else "FAIL"))\nexcept Exception:\n    print(${JSON.stringify(marker)} + "${index}:ERROR")`).join("\n")}`;
  }
  if (language === "java") {
    return `${code}\n\nclass Main {\n  public static void main(String[] args) {\n${cases.map(({ index, input, expected }) => `    try { var actual = Solution.solution(${input}); var expected = ${expected}; System.out.println(${JSON.stringify(marker)} + "${index}:" + (${comparison(language, outputType)} ? "PASS" : "FAIL")); } catch (Throwable error) { System.out.println(${JSON.stringify(marker)} + "${index}:ERROR"); }`).join("\n")}\n  }\n}`;
  }
  if (language === "csharp") {
    return `${code}\n\npublic class Program {\n  public static void Main() {\n${cases.map(({ index, input, expected }) => `    try { var actual = Solution.solution(${input}); var expected = ${expected}; System.Console.WriteLine(${JSON.stringify(marker)} + "${index}:" + (${comparison(language, outputType)} ? "PASS" : "FAIL")); } catch (System.Exception) { System.Console.WriteLine(${JSON.stringify(marker)} + "${index}:ERROR"); }`).join("\n")}\n  }\n}`;
  }
  return `${code}\n\nfn main() {\n${cases.map(({ index, input, expected }) => `    { let actual = solution(${input}); let expected = ${expected}; println!("{}${index}:{}", ${JSON.stringify(marker)}, if ${comparison(language, outputType)} { "PASS" } else { "FAIL" }); }`).join("\n")}\n}`;
}

export function parseExecutionResults(output, marker, tests) {
  const found = new Map();
  for (const line of String(output || "").split(/\r?\n/)) {
    const match = line.trim().match(new RegExp(`^${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+):(PASS|FAIL|ERROR)$`));
    if (match) found.set(Number(match[1]), match[2]);
  }
  return tests.map((test, index) => {
    const state = found.get(index);
    return { passed: state === "PASS", expected: test.expected, ...(state === "ERROR" ? { error: "The solution threw an error for this test." } : state ? {} : { error: "The test did not complete." }) };
  });
}

export async function executeCode(request) {
  const payload = validateExecutionRequest(request);
  if (!payload) throw new ApiError(400, "The code, language, type contract, or tests are invalid. Generate a fresh challenge and try again.");
  const marker = `__INTERVIEWIQ_${crypto.randomUUID().replaceAll("-", "")}__`;
  const source = buildExecutionSource(payload, marker);
  let response;
  try {
    response = await fetch(WANDBOX_ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler: compilerByLanguage[payload.language], code: source, save: false }),
    });
  } catch {
    throw new ApiError(503, "The free code sandbox is temporarily unavailable. Your attempt was not counted; please try again.");
  }
  if (response.status === 429) throw new ApiError(429, "The free code sandbox is busy. Your attempt was not counted; please try again shortly.");
  if (!response.ok) throw new ApiError(503, "The free code sandbox is temporarily unavailable. Your attempt was not counted; please try again.");
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== "object") throw new ApiError(502, "The code sandbox returned an invalid response. Your attempt was not counted.");
  const error = cleanError(result.compiler_error || result.program_error || (String(result.status) !== "0" ? result.signal || "Execution failed." : ""));
  if (error) return { results: payload.tests.map((test) => ({ passed: false, expected: test.expected, error: "The code did not compile or finish." })), error, compiler: compilerByLanguage[payload.language] };
  return { results: parseExecutionResults(result.program_output, marker, payload.tests), error: "", compiler: compilerByLanguage[payload.language] };
}
