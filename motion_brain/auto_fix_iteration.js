export function createAutoFixIteration({
  iteration = 0,
  before_report = null,
  fixes = [],
  applied = false,
  after_report = null,
} = {}) {
  return {
    schema: "auto_fix_iteration_v1",
    iteration,
    applied: Boolean(applied),
    fixes,
    before_report,
    after_report,
    created_at: new Date().toISOString(),
  };
}
