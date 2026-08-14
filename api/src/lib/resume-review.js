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
