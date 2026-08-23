const monthNames = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export const resumeScoringRubric = [
  { category: "Required qualifications", maxScore: 30 },
  { category: "Relevant experience and seniority", maxScore: 25 },
  { category: "Skills and ATS terminology", maxScore: 20 },
  { category: "Quantified impact and evidence", maxScore: 15 },
  { category: "Clarity and ATS readability", maxScore: 10 },
];

// Partial evidence should receive meaningful credit without being treated as a
// full match. An all-partial resume establishes a roughly 70-point baseline; moving
// above 90 still requires nearly every criterion to be fully met.
const statusValue = { missing: 0, partial: 0.7, met: 1 };

function compact(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function rubricCategory(value) {
  const normalized = compact(value, 100).toLowerCase().replace(/[^a-z]+/g, " ").trim();
  if (!normalized) return "";
  return resumeScoringRubric.find((item) => {
    const category = item.category.toLowerCase().replace(/[^a-z]+/g, " ").trim();
    return normalized === category || normalized.includes(category) || category.includes(normalized);
  })?.category || "";
}

function safeStatus(value, fallback = "missing") {
  return Object.hasOwn(statusValue, value) ? value : fallback;
}

function statusFromScore(score, maxScore) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  return ratio >= 0.75 ? "met" : ratio >= 0.3 ? "partial" : "missing";
}

export function normalizeEvaluationCriteria(rawCriteria, previousCriteria = [], resumeEvidence = "", rawBreakdown = []) {
  const sanitize = (item, index) => {
    const status = safeStatus(item?.status);
    const requestedProjection = safeStatus(item?.projectedStatus, status);
    return {
      id: compact(item?.id, 60) || `criterion-${index + 1}`,
      category: rubricCategory(item?.category),
      requirement: compact(item?.requirement, 260),
      importance: ["required", "preferred", "quality"].includes(item?.importance) ? item.importance : "quality",
      status,
      projectedStatus: statusValue[requestedProjection] < statusValue[status] ? status : requestedProjection,
      evidence: compact(item?.evidence, 500),
      explanation: compact(item?.explanation, 360),
    };
  };
  const raw = Array.isArray(rawCriteria) ? rawCriteria.map(sanitize).filter((item) => item.category && item.requirement) : [];
  const previous = Array.isArray(previousCriteria) ? previousCriteria.map(sanitize).filter((item) => item.category && item.requirement) : [];
  const rawById = new Map(raw.map((item) => [item.id, item]));

  const criteria = previous.length
    ? previous.map((prior, index) => {
      const assessed = rawById.get(prior.id) || raw[index] || prior;
      const priorStillSupported = prior.evidence && resumeContainsEvidence(resumeEvidence, prior.evidence);
      const assessedStatus = safeStatus(assessed.status, prior.status);
      const status = priorStillSupported && statusValue[assessedStatus] < statusValue[prior.status] ? prior.status : assessedStatus;
      const projectedStatus = safeStatus(assessed.projectedStatus, status);
      return {
        ...prior,
        status,
        projectedStatus: statusValue[projectedStatus] < statusValue[status] ? status : projectedStatus,
        evidence: status === prior.status && priorStillSupported && statusValue[assessedStatus] < statusValue[prior.status] ? prior.evidence : assessed.evidence,
        explanation: status === prior.status && priorStillSupported && statusValue[assessedStatus] < statusValue[prior.status] ? prior.explanation : assessed.explanation,
      };
    })
    : raw.slice(0, 15);

  for (const rubric of resumeScoringRubric) {
    if (criteria.some((item) => item.category === rubric.category)) continue;
    const source = Array.isArray(rawBreakdown) ? rawBreakdown.find((item) => rubricCategory(item?.category) === rubric.category) : null;
    const score = Math.max(0, Math.min(rubric.maxScore, Number(source?.score) || 0));
    const status = statusFromScore(score, rubric.maxScore);
    criteria.push({
      id: `fallback-${rubric.category.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      category: rubric.category,
      requirement: rubric.category,
      importance: "quality",
      status,
      projectedStatus: status,
      evidence: compact(source?.evidence, 500),
      explanation: compact(source?.improvement, 360),
    });
  }
  return criteria.slice(0, 20);
}

export function scoreEvaluationCriteria(criteria, statusField = "status") {
  const breakdown = resumeScoringRubric.map((rubric) => {
    const items = criteria.filter((item) => item.category === rubric.category);
    const weights = items.map((item) => item.importance === "required" ? 2 : 1);
    const possible = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const earned = items.reduce((sum, item, index) => sum + weights[index] * statusValue[safeStatus(item?.[statusField])], 0);
    return { category: rubric.category, score: Math.round(rubric.maxScore * earned / possible), maxScore: rubric.maxScore };
  });
  return { score: breakdown.reduce((sum, item) => sum + item.score, 0), breakdown };
}

export function currentDateIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function safeChangeKind(value) {
  return value === "rewrite" ? "rewrite" : "needs-info";
}

export function safeChangeOperation(value) {
  return ["add", "replace", "move"].includes(value) ? value : "add";
}

export function isNoOpChange(change, resume) {
  const normalize = (value) => String(value || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const operation = safeChangeOperation(change?.operation);
  const source = normalize(change?.sourceEvidence);
  const example = normalize(change?.example);

  if (operation === "replace" && source.length >= 8 && source === example) return true;
  if (operation === "add" && example.length >= 8 && normalize(resume).includes(example)) return true;

  if (operation === "move") {
    const reorder = String(change?.suggestion || "").match(
      /\b(?:move|place|put)\s+["“]?([^,"”]{1,60}?)["”]?\s+(?:to|at)\s+(?:the\s+)?(?:front|beginning|start|first)\b/i,
    );
    if (reorder) {
      const requestedFirst = normalize(reorder[1]).replace(/^(?:the|a|an)\s+/, "");
      const currentFirst = normalize(String(change?.sourceEvidence || "")
        .replace(/^[^:]*:/, "")
        .split(/[,;|/]/)[0]);
      if (requestedFirst && currentFirst && (currentFirst === requestedFirst || currentFirst.startsWith(`${requestedFirst} `))) {
        return true;
      }
    }
  }

  return false;
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

export function coverLetterNotes(value, maxItems = 5, maxLength = 220) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").replace(/\s+/g, " ").trim().slice(0, maxLength))
    .filter(Boolean)
    .filter((item) => !/\bword count\b|\b\d+\s+words?\b|\bparagraph\s+\d+\b|\btarget(?:ed)?\s*(?:range)?\s*[:(-]?\s*\d+/i.test(item))
    .slice(0, maxItems);
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
