import { AuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/admins";
import { verifyRecaptcha } from "@/lib/recaptchaServer";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        recaptchaToken: { label: "reCAPTCHA", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Barra robôs testando senhas. O erro chega no login como res.error.
        const human = await verifyRecaptcha(credentials.recaptchaToken, "login");
        if (!human.ok) throw new Error("RECAPTCHA");

        const db = getSupabaseAdmin();
        const { data: user } = await db
          .from("site_users")
          .select("id, name, email, password_hash")
          .eq("email", credentials.email.toLowerCase().trim())
          .maybeSingle();

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const db = getSupabaseAdmin();
        const { data: existing } = await db
          .from("site_users")
          .select("id")
          .eq("email", user.email.toLowerCase())
          .maybeSingle();

        if (!existing) {
          await db.from("site_users").insert({
            email: user.email.toLowerCase(),
            name: user.name ?? user.email,
            auth_provider: "google",
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
        token.name = user.name;
      }
      if (token.email) {
        token.isAdmin = isAdminEmail(token.email as string);

        const db = getSupabaseAdmin();
        const { data, error } = await db
          .from("site_users")
          .select("id")
          .eq("email", (token.email as string).toLowerCase())
          .maybeSingle();
        if (!error) {
          token.userId = data?.id;
          // Conta excluída pelo painel: o navegador dela é deslogado (AccountRemovedGuard).
          token.removed = !data && !token.isAdmin;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.id = (token.userId as string) ?? undefined;
        session.user.removed = Boolean(token.removed);
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}
