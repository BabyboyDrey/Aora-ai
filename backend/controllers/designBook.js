const router = require("express").Router();
const asyncErrCatcher = require("../middlewares/asyncErrCatcher");
const userAuth = require("../middlewares/userAuth");
const clothings = require("../models/clothings");
const DesignBook = require("../models/designBook");
const fabric = require("../models/fabric");
const models = require("../models/models");
const styles = require("../models/styles");
const textContent = require("../models/textContent");

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

router.get(
  "/get-user-design-book",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const allBooks = await DesignBook.find({
        userId: req.user.id,
      });

      if (allBooks.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No design book created for this user",
        });
      }

      res.json({
        success: true,
        allBooks,
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  })
);

router.get(
  "/get-all-design-book-contents/:designBookId",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { designBookId } = req.params;
      if (!designBookId) {
        throw new Error("Required parameter not provided!");
      }
      const foundDesignBook = await DesignBook.findOne({
        userId: req.user.id,
        _id: designBookId,
      });

      if (!foundDesignBook) {
        throw new Error("Design book not found!");
      }

      const foundClothes = await clothings.find({
        designBookId: designBookId,
        userId: req.user.id,
      });
      const foundFabrics = await fabric.find({
        designBookId: designBookId,
        userId: req.user.id,
      });
      const foundModels = await models.find({
        designBookId: designBookId,
        userId: req.user.id,
      });
      const foundStyles = await styles.find({
        designBookId: designBookId,
        userId: req.user.id,
      });
      const foundTextContent = await textContent.find({
        designBookId: designBookId,
        userId: req.user.id,
      });

      if (
        foundClothes.length === 0 &&
        foundFabrics.length === 0 &&
        foundModels.length === 0 &&
        foundStyles.length === 0 &&
        foundTextContent.length === 0
      ) {
        return res.status(200).json({
          success: false,
          message: "No data created",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          foundClothes,
          foundFabrics,
          foundModels,
          foundStyles,
          foundTextContent,
        },
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

module.exports = router;
