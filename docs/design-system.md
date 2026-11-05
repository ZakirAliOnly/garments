# Shared application design

The dashboard's blue palette is the common visual language for every module. `app/theme.css`, loaded after the existing component styles, defines the shared palette, gradients, typography, button heights/radii, form controls, cards and tables. It also normalizes the older inline styles using explicit `data-ui-action` attributes without changing handlers or financial operations.

- Poppins is loaded with Next.js and inherited by controls, codes and amounts; financial tables use tabular numerals.
- Primary actions and selected module tabs use the same blue gradient. Secondary actions use white or pale blue. Success/payment confirmation actions use one green gradient; destructive actions use one red gradient.
- Full actions use a 42px minimum height and 10px corners. Compact table actions and icon buttons use their own consistent sizes.
- Activity Log now uses the dashboard's blue accents, text, white cards, table header, filters and forms. User attribution is unchanged.
- Reports use blue category cards with real keyboard-accessible buttons. Generate, Print, PDF and filter actions follow the shared button variants.
- Responsive form grids collapse on mobile, spanning fields reset to one column, Stock tabs scroll within their container, and Cashbook filters wrap without widening the page.

Validation: production build/TypeScript and targeted lint; browser review of all 13 modules at 1440px and 390px; computed font, primary-gradient and button-radius checks; seven create dialogs checked for mobile overflow. Print document templates are unchanged.

No database migration is needed for this design update.
