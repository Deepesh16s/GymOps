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