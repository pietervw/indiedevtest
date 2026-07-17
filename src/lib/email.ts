import sgMail from "@sendgrid/mail";
import { siteConfig } from "@/lib/site";

const SEND_TIMEOUT_MS = 10_000;

// Set the key once on module load when available. Re-applied in sendMail
// so a key added after server start (e.g. via .env.local reload) still works.
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export type ContactMessage = {
  name: string;
  email: string;
  message: string;
};

function requireMailConfig(): {
  apiKey: string;
  toEmail: string;
  fromEmail: string;
} {
  const apiKey = process.env.SENDGRID_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    throw new Error(
      "Email not configured. Set SENDGRID_API_KEY, CONTACT_TO_EMAIL, and SENDGRID_FROM_EMAIL."
    );
  }

  return { apiKey, toEmail, fromEmail };
}

async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const { apiKey, fromEmail } = requireMailConfig();
  sgMail.setApiKey(apiKey);

  const sendPromise = sgMail.send({
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sendPromise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Email send timed out after ${SEND_TIMEOUT_MS}ms`));
        }, SEND_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sendContactEmail(msg: ContactMessage): Promise<void> {
  const { toEmail } = requireMailConfig();
  const product = siteConfig.name;

  await sendMail({
    to: toEmail,
    replyTo: msg.email,
    subject: `New ${product} message from ${msg.name}`,
    text: [
      `Name: ${msg.name}`,
      `Email: ${msg.email}`,
      "",
      msg.message,
      "",
      `— Sent from the ${product} contact form`,
    ].join("\n"),
    html: [
      `<p><strong>Name:</strong> ${escapeHtml(msg.name)}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(msg.email)}</p>`,
      `<hr/>`,
      `<p>${escapeHtml(msg.message).replace(/\n/g, "<br/>")}</p>`,
      `<p style="color:#888;font-size:12px;">— Sent from the ${escapeHtml(product)} contact form</p>`,
    ].join(""),
  });
}

/** Owner alert to CONTACT_TO_EMAIL + confirmation to the signup address. */
export async function sendWaitlistEmails(signupEmail: string): Promise<void> {
  const { toEmail } = requireMailConfig();
  const product = siteConfig.name;
  const siteUrl = siteConfig.url;

  await Promise.all([
    sendMail({
      to: toEmail,
      replyTo: signupEmail,
      subject: `New ${product} waitlist signup`,
      text: [
        `New waitlist signup on ${product}.`,
        "",
        `Email: ${signupEmail}`,
        "",
        `— Sent from the ${product} waitlist`,
      ].join("\n"),
      html: [
        `<p>New waitlist signup on <strong>${escapeHtml(product)}</strong>.</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(signupEmail)}</p>`,
        `<p style="color:#888;font-size:12px;">— Sent from the ${escapeHtml(product)} waitlist</p>`,
      ].join(""),
    }),
    sendMail({
      to: signupEmail,
      subject: `You're on the ${product} waitlist`,
      text: [
        `Thanks for joining the ${product} waitlist.`,
        "",
        "We'll email you when reciprocal testing opens.",
        "",
        `— ${product}`,
        siteUrl,
      ].join("\n"),
      html: [
        `<p>Thanks for joining the <strong>${escapeHtml(product)}</strong> waitlist.</p>`,
        `<p>We'll email you when reciprocal testing opens.</p>`,
        `<p style="color:#888;font-size:12px;">— ${escapeHtml(product)} · <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteUrl)}</a></p>`,
      ].join(""),
    }),
  ]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
