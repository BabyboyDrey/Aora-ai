const path = require("path");
const fs = require("fs");

module.exports = convertImagePaths2Base64Uris = async (imagePaths) => {
  const uploadsDir = path.join(__dirname, "..", "output_uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  const base64ImageUris = {};
  const missingFiles = [];

  for (const e of imagePaths) {
    const imagePath = `${uploadsDir}/${e}`;
    try {
      await fs.promises.access(imagePath);
      console.log("File exists at the expected path:", imagePath);

      const data = await fs.promises.readFile(imagePath);
      const base64Image = data.toString("base64");

      base64ImageUris[e] = base64Image;
    } catch (err) {
      console.error("File does not exist at the path:", imagePath);
      missingFiles.push(e);
    }
  }
  return {
    base64ImageUris,
    missingFiles,
  };
};
