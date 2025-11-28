export default async function dbConnect() {
  const { Client } = await import("pg");
  const connectionString =
    process.env.PG_CONNECTION || process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}
