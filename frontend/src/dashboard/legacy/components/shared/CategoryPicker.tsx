import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

function buildCategoryMeta(category) {
    const parts = []

    if (category.transactions > 0) {
        parts.push(`${category.transactions} tx`)
    }

    if (category.rules > 0) {
        parts.push(`${category.rules} rule${category.rules === 1 ? '' : 's'}`)
    }

    return parts.join(' • ')
}

export default function CategoryPicker({ categories = [], disabled, name, placeholder, value = '', onChange }) {
    const optionNames = categories.map((c) => c.name)

    return (
        <div className={`category-picker${disabled ? ' is-disabled' : ''}`}>
            <Autocomplete
                sx={{ width: '100%' }}
                freeSolo
                disableClearable
                disabled={disabled}
                options={optionNames}
                value={value || ''}
                onChange={(event, newValue) => {
                    if (newValue == null) {
                        onChange('')
                    } else {
                        onChange(newValue)
                    }
                }}
                onInputChange={(event, newInputValue) => {
                    onChange(newInputValue)
                }}
                PopperProps={{ sx: { minWidth: 220 } }}
                renderInput={(params) => {
                    const { InputProps, ...textFieldParams } = params || {}

                    return (
                        <TextField
                            {...textFieldParams}
                            name={name}
                            placeholder={placeholder}
                            variant="outlined"
                            size="small"
                            fullWidth
                            InputProps={{
                                ...InputProps,
                                sx: { bgcolor: 'transparent', color: 'inherit' },
                            }}
                        />
                    )
                }}
                renderOption={(props, option) => {
                    const { item, ...liProps } = props || {}
                    const cat = categories.find((c) => c.name === option)
                    const meta = cat ? buildCategoryMeta(cat) : ''

                    return (
                        <li {...liProps} key={option} className="category-picker-option">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span className="category-picker-option-copy">
                                    <span className="category-picker-option-title">{option}</span>
                                </span>
                                <small style={{ opacity: 0.66, marginLeft: 12 }}>{meta}</small>
                            </div>
                        </li>
                    )
                }}
            />
        </div>
    )
}