import { definePreset } from '@primeuix/themes';
import AuraBase from '@primeuix/themes/aura/base';
import AuraButton from '@primeuix/themes/aura/button';
import AuraInputText from '@primeuix/themes/aura/inputtext';
import AuraTextarea from '@primeuix/themes/aura/textarea';
import AuraGalleria from '@primeuix/themes/aura/galleria';
import AuraDataTable from '@primeuix/themes/aura/datatable';
import AuraPaginator from '@primeuix/themes/aura/paginator';
import AuraSelect from '@primeuix/themes/aura/select';
import AuraDatePicker from '@primeuix/themes/aura/datepicker';
import AuraMessage from '@primeuix/themes/aura/message';
import AuraConfirmDialog from '@primeuix/themes/aura/confirmdialog';
import AuraDialog from '@primeuix/themes/aura/dialog';
import AuraProgressSpinner from '@primeuix/themes/aura/progressspinner';
import AuraToast from '@primeuix/themes/aura/toast';

// Registrar aquí el tema de cada componente añadido; no cargar el catálogo completo.
const Aura = {
  ...AuraBase,
  components: {
    button: AuraButton,
    inputtext: AuraInputText,
    textarea: AuraTextarea,
    galleria: AuraGalleria,
    datatable: AuraDataTable,
    paginator: AuraPaginator,
    select: AuraSelect,
    datepicker: AuraDatePicker,
    message: AuraMessage,
    confirmdialog: AuraConfirmDialog,
    dialog: AuraDialog,
    progressspinner: AuraProgressSpinner,
    toast: AuraToast,
  },
};

const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((step) => [step, `var(--ml-${name}-${step})`]));
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const toastSeverity = (accent: string) => ({
  background: 'var(--ml-color-surface)',
  borderColor: accent,
  color: accent,
  detailColor: 'var(--ml-color-text)',
  shadow: 'var(--ml-shadow-panel)',
  closeButton: {
    hoverBackground: 'var(--ml-color-background)',
    focusRing: { color: 'var(--ml-color-focus)', shadow: 'none' },
  },
});
const toastScheme = {
  success: toastSeverity('var(--ml-color-primary)'),
  info: toastSeverity('var(--ml-color-muted)'),
  warn: toastSeverity('var(--ml-color-focus)'),
  error: toastSeverity('var(--ml-color-danger)'),
};
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
    toast: {
      root: { borderRadius: 'var(--ml-radius-panel)' },
      closeButton: { width: 'var(--ml-touch-target)', height: 'var(--ml-touch-target)' },
      colorScheme: { light: toastScheme, dark: toastScheme },
    },
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
