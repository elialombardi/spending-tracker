import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import SportsMmaIcon from '@mui/icons-material/SportsMma';

import Alert from '@mui/material/Alert';

const COLOR_OPTIONS = ['green', 'yellow', 'red', 'blue', 'black', 'white'];
const ARROW_OPTIONS = ['←', '→', '↑', '↓'];
const NUMBER_OPTIONS = ['1', '2', '3', '4', '5', '6'];
const NUMBER_LABELS = {
    '1': 'Jab (Lead Hand, Straight)',
    '2': 'Cross / Straight (Rear Hand, Straight)',
    '3': 'Lead Hook (Lead Hand, Circular)',
    '4': 'Rear Hook (Rear Hand, Circular)',
    '5': 'Lead Uppercut (Lead Hand, Upward)',
    '6': 'Rear Uppercut (Rear Hand, Upward)'
};
const DEFENSE_OPTIONS = ['slip-left', 'slip-right', 'duck', 'bob-weave-left', 'bob-weave-right'];
const DEFENSE_LABELS = {
    'slip-left': 'Slip Left',
    'slip-right': 'Slip Right',
    'duck': 'Duck',
    'bob-weave-left': 'Bob & Weave Left',
    'bob-weave-right': 'Bob & Weave Right'
};
const DEFENSE_ICONS = {
    'slip-left': <ArrowBackIosNewIcon fontSize="large" />,
    'slip-right': <ArrowForwardIosIcon fontSize="large" />,
    'duck': <ArrowDownwardIcon fontSize="large" />,
    'bob-weave-left': <RotateLeftIcon fontSize="large" />,
    'bob-weave-right': <RotateRightIcon fontSize="large" />
};

function CognitiveTraining() {
    const [selectedColors, setSelectedColors] = useState(COLOR_OPTIONS.slice());
    const [selectedArrows, setSelectedArrows] = useState(ARROW_OPTIONS.slice());
    const [selectedNumbers, setSelectedNumbers] = useState(NUMBER_OPTIONS.slice());
    const [selectedDefenses, setSelectedDefenses] = useState([]);
    const [durationSec, setDurationSec] = useState(30);
    const [elementDurationMinMs, setElementDurationMinMs] = useState(600);
    const [elementDurationMaxMs, setElementDurationMaxMs] = useState(1000);
    const [running, setRunning] = useState(false);
    const [currentStimulus, setCurrentStimulus] = useState(null);
    const [error, setError] = useState('');

    const stepTimeoutRef = useRef(null);
    const timeoutRef = useRef(null);
    const wakeLockRef = useRef(null);

    useEffect(() => {
        return () => {
            stopTraining();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                wakeLockRef.current.addEventListener('release', () => {
                    // no-op
                });
            }
        } catch (err) {
            console.warn('Wake Lock request failed', err);
        }
    }

    async function releaseWakeLock() {
        try {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        } catch (err) {
            console.warn('Wake Lock release failed', err);
        }
    }

    function buildStimuli() {
        const list = [];
        selectedColors.forEach((c) => list.push({ type: 'color', value: c }));
        selectedArrows.forEach((a) => list.push({ type: 'arrow', value: a }));
        selectedNumbers.forEach((n) => list.push({ type: 'number', value: n }));
        selectedDefenses.forEach((d) => list.push({ type: 'defense', value: d }));
        return list;
    }

    function pickOne(list) {
        if (!list || list.length === 0) return null;
        return list[Math.floor(Math.random() * list.length)];
    }

    async function startTraining() {
        setError('');
        const list = buildStimuli();
        if (list.length === 0) {
            setError('Select at least one stimulus to start the training.');
            return;
        }

        setRunning(true);
        // show one immediately
        setCurrentStimulus(pickOne(list));

        // request wake lock
        await requestWakeLock();

        // schedule randomized stimulus changes
        function scheduleNext() {
            const minMs = Math.max(50, Number(elementDurationMinMs) || 50);
            const maxMs = Math.max(minMs, Number(elementDurationMaxMs) || minMs);
            const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
            stepTimeoutRef.current = setTimeout(() => {
                const listNow = buildStimuli();
                if (!listNow || listNow.length === 0) {
                    setError('No stimuli selected — stopping training.');
                    stopTraining();
                    return;
                }
                setCurrentStimulus(pickOne(listNow));
                scheduleNext();
            }, delay);
        }

        scheduleNext();

        // stop after duration
        timeoutRef.current = setTimeout(() => {
            stopTraining();
        }, Math.max(1, Number(durationSec)) * 1000);

        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'visible' && running) {
            // attempt to reacquire
            requestWakeLock().catch(() => { });
        }
    }

    async function stopTraining() {
        setRunning(false);
        if (stepTimeoutRef.current) {
            clearTimeout(stepTimeoutRef.current);
            stepTimeoutRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        await releaseWakeLock();
        setCurrentStimulus(null);
    }

    function toggleItem(setter, list, item) {
        if (list.includes(item)) {
            setter(list.filter((x) => x !== item));
        } else {
            setter([...list, item]);
        }
    }

    function setAllColors(select) {
        setSelectedColors(select ? COLOR_OPTIONS.slice() : []);
    }

    function setAllArrows(select) {
        setSelectedArrows(select ? ARROW_OPTIONS.slice() : []);
    }

    function setAllNumbers(select) {
        setSelectedNumbers(select ? NUMBER_OPTIONS.slice() : []);
    }

    function setAllDefenses(select) {
        setSelectedDefenses(select ? DEFENSE_OPTIONS.slice() : []);
    }

    function setAllGlobal(select) {
        setAllColors(select);
        setAllArrows(select);
        setAllNumbers(select);
        setAllDefenses(select);
    }

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>Cognitive Traning</Typography>
            {error ? <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert> : null}
            {!running ? (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Paper sx={{ p: 2, width: '100%', maxWidth: 720 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle1">Select stimuli</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button size="small" onClick={() => setAllGlobal(true)}>Select All</Button>
                                <Button size="small" onClick={() => setAllGlobal(false)}>Clear All</Button>
                            </Box>
                        </Box>
                        <Box sx={{ mt: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ mt: 1 }}>Colors</Typography>
                                <Button size="small" onClick={() => setAllColors(true)}>All</Button>
                                <Button size="small" onClick={() => setAllColors(false)}>None</Button>
                            </Box>
                            <FormGroup row>
                                {COLOR_OPTIONS.map((c) => (
                                    <FormControlLabel
                                        key={c}
                                        control={<Checkbox checked={selectedColors.includes(c)} onChange={() => toggleItem(setSelectedColors, selectedColors, c)} />}
                                        label={(
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ width: 16, height: 16, bgcolor: c, borderRadius: 0.5, border: c === 'white' ? '1px solid rgba(0,0,0,0.5)' : c === 'black' ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(0,0,0,0.2)' }} />
                                                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{c}</Typography>
                                            </Box>
                                        )}
                                    />
                                ))}
                            </FormGroup>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ mt: 1 }}>Arrows</Typography>
                                <Button size="small" onClick={() => setAllArrows(true)}>All</Button>
                                <Button size="small" onClick={() => setAllArrows(false)}>None</Button>
                            </Box>
                            <FormGroup row>
                                {ARROW_OPTIONS.map((a) => (
                                    <FormControlLabel
                                        key={a}
                                        control={<Checkbox checked={selectedArrows.includes(a)} onChange={() => toggleItem(setSelectedArrows, selectedArrows, a)} />}
                                        label={a}
                                    />
                                ))}
                            </FormGroup>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ mt: 1 }}>Defense</Typography>
                                <Button size="small" onClick={() => setAllDefenses(true)}>All</Button>
                                <Button size="small" onClick={() => setAllDefenses(false)}>None</Button>
                            </Box>
                            <FormGroup row>
                                {DEFENSE_OPTIONS.map((d) => (
                                    <FormControlLabel
                                        key={d}
                                        control={<Checkbox checked={selectedDefenses.includes(d)} onChange={() => toggleItem(setSelectedDefenses, selectedDefenses, d)} />}
                                        label={(
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ color: 'text.primary' }}>{DEFENSE_ICONS[d]}</Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{DEFENSE_LABELS[d]}</Typography>
                                            </Box>
                                        )}
                                    />
                                ))}
                            </FormGroup>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ mt: 1 }}>Numbers</Typography>
                                <Button size="small" onClick={() => setAllNumbers(true)}>All</Button>
                                <Button size="small" onClick={() => setAllNumbers(false)}>None</Button>
                            </Box>
                            <FormGroup row>
                                {NUMBER_OPTIONS.map((n) => (
                                    <FormControlLabel
                                        key={n}
                                        control={<Checkbox checked={selectedNumbers.includes(n)} onChange={() => toggleItem(setSelectedNumbers, selectedNumbers, n)} />}
                                        label={(
                                            <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{n} — {NUMBER_LABELS[n]}</Typography>
                                            </Box>
                                        )}
                                    />
                                ))}
                            </FormGroup>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2">Duration (seconds)</Typography>
                            <TextField type="number" size="small" value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} sx={{ mt: 1, width: 140 }} inputProps={{ min: 1 }} />
                        </Box>

                        <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Box>
                                <Typography variant="body2">Element duration min (ms)</Typography>
                                <TextField type="number" size="small" value={elementDurationMinMs} onChange={(e) => setElementDurationMinMs(Number(e.target.value))} sx={{ mt: 1, width: 140 }} inputProps={{ min: 50 }} />
                            </Box>
                            <Box>
                                <Typography variant="body2">Element duration max (ms)</Typography>
                                <TextField type="number" size="small" value={elementDurationMaxMs} onChange={(e) => setElementDurationMaxMs(Number(e.target.value))} sx={{ mt: 1, width: 140 }} inputProps={{ min: 50 }} />
                            </Box>
                        </Box>

                        {elementDurationMinMs > elementDurationMaxMs ? (
                            <Alert severity="warning" sx={{ mt: 2 }}>Minimum element duration must be less than or equal to maximum.</Alert>
                        ) : null}
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                            <Button variant="contained" onClick={startTraining} disabled={running || elementDurationMinMs > elementDurationMaxMs}>Start</Button>
                            <Button variant="outlined" onClick={stopTraining} disabled={!running}>Stop</Button>
                        </Box>
                    </Paper>
                </Box>
            ) : (
                <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
                    <Box sx={{ textAlign: 'center' }}>
                        {currentStimulus ? (
                            currentStimulus.type === 'color' ? (
                                <Box sx={{ width: '60vmin', height: '60vmin', borderRadius: '50%', mx: 'auto', bgcolor: currentStimulus.value, border: currentStimulus.value === 'white' ? '2px solid rgba(0,0,0,0.35)' : currentStimulus.value === 'black' ? '2px solid rgba(255,255,255,0.35)' : 'none' }} />
                            ) : currentStimulus.type === 'number' ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="h1">{currentStimulus.value}</Typography>
                                    <Typography variant="h6">{NUMBER_LABELS[currentStimulus.value]}</Typography>
                                </Box>
                            ) : currentStimulus.type === 'defense' ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <Box sx={{ color: 'text.primary' }}>{DEFENSE_ICONS[currentStimulus.value]}</Box>
                                    <Typography variant="h4">{DEFENSE_LABELS[currentStimulus.value]}</Typography>
                                </Box>
                            ) : (
                                <Typography variant="h1">{currentStimulus.value}</Typography>
                            )
                        ) : (
                            <Typography color="text.secondary">Preparing…</Typography>
                        )}
                    </Box>
                    <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                        <Button variant="contained" color="error" onClick={stopTraining}>Stop</Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

export default CognitiveTraining;
