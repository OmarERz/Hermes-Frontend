/**
 * Types of the backend contract, taken from the types generated from openapi/openapi.json (npm run api:generate).
 * Never write API types by hand: name them here from the generated ones.
 */
import type { components, operations } from './schema';

export type Schemas = components['schemas'];

/** Query parameters of an operation, by its operationId. */
export type OperationQuery<K extends keyof operations> = NonNullable<
  operations[K]['parameters']['query']
>;

/** JSON body of the 200 response of an operation, by its operationId. */
export type OperationResult<K extends keyof operations> = operations[K]['responses'] extends {
  200: { content: { 'application/json': infer T } };
}
  ? T
  : never;

export type Role = Schemas['Role'];
export type CurrentUser = Schemas['CurrentUser'];
export type ErrorResponse = Schemas['ErrorResponse'];

export type VulnerabilityList = Schemas['VulnerabilityList'];
export type VulnerabilityGroup = Schemas['VulnerabilityGroup'];
export type ListVulnerabilitiesQuery = OperationQuery<'list_vulnerabilities'>;
