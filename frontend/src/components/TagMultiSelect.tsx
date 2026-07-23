import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

interface Props {
    options?: string[]
    value?: string[]
    onChange?: (v: string[]) => void
    placeholder?: string
}

function TagMultiSelect({ options = [], value = [], onChange, placeholder = 'Add tags...' }: Props) {
    // MUI Autocomplete handles keyboard, focus, and freeSolo nicely
    return (
        <Autocomplete
            multiple
            freeSolo
            options={options}
            value={value}
            onChange={(e, newValue) => {
                // ensure strings
                const normalized = (arr: any) => (Array.isArray(arr) ? arr.map((v: any) => String(v).trim()).filter(Boolean) : []);
                onChange && onChange(normalized(newValue));
            }}
            renderInput={(params) => {
                const { renderTags: _rt, ...inputParams } = params || {}
                return (
                    <TextField
                        {...inputParams}
                        placeholder={placeholder}
                        variant="outlined"
                        size="medium"
                        fullWidth
                    />
                )
            }}
            sx={{
                width: '100%',
                '& .MuiAutocomplete-inputRoot': {
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    pr: 1,
                },
                '& .MuiAutocomplete-input': {
                    minWidth: '8rem !important',
                    width: '0 !important',
                    flexGrow: 1,
                },
                '& .MuiChip-root': {
                    my: 0.5,
                },
            }}
        />
    );
}

export default TagMultiSelect;
