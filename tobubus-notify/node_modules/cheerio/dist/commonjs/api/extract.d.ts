import type { AnyNode, Element } from 'domhandler';
import type { Cheerio } from '../cheerio.js';
import type { prop } from './attributes.js';
type ExtractDescriptorFn = (el: Element, key: string, obj: Record<string, unknown>) => unknown;
interface ExtractDescriptor {
    selector: string;
    value?: string | ExtractDescriptorFn | ExtractMap;
}
type ExtractValue = string | ExtractDescriptor | [string | ExtractDescriptor];
export type ExtractMap = Record<string, ExtractValue>;
type ExtractedValue<V extends ExtractValue> = V extends [
    string | ExtractDescriptor
] ? NonNullable<ExtractedValue<V[0]>>[] : V extends string ? string | undefined : V extends ExtractDescriptor ? V['value'] extends infer U ? U extends ExtractMap ? ExtractedMap<U> | undefined : U extends ExtractDescriptorFn ? ReturnType<U> | undefined : ReturnType<typeof prop> | undefined : never : never;
export type ExtractedMap<M extends ExtractMap> = {
    [key in keyof M]: ExtractedValue<M[key]>;
};
/**
 * Extract multiple values from a document, and store them in an object.
 *
 * @param map - An object containing key-value pairs. The keys are the names of
 *   the properties to be created on the object, and the values are the
 *   selectors to be used to extract the values.
 * @returns An object containing the extracted values.
 */
export declare function extract<M extends ExtractMap, T extends AnyNode>(this: Cheerio<T>, map: M): ExtractedMap<M>;
export {};
//# sourceMappingURL=extract.d.ts.map