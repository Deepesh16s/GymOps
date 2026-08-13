const User = require("../models/User");

const MIN_LENGTH = 3;
const MAX_LENGTH = 20;
const GENERATED_BASE_LENGTH = 10;
const VALID_CHARS = /^[a-z0-9_]+$/;

// Single shared source of truth for username normalization/validation/
// generation/collision handling — used identically by registration, Google
// first-login, the existing-user migration path, and the change-username
// endpoint, so none of them can drift from one another.

function normalize(raw) {
  return String(raw || "").toLowerCase();
}

function stripInvalidChars(value) {
  return value.replace(/[^a-z0-9_]/g, "");
}

// Returns null if invalid rather than throwing — callers decide the HTTP
// response, this module stays framework-agnostic.
function validateFormat(username) {
  if (typeof username !== "string") return "Username is required";
  const value = normalize(username);
  if (value.length < MIN_LENGTH) return `Username must be at least ${MIN_LENGTH} characters`;
  if (value.length > MAX_LENGTH) return `Username must be at most ${MAX_LENGTH} characters`;
  if (!VALID_CHARS.test(value)) return "Username can only contain lowercase letters, numbers, and underscores";
  return null;
}

async function isAvailable(username, { excludeUserId } = {}) {
  const value = normalize(username);
  const query = { username: value };
  if (excludeUserId) query._id = { $ne: excludeUserId };
  const existing = await User.exists(query);
  return !existing;
}

// email local-part -> lowercase -> strip invalid chars -> first 10 chars.
// Falls back to a slice of the user's own (already-unique) ObjectId when the
// local-part normalizes to something too short — trivially unique, so it
// skips the collision loop entirely for that rare case.
function generateBaseUsername(email, fallbackSeed) {
  const localPart = String(email || "").split("@")[0] || "";
  const cleaned = stripInvalidChars(normalize(localPart));
  const base = cleaned.slice(0, GENERATED_BASE_LENGTH);

  if (base.length >= MIN_LENGTH) return base;

  const seed = String(fallbackSeed || "").slice(-6) || Date.now().toString().slice(-6);
  return `user${seed}`.slice(0, GENERATED_BASE_LENGTH);
}

// Resolves a base username to an available one by appending the smallest
// available numeric suffix. This loop is an optimization to avoid wasted
// write attempts — the actual uniqueness guarantee is the database's unique
// index, enforced by assignUsername()'s duplicate-key retry below.
async function resolveCollision(base) {
  if (await isAvailable(base)) return base;

  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base}${suffix}`.slice(0, MAX_LENGTH);
    if (await isAvailable(candidate)) return candidate;
    suffix += 1;
  }
}

// Assigns a generated username to a user document that doesn't have one yet.
// Safe to call repeatedly/concurrently: retries on a duplicate-key error
// (E11000) with the next suffix rather than trusting the availability check
// alone, which has an inherent race window between check and write.
async function assignGeneratedUsername(user) {
  if (user.username) return user; // already has one — never overwrite

  const base = generateBaseUsername(user.email, user._id);
  let candidate = await resolveCollision(base);
  let attempts = 0;

  while (attempts < 10) {
    try {
      user.username = candidate;
      user.usernameChosenByUser = false;
      await user.save();
      return user;
    } catch (error) {
      if (error.code !== 11000 && error.code !== "E11000") throw error;
      attempts += 1;
      candidate = `${base}${Date.now().toString().slice(-4)}${attempts}`.slice(0, MAX_LENGTH);
    }
  }

  throw new Error("Could not assign a username after multiple attempts");
}

module.exports = {
  MIN_LENGTH,
  MAX_LENGTH,
  normalize,
  validateFormat,
  isAvailable,
  generateBaseUsername,
  resolveCollision,
  assignGeneratedUsername,
};
