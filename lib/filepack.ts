import { join, relative } from 'path'
import { promises as fs } from 'fs'
import * as log from 'npmlog'
import { installFilePackDependency, npmInstall, bootstrap, FilepackOptions, FilepackDepedency, filepackToNative } from './common'

const cache: Record<string, string> = {}

async function installFilePackDependencies(packageJson: any, kind: FilepackDepedency, { cwd, output }) {
  const filepackDependencies: Record<string, string> = packageJson[kind]

  for (const [ key, value ] of Object.entries(filepackDependencies)) {
    let tgzPath: string

    // delete existing folder from node_modules as not doing so will not refresh package contents
    await fs.rmdir(join(cwd, 'node_modules', key), { recursive: true })

    if (cache[key]) {
      log.verbose('filepack', `reusing cache for ${ key }`)
      tgzPath = cache[key]
    } else {
      tgzPath = await installFilePackDependency(key, { cwd: join(cwd, value), output, filepack })

      cache[key] = tgzPath
    }

    packageJson[filepackToNative[kind]] = packageJson[filepackToNative[kind]] || {}
    packageJson[filepackToNative[kind]][key] = relative(cwd, tgzPath)
  }
}

async function filepack({ cwd, production, output, npmInstallArgs }: FilepackOptions) {
  const sourcePackageJsonFile = join(cwd, 'package.json')
  const sourcePackageJsonContent = await fs.readFile(sourcePackageJsonFile, 'utf8')
  const sourcePackageJson = JSON.parse(sourcePackageJsonContent)

  log.info('filepack', `running on ${ sourcePackageJson.name }`)
  log.verbose('filepack', `running install on ${ sourcePackageJson.name }`)

  if (sourcePackageJson.filepackDependencies) {
    await installFilePackDependencies(sourcePackageJson, FilepackDepedency.RUNTIME, { cwd, output: false })
  }

  if (sourcePackageJson.filepackDevDependencies && !production) {
    await installFilePackDependencies(sourcePackageJson, FilepackDepedency.DEVELOP, { cwd, output: false })
  }

  await fs.writeFile(sourcePackageJsonFile, JSON.stringify(sourcePackageJson, null, 2), 'utf8')
  await npmInstall({ cwd, production, output, args: npmInstallArgs })
}

export const run = bootstrap(filepack)
