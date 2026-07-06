function comparableStep(step = {}) {
  return Object.fromEntries(
    Object.entries(step)
      .filter(([, value]) => value !== undefined && value !== null)
      .filter(([key]) => !['targetRef', 'targetName', 'recipientName', 'zoneLabel'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

export function normalizeAssignmentForEval(assignment = {}) {
  return {
    botId: assignment.botId ?? null,
    assignee: assignment.assignee ? { strategy: assignment.assignee.strategy } : null,
    program: {
      repeat: assignment.program?.repeat !== false,
      steps: (assignment.program?.steps || []).map(comparableStep)
    }
  };
}

function matchesSubset(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) return false;
    return expected.every((item, index) => matchesSubset(actual[index], item));
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([key, value]) => matchesSubset(actual[key], value));
  }
  return actual === expected;
}

export function assignmentMatchesExpectation(actualAssignment, expectedAssignment) {
  return matchesSubset(normalizeAssignmentForEval(actualAssignment), expectedAssignment);
}

export function summarizeEvalRows(rows = []) {
  const totals = {
    total: rows.length,
    firstPassValid: 0,
    repairedValid: 0,
    semanticallyCorrect: 0,
    avgLatencyMs: 0,
    avgInputTokens: 0,
    avgOutputTokens: 0
  };
  if (!rows.length) return totals;
  for (const row of rows) {
    if (row.firstPassValid) totals.firstPassValid += 1;
    if (row.repairedValid) totals.repairedValid += 1;
    if (row.semanticCorrect) totals.semanticallyCorrect += 1;
    totals.avgLatencyMs += Number(row.latencyMs || 0);
    totals.avgInputTokens += Number(row.inputTokens || 0);
    totals.avgOutputTokens += Number(row.outputTokens || 0);
  }
  totals.avgLatencyMs = Math.round(totals.avgLatencyMs / rows.length);
  totals.avgInputTokens = Math.round(totals.avgInputTokens / rows.length);
  totals.avgOutputTokens = Math.round(totals.avgOutputTokens / rows.length);
  return totals;
}
