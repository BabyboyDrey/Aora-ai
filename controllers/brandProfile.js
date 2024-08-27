const Brandprofile = require("../models/brandProfile.js");
const router = require("express").Router();
const asyncErrCatcher = require("../middlewares/asyncErrCatcher.js");
const userAuth = require("../middlewares/userAuth.js");
const ZhipuAI = require("../utils/zhipuAi.js");

router.post(
  "/create-brand-profile",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const items = req.body;
      const data = {
        ...items,
        userId: req.user.id,
      };
      console.log("ids", data);
      await Brandprofile.create(data);

      res.status(200).json({
        success: true,
        message: "Brand profile created",
      });
    } catch (err) {
      console.error(err);
      res.status(200).json({
        error: true,
        message: err.message,
      });
    }
  })
);

router.get(
  "/create-brand-profile-trend-analysis",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const found_profile = await Brandprofile.findOne({
        userId: req.user.id,
      });

      if (!found_profile) {
        return res.status(404).json({
          error: true,
          message: "No brand profile created",
        });
      }
      console.log("/ll:", JSON.stringify(found_profile));
      const prompt = `Create a straight to the point trend analysis for this industry: ${found_profile.industry}`;
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

        const sections = cleanedMessage.split(/\d+\.\s+/).slice(1);

        console.log("Sections after split:", sections);

        const trendAnalysisContent = sections.map((section, index) => {
          const lines = section.trim().split(/\n+/);
          return {
            title: `Section ${index + 1}: ${lines[0]}`,
            points: lines.slice(1),
          };
        });

        console.log("Trend Analysis Content:", trendAnalysisContent);

        const trendAnalysis = {
          title: "Trend Analysis: " + found_profile.industry,
          content: trendAnalysisContent,
        };

        found_profile.trend_analysis = trendAnalysis;
        await found_profile.save();

        res.json({
          message: "Trend analysis updated successfully",
          trend_analysis: trendAnalysis,
        });
      } catch (err) {
        console.error("Failed to get response:", err);
        return res.status(500).json({
          error: true,
          message: "Failed to get response: " + err,
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: true,
        message: err.message,
      });
    }
  })
);

router.get(
  "/create-brand-customer-personas",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const found_profile = await Brandprofile.findOne({
        userId: req.user.id,
      });

      if (!found_profile) {
        return res.status(404).json({
          error: true,
          message: "No brand profile created",
        });
      }

      function formatTrendAnalysis(trendAnalysis) {
        let formattedOutput = `${trendAnalysis.title}\n\n`;

        trendAnalysis.content.forEach((section, index) => {
          formattedOutput += `**${index + 1}.** ${section.title}\n`;

          section.points.forEach((point) => {
            formattedOutput += `${point.trim()}\n`;
          });

          formattedOutput += `\n`;
        });

        return formattedOutput.trim();
      }

      const readableText = formatTrendAnalysis(found_profile.trend_analysis);
      console.log("Formatted Trend Analysis:", readableText);

      const prompt = `
      Create 3 distinct and realistic customer personas for the textile industry using the following trend analysis as a crucial data source. 
      The personas should be structured in JSON format with the following keys:
      - name
      - background
      - location
      - occupation
      - psychographic (a list of psychographic traits)
      - beliefs (a list of beliefs)
      - fears (a list of fears)
      - interests (a list of interests)
      - shopping_behavior (a list of shopping behaviors)
      - challenges (a list of challenges)
      - goals (a list of goals)

      Please wrap the JSON output between the delimiters "START_JSON" and "END_JSON".

      Trend analysis: ${readableText}

      Please return the response strictly in JSON format between the specified delimiters without any additional text or explanations.
      `;

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
      } catch (err) {
        console.error("Failed to get response:", err);
        return res.status(500).json({
          error: true,
          message: "Failed to get response: " + err,
        });
      }

      let cleanedMessage = response.choices[0].message.content.trim();
      let jsonContent = cleanedMessage.match(/START_JSON([\s\S]*?)END_JSON/);

      if (jsonContent) {
        try {
          const jsonResponse = JSON.parse(jsonContent[1].trim());
          console.log("Structured Personas:", jsonResponse);

          found_profile.customer_personas = jsonResponse;

          await found_profile.save();

          res.status(200).json({
            message: "Customer personas created successfully",
            customer_personas: found_profile.customer_personas,
          });
        } catch (jsonParseError) {
          console.error("Failed to parse JSON:", jsonParseError);

          try {
            let correctedJson = jsonContent[1]
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]");
            const jsonResponse = JSON.parse(correctedJson);

            console.log("Structured Personas (after cleanup):", jsonResponse);

            found_profile.customer_personas = jsonResponse;

            await found_profile.save();

            res.status(200).json({
              message: "Customer personas created successfully",
              customer_personas: found_profile.customer_personas,
            });
          } catch (finalJsonParseError) {
            console.error(
              "Failed to parse JSON after cleanup:",
              finalJsonParseError
            );
            return res.status(500).json({
              error: true,
              message:
                "Failed to parse JSON response: " + finalJsonParseError.message,
            });
          }
        }
      } else {
        return res.status(500).json({
          error: true,
          message: "Failed to extract JSON from the response",
        });
      }
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
