const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const designService = require("../models/designService");
const notifications = require("../models/notifications");
const { upload } = require("../multer/multer_png");
const checkAndDeleteFile = require("../utils/checkAndDeleteFile");

const router = require("express").Router();

router.get(
  "/get-all-design-services",
  asyncErrCatcher(async (req, res, next) => {
    try {
      const foundDesignServices = await designService.find({});
      if (foundDesignServices.length === 0) {
        throw new Error("No design service created!");
      }
      res.json({
        success: true,
        allfoundDesignServices: foundDesignServices,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.post(
  "/create-design-service",
  userAuth,
  upload.single("serviceImage"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      if (!req.file) {
        throw new Error("Required image not provided!");
      }
      console.log("req.file:", req.file);

      const {
        serviceName,
        serviceDescription,
        serviceCategory,
        basicPlan,
        standardPlan,
        premiumPlan,
      } = req.body;

      console.log(
        "req.body:",
        serviceName,
        serviceDescription,
        basicPlan,
        standardPlan,
        premiumPlan
      );

      if (
        !serviceName ||
        !serviceDescription ||
        !serviceCategory ||
        !basicPlan ||
        !standardPlan ||
        !premiumPlan
      ) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Required parameters not provided or invalid!");
      }

      let parsedBasicPlan, parsedStandardPlan, parsedPremiumPlan;
      try {
        parsedBasicPlan =
          typeof basicPlan === "string" ? JSON.parse(basicPlan) : basicPlan;
        parsedStandardPlan =
          typeof standardPlan === "string"
            ? JSON.parse(standardPlan)
            : standardPlan;
        parsedPremiumPlan =
          typeof premiumPlan === "string"
            ? JSON.parse(premiumPlan)
            : premiumPlan;
      } catch (parseError) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Invalid JSON format in pricing fields!");
      }

      console.log(
        "Parsed pricing:",
        parsedBasicPlan,
        parsedStandardPlan,
        parsedPremiumPlan
      );

      const foundService = await designService.findOne({
        serviceName,
      });
      console.log("foundService?:", foundService ? true : false);

      if (foundService) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw new Error("Service exists with this name");
      }

      const newDesignService = await designService.create({
        userId: req.user.id,
        serviceName,
        serviceDescription,
        serviceCategory,
        serviceImage: req.file.filename,
        plans: {
          basicPlan: parsedBasicPlan,
          standardPlan: parsedStandardPlan,
          premiumPlan: parsedPremiumPlan,
        },
      });
      console.log("newDesignService:", newDesignService);
      await notifications.create({
        userId: req.user.id,
        brief: "Created a design service",
        briefModelType: "Design service",
        idOfCausingActivity: newDesignService._id,
      });
      res.json({
        success: true,
        newDesignService,
      });
    } catch (err) {
      if (req.file) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      console.error(err);
      next(err.message);
    }
  })
);

router.get(
  "/get-user-design-services",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const foundDesignServices = await designService.find({
        userId: req.user.id,
      });
      if (foundDesignServices.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No design service created!",
        });
      }
      res.json({
        success: true,
        foundDesignServices,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

module.exports = router;
