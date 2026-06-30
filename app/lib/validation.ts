// Lightweight client-side form validation so we can show modern inline errors
// instead of the browser's native validation bubbles.
export type Rule = {
  label: string;
  required?: boolean;
  email?: boolean;
  pattern?: RegExp;
  message?: string;
};

export type Errors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(
  values: Record<string, string>,
  rules: Record<string, Rule>,
): Errors {
  const errors: Errors = {};
  for (const [key, rule] of Object.entries(rules)) {
    const v = (values[key] ?? '').trim();
    if (rule.required && !v) {
      errors[key] = `${rule.label} is required`;
      continue;
    }
    if (v && rule.email && !EMAIL_RE.test(v)) {
      errors[key] = 'Enter a valid email address';
      continue;
    }
    if (v && rule.pattern && !rule.pattern.test(v)) {
      errors[key] = rule.message ?? `Enter a valid ${rule.label.toLowerCase()}`;
    }
  }
  return errors;
}
