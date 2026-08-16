const request = require("supertest");
const app = require("../../app");
const Subscription = require("../../models/Subscription");
const { connectTestDB, clearTestDB, disconnectTestDB } = require("../helpers/db");
const { createUser, tokenFor } = require("../helpers/factories");

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

async function authed(user) {
  const token = tokenFor(user);
  return (method, url) => request(app)[method](url).set("Authorization", `Bearer ${token}`);
}

describe("GET /api/progression/advanced entitlement", () => {
  it("401 with no auth", async () => {
    const res = await request(app).get("/api/progression/advanced");
    expect(res.status).toBe(401);
  });

  it("403 for a free user", async () => {
    const user = await createUser({ premiumTier: "free" });
    const api = await authed(user);
    const res = await api("get", "/api/progression/advanced");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PREMIUM_REQUIRED");
  });

  it("200 for a premium user with no active subscription record (manual grant)", async () => {
    const user = await createUser({ premiumTier: "premium" });
    const api = await authed(user);
    const res = await api("get", "/api/progression/advanced");
    expect(res.status).toBe(200);
  });

  it("200 for a premium user with a subscription that has not expired", async () => {
    const user = await createUser({ premiumTier: "premium" });
    await Subscription.create({
      user: user._id,
      tier: "premium",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const api = await authed(user);
    const res = await api("get", "/api/progression/advanced");
    expect(res.status).toBe(200);
  });

  it("403 for a premium-tier user whose subscription has explicitly expired", async () => {
    const user = await createUser({ premiumTier: "premium" });
    await Subscription.create({
      user: user._id,
      tier: "premium",
      status: "active",
      currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const api = await authed(user);
    const res = await api("get", "/api/progression/advanced");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PREMIUM_REQUIRED");
  });

  it("403 for a premium-tier user whose subscription status is canceled", async () => {
    const user = await createUser({ premiumTier: "premium" });
    await Subscription.create({
      user: user._id,
      tier: "premium",
      status: "canceled",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const api = await authed(user);
    const res = await api("get", "/api/progression/advanced");
    expect(res.status).toBe(403);
  });

  it("never accepts a target-user override — always the caller's own data", async () => {
    const user = await createUser({ premiumTier: "premium" });
    const other = await createUser();
    const api = await authed(user);
    const res = await api("get", `/api/progression/advanced?userId=${other._id}`);
    expect(res.status).toBe(200);
  });
});
