import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/mongoose";
import { hashPassword } from "@/lib/auth/password";
import { ActivityEventModel } from "@/models/activity-event";
import { InterviewRoundModel } from "@/models/interview-round";
import { JobLeadModel } from "@/models/job-lead";
import { ProfileModel } from "@/models/profile";
import { UserModel } from "@/models/user";
import { createInterviewRound } from "@/services/interview-round-service";
import { createLead, updateLead } from "@/services/lead-service";
import { createProfile } from "@/services/profile-service";
import { createUser } from "@/services/user-service";
import type { AppActor } from "@/types/auth";

const DEFAULT_PASSWORD = "Orbit12345!";

function daysFromNow(days: number, hour = 14) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function clearDatabase() {
  await Promise.all([
    ActivityEventModel.deleteMany({}),
    InterviewRoundModel.deleteMany({}),
    JobLeadModel.deleteMany({}),
    ProfileModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
}

async function ensureModelsReady() {
  await Promise.all([
    UserModel.init(),
    ProfileModel.init(),
    JobLeadModel.init(),
    ActivityEventModel.init(),
    InterviewRoundModel.init(),
  ]);
}

function toActor(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: AppActor["role"];
  isActive: boolean;
}): AppActor {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

function isTransientSeedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("catalog changes") ||
    error.message.includes("TransientTransactionError") ||
    error.message.includes("WriteConflict")
  );
}

async function seedEyongProfile(
  bdActor: AppActor,
  closerActor: AppActor,
  profileId: string,
) {
  const applied = (
    await createLead(
      profileId,
      {
        companyName: "Stripe",
        jobTitle: "Senior Software Engineer",
        jobUrl: "https://stripe.com/jobs/senior-software-engineer",
        recruiterName: "Jordan Lee",
        rateAmount: 85,
        rateUnit: "HOURLY",
        contractType: "C2C",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  const inProcess = (
    await createLead(
      profileId,
      {
        companyName: "Databricks",
        jobTitle: "Platform Engineer",
        jobUrl: "https://databricks.com/jobs/platform-engineer",
        recruiterName: "Sam Rivera",
        rateAmount: 90,
        rateUnit: "HOURLY",
        contractType: "C2C",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  await updateLead(inProcess.id, { status: "IN_PROCESS", isImportant: true }, bdActor);

  await createInterviewRound(
    inProcess.id,
    {
      roundType: "SCREENING",
      result: "PASSED",
      notes: "Strong background in distributed systems and Python.",
    },
    closerActor,
  );

  await createInterviewRound(
    inProcess.id,
    {
      roundType: "TECHNICAL",
      result: "SCHEDULED",
      scheduledAt: daysFromNow(2, 11),
      notes: "Technical round scheduled with hiring manager.",
    },
    closerActor,
  );

  const finalRound = (
    await createLead(
      profileId,
      {
        companyName: "Snowflake",
        jobTitle: "Staff Engineer",
        jobUrl: "https://snowflake.com/jobs/staff-engineer",
        recruiterName: "Priya Nair",
        rateAmount: 175000,
        rateUnit: "YEARLY",
        contractType: "W2",
        jobType: "FULL_TIME",
      },
      bdActor,
    )
  ).lead;

  await updateLead(finalRound.id, { status: "FINAL_ROUND" }, bdActor);

  const closed = (
    await createLead(
      profileId,
      {
        companyName: "Shopify",
        jobTitle: "Backend Developer",
        jobUrl: "https://shopify.com/jobs/backend-developer",
        recruiterName: "Alex Kim",
        rateAmount: 80,
        rateUnit: "HOURLY",
        contractType: "1099",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  await updateLead(closed.id, { status: "CLOSED" }, bdActor);

  const dead = (
    await createLead(
      profileId,
      {
        companyName: "Coinbase",
        jobTitle: "Full Stack Engineer",
        jobUrl: "https://coinbase.com/jobs/full-stack",
        recruiterName: "Taylor Brooks",
        rateAmount: 75,
        rateUnit: "HOURLY",
        contractType: "C2C",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  await updateLead(
    dead.id,
    {
      status: "DEAD",
      deadReason: "REJECTED",
      deadNotes: "Client passed after technical screen.",
    },
    bdActor,
  );

  return { applied, inProcess, finalRound };
}

async function seedOlabiProfile(
  bdActor: AppActor,
  closerActor: AppActor,
  profileId: string,
) {
  const applied = (
    await createLead(
      profileId,
      {
        companyName: "Google",
        jobTitle: "Cloud Solutions Architect",
        jobUrl: "https://careers.google.com/jobs/cloud-architect",
        recruiterName: "Maria Gonzalez",
        rateAmount: 95,
        rateUnit: "HOURLY",
        contractType: "C2C",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  const inProcess = (
    await createLead(
      profileId,
      {
        companyName: "Microsoft",
        jobTitle: "Senior Azure Engineer",
        jobUrl: "https://careers.microsoft.com/jobs/azure-engineer",
        recruiterName: "David Chen",
        rateAmount: 88,
        rateUnit: "HOURLY",
        contractType: "C2C",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  await updateLead(inProcess.id, { status: "IN_PROCESS", isImportant: true }, bdActor);

  await createInterviewRound(
    inProcess.id,
    {
      roundType: "SCREENING",
      result: "COMPLETED",
      notes: "Recruiter screening completed. Discussed Azure certifications.",
    },
    closerActor,
  );

  const finalRound = (
    await createLead(
      profileId,
      {
        companyName: "Amazon Web Services",
        jobTitle: "Solutions Architect",
        jobUrl: "https://aws.amazon.com/careers/solutions-architect",
        recruiterName: "Emily Watson",
        rateAmount: 92,
        rateUnit: "HOURLY",
        contractType: "C2C",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  await updateLead(finalRound.id, { status: "FINAL_ROUND" }, bdActor);

  await createInterviewRound(
    finalRound.id,
    {
      roundType: "SYSTEM_DESIGN",
      result: "WAITING",
      scheduledAt: daysFromNow(4, 14),
      notes: "System design round pending scheduling.",
    },
    closerActor,
  );

  const closed = (
    await createLead(
      profileId,
      {
        companyName: "Meta",
        jobTitle: "Infrastructure Engineer",
        jobUrl: "https://metacareers.com/jobs/infrastructure",
        recruiterName: "Chris Patel",
        rateAmount: 180000,
        rateUnit: "YEARLY",
        contractType: "W2",
        jobType: "FULL_TIME",
      },
      bdActor,
    )
  ).lead;

  await updateLead(closed.id, { status: "CLOSED" }, bdActor);

  const dead = (
    await createLead(
      profileId,
      {
        companyName: "Netflix",
        jobTitle: "DevOps Engineer",
        jobUrl: "https://jobs.netflix.com/devops",
        recruiterName: "Rachel Green",
        rateAmount: 82,
        rateUnit: "HOURLY",
        contractType: "1099",
        jobType: "CONTRACT",
      },
      bdActor,
    )
  ).lead;

  await updateLead(
    dead.id,
    {
      status: "DEAD",
      deadReason: "NO_RESPONSE",
      deadNotes: "No response after initial application.",
    },
    bdActor,
  );

  return { applied, inProcess, finalRound };
}

async function runSeed() {
  process.env.AUTH_SECRET ??= "seed-script-secret";
  process.env.AUTH_URL ??= "http://localhost:3000";

  await connectToDatabase();
  await clearDatabase();
  await ensureModelsReady();

  const adminPassword = "Admin12345!";
  const teamPassword = DEFAULT_PASSWORD;

  const admin = await UserModel.create({
    name: "Admin User",
    email: "admin@orbit.local",
    passwordHash: await hashPassword(adminPassword),
    role: "ADMIN",
    isActive: true,
  });

  const adminActor = toActor(admin);

  const siddiqah = await createUser(
    {
      name: "Siddiqah",
      email: "siddiqah@orbit.local",
      password: teamPassword,
      role: "BD",
    },
    adminActor,
  );

  const ali = await createUser(
    {
      name: "Ali",
      email: "ali@orbit.local",
      password: teamPassword,
      role: "CLOSER",
    },
    adminActor,
  );

  const shagufta = await createUser(
    {
      name: "Shagufta",
      email: "shagufta@orbit.local",
      password: teamPassword,
      role: "BD",
    },
    adminActor,
  );

  const emazAshraf = await createUser(
    {
      name: "Emaz Ashraf",
      email: "emaz@orbit.local",
      password: teamPassword,
      role: "CLOSER",
    },
    adminActor,
  );

  const eyongProfile = await createProfile(
    {
      name: "Eyong",
      assignedBD: siddiqah._id.toString(),
      assignedCloser: ali._id.toString(),
    },
    adminActor,
  );

  const olabiProfile = await createProfile(
    {
      name: "Olabi Toufic",
      assignedBD: shagufta._id.toString(),
      assignedCloser: emazAshraf._id.toString(),
    },
    adminActor,
  );

  const eyongLeads = await seedEyongProfile(
    toActor(siddiqah),
    toActor(ali),
    eyongProfile._id.toString(),
  );

  const olabiLeads = await seedOlabiProfile(
    toActor(shagufta),
    toActor(emazAshraf),
    olabiProfile._id.toString(),
  );

  console.log("Seed complete.");
  console.log("");
  console.log("Admin:", admin.email, "/", adminPassword);
  console.log("");
  console.log("Profile: Eyong");
  console.log("  BD:", siddiqah.email, "/", teamPassword);
  console.log("  Closer:", ali.email, "/", teamPassword);
  console.log("");
  console.log("Profile: Olabi Toufic");
  console.log("  BD:", shagufta.email, "/", teamPassword);
  console.log("  Closer:", emazAshraf.email, "/", teamPassword);
  console.log("");
  console.log(
    "Sample leads:",
    eyongLeads.inProcess.companyName,
    "|",
    olabiLeads.finalRound.companyName,
  );
}

async function main() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runSeed();
      return;
    } catch (error) {
      if (!isTransientSeedError(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn(`Seed attempt ${attempt} hit a transient Atlas error, retrying...`);
      await disconnectFromDatabase();
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
