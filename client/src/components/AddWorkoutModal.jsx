import { useEffect, useState } from "react";
import Select from "react-select";
import "./AddWorkoutModal.css";
import api from "../services/api";

function AddWorkoutModal({
  closeModal,
  fetchDashboardData,
}) {
  const [muscleGroup, setMuscleGroup] =
    useState("");

  const [exercises, setExercises] =
    useState([]);

  const [showCustomForm, setShowCustomForm] =
    useState(false);

  const [customExercise, setCustomExercise] =
    useState({
      name: "",
      muscleGroup: "",
    });

  const [selectedExercise, setSelectedExercise] =
    useState("");

  // per-set rows — start with one empty set so the form
  // isn't blank on open
  const [workoutSets, setWorkoutSets] =
    useState([{ weight: "", reps: "" }]);

  useEffect(() => {
    fetchExercises();
  }, [muscleGroup]);

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem(
        "token"
      )}`,
    },
  });

  const fetchExercises = async () => {
    try {
      let url = "/exercises";

      if (muscleGroup) {
        url += `?muscleGroup=${muscleGroup}`;
      }

      const res = await api.get(
        url,
        getConfig()
      );

      setExercises(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  // ── dedupe by normalized (trimmed, lowercase) name — a defensive
  // safety net on top of the backend dedupe, so the dropdown never
  // shows the same exercise name twice ──
  const uniqueExercises = exercises.filter((exercise, index, arr) => {
    const key = exercise.name.trim().toLowerCase();
    return (
      arr.findIndex((e) => e.name.trim().toLowerCase() === key) === index
    );
  });

  const handleCustomChange = (
    e
  ) => {
    setCustomExercise({
      ...customExercise,
      [e.target.name]:
        e.target.value,
    });
  };

  // update a single set's weight or reps without touching the rest
  const handleSetChange = (index, field, value) => {
    const updated = [...workoutSets];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setWorkoutSets(updated);
  };

  const addSet = () => {
    // new set starts empty — could also copy the last set's
    // weight as a convenience, keeping it simple for now
    setWorkoutSets([
      ...workoutSets,
      { weight: "", reps: "" },
    ]);
  };

  const removeSet = (index) => {
    // always keep at least one set row on screen
    if (workoutSets.length === 1) return;
    setWorkoutSets(
      workoutSets.filter((_, i) => i !== index)
    );
  };

  const createCustomExercise =
    async () => {
      try {
        if (
          !customExercise.name ||
          !customExercise.muscleGroup
        ) {
          alert(
            "Please fill all fields."
          );
          return;
        }

        const res =
          await api.post(
            "/exercises",
            customExercise,
            getConfig()
          );

        alert(
          "Exercise Added Successfully!"
        );

        setShowCustomForm(false);

        setCustomExercise({
          name: "",
          muscleGroup: "",
        });

        await fetchExercises();

        setSelectedExercise(res.data._id);
      } catch (error) {
        console.log(error);

        alert(
          error.response?.data
            ?.message ||
            "Failed to add exercise"
        );
      }
    };

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      // basic guard — every set needs both fields filled in
      // before we bother hitting the API
      const hasEmptySet = workoutSets.some(
        (s) => s.weight === "" || s.reps === ""
      );

      if (!selectedExercise) {
        alert("Please select an exercise");
        return;
      }

      if (hasEmptySet) {
        alert("Please fill in weight and reps for every set");
        return;
      }

      try {
        await api.post(
          "/workouts",
          {
            exercise: selectedExercise,
            workoutSets: workoutSets.map((s) => ({
              weight: Number(s.weight),
              reps: Number(s.reps),
            })),
          },
          getConfig()
        );

        alert(
          "Workout Added Successfully!"
        );

        await fetchDashboardData();

        closeModal();
      } catch (error) {
        console.log(error);

        alert(
          "Failed To Add Workout"
        );
      }
    };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <button
          className="close-btn"
          onClick={closeModal}
        >
          ✕
        </button>

        <h2>Add Workout</h2>

        <form
          onSubmit={handleSubmit}
        >
          <label>
            Muscle Group
          </label>

          <select
            value={muscleGroup}
            onChange={(e) =>
              setMuscleGroup(
                e.target.value
              )
            }
          >
            <option value="">
              All Muscles
            </option>
            <option value="Chest">
              Chest
            </option>
            <option value="Back">
              Back
            </option>
            <option value="Shoulders">
              Shoulders
            </option>
            <option value="Biceps">
              Biceps
            </option>
            <option value="Triceps">
              Triceps
            </option>
            <option value="Legs">
              Legs
            </option>
            <option value="Hamstrings">
              Hamstrings
            </option>
            <option value="Abs">
              Abs
            </option>
          </select>

          <label>
            Exercise
          </label>

          <Select
            placeholder="Search Exercise..."
            isSearchable
            options={uniqueExercises.map(
              (exercise) => ({
                value:
                  exercise._id,
                label:
                  exercise.name,
              })
            )}
            value={
              uniqueExercises
                .map(
                  (exercise) => ({
                    value:
                      exercise._id,
                    label:
                      exercise.name,
                  })
                )
                .find(
                  (option) =>
                    option.value ===
                    selectedExercise
                ) || null
            }
            onChange={(
              selected
            ) =>
              setSelectedExercise(
                selected?.value ||
                  ""
              )
            }
          />

          <button
            type="button"
            className="custom-btn"
            onClick={() =>
              setShowCustomForm(
                !showCustomForm
              )
            }
          >
            + Add Custom Exercise
          </button>

          {showCustomForm && (
            <div className="custom-form">
              <input
                type="text"
                name="name"
                placeholder="Exercise Name"
                value={
                  customExercise.name
                }
                onChange={
                  handleCustomChange
                }
              />

              <select
                name="muscleGroup"
                value={
                  customExercise.muscleGroup
                }
                onChange={
                  handleCustomChange
                }
              >
                <option value="">
                  Select Muscle
                </option>

                <option value="Chest">
                  Chest
                </option>

                <option value="Back">
                  Back
                </option>

                <option value="Shoulders">
                  Shoulders
                </option>

                <option value="Biceps">
                  Biceps
                </option>

                <option value="Triceps">
                  Triceps
                </option>

                <option value="Legs">
                  Legs
                </option>

                <option value="Hamstrings">
                  Hamstrings
                </option>

                <option value="Abs">
                  Abs
                </option>
              </select>

              <button
                type="button"
                className="save-custom-btn"
                onClick={
                  createCustomExercise
                }
              >
                Save Exercise
              </button>
            </div>
          )}

          {/* ── per-set rows ── */}
          <label>Sets</label>

          <div className="sets-list">
            {workoutSets.map((set, index) => (
              <div className="set-row" key={index}>
                <span className="set-row__index">{index + 1}</span>

                <input
                  type="number"
                  placeholder="Weight (kg)"
                  value={set.weight}
                  onChange={(e) =>
                    handleSetChange(index, "weight", e.target.value)
                  }
                  required
                />

                <input
                  type="number"
                  placeholder="Reps"
                  value={set.reps}
                  onChange={(e) =>
                    handleSetChange(index, "reps", e.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="remove-set-btn"
                  onClick={() => removeSet(index)}
                  disabled={workoutSets.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-set-btn"
            onClick={addSet}
          >
            + Add Set
          </button>

          <button
            className="save-btn"
            type="submit"
          >
            Save Workout
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddWorkoutModal;