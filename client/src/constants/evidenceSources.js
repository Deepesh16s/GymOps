export const EVIDENCE_STRENGTH = {
  STRONG: "STRONG",
  MODERATE: "MODERATE",
  MIXED: "MIXED",
  LIMITED: "LIMITED",
  INSUFFICIENT: "INSUFFICIENT",
};

export const EVIDENCE_SOURCES = {
  "epley-1rm": {
    id: "epley-1rm",
    title: "Poundage Chart",
    authors: "Epley, B.",
    year: 1985,
    journal: "Boyd Epley Workout",
    evidenceType: "original formula, subsequently validated",
    url: "https://pubmed.ncbi.nlm.nih.gov/?term=Epley+1RM+prediction+equation+validation",
    metrics: ["e1RM"],
    finding:
      "Rep-based 1RM prediction equations, including Epley's, are most accurate at low-to-moderate rep counts (roughly 1-10 reps) and lose accuracy as rep count rises, with prediction bias also shifting between trained and untrained lifters.",
    limitations:
      "Accuracy was not independently re-verified against the original 1985 source in this pass; the accuracy characterization above is drawn from subsequent validation studies of submaximal 1RM prediction equations, not a single canonical paper.",
  },
  "volume-dose-response-2017": {
    id: "volume-dose-response-2017",
    title: "Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis",
    authors: "Schoenfeld, B.J., Ogborn, D., Krieger, J.W.",
    year: 2017,
    journal: "Journal of Sports Sciences",
    evidenceType: "systematic review + meta-analysis",
    pubmedId: "27433992",
    url: "https://pubmed.ncbi.nlm.nih.gov/27433992/",
    metrics: ["volumeLandmarks", "muscleBalance"],
    finding:
      "Weekly resistance-training volume shows a graded dose-response relationship with hypertrophy, expressed as sets-per-muscle-per-week, with the largest measured effects at higher weekly set counts among the studies analyzed.",
    limitations:
      "Reflects group-level, hypertrophy-outcome averages across a specific set of trials; does not establish an individual, exact set-count ceiling, and does not itself validate a kg-volume-percentile calculation.",
  },
  "dose-response-metareg-2025": {
    id: "dose-response-metareg-2025",
    title: "The Resistance Training Dose-Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gain",
    authors: "(recent meta-regression, publisher/author details not independently re-verified this pass)",
    year: 2025,
    journal: "Sports Medicine / SportRxiv preprint",
    evidenceType: "meta-regression",
    url: "https://pubmed.ncbi.nlm.nih.gov/41343037/",
    metrics: ["volumeLandmarks", "muscleBalance", "trainingFrequency"],
    finding:
      "Both hypertrophy and strength show diminishing returns as weekly volume increases, with strength's diminishing-returns curve considerably steeper than hypertrophy's; classifying sets as direct/indirect/fractional (rather than counting every set as fully contributing) better predicted outcomes than raw set counting.",
    limitations:
      "A recent meta-regression; findings may be refined by later work. Direct/indirect set classification requires an exercise-level primary/secondary-muscle taxonomy that Repvyn's current exercise data model does not yet encode.",
  },
  "frequency-hypertrophy-2018": {
    id: "frequency-hypertrophy-2018",
    title: "Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy / How many times per week should a muscle be trained",
    authors: "Schoenfeld, B.J., Grgic, J., et al. (exact author order not independently re-verified this pass)",
    year: 2018,
    journal: "Sports Medicine",
    evidenceType: "systematic review + meta-analysis",
    pubmedId: "30558493",
    url: "https://pubmed.ncbi.nlm.nih.gov/30558493/",
    metrics: ["trainingFrequency", "muscleNeglect"],
    finding:
      "When weekly training volume is held equal, training frequency itself shows little independent effect on hypertrophy; frequency mainly matters as a vehicle for accumulating volume, not as an independent driver.",
    limitations:
      "Volume-equated comparisons are a specific experimental design; real-world frequency changes often change volume too, which this finding does not directly speak to.",
  },
  "frequency-strength-2018": {
    id: "frequency-strength-2018",
    title: "Effect of Resistance Training Frequency on Gains in Muscular Strength: A Systematic Review and Meta-Analysis",
    authors: "Grgic, J., et al. (exact author order not independently re-verified this pass)",
    year: 2018,
    journal: "Sports Medicine",
    evidenceType: "systematic review + meta-analysis",
    pubmedId: "29470825",
    url: "https://pubmed.ncbi.nlm.nih.gov/29470825/",
    metrics: ["trainingFrequency"],
    finding:
      "Unlike hypertrophy, strength gain shows a small positive relationship with training frequency even at equal volume, though with diminishing returns at higher frequencies.",
    limitations: "Effect size is modest; frequency is one of several variables affecting strength outcomes.",
  },
  "acwr-injury-meta-2024": {
    id: "acwr-injury-meta-2024",
    title: "Acute to chronic workload ratio (ACWR) for predicting sports injury risk: a systematic review and meta-analysis",
    authors: "(systematic review authors not independently re-verified this pass)",
    year: 2024,
    journal: "peer-reviewed sports medicine journal (via PMC)",
    evidenceType: "systematic review + meta-analysis",
    pmcId: "PMC12487117",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12487117/",
    metrics: ["trainingLoadTrend", "fatigue"],
    finding:
      "ACWR is statistically associated with injury risk (effect size 0.72, 95% CI 0.60-0.82) across the pooled studies, but the review explicitly cautions the metric should be used with caution: the commonly-cited 0.8-1.3 'safe' band has a wide confidence interval and individual response to a given ACWR value varies substantially.",
    limitations:
      "Association, not individual-level prediction; high between-study heterogeneity in how ACWR was calculated; not validated specifically for resistance-training weekly volume ratios as Repvyn computes them.",
  },
  "strength-progression-nonlinear": {
    id: "strength-progression-nonlinear",
    title: "General strength/hypertrophy adaptation literature on novice vs. trained progression curves",
    authors: "(multiple sources; not a single paper)",
    year: 2024,
    journal: "multiple (peer-reviewed and applied sports-science sources)",
    evidenceType: "narrative synthesis of multiple sources",
    url: "https://pubmed.ncbi.nlm.nih.gov/?term=resistance+training+progression+novice+trained+diminishing+returns",
    metrics: ["goalForecast", "plateau"],
    finding:
      "Strength and hypertrophy adaptation follows a logarithmic, diminishing-returns curve rather than a straight line: novice lifters progress quickly, and the rate of gain slows substantially with training age. A short window of recent progress does not reliably extrapolate linearly over a long horizon.",
    limitations:
      "General pattern from the literature, not a fitted individual-level model; Repvyn does not attempt to fit a nonlinear curve to a user's own short history, since that would require more data than is typically available.",
  },
};

export function getSourcesForMetric(metricKey) {
  return Object.values(EVIDENCE_SOURCES).filter((s) => s.metrics.includes(metricKey));
}
