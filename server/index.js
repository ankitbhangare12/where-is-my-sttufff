import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || process.env.API_PORT || 3001)
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const openAiApiKey = process.env.OPENAI_API_KEY
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({ limit: '9mb', strict: true }))

const identifyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many photo checks. Please wait a minute and try again.' },
})

app.post('/api/identify', identifyLimiter, async (req, res) => {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return res.status(401).json({ error: 'Sign in to identify and save an item.' })
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured on the server yet.' })
  if (!openAiApiKey) return res.status(503).json({ error: 'Photo identification is not set up yet. Enter the item details yourself.' })

  const { data: userResult, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userResult.user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })

  const image = req.body?.image
  const imageMatch = typeof image === 'string' && image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/)
  if (!imageMatch || image.length > 8_500_000) {
    return res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP photo under 6 MB.' })
  }

  try {
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 500,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'household_item',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                itemName: { type: ['string', 'null'] },
                category: { type: ['string', 'null'] },
                description: { type: 'string' },
                visibleCharacteristics: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                confidence: { type: 'number' },
                needsConfirmation: { type: 'boolean' },
              },
              required: ['itemName', 'category', 'description', 'visibleCharacteristics', 'tags', 'confidence', 'needsConfirmation'],
            },
          },
        },
        messages: [
          {
            role: 'system',
            content: 'Identify visible belongings only. Never infer or return where an object is stored. If the photo is unclear, contains several equally prominent objects, or the object cannot be identified, use null for itemName and category, set confidence below 0.5 and needsConfirmation to true. Otherwise, choose exactly one category from: Documents & IDs, Electronics, Clothing & accessories, Kitchen & dining, Home & furniture, Tools & hardware, Personal care, Health & medicine, Toys & games, Books & stationery, Sports & outdoors, Jewelry & valuables, Keys & access, Other. Do not return punctuation-only names or categories. Be concise and describe only visible details.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Identify the main household item in this photo. Return details for the item only.' },
              { type: 'image_url', image_url: { url: image, detail: 'low' } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    const payload = await aiResponse.json()
    if (!aiResponse.ok) {
      console.error('Vision provider request failed:', aiResponse.status, payload.error?.type || payload.error?.code || 'unknown error')
      return res.status(502).json({ error: 'Photo identification is unavailable right now. You can enter the details yourself.' })
    }

    const content = payload.choices?.[0]?.message?.content
    const identification = JSON.parse(content)
    const hasText = (value) => typeof value === 'string'
    if (
      typeof identification.confidence !== 'number'
      || identification.confidence < 0
      || identification.confidence > 1
      || ![null, 'string'].includes(identification.itemName === null ? null : typeof identification.itemName)
      || ![null, 'string'].includes(identification.category === null ? null : typeof identification.category)
      || !hasText(identification.description)
      || !hasText(identification.visibleCharacteristics)
      || !Array.isArray(identification.tags)
      || !identification.tags.every(hasText)
      || typeof identification.needsConfirmation !== 'boolean'
    ) {
      return res.status(502).json({ error: 'The photo result could not be checked. Please enter the details yourself.' })
    }
    if (identification.itemName) identification.itemName = identification.itemName.slice(0, 120)
    if (identification.category) identification.category = identification.category.slice(0, 80)
    identification.description = identification.description.slice(0, 500)
    identification.visibleCharacteristics = identification.visibleCharacteristics.slice(0, 300)
    identification.tags = identification.tags.slice(0, 10).map((tag) => tag.slice(0, 40))
    identification.needsConfirmation ||= identification.confidence < 0.65
    return res.json(identification)
  } catch (error) {
    console.error('Photo identification failed:', error.message)
    return res.status(502).json({ error: 'Photo identification is unavailable right now. You can enter the details yourself.' })
  }
})

app.use((error, req, res, next) => {
  if (!req.path.startsWith('/api/')) return next(error)
  console.error('API request could not be processed:', error.message)
  const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500
  const message = status === 413
    ? 'That photo is too large. Choose a smaller image.'
    : status === 400
      ? 'The request could not be read. Please try again.'
      : 'The request could not be completed. Please try again.'
  return res.status(status).json({ error: message })
})

const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)
const distPath = path.resolve(currentDirectory, '../dist')
app.use(express.static(distPath))
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  return res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, () => {
  console.log(`Where Is My Stuff API listening on http://localhost:${port}`)
})
