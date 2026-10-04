/**
 * The files an Ubuntu machine under WSL2 on EC2 holds where the plugin
 * reads the distribution, the kernel and the hypervisor.
 */
export const LINUX_FILES: Readonly<Record<string, string>> = {
  '/etc/os-release': 'NAME="Ubuntu"\nID=ubuntu\nVERSION_ID="24.04"\n',
  '/proc/version': 'Linux version 6.6.87.2-microsoft-standard-WSL2',
  '/sys/hypervisor/uuid': 'ec2e1916-9099-7caf-fd21-012345abcdef',
}
