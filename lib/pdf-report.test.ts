import { describe, expect, it } from 'vitest';
import { createTextPdf } from './pdf-report';

describe('createTextPdf', () => {
  it('creates a valid-looking paginated PDF document', () => {
    const document = new TextDecoder().decode(createTextPdf('Report', Array.from({ length: 50 }, (_, index) => `Row ${index}`)));
    expect(document.startsWith('%PDF-1.4')).toBe(true);
    expect(document).toContain('/Count 2');
    expect(document).toContain('%%EOF');
  });
});
