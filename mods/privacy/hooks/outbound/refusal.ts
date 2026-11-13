/**
 * Read by the model, and by a person in the call's result. The match cannot
 * tell where in the input the two sit, so a false refusal reads this too. It
 * names no way past the test: only a person's own hand sends the address.
 */
export const REFUSAL =
  "This call was refused: it, or a script it names, holds or reads the account's " +
  "email address beside what looks like a client's identity, or puts the " +
  'address in a URL. Use a generic client name. If a site needs a real contact, ' +
  'ask the person which to use. To send this address, the person sets it ' +
  'themselves in an environment variable the script reads, or runs the command ' +
  'themselves with `!`.'
