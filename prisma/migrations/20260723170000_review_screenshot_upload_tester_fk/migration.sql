-- AddForeignKey
ALTER TABLE "review_screenshot_uploads" ADD CONSTRAINT "review_screenshot_uploads_tester_user_id_fkey" FOREIGN KEY ("tester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
