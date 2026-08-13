const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Not authorized, no token",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = await User.findById(decoded.id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!req.user) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    next();
  } catch (error) {
    if (error.name !== "JsonWebTokenError" && error.name !== "TokenExpiredError") {
      console.error("Auth middleware error:", error);
    }
    res.status(401).json({
      message: "Not authorized",
    });
  }
};

// Same token decoding as protect(), but never rejects the request — used by
// otherwise-public routes (public profile) that behave slightly differently
// for an identified viewer (e.g. showing follow state) without requiring
// authentication to view at all.
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select(
        "-password -resetPasswordToken -resetPasswordExpires"
      );
    }
  } catch (error) {
    // Invalid/expired token on an optional-auth route — proceed unauthenticated.
  }

  next();
};