import { z } from "zod";
import { jaErrorMap } from "./errorMapJa";

// Apply Japanese error messages globally
z.setErrorMap(jaErrorMap);

