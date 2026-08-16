const request = require("supertest");
const app = require("../../app");
const PhysiquePost = require("../../models/PhysiquePost");
const { connectTestDB, clearTestDB, disconnectTestDB } = require("../helpers/db");
const { createUser, tokenFor } = require("../helpers/factories");

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(disconnectTestDB);

async function authed(user) {
  const token = tokenFor(user);
  return (method, url) => request(app)[method](url).set("Authorization", `Bearer ${token}`);
}

describe("Follow / privacy / block enforcement", () => {
  it("a private account requires a follow request, not an instant follow", async () => {
    const target = await createUser({ profileVisibility: "private" });
    const follower = await createUser();
    const api = await authed(follower);

    const res = await api("post", `/api/users/${target.username}/follow`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("requested");
  });

  it("a public account is followed instantly", async () => {
    const target = await createUser({ profileVisibility: "public" });
    const follower = await createUser();
    const api = await authed(follower);

    const res = await api("post", `/api/users/${target.username}/follow`);
    expect(res.status).toBe(200);
    expect(res.body.status).not.toBe("requested");
  });

  it("heatmap is not visible to a non-follower of a private account", async () => {
    const target = await createUser({ profileVisibility: "private" });
    const viewer = await createUser();
    const api = await authed(viewer);
    const res = await api("get", `/api/users/${target.username}/heatmap`);
    expect(res.status).toBe(403);
  });

  it("block prevents a new follow", async () => {
    const target = await createUser({ profileVisibility: "public" });
    const blocked = await createUser();

    const targetApi = await authed(target);
    await targetApi("post", `/api/users/${blocked.username}/block`);

    const blockedApi = await authed(blocked);
    const res = await blockedApi("post", `/api/users/${target.username}/follow`);
    expect(res.status).toBe(403);
  });

  it("unblock restores the ability to follow", async () => {
    const target = await createUser({ profileVisibility: "public" });
    const other = await createUser();

    const targetApi = await authed(target);
    await targetApi("post", `/api/users/${other.username}/block`);
    await targetApi("delete", `/api/users/${other.username}/block`);

    const otherApi = await authed(other);
    const res = await otherApi("post", `/api/users/${target.username}/follow`);
    expect(res.status).toBe(200);
  });
});

describe("Activity feed", () => {
  it("returns a paginated shape", async () => {
    const user = await createUser();
    const api = await authed(user);
    const res = await api("get", "/api/activity");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("activities");
    expect(res.body).toHaveProperty("nextCursor");
    expect(res.body).toHaveProperty("hasMore");
    expect(Array.isArray(res.body.activities)).toBe(true);
  });
});

describe("Reactions", () => {
  it("lets a permitted viewer react to a public physique post, once per user", async () => {
    const owner = await createUser({ profileVisibility: "public" });
    const post = await PhysiquePost.create({
      user: owner._id,
      imageUrl: "https://example.test/x.png",
      imageAssetId: "x-asset",
      visibility: "public",
    });

    const reactor = await createUser();
    const api = await authed(reactor);

    const first = await api("post", `/api/physique/${post._id}/reactions`).send({ type: "fire" });
    expect(first.status).toBe(200);

    const second = await api("post", `/api/physique/${post._id}/reactions`).send({ type: "heart" });
    expect(second.status).toBe(200);

    const Reaction = require("../../models/Reaction");
    const count = await Reaction.countDocuments({ targetType: "physiquePost", targetId: post._id, user: reactor._id });
    expect(count).toBe(1);
  });

  it("rejects an unknown reaction type", async () => {
    const owner = await createUser({ profileVisibility: "public" });
    const post = await PhysiquePost.create({
      user: owner._id,
      imageUrl: "https://example.test/y.png",
      imageAssetId: "y-asset",
      visibility: "public",
    });
    const reactor = await createUser();
    const api = await authed(reactor);
    const res = await api("post", `/api/physique/${post._id}/reactions`).send({ type: "not-a-real-type" });
    expect(res.status).toBe(400);
  });
});
