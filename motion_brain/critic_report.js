export function createCriticIssue({
  code,
  message,
  severity = "warning",
  affected_frames = [],
  suggested_fix = null,
  evidence = {},
} = {}) {
  return {
    code,
    message,
    severity,
    affected_frames,
    suggested_fix,
    evidence,
  };
}

export function createCriticReport({ intent, issues = [], features = null } = {}) {
  const severities = new Set(issues.map((issue) => issue.severity));
  const severity = severities.has("blocker")
    ? "blocker"
    : severities.has("warning")
      ? "warning"
      : severities.has("style")
        ? "style"
        : "passed";
  return {
    schema: "critic_report_v1",
    action_intent: `${intent?.action_type || "unknown"}/${intent?.subtype || "generic"}`,
    passed: !severities.has("blocker"),
    severity,
    issues,
    feature_summary: features?.summary || null,
    checked_at: new Date().toISOString(),
  };
}
