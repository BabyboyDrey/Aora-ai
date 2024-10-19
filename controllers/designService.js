const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const designService = require("../models/designService");
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
  upload.single("image"),
  asyncErrCatcher(async (req, res, next) => {
    try {
      if (!req.file) {
        throw new Error("Required image not provided!");
      }
      console.log("req.file:", req.file);

      const {
        serviceName,
        aboutService,
        standardPricing,
        premiumPricing,
        basicPricing,
      } = req.body;
      console.log(
        "req.body:",
        serviceName,
        aboutService,
        standardPricing,
        premiumPricing,
        basicPricing
      );

      if (
        !serviceName ||
        !aboutService ||
        !standardPricing ||
        !premiumPricing ||
        !basicPricing
      ) {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });

        throw new Error("Required parameters not provided or invalid!");
      }

      let parsedStandardPricing, parsedPremiumPricing, parsedBasicPricing;
      try {
        parsedStandardPricing = JSON.parse(standardPricing);
        parsedPremiumPricing = JSON.parse(premiumPricing);
        parsedBasicPricing = JSON.parse(basicPricing);
      } catch (parseError) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });

        throw new Error("Invalid JSON format in pricing fields!");
      }

      console.log(
        "Parsed pricing:",
        parsedStandardPricing,
        parsedPremiumPricing,
        parsedBasicPricing
      );
      console.log("started processing logic");
      const foundService = await designService.findOne({
        serviceName,
      });
      console.log("foundService?:", foundService ? true : false);

      if (foundService) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });

        throw new Error("Service exists with this name");
      }
      console.log("Passed found service check!");

      const newDesignService = await designService.create({
        userId: req.user.id,
        serviceName,
        aboutService,
        image: req.file.filename,
        standardPricing: parsedStandardPricing,
        premiumPricing: parsedPremiumPricing,
        basicPricing: parsedBasicPricing,
      });
      console.log("newDesignService:", newDesignService);

      res.json({
        success: true,
        newDesignService,
      });
    } catch (err) {
      if (req.file) {
        await checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
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
        throw new Error("No design service created!");
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
