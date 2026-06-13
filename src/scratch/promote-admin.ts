import { db, schema } from "../db";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: bun src/scratch/promote-admin.ts <email>");
    process.exit(1);
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  await db
    .update(schema.users)
    .set({ role: "admin" })
    .where(eq(schema.users.id, user.id));

  console.log(`Successfully promoted ${email} to admin!`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
