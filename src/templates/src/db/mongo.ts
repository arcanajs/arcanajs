export default async function dbConnect() {
  // Example MongoDB connection using the official driver
  const { MongoClient } = await import("mongodb");
  const url = process.env.MONGO_URL || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "mydb";
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(dbName);
  return { client, db };
}
