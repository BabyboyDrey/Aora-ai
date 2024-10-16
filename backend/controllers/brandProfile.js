const Brandprofile = require("../models/brandProfile.js");
const router = require("express").Router();
const asyncErrCatcher = require("../middlewares/asyncErrCatcher.js");
const userAuth = require("../middlewares/userAuth.js");
const ZhipuAI = require("../utils/zhipuAi.js");
const brandProfile = require("../models/brandProfile.js");
const Pricing = require("twilio/lib/rest/Pricing.js");
require("dotenv").config();

router.post(
  "/create-brand-profile",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const items = req.body;
      console.log("/;L", items);
      const data = {
        ...items,
        userId: req.user.id,
      };
      console.log("ids", data);
      const all_profiles = await Brandprofile.find({
        userId: req.user.id,
      });
      console.log("//;;pp//:", JSON.stringify(all_profiles));

      if (all_profiles) {
        const existing_industry = all_profiles.find(
          (e) => e.industry === items.industry
        );
        console.log("eerrtty:", existing_industry);

        if (existing_industry) {
          return res.status(404).json({
            error: true,
            message: "Brand profile created with this industry.",
          });
        }
      }
      const created_brand = await Brandprofile.create(data);

      res.status(200).json({
        success: true,
        message: "Brand profile created",
        created_brand,
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
  "/create-brand-profile-trend-analysis/:id",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const { id } = req.params;
      const found_profile = await Brandprofile.findOne({
        userId: req.user.id,
        _id: id,
      });
      if (!found_profile) {
        return res.status(404).json({
          error: true,
          message: "No brand profile created",
        });
      }
      console.log("/ll:", JSON.stringify(found_profile));
      //   console.log("oiu:", process.env.ZHIPU_APP_KEY);
      const prompt = `Create a straight to the point and realistic trend analysis for this industry: ${found_profile.industry}`;
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
            max_tokens: 700,
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
          found_profile,
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
  "/create-brand-customer-personas/:id",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const found_profile = await Brandprofile.findOne({
        userId: req.user.id,
        _id: req.params.id,
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
      Create 3 distinct and realistic customer personas for the ${found_profile.industry} industry using the following trend analysis as a crucial data source. 
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
            found_profile,
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
              found_profile,
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

router.post(
  "/set-customer-persona/:id",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const { id } = req.params;
      const { customerId } = req.query;

      const brandProfile = await Brandprofile.findOne({
        userId: req.user.id,
        _id: id,
        "customer_personas._id": customerId,
      });
      console.log("bp:", brandProfile);
      if (!brandProfile) {
        return res.status(404).json({
          error: true,
          message: "Brand profile or customer persona not found.",
        });
      }

      const foundCustomerPersona = brandProfile.customer_personas.find(
        (persona) => persona._id.toString() === customerId
      );

      if (!foundCustomerPersona) {
        return res.status(404).json({
          error: true,
          message: "Customer persona not found.",
        });
      }

      brandProfile.customer_personas = [];
      brandProfile.selected_customer_persona = foundCustomerPersona;

      await brandProfile.save();

      res.json({
        result: brandProfile.selected_customer_persona,
        brandProfile,
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

router.get(
  "/set-pricing-analysis/:id",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const { id } = req.params;

      const brandProfile = await Brandprofile.findOne({
        userId: req.user.id,
        _id: id,
      });
      console.log("bp:", brandProfile);
      if (!brandProfile) {
        return res.status(404).json({
          error: true,
          message: "Brand profile not found.",
        });
      }

      function formatCustomerPersona(customerPersona) {
        let formattedOutput = `**Customer Persona: ${customerPersona.name}**\n\n`;

        if (customerPersona.background.length > 0) {
          formattedOutput += `**Background:**\n`;
          customerPersona.background.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.location) {
          formattedOutput += `**Location:** ${customerPersona.location}\n\n`;
        }

        if (customerPersona.occupation) {
          formattedOutput += `**Occupation:** ${customerPersona.occupation}\n\n`;
        }

        if (customerPersona.psychographic.length > 0) {
          formattedOutput += `**Psychographic:**\n`;
          customerPersona.psychographic.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.beliefs.length > 0) {
          formattedOutput += `**Beliefs:**\n`;
          customerPersona.beliefs.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.fears.length > 0) {
          formattedOutput += `**Fears:**\n`;
          customerPersona.fears.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.interests.length > 0) {
          formattedOutput += `**Interests:**\n`;
          customerPersona.interests.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.shopping_behavior.length > 0) {
          formattedOutput += `**Shopping Behavior:**\n`;
          customerPersona.shopping_behavior.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.challenges.length > 0) {
          formattedOutput += `**Challenges:**\n`;
          customerPersona.challenges.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.goals.length > 0) {
          formattedOutput += `**Goals:**\n`;
          customerPersona.goals.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        return formattedOutput.trim();
      }

      const readableText = formatCustomerPersona(
        brandProfile.selected_customer_persona
      );
      console.log("Formatted Customer Persona:", readableText);

      const prompt = `
      Create one distinct and realistic pricing analysis for the ${brandProfile.industry} industry using the following customer persona as a crucial data source. 
      The analysis should be structured in JSON format with the following keys:
      1. marketResearch (object):
       - marketSize (Number)
       - marketGrowthRate (Number)
       - customerSegments (String)
       - economicConditions (String)
      2. competitorPricing (Array of objects):
       - competitorName(String)
       - pricePoints (Array of numbers)
       - pricingModel (String),
       - discountingPractices (String)
      3. costStructure (object):
       - costOfGoodsSold (Number)
       - fixedCosts (Number)
       - variableCosts (Number)
       - breakEvenPoint (Number)
      4. pricingObjectives (object):
       - profitabilityGoals (String)
       - marketShareGoals (String)
       - customerValuePerception (String)
      5. pricingStrategies (Array of objects):
       - strategyType (String)
       - description (String)
      6. priceSensitivityAnalysis (object):
       - elasticityOfDemand (Number)
       - customerFeedback (String)
       - abTestingResults (String)
      7. legalEthicalConsiderations (object):
       - priceDiscrimination (Boolean)
       - antitrustCompliance (Boolean)
       - fairTradePractices (Boolean)
      8. discountingPromotions (Array of objects):
       - discountType (String)
       - impactOnBrand (String)
       - profitabilityImpact (Number)
      9. pricingImplementation (object):
       - pricingCommunication (String)
       - channelPricing (String)
       - monitoringAdjustments (String)
      10. salesProfitability (object):
       - salesForecasting (String)
       - profitMargin (Number)
       - revenueImpact (Number)
      11. riskAnalysis (object):
       - marketRisks (String)
       - customerRisks (String)
       - operationalRisks (String)

      Please wrap the JSON output between the delimiters "START_JSON" and "END_JSON".

      Customer persona: ${readableText}

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

      console.log("AI Response:", response.choices[0].message.content.trim());

      let cleanedMessage = response.choices[0].message.content.trim();
      let jsonContent = cleanedMessage.match(/START_JSON([\s\S]*?)END_JSON/);
      if (jsonContent) {
        try {
          const jsonResponse = JSON.parse(jsonContent[1].trim());
          console.log("Structured Pricing Analysis:", jsonResponse);
          brandProfile.pricing_analysis = jsonResponse;
          await brandProfile.save();
          res.json({
            message: "Pricing analysis created successfully",
            pricing_analysis: brandProfile.pricing_analysis,
            brandProfile,
          });
        } catch (jsonParseError) {
          console.error("Failed to parse JSON:", jsonParseError);

          try {
            let correctedJson = jsonContent[1]
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]");
            const jsonResponse = JSON.parse(correctedJson);

            console.log(
              "Structured Pricing Analysis (after cleanup):",
              jsonResponse
            );
            brandProfile.pricing_analysis = jsonResponse;
            await brandProfile.save();

            res.json({
              message: "Pricing analysis created successfully",
              pricing_analysis: brandProfile.pricing_analysis,
              brandProfile,
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

router.post(
  "/create-mtp/:id",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const { id } = req.params;
      const items = req.body.massive_transformational_purpose;
      console.log("items:", items);
      const brandProfile = await Brandprofile.findOne({
        userId: req.user.id,
        _id: id,
      });
      console.log("bp:", brandProfile);
      if (!brandProfile) {
        return res.status(404).json({
          error: true,
          message: "Brand profile or customer persona not found.",
        });
      }
      function formatCustomerPersona(customerPersona) {
        let formattedOutput = `**Customer Persona: ${customerPersona.name}**\n\n`;

        if (customerPersona.background.length > 0) {
          formattedOutput += `**Background:**\n`;
          customerPersona.background.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.location) {
          formattedOutput += `**Location:** ${customerPersona.location}\n\n`;
        }

        if (customerPersona.occupation) {
          formattedOutput += `**Occupation:** ${customerPersona.occupation}\n\n`;
        }

        if (customerPersona.psychographic.length > 0) {
          formattedOutput += `**Psychographic:**\n`;
          customerPersona.psychographic.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.beliefs.length > 0) {
          formattedOutput += `**Beliefs:**\n`;
          customerPersona.beliefs.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.fears.length > 0) {
          formattedOutput += `**Fears:**\n`;
          customerPersona.fears.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.interests.length > 0) {
          formattedOutput += `**Interests:**\n`;
          customerPersona.interests.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.shopping_behavior.length > 0) {
          formattedOutput += `**Shopping Behavior:**\n`;
          customerPersona.shopping_behavior.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.challenges.length > 0) {
          formattedOutput += `**Challenges:**\n`;
          customerPersona.challenges.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        if (customerPersona.goals.length > 0) {
          formattedOutput += `**Goals:**\n`;
          customerPersona.goals.forEach((item) => {
            formattedOutput += `- ${item.trim()}\n`;
          });
          formattedOutput += `\n`;
        }

        return formattedOutput.trim();
      }
      const readableCustomerPersonaText = formatCustomerPersona(
        brandProfile.selected_customer_persona
      );
      console.log("Formatted Customer Persona:", readableCustomerPersonaText);
      function formatTransformationalPurpose(purposeObj) {
        let formattedOutput = `**Massive Transformational Purpose:**\n\n`;

        if (purposeObj.what_do_your_brand_care_about_and_why) {
          formattedOutput += `**What Does Your Brand Care About and Why?**\n`;
          formattedOutput += `- ${purposeObj.what_do_your_brand_care_about_and_why.trim()}\n\n`;
        }

        if (purposeObj.what_is_yuor_brand_purpose) {
          formattedOutput += `**What Is Your Brand's Purpose?**\n`;
          formattedOutput += `- ${purposeObj.what_is_yuor_brand_purpose.trim()}\n\n`;
        }

        if (purposeObj.what_does_the_world_need_from_your_industry_and_why) {
          formattedOutput += `**What Does the World Need from Your Industry and Why?**\n`;
          formattedOutput += `- ${purposeObj.what_does_the_world_need_from_your_industry_and_why.trim()}\n\n`;
        }

        if (purposeObj.what_would_you_do_if_you_couldnt_fail_and_why) {
          formattedOutput += `**What Would You Do if You Couldn't Fail and Why?**\n`;
          formattedOutput += `- ${purposeObj.what_would_you_do_if_you_couldnt_fail_and_why.trim()}\n\n`;
        }

        if (
          purposeObj.what_would_we_do_if_we_received_a_billion_dollars_today_and_why
        ) {
          formattedOutput += `**What Would We Do if We Received a Billion Dollars Today and Why?**\n`;
          formattedOutput += `- ${purposeObj.what_would_we_do_if_we_received_a_billion_dollars_today_and_why.trim()}\n\n`;
        }

        return formattedOutput.trim();
      }

      const formattedMTPurposeText = formatTransformationalPurpose(items);
      console.log(
        "Formatted Transformational Purpose:",
        formattedMTPurposeText
      );
      const prompt = `
      Based on the customer persona and target market make realistic and concrete suggestions for ${brandProfile.company_name} massive transformational purpose to improve the massive transformational purpose.  The suggestions should be structured in JSON format with the following keys:

      1. what_do_your_brand_care_about_and_why (String)
      2. what_is_yuor_brand_purpose (String)
      3. what_does_the_world_need_from_your_industry_and_why (String)
      4. what_would_you_do_if_you_couldnt_fail_and_why (String)
      5. what_would_we_do_if_we_received_a_billion_dollars_today_and_why (String)

      Please wrap the JSON output between the delimiters "START_JSON" and "END_JSON".

      Customer persona: ${readableCustomerPersonaText}
      Target market: ${brandProfile.target_market}
      massive transformational purpose: ${formattedMTPurposeText}

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
      console.log("AI Response:", response.choices[0].message.content.trim());
      let cleanedMessage = response.choices[0].message.content.trim();
      let jsonContent = cleanedMessage.match(/START_JSON([\s\S]*?)END_JSON/);
      if (jsonContent) {
        try {
          const jsonResponse = JSON.parse(jsonContent[1].trim());
          console.log("Structured Data:", jsonResponse);
          brandProfile.massive_transformational_purpose = items;
          brandProfile.suggestions_for_mtp = jsonResponse;
          await brandProfile.save();
          res.json({
            message: "Suggestions created successfully",
            suggestions: jsonResponse,
            brandProfile,
          });
        } catch (jsonParseError) {
          console.error("Failed to parse JSON:", jsonParseError);

          try {
            let correctedJson = jsonContent[1]
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]");
            const jsonResponse = JSON.parse(correctedJson);

            console.log("Data(after cleanup):", jsonResponse);
            brandProfile.suggestions_for_mtp = jsonResponse;

            brandProfile.massive_transformational_purpose = items;
            await brandProfile.save();
            res.json({
              message: "Suggestions created successfully",
              suggestions: jsonResponse,
              brandProfile,
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

router.get(
  "/get-all-brand-profiles",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const allBrandProfiles = await Brandprofile.find({
        userId: req.user.id,
      }).sort({
        createdAt: -1,
      });

      if (allBrandProfiles.length === 0)
        return res.status(404).json({
          error: true,
          message: "No brand profile found",
        });

      res.json({
        allBrandProfiles,
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
