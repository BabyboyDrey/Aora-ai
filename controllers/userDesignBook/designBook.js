const router = require("express").Router();
const asyncErrCatcher = require("../../middlewares/asyncErrCatcher");
const userAuth = require("../../middlewares/userAuth");
const DesignBook = require("../../models/userDesignBook/designBook");

router.post(
  "/create-design-book",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const items = req.body;
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed
        const day = String(date.getDate()).padStart(2, "0"); // Day of the month

        return `${year}${month}${day}`;
      };

      const designName = `Design-${formatDate(new Date())}-${Date.now()}`;
      await DesignBook.create({
        book_name: items.book_name ? items.book_name : designName,
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
