"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

const INPUT =
  "min-h-13 rounded-btn border border-line bg-surface px-4 py-3.5 text-[17px] text-ink placeholder:text-faint focus:border-gold focus:outline-none";
const LABEL = "text-[13px] font-semibold tracking-[.1em] text-muted uppercase";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [forgot, setForgot] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4.5">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <label className="flex flex-col gap-2">
        <span className={LABEL}>Email</span>
        <input name="email" type="email" required autoComplete="username" placeholder="nome@cusbros.it" className={INPUT} />
      </label>
      <label className="flex flex-col gap-2">
        <span className={LABEL}>Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className={INPUT}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-[15px] text-red">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex min-h-13.5 cursor-pointer items-center justify-center rounded-btn bg-gold font-display text-lg font-bold tracking-[.12em] text-bg uppercase hover:bg-gold-hover active:bg-gold-active disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Accesso…" : "Entra"}
      </button>

      <button
        type="button"
        onClick={() => setForgot(true)}
        aria-expanded={forgot}
        className="-my-2.5 inline-flex min-h-11 cursor-pointer items-center self-start text-sm text-gold hover:text-gold-hover"
      >
        Password dimenticata?
      </button>
      {forgot && <p className="text-sm text-ink-2">Contatta l&apos;admin per reimpostare la password.</p>}
    </form>
  );
}
