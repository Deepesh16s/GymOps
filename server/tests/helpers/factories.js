const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const Exercise = require("../../models/Exercise");
const defaultExercises = require("../../data/defaultExercises");

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

async function createUser(overrides = {}) {
  const hashed = await bcrypt.hash("Test1234!", 4);
  const user = await User.create({
    name: overrides.name || "Test User",
    email: overrides.email || `${unique("user")}@test.local`,
    username: overrides.username || unique("user"),
    password: hashed,
    usernameChosenByUser: true,
    premiumTier: overrides.premiumTier || "free",
    profileVisibility: overrides.profileVisibility || "private",
    ...overrides,
  });
  return user;
}

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

async function seedExercisesFor(user, { count = 3 } = {}) {
  const docs = defaultExercises.slice(0, count).map((e) => ({ ...e, createdBy: user._id, isDefault: true }));
  return Exercise.insertMany(docs);
}

module.exports = { createUser, tokenFor, seedExercisesFor, unique };
