const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GST_NUMBER_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export const normalizeEmail = (value: unknown): string | null => {
  const email = normalizeOptionalText(value)
  return email ? email.toLowerCase() : null
}

export const normalizeGstNumber = (value: unknown): string | null => {
  const gst = normalizeOptionalText(value)
  if (!gst) return null
  return gst.replace(/[\s-]/g, '').toUpperCase()
}

export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value)

const isValidPhonePart = (value: string): boolean => {
  if (!/^\+?[0-9().\-\s]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '').length
  return digits >= 7 && digits <= 15
}

export const isValidPhone = (value: string): boolean => {
  if (!/^[0-9+\-().\s,/]+$/.test(value)) return false
  const parts = value
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return false
  return parts.every(isValidPhonePart)
}

export const isValidGstNumber = (value: string): boolean =>
  GST_NUMBER_PATTERN.test(value)

export const validateOptionalEmail = (value: string | null): string | null => {
  if (!value) return null
  return isValidEmail(value) ? null : 'Enter a valid email address.'
}

export const validateOptionalPhone = (value: string | null): string | null => {
  if (!value) return null
  return isValidPhone(value)
    ? null
    : 'Enter a valid phone number (7-15 digits per number).'
}

export const validateOptionalGstNumber = (
  value: string | null
): string | null => {
  if (!value) return null
  return isValidGstNumber(value)
    ? null
    : 'Enter a valid GST number (15 characters).'
}
