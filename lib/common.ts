import { join } from 'path'
import { promises as fs } from 'fs'
import { spawnSync } from 'child_process'
import * as log from 'npmlog'
import { parseArguments } from './cli'

export type FilepackOptions = {
  cwd: string
  production?: boolean
  verbose?: boolean
  output?: boolean
  npmInstallArgs?: Array<string>
}

export type NpmCommandOptions = {
  cwd?: string
  output?: boolean
  production?: boolean
  args?: Array<string>
}

export enum FilepackDepedency {
  RUNTIME = 'filepackDependencies',
  DEVELOP = 'filepackDevDependencies'
}

export enum PackageDependency {
  RUNTIME = 'dependencies',
  DEVELOP = 'devDependencies'
}

export const filepackToNative = Object.freeze({
  [FilepackDepedency.RUNTIME]: PackageDependency.RUNTIME,
  [FilepackDepedency.DEVELOP]: PackageDependency.DEVELOP
})

export async function npmInstall({ cwd, output = true, production, args = [] }: NpmCommandOptions = {}) {
  const defaultArgs = [ 'install' ]

  if (production) {
    defaultArgs.push('--production')
  }

  const result = spawnSync('npm', defaultArgs.concat(args), { cwd, stdio: output ? [ 0, 1, 2 ] : 'ignore' })

  if (result.error || result.status > 0) {
    throw result.error || new Error(`npm install ended with status ${ result.status }\nrun \`npm install\` on ${ cwd } for details`)
  }
}

export async function npmPack({ cwd, output = true }: NpmCommandOptions = {}) {
  const result = spawnSync('npm', [ 'pack' ], { cwd, stdio: output ? [ 0, 1, 2 ] : 'ignore' })

  if (result.error || result.status > 0) {
    throw result.error || new Error(`npm pack ended with status ${ result.status }\nrun \`npm pack\` on ${ cwd } for details`)
  }
}

export async function installFilePackDependency(packageName: string, { cwd, filepack, output }) {
  const packageJsonFile = join(cwd, 'package.json')
  const packageJsonContents = await fs.readFile(packageJsonFile, 'utf8')
  const packageJson = JSON.parse(packageJsonContents)
  let filepackRestore: () => Promise<void>

  // straight out of https://github.com/npm/cli/blob/abdf52879fcf0e0f534ad977931f6935f5d1dce3/lib/pack.js#L67-L70
  const name = packageJson.name.startsWith('@')
    ? packageJson.name.substr(1).replace(/\//g, '-')
    : packageJson.name

  if (packageJson.scripts?.prepack) {
    filepackRestore = await filepack({ cwd, output })
    await npmInstall({ cwd, output: false })

    log.verbose('filepack', `running prepack on ${ packageName }`)
  }

  await npmPack({ cwd, output: false })

  filepackRestore && await filepackRestore()

  return join(cwd, `${ name }-${ packageJson.version }.tgz`)
}

export function bootstrap(fn: (options: FilepackOptions) => Promise<void>) {
  const args = parseArguments()

  const cwd = join(process.cwd(), process.env.FILEPACK_PREFIX || args.prefix || '')
  const production = process.env.NODE_ENV === 'production' || args.production
  const verbose = !!process.env.VERBOSE || args.verbose

  Object.defineProperty(log, 'level', {
    value: verbose ? 'verbose' : 'info'
  })

  return async () => {
    try {
      await fn({ cwd, production, verbose, npmInstallArgs: args._ })
    } catch(e) {
      console.error(e.message)
      process.exit(1)
    }
  }
}
