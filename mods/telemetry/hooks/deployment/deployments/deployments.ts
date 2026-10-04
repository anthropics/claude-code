/**
 * Every deployment a row can name, in the order the CLI's own detection
 * tries them; the first whose signal holds names the row.
 *
 * Cloud development environments, then cloud platforms, CI, and container
 * orchestration last.
 */
export const DEPLOYMENTS = [
  'codespaces',
  'gitpod',
  'coder',
  'devpod',
  'daytona',
  'gcp-cloud-workstations',
  'aws-cloud9',
  'replit',
  'glitch',
  'vercel',
  'railway',
  'render',
  'netlify',
  'heroku',
  'fly.io',
  'cloudflare-pages',
  'deno-deploy',
  'aws-lambda',
  'aws-fargate',
  'aws-ecs',
  'aws-ec2',
  'gcp-cloud-run',
  'gcp',
  'azure-app-service',
  'azure-functions',
  'digitalocean-app-platform',
  'huggingface-spaces',
  'github-actions',
  'gitlab-ci',
  'circleci',
  'buildkite',
  'ci',
  'kubernetes',
  'docker',
] as const
