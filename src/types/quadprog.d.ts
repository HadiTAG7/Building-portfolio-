declare module "quadprog" {
  /** Goldfarb–Idnani dual QP solver (1-based arrays, R `solve.QP` port). */
  export function solveQP(
    Dmat: number[][],
    dvec: number[],
    Amat: number[][],
    bvec?: number[],
    meq?: number,
    factorized?: number[],
  ): {
    solution: number[];
    Lagrangian: number[];
    value: number[];
    unconstrained_solution: number[];
    iterations: number[];
    iact: number[];
    message: string;
  };
}
