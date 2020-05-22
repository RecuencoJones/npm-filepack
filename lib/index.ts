import { promises as fs } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import * as log from 'npmlog'

type FilepackOptions = {
  cwd: string,
  production?: boolean
}

type NpmCommandOptions = {
  cwd?: string
  output?: boolean,
  production?: boolean
}

const FILE_PACK_PREFIX = 'file+pack:'

const cache: Record<string, string> = {}

async function installFilePackDependency(packageName: string, { cwd }) {
  const packageJsonFile = join(cwd, 'package.json')
  const packageJsonContents = await fs.readFile(packageJsonFile, 'utf8')
  const packageJson = JSON.parse(packageJsonContents)
  let filepackRestore: () => Promise<void>

  // straight out of https://github.com/npm/cli/blob/abdf52879fcf0e0f534ad977931f6935f5d1dce3/lib/pack.js#L67-L70
  const name = packageJson.name.startsWith('@')
    ? packageJson.name.substr(1).replace(/\//g, '-')
    : packageJson.name

  if (packageJson.scripts?.prepack) {
    filepackRestore = await filepack({ cwd })
    await npmInstall({ cwd, output: false })

    log.info('filepack', `running prepack for ${ packageName }`)
  }

  await npmPack({ cwd, output: false })

  packageJson.scripts?.prepack && log.info('filepack', `done prepack for ${ packageName }`)

  filepackRestore && await filepackRestore()

  log.info('filepack', `done on ${ packageName }`)

  return join(cwd, `${ name }-${ packageJson.version }.tgz`)
}

async function installFilePackDependencies(packageJson: any, kind: 'dependencies' | 'devDependencies', { cwd }) {
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
      tgzPath = await installFilePackDependency(key, { cwd: join(cwd, path) })

      cache[key] = tgzPath
    }

    packageJson[kind][key] = tgzPath
  }
}

async function npmInstall({ cwd, output = true, production }: NpmCommandOptions = {}) {
  const args = [ 'install' ]

  if (production) {
    args.push('--production')
  }

  spawnSync('npm', args, { cwd, stdio: output ? [ 0, 1, 2 ] : 'ignore' })
}

async function npmPack({ cwd, output = true }: NpmCommandOptions = {}) {
  spawnSync('npm', [ 'pack' ], { cwd, stdio: output ? [ 0, 1, 2 ] : 'ignore' })
}

export async function filepack({ cwd, production }: FilepackOptions) {
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

    await installFilePackDependencies(originalPackageJson, 'dependencies', { cwd })

    if (!production) {
      await installFilePackDependencies(originalPackageJson, 'devDependencies', { cwd })
    }

    await fs.writeFile(originalPackageJsonFile, JSON.stringify(originalPackageJson, null, 2), 'utf8')
    await npmInstall({ cwd, production })

    log.info('filepack', `done install on ${ originalPackageJson.name }`)

    return restore
  } catch(e) {
    await restore()

    throw e
  }
}

(async () => {
  const cwd = join(process.cwd(), process.env.FILEPACK_PREFIX || '')
  const production = process.env.NODE_ENV === 'production'

  const filepackRestore = await filepack({ cwd, production })

  await filepackRestore()
})()
