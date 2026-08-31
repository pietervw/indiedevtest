import assert from "node:assert/strict";
import test from "node:test";

import { isHttpUrl, isValidEmail, normalizeEmail } from "../../src/lib/validation";
import {
  EVIDENCE_IMAGE_LIMITS,
  extensionForContentType,
  isAllowedImageContentType,
  validateImageByteSize,
  validateImageDimensions,
} from "../../src/lib/storage/image-limits";

test("normalizes and validates email input without accepting malformed addresses", () => {
  // Regression caught: duplicate accounts or notifications caused by unnormalized emails.
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
  assert.equal(isValidEmail("person@example.com"), true);
  assert.equal(isValidEmail("person@example"), false);
});

test("accepts only complete HTTP(S) URLs", () => {
  // Regression caught: storing non-navigable or unsafe URLs as product links.
  assert.equal(isHttpUrl("https://example.com/product"), true);
  assert.equal(isHttpUrl("https://"), false);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
});

test("enforces image type, dimension, and byte-size boundaries", () => {
  // Regression caught: accepting unsupported, undersized, oversized, or malformed evidence uploads.
  assert.equal(isAllowedImageContentType("image/webp"), true);
  assert.equal(isAllowedImageContentType("image/gif"), false);
  assert.equal(extensionForContentType("image/jpeg"), "jpg");
  assert.equal(validateImageDimensions(320, 568), null);
  assert.equal(validateImageDimensions(319, 568), "Images must be at least 320×568px.");
  assert.equal(validateImageByteSize(EVIDENCE_IMAGE_LIMITS.maxBytes), null);
  assert.equal(validateImageByteSize(EVIDENCE_IMAGE_LIMITS.maxBytes + 1), "Each image must be 5MB or smaller.");
});
