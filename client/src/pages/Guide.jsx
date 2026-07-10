import { useState } from "react";
import {
  ChevronDown,
  Dumbbell,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Target,
} from "lucide-react";
import { ExerciseIllustration } from "../components/ExerciseIllustrations";
import "../components/ExerciseIllustrations.css";
import "./Guide.css";

const SPLITS = [
  {
    id: "ppl",
    name: "Push / Pull / Legs (PPL)",
    tagline: "Rotate by movement pattern, not body part",
    structure:
      "Push (chest, shoulders, triceps) → Pull (back, biceps) → Legs (quads, hamstrings, glutes, calves), repeated.",
    frequencyOptions: [
      { days: "3 days/week", detail: "1x PPL cycle — each muscle trained once per week." },
      { days: "6 days/week", detail: "2x PPL cycle — each muscle trained twice per week." },
    ],
    pros: [
      "Scales cleanly from 3 to 6 training days without changing the logic of the split",
      "Balanced volume distribution — no muscle group is neglected",
      "The 6-day version trains each muscle roughly twice per week, which often makes it easier to distribute weekly volume and maintain exercise quality",
      "Very well documented; easy to find programs and progression schemes",
    ],
    cons: [
      "The 3-day version trains each muscle once a week — this can still build muscle effectively, but usually requires each session to carry more weekly volume",
      "The 6-day version is demanding — hard to sustain with a busy schedule or poor recovery",
      "Longer sessions on leg day since quads, hamstrings, glutes, and calves are all stacked together",
    ],
    suitability:
      "Best if you can train 5–6 days/week. If you're capped at 3 days/week, PPL can still work well — Upper/Lower or Full Body are also worth considering since they let you revisit each muscle sooner in the week.",
  },
  {
    id: "ul",
    name: "Upper / Lower",
    tagline: "The efficiency pick — near-optimal frequency in 4 days",
    structure:
      "Alternates Upper body day (chest, back, shoulders, arms) and Lower body day (quads, hamstrings, glutes, calves).",
    frequencyOptions: [
      { days: "4 days/week", detail: "Standard version — 2x Upper, 2x Lower per week." },
      { days: "3 days/week", detail: "Alternating U/L/U one week, L/U/L the next — slightly uneven but still solid." },
    ],
    pros: [
      "Trains each muscle roughly twice a week in just 4 sessions, which often makes it easier to fit in sufficient weekly volume with good exercise quality",
      "Easier to recover from than a 6-day PPL since you get more rest days",
      "Efficient: less time in the gym for a similar training effect",
    ],
    cons: [
      "Sessions run longer since you're covering half the body at once",
      "Less exercise variety per muscle per session compared to a dedicated body-part day",
      "Fatigue from earlier exercises can slightly limit performance on later ones in the same session",
    ],
    suitability:
      "Best if you can commit to 4 days/week. Often considered one of the most efficient splits for intermediate lifters in terms of results per session.",
  },
  {
    id: "full-body",
    name: "Full Body",
    tagline: "Maximum frequency, minimum days",
    structure:
      "Every session trains all major muscle groups (squat/hinge pattern, push, pull) with 1–2 exercises per group.",
    frequencyOptions: [
      { days: "3 days/week", detail: "Standard version — every muscle trained 3x per week." },
      { days: "2 days/week", detail: "Minimalist version — still 2x/week frequency, better than most 1x splits." },
    ],
    pros: [
      "Highest realistic training frequency — each muscle gets 3 touches a week",
      "Great for beginners: more frequent practice on compound lifts speeds up technique learning",
      "Flexible — missing one session in the week still leaves decent weekly frequency",
      "Efficient for people with genuinely limited days (2–3/week)",
    ],
    cons: [
      "Sessions can get long if you try to fit enough volume per muscle in one sitting",
      "Harder to accumulate high volume per muscle group without excessive fatigue",
      "Less exercise variety per body part per session",
    ],
    suitability:
      "Best if you only have 2–3 days/week available, or you're a beginner still building movement skill.",
  },
  {
    id: "bro-split",
    name: "Bro Split (Body-Part Split)",
    tagline: "One muscle, one day, maximum volume",
    structure:
      "Dedicates a full day to a single muscle group — e.g. Chest / Back / Shoulders / Arms / Legs across 5 days.",
    frequencyOptions: [
      { days: "5 days/week", detail: "Each muscle trained once per week, with all its weekly volume in one session." },
    ],
    pros: [
      "Bro splits absolutely can build muscle — allocating a full session to one muscle group lets you use a large amount of volume and exercise variety",
      "Simple to plan and mentally satisfying — you know exactly what you're training each day",
      "Good if you enjoy longer, focused sessions on one area at a time",
    ],
    cons: [
      "Trains each muscle only once a week — this requires all of that muscle's weekly volume to be fit into a single session, which can mean a lot of fatigue by the end",
      "Many lifters find it easier to maintain exercise quality by spreading the same weekly volume across two sessions instead of one",
      "If you miss one day, that muscle group doesn't get trained again for a full week",
    ],
    suitability:
      "Bro splits can absolutely build muscle — many natural lifters do very well on this structure. Works well if you can train 5–6 days/week and enjoy longer, focused sessions on one area at a time. If you'd rather spread the same weekly volume over two sessions per muscle, Upper/Lower or PPL are worth trying too.",
  },
];

const EXERCISES = [
  {
    id: "squat",
    name: "Back Squat",
    pattern: "Squat (knee-dominant)",
    muscles: "Quads, glutes, adductors, spinal erectors",
    cues: [
      "Set the bar on your traps (high-bar) or rear delts (low-bar) — not your neck",
      "Brace before initiating the lift, and keep a neutral spine throughout",
      "Sit back and down, letting your knees travel naturally over your toes",
      "Descend to at least parallel (hip crease level with or below the knee)",
      "Keep the bar balanced over your mid-foot throughout the lift",
    ],
    mistakes: [
      "Knees caving inward under load (valgus collapse)",
      "Excessive rounding of the lower back at the bottom of the rep",
      "Bar drifting forward off the mid-foot, increasing strain on the lower back",
    ],
    science:
      "Mechanical tension is the primary driver of hypertrophy, and training through a comfortable full range of motion — like squatting to at least parallel — often improves tension at longer muscle lengths for the quads and glutes.",
  },
  {
    id: "bench",
    name: "Bench Press",
    pattern: "Horizontal push",
    muscles: "Chest (pectoralis major), front delts, triceps",
    cues: [
      "Plant your feet firmly and retract your shoulder blades before unracking",
      "Set a small, natural upper-back arch — not exaggerated",
      "Keep wrists stacked over your forearms, forearms vertical at the bottom",
      "Lower the bar under control to your lower chest/sternum",
      "Keep elbows at roughly 45–70° from your torso, not flared to 90°",
    ],
    mistakes: [
      "Elbows flaring out toward 90°, which stresses the shoulder joint",
      "Wrists bending back instead of staying stacked over the forearms",
      "Losing scapular retraction mid-set",
    ],
    science:
      "Mechanical tension is the main driver of growth here, and controlling the eccentric (lowering) phase helps maintain tension through a comfortable full range of motion rather than relying on momentum.",
  },
  {
    id: "deadlift",
    name: "Deadlift",
    pattern: "Hip hinge",
    muscles: "Hamstrings, glutes, spinal erectors, lats, traps",
    cues: [
      "Bar over mid-foot before you pull, close enough to touch your shins",
      "Hinge at the hips with shoulders slightly in front of the bar",
      "Keep a neutral spine and brace before initiating the lift",
      "Keep the bar close to your legs throughout the pull",
      "Finish by squeezing the glutes, not by hyperextending the lower back",
    ],
    mistakes: [
      "Rounding the lower back under load",
      "Letting the bar drift away from the body, increasing strain",
      "Hyperextending at lockout instead of finishing with the glutes",
    ],
    science:
      "The deadlift loads the posterior chain through a hip-hinge pattern. Keeping the bar close and maintaining a neutral spine helps preserve mechanical tension on the hamstrings and glutes through a comfortable full range of motion.",
  },
  {
    id: "ohp",
    name: "Overhead Press",
    pattern: "Vertical push",
    muscles: "Front and side delts, triceps, upper chest (minor)",
    cues: [
      "Brace before initiating the press, and keep ribs down to avoid excess arch",
      "Start with the bar just above the collarbone, forearms vertical",
      "Move your head back slightly then through as the bar passes your face",
      "Finish with the bar over your mid-foot and a comfortable full lockout overhead",
    ],
    mistakes: [
      "Excessive lower-back extension to compensate for limited shoulder mobility",
      "Pressing the bar in front of the body instead of in a straight vertical path",
      "Not finishing with the bar balanced over the mid-foot",
    ],
    science:
      "Pressing through a comfortable full range of motion, including full elbow extension at the top, helps maintain mechanical tension on the delts and triceps through the whole movement.",
  },
  {
    id: "row",
    name: "Barbell Row",
    pattern: "Horizontal pull",
    muscles: "Lats, rhomboids, mid-traps, rear delts, biceps",
    cues: [
      "Hinge at the hips into a stable position with a neutral spine",
      "Torso angle can vary — find a stable hinge that lets you keep your back flat",
      "Pull the bar toward your lower ribs / upper abdomen",
      "Lower under control rather than letting the bar drop",
    ],
    mistakes: [
      "Standing too upright, which shifts the work toward rear delts instead of lats",
      "Rounding the back instead of maintaining a neutral spine",
      "Using excessive momentum instead of a controlled pull",
    ],
    science:
      "Rowing movements are one of the main tools for back width and thickness. Maintaining a neutral spine and controlling the eccentric helps keep mechanical tension on the target muscles through the full range of motion.",
  },
  {
    id: "pullup",
    name: "Pull-Up",
    pattern: "Vertical pull",
    muscles: "Lats, biceps, rear delts, mid-back",
    cues: [
      "Start from a full dead hang to use the whole range of motion",
      "Depress and engage your shoulder blades before bending the elbows",
      "Pull until your chin clears the bar",
      "Control the eccentric back to a dead hang rather than dropping",
    ],
    mistakes: [
      "Using only the top half of the range of motion (partial reps)",
      "Kipping or swinging to generate momentum",
      "Shrugging the shoulders up toward the ears instead of depressing them",
    ],
    science:
      "Starting from a dead hang trains the lats through a longer muscle length, and controlling the eccentric helps maintain mechanical tension through the full range of motion.",
  },
];

function Guide() {
  const [tab, setTab] = useState("splits");
  const [openSplit, setOpenSplit] = useState("ppl");
  const [openExercise, setOpenExercise] = useState("squat");

  return (
    <div className="guide-page">
      <div className="guide-header">
        <div className="guide-header-icon">
          <BookOpen size={26} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="guide-title">Workout Guide</h1>
          <p className="guide-subtitle">
            Understand your training split and how to perform key lifts with proper, science-backed technique.
          </p>
        </div>
      </div>

      <div className="guide-tabs">
        <button
          className={`guide-tab ${tab === "splits" ? "guide-tab-active" : ""}`}
          onClick={() => setTab("splits")}
        >
          <Calendar size={16} strokeWidth={1.8} />
          Split Guidance
        </button>
        <button
          className={`guide-tab ${tab === "exercises" ? "guide-tab-active" : ""}`}
          onClick={() => setTab("exercises")}
        >
          <Dumbbell size={16} strokeWidth={1.8} />
          Exercise Guidance
        </button>
      </div>

      {tab === "splits" && (
        <div className="guide-list">
          <div className="guide-callout">
            <span className="guide-callout-strong">Rule of thumb:</span> progressive overload,
            sufficient weekly volume, training with good effort, and adequate recovery are the main
            drivers of muscle growth. Training each muscle roughly twice a week often makes it easier
            to fit in enough quality volume, but every split below can work well — pick the one that
            fits the days you can actually train, since consistency matters more than the split itself.
          </div>

          {SPLITS.map((split) => {
            const isOpen = openSplit === split.id;
            return (
              <div
                key={split.id}
                className={`guide-card ${isOpen ? "guide-card-open" : ""}`}
              >
                <button
                  className="guide-card-header"
                  onClick={() => setOpenSplit(isOpen ? null : split.id)}
                >
                  <div>
                    <h3 className="guide-card-title">{split.name}</h3>
                    <p className="guide-card-tagline">{split.tagline}</p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`guide-chevron ${isOpen ? "guide-chevron-open" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="guide-card-body">
                    <p className="guide-structure">{split.structure}</p>

                    <div className="guide-section">
                      <div className="guide-section-label">
                        <Calendar size={13} strokeWidth={1.8} />
                        Frequency options
                      </div>
                      {split.frequencyOptions.map((f, i) => (
                        <div key={i} className="guide-freq-row">
                          <span className="guide-freq-days">{f.days}</span>
                          <span className="guide-freq-detail">— {f.detail}</span>
                        </div>
                      ))}
                    </div>

                    <div className="guide-two-col">
                      <div className="guide-section">
                        <div className="guide-section-label guide-label-good">
                          <CheckCircle2 size={13} strokeWidth={1.8} />
                          Pros
                        </div>
                        <ul className="guide-ul">
                          {split.pros.map((p, i) => (
                            <li key={i} className="guide-li-good">{p}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="guide-section">
                        <div className="guide-section-label guide-label-warn">
                          <AlertTriangle size={13} strokeWidth={1.8} />
                          Cons
                        </div>
                        <ul className="guide-ul">
                          {split.cons.map((c, i) => (
                            <li key={i} className="guide-li-warn">{c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="guide-suitability">
                      <div className="guide-section-label guide-label-good">
                        <Target size={13} strokeWidth={1.8} />
                        Best for
                      </div>
                      <p>{split.suitability}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "exercises" && (
        <div className="guide-list">
          <div className="guide-callout">
            <span className="guide-callout-strong">Why form matters:</span> mechanical tension is
            the primary driver of muscle hypertrophy. Progressive overload, sufficient weekly volume,
            training with good effort, and adequate recovery are the major determinants of growth.
            Training through a full, comfortable range of motion often improves tension at longer
            muscle lengths — usually the biggest lever you control on every single rep.
          </div>

          {EXERCISES.map((ex) => {
            const isOpen = openExercise === ex.id;
            return (
              <div
                key={ex.id}
                className={`guide-card ${isOpen ? "guide-card-open" : ""}`}
              >
                <button
                  className="guide-card-header"
                  onClick={() => setOpenExercise(isOpen ? null : ex.id)}
                >
                  <div>
                    <h3 className="guide-card-title">{ex.name}</h3>
                    <p className="guide-card-tagline">
                      {ex.pattern} · {ex.muscles}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`guide-chevron ${isOpen ? "guide-chevron-open" : ""}`}
                  />
                </button>

                {isOpen && <ExerciseIllustration exercise={ex} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Guide;