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

router.post(
  "/zhipu-prompt",
  asyncErrCatcher(async (req, res) => {
    try {
      const client = new ZhipuAI(process.env.ZHIPU_APP_KEY);
      const prompt = "Tell me about the history of nigeria.";

      async function getResponse() {
        try {
          const response = await client.chatCompletions(
            "glm-4",
            [
              {
                role: "user",
                content: prompt,
              },
            ],
            {
              max_tokens: 500,
              temperature: 0.7,
              top_p: 0.9,
            }
          );
          const cleanedMessage = response.choices[0].message.content
            .replace(/\n/g, " ")
            .trim();

          console.log(cleanedMessage);
          res.json({ content: cleanedMessage });

          //  content = content.replace(/\n/g, " ");

          //  // Example of additional formatting:
          //  content = content
          //    .replace(/ 1\. /g, "\n\n**1.** ") // Heading for the first section
          //    .replace(/ 2\. /g, "\n\n**2.** ") // Heading for the second section
          //    .replace(/ 3\. /g, "\n\n**3.** ") // and so on...
          //    .replace(/ 4\. /g, "\n\n**4.** ")
          //    .replace(/ 5\. /g, "\n\n**5.** ")
          //    .replace(/ 6\. /g, "\n\n**6.** ")
          //    .replace(/ 7\. /g, "\n\n**7.** ")
          //    .replace(/    - /g, "\n\n- "); // Bullet points

          //  console.log(content);
          //  res.json({ content });
        } catch (error) {
          console.error("Failed to get response:", error);
        }
      }

      getResponse();
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

router.put(
  "/update-user-avatar/:id",
  upload.single("avatar"),
  userAuth,
  asyncErrCatcher(async (req, res) => {
    try {
      const { id } = req.params;

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

      const imagePath = path.join(__dirname, `uploads/${req.file.filename}`);
      fs.readFile(imagePath, async (err, data) => {
        if (err) {
          console.error("Error reading image file:", err);
          return res.status(500).json({
            error: true,
            message: "Error reading image file",
          });
        }

        const base64Image = data.toString("base64");

        user.avatar = req.file.filename;
        user.avatar_base64_string = base64Image;
        user.updatedAt = new Date(Date.now());

        await user.save();

        res.status(200).json({
          success: true,
          message: "User avatar updated successfully",
          avatar: base64Image,
        });
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
