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
      "Rep-based 1RM prediction equations, including Epley's, are most accurate in roughly the 3-6 rep range (some validation work found 5RM performances gave the closest predictions) and become progressively less reliable above about 10 reps as fatigue and technique breakdown add noise. Averaging several validated formulas (Epley, Brzycki, Lombardi, Mayhew, Wathen) tends to be more reliable than any single equation.",
    limitations:
      "Findings vary somewhat by study population and exercise; Repvyn applies a single formula (Epley) uniformly regardless of rep count or exercise, which is a simplification the underlying research does not fully support at higher rep counts.",
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
    metrics: ["volumeLandmarks", "muscleBalance"],
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
    metrics: ["muscleNeglect"],
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
    metrics: ["muscleNeglect"],
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
    metrics: ["fatigue"],
    finding:
      "ACWR is statistically associated with injury risk (effect size 0.72, 95% CI 0.60-0.82) across the pooled studies, but the review explicitly cautions the metric should be used with caution: the commonly-cited 0.8-1.3 'safe' band has a wide confidence interval and individual response to a given ACWR value varies substantially.",
    limitations:
      "Association, not individual-level prediction; high between-study heterogeneity in how ACWR was calculated; developed and validated on GPS-tracked running load in team sports (cricket, rugby), not resistance-training volume; not validated specifically for the weekly volume ratio Repvyn computes.",
  },
  "acwr-methodological-critique": {
    id: "acwr-methodological-critique",
    title: "Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls",
    authors: "Impellizzeri, F.M., Tenan, M.S., et al.",
    year: 2020,
    journal: "International Journal of Sports Physiology and Performance",
    evidenceType: "methodological critique / narrative review",
    url: "https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml",
    metrics: ["fatigue"],
    finding:
      "The acute and chronic windows in a standard ACWR share overlapping data points (a session counted in the last 7 days is also counted in the last 28), which mathematically couples the two terms and produces a spurious correlation independent of any real injury relationship. Impellizzeri and colleagues have formally requested corrections to oversimplified published ACWR-injury figures, and argue the metric lacks a coherent causal interpretation.",
    limitations:
      "This is a critique of the ACWR concept itself, not a study of resistance training specifically — but it directly undermines the statistical basis of the injury-risk association reported in the ACWR meta-analyses this app's fatigue signal partially drew on.",
  },
  "1rm-test-retest-reliability": {
    id: "1rm-test-retest-reliability",
    title: "Test-Retest Reliability of the One-Repetition Maximum (1RM) Strength Assessment: a Systematic Review",
    authors: "Grgic, J., Lazinica, B., Schoenfeld, B.J., Pedisic, Z.",
    year: 2020,
    journal: "Sports Medicine - Open",
    evidenceType: "systematic review",
    pubmedId: "32681399",
    url: "https://pubmed.ncbi.nlm.nih.gov/32681399/",
    metrics: ["plateau", "e1RM"],
    finding:
      "Across 32 studies (1,595 participants), even a controlled, maximal 1RM test repeated 1-10 days apart shows a median coefficient of variation around 4.2% (range 0.5-12.1%) purely from measurement noise, not real strength change. Reliability was similar across trained/untrained, upper/lower body, and single/multi-joint exercises.",
    limitations:
      "This reflects standardized, maximal testing conditions (warm-up, rest, effort cueing); ordinary logged training sets lack that standardization and estimated (not directly tested) 1RM values carry additional formula error on top of this, so real-world noise is likely at least this large, possibly larger.",
  },
  "muscle-specific-transferability": {
    id: "muscle-specific-transferability",
    title: "Systematic review of the effects of resistance training volume on muscle hypertrophy across muscle groups (incl. triceps/biceps/quadriceps volume comparison); dose-response calf-volume RCT",
    authors: "Baz-Valle, E. et al.; Kassiano, W. et al.",
    year: 2022,
    journal: "Journal of Human Kinetics (PMID 35291645); International Journal of Sports Medicine (PMID 38684187)",
    evidenceType: "systematic review; randomized controlled trial",
    pubmedId: "35291645",
    url: "https://pubmed.ncbi.nlm.nih.gov/35291645/",
    metrics: ["muscleBalance", "muscleNeglect", "volumeLandmarks"],
    finding:
      "Muscles do not share one universal volume dose-response curve. Baz-Valle's review found higher weekly volume (>~20 sets/week) produced additional triceps growth that it did not produce for biceps or quadriceps in the same review — muscles superficially similar in size and joint role responded differently to the same volume increase. Separately, Kassiano's RCT found even sub-muscles of the same muscle group (medial vs. lateral gastrocnemius vs. soleus) responded differently to added calf-training volume.",
    limitations:
      "This is a synthesis across converging findings, not a single quoted consensus statement. Most dose-response research is concentrated in a handful of easily-imaged muscles (quads, biceps, triceps, chest, glutes, calves); back, shoulders, and hamstrings have measurable hypertrophy but no muscle-specific volume/frequency RCT; traps, forearms, and abs have essentially no resistance-training hypertrophy dose-response evidence in healthy lifters at all.",
  },
  "deload-overreaching-evidence": {
    id: "deload-overreaching-evidence",
    title: "Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations",
    authors: "(multiple sources; see limitations)",
    year: 2024,
    journal: "PeerJ / Scientific Reports (randomized within-subject and between-subject deload trials)",
    evidenceType: "randomized controlled trials",
    url: "https://peerj.com/articles/16777/",
    metrics: ["deload"],
    finding:
      "Controlled trials on planned one-week deloads in resistance-trained individuals have not shown them to be clearly necessary for continued progress, and separately, achieving a genuine overreaching or overtraining state from resistance training alone appears uncommon over the timeframes typical recreational lifters train, using ecologically realistic training protocols.",
    limitations:
      "A small number of controlled trials, mostly in younger/untrained-to-intermediate populations over short (8-9 week) programs; does not establish that deloads are harmful or unhelpful, only that the evidence for when one is physiologically necessary is limited. Not specific to Repvyn's plateau/fatigue/volume-ratio trigger combination.",
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

// Per-muscle evidence tiers. The app applies identical volume/frequency/priority
// logic to every tracked muscle; this table records where that's actually
// supported by muscle-specific dose-response research versus extrapolated.
// DIRECT: a muscle-specific volume or frequency dose-response study exists
//   (imaging outcome: ultrasound/MRI thickness or CSA).
// INDIRECT_MEASURABLE: hypertrophy is directly measurable for this muscle, but
//   no study varies weekly volume/frequency for it specifically — guidance is
//   borrowed from pooled, muscle-unstratified meta-analyses.
// INSUFFICIENT: no meaningful resistance-training hypertrophy dose-response
//   evidence for this muscle in healthy lifters (clinical/cross-sectional/EMG
//   literature only).
export const MUSCLE_EVIDENCE_TIERS = {
  DIRECT: "DIRECT",
  INDIRECT_MEASURABLE: "INDIRECT_MEASURABLE",
  INSUFFICIENT: "INSUFFICIENT",
};

export const MUSCLE_EVIDENCE_TIER_BY_MUSCLE = {
  Chest: MUSCLE_EVIDENCE_TIERS.DIRECT,
  Biceps: MUSCLE_EVIDENCE_TIERS.DIRECT,
  Triceps: MUSCLE_EVIDENCE_TIERS.DIRECT,
  Quads: MUSCLE_EVIDENCE_TIERS.DIRECT,
  Glutes: MUSCLE_EVIDENCE_TIERS.DIRECT,
  Calves: MUSCLE_EVIDENCE_TIERS.DIRECT,
  Shoulders: MUSCLE_EVIDENCE_TIERS.INDIRECT_MEASURABLE,
  Back: MUSCLE_EVIDENCE_TIERS.INDIRECT_MEASURABLE,
  Hamstrings: MUSCLE_EVIDENCE_TIERS.INDIRECT_MEASURABLE,
  Traps: MUSCLE_EVIDENCE_TIERS.INSUFFICIENT,
  Forearms: MUSCLE_EVIDENCE_TIERS.INSUFFICIENT,
  Abs: MUSCLE_EVIDENCE_TIERS.INSUFFICIENT,
};

export function getMuscleEvidenceTier(muscle) {
  return MUSCLE_EVIDENCE_TIER_BY_MUSCLE[muscle] || MUSCLE_EVIDENCE_TIERS.INSUFFICIENT;
}

const MUSCLE_TIER_QUALIFIER = {
  [MUSCLE_EVIDENCE_TIERS.DIRECT]: "",
  [MUSCLE_EVIDENCE_TIERS.INDIRECT_MEASURABLE]:
    " Evidence for this specific muscle is indirect — hypertrophy is measurable, but no study varies training volume/frequency for it specifically, so this borrows from pooled, muscle-unstratified research.",
  [MUSCLE_EVIDENCE_TIERS.INSUFFICIENT]:
    " Evidence is limited for this specific muscle; this insight is based on broader resistance-training research, not a study of this muscle.",
};

export function withMuscleEvidenceQualifier(baseDisclaimer, muscle) {
  return baseDisclaimer + (MUSCLE_TIER_QUALIFIER[getMuscleEvidenceTier(muscle)] || "");
}
