import assert from 'node:assert/strict';
import test from 'node:test';

import { notificationHref } from '../src/lib/api/notifications.service';
import { splitFullName } from '../src/lib/api/auth.service';

test('maps CMS notification URLs onto PWA routes', () => {
  assert.equal(notificationHref('/dashboard/surveys'), '/surveys');
  assert.equal(notificationHref('/dashboard/assignments'), '/surveys');
  assert.equal(notificationHref('/tracking'), '/tracking');
  assert.equal(notificationHref(null), null);
});

test('splits full_name from /users/me into nombre and apellido', () => {
  assert.deepEqual(splitFullName('Ana García Pérez'), {
    nombre: 'Ana',
    apellido: 'García Pérez',
  });
  assert.deepEqual(splitFullName('Brigadista'), {
    nombre: 'Brigadista',
    apellido: '',
  });
});
