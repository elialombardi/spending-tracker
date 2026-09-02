import React, { useMemo } from 'react'
import { Box, Paper, Typography, IconButton, Stack, Button } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import type { BoxingEvent } from '../../api/boxing-events'

type Props = {
    events: BoxingEvent[]
    onEdit?: (e: BoxingEvent) => void
    onCreate?: (date: Date) => void
    onDelete?: (id: number) => void
    onRefresh?: () => void
}

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function addDays(d: Date, days: number) {
    const n = new Date(d)
    n.setDate(n.getDate() + days)
    return n
}

function formatKey(d: Date) {
    return d.toISOString().slice(0, 10)
}

const BoxingEventsCalendar: React.FC<Props> = ({ events, onEdit, onCreate, onDelete, onRefresh }) => {
    const [current, setCurrent] = React.useState<Date>(() => startOfMonth(new Date()))

    const eventsByDate = useMemo(() => {
        const m: Record<string, BoxingEvent[]> = {}
        for (const e of events) {
            const d = new Date(e.start_date)
            const key = formatKey(d)
            if (!m[key]) m[key] = []
            m[key].push(e)
        }
        return m
    }, [events])

    const monthMatrix = useMemo(() => {
        const start = startOfMonth(current)
        const end = endOfMonth(current)
        // find first day of week (Sunday) to start
        const matrix: Date[][] = []
        let cur = addDays(start, -start.getDay())
        while (cur <= end || cur.getDay() !== 0) {
            const week: Date[] = []
            for (let i = 0; i < 7; i++) {
                week.push(new Date(cur))
                cur = addDays(cur, 1)
            }
            matrix.push(week)
        }
        return matrix
    }, [current])

    const prevMonth = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    const nextMonth = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton size="small" onClick={prevMonth}><ChevronLeftIcon /></IconButton>
                    <Typography variant="h6">{current.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Typography>
                    <IconButton size="small" onClick={nextMonth}><ChevronRightIcon /></IconButton>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => { setCurrent(startOfMonth(new Date())) }}>Today</Button>
                    <Button size="small" onClick={onRefresh}>Refresh</Button>
                </Stack>
            </Stack>

            <Paper>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <Box key={d} sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{d}</Typography>
                        </Box>
                    ))}
                    {monthMatrix.map((week, wi) => (
                        week.map((day) => {
                            const key = formatKey(day)
                            const dayEvents = eventsByDate[key] || []
                            const isOtherMonth = day.getMonth() !== current.getMonth()
                            return (
                                <Box key={key} sx={{ minHeight: 100, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider', p: 0.5 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
                                        <Typography variant="body2" color={isOtherMonth ? 'text.disabled' : 'text.primary'}>{day.getDate()}</Typography>
                                        <Button size="small" onClick={() => onCreate && onCreate(day)}>+</Button>
                                    </Box>
                                    <Box sx={{ mt: 0.5 }}>
                                        {dayEvents.slice(0, 3).map(ev => (
                                            <Box key={ev.id} sx={{ mb: 0.5, px: 0.5, py: 0.25, backgroundColor: 'primary.light', color: 'primary.contrastText', borderRadius: 1, cursor: 'pointer' }} onClick={() => onEdit && onEdit(ev)}>
                                                <Typography variant="caption" noWrap>{ev.title}</Typography>
                                            </Box>
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <Typography variant="caption" color="text.secondary">+{dayEvents.length - 3} more</Typography>
                                        )}
                                    </Box>
                                </Box>
                            )
                        })
                    ))}
                </Box>
            </Paper>
        </Box>
    )
}

export default BoxingEventsCalendar
