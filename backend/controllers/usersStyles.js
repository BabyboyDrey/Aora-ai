// const router = require("express").Router();
// const { default: mongoose } = require("mongoose");
// const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
// const userAuth = require("../middlewares/userAuth");
// const DesignBook = require("../models/designBook");
// const UserStyles = require("../models/usersStyles");
// const { upload } = require("../multer/multer_png");
// const Replicate = require("replicate");
// const { default: axios } = require("axios");
// const checkAndDeleteFile = require("../utils/checkAndDeleteFile");

// router.get(
//   "/get",
//   asyncErrCatcher(async (req, res) => {
//     return res.status(200).json({
//       time: new Date().getTime(),
//     });
//   })
// );

// // router.post(
// //   "/upload-style/:designBookId",
// //   userAuth,
// //   upload.single("image"),
// //   asyncErrCatcher(async (req, res) => {
// //     try {
// //       const { designBookId } = req.params;

// //       const found_book = await DesignBook.findOne({
// //         _id: designBookId,
// //       });
// //       if (!mongoose.Types.ObjectId.isValid(designBookId) || !designBookId) {
// //         return res.status(400).json({
// //           error: true,
// //           message: "Invalid Id or no id provided",
// //         });
// //       }
// //       if (!found_book) {
// //         return res.status(403).json({
// //           error: true,
// //           message: "Action Forbidden! No design book with this id",
// //         });
// //       }
// //       if (!req.file)
// //         return res.status(400).json({
// //           error: true,
// //           message: "No file attached to request",
// //         });
// //       const image_name = req.file.filename;
// //       await UserStyles.create({
// //         image_name,
// //         userId: req.user.id,
// //         designBookId,
// //       });
// //       res.status(200).json({
// //         success: true,
// //         message: "User style created successfully",
// //       });
// //     } catch (err) {
// //       console.error(err);
// //       res.status(500).json({
// //         error: true,
// //         message: err.message,
// //       });
// //     }
// //   })
// // );

// // router.get(
// //   "/test",
// //   asyncErrCatcher(async (req, res) => {
// //     const generateImage = async (prompt) => {
// //       try {
// //         const response = await axios.post(
// //           "https://api.openai.com/v1/images/generations",
// //           {
// //             prompt: prompt,
// //             n: 1,
// //             size: "1024x1024",
// //             response_format: "url",
// //           },
// //           {
// //             headers: {
// //               Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
// //               "Content-Type": "application/json",
// //             },
// //           }
// //         );

// //         console.log("Generated Image URL:", response.data.data[0].url);
// //       } catch (error) {
// //         console.error(
// //           "Error generating image:",
// //           error.response ? error.response.data : error.message
// //         );
// //       }
// //     };

// //     generateImage("A futuristic city skyline at sunset");
// //   })
// // );

// // router.post(
// //   "/prompt-style/:designBookId",
// //   userAuth,
// //   asyncErrCatcher(async (req, res) => {
// //     let filePath;

// //     try {
// //       const { designBookId } = req.params;
// //       const prompt = req.body.prompt;
// //       const found_book = await DesignBook.findOne({ _id: designBookId });

// //       if (!mongoose.Types.ObjectId.isValid(designBookId) || !designBookId) {
// //         if (filePath) {
// //           await new Promise((resolve, reject) => {
// //             checkAndDeleteFile(filePath, (err) => {
// //               if (err) reject(err);
// //               else resolve();
// //             });
// //           });
// //         }
// //         return res.status(400).json({
// //           error: true,
// //           message: "Invalid Id or no id provided",
// //         });
// //       }
// //       if (!found_book) {
// //         if (filePath) {
// //           await new Promise((resolve, reject) => {
// //             checkAndDeleteFile(filePath, (err) => {
// //               if (err) reject(err);
// //               else resolve();
// //             });
// //           });
// //         }
// //         return res.status(403).json({
// //           error: true,
// //           message: "Action Forbidden! No design book with this id",
// //         });
// //       }
// //       if (!prompt || typeof prompt !== "string") {
// //         if (filePath) {
// //           await new Promise((resolve, reject) => {
// //             checkAndDeleteFile(filePath, (err) => {
// //               if (err) reject(err);
// //               else resolve();
// //             });
// //           });
// //         }
// //         return res.status(403).json({
// //           error: true,
// //           message: "Please provide a prompt!",
// //         });
// //       }

// //       const replicate = new Replicate({
// //         auth: process.env.REPLICATE_API_TOKEN,
// //       });
// //       const result = await replicate.run(
// //         "halimalrasihi/flux-mystic-animals:294de709b06655e61bb0149ec61ef8b5d3ca030517528ac34f8252b18b09b7ad",
// //         {
// //           input: {
// //             model: "dev",
// //             prompt: prompt,
// //             lora_scale: 1,
// //             num_outputs: 1,
// //             aspect_ratio: "1:1",
// //             output_format: "png",
// //             guidance_scale: 3.5,
// //             output_quality: 80,
// //             extra_lora_scale: 0.8,
// //             num_inference_steps: 28,
// //           },
// //         }
// //       );

// //       const imageUrl = result[0];
// //       const response = await axios({ url: imageUrl, responseType: "stream" });

// //       const fileName = `image-${Date.now()}-${Math.floor(
// //         Math.random() * 1e9
// //       )}.png`;
// //       const uploadsDir = path.join(__dirname, "..", "..", "uploads");
// //       if (!fs.existsSync(uploadsDir)) {
// //         fs.mkdirSync(uploadsDir, { recursive: true });
// //       }
// //       filePath = path.join(uploadsDir, fileName);

// //       response.data.pipe(fs.createWriteStream(filePath));

// //       response.data.on("end", async () => {
// //         console.log("Image successfully saved to:", filePath);
// //         await UserStyles.create({
// //           image_name: fileName,
// //           userId: req.user.id,
// //           designBookId,
// //         });
// //         res.status(200).json({
// //           success: true,
// //           message: "Image successfully saved",
// //           result,
// //         });
// //       });

// //       response.data.on("error", async (err) => {
// //         console.error("Error saving image:", err);
// //         if (filePath) {
// //           await new Promise((resolve, reject) => {
// //             checkAndDeleteFile(filePath, (err) => {
// //               if (err) reject(err);
// //               else resolve();
// //             });
// //           });
// //         }
// //         res.status(500).json({
// //           error: true,
// //           message: "Error saving image",
// //         });
// //       });
// //     } catch (err) {
// //       console.error(err);
// //       if (filePath) {
// //         await new Promise((resolve, reject) => {
// //           checkAndDeleteFile(filePath, (err) => {
// //             if (err) reject(err);
// //             else resolve();
// //           });
// //         });
// //       }
// //       res.status(500).json({
// //         error: true,
// //         message: err.message,
// //       });
// //     }
// //   })
// // );

// module.exports = router;
