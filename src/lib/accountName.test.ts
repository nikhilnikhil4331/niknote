/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { accountName } from './accountName';

test('welcome uses the current account name, not Nikhil for everyone', () => {
  expect(accountName({ user_metadata: { full_name: 'Aisha Khan' } })).toEqual({ fullName: 'Aisha Khan', firstName: 'Aisha' });
  expect(accountName({ user_metadata: { full_name: 'Nikhil Jatav' } }).firstName).toBe('Nikhil');
});
test('switching accounts derives the new identity without a stored fallback', () => {
  expect(accountName({ user_metadata: { name: 'Ravi Kumar' } }).firstName).toBe('Ravi');
  expect(accountName(null)).toEqual({ fullName: 'Guest', firstName: '' });
  expect(accountName({ user_metadata: { full_name: '  ' } })).toEqual({ fullName: 'Your account', firstName: '' });
});