export const PASSWORD_RULES_TEXT =
  "Mínimo de 6 caracteres, uma letra maiúscula e um caractere especial";

export const PASSWORD_INVALID_MSG =
  "Sua senha ainda não atende aos requisitos. Use no mínimo 6 caracteres, uma letra maiúscula e um caractere especial.";

export const PASSWORD_WEAK_MSG =
  "Essa senha não foi aceita. Use no mínimo 6 caracteres, uma letra maiúscula e um caractere especial.";

export function passwordChecks(pw: string) {
  return {
    length: (pw || "").length >= 6,
    uppercase: /[A-Z]/.test(pw || ""),
    special: /[^A-Za-z0-9]/.test(pw || ""),
  };
}

export function validatePassword(pw: string): boolean {
  const c = passwordChecks(pw);
  return c.length && c.uppercase && c.special;
}

export function isWeakPasswordError(msg: string | undefined | null): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("weak") ||
    m.includes("password should") ||
    m.includes("password is too") ||
    m.includes("senha")
  );
}
