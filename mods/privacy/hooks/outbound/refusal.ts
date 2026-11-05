/**
 * Read by the model, and by a person in the call's result. The match cannot
 * tell where in the input the two sit, so it offers each way on.
 */
export const REFUSAL =
  "This call was refused: it holds the account's email address and what looks " +
  'like a User-Agent setting. If nobody asked to send the address, run it ' +
  'again without it, with a generic client name. Otherwise run it again ' +
  'without that setting, or run the two in separate calls.'
