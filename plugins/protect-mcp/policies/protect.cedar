// protect-mcp example policy. Customize this for your project.
//
// Cedar note: use ["a","b"].contains(x) for set membership and `like` for globs.
// Never write `context.x in ["a","b"]` to match a string: `in` is the
// entity-hierarchy operator, it type-errors on a String, and Cedar silently
// discards the whole rule. That fail-open class of bug is exactly what this
// gate exists to prevent (see GHSA-hm46-7j72-rpv9).

// Block destructive shell commands. Guarded with `has` so non-Bash tool calls
// (which carry no command_pattern) are unaffected and fall through to permit.
forbid(principal, action, resource) when {
  context has command_pattern &&
  (context.command_pattern like "*rm -rf*" ||
   context.command_pattern like "*mkfs*" ||
   context.command_pattern like "*shutdown*" ||
   context.command_pattern like "*:(){ :|:& };:*")
};

// Allow everything else.
permit(principal, action, resource);
