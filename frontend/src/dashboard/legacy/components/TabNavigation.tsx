import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Badge from '@mui/material/Badge'
import { DASHBOARD_TABS } from '../lib/constants'

export default function TabNavigation({ activeTab, onTabChange, reviewCount }) {
    const handleChange = (event, newValue) => {
        onTabChange(newValue)
    }

    return (
        <Box sx={{ width: '100%', px: 0 }}>
            <Tabs
                value={activeTab}
                onChange={handleChange}
                aria-label="Dashboard tabs"
                variant="scrollable"
                scrollButtons="auto"
            >
                {DASHBOARD_TABS.map((tab) => (
                    <Tab
                        key={tab.id}
                        value={tab.id}
                        label={
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <strong>{tab.title}</strong>
                                    {tab.id === 'review' && reviewCount > 0 ? (
                                        <Badge badgeContent={reviewCount} color="primary" sx={{ ml: 1 }} />
                                    ) : null}
                                </Box>
                            </Box>
                        }
                        aria-controls={`page-${tab.id}`}
                        id={`tab-${tab.id}`}
                    />
                ))}
            </Tabs>
        </Box>
    )
}