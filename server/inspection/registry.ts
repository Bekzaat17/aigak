import type { InspectionCheck } from './contracts.ts';

/** Registration stores constructors, so stateful checks are never shared between cases. */
export class CheckRegistry {
  private readonly entries = new Map<string, () => InspectionCheck>();
  register(id:string, factory:()=>InspectionCheck):this {
    if(this.entries.has(id))throw new Error(`DUPLICATE_CHECK: ${id}`);
    this.entries.set(id,factory);return this;
  }
  create(id:string):InspectionCheck {
    const factory=this.entries.get(id);if(!factory)throw new Error(`UNKNOWN_CHECK: ${id}`);
    const check=factory();if(check.id!==id)throw new Error(`CHECK_ID_MISMATCH: ${id}`);
    return check;
  }
}
