import React, { createContext, useCallback, useContext, useState } from 'react'
import { Snackbar, Alert, AlertColor } from '@mui/material'

type SnackbarContextType = {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
    warning: (msg: string) => void
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined)

const SnackbarProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
    const [open, setOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [severity, setSeverity] = useState<AlertColor>('success')

    const show = useCallback((msg: string, sev: AlertColor = 'success') => {
        setMessage(msg)
        setSeverity(sev)
        setOpen(true)
    }, [])

    const handleClose = useCallback(() => {
        setOpen(false)
    }, [])

    const value: SnackbarContextType = {
        success: (m: string) => show(m, 'success'),
        error: (m: string) => show(m, 'error'),
        info: (m: string) => show(m, 'info'),
        warning: (m: string) => show(m, 'warning'),
    }

    return (
        <SnackbarContext.Provider value={value}>
            {children}
            <Snackbar open={open} autoHideDuration={5000} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }}>
                    {message}
                </Alert>
            </Snackbar>
        </SnackbarContext.Provider>
    )
}

export { SnackbarProvider, SnackbarContext }

export default SnackbarProvider
