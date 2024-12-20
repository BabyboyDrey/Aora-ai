const { default: mongoose } = require("mongoose");
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const styles = require("../models/styles");
const { upload } = require("../multer/multer_png");
const checkAndDeleteFile = require("../utils/checkAndDeleteFile");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const router = require("express").Router();
const FormData = require("form-data");
const designBook = require("../models/designBook");
const clothings = require("../models/clothings");
const notifications = require("../models/notifications");

router.get(
  "/test",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      res.json({
        time: new Date().getTime(),
        userId: req.user.id,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.post(
  "/create-style/:designBookId",
  userAuth,
  upload.fields([{ name: "input_image" }, { name: "style_image" }]),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;
      const { positive_prompt, negative_prompt, num_images, seed, cfg } =
        req.body;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("ids:", designBookId);

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramters provided!",
        });
      }
      if (!foundDesignBook) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Design Book not found");
      }
      if (!req.files["input_image"] || !req.files["style_image"]) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Missing required image");
      }

      const inputImagePath = req.files["input_image"]?.[0]?.path;
      const styleImagePath = req.files["style_image"]?.[0]?.path;
      const formData = new FormData();
      formData.append("num_images", num_images);
      formData.append("positive_prompt", positive_prompt);
      formData.append("negative_prompt", negative_prompt);
      formData.append("seed", seed);
      formData.append("cfg", cfg);
      formData.append("input_image", fs.createReadStream(inputImagePath));
      formData.append("style_image", fs.createReadStream(styleImagePath));

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/illustration2studio_style`,
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
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
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

      console.log("765,", imagePaths);
      const style_image_uuid = [];
      response.data.images_info.length > 1
        ? response.data.images_info.map((e) =>
            style_image_uuid.push(e.image_uuid)
          )
        : style_image_uuid.push(response.data.images_info[0].image_uuid);

      const new_style = await styles.create({
        userId: req.user.id,
        designBookId,
        input_image: req.files["input_image"][0].filename,
        style_image: req.files["style_image"][0].filename,
        style_image_name: imagePaths ? imagePaths : outputFilePaths,
        style_image_uuid,
      });
      await notifications.create({
        userId: req.user.id,
        brief: "Created a style",
        briefModelType: "Style",
        idOfCausingActivity: new_style._id,
      });
      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePaths}`,
        style_name: new_style.style_image_name,
        response: response.data.images_info,
        style_image: base64images,
      });
    } catch (err) {
      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["input_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(
          `uploads/${req.files["style_image"]?.[0]?.filename}`
        ),
      ]);
      console.error(err);
      next(err);
    }
  })
);
router.post(
  "/change-style/:designBookId/:styleId",
  userAuth,
  upload.fields([{ name: "input_image" }, { name: "style_image" }]),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, styleId } = req.params;
      const { num_images, seed, cfg, upper_clothes, skirt, pants, dress } =
        req.body;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("ids:", designBookId, styleId);

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !styleId ||
        !mongoose.Types.ObjectId.isValid(styleId)
      ) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramters provided!",
        });
      }
      if (!req.files["input_image"] || !req.files["style_image"]) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Missing required image");
      }
      const foundStyle = await styles.findOne({
        userId: req.user.id,
        designBookId,
        _id: styleId,
        style_image_name: req.files["input_image"][0].originalname,
      });
      if (!foundDesignBook) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Design Book not found");
      }
      if (!foundStyle) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Style not found");
      }

      const inputImagePath = req.files["input_image"]?.[0]?.path;
      const styleImagePath = req.files["style_image"]?.[0]?.path;
      const formData = new FormData();
      formData.append("num_images", num_images);
      formData.append("seed", seed);
      formData.append("cfg", cfg);
      formData.append("input_image", fs.createReadStream(inputImagePath));
      formData.append("style_image", fs.createReadStream(styleImagePath));
      upper_clothes && formData.append("upper_clothes", upper_clothes);
      skirt && formData.append("skirt", skirt);
      pants && formData.append("pants", pants);
      dress && formData.append("dress", dress);

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/change_style`,
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
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
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

      let styleIndex;
      if (foundStyle) {
        console.log(
          "began processing of style index",
          req.files["input_image"][0]
        );
        await checkAndDeleteFile(
          `output_uploads/${req.files["input_image"][0].originalname}`,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
        console.log(
          "continued processing of style index",
          req.files["input_image"],
          foundStyle
        );
        styleIndex = foundStyle.style_image_name.indexOf(
          req.files["input_image"][0]?.originalname
        );
        if (styleIndex !== -1) {
          console.log(`Filename found at index: ${styleIndex}`);
        } else {
          console.log("Filename not found in the array");
        }
        console.log("finished processing of style index");
      }
      console.log("styleIndex", styleIndex);
      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}-${styleIndex}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);
      console.log("b4 update", foundStyle);
      foundStyle.style_image_uuid[styleIndex] =
        response.data.images_info[0].image_uuid;
      foundStyle.style_image_name[styleIndex] = output_image_name;
      foundStyle.updatedAt = new Date();
      await foundStyle.save();
      console.log("afta update", foundStyle);

      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["input_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(
          `uploads/${req.files["style_image"]?.[0]?.filename}`
        ),
      ]);
      await notifications.create({
        userId: req.user.id,
        brief: "Changed the style of an existing style",
        briefModelType: "Style",
        idOfCausingActivity: foundStyle._id,
      });
      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePath}`,
        style_name: output_image_name,
        response: response.data.images_info,
        style_image: base64images,
      });
    } catch (err) {
      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["input_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(
          `uploads/${req.files["style_image"]?.[0]?.filename}`
        ),
      ]);
      console.error(err);
      next(err);
    }
  })
);
router.post(
  "/create-clothing/:designBookId",
  userAuth,
  upload.fields([{ name: "input_image" }, { name: "style_image" }]),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;
      let { positive_prompt, negative_prompt, num_images, seed, cfg } =
        req.body;
      if (num_images) {
        num_images = Number(num_images);
        console.log("num_images:", num_images);
      }
      if (seed) {
        seed = Number(seed);
        console.log("seed:", seed);
      }
      if (cfg) {
        cfg = Number(cfg);
        console.log("cfg:", cfg);
      }
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      console.log("ids:", designBookId);

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramters provided!",
        });
      }
      if (!foundDesignBook) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Design Book not found");
      }
      console.log("req.body", req.body);
      console.log("req.files:", req.files);
      if (!req.files["input_image"] || !req.files["style_image"]) {
        await Promise.all([
          checkAndDeleteFile(
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
        throw new Error("Missing required image");
      }

      const inputImagePath = req.files["input_image"]?.[0]?.path;
      const styleImagePath = req.files["style_image"]?.[0]?.path;
      const formData = new FormData();
      formData.append("num_images", num_images);
      formData.append("positive_prompt", positive_prompt);
      formData.append("negative_prompt", negative_prompt);
      formData.append("seed", seed);
      formData.append("cfg", cfg);
      formData.append("input_image", fs.createReadStream(inputImagePath));
      formData.append("style_image", fs.createReadStream(styleImagePath));

      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/illustration2studio_prompt`,
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
            `uploads/${req.files["input_image"]?.[0]?.filename}`
          ),
          checkAndDeleteFile(
            `uploads/${req.files["style_image"]?.[0]?.filename}`
          ),
        ]);
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
        console.log(
          "response.data.images[0].image_mime_type:",

          response.data.images[0].image_mime_type,
          response.data
        );
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
      console.log("765,", imagePaths);
      const clothing_image_uuid = [];
      response.data.images_info.length > 1
        ? response.data.images_info.map((e) =>
            clothing_image_uuid.push(e.image_uuid)
          )
        : clothing_image_uuid.push(response.data.images_info[0].image_uuid);
      const new_clothing = await clothings.create({
        userId: req.user.id,
        designBookId,
        input_image: req.files["input_image"][0].filename,
        style_image: req.files["style_image"][0].filename,
        clothing_image_name: imagePaths ? imagePaths : outputFilePaths,
        clothing_image_uuid,
      });

      console.log("new_clothing", new_clothing);
      await notifications.create({
        userId: req.user.id,
        brief: "Created a clothing",
        briefModelType: "Clothing",
        idOfCausingActivity: new_clothing._id,
      });
      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePaths}`,
        clothing_images: base64images,
        clothing_name: new_clothing.clothing_image_name,
        response: response.data.images_info,
      });
    } catch (err) {
      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["input_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(
          `uploads/${req.files["style_image"]?.[0]?.filename}`
        ),
      ]);
      console.error(err);
      next(err.message);
    }
  })
);

router.post(
  "/change-color-style/:designBookId/:styleId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, styleId } = req.params;
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
      console.log("ids:", designBookId, styleId);

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !styleId ||
        !mongoose.Types.ObjectId.isValid(styleId)
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
      const foundStyle = await styles.findOne({
        userId: req.user.id,
        designBookId,
        _id: styleId,
        style_image_name: req.file.originalname,
      });
      if (!foundDesignBook) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Design Book not found");
      }
      if (!foundStyle) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Style not found");
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
      const base64images = [];

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
      console.log("output image gotten");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }

      let styleIndex;
      if (foundStyle) {
        console.log("began processing of style index", req.file);
        await checkAndDeleteFile(
          `output_uploads/${req.file.originalname}`,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
        console.log(
          "continued processing of style index",

          foundStyle
        );
        styleIndex = foundStyle.style_image_name.indexOf(req.file.originalname);
        if (styleIndex !== -1) {
          console.log(`Filename found at index: ${styleIndex}`);
        } else {
          console.log("Filename not found in the array");
        }
        console.log("finished processing of style index");
      }
      console.log("styleIndex", styleIndex);
      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}-${styleIndex}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);
      console.log("b4 update", foundStyle);
      foundStyle.style_image_uuid[styleIndex] =
        response.data.images_info[0].image_uuid;
      foundStyle.style_image_name[styleIndex] = output_image_name;
      foundStyle.updatedAt = new Date();
      await foundStyle.save();
      console.log("afta update", foundStyle);

      await checkAndDeleteFile(`uploads/${req.file.filename}`);
      await notifications.create({
        userId: req.user.id,
        brief: "Changed the color of an existing style",
        briefModelType: "Style",
        idOfCausingActivity: foundStyle._id,
      });
      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePath}`,
        style_name: output_image_name,
        response: response.data.images_info,
        style_image: base64images,
      });
    } catch (err) {
      await checkAndDeleteFile(`uploads/${req.file.filename}`);
      console.error(err);
      next(err);
    }
  })
);

router.post(
  "/change-background/:designBookId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("ids:", designBookId, styleId);
      console.log("req.file.filename:", req.file);

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramter provided!",
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

      formData.append("num_images", 1);
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

      await new Promise((resolve, reject) => {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.status(200).json({
        success: true,
        response: response.data.images_info,
        style_image: base64images,
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
//done

router.post(
  "/remove-background/:designBookId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("ids:", designBookId, styleId);
      console.log("req.file.filename:", req.file);

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return res.status(400).json({
          error: true,
          message: "Invalid or no paramter provided!",
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
      formData.append("num_images", 1);
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

      await new Promise((resolve, reject) => {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.status(200).json({
        success: true,
        style_images: base64images,
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
  "/use-magic-tool/:designBookId",
  userAuth,
  upload.fields([{ name: "input_image" }, { name: "mask_image" }]),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;
      const foundDesignBook = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
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
          message: "Invalid or no parameter provided!",
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
      formData.append("num_images", 1);
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

      await Promise.all([
        checkAndDeleteFile(
          `uploads/${req.files["input_image"]?.[0]?.filename}`
        ),
        checkAndDeleteFile(`uploads/${req.files["mask_image"]?.[0]?.filename}`),
      ]);

      res.status(200).json({
        success: true,
        style_images: base64images,
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
  "/change-color-clothing/:designBookId/:clothingId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId, clothingId } = req.params;
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
      console.log("ids:", designBookId, clothingId);

      if (
        !designBookId ||
        !mongoose.Types.ObjectId.isValid(designBookId) ||
        !clothingId ||
        !mongoose.Types.ObjectId.isValid(clothingId)
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
      const foundClothing = await clothings.findOne({
        userId: req.user.id,
        designBookId,
        _id: clothingId,
        clothing_image_name: req.file.originalname,
      });
      if (!foundDesignBook) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Design Book not found");
      }
      if (!foundClothing) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`);
        throw new Error("Style not found");
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

      let clothingIndex;
      if (foundClothing) {
        console.log("began processing of clothing index", req.file);
        await checkAndDeleteFile(
          `output_uploads/${req.file.originalname}`,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
        console.log(
          "continued processing of clothing index",

          foundClothing
        );
        clothingIndex = foundClothing.clothing_image_name.indexOf(
          req.file.originalname
        );
        if (clothingIndex !== -1) {
          console.log(`Filename found at index: ${clothingIndex}`);
        } else {
          console.log("Filename not found in the array");
        }
        console.log("finished processing of style index");
      }
      console.log("clothingIndex", clothingIndex);
      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}-${clothingIndex}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);
      console.log("b4 update", foundClothing);
      foundClothing.clothing_image_uuid[clothingIndex] =
        response.data.images_info[0].image_uuid;
      foundClothing.clothing_image_name[clothingIndex] = output_image_name;
      foundClothing.updatedAt = new Date();
      await foundClothing.save();
      console.log("afta update", foundClothing);
      await notifications.create({
        userId: req.user.id,
        brief: "Changed the color of an existing clothing",
        briefModelType: "Clothing",
        idOfCausingActivity: foundClothing._id,
      });
      await checkAndDeleteFile(`uploads/${req.file.filename}`);

      res.status(200).json({
        success: true,
        message: `Images saved as ${outputFilePath}`,
        clothing_name: output_image_name,
        response: response.data.images_info,
        clothing_image: base64images,
      });
    } catch (err) {
      await checkAndDeleteFile(`uploads/${req.file.filename}`);
      console.error(err);
      next(err);
    }
  })
);

router.get(
  "/get-user-clothings/:designBookId",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        throw new Error("Invalid or no required paramter provided!");
      }

      const allClothings = await clothings.find({
        userId: req.user.id,
        designBookId,
      });

      if (allClothings.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No clothing created for this user",
        });
      }

      res.json({
        success: true,
        allClothings,
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  })
);
router.get(
  "/get-user-styles/:designBookId",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;

      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        throw new Error("Invalid or no required paramter provided!");
      }

      const allStyles = await styles.find({
        userId: req.user.id,
        designBookId,
      });

      if (allStyles.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No styles created for this user",
        });
      }

      res.json({
        success: true,
        allStyles,
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  })
);

module.exports = router;
