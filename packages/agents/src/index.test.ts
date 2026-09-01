import { describe,it,expect } from 'vitest'; import { localPolicyCheck } from './index.js';
describe('localPolicyCheck',()=>{ it('blocks fake engagement',()=>expect(localPolicyCheck('buy followers now').ok).toBe(false)); it('allows normal copy',()=>expect(localPolicyCheck('Read our engineering update').ok).toBe(true)); });
