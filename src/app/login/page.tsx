"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { Loader } from "@/components/ui/Loader";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("E-mail ou senha inválidos.");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(160deg, #eaf2ff 0%, #ffffff 55%)" }}
    >
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-display mb-1 text-center text-2xl text-slate-900">Bem-vindo de volta</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Entre na sua conta para continuar</p>

        <button className="btn-google" onClick={() => signIn("google", { callbackUrl })}>
          <GoogleIcon /> Entrar com Google
        </button>

        <div className="my-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          ou com e-mail
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10"
              type="email"
              placeholder="E-mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10"
              type="password"
              placeholder="Senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <Loader size={18} color="#fff" /> : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-bold text-brand hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
