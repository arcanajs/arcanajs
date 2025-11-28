export default async function dbConnect() {
  const mysql = await import("mysql2/promise");
  const uri = process.env.MYSQL_URL;
  if (uri) {
    return await mysql.createConnection(uri as any);
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    database: process.env.MYSQL_DB || "mydb",
    password: process.env.MYSQL_PASSWORD || undefined,
  });
  return connection;
}
