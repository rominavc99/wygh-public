import { auth } from "@/auth";

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No autorizado") {
    super(message);
  }
}

/** Usar al inicio de cualquier Server Action o route handler que requiera sesión. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

/** Usar al inicio de cualquier Server Action o route handler exclusivo de admin. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}
