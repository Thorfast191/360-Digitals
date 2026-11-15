import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { LIMITS, clearRateLimit, clientIp, hitRateLimit } from "@/lib/rate-limit";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

// Compared against when the email is unknown, so both paths cost one bcrypt
// round and response time doesn't reveal which emails exist (audit F-11).
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-real-password", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Self-hosted behind a reverse proxy (see deploy/nginx.conf): trust the
  // forwarded host instead of requiring an AUTH_URL env var. Without this,
  // Auth.js throws `UntrustedHost` under `next start` and admin login breaks.
  trustHost: true,
  // Was the 30-day default; shorter lifetime limits a stolen cookie (F-03).
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Throttle by account and by source IP (audit F-02).
        const ip = clientIp(await headers());
        const [byEmail, byIp] = await Promise.all([
          hitRateLimit(`login:email:${email}`, LIMITS.loginPerEmail.limit, LIMITS.loginPerEmail.windowSeconds),
          hitRateLimit(`login:ip:${ip}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowSeconds),
        ]);
        if (!byEmail.ok || !byIp.ok) throw new RateLimitedSignin();

        const user = await prisma.adminUser.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        const isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !isValid) return null;

        await clearRateLimit(`login:email:${email}`);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Runs on every auth() call. Re-checking the DB means deleting an admin
    // ends their session immediately instead of after the JWT expires (F-03).
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        return token;
      }
      if (!token.id) return null;
      const current = await prisma.adminUser.findUnique({
        where: { id: token.id as string },
        select: { id: true, email: true, name: true },
      });
      if (!current) return null;
      token.email = current.email;
      token.name = current.name;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
