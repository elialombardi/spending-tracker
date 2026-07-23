// Treat a few MUI components as `any` to avoid complex overload typing in legacy UI
declare module '@mui/material/Stack' {
  const Stack: any
  export default Stack
}

declare module '@mui/material/Grid' {
  const Grid: any
  export default Grid
}
