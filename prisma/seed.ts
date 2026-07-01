import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean database
  await prisma.feedback.deleteMany({});
  await prisma.agentTask.deleteMany({});
  await prisma.examVersion.deleteMany({});
  await prisma.exam.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.user.deleteMany({});

  // Hash password
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Users
  const professor = await prisma.user.create({
    data: {
      email: 'professor@university.edu',
      name: 'Professor John Doe',
      passwordHash,
      role: 'PROFESSOR',
    },
  });

  const student = await prisma.user.create({
    data: {
      email: 'student@university.edu',
      name: 'Alice Smith',
      passwordHash,
      role: 'STUDENT',
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@university.edu',
      name: 'System Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('Users created:', { professor: professor.email, student: student.email, admin: admin.email });

  // Create Courses
  const compilerDesign = await prisma.course.create({
    data: {
      id: 'cs-401-compiler',
      name: 'Compiler Design',
      code: 'CS401',
      professorId: professor.id,
    },
  });

  const databaseSystems = await prisma.course.create({
    data: {
      id: 'cs-302-database',
      name: 'Database Management Systems',
      code: 'CS302',
      professorId: professor.id,
    },
  });

  const machineLearning = await prisma.course.create({
    data: {
      id: 'cs-452-ml',
      name: 'Machine Learning',
      code: 'CS452',
      professorId: professor.id,
    },
  });

  console.log('Courses seeded successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
