import { spawnSync } from 'node:child_process';

const checks = [
  ['php', ['-l', 'examples/php/chart.php']],
  ['php', ['-l', 'examples/wordpress/functions.php']],
  ['php', ['-l', 'examples/wordpress/page-chart.php']],
  ['ruby', ['-c', 'examples/rails/charts_controller.rb']],
];
const skipped = new Set();
for (const [command, args] of checks) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    skipped.add(command);
    continue;
  }
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  console.log(`${command} syntax passed: ${args.at(-1)}`);
}
for (const command of skipped)
  console.log(
    `${command} unavailable: syntax check skipped. Backend recipes are not full runtime tests.`,
  );
