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

  const [formData, setFormData] =
    useState({
      exercise: "",
      sets: "",
      reps: "",
      weight: "",
    });

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value,
    });
  };

  const handleCustomChange = (
    e
  ) => {
    setCustomExercise({
      ...customExercise,
      [e.target.name]:
        e.target.value,
    });
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

        setFormData({
          ...formData,
          exercise: res.data._id,
        });
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

      try {
        await api.post(
          "/workouts",
          {
            exercise:
              formData.exercise,
            sets: Number(
              formData.sets
            ),
            reps: Number(
              formData.reps
            ),
            weight: Number(
              formData.weight
            ),
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
            options={exercises.map(
              (exercise) => ({
                value:
                  exercise._id,
                label:
                  exercise.name,
              })
            )}
            value={
              exercises
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
                    formData.exercise
                ) || null
            }
            onChange={(
              selected
            ) =>
              setFormData({
                ...formData,
                exercise:
                  selected?.value ||
                  "",
              })
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

          <label>
            Sets
          </label>

          <input
            type="number"
            name="sets"
            value={
              formData.sets
            }
            onChange={
              handleChange
            }
            required
          />

          <label>
            Reps
          </label>

          <input
            type="number"
            name="reps"
            value={
              formData.reps
            }
            onChange={
              handleChange
            }
            required
          />

          <label>
            Weight (kg)
          </label>

          <input
            type="number"
            name="weight"
            value={
              formData.weight
            }
            onChange={
              handleChange
            }
            required
          />

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