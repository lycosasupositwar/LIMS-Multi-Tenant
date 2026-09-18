import bcrypt from 'bcryptjs';
import { initDb, getUserByEmail } from './src/db/auth.ts';

async function run() {
  await initDb();
  const user = await getUserByEmail("jean.dupont@entreprise.com");
  console.log("User:", user);
  if (!user) {
    console.log("User not found!");
    return;
  }
  const isValid = await bcrypt.compare("password123", user.passwordHash);
  console.log("isValid:", isValid);
}
run();
