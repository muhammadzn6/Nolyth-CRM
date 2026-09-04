import { argon2id, hash } from "argon2";
import { database } from "../src/client";

const DEMO_PASSWORD = process.env.ORBIT_DEMO_PASSWORD ?? "OrbitDemo123!";
const ids = {
  bd: "10000000-0000-4000-8000-000000000001",
  closer: "10000000-0000-4000-8000-000000000002",
  candidate: "20000000-0000-4000-8000-000000000001",
  profile: "30000000-0000-4000-8000-000000000001",
  source: "40000000-0000-4000-8000-000000000001",
  company: "50000000-0000-4000-8000-000000000001",
  contact: "60000000-0000-4000-8000-000000000001",
  leadApplied: "70000000-0000-4000-8000-000000000001",
  leadInterview: "70000000-0000-4000-8000-000000000002",
  leadOffer: "70000000-0000-4000-8000-000000000003",
  profileBdAssignment: "80000000-0000-4000-8000-000000000001",
  profileCloserEligibility: "80000000-0000-4000-8000-000000000002",
  leadCloserAssignment: "80000000-0000-4000-8000-000000000003",
  task: "90000000-0000-4000-8000-000000000001",
  interview: "a0000000-0000-4000-8000-000000000001",
  offer: "b0000000-0000-4000-8000-000000000001",
  notification: "c0000000-0000-4000-8000-000000000001",
  activity: "d0000000-0000-4000-8000-000000000001",
};

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, { type: argon2id });
  const admin = await database.user.findUnique({ where: { email: "admin@orbit.local" } });
  if (!admin) throw new Error("Run the normal admin seed first");

  const bd = await database.user.upsert({
    where: { id: ids.bd },
    create: { id: ids.bd, displayName: "Maya Brooks (BD)", email: "maya.bd@orbit.local", passwordHash, passwordChangedAt: new Date(), role: "BD", timezone: "America/New_York", createdByUserId: admin.id },
    update: { displayName: "Maya Brooks (BD)", email: "maya.bd@orbit.local", passwordHash, passwordChangedAt: new Date(), role: "BD", isActive: true },
  });
  const closer = await database.user.upsert({
    where: { id: ids.closer },
    create: { id: ids.closer, displayName: "Noah Patel (Closer)", email: "noah.closer@orbit.local", passwordHash, passwordChangedAt: new Date(), role: "CLOSER", timezone: "America/Chicago", createdByUserId: admin.id },
    update: { displayName: "Noah Patel (Closer)", email: "noah.closer@orbit.local", passwordHash, passwordChangedAt: new Date(), role: "CLOSER", isActive: true },
  });

  await database.candidate.upsert({
    where: { id: ids.candidate },
    create: { id: ids.candidate, firstName: "Avery", lastName: "Chen", preferredName: "Avery", email: "avery.chen@orbit.local", phone: "+1 555 010 2040", timezone: "America/New_York", location: "New York, NY" },
    update: { firstName: "Avery", lastName: "Chen", email: "avery.chen@orbit.local", status: "ACTIVE" },
  });
  await database.profile.upsert({
    where: { id: ids.profile },
    create: { id: ids.profile, candidateId: ids.candidate, createdById: admin.id, name: "Avery Chen — Senior Platform Engineer", description: "Demo candidate profile showing the BD-to-closer workflow.", status: "ACTIVE", defaultCurrency: "USD", targetCompensation: 165000, compensationPeriod: "YEARLY", targetRoles: ["Platform Engineer", "Backend Engineer"], preferredLocations: ["New York", "Remote"], workplacePreferences: ["REMOTE", "HYBRID"], jobTypePreferences: ["FULL_TIME"] },
    update: { name: "Avery Chen — Senior Platform Engineer", status: "ACTIVE" },
  });
  await database.jobSource.upsert({ where: { id: ids.source }, create: { id: ids.source, name: "Demo referral", displayOrder: 1 }, update: { name: "Demo referral", isActive: true } });
  await database.company.upsert({ where: { id: ids.company }, create: { id: ids.company, canonicalName: "Northstar Labs", website: "https://northstar.example", domain: "northstar.example", industry: "Developer Tools", location: "New York, NY", createdById: bd.id }, update: { canonicalName: "Northstar Labs", createdById: bd.id } });
  await database.contact.upsert({ where: { id: ids.contact }, create: { id: ids.contact, companyId: ids.company, createdById: bd.id, name: "Jordan Lee", title: "Talent Partner", email: "jordan.lee@northstar.example" }, update: { name: "Jordan Lee", companyId: ids.company } });

  const appliedDate = new Date();
  appliedDate.setDate(appliedDate.getDate() - 4);
  await database.jobLead.upsert({ where: { id: ids.leadApplied }, create: { id: ids.leadApplied, profileId: ids.profile, companyId: ids.company, sourceId: ids.source, createdById: bd.id, currentOwnerId: bd.id, companyName: "Northstar Labs", jobTitle: "Senior Platform Engineer", description: "Initial application awaiting recruiter response.", rawUrl: "https://northstar.example/jobs/platform", location: "Remote — US", workplaceType: "REMOTE", employmentType: "FULL_TIME", appliedDate, source: "referral", canonicalUrl: "https://northstar.example/jobs/platform", canonicalHash: "demo-northstar-platform", status: "APPLIED" }, update: { status: "APPLIED", currentOwnerId: bd.id } });
  await database.jobLead.upsert({ where: { id: ids.leadInterview }, create: { id: ids.leadInterview, profileId: ids.profile, companyId: ids.company, sourceId: ids.source, createdById: bd.id, currentOwnerId: bd.id, responsibleCloserId: closer.id, companyName: "Northstar Labs", jobTitle: "Backend Engineer", description: "Candidate has passed the recruiter screen and is moving through interviews.", rawUrl: "https://northstar.example/jobs/backend", location: "New York, NY", workplaceType: "HYBRID", employmentType: "FULL_TIME", appliedDate, source: "referral", canonicalUrl: "https://northstar.example/jobs/backend", canonicalHash: "demo-northstar-backend", status: "INTERVIEWING", isImportant: true }, update: { status: "INTERVIEWING", currentOwnerId: bd.id, responsibleCloserId: closer.id, isImportant: true } });
  await database.jobLead.upsert({ where: { id: ids.leadOffer }, create: { id: ids.leadOffer, profileId: ids.profile, companyId: ids.company, sourceId: ids.source, createdById: bd.id, currentOwnerId: bd.id, responsibleCloserId: closer.id, companyName: "Northstar Labs", jobTitle: "Staff Infrastructure Engineer", description: "Offer is ready for candidate review.", rawUrl: "https://northstar.example/jobs/staff-infra", location: "Remote — US", workplaceType: "REMOTE", employmentType: "FULL_TIME", appliedDate, source: "referral", canonicalUrl: "https://northstar.example/jobs/staff-infra", canonicalHash: "demo-northstar-staff", status: "OFFER_RECEIVED" }, update: { status: "OFFER_RECEIVED", currentOwnerId: bd.id, responsibleCloserId: closer.id } });
  for (const leadId of [ids.leadApplied, ids.leadInterview, ids.leadOffer]) {
    await database.leadContact.upsert({ where: { leadId_contactId: { leadId, contactId: ids.contact } }, create: { leadId, contactId: ids.contact, role: "RECRUITER", isPrimary: true }, update: { role: "RECRUITER", isPrimary: true } });
  }

  await database.profileBdAssignment.upsert({ where: { id: ids.profileBdAssignment }, create: { id: ids.profileBdAssignment, profileId: ids.profile, userId: bd.id, assignedById: admin.id }, update: { userId: bd.id, endedAt: null } });
  await database.profileCloserEligibility.upsert({ where: { id: ids.profileCloserEligibility }, create: { id: ids.profileCloserEligibility, profileId: ids.profile, userId: closer.id, setById: admin.id, isEligible: true }, update: { userId: closer.id, isEligible: true, endedAt: null } });
  await database.leadCloserAssignment.upsert({ where: { id: ids.leadCloserAssignment }, create: { id: ids.leadCloserAssignment, leadId: ids.leadInterview, userId: closer.id, assignedById: admin.id }, update: { userId: closer.id, endedAt: null } });

  const interviewStart = new Date();
  interviewStart.setDate(interviewStart.getDate() + 2);
  interviewStart.setHours(15, 0, 0, 0);
  const interviewEnd = new Date(interviewStart.getTime() + 45 * 60 * 1000);
  await database.interviewRound.upsert({ where: { id: ids.interview }, create: { id: ids.interview, leadId: ids.leadInterview, roundNumber: 1, roundType: "TECHNICAL", status: "SCHEDULED", closerId: closer.id, creatorId: bd.id, startsAt: interviewStart, endsAt: interviewEnd, timezone: "America/New_York", originalDatetimeText: "Demo interview scheduled for two days from now", interviewer: "Jordan Lee", meetingLink: "https://meet.example/orbit-demo", preparationNotes: "Review distributed systems and Kubernetes experience." }, update: { status: "SCHEDULED", closerId: closer.id, startsAt: interviewStart, endsAt: interviewEnd } });
  await database.task.upsert({ where: { id: ids.task }, create: { id: ids.task, profileId: ids.profile, leadId: ids.leadInterview, assigneeId: bd.id, creatorId: admin.id, type: "FOLLOW_UP", title: "Follow up with Northstar recruiter", description: "Confirm feedback after Avery's technical interview.", priority: "HIGH", dueAt: interviewEnd }, update: { status: "OPEN", assigneeId: bd.id, dueAt: interviewEnd } });
  await database.availabilityRule.deleteMany({ where: { closerId: closer.id } });
  await database.availabilityRule.createMany({ data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ closerId: closer.id, dayOfWeek, localStart: "09:00", localEnd: "17:00", timezone: "America/Chicago" })) });
  await database.offer.upsert({ where: { id: ids.offer }, create: { id: ids.offer, leadId: ids.leadOffer, compensationAmount: 175000, compensationCurrency: "USD", employmentType: "FULL_TIME", details: "Demo offer: Staff Infrastructure Engineer with equity and benefits.", decisionDeadline: new Date(Date.now() + 7 * 86400000), createdById: bd.id }, update: { status: "OFFERED", compensationAmount: 175000, details: "Demo offer: Staff Infrastructure Engineer with equity and benefits." } });
  await database.notification.upsert({ where: { id: ids.notification }, create: { id: ids.notification, idempotencyKey: "demo-offer-ready", recipientId: closer.id, type: "IN_APP", title: "Demo offer ready for review", message: "Northstar Labs offer is ready for Avery Chen.", relatedEntityType: "offer", relatedEntityId: ids.offer }, update: { readAt: null, recipientId: closer.id } });
  await database.activityEvent.upsert({ where: { id: ids.activity }, create: { id: ids.activity, actorId: admin.id, actorNameSnapshot: admin.displayName, actorRoleSnapshot: admin.role, profileId: ids.profile, leadId: ids.leadInterview, entityType: "demo_workspace", entityId: ids.profile, action: "demo.seeded", metadata: { bdId: bd.id, closerId: closer.id } }, update: { actorId: admin.id, metadata: { bdId: bd.id, closerId: closer.id } } });

  console.log(JSON.stringify({ bd: { name: bd.displayName, email: bd.email }, closer: { name: closer.displayName, email: closer.email }, password: DEMO_PASSWORD, profileId: ids.profile, leadIds: [ids.leadApplied, ids.leadInterview, ids.leadOffer] }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => { await database.$disconnect(); });
