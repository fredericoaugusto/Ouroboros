import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByUsername } from "../../../../lib/users";
import { recordAuditLog } from "@/lib/auditLogger";
import { getImpersonationState } from "@/lib/adminAuth";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        const user = await getUserByUsername(credentials.username);

        if (user && bcrypt.compareSync(credentials.password, user.password)) {
          if (user.status === 'pending') {
            await recordAuditLog({
              actorType: 'user',
              actorId: user.id,
              actorUsername: user.username,
              action: 'USER_LOGIN_BLOCKED',
              entityType: 'session',
              entityId: user.id,
              details: { reason: 'pending_approval' },
            });
            throw new Error('Cadastro aguardando aprovação de um administrador.');
          }

          if (user.status === 'rejected' || user.status === 'suspended') {
            await recordAuditLog({
              actorType: 'user',
              actorId: user.id,
              actorUsername: user.username,
              action: 'USER_LOGIN_BLOCKED',
              entityType: 'session',
              entityId: user.id,
              details: { reason: user.status },
            });
            throw new Error('Sua conta está suspensa ou foi recusada. Contate um administrador.');
          }

          await recordAuditLog({
            actorType: 'user',
            actorId: user.id,
            actorUsername: user.username,
            action: 'USER_LOGIN',
            entityType: 'session',
            entityId: user.id,
          });

          return { id: user.id, name: user.username, email: user.username };
        } else {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      const impersonation = await getImpersonationState();
      if (impersonation) {
        session.user = {
          ...(session.user || {}),
          id: impersonation.targetUserId,
          name: impersonation.targetUsername,
          email: impersonation.targetUsername,
        };
        session.impersonatedBy = {
          adminId: impersonation.adminId,
          adminUsername: impersonation.adminUsername,
          startedAt: impersonation.startedAt,
        };
        return session;
      }

      if (token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
