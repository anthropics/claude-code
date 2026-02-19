import { LinearClient } from "@linear/sdk";
import { config } from "../config.js";

export const linearClient = new LinearClient({
  apiKey: config.linearApiKey,
});
