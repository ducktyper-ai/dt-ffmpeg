/** A graph that cannot be built or compiled. */
export class GraphError extends Error {
  override name = "GraphError";
}
