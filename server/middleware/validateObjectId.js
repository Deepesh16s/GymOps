const mongoose = require("mongoose");

module.exports = function validateObjectId(paramName = "id") {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    next();
  };
};
