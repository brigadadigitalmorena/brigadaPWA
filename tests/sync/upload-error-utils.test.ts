import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyUploadError,
  describeUploadError,
  isRetryableUploadError,
} from '../../src/lib/sync/upload-error-utils.ts';

describe('classifyUploadError', () => {
  it('maps browser Failed to fetch to R2_CORS_OR_NETWORK', () => {
    assert.equal(
      classifyUploadError(new Error('Failed to fetch')),
      'R2_CORS_OR_NETWORK'
    );
  });

  it('maps Network Error to transient upload failure', () => {
    assert.equal(
      classifyUploadError(new Error('Network Error')),
      'R2_PUT_TRANSIENT'
    );
  });

  it('exposes Spanish copy instead of raw Failed to fetch', () => {
    const described = describeUploadError(new Error('Failed to fetch'));
    assert.equal(described.code, 'R2_CORS_OR_NETWORK');
    assert.match(described.message, /CORS|almacenamiento|archivo/i);
    assert.doesNotMatch(described.message, /Failed to fetch/i);
  });

  it('treats CORS/network upload failures as retryable', () => {
    assert.equal(isRetryableUploadError(new Error('Failed to fetch')), true);
  });
});
