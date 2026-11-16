import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REPORT_MAX_ATTACHMENTS,
  normalizeReportMime,
  validateReportImage,
} from '../src/lib/services/report-issue.service';

describe('report-issue helpers', () => {
  it('caps attachments at backend Phase 1 limit', () => {
    assert.equal(REPORT_MAX_ATTACHMENTS, 3);
  });

  it('normalizes image/jpg to image/jpeg', () => {
    assert.equal(normalizeReportMime('image/jpg'), 'image/jpeg');
    assert.equal(normalizeReportMime(' image/PNG '), 'image/png');
  });

  it('rejects oversized images', () => {
    const file = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    assert.match(validateReportImage(file) ?? '', /5 MB/);
  });

  it('accepts jpeg under the size limit', () => {
    const file = new File([new Uint8Array(1024)], 'ok.jpg', {
      type: 'image/jpeg',
    });
    assert.equal(validateReportImage(file), null);
  });
});
