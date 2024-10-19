const { default: mongoose } = require("mongoose");
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const designBook = require("../models/designBook");
const fabric = require("../models/fabric");
const { upload } = require("../multer/multer_png");
const checkAndDeleteFile = require("../utils/checkAndDeleteFile");
const { default: axios } = require("axios");
const path = require("path");
const fs = require("fs");
const router = require("express").Router();
const FormData = require("form-data");

router.post(
  "/create-fabric/:designBookId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;

      const foundBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      if (!foundBook) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);

        throw new Error("No design book created!");
      }
      if (!req.file.filename) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);

        throw new Error("Required file not provided");
      }

      const newFabric = await fabric.create({
        userId: req.user.id,
        designBookId,
        fabricImageName: req.file.filename,
      });

      res.status(200).json({
        success: true,
        message: "Fabric created successfully",
        fabricImageName: newFabric.fabricImageName,
      });
    } catch (err) {
      await checkAndDeleteFile(`uploads/${req.file.filename}`);
      console.error(err);
      next(err);
    }
  })
);

router.post(
  "/change-color-fabric/:designBookId/:fabricId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, fabricId } = req.params;

      const {
        num_images,
        seed,
        cfg,
        upper_clothes,
        skirt,
        pants,
        dress,
        opacity,
        color,
        blend,
      } = req.body;

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !fabricId ||
        !mongoose.Types.ObjectId.isValid(fabricId)
      ) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramters provided!",
        });
      }

      if (!req.file) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Missing required image");
      }

      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      if (!foundDesignBook) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Design Book not found");
      }

      const foundFabric = await fabric.findOne({
        userId: req.user.id,
        designBookId,
        _id: fabricId,
        fabricImageName: req.file.originalname,
      });

      if (!foundFabric) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Fabric not found");
      }

      const inputImagePath = req.file.path;
      const formData = new FormData();
      formData.append("num_images", num_images);
      formData.append("seed", seed);
      formData.append("cfg", cfg);
      formData.append("input_image", fs.createReadStream(inputImagePath));
      upper_clothes && formData.append("upper_clothes", upper_clothes);
      skirt && formData.append("skirt", skirt);
      pants && formData.append("pants", pants);
      dress && formData.append("dress", dress);
      blend && formData.append("blend", blend);
      opacity && formData.append("opacity", opacity);
      color && formData.append("color", color);

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/change_color`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.IMAGING_AUTH_KEY}`,
          },
        }
      );

      if (
        !response.data ||
        !response.data.images ||
        !response.data.images.length
      ) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Invalid response from the API: Missing image data.");
      }

      console.log("Number of images returned:", response.data.images.length);

      const imageData = response.data.images[0];
      const base64images = [];

      const base64image = {
        image_uuid: imageData.image_uuid,
        image_data: imageData.image_data,
        image_mime_type: imageData.image_mime_type,
      };
      base64images.push(base64image);
      const imageMimeType = response.data.images[0].image_mime_type;
      const fileExtension = imageMimeType.split("/")[1].toLowerCase();
      const buffer = Buffer.from(imageData.image_data, "base64");
      const uploadsDir = path.join(__dirname, "..", "uploads");
      console.log("output image gotten");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }
      await checkAndDeleteFile(`uploads/${req.file.originalname}`);

      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);
      console.log("b4 update", foundFabric);

      foundFabric.fabricImageName = output_image_name;
      foundFabric.fabricUuid = response.data.images_info[0].image_uuid;
      foundFabric.updatedAt = new Date();
      await foundFabric.save();

      console.log("afta update", foundFabric);

      await checkAndDeleteFile(`uploads/${req.file.filename}`);

      res.status(200).json({
        success: true,
        message: "Fabric updated successfully",
        fabricImageName: foundFabric.fabricImageName,
        fabric_image: base64images,
      });
    } catch (err) {
      await checkAndDeleteFile(`uploads/${req.file.filename}`);
      console.error(err);
      next(err);
    }
  })
);

router.get(
  "/get-user-fabrics/:designBookId",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        throw new Error("Invalid or no required paramter provided!");
      }

      const allFabrics = await fabric.find({
        userId: req.user.id,
        designBookId,
      });

      if (allFabrics.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No fabric created for this user",
        });
      }

      res.json({
        success: true,
        allFabrics,
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  })
);

module.exports = router;
