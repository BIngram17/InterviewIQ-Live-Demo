const monthNames = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function currentDateIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function safeChangeKind(value) {
  return value === "rewrite" ? "rewrite" : "needs-info";
}

export function safeChangeOperation(value) {
  return ["add", "replace", "move"].includes(value) ? value : "add";
}

export function resumeContainsEvidence(resume, evidence) {
  const normalize = (value) => String(value || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedEvidence = normalize(evidence);
  return normalizedEvidence.length >= 8 && normalize(resume).includes(normalizedEvidence);
}

export function endsWithOmission(value) {
  return /(?:\.\.\.|…)[\s"']*$/.test(String(value || ""));
}

export function requestsSkillDeletion(change) {
  const value = [change?.section, change?.currentIssue, change?.suggestion, change?.example]
    .map((item) => String(item || ""))
    .join(" ");
  return /\b(?:delete|remove|omit|drop|eliminate)\b.{0,100}\bskills?\b|\bskills?\b.{0,100}\b(?:delete|remove|omit|drop|eliminate)\b/i.test(value);
}

export function countWords(value) {
  const content = String(value || "").trim();
  return content ? content.split(/\s+/).length : 0;
}

export function coverLetterInRange(value, minimum = 325, maximum = 400) {
  const words = countWords(value);
  return words >= minimum && words <= maximum;
}

export function mislabelsCompletedPastDate(change, resume, now = new Date()) {
  const issue = String(change?.currentIssue || "");
  if (!/future|upcoming|not yet occurred/i.test(issue)) return false;

  const normalizedResume = String(resume || "").replace(/\s+/g, " ");
  const datePattern = new RegExp(`\\b(${monthNames.join("|")})\\s+(20\\d{2})\\b`, "ig");
  for (const match of issue.matchAll(datePattern)) {
    const monthIndex = monthNames.indexOf(match[1].toLowerCase());
    const referencedDate = new Date(Date.UTC(Number(match[2]), monthIndex + 1, 1));
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if (referencedDate > currentMonth) continue;

    const escapedDate = `${match[1]}\\s+${match[2]}`;
    const completedBeforeDate = new RegExp(`\\b(conferred|graduated|completed|awarded)\\b.{0,80}${escapedDate}`, "i");
    const completedAfterDate = new RegExp(`${escapedDate}.{0,80}\\b(conferred|graduated|completed|awarded)\\b`, "i");
    if (completedBeforeDate.test(normalizedResume) || completedAfterDate.test(normalizedResume)) return true;
  }
  return false;
}
