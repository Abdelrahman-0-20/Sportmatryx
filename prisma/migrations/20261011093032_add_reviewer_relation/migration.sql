-- AddForeignKey
ALTER TABLE "intervention_reviews" ADD CONSTRAINT "intervention_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
