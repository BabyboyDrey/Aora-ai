const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const notifications = require("../models/notifications");
const router = require("express").Router();

router.get(
  "/get-user-notifications",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const userNotifications = await notifications
        .find({
          userId: req.user.id,
        })
        .sort({
          createdAt: -1,
        });
      if (userNotifications.length === 0) {
        throw new Error("No user notifications");
      }
      res.json({
        success: true,
        userNotifications,
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

module.exports = router;
