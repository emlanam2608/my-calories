import { describe, expect, it } from 'vitest';
import { extractFoodFromImage } from './openai-food-extraction';

const proposal = {
  items: [{ name: 'Chicken rice', nameVi: 'Cơm gà', grams: 350, servingDescription: '1 bowl', preparation: 'roasted', ingredients: ['rice', 'chicken'], barcode: null, confidence: 78 }],
  confidence: 78,
  unresolvedQuestions: [],
  manualReviewRequired: false,
};

describe('OpenAI food extraction adapter', () => {
  it('uses stateless strict structured output and flags review', async () => {
    let request: RequestInit | undefined;
    const result = await extractFoodFromImage({
      apiKey: 'test-key',
      model: 'gpt-5.6-luna',
      image: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png', kind: 'meal_photo' },
      fetchFn: async (_url, init) => {
        request = init;
        return new Response(JSON.stringify({ output_text: JSON.stringify(proposal) }));
      },
    });
    const body = JSON.parse(request?.body as string);
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body.model).toBe('gpt-5.6-luna');
    expect(result.manualReviewRequired).toBe(false);
  });

  it('rejects malformed provider output', async () => {
    await expect(
      extractFoodFromImage({
        apiKey: 'test-key',
        model: 'gpt-5.6-luna',
        image: { bytes: new Uint8Array([1]), contentType: 'image/png', kind: 'meal_photo' },
        fetchFn: async () => new Response(JSON.stringify({ output_text: '{not json' })),
      }),
    ).rejects.toMatchObject({ code: 'malformed' });
  });
});
