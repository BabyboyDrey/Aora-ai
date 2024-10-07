const router = require("express").Router();
const FormData = require("form-data");
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const designBook = require("../models/designBook");
const { upload } = require("../multer/multer_png");
const checkAndDeleteFile = require("../utils/checkAndDeleteFile");
const models = require("../models/models");
const { default: mongoose } = require("mongoose");
const fs = require("fs");
const axios = require("axios");
const path = require("path");

router.get("/test", userAuth, (req, res, next) => {
  return res.json({
    time: new Date().getTime(),
  });
});

router.post(
  "/create-model-without-style/:designBookId",
  userAuth,
  upload.fields([{ name: "background_image" }, { name: "pose_image" }]),
  asyncErrCatcher(async (req, res, next) => {
    let outputFilePath = null;
    try {
      const { designBookId } = req.params;
      const {
        age,
        ethnicity,
        look,
        gender,
        body_shape,
        expression,
        num_images,
      } = req.body;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["background_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["pose_image"]?.[0]?.filename}`
          ),
        ]).catch((deleteError) =>
          console.error("Failed to delete files:", deleteError)
        );
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramter provided!",
        });
      }

      if (!foundDesignBook) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["background_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["pose_image"]?.[0]?.filename}`
          ),
        ]).catch((deleteError) =>
          console.error("Failed to delete files:", deleteError)
        );
        throw new Error("Design Book not found");
      }

      if (!req.files["background_image"] || !req.files["pose_image"]) {
        throw new Error("Missing required images");
      }

      const backgroundImagePath = req.files["background_image"][0].path;
      const poseImagePath = req.files["pose_image"][0].path;

      const formData = new FormData();
      formData.append("age", age);
      formData.append("ethnicity", ethnicity);
      formData.append("look", look);
      formData.append("gender", gender);
      formData.append("body_shape", body_shape);
      formData.append("expression", expression);
      formData.append("num_images", num_images);
      formData.append(
        "background_image",
        fs.createReadStream(backgroundImagePath)
      );
      formData.append("pose_image", fs.createReadStream(poseImagePath));

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/model_generator`,
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
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["background_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["pose_image"]?.[0]?.filename}`
          ),
        ]).catch((deleteError) =>
          console.error("Failed to delete files:", deleteError)
        );
        throw new Error("Invalid response from the API: Missing image data.");
      }
      console.log("Number of images returned:", response.data.images.length);
      const outputFilePaths = [];
      let imagePaths;
      if (response.data.images.length > 1) {
        imagePaths = response.data.images.map((imageData, index) => {
          const imageMimeType = imageData.image_mime_type;
          const fileExtension = imageMimeType.split("/")[1].toLowerCase();
          const buffer = Buffer.from(imageData.image_data, "base64");
          const uploadsDir = path.join(__dirname, "..", "output_uploads");

          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.floor(Math.random() * 1e9);
          const output_image_name = `output_image-${uniqueSuffix}-${index}.${fileExtension}`;
          const outputFilePath = path.join(uploadsDir, output_image_name);

          fs.writeFileSync(outputFilePath, buffer);
          outputFilePaths.push(outputFilePath);

          return output_image_name;
        });
      } else {
        const imageData = response.data.images[0];
        const imageMimeType = response.data.images[0].image_mime_type;
        const fileExtension = imageMimeType.split("/")[1].toLowerCase();
        const buffer = Buffer.from(imageData.image_data, "base64");
        const uploadsDir = path.join(__dirname, "..", "output_uploads");

        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir);
        }

        const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
        const output_image_name = `output_image-${uniqueSuffix}.${fileExtension}`;
        const outputFilePath = path.join(uploadsDir, output_image_name);

        fs.writeFileSync(outputFilePath, buffer);

        outputFilePaths.push(output_image_name);
      }

      const model_uuid = [];
      response.data.images_info.length > 1
        ? response.data.images_info.map((e) => model_uuid.push(e.image_uuid))
        : model_uuid.push(response.data.images_info[0].image_uuid);

      const new_model = await models.create({
        userId: req.user.id,
        designBookId,
        background_image: req.files["background_image"][0].filename,
        pose_image: req.files["pose_image"][0].filename,
        model_image_name: imagePaths ? imagePaths : outputFilePaths,
        model_uuid,
      });

      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePaths}`,
        model_name: new_model.model_image_name,
        response: response.data.images_info,
      });
    } catch (err) {
      console.error(err);
      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["background_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(`uploads/${req.files["pose_image"]?.[0]?.filename}`),
        outputFilePath ? checkAndDeleteFile(outputFilePath) : Promise.resolve(),
      ]).catch((deleteError) =>
        console.error("Failed to delete files:", deleteError)
      );

      next(err);
    }
  })
);

router.post(
  "/swap-model",
  userAuth,
  upload.array([{ name: "background_image" }, { name: "pose_image" }]),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;
      const {
        age,
        ethnicity,
        look,
        gender,
        body_shape,
        expression,
        num_images,
      } = req.body;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["background_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["pose_image"]?.[0]?.filename}`
          ),
        ]).catch((deleteError) =>
          console.error("Failed to delete files:", deleteError)
        );
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramter provided!",
        });
      }

      if (!foundDesignBook) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["background_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["pose_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Design Book not found");
      }

      if (!req.files["background_image"] || !req.files["pose_image"]) {
        throw new Error("Missing required images");
      }

      const backgroundImagePath = req.files["background_image"][0].path;
      const poseImagePath = req.files["pose_image"][0].path;

      const formData = new FormData();
      formData.append("age", age);
      formData.append("ethnicity", ethnicity);
      formData.append("look", look);
      formData.append("gender", gender);
      formData.append("body_shape", body_shape);
      formData.append("expression", expression);
      formData.append("num_images", num_images);
      formData.append(
        "background_image",
        fs.createReadStream(backgroundImagePath)
      );
      formData.append("pose_image", fs.createReadStream(poseImagePath));

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/swap_model`,
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
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["background_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["pose_image"]?.[0]?.filename}`
          ),
        ]).catch((deleteError) =>
          console.error("Failed to delete files:", deleteError)
        );
        throw new Error("Invalid response from the API: Missing image data.");
      }
      console.log("Number of images returned:", response.data.images.length);
      const outputFilePaths = [];
      const base64images = [];

      let imagePaths;
      if (response.data.images.length > 1) {
        imagePaths = response.data.images.map((imageData, index) => {
          const base64image = {
            image_uuid: imageData.image_uuid,
            image_data: imageData.image_data,
            image_mime_type: imageData.image_mime_type,
          };
          base64images.push(base64image);
          const imageMimeType = imageData.image_mime_type;
          const fileExtension = imageMimeType.split("/")[1].toLowerCase();
          const buffer = Buffer.from(imageData.image_data, "base64");
          const uploadsDir = path.join(__dirname, "..", "output_uploads");

          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
          }

          const uniqueSuffix =
            Date.now() + "-" + Math.floor(Math.random() * 1e9);
          const output_image_name = `output_image-${uniqueSuffix}-${index}.${fileExtension}`;
          const outputFilePath = path.join(uploadsDir, output_image_name);

          fs.writeFileSync(outputFilePath, buffer);
          outputFilePaths.push(outputFilePath);

          return output_image_name;
        });
      } else {
        const imageData = response.data.images[0];
        const base64image = {
          image_uuid: imageData.image_uuid,
          image_data: imageData.image_data,
          image_mime_type: imageData.image_mime_type,
        };
        base64images.push(base64image);
        const imageMimeType = response.data.images[0].image_mime_type;
        const fileExtension = imageMimeType.split("/")[1].toLowerCase();
        const buffer = Buffer.from(imageData.image_data, "base64");
        const uploadsDir = path.join(__dirname, "..", "output_uploads");

        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir);
        }

        const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
        const output_image_name = `output_image-${uniqueSuffix}.${fileExtension}`;
        const outputFilePath = path.join(uploadsDir, output_image_name);

        fs.writeFileSync(outputFilePath, buffer);

        outputFilePaths.push(output_image_name);
      }

      const model_uuid = [];
      response.data.images_info.length > 1
        ? response.data.images_info.map((e) => model_uuid.push(e.image_uuid))
        : model_uuid.push(response.data.images_info[0].image_uuid);

      const new_model = await models.create({
        userId: req.user.id,
        designBookId,
        background_image: req.files["background_image"][0].filename,
        pose_image: req.files["pose_image"][0].filename,
        model_image_name: imagePaths ? imagePaths : outputFilePaths,
        model_uuid,
      });

      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePaths}`,
        model_name: new_model.model_image_name,
        model_images: base64images,
        response: response.data.images_info,
      });
    } catch (err) {
      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["background_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(`uploads/${req.files["pose_image"]?.[0]?.filename}`),
      ]);
      console.error(err);
      next(err);
    }
  })
);

router.post(
  "/change-background/:designBookId/:model_id",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, model_id } = req.params;
      const { positive_prompt, negative_prompt, cfg, num_images } = req.body;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("ids:", designBookId, model_id);
      console.log("req.file.filename:", req.file);
      const foundModel = await models.findOne({
        userId: req.user.id,
        designBookId: designBookId,
        _id: model_id,
        model_image_name: req.file.originalname,
      });
      console.log("found model", foundModel);
      if (!foundModel) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.error("No model found with id");
        throw new Error("No model found with id");
      }

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !model_id ||
        !mongoose.Types.ObjectId.isValid(model_id)
      ) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramters provided!",
        });
      }

      if (!foundDesignBook) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Design Book not found");
      }

      if (!req.file) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Missing required image");
      }

      const inputImagePath = req.file.path;
      const formData = new FormData();
      formData.append("positive_prompt", positive_prompt);
      formData.append("negative_prompt", negative_prompt);
      formData.append("cfg", cfg);
      formData.append("num_images", num_images);
      formData.append("input_image", fs.createReadStream(inputImagePath));

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/background_change`,
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
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Invalid response from the API: Missing image data.");
      }
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
      const uploadsDir = path.join(__dirname, "..", "output_uploads");

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      let modelIndex;
      if (foundModel) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(
            `output_uploads/${req.file.originalname}`,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        modelIndex = foundModel.model_image_name.indexOf(req.file.originalname);
        if (modelIndex !== -1) {
          console.log(`Filename found at index: ${modelIndex}`);
        } else {
          console.log("Filename not found in the array");
        }
      }

      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}-${modelIndex}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);

      foundModel.model_uuid[modelIndex] =
        response.data.images_info[0].image_uuid;
      foundModel.model_image_name[modelIndex] = output_image_name;
      foundModel.updatedAt = new Date();
      await foundModel.save();
      await new Promise((resolve, reject) => {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePath}`,
        model_name: output_image_name,
        model_images: base64images,
        response: response.data.images_info,
      });
    } catch (err) {
      await new Promise((resolve, reject) => {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.error(err);
      next(err);
    }
  })
);
router.post(
  "/remove-background/:designBookId/:model_id",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, model_id } = req.params;
      const { num_images } = req.body;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("ids:", designBookId, model_id);
      console.log("req.file.filename:", req.file);
      const foundModel = await models.findOne({
        userId: req.user.id,
        designBookId: designBookId,
        _id: model_id,
        model_image_name: req.file.originalname,
      });
      console.log("found model", foundModel);
      if (!foundModel) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.error("No model found with id");
        throw new Error("No model found with id");
      }

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !model_id ||
        !mongoose.Types.ObjectId.isValid(model_id)
      ) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramters provided!",
        });
      }

      if (!foundDesignBook) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Design Book not found");
      }

      if (!req.file) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Missing required image");
      }

      const inputImagePath = req.file.path;
      const formData = new FormData();
      formData.append("num_images", num_images);
      formData.append("input_image", fs.createReadStream(inputImagePath));

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/remove_background`,
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
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Invalid response from the API: Missing image data.");
      }
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
      const uploadsDir = path.join(__dirname, "..", "output_uploads");

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      let modelIndex;
      if (foundModel) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(
            `output_uploads/${req.file.originalname}`,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        modelIndex = foundModel.model_image_name.indexOf(req.file.originalname);
        if (modelIndex !== -1) {
          console.log(`Filename found at index: ${modelIndex}`);
        } else {
          console.log("Filename not found in the array");
        }
      }

      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}-${modelIndex}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);

      foundModel.model_uuid[modelIndex] =
        response.data.images_info[0].image_uuid;
      foundModel.model_image_name[modelIndex] = output_image_name;
      foundModel.updatedAt = new Date();
      await foundModel.save();
      await new Promise((resolve, reject) => {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePath}`,
        model_name: output_image_name,
        model_images: base64images,
        response: response.data.images_info,
      });
    } catch (err) {
      await new Promise((resolve, reject) => {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.error(err);
      next(err);
    }
  })
);

router.post(
  "/use-magic-tool/:designBookId/:model_id",
  userAuth,
  upload.fields([{ name: "input_image" }, { name: "mask_image" }]),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, model_id } = req.params;
      const { num_images, positive_prompt, negative_prompt, cfg } = req.body;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      const foundModel = await models.findOne({
        userId: req.user.id,
        designBookId,
        _id: model_id,
        model_image_name: req.files["input_image"]?.[0]?.originalname,
      });

      if (!foundModel) {
        await Promise.all([
          req.files["input_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["input_image"][0].filename}`
            ),
          req.files["mask_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["mask_image"][0].filename}`
            ),
        ]);
        throw new Error("No model found with id and selected input image");
      }

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !model_id ||
        !mongoose.Types.ObjectId.isValid(model_id)
      ) {
        await Promise.all([
          req.files["input_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["input_image"][0].filename}`
            ),
          req.files["mask_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["mask_image"][0].filename}`
            ),
        ]);
        return res.status(400).json({
          error: true,
          message: "Invalid or no parameters provided!",
        });
      }

      if (!foundDesignBook) {
        await Promise.all([
          req.files["input_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["input_image"][0].filename}`
            ),
          req.files["mask_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["mask_image"][0].filename}`
            ),
        ]);
        throw new Error("Design Book not found");
      }

      if (!req.files["mask_image"] || !req.files["input_image"]) {
        await Promise.all([
          req.files["input_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["input_image"][0].filename}`
            ),
          req.files["mask_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["mask_image"][0].filename}`
            ),
        ]);
        throw new Error("Missing required images");
      }

      const inputImagePath = req.files["input_image"][0].path;
      const maskImagePath = req.files["mask_image"][0].path;
      const formData = new FormData();
      formData.append("num_images", num_images);
      formData.append("positive_prompt", positive_prompt);
      formData.append("negative_prompt", negative_prompt);
      formData.append("cfg", cfg);
      formData.append("input_image", fs.createReadStream(inputImagePath));
      formData.append("mask_image", fs.createReadStream(maskImagePath));

      let response;
      try {
        response = await axios.post(
          `${process.env.IMAGING_BASE_URL}/magic_tool`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${process.env.IMAGING_AUTH_KEY}`,
            },
          }
        );
      } catch (err) {
        await Promise.all([
          req.files["input_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["input_image"][0].filename}`
            ),
          req.files["mask_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["mask_image"][0].filename}`
            ),
        ]);
        throw new Error(
          `Error occurred while processing the image: ${err.message}`
        );
      }

      if (
        !response.data ||
        !response.data.images ||
        !response.data.images.length
      ) {
        await Promise.all([
          req.files["input_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["input_image"][0].filename}`
            ),
          req.files["mask_image"]?.[0]?.filename &&
            checkAndDeleteFile(
              `uploads/${req.files["mask_image"][0].filename}`
            ),
        ]);
        throw new Error("Invalid response from the API: Missing image data.");
      }
      console.log("response gotten");
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
      const uploadsDir = path.join(__dirname, "..", "output_uploads");

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }
      console.log("model gotten");

      let modelIndex;
      if (foundModel) {
        await checkAndDeleteFile(
          `output_uploads/${req.files["input_image"]?.[0]?.originalname}`
        );

        modelIndex = foundModel.model_image_name.indexOf(
          req.files["input_image"]?.[0]?.originalname
        );
      }

      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}-${modelIndex}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);
      console.log("image created");

      fs.writeFileSync(outputFilePath, buffer);

      foundModel.model_uuid[modelIndex] =
        response.data.images_info[0].image_uuid;
      foundModel.model_image_name[modelIndex] = output_image_name;
      foundModel.updatedAt = new Date();
      await foundModel.save();

      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["input_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(`uploads/${req.files["mask_image"]?.[0]?.filename}`),
      ]);

      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePath}`,
        model_name: output_image_name,
        model_images: base64images,
        response: response.data.images_info,
      });
    } catch (err) {
      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["input_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(`uploads/${req.files["mask_image"]?.[0]?.filename}`),
      ]);
      console.error(err);
      next(err);
    }
  })
);

router.post(
  "/change-color-model/:designBookId/:modelId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, modelId } = req.params;
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
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("ids:", designBookId, modelId);

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !modelId ||
        !mongoose.Types.ObjectId.isValid(modelId)
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
      const foundModel = await models.findOne({
        userId: req.user.id,
        designBookId,
        _id: modelId,
        model_image_name: req.file.originalname,
      });
      if (!foundDesignBook) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Design Book not found");
      }
      if (!foundModel) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Model not found");
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
      const uploadsDir = path.join(__dirname, "..", "output_uploads");
      console.log("output image gotten");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      let modelIndex;
      if (foundModel) {
        console.log("began processing of model index", req.file);
        await checkAndDeleteFile(
          `output_uploads/${req.file.originalname}`,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
        console.log(
          "continued processing of model index",

          foundModel
        );
        modelIndex = foundModel.model_image_name.indexOf(req.file.originalname);
        if (modelIndex !== -1) {
          console.log(`Filename found at index: ${modelIndex}`);
        } else {
          console.log("Filename not found in the array");
        }
        console.log("finished processing of model index");
      }
      console.log("modelIndex", modelIndex);
      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}-${modelIndex}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);
      console.log("b4 update", foundModel);
      foundModel.model_uuid[modelIndex] =
        response.data.images_info[0].image_uuid;
      foundModel.model_image_name[modelIndex] = output_image_name;
      foundModel.updatedAt = new Date();
      await foundModel.save();
      console.log("afta update", foundModel);

      await checkAndDeleteFile(`uploads/${req.file.filename}`);

      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePath}`,
        model_name: output_image_name,
        model_images: base64images,
        response: response.data.images_info,
      });
    } catch (err) {
      await checkAndDeleteFile(`uploads/${req.file.filename}`);
      console.error(err);
      next(err);
    }
  })
);

router.get(
  "/get-user-models/:designBookId",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        throw new Error("Invalid or no required paramter provided!");
      }

      const allModels = await models.find({
        userId: req.user.id,
        designBookId,
      });

      if (allModels.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No models created for this user",
        });
      }

      res.json({
        success: true,
        allModels,
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  })
);

module.exports = router;
