import "dotenv/config";
import { Client } from "pg";

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,

    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  console.log("Connected!");

  const result = await client.query(
    "SELECT NOW()"
  );

  console.log(result.rows);

  await client.end();
}

main();