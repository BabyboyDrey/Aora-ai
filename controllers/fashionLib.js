// const Replicate = require("replicate");
// const fs = require("fs");
// const path = require("path");
// const axios = require("axios");
// const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
// const userAuth = require("../middlewares/userAuth");
// const FormData = require("form-data");
// const { upload } = require("../multer/multer_png");
// require("dotenv").config();
// const router = require("express").Router();

// // router.post(
// //   "/test",
// //   upload.fields([{ name: "input_image" }, { name: "style_image" }]),
// //   asyncErrCatcher(async (req, res) => {
// //     try {
// //       const { positive_prompt, negative_prompt, seed, cfg } = req.body;

// //       // Check if files exist in the request
// //       if (!req.files.input_image || !req.files.style_image) {
// //         return res
// //           .status(400)
// //           .json({ error: "Missing input_image or style_image" });
// //       }

// //       // Get the file paths for the uploaded images
// //       const inputImageFilePath = req.files.input_image[0].path;
// //       const styleImageFilePath = req.files.style_image[0].path;

// //       // Create FormData instance
// //       const formData = new FormData();
// //       formData.append("positive_prompt", positive_prompt);
// //       formData.append("negative_prompt", negative_prompt);
// //       formData.append("seed", seed);
// //       formData.append("cfg", cfg);
// //       formData.append("input_image", fs.createReadStream(inputImageFilePath));
// //       formData.append("style_image", fs.createReadStream(styleImageFilePath));

// //       const response = await axios.post(
// //         "http://129.204.16.241:8000/illustration2studio_style",
// //         formData,
// //         {
// //           headers: {
// //             ...formData.getHeaders(),
// //             Authorization: `Bearer 259a686cefdfb8b6afd6d3584318f41aab32856ed0a1c922b9f936aa948373db`, // Authorization token
// //           },
// //         }
// //       );

// //       // Ensure the uploads directory exists
// //       const uploadsDir = path.join(__dirname, "output_uploads");
// //       if (!fs.existsSync(uploadsDir)) {
// //         fs.mkdirSync(uploadsDir);
// //       }

// //       // Extract the image data and MIME type from the response
// //       const imageData = response.data.images[0].image_data;
// //       const imageMimeType = response.data.images[0].image_mime_type; // Example: "image/PNG"

// //       // Determine the file extension based on the MIME type
// //       const fileExtension = imageMimeType.split("/")[1].toLowerCase(); // Will be "png" or "jpeg"

// //       // Decode the base64 image data
// //       const buffer = Buffer.from(imageData, "base64");

// //       // Define the output file path
// //       const outputFilePath = path.join(
// //         __dirname,
// //         "..",
// //         "uploads",
// //         `output_image.${fileExtension}`
// //       );

// //       // Write the image data to a file
// //       fs.writeFileSync(outputFilePath, buffer);

// //       console.log(`Image saved as ${outputFilePath}`);
// //       res.status(200).json({
// //         message: `Image saved as ${outputFilePath}`,
// //         data: response.data,
// //       });
// //     } catch (err) {
// //       console.error("Error occurred during API request:", err.message);
// //       res
// //         .status(500)
// //         .json({ error: "Internal Server Error", message: err.message });
// //     }
// //   })
// // );
// router.post(
//   "/test",
//   upload.fields([{ name: "input_image" }, { name: "style_image" }]),
//   asyncErrCatcher(async (req, res) => {
//     try {
//       const { pants } = req.body;

//       // Check if both files exist in the request
//       if (!req.files["input_image"] || !req.files["style_image"]) {
//         return res.status(400).json({ error: "Missing required images" });
//       }

//       // Corrected file paths from the multer configuration
//       const inputImagePath = req.files["input_image"][0].path;
//       const styleImagePath = req.files["style_image"][0].path;

//       // Create FormData instance
//       const formData = new FormData();
//       formData.append("pants", pants);
//       formData.append("input_image", fs.createReadStream(inputImagePath));
//       formData.append("style_image", fs.createReadStream(styleImagePath));

//       const response = await axios.post(
//         "http://129.204.16.241:8000/change_style",
//         formData,
//         {
//           headers: {
//             ...formData.getHeaders(),
//             Authorization: `Bearer 259a686cefdfb8b6afd6d3584318f41aab32856ed0a1c922b9f936aa948373db`,
//           },
//         }
//       );

//       // Handle response data properly
//       if (
//         !response.data ||
//         !response.data.images ||
//         !response.data.images.length
//       ) {
//         throw new Error("Invalid response from the API: Missing image data.");
//       }

//       const imageData = response.data.images[0].image_data;
//       const imageMimeType = response.data.images[0].image_mime_type;
//       const fileExtension = imageMimeType.split("/")[1].toLowerCase();
//       const buffer = Buffer.from(imageData, "base64");
//       const uploadsDir = path.join(__dirname, "..", "output_uploads");

//       if (!fs.existsSync(uploadsDir)) {
//         fs.mkdirSync(uploadsDir);
//       }

//       const outputFilePath = path.join(
//         uploadsDir,
//         `output_image.${fileExtension}`
//       );
//       fs.writeFileSync(outputFilePath, buffer);

//       res.status(200).json({
//         message: `Image saved as ${outputFilePath}`,
//         data: response.data,
//       });
//     } catch (err) {
//       console.error("Error occurred during API request:", err.message);
//       res
//         .status(500)
//         .json({ error: "Internal Server Error", message: err.message });
//     }
//   })
// );
// //replicate
// // router.post(
// //   "/create-fashion",
// //   userAuth,
// //   asyncErrCatcher(async (req, res) => {
// //     const outputDir = path.join(__dirname, "../output_uploads");

// //     if (!fs.existsSync(outputDir)) {
// //       fs.mkdirSync(outputDir, { recursive: true });
// //     }
// //     try {
// //       console.log("route hit fs");
// //       const replicate = new Replicate({
// //         auth: process.env.REPLICATE_API_TOKEN,
// //       });
// //       const result = await replicate.run(
// //         "halimalrasihi/flux-mystic-animals:294de709b06655e61bb0149ec61ef8b5d3ca030517528ac34f8252b18b09b7ad",
// //         {
// //           input: {
// //             model: "dev",
// //             prompt:
// //               "m1st1c,\n\nA majestic lion with dragon wings and a mane that glows like a sunset, standing proudly on a cliff overlooking a magical forest.\n\n, in the style of m1st1c",
// //             lora_scale: 1,
// //             num_outputs: 1,
// //             aspect_ratio: "1:1",
// //             output_format: "webp",
// //             guidance_scale: 3.5,
// //             output_quality: 80,
// //             extra_lora_scale: 0.8,
// //             num_inference_steps: 28,
// //           },
// //         }
// //       );

// //       const imageUrl = result[0];

// //       const response = await axios({
// //         url: imageUrl,
// //         responseType: "stream",
// //       });

// //       const fileName = `image_${Date.now()}.webp`;
// //       const filePath = path.join(outputDir, fileName);

// //       response.data.pipe(fs.createWriteStream(filePath));

// //       response.data.on("end", () => {
// //         console.log("Image successfully saved to:", filePath);
// //         res.json({
// //           message: "Image successfully saved",
// //           result,
// //         });
// //       });

// //       response.data.on("error", (err) => {
// //         console.error("Error saving image:", err);
// //         res.status(500).json({
// //           error: true,
// //           message: "Error saving image",
// //         });
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

// module.exports = router;
