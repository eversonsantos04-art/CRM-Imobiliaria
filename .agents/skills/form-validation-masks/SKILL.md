---
name: form-validation-masks
description: Create, review, or improve web forms in this real-estate CRM, including Brazilian field masks, validation, normalization, and accessible error feedback.
---

# Form validation and masks

Use this skill when a task changes how a person enters or submits data in the CRM or public site. Focus on correct values and clear recovery from errors, while preserving the existing layout and behavior outside the requested form.

## Project conventions

- The app uses Next.js App Router, React, TypeScript, and Supabase. Existing forms mostly use controlled React state and native HTML controls; there is no established React Hook Form, Zod, or Yup convention.
- Inspect the relevant form, its edit counterpart, shared helpers, and the corresponding SQL columns and constraints before changing behavior. Keep create and edit forms consistent.
- Prefer native input constraints and a small reusable helper for simple masks. Add a form or validation dependency only when the task's complexity makes it worthwhile.
- Keep visual adjustments within the user's requested scope. Do not redesign unrelated CRM or Vitrine screens.

## Validation and normalization

- Treat a mask as presentation, not validation. Validate the actual value after normalization; a visually complete CPF, CNPJ, CEP, phone number, date, or currency can still be invalid.
- Decide the canonical value before wiring persistence. Remove display punctuation where the stored field expects a normalized identifier; preserve meaningful country codes and leading zeros. Do not save currency symbols, grouping separators, or accidental whitespace into numeric columns.
- Match rules to the SQL schema and product requirements. Keep required/optional fields, allowed ranges, precision, enum values, and cross-field constraints aligned with database validation. Do not invent stricter business rules.
- For Brazilian identifiers, validate check digits when that field is intended to contain CPF/CNPJ; reject repeated-digit placeholders. For CEP and phone, validate digit counts and any country-code convention the product uses. Do not treat a mask alone as proof of validity.
- For money, parse Brazilian decimal/grouping separators deliberately, keep calculations numeric, and format only for display. Avoid floating-point string comparisons and ambiguous parsing of `1.234,56` versus `1,234.56`.
- For dates and date-times, distinguish a calendar date from an instant. Preserve local time-zone intent when saving `timestamptz` values such as follow-up deadlines.
- Trim text at submission where appropriate. Convert empty optional values to `null` only where the database/API expects `null`; preserve meaningful text and identifiers.

## Mask interaction

- Support typing, deleting, cursor movement, selection replacement, paste, and mobile keyboards. A controlled mask must not unexpectedly jump the caret or make backspace difficult.
- Do not apply formatting to every keystroke if it damages cursor position; format on blur or use a tested caret-preserving approach where needed.
- Choose appropriate `type`, `inputMode`, `autoComplete`, `maxLength`, and native constraints. Do not disable browser zoom on mobile; keep text inputs at a readable size.
- Do not silently discard extra digits or change the user's value without feedback. If normalization changes display, keep the stored value unambiguous.

## Errors and accessibility

- Put each field's error next to that field, associate it with `aria-describedby`, set `aria-invalid` when invalid, and provide a clear correction. Use a form-level message for server failures.
- Preserve labels and keyboard operation. Do not rely on color, placeholder text, or a toast alone to explain a field error.
- Keep pending, success, and failure states distinct; prevent accidental duplicate submission while a request is in progress.
- Avoid logging or putting personal values such as CPF, phone, email, or address in audit details, console output, or test fixtures beyond what is needed.

## Persistence and security

- Client-side validation improves feedback but is not a security boundary. Keep database constraints, RLS, and server-side validation for privileged operations consistent with the form.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in a client component. Do not change RLS policies or execute a data migration as an incidental part of a form-mask task.
- Preserve existing create/update permissions and record ownership checks. Report any mismatch between UI validation, server validation, and database constraints rather than hiding it with a client-only rule.

## CEP lookup and address autofill

- When a form asks for a Brazilian CEP and address, consult ViaCEP only after the input contains exactly eight digits. Use `https://viacep.com.br/ws/{CEP}/json/` and validate the response shape before using it.
- Do not send incomplete CEPs. Cancel or ignore stale in-flight requests when the CEP changes, prevent duplicate requests for the same current value, and provide distinct loading, not-found, and service-unavailable feedback.
- Autofill only the address fields returned by the service (logradouro, bairro, localidade, and UF). Keep street number and complement for manual entry.
- Preserve manually entered address values: only fill empty fields or fields still matching values previously autofilled by the form. Keep all fields editable so the user can correct outdated or incomplete directory data.
- A lookup failure must not block manual address entry or saving when the form's own CEP rules are satisfied. Do not log the CEP or full address.

## Review checklist

For the fields in scope, consider: empty optional value; required empty value; valid value; invalid check digit/length/range; value pasted with and without punctuation; editing an existing normalized value; cursor movement and deletion; server/database rejection; small viewport and keyboard use. Exercise only cases relevant to the form and avoid real customer data.
