const REPORT_TARGET_TYPES = ["user", "physiquePost", "comment"];

const REPORT_REASONS = ["spam", "harassment", "inappropriate_content", "impersonation", "other"];

const REPORT_STATUSES = ["pending", "reviewed", "actioned", "dismissed"];

const DESCRIPTION_MAX_LENGTH = 500;

module.exports = {
  REPORT_TARGET_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
  DESCRIPTION_MAX_LENGTH,
};
