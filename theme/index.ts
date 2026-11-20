import { createTheme } from "@mui/material/styles"
import { ptBR as corePtBR } from "@mui/material/locale"
import { ptBR as pickersPtBR } from "@mui/x-date-pickers/locales"

// Chip "soft" variant: tonal fill + colored label (subtler than filled, louder than outlined).
declare module "@mui/material/Chip" {
  interface ChipPropsVariantOverrides {
    soft: true
  }
}

// Material Design theme. The brand green stays the primary color; surfaces, elevation, shapes and
// type follow Material (tinted background + white paper with elevation, 8px corners / 12px cards,
// ripple, 36px buttons, floating outlined labels). app/globals.css maps its Tailwind tokens onto
// these MUI CSS variables, so this file is the single source of truth for colors.
const fontBody = "var(--font-inter), ui-sans-serif, system-ui, sans-serif"
const fontHeading = "var(--font-poppins), var(--font-inter), ui-sans-serif, system-ui, sans-serif"

/** Tonal fill (Material "secondary container"-like) built from the primary color channel. */
const tonal = (alpha: number) => `rgba(var(--mui-palette-primary-mainChannel) / ${alpha})`

/** Hairline border of the "outlined surface" look (Paper, Card, Accordion): faint primary tint. */
const hairline = `1px solid ${tonal(0.12)}`
/** Focus halo shared by fields and buttons. */
const focusRing = `0 0 0 3px ${tonal(0.25)}`
const fontMono = "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace"

const chipColors = ["primary", "secondary", "error", "warning", "success", "info"] as const

export const theme = createTheme(
  {
    cssVariables: { colorSchemeSelector: "class", cssVarPrefix: "mui" },
    colorSchemes: {
      light: {
        palette: {
          primary: { main: "#008236", light: "#3fa864", dark: "#005c26", contrastText: "#ffffff" },
          secondary: { main: "#4f6352", contrastText: "#ffffff" },
          error: { main: "#d32f2f" },
          warning: { main: "#ed6c02" },
          success: { main: "#2e7d32" },
          info: { main: "#0288d1" },
          background: { default: "#f6f8f6", paper: "#ffffff" },
          text: { primary: "rgba(0, 0, 0, 0.87)", secondary: "rgba(0, 0, 0, 0.6)" },
          divider: "rgba(0, 0, 0, 0.12)",
        },
      },
      dark: {
        palette: {
          primary: { main: "#66d18f", light: "#8fe0ad", dark: "#3fa864", contrastText: "#00391a" },
          secondary: { main: "#b6ccb8", contrastText: "#223526" },
          error: { main: "#f2726f" },
          warning: { main: "#ffa726" },
          success: { main: "#66bb6a" },
          info: { main: "#4fc3f7" },
          // Deep green-black base; surfaces are a step lighter and outlined by a primary hairline.
          // Elevated surfaces (menus, dialogs) still lighten through Paper's white overlay.
          background: { default: "#0a0e0d", paper: "#0f1513" },
          text: { primary: "rgba(255, 255, 255, 0.92)", secondary: "rgba(255, 255, 255, 0.7)" },
          divider: "rgba(255, 255, 255, 0.12)",
        },
      },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: fontBody,
      fontSize: 14,
      h1: { fontFamily: fontHeading, fontWeight: 400, fontSize: "2.125rem", lineHeight: 1.235, letterSpacing: "0.00735em" },
      h2: { fontFamily: fontHeading, fontWeight: 400, fontSize: "1.75rem", lineHeight: 1.3 },
      h3: { fontFamily: fontHeading, fontWeight: 400, fontSize: "1.5rem", lineHeight: 1.334 },
      h4: { fontFamily: fontHeading, fontWeight: 500, fontSize: "1.25rem", lineHeight: 1.6, letterSpacing: "0.0075em" },
      h5: { fontFamily: fontHeading, fontWeight: 500, fontSize: "1.125rem", lineHeight: 1.5 },
      h6: { fontFamily: fontHeading, fontWeight: 500, fontSize: "1rem", lineHeight: 1.5, letterSpacing: "0.0075em" },
      subtitle1: { fontWeight: 500, fontSize: "0.9375rem", lineHeight: 1.6 },
      subtitle2: { fontWeight: 500, fontSize: "0.875rem", lineHeight: 1.57 },
      body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
      body2: { fontSize: "0.875rem", lineHeight: 1.43 },
      button: { fontWeight: 500, textTransform: "none", letterSpacing: "0.02em" },
      caption: { fontSize: "0.75rem", lineHeight: 1.66, letterSpacing: "0.03333em" },
      overline: { fontSize: "0.6875rem", fontWeight: 600, lineHeight: 2, letterSpacing: "0.08em", textTransform: "uppercase" },
    },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: false } },
      MuiButton: {
        defaultProps: { size: "medium" },
        styleOverrides: {
          root: ({ theme }) => ({
            whiteSpace: "nowrap",
            minWidth: 0,
            borderRadius: 8,
            transition: theme.transitions.create(["background-color", "box-shadow", "border-color", "color"], { duration: theme.transitions.duration.short }),
            "&.Mui-focusVisible": { boxShadow: focusRing },
          }),
          sizeSmall: { height: 32, padding: "0 12px" },
          sizeMedium: { height: 36, padding: "0 16px" },
          sizeLarge: { height: 40, padding: "0 22px" },
        },
        variants: [
          {
            // Subtle vertical gradient + inner top highlight on the primary call to action.
            props: { variant: "contained", color: "primary" },
            style: ({ theme }) => ({
              backgroundImage: `linear-gradient(180deg, ${theme.vars.palette.primary.light} -40%, ${theme.vars.palette.primary.main} 55%, ${theme.vars.palette.primary.dark} 160%)`,
              boxShadow: `inset 0 1px 0 rgba(255 255 255 / 0.18), 0 1px 2px rgba(0 0 0 / 0.2)`,
              "&:hover": { boxShadow: `inset 0 1px 0 rgba(255 255 255 / 0.22), 0 2px 10px -2px ${tonal(0.5)}` },
              "&.Mui-focusVisible": { boxShadow: `inset 0 1px 0 rgba(255 255 255 / 0.18), ${focusRing}` },
              "&.Mui-disabled": { backgroundImage: "none", boxShadow: "none" },
            }),
          },
          { props: { variant: "outlined", color: "primary" }, style: { borderColor: tonal(0.4) } },
        ],
      },
      MuiIconButton: { defaultProps: { size: "small" } },
      MuiFab: { defaultProps: { color: "primary" } },
      MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
      MuiOutlinedInput: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: ({ theme }) => ({
            // Light: white field on the tinted page; dark: transparent (Material outlined) so it sits
            // on whatever elevated surface (card, dialog) holds it.
            backgroundColor: theme.vars.palette.background.paper,
            ...theme.applyStyles("dark", { backgroundColor: "rgba(255 255 255 / 0.02)" }),
            transition: theme.transitions.create(["box-shadow", "border-color"], { duration: theme.transitions.duration.short }),
            "&.Mui-focused:not(.Mui-error)": { boxShadow: focusRing },
            "&.Mui-focused.Mui-error": { boxShadow: `0 0 0 3px rgba(${theme.vars.palette.error.mainChannel} / 0.2)` },
            "&:hover:not(.Mui-disabled):not(.Mui-error):not(.Mui-focused) .MuiOutlinedInput-notchedOutline": { borderColor: theme.vars.palette.text.primary },
          }),
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: "0.875rem" } } },
      MuiFormHelperText: { styleOverrides: { root: { marginLeft: 14, marginRight: 14 } } },
      MuiFormControl: { defaultProps: { size: "small" } },
      MuiSelect: { defaultProps: { size: "small" } },
      MuiAutocomplete: { defaultProps: { size: "small" } },
      MuiTooltip: { defaultProps: { arrow: false, enterDelay: 150 }, styleOverrides: { tooltip: { fontSize: "0.75rem", borderRadius: 4 } } },
      // Outlined-surface look: flat (elevation 0) with a primary-tinted hairline. Floating surfaces
      // (menus, popovers, dialogs) keep their own elevation shadow on top of the hairline.
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { "&:not(.MuiAlert-root):not(.MuiAppBar-root):not(.MuiSnackbarContent-root):not(.MuiDrawer-paper)": { border: hairline } },
          rounded: { borderRadius: 12 },
        },
      },
      MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { borderRadius: 12 } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: "0.875rem", minHeight: 40 } } },
      MuiDialog: {
        defaultProps: { fullWidth: true, maxWidth: "sm" },
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 16,
            // Dark: a gentler lift than Material's elevation-24 overlay, so dialogs stay in the deep palette.
            ...theme.applyStyles("dark", { backgroundImage: "linear-gradient(rgba(255 255 255 / 0.045), rgba(255 255 255 / 0.045))" }),
          }),
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontFamily: fontHeading, fontWeight: 500, fontSize: "1.25rem", lineHeight: 1.6 } } },
      MuiDialogActions: { styleOverrides: { root: { padding: "8px 24px 20px", gap: 8 } } },
      MuiChip: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 500, fontVariantNumeric: "tabular-nums" },
          sizeSmall: { height: 24, fontSize: "0.75rem" },
          outlined: ({ theme }) => ({ borderColor: theme.vars.palette.divider }),
        },
        variants: [
          {
            props: { variant: "soft" },
            style: ({ theme }) => ({
              border: "1px solid transparent",
              backgroundColor: theme.vars.palette.action.selected,
              color: theme.vars.palette.text.primary,
            }),
          },
          ...chipColors.flatMap((color) => [
            {
              props: { variant: "soft" as const, color },
              style: {
                backgroundColor: `rgba(var(--mui-palette-${color}-mainChannel) / 0.14)`,
                borderColor: `rgba(var(--mui-palette-${color}-mainChannel) / 0.24)`,
                color: `var(--mui-palette-${color}-dark)`,
                ".dark &": { color: `var(--mui-palette-${color}-light)` },
                "& .MuiChip-icon, & .MuiChip-deleteIcon": { color: "inherit" },
              },
            },
            {
              props: { variant: "outlined" as const, color },
              style: {
                borderColor: `rgba(var(--mui-palette-${color}-mainChannel) / 0.5)`,
                backgroundColor: `rgba(var(--mui-palette-${color}-mainChannel) / 0.04)`,
              },
            },
          ]),
        ],
      },
      MuiTabs: {
        styleOverrides: {
          root: ({ theme }) => ({ minHeight: 48, borderBottom: `1px solid ${theme.vars.palette.divider}` }),
          indicator: { height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 48,
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.875rem",
            "&:hover": { backgroundColor: theme.vars.palette.action.hover },
          }),
        },
      },
      MuiSwitch: {
        styleOverrides: {
          // Material 3-like track/thumb: rounded track, larger thumb when on.
          root: { padding: 7 },
          track: { borderRadius: 999, opacity: 1, backgroundColor: "rgba(var(--mui-palette-text-primaryChannel, 0 0 0) / 0.38)" },
          switchBase: ({ theme }) => ({
            "&.Mui-checked + .MuiSwitch-track": { opacity: 1, backgroundColor: theme.vars.palette.primary.main },
            "&.Mui-checked .MuiSwitch-thumb": { backgroundColor: theme.vars.palette.primary.contrastText },
          }),
          thumb: { boxShadow: "none" },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: "none",
            fontWeight: 500,
            "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: tonal(0.16), color: theme.vars.palette.primary.dark },
            ...theme.applyStyles("dark", { "&.Mui-selected, &.Mui-selected:hover": { color: theme.vars.palette.primary.light } }),
          }),
        },
      },
      MuiToggleButtonGroup: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 4, borderRadius: 999, backgroundColor: tonal(0.16) },
          bar: { borderRadius: 999 },
        },
      },
      MuiAccordion: {
        defaultProps: { elevation: 0, disableGutters: true },
        styleOverrides: {
          root: {
            border: 0,
            "&::before": { display: "none" },
            "&:first-of-type": { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
            "&:last-of-type": { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
            "&.Mui-expanded": { margin: "8px 0" },
          },
        },
      },
      MuiAccordionSummary: { styleOverrides: { root: { minHeight: 48, padding: "0 16px" }, content: { margin: "12px 0" } } },
      MuiAccordionDetails: { styleOverrides: { root: { padding: "0 16px 16px" } } },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: "inherit" },
        styleOverrides: { root: ({ theme }) => ({ backgroundColor: theme.vars.palette.background.paper }) },
      },
      MuiDrawer: {
        styleOverrides: { paper: ({ theme }) => ({ border: 0, backgroundColor: theme.vars.palette.background.paper }) },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.Mui-selected": { backgroundColor: tonal(0.14), color: theme.vars.palette.primary.dark },
            ...theme.applyStyles("dark", { "&.Mui-selected": { color: theme.vars.palette.primary.light } }),
            "&.Mui-selected:hover": { backgroundColor: tonal(0.2) },
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { paddingTop: 10, paddingBottom: 10 },
          head: ({ theme }) => ({ ...theme.typography.overline, lineHeight: 1.5, color: theme.vars.palette.text.secondary }),
        },
      },
      MuiBadge: { styleOverrides: { badge: { fontFamily: fontMono, fontVariantNumeric: "tabular-nums", fontWeight: 600 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiSkeleton: { defaultProps: { animation: "wave" } },
    },
  },
  corePtBR,
  pickersPtBR
)
