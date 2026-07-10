import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

function TagMultiSelect({ options = [], value = [], onChange, placeholder = 'Add tags...' }) {
    // MUI Autocomplete handles keyboard, focus, and freeSolo nicely
    return (
        <Autocomplete
            multiple
            freeSolo
            options={options}
            value={value}
            onChange={(e, newValue) => {
                // ensure strings
                const normalized = (arr) => (Array.isArray(arr) ? arr.map((v) => String(v).trim()).filter(Boolean) : []);
                onChange && onChange(normalized(newValue));
            }}
            /* Use default tag rendering to avoid passing renderTags into DOM; renderInput is explicit to avoid leaking params */
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    variant="outlined"
                    size="small"
                />
            )}
            sx={{ minWidth: 160 }}
        />
    );
}

export default TagMultiSelect;
