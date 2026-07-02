import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subDays } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Admin user
  const adminHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@plant.com" },
    update: {},
    create: {
      email: "admin@plant.com",
      name: "Plant Admin",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "supervisor@plant.com" },
    update: {},
    create: {
      email: "supervisor@plant.com",
      name: "Line Supervisor",
      passwordHash: await bcrypt.hash("super123", 12),
      role: "SUPERVISOR",
    },
  });

  console.log("Users created.");

  // Defect types — normalized
  const defectData = [
    { name: "Dent", category: "Surface" },
    { name: "Scratch", category: "Surface" },
    { name: "Surface Defect", category: "Surface" },
    { name: "Wrong Wire", category: "Assembly" },
    { name: "Crimping NG", category: "Assembly" },
    { name: "Wire Cut", category: "Assembly" },
    { name: "Bend", category: "Dimensional" },
    { name: "Thread No-Go", category: "Dimensional" },
    { name: "Chamfer NG", category: "Dimensional" },
    { name: "Length Undersize", category: "Dimensional" },
    { name: "Dimension Out", category: "Dimensional" },
    { name: "Plating NG", category: "Finishing" },
    { name: "Burr", category: "Finishing" },
    { name: "Power Cut", category: "Process" },
    { name: "Setting Issue", category: "Process" },
    { name: "Porosity", category: "Material" },
    { name: "Crack", category: "Material" },
  ];

  for (const d of defectData) {
    await prisma.defectType.upsert({
      where: { name: d.name },
      update: {},
      create: d,
    });
  }
  console.log("Defect types created.");

  // Sample lines (generic — user replaces via Admin panel)
  const lineData = [
    { name: "Line A", description: "Primary assembly line" },
    { name: "Line B", description: "CNC machining" },
    { name: "Line C", description: "Final inspection" },
  ];

  const lines = [];
  for (const l of lineData) {
    const line = await prisma.line.upsert({
      where: { name: l.name },
      update: {},
      create: l,
    });
    lines.push(line);
  }
  console.log("Lines created.");

  // Parts
  const partData = [
    { name: "Inlet Nut", netWeight: 0.12, unitCost: 45 },
    { name: "Collar 680", netWeight: 0.08, unitCost: 30 },
    { name: "Assembly ACKA", netWeight: 0.25, unitCost: 120 },
    { name: "Collar Standard", netWeight: 0.09, unitCost: 35 },
    { name: "Bushing Type-1", netWeight: 0.15, unitCost: 60 },
    { name: "End Cap", netWeight: 0.06, unitCost: 25 },
  ];

  const parts = [];
  for (const p of partData) {
    const part = await prisma.part.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
    parts.push(part);
  }
  console.log("Parts created.");

  // 60 days of sample daily entries
  const defectTypes = await prisma.defectType.findMany();
  const commonDefects = defectTypes.slice(0, 8);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let entriesCreated = 0;

  for (let i = 60; i >= 0; i--) {
    const date = subDays(today, i);

    for (const line of lines) {
      const lineParts = parts.slice(0, Math.floor(Math.random() * 3) + 2);

      for (const part of lineParts) {
        const producedQty = Math.floor(Math.random() * 400) + 100;

        const existing = await prisma.dailyEntry.findUnique({
          where: {
            date_lineId_partId: { date, lineId: line.id, partId: part.id },
          },
        });
        if (existing) continue;

        const entry = await prisma.dailyEntry.create({
          data: {
            date,
            lineId: line.id,
            partId: part.id,
            producedQty,
            enteredById: admin.id,
          },
        });

        const numDefects = Math.floor(Math.random() * 3) + 1;
        const shuffled = [...commonDefects].sort(() => Math.random() - 0.5);

        for (let d = 0; d < numDefects; d++) {
          const defect = shuffled[d];
          const qty = Math.floor(Math.random() * 15) + 1;
          const unitCost = part.unitCost;

          await prisma.rejection.create({
            data: {
              dailyEntryId: entry.id,
              defectTypeId: defect.id,
              qty,
              unitCost,
              totalCost: qty * unitCost,
              type: Math.random() < 0.2 ? "REWORK" : "REJECTION",
            },
          });
        }

        entriesCreated++;
      }
    }
  }

  console.log(`Sample entries created: ${entriesCreated}`);
  console.log("\nSeed complete!");
  console.log("  Admin login:      admin@plant.com / admin123");
  console.log("  Supervisor login: supervisor@plant.com / super123");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
