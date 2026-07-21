import { clerkClient } from "@clerk/nextjs/server";
import sgMail from "@sendgrid/mail";
import {
  emailCtaButton,
  emailDetailCard,
  emailLink,
  emailMutedNote,
  emailParagraph,
  emailParagraphHtml,
  emailStrong,
  escapeHtmlWithBreaks,
  renderBrandedEmail,
} from "@/lib/email-templates";
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
  const subject = `New ${product} message from ${msg.name}`;

  await sendMail({
    to: toEmail,
    replyTo: msg.email,
    subject,
    text: [
      `Name: ${msg.name}`,
      `Email: ${msg.email}`,
      "",
      msg.message,
      "",
      `— Sent from the ${product} contact form`,
    ].join("\n"),
    html: renderBrandedEmail({
      title: subject,
      preheader: `New contact message from ${msg.name}`,
      heading: "New contact message",
      bodyHtml: [
        emailDetailCard([
          { label: "Name", value: msg.name },
          {
            label: "Email",
            valueHtml: emailLink(`mailto:${msg.email}`, msg.email),
          },
        ]),
        emailParagraphHtml(escapeHtmlWithBreaks(msg.message)),
        emailMutedNote(`Sent from the ${product} contact form`),
      ].join(""),
    }),
  });
}

/** Owner alert to CONTACT_TO_EMAIL + confirmation to the signup address. */
export async function sendWaitlistEmails(signupEmail: string): Promise<void> {
  const { toEmail } = requireMailConfig();
  const product = siteConfig.name;
  const siteUrl = siteConfig.url;

  const alertSubject = `New ${product} waitlist signup`;
  const confirmSubject = `You're on the ${product} waitlist`;

  await Promise.all([
    sendMail({
      to: toEmail,
      replyTo: signupEmail,
      subject: alertSubject,
      text: [
        `New waitlist signup on ${product}.`,
        "",
        `Email: ${signupEmail}`,
        "",
        `— Sent from the ${product} waitlist`,
      ].join("\n"),
      html: renderBrandedEmail({
        title: alertSubject,
        preheader: `New waitlist signup: ${signupEmail}`,
        heading: "New waitlist signup",
        bodyHtml: [
          emailParagraphHtml(
            `Someone joined the ${emailStrong(product)} waitlist.`
          ),
          emailDetailCard([
            {
              label: "Email",
              valueHtml: emailLink(`mailto:${signupEmail}`, signupEmail),
            },
          ]),
          emailMutedNote(`Sent from the ${product} waitlist`),
        ].join(""),
      }),
    }),
    sendMail({
      to: signupEmail,
      subject: confirmSubject,
      text: [
        `Thanks for joining the ${product} waitlist.`,
        "",
        "We'll email you when reciprocal testing opens.",
        "",
        `— ${product}`,
        siteUrl,
      ].join("\n"),
      html: renderBrandedEmail({
        title: confirmSubject,
        preheader: `You're on the ${product} waitlist — we'll email when testing opens.`,
        heading: "You're on the list",
        bodyHtml: [
          emailParagraphHtml(
            `Thanks for joining the ${emailStrong(product)} waitlist.`
          ),
          emailParagraph(
            "We'll email you when reciprocal testing opens."
          ),
          emailCtaButton(siteUrl, `Visit ${product}`),
          emailMutedNote(product),
        ].join(""),
      }),
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
  const subject = `New tester request for ${options.appName}`;

  await sendMail({
    to: devEmail,
    replyTo: options.testerEmail,
    subject,
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
    html: renderBrandedEmail({
      title: subject,
      preheader: `${options.testerName} requested to test ${options.appName}`,
      heading: "New tester request",
      bodyHtml: [
        emailParagraphHtml(
          `${emailStrong(options.testerName)} requested to test ${emailStrong(options.appName)}.`
        ),
        emailDetailCard([
          {
            label: "Tester email",
            valueHtml: emailLink(
              `mailto:${options.testerEmail}`,
              options.testerEmail
            ),
          },
        ]),
        emailCtaButton(options.listingUrl, "View listing"),
        emailParagraph(
          "Reply to the tester directly to add them to your Play Store / TestFlight track."
        ),
        emailMutedNote(`Sent from ${product}`),
      ].join(""),
    }),
  });
}

/** Tell a tester their request was accepted. */
export async function sendRequestAcceptedEmail(options: {
  testerEmail: string;
  appName: string;
  listingUrl: string;
}): Promise<void> {
  const product = siteConfig.name;
  const subject = `You're accepted to test ${options.appName}`;

  await sendMail({
    to: options.testerEmail,
    subject,
    text: [
      `Great news — the developer accepted your request to test ${options.appName}.`,
      "",
      `Listing: ${options.listingUrl}`,
      "",
      "They'll be in touch (via the email you shared) with next steps to join the testing track.",
      "",
      `— ${product}`,
    ].join("\n"),
    html: renderBrandedEmail({
      title: subject,
      preheader: `You're accepted to test ${options.appName}`,
      heading: "You're accepted",
      bodyHtml: [
        emailParagraphHtml(
          `Great news — the developer accepted your request to test ${emailStrong(options.appName)}.`
        ),
        emailCtaButton(options.listingUrl, "View listing"),
        emailParagraph(
          "They'll be in touch (via the email you shared) with next steps to join the testing track."
        ),
        emailMutedNote(product),
      ].join(""),
    }),
  });
}

/** Tell a tester their request was declined. */
export async function sendRequestRejectedEmail(options: {
  testerEmail: string;
  appName: string;
}): Promise<void> {
  const product = siteConfig.name;
  const subject = `Update on your ${options.appName} test request`;
  const browseUrl = `${siteConfig.url}/browse`;

  await sendMail({
    to: options.testerEmail,
    subject,
    text: [
      `Thanks for offering to test ${options.appName}. The developer isn't able to add more testers right now.`,
      "",
      "There are plenty of other apps needing testers — keep the reciprocity going.",
      "",
      `— ${product}`,
    ].join("\n"),
    html: renderBrandedEmail({
      title: subject,
      preheader: `Update on your ${options.appName} test request`,
      heading: "Request update",
      bodyHtml: [
        emailParagraphHtml(
          `Thanks for offering to test ${emailStrong(options.appName)}. The developer isn't able to add more testers right now.`
        ),
        emailParagraph(
          "There are plenty of other apps needing testers — keep the reciprocity going."
        ),
        emailCtaButton(browseUrl, "Browse apps"),
        emailMutedNote(product),
      ].join(""),
    }),
  });
}

/** Tell a tester their test was marked complete (credits their profile). */
export async function sendTestCompletedEmail(options: {
  testerEmail: string;
  appName: string;
  listingUrl: string;
}): Promise<void> {
  const product = siteConfig.name;
  const subject = `Thanks for testing ${options.appName}`;

  await sendMail({
    to: options.testerEmail,
    subject,
    text: [
      `The developer marked your test of ${options.appName} as complete — nice work.`,
      "",
      "Your Completed count on your profile just went up. Keep the reciprocity going:",
      `Listing: ${options.listingUrl}`,
      "",
      `— ${product}`,
    ].join("\n"),
    html: renderBrandedEmail({
      title: subject,
      preheader: `Thanks for testing ${options.appName} — your Completed count went up.`,
      heading: "Test complete",
      bodyHtml: [
        emailParagraphHtml(
          `The developer marked your test of ${emailStrong(options.appName)} as complete — nice work.`
        ),
        emailParagraphHtml(
          `Your ${emailStrong("Completed")} count on your profile just went up. Keep the reciprocity going:`
        ),
        emailCtaButton(options.listingUrl, "View listing"),
        emailMutedNote(product),
      ].join(""),
    }),
  });
}

/**
 * Listing-level milestone reminder (spec §10): 14 days after the 14th tester
 * joined. The scheduler owns the once-only delivery guard; this function only
 * renders and sends the branded notification.
 */
export async function sendListing14DayReminderEmail(options: {
  devClerkId: string;
  devName: string;
  appName: string;
  listingUrl: string;
  fourteenthJoinedAt: Date;
}): Promise<void> {
  const devEmail = await primaryEmailForClerkUser(options.devClerkId);
  if (!devEmail) {
    // GitHub OAuth via Clerk doesn't always expose an email — skip silently.
    // Caller still treats this as success so cron won't retry forever.
    console.warn("[email] dev has no email on file; skipping 14-day reminder", {
      devClerkId: options.devClerkId,
    });
    return;
  }

  const product = siteConfig.name;
  const subject = `${options.appName} is ready for its testing check-in`;
  const joinedDate = options.fourteenthJoinedAt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await sendMail({
    to: devEmail,
    subject,
    text: [
      `Hi ${options.devName},`,
      "",
      `Your 14th tester for ${options.appName} joined on ${joinedDate}. The 14-day testing period has now passed.`,
      "",
      "Check your listing, confirm any completed tests, and update its status when you're ready.",
      `Listing: ${options.listingUrl}`,
      "",
      `— ${product}`,
    ].join("\n"),
    html: renderBrandedEmail({
      title: subject,
      preheader: `The 14-day testing period for ${options.appName} has passed.`,
      heading: "Your testing milestone is here",
      bodyHtml: [
        emailParagraphHtml(
          `Hi ${emailStrong(options.devName)}, your 14th tester for ${emailStrong(options.appName)} joined on ${emailStrong(joinedDate)}.`
        ),
        emailParagraph(
          "The 14-day testing period has now passed. Check your listing, confirm any completed tests, and update its status when you're ready."
        ),
        emailCtaButton(options.listingUrl, "Review listing"),
        emailMutedNote(product),
      ].join(""),
    }),
  });
}
