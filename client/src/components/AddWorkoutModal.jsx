import { useEffect, useState } from "react";
import Select from "react-select";
import "./AddWorkoutModal.css";
import api from "../services/api";

// Dumb component: exercise picker + first-set form + validation only.
// It has no idea whether a workout session exists, no localStorage
// awareness, and makes no "save this workout" API call. It only fetches
// the exercise list / creates custom exercises, which is part of the
// picker itself, not the save workflow.
function AddWorkoutModal({ closeModal, onAddExercise }) {
  const [muscleGroup, setMuscleGroup] = useState("");
  const [exercises, setExercises] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customExercise, setCustomExercise] = useState({
    name: "",
    muscleGroup: "",
  });
  const [selectedExercise, setSelectedExercise] = useState("");
  const [workoutSets, setWorkoutSets] = useState([{ weight: "", reps: "" }]);
  const [validationMessage, setValidationMessage] = useState("");

  const isSetValid = (s) =>
    s.weight !== "" &&
    s.reps !== "" &&
    !isNaN(Number(s.weight)) &&
    !isNaN(Number(s.reps)) &&
    Number(s.weight) >= 0 &&
    Number(s.reps) >= 1 &&
    Number.isInteger(Number(s.reps));

  const isWorkoutValid =
    selectedExercise !== "" && workoutSets.every(isSetValid);

  useEffect(() => {
    fetchExercises();
  }, [muscleGroup]);

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  const fetchExercises = async () => {
    try {
      let url = "/exercises";
      if (muscleGroup) {
        url += `?muscleGroup=${muscleGroup}`;
      }
      const res = await api.get(url, getConfig());
      setExercises(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  const uniqueExercises = exercises.filter((exercise, index, arr) => {
    const key = exercise.name.trim().toLowerCase();
    return arr.findIndex((e) => e.name.trim().toLowerCase() === key) === index;
  });

  const handleCustomChange = (e) => {
    setCustomExercise({
      ...customExercise,
      [e.target.name]: e.target.value,
    });
  };

  const handleSetChange = (index, field, value) => {
    const updated = [...workoutSets];
    updated[index] = { ...updated[index], [field]: value };
    setWorkoutSets(updated);
  };

  const addSet = () => {
    setWorkoutSets([...workoutSets, { weight: "", reps: "" }]);
  };

  const removeSet = (index) => {
    if (workoutSets.length === 1) return;
    setWorkoutSets(workoutSets.filter((_, i) => i !== index));
  };

  const createCustomExercise = async () => {
    try {
      if (!customExercise.name || !customExercise.muscleGroup) {
        alert("Please fill all fields.");
        return;
      }

      const res = await api.post("/exercises", customExercise, getConfig());

      alert("Exercise Added Successfully!");
      setShowCustomForm(false);
      setCustomExercise({ name: "", muscleGroup: "" });

      await fetchExercises();
      setSelectedExercise(res.data._id);
    } catch (error) {
      console.log(error);
      alert(error.response?.data?.message || "Failed to add exercise");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    setValidationMessage("");

    if (!selectedExercise) {
      setValidationMessage("Please select an exercise");
      return;
    }

    const hasEmptySet = workoutSets.some(
      (s) => s.weight === "" || s.reps === ""
    );

    if (hasEmptySet) {
      setValidationMessage("Please fill in weight and reps for every set");
      return;
    }

    const hasNegativeWeight = workoutSets.some((s) => Number(s.weight) < 0);
    const hasInvalidReps = workoutSets.some(
      (s) => Number(s.reps) < 1 || !Number.isInteger(Number(s.reps))
    );

    if (hasNegativeWeight) {
      setValidationMessage("Weight cannot be negative");
      return;
    }

    if (hasInvalidReps) {
      setValidationMessage("Reps must be a whole number of at least 1");
      return;
    }

    const exerciseObj = uniqueExercises.find(
      (ex) => ex._id === selectedExercise
    );
    const firstSet = workoutSets[0];

    // Return data only. No branching on session state, no API call here —
    // that decision belongs to whoever opened this modal.
    onAddExercise({
      exercise: exerciseObj
        ? {
            _id: exerciseObj._id,
            name: exerciseObj.name,
            muscleGroup: exerciseObj.muscleGroup,
          }
        : { _id: selectedExercise },
      firstSet: {
        weight: Number(firstSet.weight),
        reps: Number(firstSet.reps),
      },
    });
  };

  // react-select theme: only non-color tokens go here (radius/spacing).
  // Colors are handled entirely by the go-select__* CSS classes so that
  // light/dark mode stays in sync with the rest of GymOps via [data-theme].
  const selectTheme = (theme) => ({
    ...theme,
    borderRadius: 12,
    spacing: {
      ...theme.spacing,
      controlHeight: 52,
      baseUnit: 4,
    },
  });

  // Only the portal wrapper needs an inline z-index (it renders on
  // document.body, outside the modal's stacking context).
  const selectStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 1200 }),
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <button className="close-btn" onClick={closeModal}>
          ✕
        </button>

        <h2>Add Workout</h2>

        <form onSubmit={handleSubmit}>
          <label>Muscle Group</label>

          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
          >
            <option value="">All Muscles</option>
            <option value="Chest">Chest</option>
            <option value="Back">Back</option>
            <option value="Shoulders">Shoulders</option>
            <option value="Biceps">Biceps</option>
            <option value="Triceps">Triceps</option>
            <option value="Legs">Legs</option>
            <option value="Hamstrings">Hamstrings</option>
            <option value="Abs">Abs</option>
          </select>

          <label>Exercise</label>

          <Select
            classNamePrefix="go-select"
            placeholder="Search Exercise..."
            isSearchable
            menuPosition="fixed"
            menuPortalTarget={document.body}
            menuShouldScrollIntoView={false}
            theme={selectTheme}
            styles={selectStyles}
            options={uniqueExercises.map((exercise) => ({
              value: exercise._id,
              label: exercise.name,
            }))}
            value={
              uniqueExercises
                .map((exercise) => ({
                  value: exercise._id,
                  label: exercise.name,
                }))
                .find((option) => option.value === selectedExercise) || null
            }
            onChange={(selected) => setSelectedExercise(selected?.value || "")}
          />

          <button
            type="button"
            className="custom-btn"
            onClick={() => setShowCustomForm(!showCustomForm)}
          >
            + Add Custom Exercise
          </button>

          {showCustomForm && (
            <div className="custom-form">
              <input
                type="text"
                name="name"
                placeholder="Exercise Name"
                value={customExercise.name}
                onChange={handleCustomChange}
              />

              <select
                name="muscleGroup"
                value={customExercise.muscleGroup}
                onChange={handleCustomChange}
              >
                <option value="">Select Muscle</option>
                <option value="Chest">Chest</option>
                <option value="Back">Back</option>
                <option value="Shoulders">Shoulders</option>
                <option value="Biceps">Biceps</option>
                <option value="Triceps">Triceps</option>
                <option value="Legs">Legs</option>
                <option value="Hamstrings">Hamstrings</option>
                <option value="Abs">Abs</option>
              </select>

              <button
                type="button"
                className="save-custom-btn"
                onClick={createCustomExercise}
              >
                Save Exercise
              </button>
            </div>
          )}

          <label>Sets</label>

          <div className="sets-list">
            {workoutSets.map((set, index) => (
              <div className="set-row" key={index}>
                <span className="set-row__index">{index + 1}</span>

                <input
                  type="number"
                  placeholder="Weight (kg)"
                  value={set.weight}
                  onChange={(e) => handleSetChange(index, "weight", e.target.value)}
                  min="0"
                  step="0.5"
                  required
                />

                <input
                  type="number"
                  placeholder="Reps"
                  value={set.reps}
                  onChange={(e) => handleSetChange(index, "reps", e.target.value)}
                  min="1"
                  step="1"
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

          <button type="button" className="add-set-btn" onClick={addSet}>
            + Add Set
          </button>

          {validationMessage && (
            <p className="form-error">{validationMessage}</p>
          )}

          <button className="save-btn" type="submit" disabled={!isWorkoutValid}>
            Save Workout
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddWorkoutModal;