-- A private, user-controlled address shared only with the other party in a
-- testing relationship. Nullable preserves existing profiles until they
-- confirm or add an address during profile setup.
ALTER TABLE "users"
  ADD COLUMN "contact_email" TEXT;
