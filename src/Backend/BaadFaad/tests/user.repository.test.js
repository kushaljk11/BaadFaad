import test from 'node:test';
import assert from 'node:assert/strict';
import { toUserDto } from '../repositories/user.repository.js';

test('user DTO keeps compatibility id and excludes password by default', () => {
  const source = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@example.com',
    image: null,
    role: null,
    password: 'sensitive-hash',
  };
  const dto = toUserDto(source);

  assert.equal(dto._id, 'user-id');
  assert.equal(dto.id, 'user-id');
  assert.equal('password' in dto, false);
});

test('user DTO exposes the password hash only when explicitly requested', () => {
  const dto = toUserDto({
    id: 'user-id',
    name: 'Test User',
    email: 'test@example.com',
    password: 'sensitive-hash',
  }, { includePassword: true });

  assert.equal(dto.password, 'sensitive-hash');
});
