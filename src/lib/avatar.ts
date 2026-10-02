const AVATAR_GRADIENTS = [
  "linear-gradient(160deg,#ff9ecb,#ff5fa8)",
  "linear-gradient(160deg,#7fe0da,#2bb3ac)",
  "linear-gradient(160deg,#ffe08a,#f0b93d)",
  "linear-gradient(160deg,#c9a6e8,#9b6fd1)",
  "linear-gradient(160deg,#a8e0a0,#5fa93a)",
];

/** Degradado determinístico por nombre, para que cada persona tenga siempre el mismo color de avatar. */
export function avatarGradient(name: string): string {
  const sum = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
}
