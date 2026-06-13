import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import { z } from "zod";
import { db, schema } from "@/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, parsed.data.email.toLowerCase()))
        .limit(1);

      if (!user?.passwordHash) return null;
      const valid = await verify(user.passwordHash, parsed.data.password);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
    authenticatorsTable: schema.authenticators,
  }),
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const googleProfile = profile as { email_verified?: boolean } | undefined;
      return googleProfile?.email_verified === true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        const [user] = await db
          .select({ 
            id: schema.users.id, 
            role: schema.users.role,
            email: schema.users.email 
          })
          .from(schema.users)
          .where(eq(schema.users.id, token.sub))
          .limit(1);

        if (user) {
          session.user.id = user.id;
          
          const adminEmail = process.env.ADMIN_EMAIL;
          if (
            adminEmail && 
            user.email.toLowerCase().trim() === adminEmail.toLowerCase().trim() && 
            user.role !== "admin"
          ) {
            await db
              .update(schema.users)
              .set({ role: "admin" })
              .where(eq(schema.users.id, user.id));
            session.user.role = "admin";
          } else {
            session.user.role = user.role;
          }
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
