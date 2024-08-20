const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const sendMail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Read and compile the HTML template
  const templatePath = path.resolve("./views/activation_template.html");
  let htmlTemplate = fs.readFileSync(templatePath, "utf8");

  // Replace placeholders with actual data
  htmlTemplate = htmlTemplate
    .replace("{{userName}}", options.context.userName)
    .replace("{{activationCode}}", options.context.activationCode);

  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: options.email,
    subject: options.subject,
    html: htmlTemplate, // Use the compiled HTML content
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendMail;
