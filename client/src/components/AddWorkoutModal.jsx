import { useEffect, useState } from "react";
import Select from "react-select";
import "./AddWorkoutModal.css";
import api from "../services/api";
function AddWorkoutModal({ closeModal, onAddExercise }) {
  const [muscleGroup, setMuscleGroup] = useState("");
  const [exercises, setExercises] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customExercise, setCustomExercise] = useState({
    name: "",
    muscleGroup: "",
  });
  const [selectedExercise, setSelectedExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  const isWorkoutValid =
    selectedExercise !== "" &&
    weight !== "" &&
    reps !== "" &&
    !isNaN(Number(weight)) &&
    !isNaN(Number(reps)) &&
    Number(weight) >= 0 &&
    Number(reps) >= 1 &&
    Number.isInteger(Number(reps));

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

    if (weight === "" || reps === "") {
      setValidationMessage("Please fill in weight and reps");
      return;
    }

    if (isNaN(Number(weight)) || Number(weight) < 0) {
      setValidationMessage("Weight cannot be negative");
      return;
    }

    if (
      isNaN(Number(reps)) ||
      Number(reps) < 1 ||
      !Number.isInteger(Number(reps))
    ) {
      setValidationMessage("Reps must be a whole number of at least 1");
      return;
    }

    const exerciseObj = uniqueExercises.find(
      (ex) => ex._id === selectedExercise
    );

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
        weight: Number(weight),
        reps: Number(reps),
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

        <h2>Add Exercise</h2>

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

          <label>First Set</label>

          <div className="single-set-row">
            <input
              type="number"
              placeholder="Weight (kg)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              min="0"
              step="0.5"
              required
            />

            <input
              type="number"
              placeholder="Reps"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              min="1"
              step="1"
              required
            />
          </div>

          {validationMessage && (
            <p className="form-error">{validationMessage}</p>
          )}

          <button className="save-btn" type="submit" disabled={!isWorkoutValid}>
            Add Exercise
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddWorkoutModal;