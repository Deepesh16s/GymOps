const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const { connectTestDB, clearTestDB, disconnectTestDB } = require("../helpers/db");
const { createUser, tokenFor } = require("../helpers/factories");

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

describe("POST /api/auth/register", () => {
  it("creates a user and seeds their default exercises", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "New User",
      email: "newuser@test.local",
      password: "Test1234!",
      username: "new_user",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("newuser@test.local");

    const stored = await User.findOne({ email: "newuser@test.local" });
    expect(stored).not.toBeNull();
    expect(stored.username).toBe("new_user");
  });

  it("rejects a duplicate email", async () => {
    await createUser({ email: "dupe@test.local" });
    const res = await request(app).post("/api/auth/register").send({
      name: "Dupe",
      email: "dupe@test.local",
      password: "Test1234!",
      username: "dupe_user",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a short password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Short",
      email: "short@test.local",
      password: "abc",
      username: "shortpw",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed username", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Bad",
      email: "bad@test.local",
      password: "Test1234!",
      username: "Not Valid!",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User",
      email: "login@test.local",
      password: "Test1234!",
      username: "login_user",
    });
    const res = await request(app).post("/api/auth/login").send({
      email: "login@test.local",
      password: "Test1234!",
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects an incorrect password", async () => {
    await createUser({ email: "wrongpw@test.local" });
    const res = await request(app).post("/api/auth/login").send({
      email: "wrongpw@test.local",
      password: "totally-wrong",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a nonexistent email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@test.local",
      password: "Test1234!",
    });
    expect(res.status).toBe(400);
  });
});

describe("protect middleware (authorization)", () => {
  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/goals");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed/invalid token", async () => {
    const res = await request(app).get("/api/goals").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("accepts a valid token", async () => {
    const user = await createUser();
    const res = await request(app).get("/api/goals").set("Authorization", `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
  });

  it("rejects a token for a user that no longer exists", async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await User.deleteOne({ _id: user._id });
    const res = await request(app).get("/api/goals").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
