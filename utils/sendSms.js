const { parsePhoneNumberFromString } = require("libphonenumber-js");
const twilio = require("twilio");
require("dotenv").config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendSmsVerificationCode = async (phoneNumber, verificationCode) => {
  try {
    const phoneNumberObject = parsePhoneNumberFromString(phoneNumber);

    if (!phoneNumberObject || !phoneNumberObject.isValid()) {
      throw new Error("Invalid phone number");
    }

    const formattedPhoneNumber = phoneNumberObject.number;

    const message = await client.messages.create({
      body: `Your verification code is: ${verificationCode}`,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
      to: formattedPhoneNumber,
    });
    return message;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Failed to send SMS");
  }
};

module.exports = sendSmsVerificationCode;
