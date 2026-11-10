import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const environment = { ...process.env };
const avgCertificate = 'C:/ProgramData/AVG/Antivirus/wscert.pem';
if (process.platform === 'win32' && !environment.NODE_EXTRA_CA_CERTS && existsSync(avgCertificate)) {
  environment.NODE_EXTRA_CA_CERTS = avgCertificate;
}
const child = spawn(process.execPath, ['--env-file-if-exists=.env', ...process.argv.slice(2)], {
  env: environment,
  stdio: 'inherit'
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
