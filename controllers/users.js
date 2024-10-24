const Users = require("../models/users.js");
const VerificationCodes = require("../models/verificationCodes.js");
const TempUser = require("../models/tempUser.js");
const router = require("express").Router();
const asyncErrCatcher = require("../middlewares/asyncErrCatcher.js");
const bcrypt = require("bcryptjs");
const userAuthToken = require("../utils/userAuthToken.js");
const sendMail = require("../utils/sendMail.js");
const sendSmsVerificationCode = require("../utils/sendSms.js");
const passport = require("../utils/passport.js");
const { upload } = require("../multer/multer_image.js");
const mongoose = require("mongoose");
const checkAndDeleteFile = require("../utils/checkAndDeleteFile.js");
const userAuth = require("../middlewares/userAuth.js");
const OAuthToken = require("../models/oauthToken.js");
const deletePreviousSessions = require("../utils/deleteSessions.js");
const ZhipuAI = require("../utils/zhipuAi.js");
const { Prompt } = require("twilio/lib/twiml/VoiceResponse.js");
const path = require("path");
const fs = require("fs").promises;
const brandProfile = require("../models/brandProfile.js");
const designBook = require("../models/designBook.js");
const clothings = require("../models/clothings.js");
const designService = require("../models/designService.js");
const fabric = require("../models/fabric.js");
const imageContent = require("../models/imageContent.js");
const models = require("../models/models.js");
const styles = require("../models/styles.js");
const textContent = require("../models/textContent.js");

router.post(
  "/login",
  asyncErrCatcher(async (req, res) => {
    try {
      const items = req.body;
      let found_user;
      if (items.phone_number) {
        found_user = await Users.findOne({ phone_number: items.phone_number });
        console.log("lop:", found_user);
        if (!found_user) {
          return res.status(403).json({
            error: true,
            message: "User does not exist with this phone number",
          });
        }
      }
      if (items.email_address) {
        found_user = await Users.findOne({
          email_address: items.email_address,
        });
        if (!found_user) {
          return res.status(403).json({
            error: true,
            message: "User does not exist with this email address",
          });
        }
      }
      await deletePreviousSessions(found_user._id);

      const validated = await bcrypt.compare(
        req.body.password,
        found_user.password
      );

      if (!validated) {
        return res.status(400).json({
          error: true,
          message: "Wrong credentials, try again",
        });
      }
      userAuthToken(found_user, 200, res);
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
  "/sign-up",
  asyncErrCatcher(async (req, res) => {
    function generateVerificationCode() {
      return Math.floor(100000 + Math.random() * 900000);
    }
    try {
      const items = req.body;
      let found_user;
      console.log("nm", items);
      if (items.phone_number) {
        found_user = await Users.findOne({ phone_number: items.phone_number });
        if (found_user) {
          return res.status(403).json({
            error: true,
            message: "User does exist with this phone number",
          });
        }
      }
      if (items.email_address) {
        found_user = await Users.findOne({
          email_address: items.email_address,
        });
        console.log("kop", JSON.stringify(found_user));

        if (found_user) {
          return res.status(403).json({
            error: true,
            message: "User does exist with this email address",
          });
        }
      }

      if (items.password !== items.confirm_password) {
        return res.status(400).json({
          error: true,
          message: "Passwords do not match",
        });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPass = await bcrypt.hash(items.password, salt);

      const tempUser = {
        ...(items.email_address
          ? { email_address: items.email_address }
          : { phone_number: items.phone_number }),
        full_name: items.full_name,
        password: hashedPass,
      };

      await TempUser.deleteMany({
        $or: [
          { email_address: items.email_address },
          { phone_number: items.phone_number },
        ],
      });

      const verificationCode = generateVerificationCode();
      console.log("ui:", verificationCode);
      await TempUser.create({
        ...tempUser,
        verificationCode: verificationCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      if (items.email_address) {
        await sendMail({
          email: items.email_address,
          subject: "Activate your account",
          context: {
            userName: items.full_name,
            activationCode: verificationCode,
          },
        });
      } else if (items.phone_number) {
        await sendSmsVerificationCode(items.phone_number, verificationCode);
      }

      res.status(200).json({
        success: true,
        message: "Verification code sent",
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

// for `/sign-up`
router.post(
  "/create-user-verify-code",
  asyncErrCatcher(async (req, res) => {
    try {
      const { email_address, phone_number, code } = req.body;
      console.log("kl:", code);
      const tempUser = await TempUser.findOne({
        $or: [{ email_address }, { phone_number }],
        verificationCode: code,
      });
      console.log("loh:", JSON.stringify(tempUser));

      if (!tempUser) {
        return res.status(400).json({
          error: true,
          message: "Invalid or expired verification code",
        });
      }
      if (Number(tempUser.verificationCode) !== Number(code)) {
        return res.status(401).json({
          error: true,
          message: "Invalid or expired verification code",
        });
      }
      console.log("now:", Date.now(), "expiry:", tempUser.expiresAt);
      if (tempUser.expiresAt < Date.now()) {
        return res.status(400).json({
          error: true,
          message: "Verification code has expired",
        });
      }

      const newUser = await Users.create({
        email_address: tempUser.email_address,
        phone_number: tempUser.phone_number,
        full_name: tempUser.full_name,
        password: tempUser.password,
      });
      await deletePreviousSessions(newUser._id);

      await TempUser.deleteOne({ _id: tempUser._id });

      userAuthToken(newUser, 200, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: true,
        message: err.message,
      });
    }
  })
);

// for `/reset-password-p1`
router.post(
  "/verify-code",
  asyncErrCatcher(async (req, res) => {
    const { email_address, phone_number, code } = req.body;

    try {
      const verifiedCode = await VerificationCodes.findOne({
        $or: [{ email_address }, { phone_number }],
        verificationCode: code,
      });

      if (!verifiedCode) {
        return res.status(400).json({
          error: true,
          message: "Invalid or expired verification code",
        });
      }
      if (verifiedCode.verificationCode !== code) {
        return res.status(400).json({
          error: true,
          message: "Invalid or expired verification code",
        });
      }
      if (verifiedCode.expiresAt < Date.now()) {
        return res.status(400).json({
          error: true,
          message: "Verification code has expired",
        });
      }

      await VerificationCodes.deleteOne({ _id: verifiedCode._id });

      res.status(200).json({
        success: true,
        message: "Code verified",
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

router.post(
  "/reset-password-p1",
  asyncErrCatcher(async (req, res) => {
    function generateVerificationCode() {
      return Math.floor(100000 + Math.random() * 900000);
    }
    try {
      const items = req.body;
      let found_user;
      if (items.phone_number) {
        found_user = await Users.findOne({ phone_number: items.phone_number });
        if (!found_user) {
          return res.status(403).json({
            error: true,
            message: "User does not exist with this phone number",
          });
        }
      }
      if (items.email_address) {
        found_user = await Users.findOne({
          email_address: items.email_address,
        });
        if (!found_user) {
          return res.status(403).json({
            error: true,
            message: "User does not exist with this email address",
          });
        }
      }

      await VerificationCodes.deleteMany({
        $or: [
          { email_address: items.email_address },
          { phone_number: items.phone_number },
        ],
      });

      const verificationCode = generateVerificationCode();

      await VerificationCodes.create({
        email_address: items.email_address || null,
        phone_number: items.phone_number || null,
        verificationCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      if (items.email_address) {
        await sendMail({
          email: items.email_address,
          subject: "Account Verification Code",
          context: {
            userName: found_user.full_name,
            activationCode: verificationCode,
          },
        });
      } else if (items.phone_number) {
        await sendSmsVerificationCode(items.phone_number, verificationCode);
      }

      res.status(200).json({
        success: true,
        message: "Verification code sent",
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

router.post(
  "/reset-password-p2",
  asyncErrCatcher(async (req, res) => {
    try {
      const items = req.body;
      console.log("it:", items);
      const all_users = await Users.find({});

      let found_user;
      if (items.phone_number) {
        found_user = await Users.findOne({ phone_number: items.phone_number });
        if (!found_user) {
          return res.status(403).json({
            error: true,
            message: "User does not exist with this phone number",
          });
        }
      }
      if (items.email_address) {
        found_user = await Users.findOne({
          email_address: items.email_address,
        });
        if (!found_user) {
          return res.status(403).json({
            error: true,
            message: "User does not exist with this email address",
          });
        }
      }
      console.log("all:", all_users);

      if (items.password !== items.confirm_password) {
        return res.status(400).json({
          error: true,
          message: "Passwords do not match",
        });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPass = await bcrypt.hash(items.password, salt);
      console.log("user b4 updt:", found_user);
      found_user.password = hashedPass;
      found_user.updatedAt = new Date(Date.now());
      console.log("lop:", JSON.stringify(found_user), found_user.password);
      await found_user.save();

      res.status(200).json({
        success: true,
        message: "New Password saved",
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
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

router.get(
  "/auth/facebook/callback",
  (req, res, next) => {
    console.log("Facebook callback route hit");
    next();
  },
  passport.authenticate("facebook", {
    failureRedirect: "/",
  }),
  (req, res) => {
    console.log("Authentication successful:", req.user);
    userAuthToken(req.user, 200, res);
    res.redirect("http://localhost:5173/dashboard");
  }
);

router.get("/auth/wechat", passport.authenticate("wechat"));

router.get(
  "/auth/wechat/callback",
  (req, res, next) => {
    console.log("Wechat callback route hit");
    next();
  },
  passport.authenticate("wechat", {
    failureRedirect: "/",
  }),
  (req, res) => {
    console.log("WeChat Authentication successful:", req.user);
    userAuthToken(req.user, 200, res);
    res.redirect("http://localhost:5173/dashboard");
  }
);

router.post(
  "/auth-reset-password",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    try {
      const { currentPassword, confirmPassword, newPassword } = req.body;

      const foundUser = await Users.findOne({
        _id: req.user.id,
      });

      if (!foundUser) {
        throw new Error("User do not exist!");
      }

      const verifiedPassword = await bcrypt.compare(
        currentPassword,
        foundUser.password
      );

      if (!verifiedPassword) {
        throw new Error("Current Password is incoorect! Please try again.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirm password does not match!");
      }

      if (newPassword === currentPassword) {
        throw new Error("New password cannot be same as old password");
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      foundUser.password = hashedPassword;
      await foundUser.save();

      res.json({
        success: true,
        message: "New password saved!",
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.get(
  "/logout",
  userAuth,
  asyncErrCatcher(async (req, res) => {
    await OAuthToken.deleteMany({ userId: req.user.id })
      .then(() => {
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: "Failed to log out",
            });
          }

          res.cookie("user_token", "", {
            maxAge: 0,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });

          res.cookie("connect.sid", "", {
            maxAge: 0,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });

          res.status(200).json({
            success: true,
            message: "Logged out successfully",
          });
        });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: "Failed to delete oauth tokens hence failed to log out",
        });
      });
  })
);

router.delete(
  "/delete-user-avatar",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    async function safelyDeleteFiles(files) {
      try {
        console.log("files:", files);
        await Promise.all(
          files.map(async (file) => {
            await checkAndDeleteFile(`uploads/${file}`, (err) => {
              if (err) {
                console.error(`Error deleting file: ${file}`, err);
                reject(err);
              } else {
                resolve();
              }
            });
          })
        );
      } catch (err) {
        console.error("File deletion encountered errors", err);
      }
    }

    try {
      const foundUser = await Users.findById(req.user.id);
      if (!foundUser) {
        throw new Error("No user found!");
      }
      console.log("avatarPath:", foundUser.avatar);

      if (!foundUser.avatar) {
        throw new Error("Forbidden Action: No user avatar!");
      }

      if (foundUser.avatar) {
        await safelyDeleteFiles([foundUser.avatar]);
      }
      console.log("deleted image path successfully!");
      foundUser.avatar = "";
      foundUser.avatar_base64_string = "";
      await foundUser.save();

      res.json({
        success: true,
        message: "Avatar deleted!",
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.delete(
  "/delete-user-account",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    async function safelyDeleteFiles(files, location) {
      try {
        const deletePromises = files.map(async (file) => {
          const filePath = path.join(__dirname, "..", location, file);
          console.log("Checking file path:", filePath);

          try {
            await fs.access(filePath);
            console.log("File exists, proceeding to delete:", filePath);

            await fs.unlink(filePath);
            console.log("Deleted successfully:", filePath);
          } catch (err) {
            if (err.code === "ENOENT") {
              console.warn(`File not found: ${filePath}`);
            } else {
              console.error(`Error accessing file: ${filePath}`, err);
            }
          }
        });

        await Promise.allSettled(deletePromises);
        console.log("All deletion operations completed.");
      } catch (err) {
        console.error("File deletion encountered errors", err);
      }
    }

    async function deleteUserModels(userIds, userInstance) {
      const deletedUsers = await userInstance.deleteMany({
        _id: { $in: userIds },
      });
      console.log("deletedUsers:", deletedUsers);
    }

    async function deleteImages(modelInstance, modelName) {
      const deletePromises = [];

      modelInstance.forEach(async (instance) => {
        if (modelName === "designBook") {
          if (instance.imagesSavedFromWebPack.length > 0) {
            await safelyDeleteFiles(instance.imagesSavedFromWebPack, "uploads");
          }
        } else if (modelName === "clothing") {
          if (instance.clothing_image_name.length > 0) {
            await safelyDeleteFiles(
              instance.clothing_image_name,
              "output_uploads"
            );
          }
          if (instance.input_image) {
            await safelyDeleteFiles([instance.input_image], "uploads");
          }
          if (instance.style_image) {
            await safelyDeleteFiles([instance.style_image], "uploads");
          }
        } else if (modelName === "designService") {
          if (instance.serviceImage) {
            await safelyDeleteFiles([instance.serviceImage], "uploads");
          }
        } else if (modelName === "fabric") {
          if (instance.fabricImageName) {
            await safelyDeleteFiles([instance.fabricImageName]);
          }
        } else if (modelName === "imageContent") {
          if (instance.imageName) {
            await safelyDeleteFiles([instance.imageName]);
          }
        } else if (modelName === "model") {
          if (instance.model_image_name.length > 0) {
            await safelyDeleteFiles(
              instance.model_image_name,
              "output_uploads"
            );
          }
          if (instance.background_image || instance.pose_image) {
            await safelyDeleteFiles([instance.background_image], "uploads");
            await safelyDeleteFiles([instance.pose_image], "uploads");
          }
        } else if (modelName === "style") {
          if (instance.style_image_name.length > 0) {
            await safelyDeleteFiles(
              instance.style_image_name,
              "output_uploads"
            );
          }
          if (instance.input_image || instance.style_image) {
            await safelyDeleteFiles([instance.input_image], "uploads");
            await safelyDeleteFiles([instance.style_image], "uploads");
          }
        } else if (modelName === "avatar") {
          if (instance.avatar) {
            await safelyDeleteFiles([instance.avatar], "uploads");
          }
        }
      });

      await Promise.allSettled(deletePromises);
    }

    try {
      const foundUser = await Users.findById(req.user.id);
      if (!foundUser) {
        throw new Error("No user found!");
      }

      const foundBrandProfiles = await brandProfile.find({
        userId: req.user.id,
      });
      const foundDesignBooks = await designBook.find({ userId: req.user.id });
      const foundClothings = await clothings.find({ userId: req.user.id });
      const foundDesignServices = await designService.find({
        userId: req.user.id,
      });
      const foundFabrics = await fabric.find({ userId: req.user.id });
      const foundImageContents = await imageContent.find({
        userId: req.user.id,
      });
      const foundModels = await models.find({ userId: req.user.id });
      const foundStyles = await styles.find({ userId: req.user.id });
      const foundTextContents = await textContent.find({ userId: req.user.id });

      const allUserIds = [
        ...foundBrandProfiles.map((profile) => profile._id),
        ...foundDesignBooks.map((book) => book._id),
        ...foundClothings.map((clothing) => clothing._id),
        ...foundDesignServices.map((service) => service._id),
        ...foundFabrics.map((fabric) => fabric._id),
        ...foundImageContents.map((content) => content._id),
        ...foundModels.map((model) => model._id),
        ...foundStyles.map((style) => style._id),
        ...foundTextContents.map((text) => text._id),
      ];

      if (allUserIds.length > 0) {
        await Promise.all([
          deleteUserModels(allUserIds, brandProfile),
          deleteUserModels(allUserIds, designBook),
          deleteUserModels(allUserIds, clothings),
          deleteUserModels(allUserIds, designService),
          deleteUserModels(allUserIds, fabric),
          deleteUserModels(allUserIds, imageContent),
          deleteUserModels(allUserIds, models),
          deleteUserModels(allUserIds, styles),
          deleteUserModels(allUserIds, textContent),
        ]);
      }
      await Promise.all([
        deleteUserModels(allUserIds, brandProfile),
        deleteImages(foundUser, "avatar"),
        deleteImages(foundBrandProfiles, "brandProfile"),
        deleteImages(foundDesignBooks, "designBook"),
        deleteImages(foundClothings, "clothing"),
        deleteImages(foundDesignServices, "designService"),
        deleteImages(foundFabrics, "fabric"),
        deleteImages(foundImageContents, "imageContent"),
        deleteImages(foundModels, "model"),
        deleteImages(foundStyles, "style"),
        deleteImages(foundTextContents, "textContent"),
      ]);
      if (foundUser.avatar) {
        await fs.unlink();
      }
      await Users.deleteOne({ _id: foundUser._id });
      console.log("Deleted user and user data successfully!");

      res.json({
        success: true,
        message: "User account successfully deleted!",
      });
    } catch (err) {
      console.error(err);
      next(err.message);
    }
  })
);

router.put(
  "/update-user-avatar/:id",
  upload.single("avatar"),
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const { id } = req.params;
      console.log("id:", id);
      console.log("req.file:", req.file.filename);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return res.status(400).json({
          error: true,
          message: "Invalid ID format",
        });
      }

      const user = await Users.findById(id);
      console.log("user b4 update:", user);
      if (!user) {
        await new Promise((resolve, reject) => {
          checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return res.status(404).json({
          error: true,
          message: "No user with this ID",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: true,
          message: "No file sent",
        });
      }
      console.log("starting processing");

      const imagePath = req.file.path;
      let base64Image;
      console.log("imagePath:", imagePath);

      try {
        await fs.access(imagePath);
        console.log("File exists at the expected path.");
      } catch (err) {
        console.error("File does not exist at the path:", imagePath);
        return res.status(404).json({
          error: true,
          message: "File not found on server",
        });
      }

      try {
        const data = await fs.readFile(imagePath);
        base64Image = data.toString("base64");
      } catch (err) {
        if (err.code === "ENOENT") {
          console.warn("File not found, skipping base64 conversion.");
          base64Image = null;
        } else {
          console.error("Error reading image file:", err);
          return res.status(500).json({
            error: true,
            message: "Error processing image file",
          });
        }
      }

      user.avatar = req.file.filename;
      user.avatar_base64_string = base64Image;
      user.updatedAt = new Date(Date.now());
      await checkAndDeleteFile(`uploads/${user.avatar}`, (err) => {
        if (err) reject(err);
        else resolve();
      });

      console.log("user avatar deleted from filesystem");
      await user.save();
      console.log("user after update:", user);

      res.status(200).json({
        success: true,
        message: "User avatar updated successfully",
        avatar: base64Image,
      });
    } catch (err) {
      await new Promise((resolve, reject) => {
        checkAndDeleteFile(`uploads/${req.file.filename}`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.error(err);
      res.status(500).json({
        error: true,
        message: err.message,
      });
    }
  })
);

module.exports = router;
