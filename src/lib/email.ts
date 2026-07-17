import sgMail from "@sendgrid/mail";

// Set the key once on module load when available. Re-applied in sendContactEmail
// so a key added after server start (e.g. via .env.local reload) still works.
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export type ContactMessage = {
  name: string;
  email: string;
  message: string;
};

/**
 * Sends a contact-form submission to the site owner via SendGrid.
 * Throws if SendGrid is not fully configured.
 */
export async function sendContactEmail(msg: ContactMessage): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    throw new Error(
      "Contact email not configured. Set SENDGRID_API_KEY, CONTACT_TO_EMAIL, and SENDGRID_FROM_EMAIL."
    );
  }

  sgMail.setApiKey(apiKey);

  const subject = `New IndieDevTest message from ${msg.name}`;
  const text = [
    `Name: ${msg.name}`,
    `Email: ${msg.email}`,
    "",
    msg.message,
    "",
    "— Sent from the IndieDevTest contact form",
  ].join("\n");

  const html = [
    `<p><strong>Name:</strong> ${escapeHtml(msg.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(msg.email)}</p>`,
    `<hr/>`,
    `<p>${escapeHtml(msg.message).replace(/\n/g, "<br/>")}</p>`,
    `<p style="color:#888;font-size:12px;">— Sent from the IndieDevTest contact form</p>`,
  ].join("");

  await sgMail.send({
    to: toEmail,
    from: fromEmail,
    replyTo: msg.email, // owner can hit Reply to answer the sender directly
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
