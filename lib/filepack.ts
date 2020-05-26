import { join, relative } from 'path'
import { promises as fs } from 'fs'
import * as log from 'npmlog'
import { installFilePackDependency, npmInstall } from './common'

export type FilepackOptions = {
  cwd: string,
  production?: boolean,
  output?: boolean
}

export enum FilepackDepedency {
  RUNTIME = 'filepackDependencies',
  DEVELOP = 'filepackDevDependencies'
}

export enum PackageDependency {
  RUNTIME = 'dependencies',
  DEVELOP = 'devDependencies'
}

const filepackToNative = Object.freeze({
  [FilepackDepedency.RUNTIME]: PackageDependency.RUNTIME,
  [FilepackDepedency.DEVELOP]: PackageDependency.DEVELOP
});

const cache: Record<string, string> = {}

async function installFilePackDependencies(packageJson: any, kind: FilepackDepedency, { cwd, output }) {
  const filepackDependencies: Record<string, string> = packageJson[kind]

  for (const [ key, value ] of Object.entries(filepackDependencies)) {
    let tgzPath: string

    // delete existing folder from node_modules as not doing so will not refresh package contents
    await fs.rmdir(join(cwd, 'node_modules', key), { recursive: true })

    if (cache[key]) {
      log.info('filepack', `using cache for ${ key }`)
      tgzPath = cache[key]
    } else {
      tgzPath = await installFilePackDependency(key, { cwd: join(cwd, value), output, filepack })

      cache[key] = tgzPath
    }

    packageJson[filepackToNative[kind]] = packageJson[filepackToNative[kind]] || {}
    packageJson[filepackToNative[kind]][key] = relative(cwd, tgzPath)
  }
}

async function filepack({ cwd, production, output }: FilepackOptions) {
  const sourcePackageJsonFile = join(cwd, 'package.json')
  const sourcePackageJsonContent = await fs.readFile(sourcePackageJsonFile, 'utf8')
  const sourcePackageJson = JSON.parse(sourcePackageJsonContent)

  log.info('filepack', `running install on ${ sourcePackageJson.name }`)

  if (sourcePackageJson.filepackDependencies) {
    await installFilePackDependencies(sourcePackageJson, FilepackDepedency.RUNTIME, { cwd, output: false })
  }

  if (sourcePackageJson.filepackDevDependencies && !production) {
    await installFilePackDependencies(sourcePackageJson, FilepackDepedency.DEVELOP, { cwd, output: false })
  }

  await fs.writeFile(sourcePackageJsonFile, JSON.stringify(sourcePackageJson, null, 2), 'utf8')
  await npmInstall({ cwd, production, output })

  log.info('filepack', `done install on ${ sourcePackageJson.name }`)
}

export async function run() {
  const cwd = join(process.cwd(), process.env.FILEPACK_PREFIX || '')
  const production = process.env.NODE_ENV === 'production'

  try {
    await filepack({ cwd, production })
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}
