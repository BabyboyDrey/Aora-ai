const router = require("express").Router();
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const DesignBook = require("../models/designBook");

router.post(
  "/create-design-book",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const items = req.body;
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}${month}${day}`;
      };
      const designName =
        items.book_name || `Design-${formatDate(new Date())}-${Date.now()}`;

      const foundDesignBook = await DesignBook.findOne({
        userId: req.user.id,
        book_name: designName,
      });

      if (foundDesignBook) {
        return res.status(409).json({
          error: true,
          message: "Design Book already created with this name!",
        });
      }

      await DesignBook.create({
        book_name: designName,
        userId: req.user.id,
      });
      res.status(200).json({
        success: true,
        message: "Design book created successfully",
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        error: true,
        message: err.message,
      });
    }
  })
);

module.exports = router;
