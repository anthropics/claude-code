import { Plan } from "./types";

/**
 * Base abstract class for all domain-specific planners.
 * Defines the common interface and functionality for planners.
 */
export abstract class BasePlanner {
  /**
   * The domain this planner is responsible for
   */
  protected domain: string;

  /**
   * Creates a new planner for the specified domain
   * 
   * @param domain The domain this planner handles
   */
  constructor(domain: string) {
    this.domain = domain;
  }

  /**
   * Gets the domain of this planner
   * 
   * @returns The planner's domain name
   */
  getDomain(): string {
    return this.domain;
  }

  /**
   * Creates a plan based on input parameters
   * 
   * @param params Domain-specific planning parameters
   * @returns A complete execution plan
   */
  abstract createPlan(params: Record<string, any>): Promise<Plan>;
}