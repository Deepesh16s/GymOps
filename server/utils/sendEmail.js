const { Resend } = require("resend");

const sendEmail = async ({ to, subject, html }) => {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Resend email error:", error);
    const err = new Error(error.message || "Failed to send email via Resend");
    err.resendError = error;
    throw err;
  }

  return data;
};

module.exports = sendEmail;