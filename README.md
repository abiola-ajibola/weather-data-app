# weather-data-app

## Scripts

- `yarn dev` starts the Fastify TypeScript backend and the Vite frontend together.
- `yarn build` compiles the backend and builds the frontend bundle.
- `yarn start` runs the full build, then starts the API and Vite preview server.

## Database and Ingestion

- `yarn db:generate` generates Prisma client assets in `packages/database/generated/client`.
- `yarn db:migrate:dev` runs Prisma development migrations from the dedicated database workspace.
- `yarn ingest:weather` runs the worker that reads CSV files from `sample-dataset/` and populates the database.

The backend weather route now reads from the Prisma-backed database instead of directly from CSV files.


`-- shadcn preset code: b3m8I0jRb`

 curl https://www.ncei.noaa.gov/data/daily-summaries/archive/daily-summaries-latest.tar.gz -o daily-summaries-latest.tar.gz