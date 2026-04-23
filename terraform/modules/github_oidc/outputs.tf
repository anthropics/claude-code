output "role_arn" {
  description = "GitHub Actions workflow の aws-actions/configure-aws-credentials@v4 に渡す role-to-assume"
  value       = aws_iam_role.github_actions.arn
}

output "role_name" {
  value = aws_iam_role.github_actions.name
}

output "oidc_provider_arn" {
  description = "同一アカウントで他の Role を足す場合の trust policy で参照"
  value       = aws_iam_openid_connect_provider.github_actions.arn
}
