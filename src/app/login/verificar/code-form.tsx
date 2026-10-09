"use client";

import { useActionState, useEffect } from "react";
import { verifyCode } from "../actions";

export function CodeForm({ email, callbackUrl }: { email: string; callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(verifyCode, undefined);

  // Carga completa (no navegación del router): el callback de Auth.js
  // responde con la cookie de sesión y un redirect.
  useEffect(() => {
    if (state?.redirectTo) window.location.assign(state.redirectTo);
  }, [state]);

  const redirecting = Boolean(state?.redirectTo);

  return (
    <form action={formAction} className="flex flex-col gap-4 text-left">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-bold text-ink">
          Código de 6 dígitos
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\s*(\d\s*){6}"
          maxLength={12}
          required
          placeholder="123456"
          className="xp-input text-center text-2xl tracking-[0.4em]"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending || redirecting} className="xp-btn">
        {pending || redirecting ? "Entrando…" : "Entrar →"}
      </button>
    </form>
  );
}
