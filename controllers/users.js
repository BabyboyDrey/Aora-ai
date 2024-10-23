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
const fs = require("fs/promises");
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

// Route to delete user account
// router.delete(
//   "/delete-user-account",
//   userAuth,
//   asyncErrCatcher(async (req, res, next) => {
//     async function safelyDeleteFiles(files, location) {
//       const deletePromises = files.map((file) => {
//         console.log(`Deleting file: ${file} under  ${location}`);
//         return new Promise((resolve, reject) => {
//           checkAndDeleteFile(`${location}/${file}`, (err) => {
//             if (err) {
//               console.error(`Error deleting file: ${file}`, err);
//               reject(err);
//             } else {
//               resolve();
//             }
//           });
//         });
//       });
//       return Promise.all(deletePromises);
//     }

//     async function deleteUserModels(userIds, userInstance) {
//       console.log(`Deeleting models: ${userIds}`);
//       return userInstance.deleteMany({ _id: { $in: userIds } });
//     }

//     async function deleteImages(modelInstance, modelName) {
//       const deleteTasks = modelInstance.map(async (instance) => {
//         const imagesToDelete = [];

//         switch (modelName) {
//           case "designBook":
//             imagesToDelete.push(...instance.imagesSavedFromWebPack);
//             break;
//           case "clothing":
//             imagesToDelete.push(...instance.clothing_image_name);
//             if (instance.input_image) imagesToDelete.push(instance.input_image);
//             if (instance.style_image) imagesToDelete.push(instance.style_image);
//             break;
//           case "designService":
//             if (instance.serviceImage)
//               imagesToDelete.push(instance.serviceImage);
//             break;
//           case "fabric":
//             if (instance.fabricImageName)
//               imagesToDelete.push(instance.fabricImageName);
//             break;
//           case "imageContent":
//             if (instance.imageName) imagesToDelete.push(instance.imageName);
//             break;
//           case "model":
//             imagesToDelete.push(...instance.model_image_name);
//             if (instance.background_image)
//               imagesToDelete.push(instance.background_image);
//             if (instance.pose_image) imagesToDelete.push(instance.pose_image);
//             break;
//           case "style":
//             imagesToDelete.push(...instance.style_image_name);
//             if (instance.input_image) imagesToDelete.push(instance.input_image);
//             if (instance.style_image) imagesToDelete.push(instance.style_image);
//             break;
//           default:
//             break;
//         }
//         console.log("imagesToDelete:", imagesToDelete);
//         if (imagesToDelete.length > 0) {
//           const location =
//             modelName === "clothing" || modelName === "model"
//               ? "output_uploads"
//               : "uploads";
//           await safelyDeleteFiles(imagesToDelete, location);
//         }
//       });

//       await Promise.all(deleteTasks);
//     }
//     try {
//       const foundUser = await Users.findById(req.user.id);
//       if (!foundUser) {
//         throw new Error("No user found!");
//       }

//       await Users.deleteOne({ _id: foundUser._id });

//       const [
//         foundBrandProfiles,
//         foundDesignBooks,
//         foundClothings,
//         foundDesignServices,
//         foundFabrics,
//         foundImageContents,
//         foundModels,
//         foundStyles,
//         foundTextContents,
//       ] = await Promise.all([
//         brandProfile.find({ userId: req.user.id }),
//         designBook.find({ userId: req.user.id }),
//         clothings.find({ userId: req.user.id }),
//         designService.find({ userId: req.user.id }),
//         fabric.find({ userId: req.user.id }),
//         imageContent.find({ userId: req.user.id }),
//         models.find({ userId: req.user.id }),
//         styles.find({ userId: req.user.id }),
//         textContent.find({ userId: req.user.id }),
//       ]);

//       await Promise.all([
//         foundBrandProfiles.length > 0 &&
//           deleteUserModels(
//             foundBrandProfiles.map((profile) => profile._id),
//             brandProfile
//           ),
//         foundDesignBooks.length > 0 &&
//           (await deleteImages(foundDesignBooks, "designBook")) &&
//           deleteUserModels(
//             foundDesignBooks.map((book) => book._id),
//             designBook
//           ),
//         foundClothings.length > 0 &&
//           (await deleteImages(foundClothings, "clothing")) &&
//           deleteUserModels(
//             foundClothings.map((clothing) => clothing._id),
//             clothings
//           ),
//         foundDesignServices.length > 0 &&
//           (await deleteImages(foundDesignServices, "designService")) &&
//           deleteUserModels(
//             foundDesignServices.map((service) => service._id),
//             designService
//           ),
//         foundFabrics.length > 0 &&
//           (await deleteImages(foundFabrics, "fabric")) &&
//           deleteUserModels(
//             foundFabrics.map((fabric) => fabric._id),
//             fabric
//           ),
//         foundImageContents.length > 0 &&
//           (await deleteImages(foundImageContents, "imageContent")) &&
//           deleteUserModels(
//             foundImageContents.map((content) => content._id),
//             imageContent
//           ),
//         foundModels.length > 0 &&
//           (await deleteImages(foundModels, "model")) &&
//           deleteUserModels(
//             foundModels.map((model) => model._id),
//             models
//           ),
//         foundStyles.length > 0 &&
//           (await deleteImages(foundStyles, "style")) &&
//           deleteUserModels(
//             foundStyles.map((style) => style._id),
//             styles
//           ),
//         foundTextContents.length > 0 &&
//           deleteUserModels(
//             foundTextContents.map((content) => content._id),
//             textContent
//           ),
//       ]);

//       res.json({
//         success: true,
//         message: "User account successfully deleted!",
//       });
//     } catch (err) {
//       console.error(err);
//       next(err.message);
//     }
//   })
// );

router.delete(
  "/delete-user-account",
  userAuth,
  asyncErrCatcher(async (req, res, next) => {
    async function safelyDeleteFiles(files, location) {
      try {
        if (location === "output_uploads") {
          await Promise.all(
            files.map(async (file) => {
              await new Promise((resolve, reject) => {
                checkAndDeleteFile(`output_uploads/${file}`, (err) => {
                  if (err) {
                    console.error(`Error deleting file: ${file}`, err);
                    reject(err);
                  } else {
                    resolve();
                  }
                });
              });
            })
          );
        } else {
          await Promise.all(
            files.map(async (file) => {
              await new Promise((resolve, reject) => {
                checkAndDeleteFile(`uploads/${file}`, (err) => {
                  if (err) {
                    console.error(`Error deleting file: ${file}`, err);
                    reject(err);
                  } else {
                    resolve();
                  }
                });
              });
            })
          );
        }
      } catch (err) {
        console.error("File deletion encountered errors", err);
      }
    }
    async function deleteUserModels(userIds, isArray, userInstance) {
      let query = [];
      if (!isArray) {
        query = [userIds];
      } else {
        query = userIds;
      }

      const deletedUsers = await userInstance.deleteMany({
        _id: { $in: query },
      });
      console.log("deletedUsers:", deletedUsers);
    }
    async function deleteImages(modelInstance, modelName) {
      if (modelName === "designBook") {
        for (const instance of modelInstance) {
          if (instance.imagesSavedFromWebPack.length > 0) {
            await safelyDeleteFiles(instance.imagesSavedFromWebPack);
          }
        }
      }
      if (modelName === "clothing") {
        for (const instance of modelInstance) {
          if (instance.clothing_image_name.length > 0) {
            await safelyDeleteFiles(
              instance.clothing_image_name,
              "output_uploads"
            );
          }
          if (instance.input_image || instance.style_image) {
            await safelyDeleteFiles([instance.input_image], "uploads");
            await safelyDeleteFiles([instance.style_image], "uploads");
          }
        }
      }
      if (modelName === "designService") {
        for (const instance of modelInstance) {
          if (instance.serviceImage) {
            await safelyDeleteFiles([instance.serviceImage], "uploads");
          }
        }
      }
      if (modelName === "fabric") {
        for (const instance of modelInstance) {
          if (instance.fabricImageName) {
            await safelyDeleteFiles([instance.fabricImageName]);
          }
        }
      }
      if (modelName === "imageContent") {
        for (const instance of modelInstance) {
          if (instance.imageName) {
            await safelyDeleteFiles([instance.imageName]);
          }
        }
      }
      if (modelName === "model") {
        for (const instance of modelInstance) {
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
        }
      }
      if (modelName === "style") {
        for (const instance of modelInstance) {
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
        }
      }
    }
    try {
      const foundUser = await Users.findById(req.user.id);
      if (!foundUser) {
        throw new Error("No user found!");
      }

      await Users.deleteOne({ _id: foundUser._id });

      const foundBrandProfiles = await brandProfile.find({
        userId: req.user.id,
      });

      const foundDesignBooks = await designBook.find({
        userId: req.user.id,
      });
      const foundClothings = await clothings.find({
        userId: req.user.id,
      });
      const foundDesignServices = await designService.find({
        userId: req.user.id,
      });
      const foundFabrics = await fabric.find({
        userId: req.user.id,
      });
      const foundImageContents = await imageContent.find({
        userId: req.user.id,
      });
      const foundModels = await models.find({
        userId: req.user.id,
      });
      const foundstyles = await styles.find({
        userId: req.user.id,
      });
      const foundTextContents = await textContent.find({
        userId: req.user.id,
      });

      if (foundBrandProfiles.length > 0) {
        const brandProfileIds = foundBrandProfiles.map(
          (profile) => profile._id
        );

        await deleteUserModels(brandProfileIds, true, foundBrandProfiles);
      } else {
        await deleteUserModels([foundUser._id], false, foundBrandProfiles);
      }

      if (foundDesignBooks.length > 0) {
        const designBookIds = foundDesignBooks.map((profile) => profile._id);

        await deleteImages(foundDesignBooks, "designBook");

        await deleteUserModels(designBookIds, true, foundDesignBooks);
      } else {
        await deleteImages(foundDesignBooks, "designBook");
        await deleteUserModels([foundUser._id], false, foundDesignBooks);
      }
      if (foundClothings.length > 0) {
        const clothingIds = foundClothings.map((profile) => profile._id);
        await deleteImages(foundClothings, "clothing");

        await deleteUserModels(clothingIds, true, foundClothings);
      } else {
        await deleteImages(foundClothings, "clothing");

        await deleteUserModels([foundUser._id], false, foundClothings);
      }
      if (foundDesignServices.length > 0) {
        const designServices = foundDesignServices.map(
          (profile) => profile._id
        );
        await deleteImages(foundDesignServices, "designService");

        await deleteUserModels(designServices, true, foundDesignServices);
      } else {
        await deleteImages(foundDesignServices, "designService");

        await deleteUserModels([foundUser._id], false, foundDesignServices);
      }
      if (foundFabrics.length > 0) {
        const fabrics = foundFabrics.map((profile) => profile._id);
        await deleteImages(foundFabrics, "fabrics");

        await deleteUserModels(fabrics, true, foundFabrics);
      } else {
        await deleteImages(foundFabrics, "fabric");

        await deleteUserModels([foundUser._id], false, foundFabrics);
      }
      if (foundImageContents.length > 0) {
        const imageContents = foundImageContents.map((profile) => profile._id);
        await deleteImages(foundImageContents, "imageContent");

        await deleteUserModels(imageContents, true, foundImageContents);
      } else {
        await deleteImages(foundImageContents, "imageContent");

        await deleteUserModels([foundUser._id], false, foundImageContents);
      }
      if (foundModels.length > 0) {
        const models = foundModels.map((profile) => profile._id);
        await deleteImages(foundModels, "model");

        await deleteUserModels(models, true, foundModels);
      } else {
        await deleteImages(foundModels, "model");

        await deleteUserModels([foundUser._id], false, foundModels);
      }
      if (foundstyles.length > 0) {
        const styles = foundstyles.map((profile) => profile._id);
        await deleteImages(foundstyles, "style");

        await deleteUserModels(styles, true, foundstyles);
      } else {
        await deleteImages(foundstyles, "style");

        await deleteUserModels([foundUser._id], false, foundstyles);
      }
      if (foundTextContents.length > 0) {
        const textContents = foundTextContents.map((profile) => profile._id);
        await deleteImages(foundTextContents, "textContent");

        await deleteUserModels(textContents, true, foundTextContents);
      } else {
        await deleteUserModels([foundUser._id], false, foundTextContents);
      }

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
