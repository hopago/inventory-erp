-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('진행 중', '완료', '미확인');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "progress_status" "ProgressStatus" NOT NULL DEFAULT '미확인';
