import { supabase } from './supabase'

export interface TotpEnrollment {
  factorId: string
  qrCode: string
  secret: string
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function hasAal2() {
  if (!supabase) return false
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return data.currentLevel === 'aal2'
}

/** Returns the verified TOTP factor id, or null if the user has not set one up yet. */
export async function getVerifiedTotpFactor() {
  const { data, error } = await client().auth.mfa.listFactors()
  if (error) throw error
  return data.totp.find((factor) => factor.status === 'verified')?.id ?? null
}

export async function enrollTotp(): Promise<TotpEnrollment> {
  const auth = client().auth
  const { data: factors, error: listError } = await auth.mfa.listFactors()
  if (listError) throw listError
  // An abandoned, unverified enrollment blocks a new one with the same name.
  for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status === 'unverified')) {
    await auth.mfa.unenroll({ factorId: factor.id })
  }
  const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: `Bindu admin ${new Date().toISOString().slice(0, 10)}` })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotp(factorId: string, code: string) {
  const { error } = await client().auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}
