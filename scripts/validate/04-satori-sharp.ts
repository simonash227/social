/**
 * INFRA-04: Validate Satori renders JSX→SVG and sharp converts SVG→PNG
 *
 * Run: npx tsx scripts/validate/04-satori-sharp.ts
 * Exit 0 = pass, Exit 1 = fail
 */

import satori from 'satori'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const start = Date.now()

function elapsed() {
  return `${Date.now() - start}ms`
}

function pass(msg: string) {
  console.log(`[PASS] ${msg}`)
}

function fail(msg: string) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

console.log(`\n=== INFRA-04: Satori + sharp PNG Rendering Validation ===`)
console.log(`Started: ${new Date().toISOString()}\n`)

// Load Inter font — prefer WOFF (Satori supports WOFF/OTF/TTF but NOT WOFF2)
// WOFF file is sourced from @fontsource/inter (installed as devDependency)
const fontCandidates = [
  path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.woff'),
  path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf'),
]

const fontPath = fontCandidates.find(p => fs.existsSync(p)) ?? fontCandidates[0]

if (!fs.existsSync(fontPath)) {
  fail(`Font file not found. Expected one of:
  ${fontCandidates.join('\n  ')}

  The WOFF file is copied from @fontsource/inter during project setup.
  Run: cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff public/fonts/Inter-Regular.woff`)
}

let fontData: Buffer
try {
  fontData = fs.readFileSync(fontPath)
  pass(`Font loaded: ${path.basename(fontPath)} (${(fontData.length / 1024).toFixed(1)} KB)`)
} catch (err) {
  fail(`Could not read font file: ${err}`)
  process.exit(1)
}

// Create test-output directory
const outputDir = path.join(process.cwd(), 'test-output')
const outputPath = path.join(outputDir, 'validation-test.png')

try {
  fs.mkdirSync(outputDir, { recursive: true })
  pass(`Output directory ready: ${outputDir}`)
} catch (err) {
  fail(`Could not create output directory: ${err}`)
}

// Render slide with Satori — simulates brand carousel layout
// Using object-style (vnode) to avoid JSX compilation complexity in tsx
const slideVNode = {
  type: 'div',
  props: {
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f0f0f',
      color: '#ffffff',
      fontFamily: 'Inter',
      padding: '80px',
    },
    children: [
      {
        type: 'div',
        props: {
          style: {
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '-1px',
            marginBottom: '24px',
            textAlign: 'center',
          },
          children: 'Validation Test',
        },
      },
      {
        type: 'div',
        props: {
          style: {
            fontSize: 24,
            color: '#888888',
            textAlign: 'center',
          },
          children: 'INFRA-04: Satori + sharp pipeline',
        },
      },
      {
        type: 'div',
        props: {
          style: {
            marginTop: '48px',
            fontSize: 16,
            color: '#555555',
          },
          children: new Date().toISOString(),
        },
      },
    ],
  },
}

async function main() {
  // Render SVG with Satori
  let svgOutput: string
  try {
    svgOutput = await satori(slideVNode as any, {
      width: 1080,
      height: 1080,
      fonts: [
        {
          name: 'Inter',
          data: fontData!,
          weight: 400,
          style: 'normal',
        },
      ],
    })

    if (!svgOutput || !svgOutput.startsWith('<svg')) {
      fail(`Satori output is not valid SVG: ${svgOutput?.substring(0, 100)}`)
    }
    pass(`Satori rendered SVG: ${svgOutput.length} characters`)
  } catch (err) {
    fail(`Satori rendering failed: ${err}`)
    process.exit(1)
  }

  // Convert SVG to PNG with sharp
  let pngBuffer: Buffer
  try {
    pngBuffer = await sharp(Buffer.from(svgOutput!))
      .png()
      .toBuffer()

    if (!pngBuffer || pngBuffer.length < 1000) {
      fail(`PNG output too small: ${pngBuffer?.length ?? 0} bytes (expected > 1000 bytes)`)
    }
    pass(`sharp converted SVG to PNG: ${pngBuffer.length.toLocaleString()} bytes`)
  } catch (err) {
    fail(`sharp conversion failed: ${err}`)
    process.exit(1)
  }

  // Write PNG to disk
  try {
    fs.writeFileSync(outputPath, pngBuffer!)
    const stat = fs.statSync(outputPath)
    if (stat.size < 1000) {
      fail(`Written PNG file is too small: ${stat.size} bytes`)
    }
    pass(`PNG written to disk: ${outputPath} (${stat.size.toLocaleString()} bytes)`)
  } catch (err) {
    fail(`Could not write PNG file: ${err}`)
  }

  // Verify PNG header (first 8 bytes should be the PNG magic number)
  try {
    const header = Buffer.alloc(8)
    const fd = fs.openSync(outputPath, 'r')
    fs.readSync(fd, header, 0, 8, 0)
    fs.closeSync(fd)

    const pngMagic = [137, 80, 78, 71, 13, 10, 26, 10]
    const isPng = pngMagic.every((b, i) => header[i] === b)
    if (!isPng) {
      fail(`File does not have PNG magic bytes: ${Array.from(header).join(',')}`)
    }
    pass(`PNG magic bytes verified (valid PNG file format)`)
  } catch (err) {
    fail(`PNG header verification failed: ${err}`)
  }

  // Clean up
  try {
    fs.rmSync(outputDir, { recursive: true, force: true })
    pass(`Cleanup complete (removed ${outputDir})`)
  } catch (err) {
    fail(`Cleanup failed: ${err}`)
  }

  console.log(`\n[PASS] INFRA-04: Satori + sharp validation complete (${elapsed()})`)
  console.log(`Completed: ${new Date().toISOString()}\n`)
}

main().catch(err => {
  console.error('[FAIL] Unexpected error:', err)
  process.exit(1)
})
