/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure <package>"
| command. You are free to perform any operations inside this function to
| configure the package.
|
| To make things easier, you have access to the underlying "ConfigureCommand"
| instance and you can use codemods to modify the source files.
|
*/

import ConfigureCommand from '@adonisjs/core/commands/configure'
import JumpstartScaffold from './src/scaffolds/jumpstart_scaffold.js'

export async function configure(command: ConfigureCommand) {
  await new JumpstartScaffold(command).run()
}
