import { clerkClient } from "@clerk/nextjs/server";
import sgMail from "@sendgrid/mail";
import { siteConfig } from "@/lib/site";

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
  await sgMail.send({
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });
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

/** Best-effort lookup of a user's primary email via Clerk. */
async function primaryEmailForClerkUser(
  clerkUserId: string
): Promise<string | null> {
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    const primary = clerkUser.emailAddresses.find(
      (addr) => addr.id === clerkUser.primaryEmailAddressId
    );
    return (
      primary?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null
    );
  } catch (err) {
    console.error("[email] failed to read clerk email", err);
    return null;
  }
}

/** Notify a developer that someone requested to test their app. */
export async function sendNewTesterRequestEmail(options: {
  devClerkId: string;
  devName: string;
  appName: string;
  testerName: string;
  testerEmail: string;
  listingUrl: string;
}): Promise<void> {
  const devEmail = await primaryEmailForClerkUser(options.devClerkId);
  if (!devEmail) {
    // GitHub OAuth via Clerk doesn't always expose an email — skip silently.
    console.warn("[email] dev has no email on file; skipping request notice", {
      devClerkId: options.devClerkId,
    });
    return;
  }

  const product = siteConfig.name;
  await sendMail({
    to: devEmail,
    replyTo: options.testerEmail,
    subject: `New tester request for ${options.appName}`,
    text: [
      `${options.testerName} requested to test ${options.appName}.`,
      "",
      `Tester email: ${options.testerEmail}`,
      `Listing: ${options.listingUrl}`,
      "",
      "Reply to the tester directly to add them to your Play Store / TestFlight track.",
      "",
      `— Sent from ${product}`,
    ].join("\n"),
    html: [
      `<p><strong>${escapeHtml(options.testerName)}</strong> requested to test <strong>${escapeHtml(options.appName)}</strong>.</p>`,
      `<p><strong>Tester email:</strong> ${escapeHtml(options.testerEmail)}</p>`,
      `<p><a href="${escapeHtml(options.listingUrl)}">View listing</a></p>`,
      `<p>Reply to the tester directly to add them to your Play Store / TestFlight track.</p>`,
      `<p style="color:#888;font-size:12px;">— Sent from ${escapeHtml(product)}</p>`,
    ].join(""),
  });
}

/** Tell a tester their request was accepted. */
export async function sendRequestAcceptedEmail(options: {
  testerEmail: string;
  appName: string;
  listingUrl: string;
}): Promise<void> {
  const product = siteConfig.name;
  await sendMail({
    to: options.testerEmail,
    subject: `You're accepted to test ${options.appName}`,
    text: [
      `Great news — the developer accepted your request to test ${options.appName}.`,
      "",
      `Listing: ${options.listingUrl}`,
      "",
      "They'll be in touch (via the email you shared) with next steps to join the testing track.",
      "",
      `— ${product}`,
    ].join("\n"),
    html: [
      `<p>Great news — the developer accepted your request to test <strong>${escapeHtml(options.appName)}</strong>.</p>`,
      `<p><a href="${escapeHtml(options.listingUrl)}">View listing</a></p>`,
      "<p>They'll be in touch (via the email you shared) with next steps to join the testing track.</p>",
      `<p style="color:#888;font-size:12px;">— ${escapeHtml(product)}</p>`,
    ].join(""),
  });
}

/** Tell a tester their request was declined. */
export async function sendRequestRejectedEmail(options: {
  testerEmail: string;
  appName: string;
}): Promise<void> {
  const product = siteConfig.name;
  await sendMail({
    to: options.testerEmail,
    subject: `Update on your ${options.appName} test request`,
    text: [
      `Thanks for offering to test ${options.appName}. The developer isn't able to add more testers right now.`,
      "",
      "There are plenty of other apps needing testers — keep the reciprocity going.",
      "",
      `— ${product}`,
    ].join("\n"),
    html: [
      `<p>Thanks for offering to test <strong>${escapeHtml(options.appName)}</strong>. The developer isn't able to add more testers right now.</p>`,
      "<p>There are plenty of other apps needing testers — keep the reciprocity going.</p>",
      `<p style="color:#888;font-size:12px;">— ${escapeHtml(product)}</p>`,
    ].join(""),
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
