# Disnstinct frontend and backend

## Frontend

Fetches weather data from backend
- Displays the data per day, make it possible to select cities and see daily data fro each city from 5 years ago
- It should have a main dashboard with an overview for the whole country
- Feature to display daily data in a line graph
- should be able to display multiple data for each day on a barchat with multiple sections
- Should also display data in a pie chart
- Should be able to compare data by state in a table
- Should also display historic data fro each state in a table
- Supports search by state (with throtling/debouncing)
- Has filtering (by min, max, or range of values)


## Backend
- Supportsa caching
- Fetches data from the weather data source regularly (Or this can be a separate service based on cron etc)
- Uses PostgreSQL
- Uses API keys
- Uses rate-limiting (100 req/min)
