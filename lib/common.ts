import { join } from 'path'
import { promises as fs } from 'fs'
import { spawnSync } from 'child_process'
import * as log from 'npmlog'

export type NpmCommandOptions = {
  cwd?: string
  output?: boolean
  production?: boolean
}

export async function npmInstall({ cwd, output = true, production }: NpmCommandOptions = {}) {
  const args = [ 'install' ]

  if (production) {
    args.push('--production')
  }

  const result = spawnSync('npm', args, { cwd, stdio: output ? [ 0, 1, 2 ] : 'ignore' })

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

    log.info('filepack', `running prepack for ${ packageName }`)
  }

  await npmPack({ cwd, output: false })

  packageJson.scripts?.prepack && log.info('filepack', `done prepack for ${ packageName }`)

  filepackRestore && await filepackRestore()

  log.info('filepack', `done on ${ packageName }`)

  return join(cwd, `${ name }-${ packageJson.version }.tgz`)
}
