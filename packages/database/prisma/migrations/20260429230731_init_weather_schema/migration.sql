-- CreateTable
CREATE TABLE "WeatherStation" (
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "elevationM" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherStation_pkey" PRIMARY KEY ("stationId")
);

-- CreateTable
CREATE TABLE "WeatherObservation" (
    "id" BIGSERIAL NOT NULL,
    "stationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "precipitationMm" DOUBLE PRECISION,
    "tempAvgC" DOUBLE PRECISION,
    "tempMaxC" DOUBLE PRECISION,
    "tempMinC" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherStation_regionCode_idx" ON "WeatherStation"("regionCode");

-- CreateIndex
CREATE INDEX "WeatherStation_name_idx" ON "WeatherStation"("name");

-- CreateIndex
CREATE INDEX "WeatherObservation_date_idx" ON "WeatherObservation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherObservation_stationId_date_key" ON "WeatherObservation"("stationId", "date");

-- AddForeignKey
ALTER TABLE "WeatherObservation" ADD CONSTRAINT "WeatherObservation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "WeatherStation"("stationId") ON DELETE CASCADE ON UPDATE CASCADE;
