// server/utils/mailer.js
const nodemailer = require("nodemailer");
const generateTemplate = require("../templates/emailTemplate");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.GOOGLE_EMAIL,
    pass: process.env.GOOGLE_APP_PASSWORD, // Use App Password, not your Gmail password
  },
});

/**
 * Send email
 * @param {Object} options
 * @param {string} options.to - Receiver email
 * @param {string} options.type - 'signature' | 'warning'
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Body content of the email
 */
async function sendEmail({ to, type = "signature", subject, message }) {
  const html = generateTemplate(type, message);

  const mailOptions = {
    from: `"Digital Signature Portal" <${process.env.GOOGLE_EMAIL}>`,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent to:", to);
  } catch (err) {
    console.error("Failed to send email:", err);
    throw err;
  }
}

module.exports = sendEmail;
