const request = require("supertest");
const app = require("../../app");
const Workout = require("../../models/workout");
const { connectTestDB, clearTestDB, disconnectTestDB } = require("../helpers/db");
const { createUser, tokenFor, seedExercisesFor } = require("../helpers/factories");

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

async function authed(user) {
  const token = tokenFor(user);
  return (method, url) => request(app)[method](url).set("Authorization", `Bearer ${token}`);
}

describe("POST /api/workouts/session", () => {
  it("logs a strength session and persists it", async () => {
    const user = await createUser();
    const [exercise] = await seedExercisesFor(user, { count: 1 });
    const api = await authed(user);

    const res = await api("post", "/api/workouts/session").send({
      sessionId: "session-1",
      sessionDuration: 30,
      sessionType: "Push",
      exercises: [{ exercise: exercise._id, workoutSets: [{ weight: 40, reps: 8 }] }],
    });

    expect(res.status).toBe(201);
    const stored = await Workout.find({ user: user._id });
    expect(stored).toHaveLength(1);
    expect(stored[0].sessionId).toBe("session-1");
  });

  it("rejects an empty exercises array", async () => {
    const user = await createUser();
    const api = await authed(user);
    const res = await api("post", "/api/workouts/session").send({
      sessionId: "session-2",
      sessionDuration: 30,
      sessionType: "Push",
      exercises: [],
    });
    expect(res.status).toBe(400);
  });

  it("rejects an exercise the user does not own", async () => {
    const owner = await createUser();
    const [ownerExercise] = await seedExercisesFor(owner, { count: 1 });
    const other = await createUser();
    const api = await authed(other);

    const res = await api("post", "/api/workouts/session").send({
      sessionId: "session-3",
      sessionDuration: 30,
      sessionType: "Push",
      exercises: [{ exercise: ownerExercise._id, workoutSets: [{ weight: 40, reps: 8 }] }],
    });
    expect(res.status).toBe(400);
  });

  it("rejects a missing sessionDuration", async () => {
    const user = await createUser();
    const [exercise] = await seedExercisesFor(user, { count: 1 });
    const api = await authed(user);
    const res = await api("post", "/api/workouts/session").send({
      sessionId: "session-4",
      sessionType: "Push",
      exercises: [{ exercise: exercise._id, workoutSets: [{ weight: 40, reps: 8 }] }],
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/workouts", () => {
  it("only returns the authenticated user's workouts", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const [exA] = await seedExercisesFor(userA, { count: 1 });
    const [exB] = await seedExercisesFor(userB, { count: 1 });

    await Workout.create({
      user: userA._id,
      exercise: exA._id,
      workoutSets: [{ weight: 10, reps: 10 }],
      sessionId: "a-1",
    });
    await Workout.create({
      user: userB._id,
      exercise: exB._id,
      workoutSets: [{ weight: 20, reps: 5 }],
      sessionId: "b-1",
    });

    const api = await authed(userA);
    const res = await api("get", "/api/workouts");
    expect(res.status).toBe(200);
    expect(res.body.every((w) => w.user === String(userA._id))).toBe(true);
    expect(res.body.some((w) => w.sessionId === "b-1")).toBe(false);
  });
});
