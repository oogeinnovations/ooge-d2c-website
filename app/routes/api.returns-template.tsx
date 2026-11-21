// GET /api/returns-template — the bulk-return Excel template, with every store
// product name already filled in (the customer adds Quantity and a Reason).
import type {Route} from './+types/api.returns-template';
import {buildReturnTemplate} from '~/lib/returnTemplate';
import {fetchAllProductTitles} from '~/lib/products';

export async function loader({context}: Route.LoaderArgs) {
  try {
    const titles = await fetchAllProductTitles(context.storefront);

    const file = buildReturnTemplate(titles);
    // A plain ArrayBuffer is what Response accepts as a body.
    const body = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Ooge-return-template.xlsx"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('[returns-template]', error);
    return new Response(
      'Could not build the template right now. Please try again, or add your items one by one on the form.',
      {status: 502},
    );
  }
}
