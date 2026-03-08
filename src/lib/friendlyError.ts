export const friendlyError = (err: any): string => {
  const msg = err?.message || '';
  if (msg.includes('cpf_key') || msg.includes('cpf')) return 'CPF já cadastrado.';
  if (msg.includes('email_key') || msg.includes('already registered')) return 'Email já cadastrado.';
  if (msg.includes('cnpj')) return 'CNPJ inválido ou já cadastrado.';
  if (msg.includes('Invalid login')) return 'Email ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Email ainda não confirmado.';
  if (msg.includes('expired') || msg.includes('invalid')) return 'Link expirado ou inválido.';
  console.error('Unhandled error:', msg);
  return 'Ocorreu um erro. Tente novamente.';
};
