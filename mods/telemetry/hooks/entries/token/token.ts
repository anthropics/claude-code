/**
 * The shape of an event name and a property key: a snake_case token of at
 * most 64 characters, starting with a letter (a Choice member: CHOICE_TOKEN).
 */
export const TOKEN = /^[a-z][a-z0-9_]{0,63}$/
