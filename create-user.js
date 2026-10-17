// Usage: node create-user.js <username> <email> <password> <role>
// Example: node create-user.js chris chris@example.com "a long passphrase" admin
const { eq } = require("drizzle-orm");
const { db } = require("./db");
const { roles, users } = require("./schema");
const { initDb } = require("./init-db");
const { hashPassword } = require("./auth");

async function main() {
  const [username, email, password, roleName] = process.argv.slice(2);
  if (!username || !email || !password || !roleName) {
    console.error("Usage: node create-user.js <username> <email> <password> <role>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  initDb();

  const role = await db.select().from(roles).where(eq(roles.name, roleName)).get();
  if (!role) {
    console.error(`Unknown role "${roleName}"`);
    process.exit(1);
  }

  await db.insert(users).values({
    username,
    email,
    password_hash: await hashPassword(password),
    role_id: role.id,
  });
  console.log(`Created user "${username}" with role "${roleName}"`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
