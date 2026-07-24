const DailySteps = require("../models/DailySteps");

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateKey = (value) => typeof value === "string" && DATE_KEY_PATTERN.test(value);

// Default lookback when no range is requested — enough to cover a Daily
// Steps goal's weekly/monthly window plus a comfortable margin, without
// the client having to know those windows to ask for the right range.
const DEFAULT_LOOKBACK_DAYS = 120;

const todayKeyUTC = () => new Date().toISOString().slice(0, 10);

const daysAgoKeyUTC = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

// GET /api/daily-steps?from=YYYY-MM-DD&to=YYYY-MM-DD — both optional.
// Returns every logged day in range, ascending by date. The client (not
// this endpoint) decides what "today" is — from/to are plain string
// keys, compared lexicographically, which is safe for YYYY-MM-DD.
exports.getDailySteps = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (from !== undefined && !isValidDateKey(from)) {
      return res.status(400).json({ message: "from must be YYYY-MM-DD" });
    }
    if (to !== undefined && !isValidDateKey(to)) {
      return res.status(400).json({ message: "to must be YYYY-MM-DD" });
    }

    const dateFilter = {};
    dateFilter.$gte = from || daysAgoKeyUTC(DEFAULT_LOOKBACK_DAYS);
    dateFilter.$lte = to || todayKeyUTC();

    const entries = await DailySteps.find({ user: req.user._id, date: dateFilter })
      .sort({ date: 1 })
      .select("date steps -_id");

    res.status(200).json(entries);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to load daily steps." });
  }
};

// PUT /api/daily-steps — upserts {date, steps} for the current user.
// "Set today's total" semantics: overwrites whatever was previously
// stored for that date rather than accumulating, per product decision —
// a user re-checking their phone's step count later in the day corrects
// the value, it doesn't add to it.
exports.setDailySteps = async (req, res) => {
  try {
    const { date, steps } = req.body;

    if (!isValidDateKey(date)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }

    if (
      steps === undefined ||
      steps === null ||
      steps === "" ||
      isNaN(Number(steps)) ||
      Number(steps) < 0
    ) {
      return res.status(400).json({ message: "steps must be a non-negative number" });
    }

    const cleanSteps = Math.round(Number(steps));

    const entry = await DailySteps.findOneAndUpdate(
      { user: req.user._id, date },
      { $set: { steps: cleanSteps } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ date: entry.date, steps: entry.steps });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to save daily steps." });
  }
};
