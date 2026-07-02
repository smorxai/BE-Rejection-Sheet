import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Deletes all entries entered by the seed admin user (admin@plant.com)
// Only callable by ADMIN role. Safe to run — only removes sample data.
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const seedUser = await prisma.user.findUnique({ where: { email: "admin@plant.com" } });
  if (!seedUser) return NextResponse.json({ deleted: 0 });

  // Delete all daily entries (cascades to rejections) created by seed user
  const result = await prisma.dailyEntry.deleteMany({
    where: { enteredById: seedUser.id },
  });

  return NextResponse.json({ deleted: result.count });
}
