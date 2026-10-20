import { definePreset } from '@primeuix/themes';
import AuraBase from '@primeuix/themes/aura/base';
import AuraButton from '@primeuix/themes/aura/button';
import AuraInputText from '@primeuix/themes/aura/inputtext';
import AuraTextarea from '@primeuix/themes/aura/textarea';
import AuraGalleria from '@primeuix/themes/aura/galleria';
import AuraDataTable from '@primeuix/themes/aura/datatable';

// Registrar aquí el tema de cada componente añadido; no cargar el catálogo completo.
const Aura = {
  ...AuraBase,
  components: {
    button: AuraButton,
    inputtext: AuraInputText,
    textarea: AuraTextarea,
    galleria: AuraGalleria,
    datatable: AuraDataTable,
  },
};

const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((step) => [step, `var(--ml-${name}-${step})`]));
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const colorScheme = {
  surface: scale('neutral', [0, ...steps]),
  primary: {
    color: 'var(--ml-color-primary)',
    contrastColor: 'var(--ml-color-on-primary)',
    hoverColor: 'var(--ml-color-primary-hover)',
    activeColor: 'var(--ml-color-primary-active)',
  },
  highlight: {
    background: 'var(--ml-color-primary-soft)',
    focusBackground: 'var(--ml-color-primary-soft)',
    color: 'var(--ml-color-text)',
    focusColor: 'var(--ml-color-text)',
  },
  formField: {
    background: 'var(--ml-color-surface)',
    color: 'var(--ml-color-text)',
    borderColor: 'var(--ml-color-outline)',
    focusBorderColor: 'var(--ml-color-primary)',
    invalidBorderColor: 'var(--ml-color-danger)',
    invalidPlaceholderColor: 'var(--ml-color-danger)',
    placeholderColor: 'var(--ml-color-muted)',
  },
  content: {
    background: 'var(--ml-color-surface)',
    color: 'var(--ml-color-text)',
    borderColor: 'var(--ml-color-outline)',
  },
  text: { color: 'var(--ml-color-text)', mutedColor: 'var(--ml-color-muted)' },
};
/** Puente a tokens.css: los valores de marca se definen exclusivamente allí. */
export const MisionLiderPreset = definePreset(Aura, {
  semantic: {
    primary: scale('brand', steps),
    colorScheme: { light: colorScheme, dark: colorScheme },
    focusRing: { width: '2px', style: 'solid', color: 'var(--ml-color-focus)', offset: '2px' },
    formField: { borderRadius: 'var(--ml-radius-control)' },
  },
  components: {
    button: { root: { borderRadius: 'var(--ml-radius-control)' } },
    galleria: {
      root: { borderWidth: '0', borderRadius: '0' },
      navButton: {
        background: 'var(--ml-public-backdrop)',
        hoverBackground: 'var(--ml-public-black)',
        color: 'var(--ml-public-white)',
        hoverColor: 'var(--ml-public-white)',
        size: 'var(--ml-touch-target)',
      },
    },
  },
});
