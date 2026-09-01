import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db/mongoose";
import { verifyPassword } from "@/lib/auth/password";
import { assertAuthConfigured } from "@/lib/env";
import { UserModel } from "@/models/user";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        assertAuthConfigured();
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        await connectToDatabase();

        const user = await UserModel.findOne({
          email: parsed.data.email.toLowerCase(),
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValidPassword = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.isActive = user.isActive;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub && token.role) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.isActive = Boolean(token.isActive);
      }

      return session;
    },
  },
};
