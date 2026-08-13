const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        default: null
    },
    googleId: {
        type: String,
        default: null
    },
    // Public, mutable handle — resolved to _id for discovery/display only,
    // never stored as a foreign key anywhere else. _id remains the permanent
    // identity for every relationship (Follow, Block, and future models).
    username: {
        type: String,
        unique: true,
        sparse: true,
        minlength: 3,
        maxlength: 20,
        match: /^[a-z0-9_]+$/,
        default: undefined,
    },
    usernameChosenByUser: {
        type: Boolean,
        default: false
    },
    usernamePromptDismissedAt: {
        type: Date,
        default: null
    },
    picture: {
        type: String,
        default: ""
    },
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    }
}, { timestamps: true });
module.exports = mongoose.model("User", userSchema);