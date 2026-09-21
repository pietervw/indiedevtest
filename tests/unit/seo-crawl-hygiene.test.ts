import assert from "node:assert/strict";
import test from "node:test";

import { browseSearchParamsAreIndexable } from "../../src/lib/browse-indexability";
import {
  canonicalHttpsRedirectUrl,
  forwardedProtocol,
} from "../../src/lib/canonical-request";
import { absoluteUrl } from "../../src/lib/site";

test("homepage absolute URL uses a trailing slash", () => {
  assert.equal(absoluteUrl("/"), "https://indiedevtest.com/");
  assert.equal(absoluteUrl(""), "https://indiedevtest.com/");
  assert.equal(absoluteUrl("/browse"), "https://indiedevtest.com/browse");
  assert.equal(absoluteUrl("/#website"), "https://indiedevtest.com/#website");
});

test("production HTTP and www requests redirect to the HTTPS apex", () => {
  assert.equal(
    canonicalHttpsRedirectUrl({
      hostname: "indiedevtest.com",
      protocol: "http",
      pathname: "/",
      search: "",
    }),
    "https://indiedevtest.com/"
  );
  assert.equal(
    canonicalHttpsRedirectUrl({
      hostname: "www.indiedevtest.com",
      protocol: "https:",
      pathname: "/browse",
      search: "?sort=requested",
    }),
    "https://indiedevtest.com/browse?sort=requested"
  );
  assert.equal(
    canonicalHttpsRedirectUrl({
      hostname: "indiedevtest.com",
      protocol: "https",
      pathname: "/",
    }),
    null
  );
  assert.equal(
    canonicalHttpsRedirectUrl({
      hostname: "localhost",
      protocol: "http",
      pathname: "/",
    }),
    null
  );
});

test("x-forwarded-proto prefers the first hop", () => {
  assert.equal(forwardedProtocol("https, http", "http:"), "https");
  assert.equal(forwardedProtocol(null, "http:"), "http");
});

test("browse query strings are not indexable", () => {
  assert.equal(browseSearchParamsAreIndexable({}), true);
  assert.equal(browseSearchParamsAreIndexable({ sort: "requested" }), false);
  assert.equal(
    browseSearchParamsAreIndexable({
      category: "game",
      platform: "android",
    }),
    false
  );
});
