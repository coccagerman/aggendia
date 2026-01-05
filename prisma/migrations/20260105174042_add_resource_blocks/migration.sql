-- CreateTable
CREATE TABLE "ResourceBlock" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceBlock_resourceId_idx" ON "ResourceBlock"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceBlock_resourceId_startAt_endAt_idx" ON "ResourceBlock"("resourceId", "startAt", "endAt");

-- AddForeignKey
ALTER TABLE "ResourceBlock" ADD CONSTRAINT "ResourceBlock_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
