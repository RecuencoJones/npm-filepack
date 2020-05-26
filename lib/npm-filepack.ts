import { promises as fs } from 'fs'
import { join } from 'path'
import * as log from 'npmlog'
import { npmInstall, installFilePackDependency } from './common'

export type FilepackOptions = {
  cwd: string
  production?: boolean
  output?: boolean
}

export const FILE_PACK_PREFIX = 'file+pack:'

const cache: Record<string, string> = {}

async function installFilePackDependencies(packageJson: any, kind: 'dependencies' | 'devDependencies', { cwd, output }) {
  const filePackDependencies: Record<string, string> = {}

  Object.entries((packageJson[kind] || {}) as Record<string, string>)
    .filter(([ key, value ]: [ string, string ]) => value.startsWith(FILE_PACK_PREFIX))
    .forEach(([ key, value ]) => { filePackDependencies[key] = value })

  for (const [ key, value ] of Object.entries(filePackDependencies)) {
    const path = value.replace(FILE_PACK_PREFIX, '')
    let tgzPath: string

    // delete existing folder from node_modules as not doing so will not refresh package contents
    await fs.rmdir(join(cwd, 'node_modules', key), { recursive: true })

    if (cache[key]) {
      log.info('filepack', `using cache for ${ key }`)
      tgzPath = cache[key]
    } else {
      tgzPath = await installFilePackDependency(key, { cwd: join(cwd, path), output, filepack })

      cache[key] = tgzPath
    }

    packageJson[kind][key] = tgzPath
  }
}

export async function filepack({ cwd, production, output }: FilepackOptions) {
  const originalPackageJsonFile = join(cwd, 'package.json')
  const backupPackageJsonFile = join(cwd, 'package.filepack_backup.json')
  const originalPackageJsonContent = await fs.readFile(originalPackageJsonFile, 'utf8')

  await fs.writeFile(backupPackageJsonFile, originalPackageJsonContent, 'utf8')

  const restore = async () => {
    await fs.writeFile(originalPackageJsonFile, originalPackageJsonContent, 'utf8')
    await fs.unlink(backupPackageJsonFile)
  }

  try {
    const originalPackageJson = JSON.parse(originalPackageJsonContent)

    log.info('filepack', `running install on ${ originalPackageJson.name }`)

    await installFilePackDependencies(originalPackageJson, 'dependencies', { cwd, output: false })

    if (!production) {
      await installFilePackDependencies(originalPackageJson, 'devDependencies', { cwd, output: false })
    }

    await fs.writeFile(originalPackageJsonFile, JSON.stringify(originalPackageJson, null, 2), 'utf8')
    await npmInstall({ cwd, production, output })

    log.info('filepack', `done install on ${ originalPackageJson.name }`)

    return restore
  } catch(e) {
    await restore()

    throw e
  }
}

export async function run() {
  const cwd = join(process.cwd(), process.env.FILEPACK_PREFIX || '')
  const production = process.env.NODE_ENV === 'production'

  const filepackRestore = await filepack({ cwd, production })

  await filepackRestore()
}
