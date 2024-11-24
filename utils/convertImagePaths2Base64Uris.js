const path = require("path");
const fs = require("fs");
const clothings = require("../models/clothings");
const users = require("../models/users");
const models = require("../models/models");
const fabric = require("../models/fabric");
const styles = require("../models/styles");

module.exports = convertImagePaths2Base64Uris = async (imagePaths, type) => {
  const uploadsDir = path.join(__dirname, "..", "output_uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  const base64ImageUris = {};
  const missingFiles = [];
  let foundUser;
  for (const e of imagePaths) {
    const imagePath = `${uploadsDir}/${e}`;

    try {
      await fs.promises.access(imagePath);
      console.log("File exists at the expected path:", imagePath);
      if (type === "clothing") {
        const foundClothing = await clothings.findOne({
          clothing_image_name: e,
        });
        if (foundClothing) {
          foundUser = await users.findById(
            foundClothing.userId,
            "full_name _id"
          );
        }
        console.log("foundClothing:", foundClothing);
      }
      if (type === "model") {
        const foundModel = await models.findOne({
          model_image_name: e,
        });
        if (foundModel) {
          foundUser = await users.findById(foundModel.userId, "full_name _id");
        }
        console.log("foundModel:", foundModel);
      }
      if (type === "fabric") {
        const foundFabric = await fabric.findOne({
          fabricImageName: e,
        });
        if (foundFabric) {
          foundUser = await users.findById(foundFabric.userId, "full_name _id");
        }
        console.log("foundFabric:", foundFabric);
      }
      if (type === "style") {
        const foundStyle = await styles.findOne({
          fabricImageName: e,
        });
        if (foundStyle) {
          foundUser = await users.findById(foundStyle.userId, "full_name _id");
        }
        console.log("foundStyle:", foundStyle);
      }
      console.log("foundUser", foundUser);
      const data = await fs.promises.readFile(imagePath);
      const base64Image = data.toString("base64");

      base64ImageUris[e] = { base64Image, foundUser };
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
