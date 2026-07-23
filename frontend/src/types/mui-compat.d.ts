// Temporary compatibility shims for MUI prop typings used by legacy components
import '@mui/material'

declare module '@mui/material' {
  // loosen a few commonly-used legacy props so older components compile
  interface TextFieldProps {
    InputProps?: any
    inputProps?: any
  }

  interface AutocompleteRenderInputParams {
    InputProps?: any
    inputProps?: any
  }

  interface AutocompleteProps<T, Multiple = false, DisableClearable = false, FreeSolo = false, ChipComponent = 'div'> {
    PopperProps?: any
  }

  interface DrawerProps {
    PaperProps?: any
  }

  interface GridProps {
    container?: boolean
    item?: boolean
    alignItems?: any
    flexWrap?: any
    justifyContent?: any
  }

  interface StackProps {
    alignItems?: any
    justifyContent?: any
    flexWrap?: any
    useFlexGap?: any
  }
}

declare module '@mui/material/TextField' {
  interface TextFieldProps {
    inputProps?: any
    InputProps?: any
  }
}
