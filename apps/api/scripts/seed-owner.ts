import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL ?? "owner@minepanel.local";
  const rawPassword = process.env.OWNER_PASSWORD;

  if (!rawPassword || rawPassword.length < 10) {
    throw new Error("OWNER_PASSWORD must exist and be at least 10 characters long");
  }

  const passwordHash = await bcrypt.hash(rawPassword, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.owner },
    create: {
      email,
      passwordHash,
      role: UserRole.owner
    }
  });

  await prisma.node.upsert({
    where: { id: "local" },
    update: { status: "healthy" },
    create: {
      id: "local",
      name: "Local Node",
      type: "local",
      status: "healthy"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
