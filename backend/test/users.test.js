import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A throwaway database for this test file.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'a8-users-'));
const { addUser, updateUser, removeUser, signInWithGoogle } = await import('../src/users.js');

test('team rules', () => {
  const admin = addUser({ email: 'Boss@Example.com', role: 'admin' });
  assert.equal(admin.email, 'boss@example.com');
  assert.throws(() => addUser({ email: 'boss@example.com', role: 'employee' }), /already on the team/);
  assert.throws(() => addUser({ email: 'x@y.z', role: 'owner' }), /admin or employee/);

  // The only admin cannot be demoted, turned off or removed.
  assert.throws(() => updateUser(admin.id, { role: 'employee' }), /at least one active admin/);
  assert.throws(() => removeUser(admin.id), /at least one active admin/);

  const staff = addUser({ email: 'staff@example.com', role: 'employee' });
  assert.throws(() => updateUser(staff.id, { role: 'employee', active: false }, staff), /own admin access/);
  updateUser(staff.id, { role: 'admin' }, admin);
  updateUser(admin.id, { role: 'employee' }, staff); // now allowed: another admin exists
});

test('Google sign-in only for the team, pinned to one Google account', () => {
  assert.throws(() => signInWithGoogle({ sub: '1', email: 'stranger@example.com' }), /not on the team/);
  const user = signInWithGoogle({ sub: 'g-1', email: 'STAFF@example.com', name: 'Staff', picture: null });
  assert.equal(user.name, 'Staff');
  assert.ok(user.lastLoginAt);
  assert.throws(() => signInWithGoogle({ sub: 'g-2', email: 'staff@example.com' }), /different Google account/);
});
