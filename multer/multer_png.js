const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

const generateUniqueFilename = (filename) => {
  const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
  return filename.split("-")[0] + "-" + uniqueSuffix + ".png";
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "uploads");
    try {
      await fs.access(uploadDir);
    } catch (err) {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: async function (req, file, cb) {
    const baseFilename = path.basename(
      file.originalname,
      path.extname(file.originalname)
    );
    let newFilename = generateUniqueFilename(baseFilename);
    const filePath = path.join(__dirname, "..", "uploads", newFilename);

    while (await fileExists(filePath)) {
      newFilename = generateUniqueFilename(baseFilename);
    }

    cb(null, newFilename);
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Set file size limit to 50MB
});

module.exports = { upload };
