export class MotionQualityGate {
  evaluate({ critic_report, validator_report, rig_validation, iteration = 0 } = {}) {
    const criticIssues = critic_report?.issues || [];
    const validatorIssues = validator_report?.issues || [];
    const rigIssues = rig_validation?.issues || [];
    const blockers = [
      ...criticIssues.filter((issue) => issue.severity === "blocker"),
      ...validatorIssues.map((issue) => ({ ...issue, severity: "blocker", source: "ActionValidator" })),
      ...(rig_validation?.status === "Issues" ? rigIssues.map((issue) => ({ ...issue, severity: "blocker", source: "RigValidator" })) : []),
    ];
    const warnings = criticIssues.filter((issue) => issue.severity === "warning");
    const style = criticIssues.filter((issue) => issue.severity === "style");
    const severity = blockers.length > 0
      ? "blocker"
      : warnings.length > 0
        ? "warning"
        : style.length > 0
          ? "style"
          : "passed";
    return {
      schema: "motion_quality_gate_v1",
      passed: blockers.length === 0,
      severity,
      iteration,
      blockers,
      warnings,
      style,
      critic_report,
      validator_report,
      rig_validation,
      checked_at: new Date().toISOString(),
    };
  }
}
