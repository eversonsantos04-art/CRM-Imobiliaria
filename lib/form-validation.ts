export type FormFieldErrors = Record<string, string>;
export type FieldFormat = "cpf-cnpj" | "phone" | "cep" | "decimal";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeBrazilianDocument(value: string): string {
  return value.replace(/[^a-z\d]/gi, "").toUpperCase();
}

function hasAllowedCharacters(value: string, format: FieldFormat): boolean {
  if (format === "cpf-cnpj") return /^[a-z\d.\s/-]*$/i.test(value);
  if (format === "phone") return /^[\d+().\s-]*$/.test(value);
  if (format === "cep") return /^[\d\s-]*$/.test(value);
  return true;
}

export function isValidBrazilianDocument(value: string): boolean {
  const document = normalizeBrazilianDocument(value);
  if (/^(.)\1+$/.test(document)) return false;

  if (/^\d{11}$/.test(document)) {
    const calculate = (base: string, startWeight: number) => {
      const sum = [...base].reduce((total, digit, index) => total + Number(digit) * (startWeight - index), 0);
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    const first = calculate(document.slice(0, 9), 10);
    const second = calculate(document.slice(0, 10), 11);
    return first === Number(document[9]) && second === Number(document[10]);
  }

  if (/^[A-Z\d]{12}\d{2}$/.test(document)) {
    const calculate = (base: string, weights: number[]) => {
      const sum = [...base].reduce((total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index], 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    const first = calculate(document.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculate(document.slice(0, 12) + String(first), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return first === Number(document[12]) && second === Number(document[13]);
  }

  return false;
}

export function validateBrazilianDocument(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (!hasAllowedCharacters(value, "cpf-cnpj")) return "Use somente letras, números, pontos, barra ou hífen.";
  if (!isValidBrazilianDocument(value)) return "Informe um CPF ou CNPJ válido.";
  return undefined;
}

export function normalizeBrazilianPhone(value: string): string {
  return digitsOnly(value);
}

export function validateBrazilianPhone(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (!hasAllowedCharacters(value, "phone")) return "Use somente números, DDD e os símbolos +, parênteses ou hífen.";
  if (value.includes("+") && !/^\s*\+?55/.test(value)) return "O código internacional aceito para este cadastro é +55.";
  const digits = digitsOnly(value);
  const national = (digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length !== 10 && national.length !== 11) return "Informe o DDD e um telefone com 8 ou 9 dígitos.";
  return undefined;
}

export function validateBrazilianPostalCode(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (!hasAllowedCharacters(value, "cep")) return "Use somente números e hífen no CEP.";
  if (digitsOnly(value).length !== 8) return "O CEP deve conter 8 números.";
  return undefined;
}

function groupDigits(value: string, groups: number[]): string {
  const parts: string[] = [];
  let offset = 0;
  for (const size of groups) {
    if (offset >= value.length) break;
    parts.push(value.slice(offset, offset + size));
    offset += size;
  }
  if (offset < value.length) parts.push(value.slice(offset));
  return parts.join(".");
}

export function formatBrazilianDocument(value: string): string {
  if (!hasAllowedCharacters(value, "cpf-cnpj")) return value;
  const document = normalizeBrazilianDocument(value);
  if (/^\d*$/.test(document) && document.length <= 11) {
    const first = document.slice(0, 3);
    const second = document.slice(3, 6);
    const third = document.slice(6, 9);
    const check = document.slice(9, 11);
    return [first, second, third].filter(Boolean).join(".") + (check ? `-${check}` : "");
  }
  if (document.length > 14) return value;
  return groupDigits(document.slice(0, 8), [2, 3, 3]) + (document.length > 8 ? `/${document.slice(8, 12)}` : "") + (document.length > 12 ? `-${document.slice(12, 14)}` : "");
}

function formatNationalPhone(digits: string): string {
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (!ddd) return "";
  if (number.length <= 4) return `(${ddd})${number ? ` ${number}` : ""}`;
  const splitAt = number.length > 8 ? 5 : 4;
  return `(${ddd}) ${number.slice(0, splitAt)}-${number.slice(splitAt)}`;
}

export function formatBrazilianPhone(value: string): string {
  if (!hasAllowedCharacters(value, "phone")) return value;
  const digits = digitsOnly(value);
  if (digits.length > 11 && digits.startsWith("55")) return `+55 ${formatNationalPhone(digits.slice(2))}`;
  if (digits.length > 11) return value;
  return formatNationalPhone(digits);
}

export function formatBrazilianPostalCode(value: string): string {
  if (!hasAllowedCharacters(value, "cep")) return value;
  const digits = digitsOnly(value);
  if (digits.length > 8) return value;
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function parseBrazilianDecimal(value: string): number | null {
  const raw = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!raw) return null;
  if (!/^-?\d[\d.,]*$/.test(raw)) return Number.NaN;

  let normalized = raw;
  if (raw.includes(",")) {
    if ((raw.match(/,/g) ?? []).length !== 1) return Number.NaN;
    const [integerPart, decimalPart] = raw.split(",");
    if (!/^\d{1,2}$/.test(decimalPart)) return Number.NaN;
    if (integerPart.includes(".") && !/^\d{1,3}(?:\.\d{3})+$/.test(integerPart)) return Number.NaN;
    normalized = `${integerPart.replace(/\./g, "")}.${decimalPart}`;
  } else if (raw.includes(".")) {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, "");
    else if (/^-?\d+\.\d{1,2}$/.test(raw)) normalized = raw;
    else return Number.NaN;
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

export function formatBrazilianDecimal(value: string | number): string {
  const parsed = typeof value === "number" ? value : parseBrazilianDecimal(value);
  if (parsed === null || !Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed);
}

export function formatFieldValue(value: string, format: FieldFormat): string {
  if (format === "cpf-cnpj") return formatBrazilianDocument(value);
  if (format === "phone") return formatBrazilianPhone(value);
  if (format === "cep") return formatBrazilianPostalCode(value);
  return formatBrazilianDecimal(value);
}

export function validatePropertyFormData(form: FormData, originalPostalCode?: string | null): FormFieldErrors {
  const errors: FormFieldErrors = {};
  const title = String(form.get("title") ?? "").trim();
  const postalCode = String(form.get("postal_code") ?? "");
  if (!title) errors.title = "Informe o título do imóvel.";
  if (originalPostalCode == null || digitsOnly(postalCode) !== digitsOnly(originalPostalCode)) {
    const postalError = validateBrazilianPostalCode(postalCode);
    if (postalError) errors.postal_code = postalError;
  }

  const decimalFields: [string, string][] = [
    ["sale_price", "Valor de venda"], ["rent_price", "Valor do aluguel"],
    ["condo_fee", "Condomínio"], ["property_tax", "IPTU"],
    ["total_area", "Área total"], ["built_area", "Área construída"],
  ];
  for (const [name, label] of decimalFields) {
    const raw = String(form.get(name) ?? "");
    const parsed = parseBrazilianDecimal(raw);
    if (Number.isNaN(parsed)) errors[name] = `${label}: informe um número válido com até duas casas decimais.`;
    else if (typeof parsed === "number" && parsed < 0) errors[name] = `${label}: informe um valor igual ou maior que zero.`;
  }

  for (const [name, label] of [["bedrooms", "Quartos"], ["suites", "Suítes"], ["bathrooms", "Banheiros"], ["parking_spaces", "Vagas"]]) {
    const raw = String(form.get(name) ?? "").trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) errors[name] = `${label}: informe um número inteiro igual ou maior que zero.`;
  }

  const state = String(form.get("state") ?? "").trim();
  if (state && !/^[a-z]{2}$/i.test(state)) errors.state = "Informe a sigla do estado com duas letras.";
  return errors;
}
