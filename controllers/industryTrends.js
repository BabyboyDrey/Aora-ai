const path = require("path");
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const clothings = require("../models/clothings");
const styles = require("../models/styles");
const fs = require("fs");
const convertImagePaths2Base64Uris = require("../utils/convertImagePaths2Base64Uris");
const models = require("../models/models");
const fabric = require("../models/fabric");
const designBook = require("../models/designBook");
const { default: mongoose } = require("mongoose");
const router = require("express").Router();

router.get(
  "/get-webpack-styles",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const allStyles = await styles.find({});

      const allStylesImageName = allStyles.reduce(
        (acc, curr) => {
          acc.allImageName = acc.allImageName.concat(curr.style_image_name);
          return acc;
        },
        {
          allImageName: [],
        }
      );

      console.log(allStylesImageName);

      const results = await convertImagePaths2Base64Uris(
        allStylesImageName.allImageName
      );

      res.json({
        success: true,
        results,
        allStylesImageName,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.get(
  "/get-webpack-clothings",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const allClothings = await clothings.find({});
      const allClothingImageName = allClothings.reduce(
        (acc, curr) => {
          acc.allImageName = acc.allImageName.concat(curr.clothing_image_name);
          return acc;
        },
        {
          allImageName: [],
        }
      );

      console.log(allClothingImageName);

      const results = await convertImagePaths2Base64Uris(
        allClothingImageName.allImageName
      );

      res.json({
        success: true,
        results,
        allClothingImageName,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);
router.get(
  "/get-webpack-models",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const allModels = await models.find({});
      const allModelsImageName = allModels.reduce(
        (acc, curr) => {
          acc.allImageName = acc.allImageName.concat(curr.model_image_name);
          return acc;
        },
        {
          allImageName: [],
        }
      );

      console.log(allModelsImageName);

      const results = await convertImagePaths2Base64Uris(
        allModelsImageName.allImageName
      );

      res.json({
        success: true,
        results,
        allModelsImageName,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);
router.get(
  "/get-webpack-fabrics",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const allFabrics = await fabric.find({});
      const allFabricsImageName = allFabrics.reduce(
        (acc, curr) => {
          acc.allImageName = acc.allImageName.concat(curr.fabricImageName);
          return acc;
        },
        {
          allImageName: [],
        }
      );

      console.log(allFabricsImageName);
      console.log(
        " allFabricsImageName.allImageName:",
        allFabricsImageName.allImageName
      );
      const results = await convertImagePaths2Base64Uris(
        allFabricsImageName.allImageName
      );

      res.json({
        success: true,
        results,
        allFabricsImageName,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.post(
  "/save-images-to-webpack/:designBookId",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { imageName, type } = req.body;
      console.log("req.body:", imageName, type);
      const { designBookId } = req.params;
      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId))
        throw new Error("Required parameter not provided!");
      if (!type) throw new Error('Required parameter "type" not provided');
      const foundDesignBook = await designBook.findById(designBookId);

      if (!foundDesignBook) throw new Error("Design book not found!");

      const uploadsDir = path.join(__dirname, "..", "output_uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }
      const imagePath = `${uploadsDir}/${imageName}`;
      try {
        await fs.promises.access(imagePath);
        console.log("File exists at file path");
      } catch (err) {
        console.log("Image does not exist at file path");
        throw new Error("Image does not exist at file path");
      }

      if (type === "model") {
        const foundImage = await models.findOne({
          userId: req.user.id,
          designBookId,
          model_image_name: imageName,
        });
        console.log("foundImage:", foundImage);
        if (foundImage) {
          throw new Error("This image is already saved to your design book");
        }
      }
      if (type === "fabric") {
        const foundImage = await fabric.findOne({
          userId: req.user.id,
          designBookId,
          fabricImageName: imageName,
        });
        console.log("foundImage:", foundImage);
        if (foundImage) {
          throw new Error("This image is already saved to your design book");
        }
      }
      if (type === "style") {
        const foundImage = await styles.findOne({
          userId: req.user.id,
          designBookId,
          style_image_name: imageName,
        });
        console.log("foundImage:", foundImage);
        if (foundImage) {
          throw new Error("This image is already saved to your design book");
        }
      }
      if (type === "clothing") {
        const foundImage = await clothings.findOne({
          userId: req.user.id,
          designBookId,
          clothing_image_name: imageName,
        });
        console.log("foundImage:", foundImage);
        if (foundImage) {
          throw new Error("This image is already saved to your design book");
        }
      }

      foundDesignBook.imagesSavedFromWebPack.push(imageName);
      await foundDesignBook.save();

      res.json({
        success: true,
        message: "Model image saved successfully",
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

module.exports = router;
