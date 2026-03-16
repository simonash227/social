'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createBrand, updateBrand } from '@/app/actions/brands'
import type { brands } from '@/db/schema'
import type { InferSelectModel } from 'drizzle-orm'

type Brand = InferSelectModel<typeof brands>

interface BrandFormProps {
  brand?: Brand
  action: 'create' | 'edit'
}

export function BrandForm({ brand, action }: BrandFormProps) {
  const [watermarkOpacity, setWatermarkOpacity] = useState(
    brand?.watermarkOpacity ?? 50
  )
  const [watermarkPosition, setWatermarkPosition] = useState(
    brand?.watermarkPosition ?? ''
  )

  const formAction = action === 'create'
    ? createBrand
    : updateBrand.bind(null, brand!.id)

  return (
    <form action={formAction} className="space-y-6">
      <Tabs defaultValue="basics" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="visual">Visual</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── BASICS ─────────────────────────────────────────────────────────── */}
        <TabsContent value="basics" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Brand Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={brand?.name ?? ''}
              placeholder="e.g. Tech Insider"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="niche">
              Niche <span className="text-destructive">*</span>
            </Label>
            <Input
              id="niche"
              name="niche"
              required
              defaultValue={brand?.niche ?? ''}
              placeholder="e.g. B2B SaaS, Personal Finance, Fitness"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voiceTone">
              Voice / Tone <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="voiceTone"
              name="voiceTone"
              required
              defaultValue={brand?.voiceTone ?? ''}
              placeholder="Professional yet approachable. Use clear language, avoid jargon..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Input
              id="targetAudience"
              name="targetAudience"
              defaultValue={brand?.targetAudience ?? ''}
              placeholder="e.g. Startup founders aged 25-45"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goals">Goals</Label>
            <Textarea
              id="goals"
              name="goals"
              defaultValue={brand?.goals ?? ''}
              placeholder="e.g. Build thought leadership, drive newsletter signups..."
              rows={3}
            />
          </div>
        </TabsContent>

        {/* ── CONTENT ────────────────────────────────────────────────────────── */}
        <TabsContent value="content" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="topics">Topics (one per line)</Label>
            <Textarea
              id="topics"
              name="topics"
              defaultValue={brand?.topics?.join('\n') ?? ''}
              placeholder="AI tools&#10;Productivity&#10;Remote work"
              rows={4}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dosList">Dos (one per line)</Label>
              <Textarea
                id="dosList"
                name="dosList"
                defaultValue={brand?.dosList?.join('\n') ?? ''}
                placeholder="Use data and statistics&#10;Tell stories"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dontsList">Don&apos;ts (one per line)</Label>
              <Textarea
                id="dontsList"
                name="dontsList"
                defaultValue={brand?.dontsList?.join('\n') ?? ''}
                placeholder="No clickbait&#10;Avoid politics"
                rows={4}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="examplePosts">Example Posts (one per line)</Label>
            <Textarea
              id="examplePosts"
              name="examplePosts"
              defaultValue={brand?.examplePosts?.join('\n') ?? ''}
              placeholder="5 tools that saved me 10 hours this week...&#10;The startup mistake nobody talks about..."
              rows={5}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Platform Notes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platformNotes_twitter">Twitter / X</Label>
                <Textarea
                  id="platformNotes_twitter"
                  name="platformNotes_twitter"
                  defaultValue={brand?.platformNotes?.['twitter'] ?? ''}
                  placeholder="Keep threads to 5 tweets, use hooks..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platformNotes_instagram">Instagram</Label>
                <Textarea
                  id="platformNotes_instagram"
                  name="platformNotes_instagram"
                  defaultValue={brand?.platformNotes?.['instagram'] ?? ''}
                  placeholder="Use carousels for tutorials, 8-12 hashtags..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platformNotes_linkedin">LinkedIn</Label>
                <Textarea
                  id="platformNotes_linkedin"
                  name="platformNotes_linkedin"
                  defaultValue={brand?.platformNotes?.['linkedin'] ?? ''}
                  placeholder="Long-form performs well, tag companies..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platformNotes_tiktok">TikTok</Label>
                <Textarea
                  id="platformNotes_tiktok"
                  name="platformNotes_tiktok"
                  defaultValue={brand?.platformNotes?.['tiktok'] ?? ''}
                  placeholder="Hook in first 2 seconds, trending sounds..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── VISUAL STYLE ───────────────────────────────────────────────────── */}
        <TabsContent value="visual" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primaryColor"
                  name="primaryColor"
                  defaultValue={brand?.primaryColor ?? '#3b82f6'}
                  className="h-10 w-16 cursor-pointer rounded border border-input bg-background p-1"
                />
                <span className="text-sm text-muted-foreground">
                  Brand primary color
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="secondaryColor"
                  name="secondaryColor"
                  defaultValue={brand?.secondaryColor ?? '#8b5cf6'}
                  className="h-10 w-16 cursor-pointer rounded border border-input bg-background p-1"
                />
                <span className="text-sm text-muted-foreground">
                  Brand secondary color
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={brand?.logoUrl ?? ''}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <Separator />

          <h3 className="text-sm font-medium">Watermark Settings</h3>

          <div className="space-y-2">
            <Label htmlFor="watermarkPosition">Watermark Position</Label>
            <Select
              name="watermarkPosition"
              value={watermarkPosition}
              onValueChange={(v) => setWatermarkPosition(v ?? '')}
            >
              <SelectTrigger id="watermarkPosition">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="watermarkOpacity">
              Watermark Opacity: {watermarkOpacity}%
            </Label>
            <input
              type="range"
              id="watermarkOpacity"
              name="watermarkOpacity"
              min={0}
              max={100}
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </TabsContent>

        {/* ── ENGAGEMENT ─────────────────────────────────────────────────────── */}
        <TabsContent value="engagement" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="ctaText">CTA Text</Label>
            <Input
              id="ctaText"
              name="ctaText"
              defaultValue={brand?.ctaText ?? ''}
              placeholder="e.g. Follow for daily tech insights"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bioTemplate">Bio Template</Label>
            <Textarea
              id="bioTemplate"
              name="bioTemplate"
              defaultValue={brand?.bioTemplate ?? ''}
              placeholder="📈 {niche} insights daily | {follower_count} founders following | 🔗 Link below"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bioLink">Bio Link</Label>
            <Input
              id="bioLink"
              name="bioLink"
              type="url"
              defaultValue={brand?.bioLink ?? ''}
              placeholder="https://yoursite.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bannedHashtags">Banned Hashtags (one per line)</Label>
            <Textarea
              id="bannedHashtags"
              name="bannedHashtags"
              defaultValue={brand?.bannedHashtags?.join('\n') ?? ''}
              placeholder="#spam&#10;#follow4follow"
              rows={4}
            />
          </div>
        </TabsContent>

        {/* ── ACCOUNT SETTINGS ───────────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="warmupDate">Warmup Date</Label>
            <Input
              id="warmupDate"
              name="warmupDate"
              type="date"
              defaultValue={brand?.warmupDate ?? ''}
            />
            <p className="text-xs text-muted-foreground">
              Date when posting began for new accounts (helps track account age).
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex items-center gap-3">
        <Button type="submit">
          {action === 'create' ? 'Create Brand' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
