// Feature: respond-leadz, Structural consolidation test (task 20.3)
/**
 * Structural (filesystem) consolidation test.
 *
 * This suite does NOT exercise runtime behavior. It asserts the repository
 * layout that must hold after the consolidation work (tasks 20.1 / 20.2):
 * a single canonical production webhook route, deletion of the competing
 * variant implementations, and relocation of all non-production reference
 * material under `reference/`.
 *
 * Paths are resolved relative to the app root (`respond-leads/`); this test
 * file lives directly under `respond-leads/tests/`.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.5, 13.1, 13.2, 12.3, 10.3, 14.5
 */

import * as fs from 'fs'
import * as path from 'path'

/** Repository app root — `tests/` is directly under `respond-leads/`. */
const APP_ROOT = path.resolve(__dirname, '..')

/** Resolve a path relative to the app root. */
const at = (...segments: string[]): string => path.resolve(APP_ROOT, ...segments)

const WEBHOOK_DIR = at('app', 'api', 'webhook', 'whatsapp')
const REFERENCE_DIR = at('reference')

describe('respond-leadz structural consolidation', () => {
  describe('1. exactly one production webhook route (Req 11.1, 11.2)', () => {
    it('app/api/webhook/whatsapp/ contains exactly one route file: route.ts', () => {
      expect(fs.existsSync(WEBHOOK_DIR)).toBe(true)

      const entries = fs
        .readdirSync(WEBHOOK_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)

      expect(entries).toEqual(['route.ts'])
    })
  })

  describe('2. competing variant files are deleted (Req 11.3, 13.1, 13.2)', () => {
    const deletedRouteVariants = [
      'app/api/webhook/whatsapp/v9-route.ts',
      'app/api/webhook/whatsapp/v10-route.ts',
      'app/api/webhook/whatsapp/blueprint-route.ts',
    ]
    const deletedLibVariants = [
      'lib/whatsapp-v9.ts',
      'lib/claude-v9.ts',
      'lib/whatsapp-blueprint.ts',
    ]

    it.each([...deletedRouteVariants, ...deletedLibVariants])(
      'does not exist: %s',
      (relativePath) => {
        expect(fs.existsSync(at(...relativePath.split('/')))).toBe(false)
      }
    )
  })

  describe('3. reference material lives under reference/ (Req 12.3, 10.3, 14.5)', () => {
    it('reference/ exists and is a directory', () => {
      expect(fs.existsSync(REFERENCE_DIR)).toBe(true)
      expect(fs.statSync(REFERENCE_DIR).isDirectory()).toBe(true)
    })

    it.each(['v9-clean-blueprint.json', 'whatsapp-ai-inventory-v10.json'])(
      'reference/%s exists',
      (fileName) => {
        expect(fs.existsSync(path.join(REFERENCE_DIR, fileName))).toBe(true)
      }
    )

    it('at least one *.blueprint.json file exists under reference/', () => {
      const blueprintFiles = fs
        .readdirSync(REFERENCE_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => /\.blueprint\.json$/.test(name))

      expect(blueprintFiles.length).toBeGreaterThanOrEqual(1)
    })

    it('reference/python/ exists, is a directory, and contains agent.py', () => {
      const pythonDir = path.join(REFERENCE_DIR, 'python')
      expect(fs.existsSync(pythonDir)).toBe(true)
      expect(fs.statSync(pythonDir).isDirectory()).toBe(true)
      expect(fs.existsSync(path.join(pythonDir, 'agent.py'))).toBe(true)
    })

    it('reference material no longer exists at the app root (Req 13.1, 13.2)', () => {
      // Blueprint/inventory JSON moved out of the root.
      expect(fs.existsSync(at('v9-clean-blueprint.json'))).toBe(false)
      expect(fs.existsSync(at('whatsapp-ai-inventory-v10.json'))).toBe(false)

      // No stray *.blueprint.json files left at the root.
      const rootBlueprintFiles = fs
        .readdirSync(APP_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => /\.blueprint\.json$/.test(name))
      expect(rootBlueprintFiles).toEqual([])

      // The python/ reference tree no longer lives at the root.
      expect(fs.existsSync(at('python'))).toBe(false)
    })
  })

  describe('4. canonical pipeline entry (Req 11.1, 11.5)', () => {
    it('lib/pipeline/inbound-handler.ts exists', () => {
      expect(fs.existsSync(at('lib', 'pipeline', 'inbound-handler.ts'))).toBe(true)
    })

    it('the webhook route delegates to @/lib/pipeline/inbound-handler', () => {
      const routePath = path.join(WEBHOOK_DIR, 'route.ts')
      expect(fs.existsSync(routePath)).toBe(true)

      const source = fs.readFileSync(routePath, 'utf8')
      expect(source).toMatch(/@\/lib\/pipeline\/inbound-handler/)
    })
  })

  describe('5. canonical health and lifecycle-cron routes (Req 11.1)', () => {
    it.each([
      'app/api/health/route.ts',
      'app/api/cron/lifecycle/route.ts',
    ])('exists: %s', (relativePath) => {
      expect(fs.existsSync(at(...relativePath.split('/')))).toBe(true)
    })
  })
})
