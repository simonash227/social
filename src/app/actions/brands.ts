'use server'

import { getDb } from '@/db'
import { brands, socialAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function parseLines(value: string | null): string[] {
  if (!value) return []
  return value.split('\n').map((s) => s.trim()).filter(Boolean)
}

export async function createBrand(formData: FormData): Promise<void> {
  const name = formData.get('name') as string | null
  const niche = formData.get('niche') as string | null
  const voiceTone = formData.get('voiceTone') as string | null

  if (!name || !niche || !voiceTone) {
    throw new Error('Name, niche, and voice/tone are required')
  }

  const targetAudience = (formData.get('targetAudience') as string | null) || undefined
  const goals = (formData.get('goals') as string | null) || undefined
  const ctaText = (formData.get('ctaText') as string | null) || undefined
  const bioTemplate = (formData.get('bioTemplate') as string | null) || undefined
  const bioLink = (formData.get('bioLink') as string | null) || undefined
  const logoUrl = (formData.get('logoUrl') as string | null) || undefined
  const warmupDate = (formData.get('warmupDate') as string | null) || undefined
  const primaryColor = (formData.get('primaryColor') as string | null) || undefined
  const secondaryColor = (formData.get('secondaryColor') as string | null) || undefined
  const watermarkPosition = (formData.get('watermarkPosition') as string | null) || undefined
  const watermarkOpacityRaw = formData.get('watermarkOpacity') as string | null
  const watermarkOpacity = watermarkOpacityRaw ? parseInt(watermarkOpacityRaw, 10) : undefined

  const topics = parseLines(formData.get('topics') as string | null)
  const dosList = parseLines(formData.get('dosList') as string | null)
  const dontsList = parseLines(formData.get('dontsList') as string | null)
  const examplePosts = parseLines(formData.get('examplePosts') as string | null)
  const bannedHashtags = parseLines(formData.get('bannedHashtags') as string | null)

  const platformNotes: Record<string, string> = {}
  for (const platform of ['twitter', 'instagram', 'linkedin', 'tiktok']) {
    const note = formData.get(`platformNotes_${platform}`) as string | null
    if (note) platformNotes[platform] = note
  }

  const db = getDb()
  await db.insert(brands).values({
    name,
    niche,
    voiceTone,
    targetAudience: targetAudience || null,
    goals: goals || null,
    ctaText: ctaText || null,
    bioTemplate: bioTemplate || null,
    bioLink: bioLink || null,
    logoUrl: logoUrl || null,
    warmupDate: warmupDate || null,
    primaryColor: primaryColor || null,
    secondaryColor: secondaryColor || null,
    watermarkPosition: (watermarkPosition as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | undefined) || null,
    watermarkOpacity: watermarkOpacity ?? null,
    topics: topics.length > 0 ? topics : null,
    dosList: dosList.length > 0 ? dosList : null,
    dontsList: dontsList.length > 0 ? dontsList : null,
    examplePosts: examplePosts.length > 0 ? examplePosts : null,
    bannedHashtags: bannedHashtags.length > 0 ? bannedHashtags : null,
    platformNotes: Object.keys(platformNotes).length > 0 ? platformNotes : null,
  })

  revalidatePath('/brands')
  redirect('/brands')
}

export async function updateBrand(id: number, formData: FormData): Promise<void> {
  const name = formData.get('name') as string | null
  const niche = formData.get('niche') as string | null
  const voiceTone = formData.get('voiceTone') as string | null

  if (!name || !niche || !voiceTone) {
    throw new Error('Name, niche, and voice/tone are required')
  }

  const targetAudience = (formData.get('targetAudience') as string | null) || undefined
  const goals = (formData.get('goals') as string | null) || undefined
  const ctaText = (formData.get('ctaText') as string | null) || undefined
  const bioTemplate = (formData.get('bioTemplate') as string | null) || undefined
  const bioLink = (formData.get('bioLink') as string | null) || undefined
  const logoUrl = (formData.get('logoUrl') as string | null) || undefined
  const warmupDate = (formData.get('warmupDate') as string | null) || undefined
  const primaryColor = (formData.get('primaryColor') as string | null) || undefined
  const secondaryColor = (formData.get('secondaryColor') as string | null) || undefined
  const watermarkPosition = (formData.get('watermarkPosition') as string | null) || undefined
  const watermarkOpacityRaw = formData.get('watermarkOpacity') as string | null
  const watermarkOpacity = watermarkOpacityRaw ? parseInt(watermarkOpacityRaw, 10) : undefined

  const enableVariantsRaw = formData.get('enableVariants') as string | null
  const enableVariants = enableVariantsRaw === '1' ? 1 : 0

  const topics = parseLines(formData.get('topics') as string | null)
  const dosList = parseLines(formData.get('dosList') as string | null)
  const dontsList = parseLines(formData.get('dontsList') as string | null)
  const examplePosts = parseLines(formData.get('examplePosts') as string | null)
  const bannedHashtags = parseLines(formData.get('bannedHashtags') as string | null)

  const platformNotes: Record<string, string> = {}
  for (const platform of ['twitter', 'instagram', 'linkedin', 'tiktok']) {
    const note = formData.get(`platformNotes_${platform}`) as string | null
    if (note) platformNotes[platform] = note
  }

  const db = getDb()
  await db.update(brands)
    .set({
      name,
      niche,
      voiceTone,
      targetAudience: targetAudience || null,
      goals: goals || null,
      ctaText: ctaText || null,
      bioTemplate: bioTemplate || null,
      bioLink: bioLink || null,
      logoUrl: logoUrl || null,
      warmupDate: warmupDate || null,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      watermarkPosition: (watermarkPosition as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | undefined) || null,
      watermarkOpacity: watermarkOpacity ?? null,
      enableVariants,
      topics: topics.length > 0 ? topics : null,
      dosList: dosList.length > 0 ? dosList : null,
      dontsList: dontsList.length > 0 ? dontsList : null,
      examplePosts: examplePosts.length > 0 ? examplePosts : null,
      bannedHashtags: bannedHashtags.length > 0 ? bannedHashtags : null,
      platformNotes: Object.keys(platformNotes).length > 0 ? platformNotes : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(brands.id, id))

  revalidatePath(`/brands/${id}`)
  revalidatePath('/brands')
  redirect(`/brands/${id}`)
}

export async function deleteBrand(id: number, confirmName: string): Promise<{ error?: string }> {
  const db = getDb()
  const brand = await db.select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(eq(brands.id, id))
    .get()

  if (!brand) {
    return { error: 'Brand not found' }
  }

  if (confirmName !== brand.name) {
    return { error: 'Brand name does not match' }
  }

  // Delete cascade: social accounts first, then brand
  await db.delete(socialAccounts).where(eq(socialAccounts.brandId, id))
  await db.delete(brands).where(eq(brands.id, id))

  revalidatePath('/brands')
  redirect('/brands')
}
