import * as yargs from 'yargs'

export function parseArguments() {
  return yargs
    .usage('$0 [args]')
    .option('production', {
      boolean: true,
      describe: 'Install runtime dependencies only'
    })
    .option('prefix', {
      string: true,
      describe: 'Path to folder where filepack and npm will be executed'
    })
    .option('verbose', {
      boolean: true,
      alias: 'v',
      describe: 'Log additional output useful for debugging'
    })
    .help()
    .version()
    .argv
}
