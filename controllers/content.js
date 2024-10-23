const FormData = require("form-data");
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const designBook = require("../models/designBook");
const textContent = require("../models/textContent");
const { upload } = require("../multer/multer_png");
const ZhipuAI = require("../utils/zhipuAi");
const imageContent = require("../models/imageContent");
const checkAndDeleteFile = require("../utils/checkAndDeleteFile");
const { default: mongoose } = require("mongoose");
const fs = require("fs");
const { default: axios } = require("axios");
const router = require("express").Router();
const path = require("path");
const notifications = require("../models/notifications");

router.post(
  "/create-text-content/:designBookId",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { userPrompt } = req.body;
      if (!userPrompt) {
        throw new Error("User prompt invalid or  not provided!");
      }
      console.log("req.body:", userPrompt, req.body);
      const { designBookId } = req.params;
      console.log("designBookId:", designBookId, "req.user.id:", req.user.id);
      const found_profile = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("found_profile:", found_profile);

      if (!found_profile) {
        return res.status(404).json({
          error: true,
          message: "No brand profile created",
        });
      }
      const prompt = `Create content from this user prompt ${userPrompt}. The content should be structured in a JSON format with the following keys: 

    - subject: Generate a unique and catchy subject line that reflects the main theme of the user prompt. If the user prompt mentions any social media platforms (such as "Instagram," "Pinterest," "Facebook," etc.), include these references in the subject line to make it relevant.
      
- body: Make the body concise and engaging while covering the key points of the user prompt: ${userPrompt}.
      

      Please wrap the JSON between the delimitters "START_JSON" and "END_JSON"
      
      Please return the response strictly in JSON format between the specified delimiters without any additional text or explanations.`;
      const client = new ZhipuAI(process.env.ZHIPU_APP_KEY);
      let response;

      try {
        response = await client.chatCompletions(
          "glm-4",
          [
            {
              role: "user",
              content: prompt,
            },
          ],
          {
            max_tokens: 1000,
            temperature: 0.7,
            top_p: 0.9,
          }
        );
        const cleanedMessage = response.choices[0].message.content.trim();

        console.log("Cleaned Message:", cleanedMessage);
        if (
          cleanedMessage.startsWith("START_JSON") &&
          cleanedMessage.endsWith("END_JSON")
        ) {
          const jsonString = cleanedMessage
            .slice("START_JSON".length, -"END_JSON".length)
            .trim();
          const jsonData = JSON.parse(jsonString);
          if (jsonData && jsonData.body) {
            jsonData.body = jsonData.body.replace(/(\n|\n\n)/g, " ").trim();
          }
          console.log("Parsed JSON Data:", jsonData);
          const foundTextContent = await textContent.findOne({
            userId: req.user.id,
            designBookId,
          });
          let newTextContent;
          if (!foundTextContent) {
            newTextContent = await textContent.create({
              userId: req.user.id,
              designBookId,
              content: jsonData,
            });
          }
          foundTextContent.content.push(jsonData);
          newTextContent = foundTextContent.content.find(
            (e) => e.subject === jsonData.subject
          );
          await foundTextContent.save();
          await notifications.create({
            userId: req.user.id,
            brief: "Created text content",
            briefModelType: "Text content",
            idOfCausingActivity: foundTextContent._id,
          });
          res.json({
            newTextContent,
          });
        } else {
          console.error("Response does not have the expected format.");
          return res.status(500).json({
            error: true,
            message: "Response format is incorrect.",
          });
        }
      } catch (err) {
        console.error("Failed to get response:", err);
        return res.status(500).json({
          error: true,
          message: "Failed to get response: " + err,
        });
      }
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.post(
  "/create-image-content/:designBookId",
  userAuth,
  upload.single("input_image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { positive_prompt } = req.body;
      if (!positive_prompt) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });

        throw new Error("Positive prompt invalid or  not provided!");
      }
      console.log("req.body:", positive_prompt, req.body);
      const { designBookId } = req.params;
      if (!designBookId || !mongoose.Types.ObjectId.isValid(designBookId)) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });

        return res.status(400).json({
          error: true,
          message: "Invalid or no paramter provided!",
        });
      }
      console.log("designBookId:", designBookId, "req.user.id:", req.user.id);
      const found_profile = await designBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });
      console.log("found_profile:", found_profile);

      if (!found_profile) {
        if (req.file)
          await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });

        return res.status(404).json({
          error: true,
          message: "No brand profile created",
        });
      }

      console.log("starting processing");

      const inputImagePath = req.file.path;

      console.log("inputImagePath:", inputImagePath);
      const fileStream = fs.createReadStream(inputImagePath);
      fileStream.on("error", (err) => {
        console.error("File stream error:", err);
      });
      fileStream.on("open", () => {
        console.log("File stream opened:", inputImagePath);
      });
      fileStream.on("close", () => console.log("Stream closed"));
      const formData = new FormData();
      console.log("Initialized form data");
      console.log("Form Data Headers 1:", formData.getHeaders());
      console.log("Form Data Values:", formData);
      console.log("Appending positive_prompt:", positive_prompt);
      formData.append("positive_prompt", positive_prompt);

      console.log("Appending number of images");
      formData.append("num_images", 1);

      console.log("Appending image file to formData");
      formData.append("input_image", fs.createReadStream(inputImagePath));
      console.log("Form Data Headers 2:", formData.getHeaders());

      console.time("API call");
      const response = await axios.post(
        `${process.env.IMAGING_BASE_URL}/illustration2studio_prompt`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${process.env.IMAGING_AUTH_KEY}`,
          },
          timeout: 15000,
        }
      );
      console.log("finished processing");

      if (
        !response.data ||
        !response.data.images ||
        !response.data.images.length
      ) {
        if (req.file)
          await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
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
      console.log("base64images:", base64images);

      const imageMimeType = response.data.images[0].image_mime_type;
      const fileExtension = imageMimeType.split("/")[1].toLowerCase();
      const buffer = Buffer.from(imageData.image_data, "base64");
      const uploadsDir = path.join(__dirname, "..", "output_uploads");

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
      }
      console.log("created directory");

      const uniqueSuffix = Date.now() + "-" + Math.floor(Math.random() * 1e9);
      const output_image_name = `output_image-${uniqueSuffix}.${fileExtension}`;
      const outputFilePath = path.join(uploadsDir, output_image_name);

      fs.writeFileSync(outputFilePath, buffer);
      console.log("finished processing");

      const newImageContent = await imageContent.create({
        userId: req.user.id,
        imageName: output_image_name,
        designBookId: designBookId,
      });
      if (req.file)
        await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      await notifications.create({
        userId: req.user.id,
        brief: "Created image content",
        briefModelType: "Image content",
        idOfCausingActivity: newImageContent._id,
      });
      res.json({
        success: true,
        newImageFilePath: outputFilePath,
        newImageContent,
        newImageContentBase64StringContent: base64images,
      });
    } catch (err) {
      if (req.file)
        await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });

      console.error(err), next(err.message);
    }
  })
);

module.exports = router;
