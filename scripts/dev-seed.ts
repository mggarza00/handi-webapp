import { spawn } from 'node:child_process';

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  try {
    console.log('> Applying seed: db/seed/seed.sql');
    await run('supabase', ['db', 'execute', '--file', 'db/seed/seed.sql']);
    console.log('✓ Seed applied');
  } catch (e) {
    console.error('Seed failed. Ensure Supabase CLI is installed and linked.', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();

