-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "ects_credits" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "semester" INTEGER NOT NULL DEFAULT 1;
