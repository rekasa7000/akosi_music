try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional — real deployments inject env vars directly
}
