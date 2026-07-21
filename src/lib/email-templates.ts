/**
 * Table-based, inline-CSS email primitives matching IndieDevTest marketing.
 * No external images or dependencies — safe for common clients.
 */

import { siteConfig } from "@/lib/site";

export const emailColors = {
  brand: "#d2e36b",
  brandInk: "#2a3812",
  ink: "#0a0a0a",
  inkMuted: "#525252",
  paper: "#ffffff",
  paperMuted: "#f4f4f5",
  line: "#e4e4e7",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape then preserve newlines as <br/> for message bodies. */
export function escapeHtmlWithBreaks(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function brandMarkHtml(): string {
  const name = escapeHtml(siteConfig.name);
  // Text-only mark mirroring BrandMark (IndieDev + citrus "Test" chip).
  return [
    `<a href="${escapeHtml(siteConfig.url)}" style="text-decoration:none;color:${emailColors.ink};" aria-label="${name} home">`,
    `<span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;color:${emailColors.ink};">`,
    `IndieDev`,
    `<span style="display:inline-block;background-color:${emailColors.brand};color:${emailColors.brandInk};padding:2px 8px;margin-left:2px;border:2px solid ${emailColors.ink};border-radius:6px;font-weight:800;">Test</span>`,
    `</span>`,
    `</a>`,
  ].join("");
}

export type DetailRow = {
  label: string;
  /** Plain text — escaped. Prefer this for untrusted values. */
  value?: string;
  /** Already-safe HTML (must be escaped by caller). */
  valueHtml?: string;
};

/** Outer branded shell: preheader, brand header, rounded content card, footer. */
function emailShell(options: {
  title: string;
  preheader: string;
  children: string;
}): string {
  const title = escapeHtml(options.title);
  const preheader = escapeHtml(options.preheader);
  const product = escapeHtml(siteConfig.name);
  const siteUrl = escapeHtml(siteConfig.url);
  const year = new Date().getUTCFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="x-ua-compatible" content="ie=edge"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${emailColors.paperMuted};color:${emailColors.ink};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
${preheader}
&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${emailColors.paperMuted};">
<tr>
<td align="center" style="padding:28px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;width:100%;">
<tr>
<td align="left" style="padding:0 4px 18px;">
${brandMarkHtml()}
</td>
</tr>
<tr>
<td style="background-color:${emailColors.paper};border:2px solid ${emailColors.ink};border-radius:16px;padding:28px 24px;">
${options.children}
</td>
</tr>
<tr>
<td align="center" style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${emailColors.inkMuted};">
${product} · <a href="${siteUrl}" style="color:${emailColors.inkMuted};text-decoration:underline;">${siteUrl}</a><br/>
© ${year} ${product}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;line-height:1.25;letter-spacing:-0.02em;color:${emailColors.ink};">${escapeHtml(text)}</h1>`;
}

/** Paragraph of escaped plain text. */
export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${emailColors.ink};">${escapeHtml(text)}</p>`;
}

/**
 * Paragraph that may include trusted markup (e.g. <strong> from emailStrong).
 * Untrusted values must still be passed through escapeHtml / emailStrong.
 */
export function emailParagraphHtml(html: string): string {
  return `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${emailColors.ink};">${html}</p>`;
}

export function emailStrong(text: string): string {
  return `<strong style="font-weight:700;color:${emailColors.ink};">${escapeHtml(text)}</strong>`;
}

/** Accessible text link with visible underline. */
export function emailLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${emailColors.ink};font-weight:700;text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/** Rounded citrus CTA — table-wrapped for Outlook-ish clients. */
export function emailCtaButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:4px 0 18px;">`,
    `<tr>`,
    `<td align="left" style="border-radius:10px;background-color:${emailColors.brand};border:2px solid ${emailColors.ink};">`,
    `<a href="${safeHref}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;line-height:1.2;color:${emailColors.brandInk};text-decoration:none;border-radius:10px;" aria-label="${safeLabel}">`,
    safeLabel,
    `</a>`,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join("");
}

/** Rounded detail card with labeled rows. */
export function emailDetailCard(rows: DetailRow[]): string {
  const body = rows
    .map((row, index) => {
      const value =
        row.valueHtml ??
        (row.value !== undefined ? escapeHtml(row.value) : "");
      const border =
        index < rows.length - 1
          ? `border-bottom:1px solid ${emailColors.line};`
          : "";
      return [
        `<tr>`,
        `<td style="padding:10px 0;${border}font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:${emailColors.inkMuted};vertical-align:top;width:34%;">${escapeHtml(row.label)}</td>`,
        `<td style="padding:10px 0;${border}font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:${emailColors.ink};font-weight:600;vertical-align:top;">${value}</td>`,
        `</tr>`,
      ].join("");
    })
    .join("");

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 18px;background-color:${emailColors.paperMuted};border:2px solid ${emailColors.ink};border-radius:12px;">`,
    `<tr>`,
    `<td style="padding:4px 16px;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`,
    body,
    `</table>`,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join("");
}

export function emailMutedNote(text: string): string {
  return `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${emailColors.inkMuted};">${escapeHtml(text)}</p>`;
}

/** Compose a full branded HTML email from section fragments. */
export function renderBrandedEmail(options: {
  title: string;
  preheader: string;
  heading: string;
  bodyHtml: string;
}): string {
  return emailShell({
    title: options.title,
    preheader: options.preheader,
    children: [emailHeading(options.heading), options.bodyHtml].join(""),
  });
}
