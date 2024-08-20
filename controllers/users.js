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

router.post(
  "/login",
  asyncErrCatcher(async (req, res) => {
    try {
      const items = req.body;
      let found_user;
      if (items.phone_number) {
        found_user = await Users.findOne({ phone_number: items.phone_number });
        if (!found_user) {
          return res.status(403).json({
            error: true,
            message: "User already exists with this phone number",
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
            message: "User already exists with this email address",
          });
        }
      }

      const validated = await bcrypt.compare(
        req.body.password,
        found_user.password
      );

      if (!validated) {
        return res.status(400).json("Wrong credentials, try again");
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
          message: "No user found",
        });
      }
      if (tempUser.verificationCode !== code) {
        return res.status(400).json({
          error: true,
          message: "Invalid or expired verification code",
        });
      }

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
          message: "No user found",
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
      if (items.password !== items.confirm_password) {
        return res.status(400).json({
          error: true,
          message: "Passwords do not match",
        });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPass = await bcrypt.hash(items.password, salt);

      found_user.password = hashedPass;
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
  }
);

router.get(
  "/logout",
  asyncErrCatcher((req, res) => {
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
);

module.exports = router;
