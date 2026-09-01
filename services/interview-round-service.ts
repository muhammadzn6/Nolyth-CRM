import mongoose from "mongoose";

import { requireLeadEditPermission } from "@/lib/auth/authorization";
import { toInterviewRoundRow } from "@/lib/leads/to-round-row";
import { connectToDatabase } from "@/lib/db/mongoose";
import { runInTransaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  createInterviewRoundSchema,
  updateInterviewRoundSchema,
} from "@/lib/validation/interview-rounds";
import { InterviewRoundModel } from "@/models/interview-round";
import { JobLeadModel } from "@/models/job-lead";
import { UserModel } from "@/models/user";
import type { AppActor } from "@/types/auth";
import type { InterviewRoundRow } from "@/types/interview-round";

import { recordActivityEvent } from "@/services/activity-service";
import { getLeadById } from "@/services/lead-service";

async function loadRoundUsers(rounds: Array<{ createdBy: unknown; updatedBy: unknown }>) {
  const userIds = new Set<string>();

  rounds.forEach((round) => {
    userIds.add(
      typeof round.createdBy === "string"
        ? round.createdBy
        : (round.createdBy as { toString(): string }).toString(),
    );
    userIds.add(
      typeof round.updatedBy === "string"
        ? round.updatedBy
        : (round.updatedBy as { toString(): string }).toString(),
    );
  });

  const users = await UserModel.find({ _id: { $in: [...userIds] } }).select("name");
  return new Map(users.map((user) => [user._id.toString(), { name: user.name }]));
}

export async function listInterviewRoundsByLead(
  leadId: string,
  actor: AppActor,
): Promise<InterviewRoundRow[]> {
  await connectToDatabase();
  await getLeadById(leadId, actor);

  const rounds = await InterviewRoundModel.find({ leadId }).sort({ roundNumber: 1 }).lean();
  const users = await loadRoundUsers(rounds);

  return rounds.map((round) => toInterviewRoundRow(round, users));
}

export async function getInterviewRoundById(roundId: string, actor: AppActor) {
  await connectToDatabase();

  const round = await InterviewRoundModel.findById(roundId);
  if (!round) {
    throw new NotFoundError();
  }

  const lead = await JobLeadModel.findById(round.leadId);
  if (!lead) {
    throw new NotFoundError("Lead not found for interview round");
  }

  await getLeadById(lead._id.toString(), actor);
  return round;
}

export async function createInterviewRound(leadId: string, input: unknown, actor: AppActor) {
  requireLeadEditPermission(actor);
  await connectToDatabase();
  const parsed = createInterviewRoundSchema.parse(input);
  const lead = await getLeadById(leadId, actor);

  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const round = await runInTransaction(async (session) => {
        const lastRound = await InterviewRoundModel.findOne({ leadId })
          .sort({ roundNumber: -1 })
          .session(session ?? null);

        const roundNumber = (lastRound?.roundNumber ?? 0) + 1;

        const createdRounds = await InterviewRoundModel.create(
          [
            {
              leadId: new mongoose.Types.ObjectId(leadId),
              profileId: lead.profileId,
              roundNumber,
              roundType: parsed.roundType,
              scheduledAt: parsed.scheduledAt,
              interviewerName: parsed.interviewerName,
              meetingLink: parsed.meetingLink,
              result: parsed.result ?? "SCHEDULED",
              notes: parsed.notes,
              createdBy: new mongoose.Types.ObjectId(actor.id),
              updatedBy: new mongoose.Types.ObjectId(actor.id),
            },
          ],
          { session: session ?? undefined },
        );

        const created = createdRounds[0];

        await recordActivityEvent(
          {
            actor,
            profileId: lead.profileId.toString(),
            leadId,
            entityType: "INTERVIEW_ROUND",
            entityId: created._id.toString(),
            action: "INTERVIEW_ROUND_CREATED",
            newValue: {
              roundNumber: created.roundNumber,
              roundType: created.roundType,
              result: created.result,
            },
            metadata: {
              roundNumber: created.roundNumber,
              roundType: created.roundType,
            },
          },
          session,
        );

        return created;
      });

      const users = await loadRoundUsers([round]);
      return toInterviewRoundRow(round, users);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("E11000") &&
        attempt < maxAttempts - 1
      ) {
        continue;
      }

      if (error instanceof Error && error.message.includes("E11000")) {
        throw new ConflictError("Could not assign round number. Please retry.");
      }

      throw error;
    }
  }

  throw new ConflictError("Could not create interview round");
}

export async function updateInterviewRound(roundId: string, input: unknown, actor: AppActor) {
  requireLeadEditPermission(actor);
  await connectToDatabase();
  const parsed = updateInterviewRoundSchema.parse(input);
  const round = await getInterviewRoundById(roundId, actor);
  const lead = await JobLeadModel.findById(round.leadId);

  if (!lead) {
    throw new NotFoundError("Lead not found for interview round");
  }

  const oldValue = {
    roundType: round.roundType,
    scheduledAt: round.scheduledAt?.toISOString(),
    interviewerName: round.interviewerName,
    meetingLink: round.meetingLink,
    result: round.result,
    notes: round.notes,
  };

  if (parsed.roundType) {
    round.roundType = parsed.roundType;
  }
  if (parsed.scheduledAt !== undefined) {
    round.scheduledAt = parsed.scheduledAt;
  }
  if (parsed.interviewerName !== undefined) {
    round.interviewerName = parsed.interviewerName ?? undefined;
  }
  if (parsed.meetingLink !== undefined) {
    round.meetingLink = parsed.meetingLink ?? undefined;
  }
  if (parsed.result !== undefined) {
    round.result = parsed.result;
  }
  if (parsed.notes !== undefined) {
    round.notes = parsed.notes ?? undefined;
  }

  round.updatedBy = new mongoose.Types.ObjectId(actor.id);

  if (!round.roundNumber || round.roundNumber < 1) {
    throw new ValidationError("Interview rounds must have a valid round number");
  }

  await runInTransaction(async (session) => {
    await round.save({ session: session ?? undefined });

    const newValue = {
      roundType: round.roundType,
      scheduledAt: round.scheduledAt?.toISOString(),
      interviewerName: round.interviewerName,
      meetingLink: round.meetingLink,
      result: round.result,
      notes: round.notes,
    };

    const resultChanged = oldValue.result !== newValue.result;

    await recordActivityEvent(
      {
        actor,
        profileId: lead.profileId.toString(),
        leadId: lead._id.toString(),
        entityType: "INTERVIEW_ROUND",
        entityId: round._id.toString(),
        action: resultChanged ? "INTERVIEW_ROUND_RESULT_CHANGED" : "INTERVIEW_ROUND_UPDATED",
        oldValue,
        newValue,
        metadata: {
          roundNumber: round.roundNumber,
          roundType: round.roundType,
        },
      },
      session,
    );
  });

  const users = await loadRoundUsers([round]);
  return toInterviewRoundRow(round, users);
}
