import { AuthenticationError, AuthorizationError } from "../errors/app-error";
import { AuthorizationService } from "./authorization.service";
import { IdentityService } from "./identity.service";
import { hashPassword, verifyPassword } from "./password";
import { SessionService } from "./session.service";

type User = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string | null;
  role: "ADMIN" | "BD" | "CLOSER";
  isActive: boolean;
  timezone: string;
  lastLoginAt: Date | null;
};

type Session = {
  id: string;
  userId: string;
  sessionTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

const SESSION_SECRET = "task-five-session-secret";

function createPersistence(users: User[]) {
  const sessions: Session[] = [];
  const bdAssignments = new Set<string>();
  const closerEligibilities = new Set<string>();

  return {
    users,
    sessions,
    bdAssignments,
    closerEligibilities,
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((user) => user.email === where.email || user.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
        const user = users.find((candidate) => candidate.id === where.id);

        if (!user) {
          throw new Error("User not found");
        }

        Object.assign(user, data);
        return user;
      },
    },
    userSession: {
      updateMany: async ({ where, data }: { where: { userId?: string }; data: Partial<Session> }) => {
        let count = 0;

        for (const session of sessions) {
          if (session.userId === where.userId) {
            Object.assign(session, data);
            count += 1;
          }
        }

        return { count };
      },
      create: async ({ data }: { data: Omit<Session, "id" | "revokedAt"> }) => {
        const session = { ...data, id: `session-${sessions.length + 1}`, revokedAt: null };
        sessions.push(session);
        return session;
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { sessionTokenHash: string };
        include?: { user: true };
      }) => {
        const session = sessions.find((candidate) => candidate.sessionTokenHash === where.sessionTokenHash);

        if (!session) {
          return null;
        }

        return {
          ...session,
          user: include?.user ? users.find((user) => user.id === session.userId) ?? null : null,
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Session> }) => {
        const session = sessions.find((candidate) => candidate.id === where.id);

        if (!session) {
          throw new Error("Session not found");
        }

        Object.assign(session, data);
        return session;
      },
    },
    profileBdAssignment: {
      findFirst: async ({ where }: { where: { profileId: string; userId: string; endedAt: null } }) =>
        bdAssignments.has(`${where.profileId}:${where.userId}`) ? { id: "assignment" } : null,
    },
    profileCloserEligibility: {
      findFirst: async ({
        where,
      }: {
        where: { profileId: string; userId: string; isEligible: true; endedAt: null };
      }) =>
        closerEligibilities.has(`${where.profileId}:${where.userId}`) ? { id: "eligibility" } : null,
    },
  };
}

describe("identity boundary", () => {
  const activeUser: User = {
    id: "10000000-0000-4000-8000-000000000001",
    displayName: "Active User",
    email: "active@example.com",
    passwordHash: null,
    role: "BD",
    isActive: true,
    timezone: "America/New_York",
    lastLoginAt: null,
  };
  const inactiveUser: User = {
    ...activeUser,
    id: "10000000-0000-4000-8000-000000000002",
    email: "inactive@example.com",
    isActive: false,
  };

  it("hashes passwords with Argon2id", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(passwordHash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, "incorrect password")).resolves.toBe(false);
  });

  it("uses a valid fixed dummy hash for absent credentials", async () => {
    await expect(verifyPassword(null, "submitted-password")).resolves.toBe(false);
  });

  it("denies inactive users with the same generic invalid-login error", async () => {
    activeUser.passwordHash = await hashPassword("correct-password");
    inactiveUser.passwordHash = await hashPassword("correct-password");
    const persistence = createPersistence([{ ...activeUser }, { ...inactiveUser }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const identity = new IdentityService(persistence, sessions);

    await expect(identity.login(
      { email: activeUser.email, password: "wrong-password" },
      {},
    )).rejects.toEqual(
      new AuthenticationError("Invalid email or password"),
    );
    await expect(identity.login(
      { email: inactiveUser.email, password: "correct-password" },
      {},
    )).rejects.toEqual(
      new AuthenticationError("Invalid email or password"),
    );
  });

  it("creates a hashed, rotating session token for a successful login", async () => {
    activeUser.passwordHash = await hashPassword("correct-password");
    const persistence = createPersistence([{ ...activeUser }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const identity = new IdentityService(persistence, sessions);

    const firstLogin = await identity.login(
      { email: activeUser.email, password: "correct-password" },
      {},
    );
    const secondLogin = await identity.login(
      { email: activeUser.email, password: "correct-password" },
      {},
    );

    expect(firstLogin.user).toEqual({
      id: activeUser.id,
      displayName: activeUser.displayName,
      email: activeUser.email,
      role: activeUser.role,
      isActive: true,
      timezone: "America/New_York",
    });
    expect(secondLogin.sessionToken).not.toBe(firstLogin.sessionToken);
    expect(persistence.sessions).toEqual([
      expect.objectContaining({
        sessionTokenHash: expect.any(String),
        revokedAt: expect.any(Date),
      }),
      expect.objectContaining({
        sessionTokenHash: expect.any(String),
        revokedAt: null,
      }),
    ]);
    expect(persistence.sessions.map((session) => session.sessionTokenHash)).not.toContain(
      firstLogin.sessionToken,
    );
    expect(persistence.sessions.map((session) => session.sessionTokenHash)).not.toContain(
      secondLogin.sessionToken,
    );
  });

  it("changes an active user's password and revokes their sessions", async () => {
    activeUser.passwordHash = await hashPassword("correct-password");
    const persistence = createPersistence([{ ...activeUser }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const identity = new IdentityService(persistence, sessions);
    const login = await identity.login({ email: activeUser.email, password: "correct-password" }, {});

    await identity.changePassword(
      { ...activeUser, isActive: true },
      { currentPassword: "correct-password", newPassword: "a-new-password-123" },
    );

    await expect(verifyPassword(persistence.users[0]?.passwordHash, "a-new-password-123")).resolves.toBe(true);
    await expect(sessions.requireActiveUser({ cookies: { orbit_session: login.sessionToken } })).rejects.toThrow(AuthenticationError);
  });

  it("loads the active user from a session before authenticating", async () => {
    activeUser.passwordHash = await hashPassword("correct-password");
    const persistence = createPersistence([{ ...activeUser }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const identity = new IdentityService(persistence, sessions);
    const login = await identity.login({ email: activeUser.email, password: "correct-password" }, {});
    const request = { cookies: { orbit_session: login.sessionToken } };

    await expect(sessions.requireActiveUser(request)).resolves.toMatchObject({ id: activeUser.id });
  });

  it("rejects an OAuth state when it is returned with a different session", async () => {
    activeUser.passwordHash = await hashPassword("correct-password");
    const persistence = createPersistence([{ ...activeUser }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const identity = new IdentityService(persistence, sessions);
    const firstLogin = await identity.login({ email: activeUser.email, password: "correct-password" }, {});
    const state = sessions.createOAuthState(
      { ...activeUser, isActive: true },
      { cookies: { orbit_session: firstLogin.sessionToken } },
    );
    const secondLogin = await identity.login({ email: activeUser.email, password: "correct-password" }, {});

    expect(() =>
      sessions.requireOAuthState(
        { ...activeUser, isActive: true },
        { cookies: { orbit_session: secondLogin.sessionToken } },
        state,
      ),
    ).toThrow(new AuthenticationError("Invalid Google OAuth state"));
  });

  it("rejects a revoked session", async () => {
    activeUser.passwordHash = await hashPassword("correct-password");
    const persistence = createPersistence([{ ...activeUser }]);
    const sessions = new SessionService(persistence, SESSION_SECRET);
    const identity = new IdentityService(persistence, sessions);
    const login = await identity.login({ email: activeUser.email, password: "correct-password" }, {});
    const request = { cookies: { orbit_session: login.sessionToken } };

    await identity.logout(request);
    await expect(sessions.requireActiveUser(request)).rejects.toEqual(new AuthenticationError());
  });

  it("denies roles not explicitly allowed", () => {
    const authorization = new AuthorizationService(createPersistence([]));

    expect(() => authorization.assertRole({ ...activeUser }, ["ADMIN"])).toThrow(AuthorizationError);
  });

  it("allows profile access only for an active profile assignment or administrator", async () => {
    const persistence = createPersistence([{ ...activeUser }]);
    persistence.bdAssignments.add(`profile-1:${activeUser.id}`);
    const authorization = new AuthorizationService(persistence);

    await expect(authorization.assertProfileAccess({ ...activeUser }, "profile-1")).resolves.toBeUndefined();
    await expect(authorization.assertProfileAccess({ ...activeUser }, "profile-2")).rejects.toThrow(
      AuthorizationError,
    );
    await expect(
      authorization.assertProfileAccess({ ...activeUser, role: "ADMIN" }, "profile-2"),
    ).resolves.toBeUndefined();
  });
});
