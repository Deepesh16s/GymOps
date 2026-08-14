const multer = require("multer");

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
    cb(null, true);
  },
});

module.exports = function uploadProfilePicture(req, res, next) {
  upload.single("picture")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Image must be under 5MB" });
    }
    if (err.message === "UNSUPPORTED_FILE_TYPE") {
      return res.status(400).json({ message: "Image must be a JPEG, PNG, or WebP file" });
    }
    return res.status(400).json({ message: "Could not process the uploaded file" });
  });
};
