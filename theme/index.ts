import { createTheme } from "@mui/material/styles";
import { ptBR as corePtBR } from "@mui/material/locale";
import { ptBR as pickersPtBR } from "@mui/x-date-pickers/locales";

// Palette mirrors the tokens app/globals.css had before the MUI migration (Tailwind v4 oklch
// values converted to hex): green-700/green-800 primary, neutral grays, red destructive.
// globals.css now maps its Tailwind tokens onto these MUI CSS variables, so this file is the
// single source of truth for colors.
const fontBody = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";
const fontHeading = "var(--font-poppins), var(--font-inter), ui-sans-serif, system-ui, sans-serif";

export const theme = createTheme(
  {
    cssVariables: { colorSchemeSelector: "class", cssVarPrefix: "mui" },
    colorSchemes: {
      light: {
        palette: {
          primary: { main: "#008236", contrastText: "#f0fdf4" },
          secondary: { main: "#52525b", contrastText: "#fafafa" },
          error: { main: "#e7000b" },
          warning: { main: "#d97706" },
          success: { main: "#008236" },
          info: { main: "#155dfc" },
          background: { default: "#ffffff", paper: "#ffffff" },
          text: { primary: "#0a0a0a", secondary: "#737373" },
          divider: "#e5e5e5",
          action: { hover: "rgba(0,0,0,0.04)" },
        },
      },
      dark: {
        palette: {
          primary: { main: "#016630", contrastText: "#f0fdf4" },
          secondary: { main: "#a1a1aa", contrastText: "#18181b" },
          error: { main: "#ff6467" },
          warning: { main: "#fbbf24" },
          success: { main: "#05df72" },
          info: { main: "#51a2ff" },
          background: { default: "#0a0a0a", paper: "#171717" },
          text: { primary: "#fafafa", secondary: "#a1a1a1" },
          divider: "rgba(255,255,255,0.1)",
        },
      },
    },
    shape: { borderRadius: 7 },
    typography: {
      fontFamily: fontBody,
      fontSize: 14,
      h1: { fontFamily: fontHeading, fontWeight: 600, fontSize: "1.75rem" },
      h2: { fontFamily: fontHeading, fontWeight: 600, fontSize: "1.5rem" },
      h3: { fontFamily: fontHeading, fontWeight: 600, fontSize: "1.25rem" },
      h4: { fontFamily: fontHeading, fontWeight: 600, fontSize: "1.125rem" },
      h5: { fontFamily: fontHeading, fontWeight: 600, fontSize: "1rem" },
      h6: { fontFamily: fontHeading, fontWeight: 600, fontSize: "0.95rem" },
      button: { fontWeight: 500, textTransform: "none" },
    },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: false } },
      MuiButton: {
        defaultProps: { disableElevation: true, size: "small" },
        styleOverrides: { root: { whiteSpace: "nowrap", minWidth: 0 } },
      },
      MuiIconButton: { defaultProps: { size: "small" } },
      MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
      MuiOutlinedInput: { defaultProps: { size: "small" } },
      MuiFormControl: { defaultProps: { size: "small" } },
      MuiSelect: { defaultProps: { size: "small" } },
      MuiAutocomplete: { defaultProps: { size: "small" } },
      MuiTooltip: { defaultProps: { arrow: true, enterDelay: 150 } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiDialog: { defaultProps: { fullWidth: true, maxWidth: "sm" } },
      MuiDialogTitle: { styleOverrides: { root: { fontFamily: fontHeading, fontWeight: 600, fontSize: "1.05rem" } } },
      MuiCard: { defaultProps: { variant: "outlined" } },
      MuiChip: { defaultProps: { size: "small" } },
      MuiTableCell: { styleOverrides: { root: { paddingTop: 8, paddingBottom: 8 } } },
      MuiSkeleton: { defaultProps: { animation: "wave" } },
    },
  },
  corePtBR,
  pickersPtBR
);
