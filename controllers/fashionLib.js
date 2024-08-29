const Replicate = require("replicate");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
require("dotenv").config();
const router = require("express").Router();

router.post(
  "/create-fashion",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    const outputDir = path.join(__dirname, "../output_uploads");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    try {
      console.log("route hit fs");
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });
      const result = await replicate.run(
        "halimalrasihi/flux-mystic-animals:294de709b06655e61bb0149ec61ef8b5d3ca030517528ac34f8252b18b09b7ad",
        {
          input: {
            model: "dev",
            prompt:
              "m1st1c,\n\nA majestic lion with dragon wings and a mane that glows like a sunset, standing proudly on a cliff overlooking a magical forest.\n\n, in the style of m1st1c",
            lora_scale: 1,
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "webp",
            guidance_scale: 3.5,
            output_quality: 80,
            extra_lora_scale: 0.8,
            num_inference_steps: 28,
          },
        }
      );

      const imageUrl = result[0];

      const response = await axios({
        url: imageUrl,
        responseType: "stream",
      });

      const fileName = `image_${Date.now()}.webp`;
      const filePath = path.join(outputDir, fileName);

      response.data.pipe(fs.createWriteStream(filePath));

      response.data.on("end", () => {
        console.log("Image successfully saved to:", filePath);
        res.json({
          message: "Image successfully saved",
          result,
        });
      });

      response.data.on("error", (err) => {
        console.error("Error saving image:", err);
        res.status(500).json({
          error: true,
          message: "Error saving image",
        });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: true,
        message: err.message,
      });
    }
  })
);

module.exports = router;
