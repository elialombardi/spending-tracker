import { useContext } from 'react'
import { SnackbarContext } from '../components/SnackbarProvider'

export const useSnackbar = () => {
    const ctx = useContext(SnackbarContext)
    if (!ctx) throw new Error('useSnackbar must be used within a SnackbarProvider')
    return ctx
}

export default useSnackbar
