const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const designBook = require("../models/designBook");
const textContent = require("../models/textContent");
const ZhipuAI = require("../utils/zhipuAi");

const router = require("express").Router();

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

module.exports = router;
