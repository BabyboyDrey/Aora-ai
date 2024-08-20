const Brandprofile = require("../models/brandProfile.js");
const router = require("express").Router();
const asyncErrCatcher = require("../middlewares/asyncErrCatcher.js");
const userAuth = require("../middlewares/userAuth.js");

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

module.exports = router;
